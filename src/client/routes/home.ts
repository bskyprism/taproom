import { html } from 'htm/preact'
import type { FunctionComponent } from 'preact'
import { Button } from '../components/button.js'
import { ErrorBanner } from '../components/error-banner.js'
import type { AppState } from '../state.js'
import { NBSP } from '../constants.js'
import { numberToString } from '../util.js'
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
            <h2>Dashboard</h2>
            ${state.tapHealth.value?.url}
            <${Button}
                class="btn btn-secondary"
                onClick=${handleRefresh}
                disabled=${loading}
            >
                Refresh
            <//>
        </header>

        <${ErrorBanner} message=${error} />

        <div class="stats-grid">
            <div class="stat-card">
                <h3>Server Status</h3>
                <div class="stat-value ${health?.status === 'ok' ?
                    'status-ok' :
                    'status-error'}"
                >
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
                <h3>Buffer Sizes</h3>
                <dl>
                    <div>
                        <dt>Outbox</dt>
                        <dd>${stats?.outboxBuffer ?? '—'}</dd>
                    </div>
                    <div>
                        <dt>Resync</dt>
                        <dd>${stats?.resyncBuffer ?? '—'}</dd>
                    </div>
                </dl>
            </div>

            <div class="stat-card">
                <h3>Cursors</h3>
                <dl>
                    <div>
                        <dt>firehose</dt>
                        <dd>
                            <span>
                                ${new Intl.NumberFormat('en-US').format(
                                    state.tapStats.value?.cursors.firehose || 0
                                )}
                            </span>
                            <span>
                                (${numberToString(state.tapStats.value?.cursors.firehose || 0)})
                            </span>
                        </dd>
                    </div>
                    <div>
                        <dt>list_repos</dt>
                        <dd>${numberToString(
                            parseInt(state.tapStats.value?.cursors.listRepos || '')
                        )}</dd>
                    </div>
                </dl>
            </div>
        </div>

        <div class="explanation">
            <p>This is a GUI for${NBSP}
            <a
                href="https://github.com/bluesky-social/indigo/blob/main/cmd/tap/README.md"
            >
                Tap
            </a>, a sync server from Bluesky.</p>
        </div>

    </div>`
}
