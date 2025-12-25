import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Tap, SimpleIndexer } from '@atproto/tap'
import type {
    TapHealth,
    TapRepoInfo,
    TapStats,
    AddRepoRequest,
    RemoveRepoRequest,
    ApiResponse
} from '../shared.js'

type Bindings = {
    ASSETS: Fetcher
    TAP_SERVER_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

/**
 * Health check for the worker itself
 */
app.get('/api/health', (c) => {
    return c.json({ status: 'ok', service: 'taproom' })
})

app.get('/health', (c) => {
    return c.json({ status: 'ok' })
})

/**
 * Get tap server health
 */
app.get('/api/tap/health', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const result = await tapFetch<TapHealth>(tapUrl, '/health')
    return c.json(result)
})

/**
 * Get tap server stats
 */
app.get('/api/tap/stats', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const result = await tapFetch<TapStats>(tapUrl, '/stats')
    return c.json(result)
})

/**
 * Get detailed stats
 */
app.get('/api/tap/stats/:type', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const type = c.req.param('type')
    const result = await tapFetch<unknown>(tapUrl, `/stats/${type}`)
    return c.json(result)
})

// just using this production URL temporarily
const TAP_URL = 'https://drerings.fly.dev/'

/**
 * List tracked repos
 * @TODO error here
 */
app.get('/api/tap/repos', async (c) => {
    const tapUrl = TAP_URL
    console.log('*****', tapUrl, '********')
    const result = await tapFetch<TapRepoInfo[]>(tapUrl, '/repos')
    return c.json(result)
})

/**
 * Get info for a specific DID
 */
app.get('/api/tap/info/:did', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const did = c.req.param('did')
    const result = await tapFetch<TapRepoInfo>(tapUrl, `/info/${did}`)
    return c.json(result)
})

/**
 * Resolve a DID
 */
app.get('/api/tap/resolve/:did', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const did = c.req.param('did')
    const result = await tapFetch<unknown>(tapUrl, `/resolve/${did}`)
    return c.json(result)
})

/**
 * Add a repo to track
 */
app.post('/api/tap/repos/add', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const body = await c.req.json<AddRepoRequest>()

    const result = await tapFetch<unknown>(tapUrl, '/repos/add', {
        method: 'POST',
        body: JSON.stringify(body),
    })
    return c.json(result)
})

/**
 * Remove a repo from tracking
 */
app.post('/api/tap/repos/remove', async (c) => {
    const tapUrl = c.env.TAP_SERVER_URL
    const body = await c.req.json<RemoveRepoRequest>()

    const result = await tapFetch<unknown>(tapUrl, '/repos/remove', {
        method: 'POST',
        body: JSON.stringify(body),
    })
    return c.json(result)
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
    tapUrl:string,
    path:string,
    options?:RequestInit
): Promise<ApiResponse<T>> {
    try {
        const res = await fetch(`${tapUrl}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        })

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
