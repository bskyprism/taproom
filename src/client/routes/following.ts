import { html } from 'htm/preact'
import type { FunctionComponent } from 'preact'
import Debug from '@substrate-system/debug'
import type { AppState } from '../state.js'
import './following.css'
const debug = Debug('taproom:following')

export const FollowingRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    debug('following route', state.trackedRepos.value)
    const { error, data, pending } = state.trackedRepos.value

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
                ${data.map(r => html`
                    <li>
                        <details>
                            <summary>${r.did}</summary>
                            <div class="details-inner">
                                <dl>
                                    <dt>Handle</dt>
                                    <dd>@placeholder.bsky.social</dd>
                                    <dt>PDS</dt>
                                    <dd>https://bsky.network</dd>
                                    <dt>Created</dt>
                                    <dd>2024-01-15</dd>
                                </dl>
                            </div>
                        </details>
                    </li>
                `)}
            </ul>`
        }
    </div>`
}

// function expand<T, E> (input:Signal<RequestFor<T, E>>) {

// }
