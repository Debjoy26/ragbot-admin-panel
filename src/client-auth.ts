import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { TenantConfig } from './tenant-config'

export const roles = ['owner', 'admin', 'analyst'] as const
export type TenantRole = typeof roles[number]
type Factor = { id: string; label: string }

export type Access =
  | { kind: 'checking' | 'signed-out' | 'expired' | 'denied' | 'unavailable' }
  | { kind: 'mfa'; factors: Factor[] }
  | { kind: 'authorized'; role: TenantRole }

export function createTenantClient(config: TenantConfig) {
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

async function checkAccess(client: SupabaseClient, session: Session): Promise<Access> {
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
  if (assurance.error) return { kind: assurance.error.status === 401 ? 'expired' : 'unavailable' }

  if (assurance.data.currentLevel === 'aal2') {
    const matches = await Promise.all(roles.map(async (role) => {
      const { data, error } = await client.rpc('is_active_member_mfa', { p_roles: [role] })
      if (error || typeof data !== 'boolean') throw new Error('Membership check failed')
      return data ? role : null
    }))
    const activeRoles = matches.filter((match) => match !== null)
    const [role] = activeRoles
    return activeRoles.length === 1 && role ? { kind: 'authorized', role } : { kind: 'denied' }
  }

  if (assurance.data.currentLevel !== 'aal1') return { kind: 'denied' }
  const membership = await client.rpc('is_active_member', { p_roles: [...roles] })
  if (membership.error || typeof membership.data !== 'boolean') return { kind: 'unavailable' }
  if (!membership.data) return { kind: 'denied' }

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

export function useClientAccess(client: SupabaseClient) {
  const [access, setAccess] = useState<Access>({ kind: 'checking' })
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
      let result: Access
      try {
        result = await checkAccess(client, session)
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
      // Defer async Auth calls until after the SDK releases its auth lock.
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
  }, [client])

  async function signOut() {
    if (signingOut.current) return
    signingOut.current = true
    setAccess({ kind: 'checking' })
    try {
      const result = await client.auth.signOut({ scope: 'local' })
      if (result.error) window.location.replace(import.meta.env.BASE_URL)
    } catch {
      window.location.replace(import.meta.env.BASE_URL)
    }
  }

  return { access, signOut }
}
