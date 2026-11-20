export type TenantConfig = {
  supabaseUrl: string
  supabasePublishableKey: string
}

export function parseTenantConfig(value: unknown): TenantConfig | null {
  if (!value || typeof value !== 'object') return null

  const { supabaseUrl, supabasePublishableKey } = value as Partial<TenantConfig>
  if (typeof supabaseUrl !== 'string' || typeof supabasePublishableKey !== 'string') return null
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(supabasePublishableKey)) return null

  try {
    const url = new URL(supabaseUrl)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) return null
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return { supabaseUrl: url.origin, supabasePublishableKey }
  } catch {
    return null
  }
}

export async function loadTenantConfig() {
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'tenant-config.json', {
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(8_000),
    })
    return response.ok ? parseTenantConfig(await response.json()) : null
  } catch {
    return null
  }
}
