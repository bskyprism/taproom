import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import { FunctionComponent } from 'preact'
import { batch, useSignal } from '@preact/signals'
import ky from 'ky'
import Debug from '@substrate-system/debug'
import { Button } from '../components/button.js'
import { type AppState } from '../state.js'
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

    const getDidInfo = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
    }, [])

    const handleResolve = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        if (!lookupDid.value.trim()) return

        batch(() => {
            resolveSubmitting.value = true
            resolveError.value = null
            resolvedDid.value = null
        })

        batch(async () => {
            try {
                const did = encodeURIComponent(lookupDid.value.trim())
                const data = await ky.get(`/api/tap/resolve/${did}`)
                    .json<Record<string, unknown>>()
                resolvedDid.value = data
            } catch (err) {
                debug('error resolving did', err)
                resolveError.value = err instanceof Error ?
                    err.message :
                    'Failed to resolve DID'
            } finally {
                resolveSubmitting.value = false
            }
        })
    }, [])

    return html`<div class="route lookup">
        <h2>Lookup</h2>

        <section class="did-resolve">
            <header>
                <h3>Resolve a DID</h3>
                <p>Look up a DID document by its ID string.</p>
            </header>

            <form onSubmit=${handleResolve}>
                <div class="input">
                    <label for="resolve-did">DID</label>
                    <input
                        type="text"
                        placeholder="did:plc:abc123"
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

            ${html`
                <div class="response${resolveError.value ? ' error' : ''}">
                    <pre class="did-document">
                        ${resolveError.value || null}
                        ${resolvedDid.value &&
                            JSON.stringify(resolvedDid.value, null, 2)
                        }
                    </pre>
                </div>
            `}
        </section>

        <section class="did-info">
            <header>
                <h3>DID Info</h3>
                <p>Call the <code>/info/:did</code> path on the tap server.</p>
            </header>

            <form onSubmit=${getDidInfo}>
                <div class="input">
                    <label for="resolve-did">DID</label>
                    <input
                        type="text"
                        placeholder="did:plc:abc123"
                        name="did"
                        id="resolve-did"
                        value=${infoDid.value}
                        onInput=${(e:Event) => {
                            infoDid.value = (e.target as HTMLInputElement).value
                        }}
                        disabled=${resolveSubmitting.value}
                    />
                </div>
                <div class="controls">
                    <${Button}
                        type="submit"
                        isSpinning=${resolveSubmitting}
                        disabled=${!infoDid.value.trim()}
                    >
                        Resolve
                    <//>
                </div>
            </form>

            ${html`
                <div class="response${resolveError.value ? ' error' : ''}">
                    <pre class="did-document">
                        ${resolveError.value || null}
                        ${resolvedDid.value &&
                            JSON.stringify(resolvedDid.value, null, 2)
                        }
                    </pre>
                </div>
            `}
        </section>


    </div>`
}
