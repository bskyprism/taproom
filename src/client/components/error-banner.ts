import { html } from 'htm/preact'
import { type FunctionComponent } from 'preact'

interface ErrorBannerProps {
    message: string | null;
}

export const ErrorBanner: FunctionComponent<ErrorBannerProps> = function ({
    message
}) {
    if (!message) return null

    return html`<div class="error-banner">${message}</div>`
}
