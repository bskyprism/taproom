import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

/**
 * API Routes
 */
app.get('/api/hello', (c) => c.json({ message: 'Hello from Hono!' }))

/**
 * Serve Static Assets (The Preact build)
 * This works in conjunction with the 'assets' setting in wrangler
 */
app.get('/*', serveStatic({ root: './' }))

export default app
