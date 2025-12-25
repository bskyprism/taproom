import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import Debug from '@substrate-system/debug'
import type { AppState } from '../state.js'
const debug = Debug('taproom:view')
// import { Button } from '../components/button.js'
// import { numberToString } from '../util.js'
// import { State } from '../state.js'

export const ReposRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    debug('repos route', state)
    return html`<div class="route repos">
        <h2>repos</h2>
    </div>`
}
