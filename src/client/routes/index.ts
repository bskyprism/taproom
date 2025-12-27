import Router from '@substrate-system/routes'
import { HomeRoute } from './home.js'
import { ReposRoute } from './repos.js'
import { LookupRoute } from './lookup.js'
import { LoginRoute } from './login.js'

export default function _Router () {
    const router = new Router()

    router.addRoute('/', () => {
        return HomeRoute
    })

    router.addRoute('/repos', () => {
        return ReposRoute
    })

    router.addRoute('/lookup', () => {
        return LookupRoute
    })

    router.addRoute('/login', () => {
        return LoginRoute
    })

    return router
}
