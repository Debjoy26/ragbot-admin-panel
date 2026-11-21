import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const staffOrigin = 'https://staff.example'
const apiOrigin = 'https://provider-api.example'
const factor = { id: 'test-factor' }

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function tokens(aal: 'aal1' | 'aal2') {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const accessToken = [encode({ alg: 'HS256', typ: 'JWT' }), encode({ aal, exp: expiresAt }), 'c2ln'].join('.')
  return { access_token: accessToken, refresh_token: 'test-refresh', expires_at: expiresAt, expires_in: 3600, token_type: 'bearer' }
}

export function providerSignInLink(path = '/app/provider', aal: 'aal1' | 'aal2' = 'aal2') {
  const { access_token, refresh_token } = tokens(aal)
  return path + '#' + new URLSearchParams({ access_token, refresh_token, type: 'magiclink' })
}

const clients = [
  { id: 'client-a', name: 'Acme Co', status: 'active', plan: 'growth', subscription_status: 'active', last_seen_at: '2026-11-20T10:00:00Z' },
  { id: 'client-b', name: 'Beta Ltd', status: 'suspended', plan: 'starter', subscription_status: 'past_due', last_seen_at: '2026-11-18T09:00:00Z' },
]

const detail = {
  ...clients[0],
  deployment_status: 'healthy',
  enabled: true,
  subscription_source: 'provider',
  subscription_updated_at: '2026-11-01T00:00:00Z',
}

const audit = [
  { id: 'a1', at: '2026-11-20T10:00:00Z', actor: 'op@example.test', action: 'client.restore', client_id: 'client-a', result: 'ok' },
]

const staff = [
  { user_id: 's1', label: 'op@example.test', role: 'provider_admin', active: true },
  { user_id: 's2', label: 'support@example.test', role: 'provider_support', active: true },
]

export async function mockProvider(page: Page, options: {
  role?: 'provider_admin' | 'provider_operator' | 'provider_support' | null
  enrolled?: boolean
} = {}) {
  const role = options.role === undefined ? 'provider_admin' : options.role
  let enrolled = options.enrolled ?? true
  const calls: string[] = []

  function user() {
    return {
      id: 's1',
      email: 'op@example.test',
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
      app_metadata: {},
      user_metadata: {},
      factors: enrolled ? [{ id: factor.id, factor_type: 'totp', status: 'verified', friendly_name: 'Test authenticator' }] : [],
    }
  }

  await page.route('**/app/provider-config.json', (route) => route.fulfill({
    json: { apiBaseUrl: apiOrigin, supabaseUrl: staffOrigin, supabasePublishableKey: 'sb_publishable_test' },
  }))

  await page.route(staffOrigin + '/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
    }
    const respond = (json: unknown, status = 200) => route.fulfill({ json, status, headers })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    switch (url.pathname) {
      case '/auth/v1/user':
        return respond(user())
      case '/auth/v1/otp':
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
      default:
        return respond({ message: 'Unexpected mock request' }, 404)
    }
  })

  await page.route(apiOrigin + '/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
    }
    const respond = (json: unknown, status = 200) => route.fulfill({ json, status, headers })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname === '/v1/me') {
      if (!role) return respond({ message: 'forbidden' }, 403)
      return respond({ user_id: 's1', email: 'op@example.test', role, active: true })
    }
    if (url.pathname === '/v1/clients') return respond(clients)
    if (url.pathname === '/v1/clients/client-a' && request.method() === 'GET') return respond(detail)
    if (url.pathname === '/v1/clients/client-a/suspend' && request.method() === 'POST') {
      calls.push('suspend')
      return respond({})
    }
    if (url.pathname === '/v1/clients/client-a/restore' && request.method() === 'POST') {
      calls.push('restore')
      return respond({})
    }
    if (url.pathname === '/v1/audit') return respond(audit)
    if (url.pathname === '/v1/staff') return respond(staff)
    return respond({ message: 'Unexpected mock request' }, 404)
  })

  return { calls }
}

export async function openProvider(page: Page, path = '/app/provider') {
  await mockProvider(page)
  await page.goto(providerSignInLink(path))
  await expect(page.getByRole('navigation', { name: 'Provider navigation' })).toBeVisible()
}
