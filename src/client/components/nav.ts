import { type FunctionComponent } from 'preact'
import { html } from 'htm/preact'
import { type AppState, AUTH_ROUTES } from '../state.js'
import './nav.css'
import { useComputed } from '@preact/signals'

export interface NavLinkProps {
    href:string
    state:AppState
    children:preact.ComponentChildren
}

export const NavLink:FunctionComponent<NavLinkProps> = function ({
    href,
    state,
    children
}) {
    const route = state.route.value
    const isActive = (href === '/' ?
        route === '/' :
        route === href || route.startsWith(href + '/'))

    return html`<a
        href=${href}
        class="nav-link ${isActive ? 'active' : ''}"
    >${children}</a>`
}

const NAV_ITEMS = [
    { href: '/', label: 'Dashboard' },
    { href: '/repos', label: 'Repos' },
    { href: '/lookup', label: 'Lookup' },
    { href: '/settings', label: 'Settings' },
]

export const Nav:FunctionComponent<{ state:AppState }> = function Nav ({
    state
}) {
    const isLoggedIn = useComputed<boolean>(() => {
        return !!(state.auth.value?.authenticated)
    })

    return html`<nav class="sidebar">
        <ul class="nav-list">
            ${NAV_ITEMS.map(item => {
                // Hide auth-required routes when not logged in
                if (!isLoggedIn.value && AUTH_ROUTES.includes(item.href)) {
                    return null
                }
                return html`<li key=${item.href}>
                    <${NavLink} href=${item.href} state=${state}>${item.label}<//>
                </li>`
            })}
            ${!isLoggedIn.value ?
                html`<li>
                    <${NavLink} href="/login" state=${state}>Login<//>
                </li>` :
                null
            }
        </ul>
    </nav>`
}
