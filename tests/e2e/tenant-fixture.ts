import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const origin = 'https://tenant.example'
const factor = { id: 'test-factor', factor_type: 'totp', status: 'verified', friendly_name: 'Test authenticator' }

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function tokens(aal: 'aal1' | 'aal2') {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const accessToken = [encode({ alg: 'HS256', typ: 'JWT' }), encode({ aal, exp: expiresAt }), 'c2ln'].join('.')
  return { access_token: accessToken, refresh_token: 'test-refresh', expires_at: expiresAt, expires_in: 3600, token_type: 'bearer' }
}

export function signInLink(path = '/app/', aal: 'aal1' | 'aal2' = 'aal2') {
  const { access_token, refresh_token } = tokens(aal)
  return path + '#' + new URLSearchParams({ access_token, refresh_token, type: 'magiclink' })
}

export async function mockTenant(page: Page, options: {
  role?: 'owner' | 'admin' | 'analyst' | null
  enrolled?: boolean
} = {}) {
  let role = options.role === undefined ? 'admin' : options.role
  let enrolled = options.enrolled ?? true
  let expired = false
  const signInRequests: { create_user: boolean }[] = []

  function user() {
    return {
      id: '3da10703-ced6-4086-a532-76d87e7acb91',
      email: 'member@example.test',
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
      app_metadata: {},
      user_metadata: {},
      factors: enrolled ? [factor] : [],
    }
  }

  await page.route('**/app/tenant-config.json', (route) => route.fulfill({
    json: { supabaseUrl: origin, supabasePublishableKey: 'sb_publishable_test' },
  }))

  await page.route(origin + '/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
    }
    const respond = (json: unknown, status = 200) => route.fulfill({ json, status, headers })
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers })
    }
    switch (url.pathname) {
      case '/auth/v1/user':
        return expired ? respond({ code: 'session_not_found', message: 'Session expired' }, 401) : respond(user())
      case '/auth/v1/otp':
        signInRequests.push(request.postDataJSON())
        return respond({})
      case '/auth/v1/logout':
        return route.fulfill({ status: 204, headers })
      case '/auth/v1/factors':
        return respond({ id: factor.id, type: 'totp', totp: {
          secret: 'TEST_SETUP_KEY',
          qr_code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>',
        } })
      case '/auth/v1/factors/' + factor.id + '/challenge':
        return respond({ type: 'totp', id: 'test-challenge' })
      case '/auth/v1/factors/' + factor.id + '/verify':
        if (request.postDataJSON().code !== '123456') {
          return respond({ code: 'mfa_verification_failed', message: 'Incorrect code' }, 422)
        }
        enrolled = true
        return respond({ ...tokens('aal2'), user: user() })
      case '/rest/v1/rpc/is_active_member':
      case '/rest/v1/rpc/is_active_member_mfa': {
        const { p_roles } = request.postDataJSON() as { p_roles: string[] }
        return respond(role !== null && p_roles.includes(role))
      }
      default:
        return respond({ message: 'Unexpected mock request' }, 404)
    }
  })

  return {
    revoke: () => { role = null },
    expire: () => { expired = true },
    signInRequests,
  }
}

export async function openWorkspace(page: Page, path?: string) {
  await mockTenant(page)
  await page.goto(signInLink(path))
  await expect(page.getByRole('navigation', { name: 'Client navigation' })).toBeVisible()
}

export async function requestAccessRecheck(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}
