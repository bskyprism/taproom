import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import type { FunctionComponent } from 'preact'
import Debug from '@substrate-system/debug'
import { State, type AppState } from '../state.js'
import { CloseX } from '../components/close-x.js'
import { Button } from '../components/button.js'
import './following.css'
const debug = Debug('taproom:following')

export const FollowingRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    const { error, data, pending } = state.trackedRepos.value
    const resolvedDids = state.resolvedRepos
    const confirmingRemove = useSignal<string | null>(null)

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

    const handleRemoveClick = useCallback((did: string) => {
        confirmingRemove.value = did
    }, [])

    const handleCancelRemove = useCallback((ev:MouseEvent) => {
        ev.preventDefault()
        confirmingRemove.value = null
    }, [])

    const handleConfirmRemove = useCallback(async (did:string) => {
        try {
            await State.removeRepo(state, did)
            confirmingRemove.value = null
        } catch (err) {
            debug('error removing repo', err)
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
                    const isConfirming = confirmingRemove.value === r.did
                    return html`
                        <li>
                            <div>
                                <details data-did=${r.did} onToggle=${handleToggle}>
                                    <summary>
                                        <span class="did-text">${r.did}</span>
                                    </summary>
                                    <div class="details-inner">
                                        ${doc ?
                                            html`<pre>
                                                ${JSON.stringify(doc, null, 2)}
                                            </pre>` :
                                            html`
                                                <p class="loading">Loading...</p>
                                            `
                                        }
                                    </div>
                                </details>

                                ${isConfirming ? html`
                                    <span class="confirm-remove">
                                        Stop tracking?
                                        <${Button}
                                            class="confirm-btn"
                                            onClick=${(e:MouseEvent) => {
                                                e.preventDefault()
                                                handleConfirmRemove(r.did)
                                            }}
                                        >Yes<//>
                                        <${Button}
                                            class="cancel-btn"
                                            onClick=${handleCancelRemove}
                                        >No<//>
                                    </span>
                                ` : html`
                                    <button
                                        class="remove-btn"
                                        onClick=${(e: Event) => {
                                            e.preventDefault()
                                            handleRemoveClick(r.did)
                                        }}
                                        title="Remove"
                                    ><${CloseX} /></button>
                                `}
                            </div>
                        </li>
                    `
                })}
            </ul>`
        }
    </div>`
}

// function DidDoc ({ did }) {
//     return html`<pre>
//         ${JSON.stringify(did, null, 2)}
//     </pre>`
// }

// <dl>
//     <dt>ID</dt>
//     <dd>${doc.id}</dd>
//     ${doc.alsoKnownAs?.map(aka => html`
//         <dt>Handle</dt>
//         <dd>${aka.replace('at://', '@')}</dd>
//     `)}
//     ${doc.service?.map(svc => html`
//         <dt>${svc.type}</dt>
//         <dd>${svc.serviceEndpoint}</dd>
//     `)}
// </dl>
