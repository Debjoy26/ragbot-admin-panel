import { expect, test } from '@playwright/test'
import { mockTenant, openWorkspace, signInLink } from './tenant-fixture'

test('opens the live overview and navigates to documents', async ({ page }) => {
  await openWorkspace(page)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('Live workspace state')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'support', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible()

  await page.getByRole('link', { name: 'Documents', exact: true }).click()
  await expect(page).toHaveURL('/app/knowledge/documents')
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Getting started' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Documents', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('loads settings and surfaces a stale-version conflict without losing edits', async ({ page }) => {
  await openWorkspace(page, '/app/settings')
  await expect(page.getByRole('heading', { name: 'Bot settings' })).toBeVisible()
  await expect(page.getByLabel('Display name')).toHaveValue('Website support')

  await page.getByLabel('Display name').fill('Trigger stale')
  await page.getByRole('button', { name: /Save settings/ }).click()
  await expect(page.getByRole('alert')).toContainText('changed since')
  await expect(page.getByRole('alert')).toContainText('RB030')
  await expect(page.getByLabel('Display name')).toHaveValue('Trigger stale')
})

test('shows indexing, conversations, usage, and members from the tenant backend', async ({ page }) => {
  await openWorkspace(page, '/app/knowledge/indexing')
  await expect(page.getByRole('cell', { name: 'index_document' }).first()).toBeVisible()

  await page.getByRole('link', { name: 'Conversations' }).click()
  await expect(page.getByRole('heading', { name: 'Conversations', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /open/ }).first().click()
  await expect(page.getByText('What are your hours?')).toBeVisible()
  await expect(page.getByText('We are open weekdays 9 to 5.')).toBeVisible()

  await page.getByRole('link', { name: 'Usage' }).click()
  await expect(page.getByRole('button', { name: 'Load usage' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'chat' })).toBeVisible()

  await page.getByRole('link', { name: 'Members' }).click()
  await expect(page.getByRole('cell', { name: 'member@example.test' })).toBeVisible()
})

test('rejects usage ranges longer than 92 days', async ({ page }) => {
  await openWorkspace(page, '/app/usage')
  await page.getByLabel('From').fill('2026-01-01')
  await page.getByLabel('To').fill('2026-12-31')
  await page.getByRole('button', { name: 'Load usage' }).click()
  await expect(page.getByRole('alert')).toContainText('92 days')
})

test('keeps analysts read-only on documents and out of members', async ({ page }) => {
  await mockTenant(page, { role: 'analyst' })
  await page.goto(signInLink('/app/knowledge/documents'))
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Upload a document' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)

  await page.goto(signInLink('/app/members'))
  await expect(page.getByRole('heading', { name: 'Permission denied' })).toBeVisible()
})

test('serves a deep link, protects it after reload, and excludes provider pages', async ({ page, request }) => {
  await openWorkspace(page, '/app/knowledge/gaps')
  await expect(page).toHaveTitle('Knowledge gaps | RAGbot Admin')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  expect((await request.get('/provider')).status()).toBe(404)
})

test('supports keyboard access and fits a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await openWorkspace(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
