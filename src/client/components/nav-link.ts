import { type FunctionComponent } from 'preact'
import { html } from 'htm/preact'
import { type AppState } from '../state.js'

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
    const isActive = state.route.value === href ||
        (href !== '/' && state.route.value.startsWith(href))

    return html`<a
        href=${href}
        class="nav-link ${isActive ? 'active' : ''}"
    >${children}</a>`
}
