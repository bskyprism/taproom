import { html } from 'htm/preact'
import type { FunctionComponent } from 'preact'
import Debug from '@substrate-system/debug'
import type { AppState } from '../state.js'
import './repos.css'
const debug = Debug('taproom:following')

export const FollowingRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    debug('following route', state)

    return html`<div class="route following">
        <ul class="following">

        </ul>
    </div>`
}
