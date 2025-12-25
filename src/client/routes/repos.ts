import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import { useSignal } from '@preact/signals'
import type { AppState } from '../state.js'
import { State } from '../state.js'

export const ReposRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    const newDid = useSignal('')
    const addingRepo = useSignal(false)

    const repos = state.repos.value
    const loading = state.loading.value
    const error = state.error.value

    async function handleAddRepo (ev: Event) {
        ev.preventDefault()
        if (!newDid.value.trim()) return

        addingRepo.value = true
        const success = await State.AddRepo(state, newDid.value.trim())
        if (success) {
            newDid.value = ''
        }
        addingRepo.value = false
    }

    async function handleRemoveRepo (did: string) {
        if (!confirm(`Remove ${did} from tracking?`)) return
        await State.RemoveRepo(state, did)
    }

    async function handleRefresh () {
        await State.FetchRepos(state)
    }

    return html`<div class="route repos-route">
        <header class="page-header">
            <h1>Tracked Repos</h1>
            <button
                class="btn btn-secondary"
                onClick=${handleRefresh}
                disabled=${loading}
            >
                ${loading ? 'Refreshing...' : 'Refresh'}
            </button>
        </header>

        ${error && html`<div class="error-banner">${error}</div>`}

        <form class="add-repo-form" onSubmit=${handleAddRepo}>
            <input
                name="did"
                id="did"
                type="text"
                class="input"
                placeholder="did:plc:... or did:web:..."
                value=${newDid.value}
                onInput=${(e: Event) => { newDid.value = (e.target as HTMLInputElement).value }}
                disabled=${addingRepo.value}
            />
            <button
                type="submit"
                class="btn btn-primary"
                disabled=${addingRepo.value || !newDid.value.trim()}
            >
                ${addingRepo.value ? 'Adding...' : 'Add Repo'}
            </button>
        </form>

        <div class="repos-list">
            ${repos.length === 0 && !loading && html`
                <div class="empty-state">
                    <p>No repos being tracked yet.</p>
                    <p>Add a DID above to start tracking.</p>
                </div>
            `}

            ${repos.map(repo => html`
                <div class="repo-card" key=${repo.did}>
                    <div class="repo-info">
                        <div class="repo-did">${repo.did}</div>
                        ${repo.handle && html`<div class="repo-handle">@${repo.handle}</div>`}
                        <div class="repo-meta">
                            ${repo.active
                                ? html`<span class="badge badge-active">Active</span>`
                                : html`<span class="badge badge-inactive">Inactive</span>`
                            }
                            ${repo.recordCount !== undefined && html`
                                <span class="meta-item">${repo.recordCount} records</span>
                            `}
                            ${repo.lastSeen && html`
                                <span class="meta-item">Last seen: ${formatDate(repo.lastSeen)}</span>
                            `}
                        </div>
                    </div>
                    <div class="repo-actions">
                        <button
                            class="btn btn-danger btn-sm"
                            onClick=${() => handleRemoveRepo(repo.did)}
                            disabled=${loading}
                        >
                            Remove
                        </button>
                    </div>
                </div>
            `)}
        </div>
    </div>`
}

function formatDate (dateStr: string): string {
    try {
        const date = new Date(dateStr)
        return date.toLocaleString()
    } catch {
        return dateStr
    }
}
