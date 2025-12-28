import { type Signal, signal, computed, batch } from '@preact/signals'
import Route from 'route-event'
import { type Tap } from '@atproto/tap'
import ky, { type HTTPError } from 'ky'
import Debug from '@substrate-system/debug'
import type { TapHealth, TapStats } from '../shared.js'
import { parseHttpError } from './util.js'
const debug = Debug('taproom:state')

export type RequestFor<T, E = Error> = 'resolving'|null|E|T
export type InfoType = Awaited<ReturnType<Tap['getRepoInfo']>>

export interface AuthStatus {
    registered:boolean;
    authenticated:boolean;
}

export const AUTH_ROUTES:string[] = ([
    '/repos',
    import.meta.env.VITE_ALLOW_ANON_READS ? null : ['/', '/lookup']
]).filter(Boolean).flat()

debug('auth routes', AUTH_ROUTES)

export interface AppState {
    route:Signal<string>;
    _setRoute:(path:string)=>void;
    // Auth state
    auth:Signal<AuthStatus|null>;
    authLoading:Signal<boolean>;
    // Tap server state
    tapHealth:Signal<TapHealth|null>;
    tapStats:Signal<TapStats|null>;
    loading:Signal<boolean>;
    didInfo:Signal<RequestFor<Awaited<ReturnType<Tap['getRepoInfo']>>, HTTPError>>;
    error:Signal<string|null>;
    // Derived state
    isConnected:Signal<boolean>;
    isAuthenticated:Signal<boolean>;
}

export function State ():AppState {
    const onRoute = Route()

    const state:AppState = {
        _setRoute: onRoute.setRoute.bind(onRoute),
        route: signal<string>(location.pathname + location.search),
        // Auth state
        auth: signal<AuthStatus|null>(null),
        authLoading: signal<boolean>(false),
        // Tap server state
        tapHealth: signal<TapHealth|null>(null),
        tapStats: signal<TapStats|null>(null),
        loading: signal<boolean>(false),
        didInfo: signal(null),
        error: signal<string|null>(null),
        // Derived state
        isConnected: computed(() => {
            return state.tapHealth.value?.status === 'ok'
        }),
        isAuthenticated: computed(() => {
            return state.auth.value?.authenticated ?? false
        }),
    }

    State.init(state)

    onRoute((path:string, data) => {
        if (AUTH_ROUTES.includes(path) && !state.isAuthenticated.value) {
            return state._setRoute('/login')
        }

        state.route.value = path
        if (data.popstate) {
            return window.scrollTo(data.scrollX, data.scrollY)
        }
        window.scrollTo(0, 0)
    })

    return state
}

// null
// resolving
// error
// response

State.didInfo = async function (state:AppState, did:string):Promise<void> {
    const urlDid = encodeURIComponent(did.trim())
    state.didInfo.value = 'resolving'

    try {
        const info = await ky.get(`/api/tap/info/${urlDid}`)
        const infoData = await info.json<ReturnType<Tap['getRepoInfo']>>()
        state.didInfo.value = infoData
    } catch (_err) {
        const err = _err as HTTPError
        state.didInfo.value = err
    }
}

/**
 * Fetch tap server health
 */
State.FetchHealth = async function (state:AppState):Promise<void> {
    batch(() => {
        state.loading.value = true
        state.error.value = null
    })

    try {
        const data = await ky.get('/api/tap/health').json<TapHealth>()
        state.tapHealth.value = data
        debug('fetched health', data)
    } catch (err) {
        const message = await parseHttpError(err)
        debug('health failure', err)
        batch(() => {
            state.error.value = message
            state.tapHealth.value = { status: 'error', message }
        })
    } finally {
        state.loading.value = false
    }
}

/**
 * Fetch tap server stats
 */
State.FetchStats = async function (state: AppState): Promise<void> {
    batch(() => {
        state.loading.value = true
        state.error.value = null
    })

    try {
        const res = await ky.get('/api/tap/stats').json<TapStats>()
        state.tapStats.value = res
    } catch (err) {
        state.error.value = await parseHttpError(err)
    } finally {
        state.loading.value = false
    }
}

State.init = function (state:AppState):void {
    State.FetchHealth(state)
    State.FetchStats(state)
    State.FetchAuthStatus(state)
}

/**
 * Fetch auth status
 */
State.FetchAuthStatus = async function (state:AppState):Promise<void> {
    state.authLoading.value = true
    try {
        const data = await ky.get('/api/auth/status').json<AuthStatus>()
        state.auth.value = data
        debug('fetched auth status', data)
    } catch (err) {
        debug('auth status error', err)
        state.auth.value = { registered: false, authenticated: false }
    } finally {
        state.authLoading.value = false
    }
}

/**
 * Logout
 */
State.Logout = async function (state:AppState):Promise<void> {
    try {
        await ky.post('/api/auth/logout')
        state.auth.value = { registered: true, authenticated: false }
    } catch (err) {
        debug('logout error', err)
    }
}

/**
 * Refresh all tap data
 */
State.RefreshAll = async function (state: AppState): Promise<void> {
    await Promise.all([
        State.FetchHealth(state),
        State.FetchStats(state),
    ])
}
