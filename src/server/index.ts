import { Hono } from 'hono'

const app = new Hono()

/**
 * API Routes
 */
app.get('/api/hello', (c) => c.json({ message: 'Hello from Hono!' }))

/**
 * Serve static assets (Preact frontend)
 * This works in both dev (via Vite) and prod (via Cloudflare Assets)
 */
app.all('*', (c) => {
    return c.env.ASSETS.fetch(c.req.raw)
})

export default app
