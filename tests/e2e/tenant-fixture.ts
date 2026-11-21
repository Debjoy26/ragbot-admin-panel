import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const origin = 'https://tenant.example'
const factor = { id: 'test-factor' }

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

const bot = { id: '11111111-1111-4111-8111-111111111111', slug: 'support', display_name: 'Website support', enabled: true, settings_version: 3 }

const settingsRow = {
  bot_id: bot.id,
  slug: bot.slug,
  enabled: true,
  settings_version: 3,
  tone: 'helpful',
  scope: 'Answer support questions.',
  max_bytes: 20971520,
  max_pages: 200,
  display_name: 'Website support',
  greeting: 'Hello! How can I help?',
  suggested_questions: ['What are your hours?'],
  primary_color: '#123456',
  position: 'bottom-right',
  privacy_url: null,
  supported_languages: ['en'],
  escalation_label: 'Talk to a person',
  escalation_messages: { en: 'We will help you shortly.' },
  contact_email: null,
  contact_phone: null,
  contact_whatsapp_url: null,
  contact_page_url: null,
  business_hours: null,
  timezone: null,
}

const documentRows = [
  {
    document_id: '22222222-2222-4222-8222-222222222222',
    title: 'Getting started',
    status: 'ready',
    active_version_id: 'a2222222-2222-4222-8222-222222222222',
    latest_version_id: 'a2222222-2222-4222-8222-222222222222',
    latest_version_number: 1,
    latest_version_status: 'ready',
    batches_done: 4,
    batches_total: 4,
    failure_code: null,
  },
  {
    document_id: '33333333-3333-4333-8333-333333333333',
    title: 'Support policies',
    status: 'ready',
    active_version_id: 'a3333333-3333-4333-8333-333333333333',
    latest_version_id: 'a3333333-3333-4333-8333-333333333333',
    latest_version_number: 1,
    latest_version_status: 'ready',
    batches_done: 2,
    batches_total: 2,
    failure_code: null,
  },
  {
    document_id: '44444444-4444-4444-8444-444444444444',
    title: 'Product FAQ',
    status: 'indexing',
    active_version_id: null,
    latest_version_id: 'a4444444-4444-4444-8444-444444444444',
    latest_version_number: 1,
    latest_version_status: 'embedding',
    batches_done: 1,
    batches_total: 5,
    failure_code: null,
  },
]

const memberRows = [
  { user_id: '3da10703-ced6-4086-a532-76d87e7acb91', role: 'admin', active: true, label: 'member@example.test' },
  { user_id: '4eb20703-ced6-4086-a532-76d87e7acb92', role: 'analyst', active: true, label: 'analyst@example.test' },
]

const conversationRows = [
  {
    id: '55555555-5555-4555-8555-555555555555',
    bot_id: bot.id,
    status: 'open',
    created_at: '2026-11-10T10:00:00Z',
    last_message_at: '2026-11-10T10:05:00Z',
  },
]

const messageRows = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    role: 'user',
    content: 'What are your hours?',
    status: 'complete',
    handoff_reason: null,
    created_at: '2026-11-10T10:04:00Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    role: 'assistant',
    content: 'We are open weekdays 9 to 5.',
    status: 'complete',
    handoff_reason: null,
    created_at: '2026-11-10T10:05:00Z',
  },
]

const sourceRows = [{ message_id: '77777777-7777-4777-8777-777777777777', source_label: 'Support policies', excerpt: 'Open weekdays 9 to 5.' }]

const jobRows = [
  { job_type: 'index_document', job_state: 'succeeded', job_count: 5 },
  { job_type: 'index_document', job_state: 'running', job_count: 1 },
]

const usageRows = [
  { usage_day: '2026-11-14', bot_id: bot.id, operation: 'chat', event_count: 12, input_tokens: 1200, output_tokens: 800, estimated_cost: 0.012 },
]

const gapRows = [
  { handoff_reason: 'unknown_hours', question: 'What are your holiday hours?', occurrences: 12, last_seen: '2026-11-10T10:05:00Z' },
  { handoff_reason: 'missing_policy', question: 'What is your refund policy?', occurrences: 7, last_seen: '2026-11-09T09:00:00Z' },
]

const OWNER_ADMIN_RPCS = new Set([
  'admin_update_settings',
  'admin_set_bot_enabled',
  'admin_register_document',
  'admin_add_document_version',
  'admin_complete_upload',
  'admin_retry_version',
  'admin_reindex_document',
  'admin_request_download',
  'admin_delete_document',
  'admin_delete_conversation',
  'admin_list_members',
])

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
      factors: enrolled ? [{ id: factor.id, factor_type: 'totp', status: 'verified', friendly_name: 'Test authenticator' }] : [],
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
      case '/rest/v1/rpc/admin_list_bots':
        return respond([bot])
      case '/rest/v1/rpc/admin_get_settings':
        return respond(settingsRow)
      case '/rest/v1/rpc/admin_update_settings': {
        if (role !== 'owner' && role !== 'admin') {
          return respond({ code: '42501', message: 'not authorized' }, 401)
        }
        const body = request.postDataJSON() as { p_patch?: Record<string, unknown> }
        if (body.p_patch && (body.p_patch as Record<string, unknown>).display_name === 'Trigger stale') {
          return respond({ code: 'RB030', message: 'admin_update_settings: settings changed since they were read (RB030)' }, 409)
        }
        return respond(4)
      }
      case '/rest/v1/rpc/admin_set_bot_enabled':
        if (role !== 'owner' && role !== 'admin') {
          return respond({ code: '42501', message: 'not authorized' }, 401)
        }
        return respond(4)
      case '/rest/v1/rpc/admin_document_status':
        return respond(documentRows)
      case '/rest/v1/rpc/admin_register_document':
        return respond([{ document_id: 'new-doc', version_id: 'new-version', storage_path: bot.id + '/new-doc/new-version/original.md' }])
      case '/rest/v1/rpc/admin_add_document_version':
        return respond([{ version_id: 'new-version', version_number: 2, storage_path: 'path/new-version/original.md' }])
      case '/rest/v1/rpc/admin_complete_upload':
        return respond([{ version_id: 'new-version', status: 'uploaded', job_queued: true }])
      case '/rest/v1/rpc/admin_retry_version':
        return respond([{ version_id: 'retry-version', status: 'uploaded' }])
      case '/rest/v1/rpc/admin_reindex_document':
        return respond([{ version_id: 'reindex-version', version_number: 2 }])
      case '/rest/v1/rpc/admin_request_download':
        return respond(bot.id + '/doc/version/original.md')
      case '/rest/v1/rpc/admin_delete_document':
      case '/rest/v1/rpc/admin_delete_conversation':
        return respond(null)
      case '/rest/v1/rpc/admin_list_members':
        if (role !== 'owner' && role !== 'admin') {
          return respond({ code: '42501', message: 'not authorized' }, 401)
        }
        return respond(memberRows)
      case '/rest/v1/rpc/job_status_summary':
        return respond(jobRows)
      case '/rest/v1/rpc/usage_daily_summary':
        return respond(usageRows)
      case '/rest/v1/rpc/knowledge_gaps':
        return respond(gapRows)
      case '/rest/v1/conversations':
        return respond(conversationRows)
      case '/rest/v1/messages':
        return respond(messageRows)
      case '/rest/v1/message_sources':
        return respond(sourceRows)
      default: {
        if (url.pathname.startsWith('/rest/v1/rpc/') && OWNER_ADMIN_RPCS.has(url.pathname.split('/').pop() ?? '')) {
          if (role !== 'owner' && role !== 'admin') {
            return respond({ code: '42501', message: 'not authorized' }, 401)
          }
        }
        if (url.pathname.startsWith('/storage/v1/object/sign/')) {
          return respond({ signedURL: '/sign/mock-token' })
        }
        if (url.pathname.startsWith('/storage/v1/object/')) {
          return respond({ Key: url.pathname })
        }
        return respond({ message: 'Unexpected mock request' }, 404)
      }
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
