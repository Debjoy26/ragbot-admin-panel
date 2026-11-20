import { expect, test } from '@playwright/test'

test('opens the fixture overview and navigates with a clear current page', async ({ page }) => {
  await page.goto('/app/')
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('This workspace uses sample data.', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sample documents' })).toBeVisible()

  await page.getByRole('link', { name: 'View documents' }).click()
  await expect(page).toHaveURL('/app/knowledge/documents')
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Documents', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('serves a deep link, recovers from an unknown route, and excludes provider pages', async ({ page, request }) => {
  await page.goto('/app/knowledge/gaps')
  await expect(page.getByRole('heading', { name: 'Knowledge gaps' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveTitle('Knowledge gaps | RAGbot Admin')

  await page.goto('/app/missing')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to overview' }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  expect((await request.get('/provider')).status()).toBe(404)
})

test('supports keyboard access and fits a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/app/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
