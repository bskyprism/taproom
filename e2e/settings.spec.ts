import { test, expect } from '@playwright/test'

test.describe('Settings page', () => {
    test.beforeEach(async ({ page }) => {
        // Mock auth status as authenticated
        await page.route('**/api/auth/status', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    registered: true,
                    authenticated: true,
                })
            })
        })

        // Mock health endpoint
        await page.route('**/api/tap/health', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'ok' })
            })
        })

        // Mock stats endpoint
        await page.route('**/api/tap/stats', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    repoCount: 10,
                    recordCount: 1000,
                    outboxBuffer: 0,
                    resyncBuffer: 0,
                    cursors: { firehose: 0, listRepos: '0' }
                })
            })
        })
    })

    test('displays current signal collection NSID', async ({ page }) => {
        await page.route('**/api/settings/signal-collection', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    nsid: 'app.bsky.feed.post'
                })
            })
        })

        await page.goto('/settings')

        // Verify current NSID is displayed
        const currentValue = page.locator('.current-value code')
        await expect(currentValue).toContainText('app.bsky.feed.post')
    })

    test('shows empty state when no signal collection configured', async ({ page }) => {
        await page.route('**/api/settings/signal-collection', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ nsid: null })
            })
        })

        await page.goto('/settings')

        // Verify current value section is not shown
        const currentValue = page.locator('.current-value')
        await expect(currentValue).not.toBeVisible()
    })

    test('shows validation error for invalid NSID format', async ({ page }) => {
        await page.route('**/api/settings/signal-collection', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ nsid: null })
                })
            } else {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Invalid NSID format' })
                })
            }
        })

        await page.goto('/settings')

        // Fill in invalid NSID
        await page.fill('#nsid', 'invalid')
        await page.click('button[type="submit"]')

        // Verify error is shown
        const errorMessage = page.locator('.response .error')
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toContainText('Invalid NSID format')
    })

    test('shows success message after update', async ({ page }) => {
        let postCalled = false

        await page.route('**/api/settings/signal-collection', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ nsid: null })
                })
            } else {
                postCalled = true
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        nsid: 'app.bsky.feed.like',
                        deploying: true
                    })
                })
            }
        })

        await page.goto('/settings')

        // Fill in valid NSID
        await page.fill('#nsid', 'app.bsky.feed.like')
        await page.click('button[type="submit"]')

        // Wait for success message
        const successMessage = page.locator('.response .success')
        await expect(successMessage).toBeVisible({ timeout: 10000 })
        await expect(successMessage).toContainText('Secret updated')

        expect(postCalled).toBe(true)
    })

    test('submit button is disabled when input is empty', async ({ page }) => {
        await page.route('**/api/settings/signal-collection', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ nsid: null })
            })
        })

        await page.goto('/settings')

        // Verify submit button is disabled initially
        const submitButton = page.locator('button[type="submit"]')
        await expect(submitButton).toBeDisabled()

        // Fill in value
        await page.fill('#nsid', 'app.bsky.test')

        // Verify button is enabled
        await expect(submitButton).toBeEnabled()

        // Clear the input
        await page.fill('#nsid', '')

        // Verify button is disabled again
        await expect(submitButton).toBeDisabled()
    })

    test('settings link appears in navigation when authenticated', async ({ page }) => {
        await page.route('**/api/settings/signal-collection', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ nsid: null })
            })
        })

        await page.goto('/')

        // Verify Settings link is in navigation
        const settingsLink = page.locator('nav a[href="/settings"]')
        await expect(settingsLink).toBeVisible()
        await expect(settingsLink).toContainText('Settings')
    })
})

test.describe('Settings page - unauthenticated', () => {
    test('redirects to login when not authenticated', async ({ page }) => {
        // Mock auth status as not authenticated
        await page.route('**/api/auth/status', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    registered: true,
                    authenticated: false,
                })
            })
        })

        // Mock other endpoints
        await page.route('**/api/tap/health', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'ok' })
            })
        })

        await page.route('**/api/tap/stats', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    repoCount: 0,
                    recordCount: 0,
                    outboxBuffer: 0,
                    resyncBuffer: 0,
                    cursors: { firehose: 0, listRepos: '0' }
                })
            })
        })

        await page.goto('/settings')

        // Should redirect to login
        await expect(page).toHaveURL('/login')
    })
})
