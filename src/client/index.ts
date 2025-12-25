import { html } from 'htm/preact'
import { FunctionComponent, render } from 'preact'
import Debug from '@substrate-system/debug'
import { State, AppState } from './state.js'
import { NavLink } from './components/nav-link.js'
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

    return html`<div class="app">
        <${Nav} state=${state} />
        <main class="main-content">
            <${ChildNode} state=${state} />
        </main>
    </div>`
}

const Nav:FunctionComponent<{ state:AppState }> = function Nav ({ state }) {
    const isConnected = state.isConnected.value

    return html`<nav class="sidebar">
        <div class="sidebar-header">
            <h2 class="logo">Taproom</h2>
            <div class="connection-status ${isConnected ? 'connected' : 'disconnected'}">
                ${isConnected ? 'Connected' : 'Disconnected'}
            </div>
        </div>

        <ul class="nav-list">
            <li><${NavLink} href="/" state=${state}>Dashboard<//></li>
            <li><${NavLink} href="/repos" state=${state}>Repos<//></li>
        </ul>
    </nav>`
}

render(html`<${Taproom} />`, document.getElementById('root')!)
