import { html } from 'htm/preact'
import { useCallback } from 'preact/hooks'
import type { FunctionComponent } from 'preact'
import { useSignal } from '@preact/signals'
import {
    startRegistration,
    startAuthentication,
} from '@simplewebauthn/browser'
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import ky from 'ky'
import Debug from '@substrate-system/debug'
import { Button } from '../components/button.js'
import { State } from '../state.js'
import type { AppState } from '../state.js'
import './login.css'

const debug = Debug('taproom:login')

export const LoginRoute:FunctionComponent<{ state:AppState }> = function ({
    state
}) {
    const secret = useSignal('')
    const submitting = useSignal(false)
    const error = useSignal<string|null>(null)
    const success = useSignal<string|null>(null)

    const handleRegister = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        if (!secret.value.trim()) return

        submitting.value = true
        error.value = null
        success.value = null

        try {
            const optionsRes = await ky.post('/api/auth/register/options', {
                json: { secret: secret.value.trim() }
            }).json<{
                options:PublicKeyCredentialCreationOptionsJSON;
                challengeKey:string;
            }>()

            const credential = await startRegistration({
                optionsJSON: optionsRes.options,
            })

            await ky.post('/api/auth/register/verify', {
                json: {
                    secret: secret.value.trim(),
                    challengeKey: optionsRes.challengeKey,
                    response: credential,
                }
            })

            secret.value = ''
            success.value = 'Passkey registered successfully!'
            await State.FetchAuthStatus(state)

            // Redirect to home after successful registration
            setTimeout(() => {
                state._setRoute('/')
            }, 1000)
        } catch (err) {
            debug('registration error', err)
            if (err instanceof Error) {
                try {
                    const body = await (err as { response?:Response })
                        .response?.json() as { error?:string }
                    error.value = body?.error || err.message
                } catch {
                    error.value = err.message
                }
            } else {
                error.value = 'Registration failed'
            }
        } finally {
            submitting.value = false
        }
    }, [])

    const handleLogin = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        submitting.value = true
        error.value = null
        success.value = null

        try {
            const optionsRes = await ky.post('/api/auth/authenticate/options')
                .json<{
                    options:PublicKeyCredentialRequestOptionsJSON;
                    challengeKey:string;
                }>()

            debug('got auth options', optionsRes)

            const credential = await startAuthentication({
                optionsJSON: optionsRes.options,
            })

            debug('got auth credential', credential)

            await ky.post('/api/auth/authenticate/verify', {
                json: {
                    challengeKey: optionsRes.challengeKey,
                    response: credential,
                }
            })

            debug('authentication complete')
            success.value = 'Logged in successfully!'
            await State.FetchAuthStatus(state)

            // Redirect to home after successful login
            setTimeout(() => {
                state._setRoute('/')
            }, 500)
        } catch (err) {
            debug('auth error', err)
            if (err instanceof Error) {
                try {
                    const body = await (err as { response?:Response })
                        .response?.json() as { error?:string }
                    error.value = body?.error || err.message
                } catch {
                    error.value = err.message
                }
            } else {
                error.value = 'Authentication failed'
            }
        } finally {
            submitting.value = false
        }
    }, [])

    const auth = state.auth.value

    // If already authenticated, show message
    if (auth?.authenticated) {
        return html`<div class="route login">
            <h2>Login</h2>
            <p class="already-authenticated">
                You are already logged in. <a href="/">Go to Dashboard</a>
            </p>
        </div>`
    }

    const isRegistered = auth?.registered ?? false

    return html`<div class="route login">
        <h2>Login</h2>

        ${error.value && html`<p class="error-banner">${error.value}</p>`}
        ${success.value && html`<p class="success-message">${success.value}</p>`}

        ${isRegistered ? html`
            <section class="login-section">
                <header>
                    <h3>Login with Passkey</h3>
                    <p>Use your registered passkey to authenticate.</p>
                </header>

                <form onSubmit=${handleLogin}>
                    <div class="controls">
                        <${Button}
                            type="submit"
                            isSpinning=${submitting}
                        >
                            Login with Passkey
                        <//>
                    </div>
                </form>
            </section>

            <section class="add-passkey-section">
                <header>
                    <h3>Add Another Passkey</h3>
                    <p>Register an additional device or passkey.</p>
                </header>

                <form onSubmit=${handleRegister}>
                    <div class="input">
                        <label for="secret">Registration Secret</label>
                        <input
                            type="password"
                            id="secret"
                            name="secret"
                            autocomplete="password"
                            placeholder="abc123..."
                            value=${secret.value}
                            onInput=${(e:Event) => {
                                secret.value = (e.target as HTMLInputElement).value
                            }}
                            disabled=${submitting.value}
                        />
                    </div>
                    <div class="controls">
                        <${Button}
                            type="submit"
                            isSpinning=${submitting}
                            disabled=${!secret.value.trim()}
                        >
                            Add Passkey
                        <//>
                    </div>
                </form>
            </section>
        ` : html`
            <section class="register-section">
                <header>
                    <h3>Register a Passkey</h3>
                    <p>Enter the registration secret to set up your passkey.</p>
                </header>

                <form onSubmit=${handleRegister}>
                    <div class="input">
                        <label for="secret">Registration Secret</label>
                        <input
                            type="password"
                            id="secret"
                            name="secret"
                            placeholder="abc123..."
                            autocomplete="password"
                            value=${secret.value}
                            onInput=${(e:Event) => {
                                secret.value = (e.target as HTMLInputElement).value
                            }}
                            disabled=${submitting.value}
                        />
                    </div>
                    <div class="controls">
                        <${Button}
                            type="submit"
                            isSpinning=${submitting}
                            disabled=${!secret.value.trim()}
                        >
                            Register Passkey
                        <//>
                    </div>
                </form>
            </section>
        `}
    </div>`
}
