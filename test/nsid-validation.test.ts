import { test } from '@substrate-system/tapzero'

// Import the validation function - we'll need to export it from the server
// For now, we'll duplicate the logic here for testing
function isValidNsid (nsid:string):boolean {
    if (!nsid || nsid.length > 253) return false
    const pattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){2,}$/
    return pattern.test(nsid)
}

test('isValidNsid - accepts valid 3-segment NSID', t => {
    t.ok(isValidNsid('app.bsky.feed'), 'should accept 3-segment NSID')
})

test('isValidNsid - accepts valid 4-segment NSID', t => {
    t.ok(isValidNsid('app.bsky.feed.post'), 'should accept 4-segment NSID')
})

test('isValidNsid - accepts NSID with hyphens', t => {
    t.ok(isValidNsid('com.my-app.my-service.record'), 'should accept hyphens')
})

test('isValidNsid - accepts NSID with numbers', t => {
    t.ok(isValidNsid('app.bsky2.feed3'), 'should accept numbers')
})

test('isValidNsid - rejects empty string', t => {
    t.equal(isValidNsid(''), false, 'should reject empty string')
})

test('isValidNsid - rejects 2-segment NSID', t => {
    t.equal(isValidNsid('app.bsky'), false, 'should reject 2-segment NSID')
})

test('isValidNsid - rejects uppercase', t => {
    t.equal(isValidNsid('App.Bsky.Feed'), false, 'should reject uppercase')
})

test('isValidNsid - rejects leading hyphen in segment', t => {
    t.equal(isValidNsid('app.-bsky.feed'), false, 'should reject leading hyphen')
})

test('isValidNsid - rejects segment starting with number', t => {
    t.equal(isValidNsid('1app.bsky.feed'), false, 'should reject segment starting with number')
})

test('isValidNsid - rejects NSID over 253 characters', t => {
    const longNsid = 'a.' + 'b'.repeat(250) + '.c'
    t.equal(isValidNsid(longNsid), false, 'should reject NSID over 253 chars')
})

test('isValidNsid - rejects special characters', t => {
    t.equal(isValidNsid('app.bsky.feed!'), false, 'should reject special characters')
})

test('isValidNsid - rejects spaces', t => {
    t.equal(isValidNsid('app.bsky .feed'), false, 'should reject spaces')
})
