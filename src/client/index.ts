import { html } from 'htm/preact'
import { type FunctionComponent, render } from 'preact'
import Debug from '@substrate-system/debug'
import { State } from './state.js'
import { Nav } from './components/nav.js'
import Router from './routes/index.js'
import './style.css'

const router = Router()
const state = State()
const debug = Debug('taproom')

if (import.meta.env.DEV || import.meta.env.MODE === 'staging') {
    // @ts-expect-error DEV env
    window.state = state
    localStorage.setItem('DEBUG', 'taproom,taproom:*')
} else {
    localStorage.removeItem('DEBUG')
}

export const Taproom:FunctionComponent = function () {
    debug('rendering app...')
    const match = router.match(state.route.value)

    if (!match || !match.action) {
        return html`<div class="app">
            <${Nav} state=${state} />
            <main class="main-content">
                <div class="not-found">
                    <h1>404</h1>
                    <p>Page not found</p>
                    <a href="/">Go to Dashboard</a>
                </div>
            </main>
        </div>`
    }

    const ChildNode = match.action(match, state)
    const isConnected = state.isConnected.value

    return html`<div class="app">
        <div class="sidebar-header">
            <h1 class="logo">Taproom</h1>
            <div>
                <span class="connection-status ${isConnected ? 'connected' : 'disconnected'}">
                    ${isConnected ? 'Connected' : 'Disconnected'}
                </span>
            </div>
        </div>

        <${Nav} state=${state} />
        <main class="main-content">
            <${ChildNode} state=${state} />
        </main>
    </div>`
}

render(html`<${Taproom} />`, document.getElementById('root')!)
