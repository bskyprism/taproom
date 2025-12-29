import { type Signal, signal, computed, batch } from '@preact/signals'
import Route from 'route-event'
import { type Tap } from '@atproto/tap'
import ky, { type HTTPError } from 'ky'
import Debug from '@substrate-system/debug'
import { type DidDocument } from '@atproto/identity'
import type { TapHealth, TapStats } from '../shared.js'
import { parseHttpError, when } from './util.js'
const debug = Debug('taproom:state')

export type RequestFor<T, E=Error> = {
    pending:boolean;
    data:null|T;
    error:null|E
}
export type InfoType = Awaited<ReturnType<Tap['getRepoInfo']>>

export interface AuthStatus {
    registered:boolean;
    authenticated:boolean;
}

export const AUTH_ROUTES:string[] = ([
    '/repos',
    import.meta.env.VITE_ALLOW_ANON_READS ? null : ['/', '/lookup']
]).filter(Boolean).flat()

/**
 * Create initial request state.
 * @returns {RequestFor<T, E>}
 */
export function RequestState<T = any, E=Error> ():RequestFor<T, E> {
    return { pending: false, data: null, error: null }
}

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
    trackedRepos:Signal<RequestFor<{ did:string }[], HTTPError>>;
    resolvedRepos:Signal<Record<string, DidDocument>>;
    repoPage:Signal<string|null>;
    error:Signal<string|null>;
    // Derived state
    isConnected:Signal<boolean>;
    isAuthenticated:Signal<boolean|null>;
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
        didInfo: signal(RequestState()),
        error: signal<string|null>(null),
        // Derived state
        isConnected: computed(() => {
            return state.tapHealth.value?.status === 'ok'
        }),
        trackedRepos: signal(RequestState()),
        resolvedRepos: signal({}),
        repoPage: signal(null),
        isAuthenticated: computed(() => {
            if (state.auth.value === null) return null
            return state.auth.value?.authenticated ?? false
        }),
    }

    State.init(state)

    onRoute((path:string, data) => {
        when(state.isAuthenticated)
            .then(() => {
                if (
                    AUTH_ROUTES.includes(path) &&
                    // need to wait for the auth to finish before checking
                    // `false` means we have made a call and you are not logged in
                    // `null` means we have not checked yet
                    state.isAuthenticated.value === false
                ) {
                    return state._setRoute('/login')
                }
            })

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
    state.didInfo.value = { ...state.didInfo.value, pending: true }

    try {
        const info = await ky.get(`/api/tap/info/${urlDid}`)
        const infoData = await info.json<ReturnType<Tap['getRepoInfo']>>()
        state.didInfo.value = { ...state.didInfo.value, data: infoData }
    } catch (_err) {
        const err = _err as HTTPError
        state.didInfo.value = { ...state.didInfo.value, error: err }
    }
}

/**
 * Follow another repo.
 *
 * @param state State
 * @param did The new DID string to follow.
 */
State.addRepo = async function (_state:AppState, did:string) {
    try {
        await ky.post('/api/tap/repos/add', {
            json: { did }
        })
    } catch (err) {
        debug('error adding a repo', err)
        throw err
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
State.FetchStats = async function (state:AppState):Promise<void> {
    batch(() => {
        state.loading.value = true
        state.error.value = null
    })

    try {
        const res = await ky.get('/api/tap/stats').json<TapStats>()
        batch(() => {
            state.tapStats.value = res
            state.loading.value = false
        })
    } catch (err) {
        const errValue = await parseHttpError(err)
        batch(() => {
            state.error.value = errValue
            state.loading.value = false
        })
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
    } catch (err) {
        debug('auth status error', err)
        state.auth.value = { registered: false, authenticated: false }
    } finally {
        state.authLoading.value = false
    }
}

/**
 * Fetch a list of all repos that you are tracking.
 *
 * @param state App state
 * @param cursor Optional cursor for pagination
 */
State.FetchRepos = async function (state:AppState, cursor?:string):Promise<void> {
    // No infinite loop
    // the route match function is called on every render
    if (
        state.trackedRepos.value.pending ||
        state.trackedRepos.value.data
    ) return
    state.trackedRepos.value = { ...state.trackedRepos.value, pending: true }

    try {
        const url = cursor ?
            `/api/tap/repos/${encodeURIComponent(cursor)}` :
            '/api/tap/repos'
        const data = await ky.get(url).json<{
            dids:{ did }[];
            cursor:string|null;
        }>()

        debug('fetched repos', data)

        batch(() => {
            state.trackedRepos.value = {
                ...state.trackedRepos.value,
                pending: false,
                data: data.dids
            }
            state.repoPage.value = data.cursor
        })
    } catch (_err) {
        const err = _err as HTTPError
        debug('error fetching repos', err)
        state.trackedRepos.value = {
            ...state.trackedRepos.value,
            pending: false,
            error: err
        }
    }
}

/**
 * Find a DID document given an ID string.
 * Caches all documents at `state.resolvedRepos`, returns the new document.
 *
 * @returns {Promise<DidDocument>} The DID document for the given ID.
 */
State.resolveDid = async function (
    state:AppState,
    did:string
):Promise<DidDocument> {
    if (state.resolvedRepos[did]) {
        return state.resolvedRepos[did]
    }

    const res = await ky.get(`/api/tap/resolve/${did}`).json<DidDocument>()

    debug('resolved this one', did)

    state.resolvedRepos.value = {
        ...state.resolvedRepos.value,
        did: res
    }

    return res
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
