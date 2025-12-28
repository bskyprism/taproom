import Router from '@substrate-system/routes'
import { HomeRoute } from './home.js'
import { ReposRoute } from './repos.js'
import { LookupRoute } from './lookup.js'
import { LoginRoute } from './login.js'
import { ColophonRoute } from './colophon.js'
// import Debug from '@substrate-system/debug'
// const debug = Debug('taproom:view')

export default function _Router () {
    const router = new Router()

    router.addRoute('/', () => HomeRoute)
    router.addRoute('/colophon', () => ColophonRoute)
    router.addRoute('/repos', () => ReposRoute)
    router.addRoute('/lookup', () => LookupRoute)
    router.addRoute('/login', () => LoginRoute)

    return router
}
