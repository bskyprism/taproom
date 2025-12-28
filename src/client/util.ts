import {
    useSignal,
    type Signal,
    useSignalEffect,
    effect
} from '@preact/signals'
import { HTTPError } from 'ky'

/**
 * Extract a user-friendly error message from an HTTPError.
 * Reads the response body as plain text.
 */
export async function parseHttpError (err:unknown):Promise<string> {
    if (err instanceof HTTPError) {
        try {
            const text = await err.response.clone().text()
            return text || err.message
        } catch {
            return err.message
        }
    }

    if (err instanceof Error) {
        return err.message
    }

    return 'Unknown error'
}

/**
 * Format a number as an English string.
 *
 * @param n The number
 * @returns An English string, like "1 billion".
 */
export function numberToString (n:number|null):string {
    if (n === null) return 'null'
    const formatter = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        compactDisplay: 'long'
    })

    return formatter.format(n)
}

export function useAsyncComputed<T> (
    compute:()=>Promise<T>,
):Signal<T|null> {
    const result = useSignal<T|null>(null)

    useSignalEffect(() => {
        compute()
            .then(data => {
                result.value = data
            })
            .catch(err => {
                result.value = err
            })
    })

    return result
}

/**
 * Return a promise that resolves when the given signal is defined
 * (not `null` and not `undefined`).
 * @param signal The signal to wait for.
 * @returns {Promise<T>}
 */
export function when<T> (signal:Signal<T|null|undefined>):Promise<T> {
    return new Promise((resolve) => {
        const dispose = effect(() => {
            const value = signal.value
            if (value !== null && value !== undefined) {
                // Use queueMicrotask to avoid disposing during effect execution
                queueMicrotask(() => dispose())
                resolve(value as T)
            }
        })
    })
}
