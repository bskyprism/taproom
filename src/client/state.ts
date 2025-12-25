import { Signal, signal, computed, batch } from '@preact/signals'
import Route from 'route-event'
import ky from 'ky'
import Debug from '@substrate-system/debug'
import type { TapHealth, TapStats } from '../shared.js'
const debug = Debug('taproom:state')

export interface AppState {
    route:Signal<string>
    _setRoute:(path:string)=>void
    // Tap server state
    tapHealth:Signal<TapHealth|null>
    tapStats:Signal<TapStats|null>
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
        const data = await ky.get('/api/tap/health').json<TapHealth>()
        state.tapHealth.value = data
        debug('fetched health', data)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
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
        debug('resssssssss', res)
        state.tapStats.value = res
    } catch (err) {
        state.error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
        state.loading.value = false
    }
}

State.init = function (state:AppState):void {
    State.FetchHealth(state)
    State.FetchStats(state)
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
