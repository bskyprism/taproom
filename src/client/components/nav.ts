import { type FunctionComponent } from 'preact'
import { html } from 'htm/preact'
import { type AppState } from '../state.js'
import './nav.css'

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
    const isActive = href === state.route.value

    return html`<a
        href=${href}
        class="nav-link ${isActive ? 'active' : ''}"
    >${children}</a>`
}

export const Nav:FunctionComponent<{ state:AppState }> = function Nav ({
    state
}) {
    return html`<nav class="sidebar">
        <ul class="nav-list">
            <li>
                <${NavLink} href="/" state=${state}>Dashboard<//>
            </li>
            <li>
                <${NavLink} href="/repos" state=${state}>Repos<//>
            </li>
            <li>
                <${NavLink} href="/lookup" state=${state}>Lookup<//>
            </li>
        </ul>
    </nav>`
}
