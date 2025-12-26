import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import { useSignal } from '@preact/signals'
import {
    startRegistration,
    startAuthentication,
} from '@simplewebauthn/browser'
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import ky from 'ky'
import Debug from '@substrate-system/debug'
import { Button } from './button.js'
import { State } from '../state.js'
import type { AppState } from '../state.js'
import './auth.css'

const debug = Debug('taproom:auth')

export const Auth:FunctionComponent<{ state:AppState }> = function ({ state }) {
    const secret = useSignal('')
    const submitting = useSignal(false)
    const error = useSignal<string|null>(null)

    const handleRegister = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        if (!secret.value.trim()) return

        submitting.value = true
        error.value = null

        try {
            // Get registration options
            const optionsRes = await ky.post('/api/auth/register/options', {
                json: { secret: secret.value.trim() }
            }).json<{
                options:PublicKeyCredentialCreationOptionsJSON;
                challengeKey:string;
            }>()

            debug('got registration options', optionsRes)

            // Start WebAuthn registration
            const credential = await startRegistration({
                optionsJSON: optionsRes.options,
            })

            debug('got credential', credential)

            // Verify with server
            await ky.post('/api/auth/register/verify', {
                json: {
                    secret: secret.value.trim(),
                    challengeKey: optionsRes.challengeKey,
                    response: credential,
                }
            })

            debug('registration complete')
            secret.value = ''
            await State.FetchAuthStatus(state)
        } catch (err) {
            debug('registration error', err)
            if (err instanceof Error) {
                // Try to get error message from response
                try {
                    const body = await (err as { response?:Response })
                        .response?.json() as { error?:string }
                    error.value = body?.error || err.message
                } catch {
                    error.value = err.message
                }
            } else {
                error.value = 'Registration failed'
            }
        } finally {
            submitting.value = false
        }
    }, [])

    const handleLogin = useCallback(async () => {
        submitting.value = true
        error.value = null

        try {
            // Get authentication options
            const optionsRes = await ky.post('/api/auth/authenticate/options')
                .json<{
                    options:PublicKeyCredentialRequestOptionsJSON;
                    challengeKey:string;
                }>()

            debug('got auth options', optionsRes)

            // Start WebAuthn authentication
            const credential = await startAuthentication({
                optionsJSON: optionsRes.options,
            })

            debug('got auth credential', credential)

            // Verify with server
            await ky.post('/api/auth/authenticate/verify', {
                json: {
                    challengeKey: optionsRes.challengeKey,
                    response: credential,
                }
            })

            debug('authentication complete')
            await State.FetchAuthStatus(state)
        } catch (err) {
            debug('auth error', err)
            if (err instanceof Error) {
                try {
                    const body = await (err as { response?:Response })
                        .response?.json() as { error?:string }
                    error.value = body?.error || err.message
                } catch {
                    error.value = err.message
                }
            } else {
                error.value = 'Authentication failed'
            }
        } finally {
            submitting.value = false
        }
    }, [])

    const handleLogout = useCallback(async () => {
        await State.Logout(state)
    }, [])

    const auth = state.auth.value

    // Loading state
    if (state.authLoading.value || !auth) {
        return html`<div class="auth auth--loading">
            <span class="auth-loading">...</span>
        </div>`
    }

    // Authenticated - show logout
    if (auth.authenticated) {
        return html`<div class="auth auth--authenticated">
            <span class="auth-status authenticated">Authenticated</span>
            <button class="auth-logout" onClick=${handleLogout}>
                Logout
            </button>
        </div>`
    }

    // Not registered - show registration form
    if (!auth.registered) {
        return html`<div class="auth auth--register">
            <form class="auth-form" onSubmit=${handleRegister}>
                <input
                    type="password"
                    placeholder="Registration secret"
                    value=${secret.value}
                    onInput=${(e:Event) => {
                        secret.value = (e.target as HTMLInputElement).value
                    }}
                    disabled=${submitting.value}
                />
                <${Button}
                    type="submit"
                    isSpinning=${submitting}
                    disabled=${!secret.value.trim()}
                >
                    Register Passkey
                <//>
            </form>
            ${error.value && html`<p class="auth-error">${error.value}</p>`}
        </div>`
    }

    // Registered but not authenticated - show login
    return html`<div class="auth auth--login">
        <${Button}
            onClick=${handleLogin}
            isSpinning=${submitting}
        >
            Login with Passkey
        <//>
        ${error.value && html`<p class="auth-error">${error.value}</p>`}
    </div>`
}
