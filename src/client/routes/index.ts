import { html } from 'htm/preact'
import Router from '@substrate-system/routes'
import { HomeRoute } from './home.js'
import { ReposRoute } from './repos.js'
import type { AppState } from '../state.js'

export default function _Router () {
    const router = new Router()

    router.addRoute('/', (match, state: AppState) => {
        return () => html`<${HomeRoute} state=${state} />`
    })

    router.addRoute('/repos', (match, state: AppState) => {
        return () => html`<${ReposRoute} state=${state} />`
    })

    return router
}
