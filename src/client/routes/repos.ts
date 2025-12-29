import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import { batch, useComputed, useSignal } from '@preact/signals'
import ky from 'ky'
import Debug from '@substrate-system/debug'
import { Button } from '../components/button.js'
import { State } from '../state.js'
import type { AppState } from '../state.js'
import './repos.css'
const debug = Debug('taproom:repos')

export const ReposRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    // Add form state
    const addDid = useSignal('')
    const addSubmitting = useSignal(false)
    const addError = useSignal<string|null>(null)
    const addSuccess = useSignal<string|null>(null)

    // Remove form state
    const rmDid = useSignal('')
    const rmSubmitting = useSignal(false)
    const rmError = useSignal<string|null>(null)
    const rmSuccess = useSignal<string|null>(null)

    const handleAdd = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        if (!addDid.value.trim()) return

        batch(() => {
            addSubmitting.value = true
            addError.value = null
            addSuccess.value = null
        })

        try {
            await State.addRepo(state, addDid.value.trim())
            batch(() => {
                addSuccess.value = `Added ${addDid.value}`
                addDid.value = ''
                addSubmitting.value = false
            })

            // ...and update the stats
            await State.FetchStats(state)
        } catch (err) {
            debug('error adding repo', err)
            batch(() => {
                addError.value = (err instanceof Error ?
                    err.message :
                    'Failed to add repo')
                addSubmitting.value = false
            })
        }
    }, [])

    const handleRemove = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        if (!rmDid.value.trim()) return

        rmSubmitting.value = true
        rmError.value = null
        rmSuccess.value = null

        try {
            await ky.post('/api/tap/repos/remove', {
                json: { did: rmDid.value.trim() }
            })
            rmSuccess.value = `Removed ${rmDid.value}`
            rmDid.value = ''
            await State.FetchStats(state)
        } catch (err) {
            debug('error removing repo', err)
            rmError.value = err instanceof Error ? err.message : 'Failed to remove repo'
        } finally {
            rmSubmitting.value = false
        }
    }, [])

    return html`<div class="route repos">
        <h2>Repos</h2>

        <${FollowingCount} state=${state} />

        <section class="add-repo">
            <header>
                <h3>Add a Repo</h3>
                <p>Add a new DID string to follow.</p>
            </header>

            <div class="section-grid">
                <form onSubmit=${handleAdd}>
                    <div class="input">
                        <label for="add-did">DID</label>
                        <input
                            type="text"
                            placeholder="did:plc:abc123"
                            name="did"
                            id="add-did"
                            value=${addDid.value}
                            onInput=${(e:Event) => {
                                addDid.value = (e.target as HTMLInputElement).value
                            }}
                            disabled=${addSubmitting.value}
                        />
                    </div>
                    <div class="controls">
                        <${Button}
                            type="submit"
                            isSpinning=${addSubmitting}
                            disabled=${!addDid.value.trim()}
                        >
                            Add
                        <//>
                    </div>
                </form>

                <div class="response">
                    ${addError.value && html`<p class="error">
                        ${addError.value}
                    </p>`}
                    ${addSuccess.value && html`<p class="success">
                        ${addSuccess.value}
                    </p>`}
                    ${!addError.value && !addSuccess.value && html`
                        <p class="placeholder">-</p>
                    `}
                </div>
            </div>
        </section>

        <section class="rm-repo">
            <header>
                <h3>Remove a Repo</h3>
                <p>Remove a DID you are following.</p>
            </header>

            <div class="section-grid">
                <form onSubmit=${handleRemove}>
                    <div class="input">
                        <label for="rm-did">DID</label>
                        <input
                            type="text"
                            placeholder="did:plc:abc123"
                            name="did"
                            id="rm-did"
                            value=${rmDid.value}
                            onInput=${(e:Event) => {
                                rmDid.value = (e.target as HTMLInputElement).value
                            }}
                            disabled=${rmSubmitting.value}
                        />
                    </div>
                    <div class="controls">
                        <${Button}
                            type="submit"
                            isSpinning=${rmSubmitting}
                            disabled=${!rmDid.value.trim()}
                        >
                            Remove
                        <//>
                    </div>
                </form>

                <div class="response">
                    ${rmError.value && html`<p class="error">${rmError.value}</p>`}
                    ${rmSuccess.value && html`<p class="success">${rmSuccess.value}</p>`}
                    ${!rmError.value && !rmSuccess.value && html`
                        <p class="placeholder">-</p>
                    `}
                </div>
            </div>
        </section>

    </div>`
}

function FollowingCount ({ state }:{ state:AppState }) {
    const isFollowing = useComputed(() => {
        return !!state.tapStats.value?.repoCount
    })

    return html`
        <dl>
            <div>
                <dt>
                    ${isFollowing.value ?
                        html`
                            <a href="/repos/following">Total Repos Followed</a>
                        ` :
                        'Total Repos Followed'
                    }
                </dt>
                <dd>${state.tapStats.value?.repoCount ?? '—'}</dd>
            </div>
        </dl>
    `
}
