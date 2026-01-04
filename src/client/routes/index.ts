import Router from '@substrate-system/routes'
import { HomeRoute } from './home.js'
import { ReposRoute } from './repos.js'
import { LookupRoute } from './lookup.js'
import { LoginRoute } from './login.js'
import { ColophonRoute } from './colophon.js'
import { SettingsRoute } from './settings.js'
import { type AppState, State } from '../state.js'
import { FollowingRoute } from './following.js'

export default function _Router () {
    const router = new Router()

    router.addRoute('/', () => HomeRoute)
    router.addRoute('/colophon', () => ColophonRoute)
    router.addRoute('/repos', (_match, state:AppState) => {
        State.FetchRepos(state)
        return ReposRoute
    })
    router.addRoute('/repos/following', (_match, state:AppState) => {
        State.FetchRepos(state)
        return FollowingRoute
    })
    router.addRoute('/lookup', () => LookupRoute)
    router.addRoute('/login', () => LoginRoute)
    router.addRoute('/settings', (_match, state:AppState) => {
        State.FetchSignalCollection(state)
        return SettingsRoute
    })

    return router
}
