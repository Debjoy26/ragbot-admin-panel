type AuthCallback =
  | { kind: 'none' | 'invalid' }
  | { kind: 'tokens'; access_token: string; refresh_token: string }

export function takeAuthCallback(): AuthCallback {
  const url = new URL(window.location.href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const authFields = ['access_token', 'refresh_token', 'error', 'error_code', 'error_description']
  const hasAuthCallback = authFields.some((field) => fragment.has(field) || url.searchParams.has(field))
  if (!hasAuthCallback) return { kind: 'none' }

  url.hash = ''
  for (const field of [...authFields, 'type', 'token_type', 'expires_at', 'expires_in']) {
    url.searchParams.delete(field)
  }
  window.history.replaceState(window.history.state, '', url)

  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  if (accessToken && refreshToken && ['invite', 'magiclink'].includes(fragment.get('type') ?? '')) {
    return { kind: 'tokens', access_token: accessToken, refresh_token: refreshToken }
  }
  return { kind: 'invalid' }
}
