import { describe, expect, it } from 'vitest'
import { createProviderApi } from './provider-api'

function stubFetch(status: number, body: unknown) {
  return async () =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
}

const token = async () => 'test-token'

describe('provider api errors', () => {
  it('maps 401 to an expired session and 403 to denied', async () => {
    const expired = createProviderApi('https://provider.example', token, stubFetch(401, { message: 'x' }))
    await expect(expired.getMe()).rejects.toMatchObject({ kind: 'expired' })
    const denied = createProviderApi('https://provider.example', token, stubFetch(403, { message: 'x' }))
    await expect(denied.listClients()).rejects.toMatchObject({ kind: 'denied' })
  })

  it('maps network failures to unavailable and requires a token', async () => {
    const offline = createProviderApi('https://provider.example', token, async () => {
      throw new Error('down')
    })
    await expect(offline.listClients()).rejects.toMatchObject({ kind: 'unavailable' })
    const anonymous = createProviderApi('https://provider.example', async () => null, stubFetch(200, []))
    await expect(anonymous.listClients()).rejects.toMatchObject({ kind: 'expired' })
  })

  it('returns typed payloads on success', async () => {
    const me = { user_id: 'u1', email: 'op@example.test', role: 'provider_admin', active: true }
    const api = createProviderApi('https://provider.example', token, stubFetch(200, me))
    await expect(api.getMe()).resolves.toEqual(me)
  })
})
