import { expect, test } from '@playwright/test'
import { mockProvider, openProvider, providerSignInLink } from './provider-fixture'

test('fails closed without provider configuration', async ({ page }) => {
  await page.route('**/app/provider-config.json', (route) => route.fulfill({ status: 404 }))
  await page.goto('/app/provider')
  await expect(page.getByRole('heading', { name: 'Provider unavailable' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('requires sign-in on provider routes', async ({ page }) => {
  await mockProvider(page)
  await page.goto('/app/provider/audit')
  await expect(page.getByRole('heading', { name: 'Provider sign in' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('signs in with MFA and lists registry clients', async ({ page }) => {
  await mockProvider(page)
  await page.goto(providerSignInLink('/app/provider', 'aal1'))
  await expect(page.getByRole('heading', { name: 'Verify your sign-in' })).toBeVisible()
  await page.getByLabel('Authenticator code').fill('123456')
  await page.getByRole('button', { name: 'Verify code' }).click()
  await expect(page.getByRole('heading', { name: 'Client registry' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Acme Co' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Beta Ltd' })).toBeVisible()
})

test('opens client detail and suspends service with confirmation', async ({ page }) => {
  const { calls } = await mockProvider(page)
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto(providerSignInLink('/app/provider/clients/client-a'))
  await expect(page.getByRole('heading', { name: 'Acme Co' })).toBeVisible()
  await page.getByRole('button', { name: 'Suspend service' }).click()
  await expect(page.getByRole('status')).toContainText('Suspension recorded')
  expect(calls).toContain('suspend')
})

test('keeps operators read-only on lifecycle actions', async ({ page }) => {
  await mockProvider(page, { role: 'provider_operator' })
  await page.goto(providerSignInLink('/app/provider/clients/client-a'))
  await expect(page.getByRole('heading', { name: 'Acme Co' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Suspend service' })).toHaveCount(0)
  await expect(page.getByText('read-only')).toBeVisible()
})

test('denies staff without a provider role', async ({ page }) => {
  await mockProvider(page, { role: null })
  await page.goto(providerSignInLink())
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('shows audit entries and staff list', async ({ page }) => {
  await openProvider(page, '/app/provider/audit')
  await expect(page.getByRole('cell', { name: 'client.restore' })).toBeVisible()
  await page.getByRole('link', { name: 'Provider staff' }).click()
  await expect(page.getByRole('cell', { name: 'support@example.test' })).toBeVisible()
})
