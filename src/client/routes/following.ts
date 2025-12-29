import { html } from 'htm/preact'
import type { FunctionComponent } from 'preact'
import Debug from '@substrate-system/debug'
import type { AppState } from '../state.js'
import './repos.css'
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
                ${
                    data.map(r => {
                        return html`<li>${r.did}</li>`
                    })
                }
            </ul>`
        }
    </div>`
}

// function expand<T, E> (input:Signal<RequestFor<T, E>>) {

// }
