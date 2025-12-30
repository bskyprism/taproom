import { html } from 'htm/preact'
import { useMemo } from 'preact/hooks'
import { type FunctionComponent, render } from 'preact'
import { State } from './state.js'
import { COPYRIGHT, NBSP } from './constants.js'
import { Nav } from './components/nav.js'
import { Auth } from './components/auth.js'
import Router from './routes/index.js'
import './style.css'

const router = Router()
const state = State()

if (import.meta.env.DEV || import.meta.env.MODE === 'staging') {
    // @ts-expect-error DEV env
    window.state = state
    localStorage.setItem('DEBUG', 'taproom,taproom:*')
} else {
    localStorage.removeItem('DEBUG')
}

export const Taproom:FunctionComponent = function () {
    const match = useMemo(() => {
        return router.match(state.route.value)
    }, [state.route.value])

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
            <div class="header-status">
                <span class="connection-status ${isConnected ? 'connected' : 'disconnected'}">
                    ${isConnected ? 'Connected' : 'Disconnected'}
                </span>
                <${Auth} state=${state} />
            </div>
        </div>

        <${Nav} state=${state} />

        <main class="main-content">
            <${ChildNode} state=${state} />
        </main>

        <footer>
            <p>
                <a href="/colophon">Colophon</a>
            </p>

            <p>
                <span>${COPYRIGHT}</span> 2025${NBSP}
                <a target="_blank" href="https://nichoth.com/">
                    <code>nichoth</code>
                </a>
            </p>

            <p>
                <a target="_blank" href="https://github.com/bskyprism/taproom">
                    source code
                </a>
            </p>
        </footer>
    </div>`
}

render(html`<${Taproom} />`, document.getElementById('root')!)
