import { html } from 'htm/preact'
import { FunctionComponent, render } from 'preact'
import {
    Primary as ButtonOutlinePrimary,
    ButtonOutline
} from '@nichoth/components/htm/button-outline'
import { createDebug } from '@substrate-system/debug'
import ky from 'ky'
import { State } from './state.js'
import Router from './routes/index.js'
import '@nichoth/components/button-outline.css'
import './style.css'

const router = Router()
const state = State()
const debug = createDebug()

if (import.meta.env.DEV || import.meta.env.MODE === 'staging') {
    // @ts-expect-error DEV env
    window.state = state
}

// example of calling our API
const json = await ky.get('/api/helloworld').json()

export const Example:FunctionComponent = function Example () {
    debug('rendering example...')
    const match = router.match(state.route.value)
    const ChildNode = match.action(match, state.route)

    if (!match) {
        return html`<div class="404">
            <h1>404</h1>
        </div>`
    }

    function plus (ev) {
        ev.preventDefault()
        State.Increase(state)
    }

    function minus (ev) {
        ev.preventDefault()
        State.Decrease(state)
    }

    return html`<div>
        <h1>example</h1>

        <h2>the API response</h2>
        <pre>
            ${JSON.stringify(json, null, 2)}
        </pre>

        <h2>routes</h2>
        <ul>
            <li><a href="/aaa">aaa</a></li>
            <li><a href="/bbb">bbb</a></li>
            <li><a href="/ccc">ccc</a></li>
        </ul>

        <h2>counter</h2>
        <div>
            <div>count: ${state.count.value}</div>
            <ul class="count-controls">
                <li>
                    <${ButtonOutlinePrimary} onClick=${plus}>
                        plus
                    </${ButtonOutline}>
                </li>
                <li>
                    <${ButtonOutline} onClick=${minus}>
                        minus
                    </${ButtonOutline}>
                </li>
            </ul>
        </div>

        <${ChildNode} />
    </div>`
}

render(html`<${Example} />`, document.getElementById('root')!)
