import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { ProviderApi, ProviderError, ProviderRole } from './provider-api'
import type { ProviderConfig } from './provider-config'

export type { ProviderRole }

type Factor = { id: string; label: string }

export type ProviderAccess =
  | { kind: 'checking' | 'signed-out' | 'expired' | 'denied' | 'unavailable' }
  | { kind: 'mfa'; factors: Factor[] }
  | { kind: 'authorized'; role: ProviderRole; email: string }

export function createProviderClient(config: ProviderConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    global: {
      fetch: (input, init) => {
        const timeout = AbortSignal.timeout(10_000)
        const signal = init?.signal ? AbortSignal.any([timeout, init.signal]) : timeout
        return fetch(input, { ...init, signal })
      },
    },
    auth: {
      flowType: 'implicit',
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function toAccessFailure(error: unknown): ProviderAccess {
  const failure = error as Partial<ProviderError>
  if (failure?.kind === 'expired') return { kind: 'expired' }
  if (failure?.kind === 'denied') return { kind: 'denied' }
  return { kind: 'unavailable' }
}

async function checkProviderAccess(api: ProviderApi, client: SupabaseClient, session: Session): Promise<ProviderAccess> {
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
  if (assurance.error) return { kind: assurance.error.status === 401 ? 'expired' : 'unavailable' }

  if (assurance.data.currentLevel === 'aal2') {
    try {
      const me = await api.getMe()
      if (!me.active) return { kind: 'denied' }
      return { kind: 'authorized', role: me.role, email: me.email }
    } catch (error) {
      return toAccessFailure(error)
    }
  }

  if (assurance.data.currentLevel !== 'aal1') return { kind: 'denied' }
  const factors = await client.auth.mfa.listFactors()
  if (factors.error) return { kind: 'unavailable' }
  return {
    kind: 'mfa',
    factors: factors.data.totp.map((factor, index) => ({
      id: factor.id,
      label: factor.friendly_name || 'Authenticator ' + (index + 1),
    })),
  }
}

export function useProviderAccess(api: ProviderApi, client: SupabaseClient) {
  const [access, setAccess] = useState<ProviderAccess>({ kind: 'checking' })
  const signingOut = useRef(false)

  useEffect(() => {
    let session: Session | null = null
    let generation = 0
    let pending = false
    let disposed = false
    let queued: ReturnType<typeof setTimeout> | undefined

    async function recheck() {
      if (!session || pending || disposed || signingOut.current) return
      const id = ++generation
      pending = true
      let result: ProviderAccess
      try {
        result = await checkProviderAccess(api, client, session)
      } catch {
        result = { kind: 'unavailable' }
      }
      if (id === generation && !signingOut.current) {
        pending = false
        setAccess(result)
      }
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      if (disposed || (signingOut.current && next)) return
      if (next && session?.access_token === next.access_token && event === 'SIGNED_IN') return
      const hadSession = Boolean(session)
      if (queued !== undefined) clearTimeout(queued)
      generation++
      pending = false
      session = next
      if (!next) {
        setAccess({ kind: hadSession && !signingOut.current ? 'expired' : 'signed-out' })
        signingOut.current = false
        return
      }
      setAccess({ kind: 'checking' })
      queued = setTimeout(() => void recheck(), 0)
    })

    const interval = setInterval(() => void recheck(), 30_000)
    const onFocus = () => void recheck()
    window.addEventListener('focus', onFocus)
    return () => {
      disposed = true
      generation++
      if (queued !== undefined) clearTimeout(queued)
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      subscription.unsubscribe()
    }
  }, [api, client])

  async function signOut() {
    if (signingOut.current) return
    signingOut.current = true
    setAccess({ kind: 'checking' })
    try {
      const result = await client.auth.signOut({ scope: 'local' })
      if (result.error) window.location.replace(import.meta.env.BASE_URL + 'provider')
    } catch {
      window.location.replace(import.meta.env.BASE_URL + 'provider')
    }
  }

  return { access, signOut }
}
