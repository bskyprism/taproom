import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import { State } from '../state.js'
import { Button } from './button.js'
import type { AppState } from '../state.js'
import './auth.css'

export const Auth:FunctionComponent<{ state:AppState }> = function ({ state }) {
    const handleLogout = useCallback(async () => {
        await State.Logout(state)
    }, [])

    const auth = state.auth.value

    // Loading state
    if (state.authLoading.value || !auth) {
        return html`<div class="auth auth--loading">
            <span class="auth-loading">...</span>
        </div>`
    }

    // Authenticated - show logout
    if (auth.authenticated) {
        return html`<div class="auth auth--authenticated">
            <${Button} class="auth-logout" onClick=${handleLogout}>
                Logout
            <//>
        </div>`
    }

    // Not authenticated - show link to login page
    return html`<div class="auth auth--login">
        <a href="/login" class="auth-login-link">Login</a>
    </div>`
}
