import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import { type FunctionComponent } from 'preact'
import { batch, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import ky, { HTTPError } from 'ky'
import Debug from '@substrate-system/debug'
import { Button } from '../components/button.js'
import { type AppState, type InfoType, State } from '../state.js'
import { useAsyncComputed } from '../util.js'
import './lookup.css'
const debug = Debug('taproom:lookup')

export const LookupRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    const lookupDid = useSignal('')
    const infoDid = useSignal('')
    const resolveSubmitting = useSignal(false)
    const resolveError = useSignal<string|null>(null)
    const resolvedDid = useSignal<Record<string, unknown>|null>(null)
    const infoResolving = useComputed(() => {
        return state.didInfo.value === 'resolving'
    })
    const infoError = useAsyncComputed<string|null>(async () => {
        if (!(state.didInfo.value instanceof HTTPError)) {
            // if not an error
            return null
        }

        // is an error
        // if there is an error, get the error text
        const text = await state.didInfo.value.response.text()
        return state.didInfo.value.response.status + ` ${text}`
        // 404 Not found
    })

    useSignalEffect(() => {
        debug('info resolving', infoResolving.value)
        debug('data info', state.didInfo.value)
    })

    const resolvedInfo = useComputed<null|InfoType>(() => {
        if (
            state.didInfo.value &&
            typeof state.didInfo.value !== 'string' &&
            !(state.didInfo.value instanceof Error)
        ) {
            return state.didInfo.value
        }

        return null
    })

    const getDidInfo = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        const input = infoDid.value.trim()
        if (!input) return

        let did: string

        // Check if input is a DID or a handle
        if (input.startsWith('did:')) {
            did = input
        } else {
            // Resolve handle to DID first
            try {
                const handle = input.replace(/^@/, '')
                const handleRes = await ky.get(`/resolve/handle/${encodeURIComponent(handle)}`)
                    .json<{ did: string }>()
                did = handleRes.did
            } catch (err) {
                debug('error resolving handle', err)
                // Set error state - the State.didInfo will show the error
                state.didInfo.value = err instanceof HTTPError ? err : new HTTPError(
                    new Response('Handle not found', { status: 404 }),
                    new Request(''),
                    { method: 'GET' } as any
                )
                return
            }
        }

        State.didInfo(state, did)
    }, [])

    const handleResolve = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        const input = lookupDid.value.trim()
        if (!input) return

        batch(() => {
            resolveSubmitting.value = true
            resolveError.value = null
            resolvedDid.value = null
        })

        try {
            let did: string

            // Check if input is a DID or a handle
            if (input.startsWith('did:')) {
                did = input
            } else {
                // Resolve handle to DID
                const handle = input.replace(/^@/, '')
                const handleRes = await ky.get(`/resolve/handle/${encodeURIComponent(handle)}`)
                    .json<{ did: string }>()
                did = handleRes.did
            }

            // Now resolve the DID document
            const data = await ky.get(`/resolve/did/${encodeURIComponent(did)}`)
                .json<Record<string, unknown>>()
            resolvedDid.value = data
        } catch (err) {
            debug('error resolving', err)
            resolveError.value = err instanceof Error ?
                err.message :
                'Failed to resolve'
        } finally {
            resolveSubmitting.value = false
        }
    }, [])

    return html`<div class="route lookup">
        <h2>Lookup</h2>

        <section class="did-resolve">
            <header>
                <h3>Resolve</h3>
                <p>Look up a DID document by DID or Bluesky handle.</p>
            </header>

            <div class="section-grid">
                <form onSubmit=${handleResolve}>
                    <div class="input">
                        <label for="resolve-did">DID or Handle</label>
                        <input
                            type="text"
                            placeholder="did:plc:abc123 or alice.bsky.social"
                            name="did"
                            id="resolve-did"
                            value=${lookupDid.value}
                            onInput=${(e:InputEvent) => {
                                lookupDid.value = (e.target as HTMLInputElement).value
                            }}
                            disabled=${resolveSubmitting.value}
                        />
                    </div>
                    <div class="controls">
                        <${Button}
                            type="submit"
                            isSpinning=${resolveSubmitting}
                            disabled=${!lookupDid.value.trim()}
                        >
                            Resolve
                        <//>
                    </div>
                </form>

                <div class="response${resolveError.value ? ' error' : ''}">
                    ${resolveError.value && html`<p class="error">
                        ${resolveError.value}
                    </p>`}
                    ${resolvedDid.value && html`
                        <pre class="did-document">
                            ${JSON.stringify(resolvedDid.value, null, 2)}
                        </pre>
                    `}
                    ${!resolveError.value && !resolvedDid.value && html`
                        <p class="placeholder">-</p>
                    `}
                </div>
            </div>
        </section>

        <section class="did-info">
            <header>
                <h3>Repo Info</h3>
                <p>
                    Get repo info from the tap server by DID or handle.
                </p>
            </header>

            <div class="section-grid">
                <form onSubmit=${getDidInfo}>
                    <div class="input">
                        <label for="info-did">DID or Handle</label>
                        <input
                            type="text"
                            placeholder="did:plc:abc123 or alice.bsky.social"
                            name="did"
                            id="info-did"
                            value=${infoDid.value}
                            onInput=${(e:Event) => {
                                infoDid.value = (e.target as HTMLInputElement).value
                            }}
                            disabled=${infoResolving.value}
                        />
                    </div>
                    <div class="controls">
                        <${Button}
                            type="submit"
                            isSpinning=${infoResolving}
                            disabled=${!infoDid.value.trim()}
                        >
                            Get Info
                        <//>
                    </div>
                </form>

                <div class="response${infoError.value ? ' error' : ''}">
                    ${infoError.value && html`
                        <p class="error">${infoError.value}</p>
                        ${infoError.value.toLowerCase().includes('not found') && html`
                            <p class="hint">
                                Is this DID being followed by your Tap server?
                            </p>
                        `}
                    `}
                    ${resolvedInfo.value && html`
                        <pre class="did-document">${JSON.stringify(resolvedInfo.value, null, 2)}</pre>
                    `}
                    ${!infoError.value && !resolvedInfo.value && html`
                        <p class="placeholder">-</p>
                    `}
                </div>
            </div>
        </section>
    </div>`
}
