export type ProviderRole = 'provider_admin' | 'provider_operator' | 'provider_support'

export type ProviderError = {
  kind: 'expired' | 'denied' | 'not-found' | 'invalid-input' | 'unavailable' | 'unknown'
  message: string
  status?: number
}

export type ProviderMe = {
  user_id: string
  email: string
  role: ProviderRole
  active: boolean
}

export type ProviderClientSummary = {
  id: string
  name: string
  status: string
  plan: string
  subscription_status: string
  last_seen_at: string | null
}

export type ProviderClientDetail = ProviderClientSummary & {
  deployment_status: string
  enabled: boolean
  subscription_source: string | null
  subscription_updated_at: string | null
}

export type ProviderAuditEntry = {
  id: string
  at: string
  actor: string
  action: string
  client_id: string | null
  result: string
}

export type ProviderStaffRow = {
  user_id: string
  label: string
  role: ProviderRole
  active: boolean
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

function isProviderRole(value: unknown): value is ProviderRole {
  return value === 'provider_admin' || value === 'provider_operator' || value === 'provider_support'
}

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (typeof record.message === 'string' && record.message.trim() !== '') return record.message
    if (typeof record.error === 'string' && record.error.trim() !== '') return record.error
  }
  return fallback
}

export function createProviderApi(
  baseUrl: string,
  getToken: () => Promise<string | null>,
  fetchImpl: FetchImpl = fetch,
) {
  async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const token = await getToken()
    if (!token) {
      throw { kind: 'expired', message: 'Your provider session ended. Sign in again to continue.' } satisfies ProviderError
    }
    let response: Response
    try {
      const requestInit: RequestInit = {
        method: init?.method ?? 'GET',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(15_000),
      }
      if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body)
      response = await fetchImpl(baseUrl + path, requestInit)
    } catch {
      throw { kind: 'unavailable', message: 'The provider API could not be reached. Try again.' } satisfies ProviderError
    }
    if (response.status === 401) {
      throw { kind: 'expired', status: 401, message: 'Your provider session ended. Sign in again to continue.' } satisfies ProviderError
    }
    if (response.status === 403) {
      throw { kind: 'denied', status: 403, message: 'Your provider role does not allow this operation.' } satisfies ProviderError
    }
    if (response.status === 404) {
      throw { kind: 'not-found', status: 404, message: 'The requested provider record was not found.' } satisfies ProviderError
    }
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = null
    }
    if (response.status === 400 || response.status === 422) {
      throw {
        kind: 'invalid-input',
        status: response.status,
        message: messageFromBody(body, 'The provider API rejected the request.'),
      } satisfies ProviderError
    }
    if (response.status >= 500) {
      throw {
        kind: 'unavailable',
        status: response.status,
        message: messageFromBody(body, 'The provider API is unavailable. Try again later.'),
      } satisfies ProviderError
    }
    if (!response.ok) {
      throw {
        kind: 'unknown',
        status: response.status,
        message: messageFromBody(body, 'The provider API returned an unexpected error.'),
      } satisfies ProviderError
    }
    return body as T
  }

  function checkRole(value: unknown): ProviderMe {
    if (!value || typeof value !== 'object') throw { kind: 'unknown', message: 'Unexpected provider response.' } satisfies ProviderError
    const record = value as Record<string, unknown>
    if (typeof record.user_id !== 'string' || typeof record.email !== 'string' || !isProviderRole(record.role)) {
      throw { kind: 'unknown', message: 'Unexpected provider response.' } satisfies ProviderError
    }
    return { user_id: record.user_id, email: record.email, role: record.role, active: record.active !== false }
  }

  return {
    async getMe(): Promise<ProviderMe> {
      return checkRole(await request<unknown>('/v1/me'))
    },
    async listClients(): Promise<ProviderClientSummary[]> {
      const data = await request<unknown>('/v1/clients')
      if (!Array.isArray(data)) throw { kind: 'unknown', message: 'Unexpected provider response.' } satisfies ProviderError
      return data as ProviderClientSummary[]
    },
    async getClient(id: string): Promise<ProviderClientDetail> {
      return (await request<unknown>('/v1/clients/' + encodeURIComponent(id))) as ProviderClientDetail
    },
    async suspendClient(id: string): Promise<void> {
      await request<unknown>('/v1/clients/' + encodeURIComponent(id) + '/suspend', { method: 'POST', body: {} })
    },
    async restoreClient(id: string): Promise<void> {
      await request<unknown>('/v1/clients/' + encodeURIComponent(id) + '/restore', { method: 'POST', body: {} })
    },
    async listAudit(limit = 50): Promise<ProviderAuditEntry[]> {
      const data = await request<unknown>('/v1/audit?limit=' + Math.max(1, Math.min(200, limit)))
      if (!Array.isArray(data)) throw { kind: 'unknown', message: 'Unexpected provider response.' } satisfies ProviderError
      return data as ProviderAuditEntry[]
    },
    async listStaff(): Promise<ProviderStaffRow[]> {
      const data = await request<unknown>('/v1/staff')
      if (!Array.isArray(data)) throw { kind: 'unknown', message: 'Unexpected provider response.' } satisfies ProviderError
      return data as ProviderStaffRow[]
    },
  }
}

export type ProviderApi = ReturnType<typeof createProviderApi>
