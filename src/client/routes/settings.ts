import { html } from 'htm/preact'
import { useCallback, useEffect } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import { batch, useSignal } from '@preact/signals'
import Debug from '@substrate-system/debug'
import { Button } from '../components/button.js'
import { State } from '../state.js'
import type { AppState } from '../state.js'
import './settings.css'
const debug = Debug('taproom:settings')

export const SettingsRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    const nsidInput = useSignal('')
    const submitting = useSignal(false)
    const error = useSignal<string|null>(null)
    const success = useSignal<string|null>(null)
    const deploying = useSignal(false)

    // Fetch current signal collection on mount
    useEffect(() => {
        State.FetchSignalCollection(state)
    }, [])

    const handleSubmit = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        if (!nsidInput.value.trim()) return

        batch(() => {
            submitting.value = true
            error.value = null
            success.value = null
        })

        try {
            const result = await State.UpdateSignalCollection(
                state,
                nsidInput.value.trim()
            )

            if (!result.success) {
                error.value = result.error || 'Failed to update'
                submitting.value = false
                return
            }

            // Start polling for TAP server health
            batch(() => {
                deploying.value = true
                success.value = 'Secret updated! Waiting for TAP server restart...'
                submitting.value = false
            })

            await pollTapHealth(state, 60000) // 60 second timeout

            batch(() => {
                deploying.value = false
                success.value = 'Signal collection updated successfully!'
                nsidInput.value = ''
            })
        } catch (err) {
            debug('error updating signal collection', err)
            batch(() => {
                error.value = err instanceof Error ? err.message : 'Update failed'
                deploying.value = false
                submitting.value = false
            })
        }
    }, [])

    const currentNsid = state.signalCollection.value?.nsid

    return html`<div class="route settings">
        <h2>Settings</h2>

        <section class="signal-collection">
            <header>
                <h3>Signal Collection</h3>
                <p>Configure which NSID to use for signal collection.</p>
            </header>

            ${currentNsid && html`
                <div class="current-value">
                    <dt>Current NSID</dt>
                    <dd><code>${currentNsid}</code></dd>
                </div>
            `}

            <div class="section-grid">
                <form onSubmit=${handleSubmit}>
                    <div class="input">
                        <label for="nsid">NSID</label>
                        <input
                            type="text"
                            placeholder="app.bsky.feed.post"
                            name="nsid"
                            id="nsid"
                            value=${nsidInput.value}
                            onInput=${(e:Event) => {
                                nsidInput.value = (e.target as HTMLInputElement).value
                            }}
                            disabled=${submitting.value || deploying.value}
                        />
                        <small class="hint">
                            Format: authority.name.record (e.g., app.bsky.feed.post)
                        </small>
                    </div>
                    <div class="controls">
                        <${Button}
                            type="submit"
                            isSpinning=${submitting}
                            disabled=${!nsidInput.value.trim() || deploying.value}
                        >
                            ${deploying.value ? 'Deploying...' : 'Update'}
                        <//>
                    </div>
                </form>

                <div class="response">
                    ${error.value && html`<p class="error">${error.value}</p>`}
                    ${success.value && html`<p class="success">${success.value}</p>`}
                    ${!error.value && !success.value && html`
                        <p class="placeholder">-</p>
                    `}
                </div>
            </div>
        </section>
    </div>`
}

/**
 * Poll TAP server health until it comes back online.
 */
async function pollTapHealth (state:AppState, timeout:number):Promise<void> {
    const startTime = Date.now()
    const pollInterval = 3000 // 3 seconds

    // Wait a bit before first poll (give server time to restart)
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    while (Date.now() - startTime < timeout) {
        await State.FetchHealth(state)

        if (state.tapHealth.value?.status === 'ok') {
            return
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error('Timeout waiting for TAP server to restart')
}
