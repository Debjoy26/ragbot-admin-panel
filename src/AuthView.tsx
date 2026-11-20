import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Access } from './client-auth'

export function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = title + ' | RAGbot Admin'
  }, [title])

  return (
    <main className="auth-page">
      <section className="panel auth-panel" aria-labelledby="auth-heading">
        <p className="auth-brand">RAGbot Admin</p>
        <h1 id="auth-heading">{title}</h1>
        {children}
      </section>
    </main>
  )
}

function EmailSignIn({ client, expired }: { client: SupabaseClient; expired: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state === 'sending') return
    const email = String(new FormData(event.currentTarget).get('email')).trim()
    const emailRedirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href
    setState('sending')
    try {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo },
      })
      setState(error ? 'failed' : 'sent')
    } catch {
      setState('failed')
    }
  }

  return (
    <AuthPage title="Sign in">
      {expired && <p role="alert">Your session ended. Sign in again to continue.</p>}
      <p>Enter your invited email address to request a sign-in link.</p>
      <form onSubmit={(event) => void sendLink(event)}>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <button disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send sign-in link'}</button>
      </form>
      {state === 'sent' && <p role="status">Check your email for the sign-in link.</p>}
      {state === 'failed' && <p role="alert">Could not send a sign-in link. Check your address or try again later.</p>}
    </AuthPage>
  )
}

function MfaForm({ client, factors, signOut }: {
  client: SupabaseClient
  factors: Extract<Access, { kind: 'mfa' }>['factors']
  signOut: () => void
}) {
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function enroll() {
    setError('')
    setPending(true)
    try {
      const result = await client.auth.mfa.enroll({ factorType: 'totp' })
      if (result.error) throw result.error
      setEnrollment({ id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret })
    } catch {
      setError('Could not set up an authenticator. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const factorId = enrollment?.id ?? String(form.get('factor'))
    setError('')
    setPending(true)
    try {
      const result = await client.auth.mfa.challengeAndVerify({ factorId, code: String(form.get('code')).trim() })
      if (result.error) throw result.error
    } catch {
      setError('Could not verify that code. Try a new code from your authenticator.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthPage title={factors.length ? 'Verify your sign-in' : 'Set up an authenticator'}>
      {factors.length === 0 && !enrollment && (
        <>
          <p>Connect an authenticator app to secure your workspace.</p>
          <button type="button" disabled={pending} onClick={() => void enroll()}>Set up authenticator</button>
        </>
      )}
      {enrollment && (
        <>
          <p>Scan this QR code in your authenticator app.</p>
          {enrollment.qr.startsWith('data:image/svg+xml;utf-8,') && (
            <img className="auth-qr" src={enrollment.qr} alt="Authenticator setup QR code" />
          )}
          <details><summary>Enter the setup key manually</summary><code>{enrollment.secret}</code></details>
        </>
      )}
      {(factors.length > 0 || enrollment) && (
        <form onSubmit={(event) => void verify(event)}>
          {!enrollment && (
            <>
              <label htmlFor="factor">Authenticator</label>
              <select id="factor" name="factor">
                {factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.label}</option>)}
              </select>
            </>
          )}
          <label htmlFor="code">Authenticator code</label>
          <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required />
          <button disabled={pending}>Verify code</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="auth-secondary" disabled={pending} onClick={signOut}>Sign out</button>
    </AuthPage>
  )
}

export function AuthView({ client, access, signOut }: {
  client: SupabaseClient
  access: Exclude<Access, { kind: 'authorized' }>
  signOut: () => void
}) {
  switch (access.kind) {
    case 'checking':
      return <AuthPage title="Checking access"><p role="status">Verifying your workspace session…</p></AuthPage>
    case 'mfa':
      return <MfaForm client={client} factors={access.factors} signOut={signOut} />
    case 'denied':
      return <AuthPage title="Access denied">
        <p role="alert">Your account doesn’t have an active membership in this workspace.</p>
        <button type="button" onClick={signOut}>Sign out</button>
      </AuthPage>
    case 'unavailable':
      return <AuthPage title="Access check unavailable">
        <p role="alert">Workspace access couldn’t be verified. Try signing in again.</p>
        <button type="button" onClick={signOut}>Sign out</button>
      </AuthPage>
    default:
      return <EmailSignIn client={client} expired={access.kind === 'expired'} />
  }
}
