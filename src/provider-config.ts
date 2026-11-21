export type ProviderConfig = {
  apiBaseUrl: string
  supabaseUrl: string
  supabasePublishableKey: string
}

function parseOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) return null
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return url.origin
  } catch {
    return null
  }
}

export function parseProviderConfig(value: unknown): ProviderConfig | null {
  if (!value || typeof value !== 'object') return null

  const { apiBaseUrl, supabaseUrl, supabasePublishableKey } = value as Partial<ProviderConfig>
  const api = parseOrigin(apiBaseUrl)
  const supabase = parseOrigin(supabaseUrl)
  if (!api || !supabase) return null
  if (typeof supabasePublishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(supabasePublishableKey)) {
    return null
  }
  return { apiBaseUrl: api, supabaseUrl: supabase, supabasePublishableKey }
}

export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'provider-config.json', {
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(8_000),
    })
    return response.ok ? parseProviderConfig(await response.json()) : null
  } catch {
    return null
  }
}
