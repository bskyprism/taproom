import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import { FunctionComponent } from 'preact'
import { useSignal } from '@preact/signals'
import ky from 'ky'
import Debug from '@substrate-system/debug'
import { Button } from '../components/button.js'
import './lookup.css'
const debug = Debug('taproom:lookup')

export const LookupRoute:FunctionComponent = function () {
    const resolveDid = useSignal('')
    const resolveSubmitting = useSignal(false)
    const resolveError = useSignal<string|null>(null)
    const resolvedDid = useSignal<Record<string, unknown>|null>(null)

    const handleResolve = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        if (!resolveDid.value.trim()) return

        resolveSubmitting.value = true
        resolveError.value = null
        resolvedDid.value = null

        try {
            const did = encodeURIComponent(resolveDid.value.trim())
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
                        value=${resolveDid.value}
                        onInput=${(e:Event) => {
                            resolveDid.value = (e.target as HTMLInputElement).value
                        }}
                        disabled=${resolveSubmitting.value}
                    />
                </div>
                <div class="controls">
                    <${Button}
                        type="submit"
                        isSpinning=${resolveSubmitting}
                        disabled=${!resolveDid.value.trim()}
                    >
                        Resolve
                    <//>
                </div>
            </form>

            ${resolveError.value && html`
                <div class="response error-response">
                    <p class="error">${resolveError.value}</p>
                </div>
            `}
            ${resolvedDid.value && html`
                <div class="response">
                    <pre class="did-document">
                        ${JSON.stringify(resolvedDid.value, null, 2)}
                    </pre>
                </div>
            `}
        </section>
    </div>`
}
