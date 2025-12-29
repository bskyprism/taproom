import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import Debug from '@substrate-system/debug'
import { State, type AppState } from '../state.js'
import './following.css'
const debug = Debug('taproom:following')

export const FollowingRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    const { error, data, pending } = state.trackedRepos.value
    const resolvedDids = state.resolvedRepos

    const handleToggle = useCallback(async (ev:Event) => {
        const details = ev.target as HTMLDetailsElement
        if (!details.open) return  // Only fetch when opening

        const did = details.dataset.did
        if (!did) return

        try {
            await State.resolveDid(state, did)
        } catch (err) {
            debug('error resolving did', err)
        }
    }, [state])

    return html`<div class="route following">
        <h2>Following</h2>
        ${pending &&
            html`<span>...</span>`
        }

        ${error &&
            html`<div class="error-banner">${error.message}</div>`
        }

        ${data &&
            html`<ul>
                ${data.map(r => {
                    const doc = resolvedDids.value[r.did]
                    return html`
                        <li>
                            <details data-did=${r.did} onToggle=${handleToggle}>
                                <summary>${r.did}</summary>
                                <div class="details-inner">
                                    ${doc ? html`
                                        <dl>
                                            <dt>ID</dt>
                                            <dd>${doc.id}</dd>
                                            ${doc.alsoKnownAs?.map(aka => html`
                                                <dt>Handle</dt>
                                                <dd>${aka.replace('at://', '@')}</dd>
                                            `)}
                                            ${doc.service?.map(svc => html`
                                                <dt>${svc.type}</dt>
                                                <dd>${svc.serviceEndpoint}</dd>
                                            `)}
                                        </dl>
                                    ` : html`
                                        <p class="loading">Loading...</p>
                                    `}
                                </div>
                            </details>
                        </li>
                    `
                })}
            </ul>`
        }
    </div>`
}
