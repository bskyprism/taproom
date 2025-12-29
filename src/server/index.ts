import { type Context, Hono } from 'hono'
import { type DidDocument } from '@atproto/identity'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { cors } from 'hono/cors'
import { getCookie } from 'hono/cookie'
import { Tap, formatAdminAuthHeader } from '@atproto/tap'
import { createAuthRouter, requireAuth } from './auth.js'
import type {
    TapHealth,
    TapStats,
    AddRepoRequest,
    RemoveRepoRequest
} from '../shared.js'

export type StatsPath =
    |'repo-count'
    |'record-count'
    |'outbox-buffer'
    |'resync-buffer'
    |'cursors'

// `Env` is in worker-config.d.ts
const app = new Hono<{ Bindings:Env }>()

app.use('/api/*', cors())
app.use('/resolve/*', cors())

// Mount auth routes
app.route('/api/auth', createAuthRouter())

/**
 * Protect write routes with passkey session auth
 * Falls back to bearer token for backwards compatibility / API access
 */
app.use('/api/tap/repos/*', async (c, next) => {
    // Check for session cookie (passkey auth)
    const passkeyId = await requireAuth(c, getCookie)
    if (passkeyId) {
        return next()
    }

    // Fall back to bearer token auth
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        if (token === c.env.API_AUTH_TOKEN) {
            return next()
        }
    }

    return c.text('Unauthorized', 401)
})

/**
 * Health check for this server
 */
app.get('/api/health', (c) => {
    return c.json({
        status: 'ok',
        service: 'taproom',
    })
})

app.get('/health', (c) => {
    return c.json({ status: 'ok' })
})

/**
 * Resolve a Bluesky handle to a DID
 */
app.get('/resolve/handle/:handle', async (c) => {
    const handle = c.req.param('handle').replace(/^@/, '')
    try {
        const res = await fetch(
            `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
        )
        if (!res.ok) {
            const text = await res.text()
            return c.text(parseErrorBody(text) || 'Handle not found', res.status as ContentfulStatusCode)
        }
        const data = await res.json()
        return c.json(data)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return c.text(message, 500)
    }
})

/**
 * Resolve a DID to its DID document
 */
app.get('/resolve/did/:did', async (c) => {
    try {
        const tap = getTapClient(c)
        const data = await tap.resolveDid(c.req.param('did'))
        return c.json(data)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return c.text(message, 500)
    }
})

/**
 * Health check for tap service
 */
app.get('/api/tap/health', async (c) => {
    try {
        const data = await tapFetch<TapHealth>(
            c.env.TAP_SERVER_URL + '/health',
            c.env.TAP_ADMIN_PASSWORD
        )

        return c.json({
            ...data,
            url: c.env.TAP_SERVER_URL
        })
    } catch (err) {
        const status:ContentfulStatusCode = err instanceof TapFetchError ?
            err.status :
            500
        const message = err instanceof Error ? err.message : 'Unknown error'

        return c.text(message, status)
    }
})

/**
 * Get all tap server stats
 */
app.get('/api/tap/stats', async (c) => {
    try {
        const data = await fetchStats(
            c.env.TAP_SERVER_URL,
            c.env.TAP_ADMIN_PASSWORD
        )
        return c.json(data)
    } catch (err) {
        const status:ContentfulStatusCode = err instanceof TapFetchError ?
            err.status :
            500
        const message = err instanceof Error ? err.message : 'Unknown error'
        return c.text(message, status)
    }
})

/**
 * Get specific stats
 */
app.get('/api/tap/stats/:type', async (c) => {
    try {
        const type:StatsPath = c.req.param('type') as StatsPath
        const data = await tapFetch<unknown>(
            c.env.TAP_SERVER_URL + `/stats/${type}`,
            c.env.TAP_ADMIN_PASSWORD
        )
        return c.json(data)
    } catch (err) {
        const status:ContentfulStatusCode = err instanceof TapFetchError ? err.status : 500
        const message = err instanceof Error ? err.message : 'Unknown error'
        return c.text(message, status)
    }
})

/**
 * Get info for a specific DID
 */
app.get('/api/tap/info/:did', async (c) => {
    try {
        const tap = getTapClient(c)
        const data = await tap.getRepoInfo(c.req.param('did'))
        console.log('***got data***', data)
        return c.json(data)
    } catch (_err) {
        const err = _err as TapFetchError
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.log('***got error***', message)
        let status = 500
        if (message.includes('Not Found')) {
            status = 404
            return new Response('Not found.', { status })
        } else {
            return new Response(message, { status: 500 })
        }
    }
})

/**
 * Resolve a DID
 */
app.get('/api/tap/resolve/:did', async (c) => {
    try {
        const tap = getTapClient(c)
        const data = await tap.resolveDid(c.req.param('did'))
        return c.json(data)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return c.text(message, 500)
    }
})

/**
 * Get list of tracked repos
 */
app.get('/api/tap/repos/:cursor?', async (c) => {
    let url:string
    try {
        const cursor = c.req.param('cursor')
        const shouldResolve = c.req.query('resolve') !== undefined
        url = (cursor ?
            `${c.env.TAP_SERVER_URL}/repos/${cursor}` :
            `${c.env.TAP_SERVER_URL}/repos`)

        const data = await tapFetch<{ dids:string[], cursor:string|null }>(
            url,
            c.env.TAP_ADMIN_PASSWORD
        )

        if (shouldResolve) {  // return hydrated DID docs
            const tap = getTapClient(c)
            return c.json({
                dids: await hydrateRepos(data.dids, tap),
                cursor: data.cursor
            })
        }

        // return did strings only
        return c.json({
            dids: data.dids.map(did => ({ did })),
            cursor: data.cursor
        })
    } catch (err) {
        console.log('**** errrrrr *****', err)
        console.log('**', url!)
        const status:ContentfulStatusCode = err instanceof TapFetchError ?
            err.status :
            500
        const message = err instanceof Error ? err.message : 'Unknown error'
        return c.text(message, status)
    }
})

/**
 * Resolve the DID documents for a given list of IDs.
 * @param dids ID strings.
 * @returns {DidDocument[]}
 */
async function hydrateRepos (dids:string[], tap:Tap):Promise<DidDocument[]> {
    const docs = await Promise.all(dids.map(did => {
        return tap.resolveDid(did)
    }))

    return docs.filter(Boolean)
}

/**
 * Add a repo to track
 */
app.post('/api/tap/repos/add', async (c) => {
    try {
        const tap = getTapClient(c)
        const body = await c.req.json<AddRepoRequest>()
        await tap.addRepos([body.did])
        return c.body(null, 204)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('**err**', (err as Error).message)
        return c.text(message, 500)
    }
})

/**
 * Remove a repo from tracking
 */
app.post('/api/tap/repos/remove', async (c) => {
    try {
        const tap = getTapClient(c)
        const body = await c.req.json<RemoveRepoRequest>()
        await tap.removeRepos([body.did])
        return c.body(null, 204)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return c.text(message, 500)
    }
})

/**
 * Serve static assets (Preact frontend)
 */
app.all('*', (c) => {
    if (!(c.env?.ASSETS)) {
        // In dev mode, let Vite handle static assets
        return c.notFound()
    }

    return c.env.ASSETS.fetch(c.req.raw)
})

export default app

class TapFetchError extends Error {
    status:ContentfulStatusCode
    constructor (message:string, status:number) {
        super(message)
        this.status = status as ContentfulStatusCode
    }
}

/**
 * Parse an error response body and extract a human-readable message.
 * Handles JSON responses with 'message' or 'error' fields, or plain text.
 */
function parseErrorBody (text: string): string {
    if (!text) return 'Unknown error'

    try {
        const json = JSON.parse(text)
        // Prefer 'message' over 'error' for more descriptive messages
        return json.message || json.error || text
    } catch {
        // Not JSON, return as-is
        return text
    }
}

/**
 * Helper - returns data directly or throws TapFetchError
 */
async function tapFetch<T> (
    tapUrl:string,  // the full URL for the tap server endpoint
    adminPassword:string,
    options?:RequestInit
):Promise<T> {
    const headers:Record<string, string> = {
        'Content-Type': 'application/json',
        ...options?.headers as Record<string, string>,
    }
    headers.Authorization = formatAdminAuthHeader(adminPassword)

    const res = await fetch(tapUrl, { ...options, headers })

    if (!res.ok) {
        const text = await res.text()
        console.log('not ok...', text)
        console.log('the url', tapUrl)
        const message = parseErrorBody(text) || res.statusText
        throw new TapFetchError(message, res.status)
    }

    return await res.json() as T
}

async function fetchStats (tapUrl:string, pw:string):Promise<TapStats> {
    const [count, records, obb, rsb, cursors] = await Promise.all([
        tapFetch<{ repo_count:number }>(tapUrl + '/stats/repo-count', pw),
        tapFetch<{ record_count:number }>(tapUrl + '/stats/record-count', pw),
        tapFetch<{ outbox_buffer:number }>(tapUrl + '/stats/outbox-buffer', pw),
        tapFetch<{ resync_buffer:number }>(tapUrl + '/stats/resync-buffer', pw),
        tapFetch<{
            firehose:number,
            list_repos:string
        }>(tapUrl + '/stats/cursors', pw)
    ])

    return {
        repoCount: count.repo_count,
        recordCount: records.record_count,
        outboxBuffer: obb.outbox_buffer,
        resyncBuffer: rsb.resync_buffer,
        cursors: {
            firehose: cursors.firehose,
            listRepos: cursors.list_repos
        }
    }
}

/**
 * Create a Tap client instance.
 */
function getTapClient (c:Context<{ Bindings:Env }>):Tap {
    return new Tap(c.env.TAP_SERVER_URL, {
        adminPassword: c.env.TAP_ADMIN_PASSWORD
    })
}
