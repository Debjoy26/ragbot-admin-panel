import { expect, test } from '@playwright/test'
import { mockTenant, requestAccessRecheck, signInLink } from './tenant-fixture'

test('fails closed without tenant configuration', async ({ page }) => {
  await page.route('**/app/tenant-config.json', (route) => route.fulfill({ status: 404 }))
  await page.goto('/app/')
  await expect(page.getByRole('heading', { name: 'Workspace unavailable' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('guards direct routes and rejects wrong credentials', async ({ page }) => {
  const tenant = await mockTenant(page)
  await page.goto('/app/knowledge/gaps')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await page.getByLabel('Email address').fill('member@example.test')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password')
  expect(tenant.passwordRequests).toHaveLength(1)
})

test('creates an account and confirms it before MFA', async ({ page }) => {
  const tenant = await mockTenant(page)
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Email address').fill('new@example.test')
  await page.getByLabel('Password').fill('correct-password-1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('status')).toContainText('Account created')
  expect(tenant.signupRequests[0]?.email).toBe('new@example.test')
  await page.goto('/app/?token_hash=test-confirm&type=signup')
  await expect(page.getByRole('heading', { name: 'Verify your sign-in' })).toBeVisible()
  await page.getByLabel('Authenticator code').fill('123456')
  await page.getByRole('button', { name: 'Verify code' }).click()
  await expect(page.getByText('Client workspace · admin')).toBeVisible()
})

test('sends a password-reset link', async ({ page }) => {
  const tenant = await mockTenant(page)
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Forgot your password?' }).click()
  await page.getByLabel('Email address').fill('member@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('password-reset link is on its way')
  expect(tenant.recoverRequests[0]?.email).toBe('member@example.test')
})

test('removes tokens from invalid callback URLs', async ({ page }) => {
  await mockTenant(page)
  await page.goto('/app/#access_token=invalid&refresh_token=invalid&type=recovery')
  await expect(page.getByRole('heading', { name: 'Sign-in link unavailable' })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('')
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('requires MFA before private content and removes the session on sign-out', async ({ page }) => {
  await mockTenant(page)
  await page.goto(signInLink('/app/', 'aal1'))
  await expect(page.getByRole('heading', { name: 'Verify your sign-in' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await page.getByLabel('Authenticator code').fill('000000')
  await page.getByRole('button', { name: 'Verify code' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not verify that code')

  await page.getByLabel('Authenticator code').fill('123456')
  await page.getByRole('button', { name: 'Verify code' }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  expect(new URL(page.url()).hash).toBe('')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('supports TOTP enrollment for invited members without a factor', async ({ page }) => {
  await mockTenant(page, { enrolled: false, role: 'owner' })
  await page.goto(signInLink('/app/', 'aal1'))
  await page.getByRole('button', { name: 'Set up authenticator' }).click()
  await expect(page.getByRole('img', { name: 'Authenticator setup QR code' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await page.getByLabel('Authenticator code').fill('123456')
  await page.getByRole('button', { name: 'Verify code' }).click()
  await expect(page.getByText('Client workspace · owner')).toBeVisible()
})

test('denies a signed-in user without active membership', async ({ page }) => {
  await mockTenant(page, { role: null })
  await page.goto(signInLink())
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('hides owner and admin routes from analysts and denies direct access', async ({ page }) => {
  await mockTenant(page, { role: 'analyst' })
  await page.goto(signInLink('/app/members'))
  await expect(page.getByRole('heading', { name: 'Permission denied' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Members', exact: true })).toHaveCount(0)
})

test('clears the private shell when a membership is revoked', async ({ page }) => {
  const tenant = await mockTenant(page, { role: 'analyst' })
  await page.goto(signInLink('/app/knowledge/gaps'))
  await expect(page.getByText('Client workspace · analyst')).toBeVisible()
  tenant.revoke()
  await requestAccessRecheck(page)
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('clears the private shell on session expiry', async ({ page }) => {
  const tenant = await mockTenant(page)
  await page.goto(signInLink())
  await expect(page.getByText('Client workspace · admin')).toBeVisible()
  tenant.expire()
  await requestAccessRecheck(page)
  await expect(page.getByRole('alert')).toContainText('Your session ended')
  await expect(page.getByRole('navigation')).toHaveCount(0)
})
