import { Signal, signal, computed, batch } from '@preact/signals'
import Route from 'route-event'
import ky from 'ky'
import Debug from '@substrate-system/debug'
import type {
    TapHealth,
    TapRepoInfo,
    TapStats,
    ApiResponse
} from '../shared.js'
const debug = Debug('taproom:state')

export interface AppState {
    route:Signal<string>
    _setRoute:(path:string)=>void
    // Tap server state
    tapHealth:Signal<TapHealth|null>
    tapStats:Signal<TapStats|null>
    repos:Signal<TapRepoInfo[]>
    loading:Signal<boolean>
    error:Signal<string|null>
    // Derived state
    isConnected:Signal<boolean>
}

export function State ():AppState {
    const onRoute = Route()

    const state:AppState = {
        _setRoute: onRoute.setRoute.bind(onRoute),
        route: signal<string>(location.pathname + location.search),
        // Tap server state
        tapHealth: signal<TapHealth | null>(null),
        tapStats: signal<TapStats | null>(null),
        repos: signal<TapRepoInfo[]>([]),
        loading: signal<boolean>(false),
        error: signal<string | null>(null),
        // Derived state
        isConnected: computed(() => {
            return state.tapHealth.value?.status === 'ok'
        }),
    }

    State.init(state)

    onRoute((path: string, data) => {
        state.route.value = path
        if (data.popstate) {
            return window.scrollTo(data.scrollX, data.scrollY)
        }
        window.scrollTo(0, 0)
    })

    return state
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
        const res = await ky.get('/api/tap/health').json<ApiResponse<TapHealth>>()
        if (res.success && res.data) {
            state.tapHealth.value = res.data
        } else {
            batch(() => {
                state.error.value = res.error || 'Failed to fetch health'
                state.tapHealth.value = { status: 'error', message: res.error }
            })
        }
    } catch (err) {
        batch(() => {
            state.error.value = err instanceof Error ? err.message : 'Unknown error'
            state.tapHealth.value = { status: 'error', message: state.error.value }
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
        const res = await ky.get('/api/tap/stats').json<ApiResponse<TapStats>>()
        if (res.success && res.data) {
            state.tapStats.value = res.data
        } else {
            state.error.value = res.error || 'Failed to fetch stats'
        }
    } catch (err) {
        state.error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
        state.loading.value = false
    }
}

/**
 * Fetch tracked repos
 */
State.FetchRepos = async function (state:AppState):Promise<void> {
    batch(() => {
        state.loading.value = true
        state.error.value = null
    })

    debug('state.error', state.error.value)
    try {
        const res = await ky.get('/api/tap/repos')
            .json<ApiResponse<TapRepoInfo[]>>()
        if (res.data) {
            state.repos.value = res.data
        } else {
            debug('res.error', res.error)
            state.error.value = res.error || 'Failed to fetch repos'
        }
    } catch (err) {
        state.error.value = err instanceof Error ? err.message : 'Unknown error'
        debug('err message', (err as Error).message)
    } finally {
        state.loading.value = false
        debug('state.error', state.error.value)
    }
}

State.init = function (state:AppState):void {
    State.FetchRepos(state)
    State.FetchHealth(state)
    State.FetchStats(state)
}

/**
 * Add a repo to track
 */
State.AddRepo = async function (state: AppState, did: string): Promise<boolean> {
    batch(() => {
        state.loading.value = true
        state.error.value = null
    })
    try {
        const res = await ky.post('/api/tap/repos/add', {
            json: { did }
        }).json<ApiResponse<unknown>>()

        if (res.success) {
            await State.FetchRepos(state)
            return true
        } else {
            state.error.value = res.error || 'Failed to add repo'
            return false
        }
    } catch (err) {
        state.error.value = err instanceof Error ? err.message : 'Unknown error'
        return false
    } finally {
        state.loading.value = false
    }
}

/**
 * Remove a repo from tracking
 */
State.RemoveRepo = async function (state: AppState, did: string): Promise<boolean> {
    batch(() => {
        state.loading.value = true
        state.error.value = null
    })
    try {
        const res = await ky.post('/api/tap/repos/remove', {
            json: { did }
        }).json<ApiResponse<unknown>>()

        if (res.success) {
            await State.FetchRepos(state)
            return true
        } else {
            state.error.value = res.error || 'Failed to remove repo'
            return false
        }
    } catch (err) {
        state.error.value = err instanceof Error ? err.message : 'Unknown error'
        return false
    } finally {
        state.loading.value = false
    }
}

/**
 * Refresh all tap data
 */
State.RefreshAll = async function (state: AppState): Promise<void> {
    await Promise.all([
        State.FetchHealth(state),
        State.FetchStats(state),
        State.FetchRepos(state),
    ])
}
