import { test, expect } from '@playwright/test'

test.describe('Dashboard error state', () => {
    test('displays error banner with parsed error message on 403', async ({ page }) => {
        // Mock the health endpoint to return 403 with plain text error
        await page.route('**/api/tap/health', async route => {
            await route.fulfill({
                status: 403,
                contentType: 'text/plain',
                body: 'Invalid admin password',
            })
        })

        // Mock the stats endpoint to succeed (so only health error shows)
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
                }),
            })
        })

        await page.goto('/')

        // Wait for and verify the error banner appears with the plain text message
        const errorBanner = page.locator('.error-banner')
        await expect(errorBanner).toBeVisible()
        await expect(errorBanner).toContainText('Invalid admin password')

        // Verify server status shows disconnected
        const statusValue = page.locator('.stat-card').first().locator('.stat-value')
        await expect(statusValue).toContainText('Disconnected')
        await expect(statusValue).toHaveClass(/status-error/)
    })

    test('displays detailed error message from server', async ({ page }) => {
        await page.route('**/api/tap/health', async route => {
            await route.fulfill({
                status: 401,
                contentType: 'text/plain',
                body: 'atproto admin auth required, but missing or incorrect password',
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
                }),
            })
        })

        await page.goto('/')

        const errorBanner = page.locator('.error-banner')
        await expect(errorBanner).toBeVisible()
        await expect(errorBanner).toContainText('atproto admin auth required')
    })

    test('shows dashes for stats when API fails', async ({ page }) => {
        await page.route('**/api/tap/health', async route => {
            await route.fulfill({
                status: 403,
                contentType: 'text/plain',
                body: 'Forbidden',
            })
        })

        await page.route('**/api/tap/stats', async route => {
            await route.fulfill({
                status: 403,
                contentType: 'text/plain',
                body: 'Forbidden',
            })
        })

        await page.goto('/')

        // Tracked Repos should show dash
        const trackedRepos = page.locator('.stat-card').nth(1).locator('.stat-value')
        await expect(trackedRepos).toContainText('—')

        // Total Records should show dash
        const totalRecords = page.locator('.stat-card').nth(2).locator('.stat-value')
        await expect(totalRecords).toContainText('—')
    })
})
