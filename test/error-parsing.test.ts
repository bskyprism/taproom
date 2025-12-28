import { test } from '@substrate-system/tapzero'
import { parseHttpError } from '../src/client/util.js'
import { HTTPError } from 'ky'

test('parseHttpError - extracts plain text error message', async t => {
    const err = createMockHttpError(403, 'Invalid credentials')
    const message = await parseHttpError(err)
    t.equal(message, 'Invalid credentials', 'should extract plain text')
})

test('parseHttpError - extracts detailed error message', async t => {
    const err = createMockHttpError(401,
        'atproto admin auth required, but missing or incorrect password')
    const message = await parseHttpError(err)
    t.equal(message,
        'atproto admin auth required, but missing or incorrect password',
        'should extract full message')
})

test('parseHttpError - handles empty response body', async t => {
    const err = createMockHttpError(500, '')
    const message = await parseHttpError(err)
    t.ok(message.includes('500'),
        'should fall back to err.message with status code')
})

test('parseHttpError - handles regular Error', async t => {
    const err = new Error('Network failure')
    const message = await parseHttpError(err)
    t.equal(message, 'Network failure', 'should use error message')
})

test('parseHttpError - handles unknown error type', async t => {
    const message = await parseHttpError('string error')
    t.equal(message, 'Unknown error', 'should return unknown error')
})

test('parseHttpError - handles null', async t => {
    const message = await parseHttpError(null)
    t.equal(message, 'Unknown error', 'should return unknown error for null')
})

// Helper to create a mock HTTPError with plain text body
function createMockHttpError (
    status: number,
    body: string
):HTTPError {
    const response = new Response(body, {
        status,
        headers: { 'Content-Type': 'text/plain' }
    })
    const request = new Request('https://example.com/api')
    // Cast options as any since we only need minimal mock for testing
    return new HTTPError(response, request, { method: 'GET' } as any)
}
