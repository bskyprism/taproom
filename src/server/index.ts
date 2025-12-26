import { type Context, Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { cors } from 'hono/cors'
import { Tap, formatAdminAuthHeader } from '@atproto/tap'
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

/**
 * Create a Tap client instance for the request
 */
function getTapClient (c:Context<{ Bindings:Env }>):Tap {
    return new Tap(c.env.TAP_SERVER_URL, {
        adminPassword: c.env.TAP_ADMIN_PASSWORD
    })
}

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

        return c.json({ error: message }, status)
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
        return c.json({ error: message }, status)
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
        return c.json({ error: message }, status)
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
        return c.json({ error: message }, 500)
    }
})

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
        return c.json({ error: message }, 500)
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
        return c.json({ error: message }, 500)
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
        throw new TapFetchError(text || res.statusText, res.status)
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
