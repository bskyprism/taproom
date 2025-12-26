import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
    RegistrationResponseJSON,
    AuthenticationResponseJSON,
    AuthenticatorTransportFuture,
} from '@simplewebauthn/server'

// Base64 utilities for Workers (no Buffer)
function uint8ArrayToBase64 (arr:Uint8Array):string {
    return btoa(String.fromCharCode(...arr))
}

function base64ToUint8Array (base64:string):Uint8Array<ArrayBuffer> {
    const binary = atob(base64)
    const buffer = new ArrayBuffer(binary.length)
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

// WebAuthn configuration
// These must match between registration and authentication
const RP_NAME = 'Taproom'

// Helper to get RP_ID from request origin
function getRpId (origin:string):string {
    const url = new URL(origin)
    return url.hostname
}

// Helper to generate a random ID
function generateId ():string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

// Challenge TTL: 5 minutes (in seconds for KV)
const CHALLENGE_TTL_SECONDS = 5 * 60

// Create the auth router
export function createAuthRouter () {
    const auth = new Hono<{ Bindings:Env }>()

    /**
     * Check if any passkeys are registered
     */
    auth.get('/status', async (c) => {
        const result = await c.env.taproom_auth
            .prepare('SELECT COUNT(*) as count FROM passkeys')
            .first<{ count:number }>()

        const sessionId = getCookie(c, 'session')
        let authenticated = false

        if (sessionId) {
            const session = await c.env.taproom_auth
                .prepare('SELECT id FROM sessions WHERE id = ? AND expires_at > datetime("now")')
                .bind(sessionId)
                .first()
            authenticated = !!session
        }

        return c.json({
            registered: (result?.count ?? 0) > 0,
            authenticated,
        })
    })

    /**
     * Start registration - requires the secret
     */
    auth.post('/register/options', async (c) => {
        const body = await c.req.json<{ secret:string }>()

        // Verify the registration secret
        if (body.secret !== c.env.PASSKEY_REGISTRATION_SECRET) {
            return c.json({ error: 'Invalid registration secret' }, 403)
        }

        // Check if already registered (only allow one passkey for simplicity)
        const existing = await c.env.taproom_auth
            .prepare('SELECT COUNT(*) as count FROM passkeys')
            .first<{ count:number }>()

        if (existing && existing.count > 0) {
            return c.json({ error: 'A passkey is already registered' }, 400)
        }

        const origin = c.req.header('origin') || `https://${c.req.header('host')}`
        const rpId = getRpId(origin)

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: rpId,
            userName: 'admin',
            userDisplayName: 'Admin',
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        })

        // Store the challenge in KV with TTL
        const challengeKey = generateId()
        await c.env.AUTH_CHALLENGES.put(
            challengeKey,
            options.challenge,
            { expirationTtl: CHALLENGE_TTL_SECONDS }
        )

        return c.json({
            options,
            challengeKey,
        })
    })

    /**
     * Complete registration
     */
    auth.post('/register/verify', async (c) => {
        const body = await c.req.json<{
            secret:string,
            challengeKey:string,
            response:RegistrationResponseJSON,
        }>()

        // Verify the secret again
        if (body.secret !== c.env.PASSKEY_REGISTRATION_SECRET) {
            return c.json({ error: 'Invalid registration secret' }, 403)
        }

        // Get the stored challenge from KV
        const challenge = await c.env.AUTH_CHALLENGES.get(body.challengeKey)
        if (!challenge) {
            return c.json({ error: 'Challenge expired or invalid' }, 400)
        }
        // Delete the challenge after retrieval (one-time use)
        await c.env.AUTH_CHALLENGES.delete(body.challengeKey)

        const origin = c.req.header('origin') || `https://${c.req.header('host')}`
        const rpId = getRpId(origin)

        try {
            const verification = await verifyRegistrationResponse({
                response: body.response,
                expectedChallenge: challenge,
                expectedOrigin: origin,
                expectedRPID: rpId,
            })

            if (!verification.verified || !verification.registrationInfo) {
                return c.json({ error: 'Registration verification failed' }, 400)
            }

            const { credential, credentialDeviceType, credentialBackedUp } =
                verification.registrationInfo

            // Store the credential
            // credential.id is already a Base64URLString
            // credential.publicKey is Uint8Array, needs encoding
            const passkeyId = generateId()
            await c.env.taproom_auth.prepare(`
                INSERT INTO passkeys (id, credential_id, public_key, counter, device_type, backed_up, transports)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
                passkeyId,
                credential.id,
                uint8ArrayToBase64(credential.publicKey),
                credential.counter,
                credentialDeviceType,
                credentialBackedUp ? 1 : 0,
                JSON.stringify(credential.transports || []),
            ).run()

            // Create a session
            const sessionId = generateId()
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()

            await c.env.taproom_auth.prepare(`
                INSERT INTO sessions (id, passkey_id, expires_at)
                VALUES (?, ?, ?)
            `).bind(sessionId, passkeyId, expiresAt).run()

            setCookie(c, 'session', sessionId, {
                httpOnly: true,
                secure: true,
                sameSite: 'Strict',
                path: '/',
                maxAge: SESSION_DURATION_MS / 1000,
            })

            return c.json({ verified: true })
        } catch (err) {
            console.error('Registration error:', err)
            return c.json({
                error: err instanceof Error ? err.message : 'Registration failed'
            }, 400)
        }
    })

    /**
     * Start authentication
     */
    auth.post('/authenticate/options', async (c) => {
        // Get all registered credentials
        const credentials = await c.env.taproom_auth
            .prepare('SELECT credential_id, transports FROM passkeys')
            .all<{ credential_id:string, transports:string }>()

        if (!credentials.results || credentials.results.length === 0) {
            return c.json({ error: 'No passkeys registered' }, 400)
        }

        const origin = c.req.header('origin') || `https://${c.req.header('host')}`
        const rpId = getRpId(origin)

        const options = await generateAuthenticationOptions({
            rpID: rpId,
            allowCredentials: credentials.results.map(cred => ({
                id: cred.credential_id,  // Already a Base64URLString
                transports: JSON.parse(cred.transports || '[]') as AuthenticatorTransportFuture[],
            })),
            userVerification: 'preferred',
        })

        // Store the challenge in KV with TTL
        const challengeKey = generateId()
        await c.env.AUTH_CHALLENGES.put(
            challengeKey,
            options.challenge,
            { expirationTtl: CHALLENGE_TTL_SECONDS }
        )

        return c.json({
            options,
            challengeKey,
        })
    })

    /**
     * Complete authentication
     */
    auth.post('/authenticate/verify', async (c) => {
        const body = await c.req.json<{
            challengeKey:string,
            response:AuthenticationResponseJSON,
        }>()

        // Get the stored challenge from KV
        const challenge = await c.env.AUTH_CHALLENGES.get(body.challengeKey)
        if (!challenge) {
            return c.json({ error: 'Challenge expired or invalid' }, 400)
        }
        // Delete the challenge after retrieval (one-time use)
        await c.env.AUTH_CHALLENGES.delete(body.challengeKey)

        // Find the credential
        const credentialIdBase64 = body.response.id
        const passkey = await c.env.taproom_auth
            .prepare('SELECT * FROM passkeys WHERE credential_id = ?')
            .bind(credentialIdBase64)
            .first<{
                id:string,
                credential_id:string,
                public_key:string,
                counter:number,
                transports:string,
            }>()

        if (!passkey) {
            return c.json({ error: 'Credential not found' }, 400)
        }

        const origin = c.req.header('origin') || `https://${c.req.header('host')}`
        const rpId = getRpId(origin)

        try {
            const verification = await verifyAuthenticationResponse({
                response: body.response,
                expectedChallenge: challenge,
                expectedOrigin: origin,
                expectedRPID: rpId,
                credential: {
                    id: passkey.credential_id,  // Already a Base64URLString
                    publicKey: base64ToUint8Array(passkey.public_key),
                    counter: passkey.counter,
                    transports: JSON.parse(passkey.transports || '[]') as AuthenticatorTransportFuture[],
                },
            })

            if (!verification.verified) {
                return c.json({ error: 'Authentication failed' }, 400)
            }

            // Update the counter
            await c.env.taproom_auth.prepare(`
                UPDATE passkeys SET counter = ? WHERE id = ?
            `).bind(
                verification.authenticationInfo.newCounter,
                passkey.id
            ).run()

            // Create a session
            const sessionId = generateId()
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()

            await c.env.taproom_auth.prepare(`
                INSERT INTO sessions (id, passkey_id, expires_at)
                VALUES (?, ?, ?)
            `).bind(sessionId, passkey.id, expiresAt).run()

            setCookie(c, 'session', sessionId, {
                httpOnly: true,
                secure: true,
                sameSite: 'Strict',
                path: '/',
                maxAge: SESSION_DURATION_MS / 1000,
            })

            return c.json({ verified: true })
        } catch (err) {
            console.error('Authentication error:', err)
            return c.json({
                error: err instanceof Error ? err.message : 'Authentication failed'
            }, 400)
        }
    })

    /**
     * Logout - clear session
     */
    auth.post('/logout', async (c) => {
        const sessionId = getCookie(c, 'session')

        if (sessionId) {
            await c.env.taproom_auth.prepare(`
                DELETE FROM sessions WHERE id = ?
            `).bind(sessionId).run()
        }

        deleteCookie(c, 'session', { path: '/' })

        return c.json({ success: true })
    })

    return auth
}

/**
 * Middleware to require authentication
 * Use this to protect routes that need passkey auth
 */
export async function requireAuth (
    c:{ env:Env, req:{ header:(name:string)=>string|undefined } },
    getCookieFn:typeof getCookie,
):Promise<string|null> {
    const sessionId = getCookieFn(c as Parameters<typeof getCookie>[0], 'session')

    if (!sessionId) {
        return null
    }

    const session = await c.env.taproom_auth
        .prepare(`
            SELECT s.id, s.passkey_id
            FROM sessions s
            WHERE s.id = ? AND s.expires_at > datetime('now')
        `)
        .bind(sessionId)
        .first<{ id:string, passkey_id:string }>()

    return session?.passkey_id || null
}
