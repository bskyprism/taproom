import { html } from 'htm/preact'
import type { FunctionComponent } from 'preact'
import Debug from '@substrate-system/debug'
import './colophon.css'
import { EM_DASH, NBSP } from '../constants.js'
const debug = Debug('taproom:repos')

export const ColophonRoute:FunctionComponent = function (props) {
    debug('colophon route', props)
    return html`<div class="route colophon">
        <h2>The Colophon</h2>

        <p>
            This is a${NBSP}
            <a href="https://developer.mozilla.org/en-US/docs/Glossary/SPA">
                single-page app
            </a>. It uses <a href="https://preactjs.com/">Preact</a> as the
            frontend library.
        </p>

        <p>
            The backend is mostly <a href="https://www.cloudflare.com/">
                Cloudflare
            </a> services ${EM_DASH}${NBSP}
            <a href="https://developers.cloudflare.com/kv/">KV</a> for
            the authentication flow with${NBSP}
            <a href="https://developers.google.com/identity/passkeys">
                passkeys
            </a>, and a <a href="https://developers.cloudflare.com/d1/">
                D1 database
            </a> for longer-term session storage.
        </p>

        <p>
            This app connects to a remote${NBSP}
            <a href="https://docs.bsky.app/blog/introducing-tap">Tap</a>${NBSP}
            instance, configure by the <code>TAP_SERVER_URL</code> environment
            variable.
        </p>

        <p>
            This server knows the <code>TAP_ADMIN_PASSWORD</code>${NBSP}
            set on the Tap server, and this server does access control
            with a combination of a server password configured as an
            environment variable and${NBSP}
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API">
                passkeys/biometric auth
            </a>.
        </p>
    </div>`
}
