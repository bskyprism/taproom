import { Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import { Tap, formatAdminAuthHeader } from '@atproto/tap'
import type {
    TapHealth,
    TapRepoInfo,
    TapStats,
    AddRepoRequest,
    RemoveRepoRequest,
    ApiResponse
} from '../shared.js'

export type StatsPath =
    |'repo-count'
    |'record-count'
    |'outbox-buffer'
    |'resync-buffer'
    |'cursors' 

// export type Stats = {
//     count;
//     records;
//     outboxBuffer;
//     resyncBuffer;
//     cursors;
// }

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
    return c.json({ status: 'ok', service: 'taproom' })
})

app.get('/health', (c) => {
    return c.json({ status: 'ok' })
})

/**
 * Health check for tap service
 */
app.get('/api/tap/health', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const result = await tapFetch<TapHealth>(
        tapUrl + '/health',
        c.env.TAP_ADMIN_PASSWORD
    )
    return c.json(result)
})

/**
 * Get tap server stats
 */
app.get('/api/tap/stats', async (c) => {
    const pw = c.env.TAP_ADMIN_PASSWORD
    const tapUrl = c.env.TAP_SERVER_URL
    const res = await fetchStats(tapUrl, pw)
    return c.json(res)
})

/**
 * Get specific stats
 */
app.get('/api/tap/stats/:type', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const type:StatsPath = c.req.param('type') as StatsPath
    const result = await tapFetch<unknown>(
        tapUrl + `/stats/${type}`,
        c.env.TAP_ADMIN_PASSWORD
    )

    return c.json(result)
})

/**
 * Get info for a specific DID
 */
app.get('/api/tap/info/:did', async (c) => {
    const tap = getTapClient(c)
    const did = c.req.param('did')
    try {
        const data = await tap.getRepoInfo(did)
        return c.json({ success: true, data } as ApiResponse<typeof data>)
    } catch (err) {
        return c.json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        } as ApiResponse<TapRepoInfo>)
    }
})

/**
 * Resolve a DID
 */
app.get('/api/tap/resolve/:did', async (c) => {
    const tap = getTapClient(c)
    const did = c.req.param('did')
    try {
        const data = await tap.resolveDid(did)
        return c.json({ success: true, data } as ApiResponse<typeof data>)
    } catch (err) {
        return c.json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        } as ApiResponse<unknown>)
    }
})

/**
 * Add a repo to track
 */
app.post('/api/tap/repos/add', async (c) => {
    const tap = getTapClient(c)
    const body = await c.req.json<AddRepoRequest>()
    try {
        await tap.addRepos([body.did])
        return c.json({ success: true } as ApiResponse<void>)
    } catch (err) {
        return c.json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        } as ApiResponse<void>)
    }
})

/**
 * Remove a repo from tracking
 */
app.post('/api/tap/repos/remove', async (c) => {
    const tap = getTapClient(c)
    const body = await c.req.json<RemoveRepoRequest>()
    try {
        await tap.removeRepos([body.did])
        return c.json({ success: true } as ApiResponse<void>)
    } catch (err) {
        return c.json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        } as ApiResponse<void>)
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

/**
 * Helper
 */
async function tapFetch<T> (
    tapUrl:string,  // the full URL for the tap server endpoint
    adminPassword:string,
    options?:RequestInit
):Promise<ApiResponse<T>> {
    try {
        const headers:Record<string, string> = {
            'Content-Type': 'application/json',
            ...options?.headers as Record<string, string>,
        }
        headers.Authorization = formatAdminAuthHeader(adminPassword)

        const res = await fetch(tapUrl, { ...options, headers })

        if (!res.ok) {
            const text = await res.text()
            return { success: false, error: text || res.statusText }
        }

        const data = await res.json() as T
        return { success: true, data }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        }
    }
}

async function fetchStats (tapUrl:string, pw:string):Promise<Partial<TapStats>> {
    const count = await tapFetch<{
        repo_count:number
    }>(tapUrl + '/stats/repo-count', pw)
    const records = await tapFetch<{
        record_count:number
    }>(tapUrl + '/stats/record-count', pw)
    const obb = await tapFetch<{
        outbox_buffer:number
    }>(tapUrl + '/stats/outbox-buffer', pw)
    const rsb = await tapFetch<{
        resync_buffer:number
    }>(tapUrl + '/stats/resync-buffer', pw)
    const cursors = await tapFetch<{
        firehose:number,
        list_repos:string
    }>(tapUrl + '/stats/cursors', pw)

    const stats = {
        repoCount: count.data?.repo_count,
        recordCount: records.data?.record_count,
        outboxBuffer: obb.data?.outbox_buffer,
        resyncBuffer: rsb.data?.resync_buffer,
        cursors: {
            firehose: cursors.data?.firehose ?? 0,
            listRepos: cursors.data?.list_repos ?? ''
        }
    }

    return stats
}
