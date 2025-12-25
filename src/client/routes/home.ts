import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import type { AppState } from '../state.js'
import { State } from '../state.js'

export const HomeRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    const health = state.tapHealth.value
    const stats = state.tapStats.value
    const loading = state.loading.value
    const error = state.error.value

    async function handleRefresh (ev: Event) {
        ev.preventDefault()
        await State.RefreshAll(state)
    }

    return html`<div class="route home-route">
        <header class="page-header">
            <h1>Dashboard</h1>
            <button
                class="btn btn-secondary"
                onClick=${handleRefresh}
                disabled=${loading}
            >
                ${loading ? 'Refreshing...' : 'Refresh'}
            </button>
        </header>

        ${error && html`<div class="error-banner">${error}</div>`}

        <div class="stats-grid">
            <div class="stat-card">
                <h3>Server Status</h3>
                <div class="stat-value ${health?.status === 'ok' ? 'status-ok' : 'status-error'}">
                    ${health?.status === 'ok' ? 'Connected' : 'Disconnected'}
                </div>
                ${health?.message && html`<div class="stat-detail">
                    ${health.message}
                </div>`}
            </div>

            <div class="stat-card">
                <h3>Tracked Repos</h3>
                <div class="stat-value">${stats?.repoCount ?? '—'}</div>
            </div>

            <div class="stat-card">
                <h3>Total Records</h3>
                <div class="stat-value">${stats?.recordCount ?? '—'}</div>
            </div>

            <div class="stat-card">
                <h3>Buffer Size</h3>
                <div class="stat-value">${stats?.bufferSize ?? '—'}</div>
            </div>
        </div>

        ${stats?.uptime !== undefined && html`
            <div class="info-section">
                <h3>Uptime</h3>
                <p>${formatUptime(stats.uptime)}</p>
            </div>
        `}
    </div>`
}

function formatUptime (seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    const parts: string[] = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (parts.length === 0) parts.push(`${seconds}s`)

    return parts.join(' ')
}
