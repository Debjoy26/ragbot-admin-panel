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

export function EmailSignIn({ client, expired, redirectPath, title, allowSignup = true }: {
  client: SupabaseClient
  expired: boolean
  redirectPath?: string
  title?: string
  allowSignup?: boolean
}) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'check-email' | 'reset-sent'>('signin')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const emailRedirectTo = new URL(redirectPath ?? import.meta.env.BASE_URL, window.location.origin).href

  function friendly(message: string): string {
    if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.'
    if (/user already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.'
    return message || 'Something went wrong. Try again.'
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const { error: authError } = await client.auth.signInWithPassword({
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      })
      if (authError) setError(friendly(authError.message))
    } catch {
      setError('Could not sign in. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const { data, error: authError } = await client.auth.signUp({
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
        options: { emailRedirectTo },
      })
      if (authError) {
        setError(friendly(authError.message))
      } else if (!data.session) {
        setMode('check-email')
      }
    } catch {
      setError('Could not create the account. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const { error: authError } = await client.auth.resetPasswordForEmail(String(form.get('email')).trim(), {
        redirectTo: emailRedirectTo,
      })
      if (authError) setError(friendly(authError.message))
      else setMode('reset-sent')
    } catch {
      setError('Could not send the reset email. Try again.')
    } finally {
      setPending(false)
    }
  }

  function switchMode(next: 'signin' | 'signup' | 'reset') {
    setMode(next)
    setError('')
  }

  if (mode === 'check-email') {
    return (
      <AuthPage title={title ?? 'Sign in'}>
        <p role="status">Account created. Check your email to confirm it, then sign in. Your provider administrator must activate your membership before you can access the workspace.</p>
        <button type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
      </AuthPage>
    )
  }

  if (mode === 'reset-sent') {
    return (
      <AuthPage title={title ?? 'Sign in'}>
        <p role="status">If an account exists for that email, a password-reset link is on its way.</p>
        <button type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
      </AuthPage>
    )
  }

  return (
    <AuthPage title={title ?? 'Sign in'}>
      {expired && <p role="alert">Your session ended. Sign in again to continue.</p>}
      {mode === 'signin' && (
        <>
          <p>Sign in with your email and password, then complete MFA if asked.</p>
          <form onSubmit={(event) => void signIn(event)}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
            <button disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {allowSignup && <button type="button" className="auth-secondary" onClick={() => switchMode('signup')}>Create an account</button>}
          <button type="button" className="auth-secondary" onClick={() => switchMode('reset')}>Forgot your password?</button>
        </>
      )}
      {mode === 'signup' && (
        <>
          <p>Create an account. It stays inactive until your provider administrator activates your membership.</p>
          <form onSubmit={(event) => void signUp(event)}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
            <button disabled={pending}>{pending ? 'Creating…' : 'Create account'}</button>
          </form>
          <button type="button" className="auth-secondary" onClick={() => switchMode('signin')}>Back to sign in</button>
        </>
      )}
      {mode === 'reset' && (
        <>
          <p>Enter your email to receive a password-reset link.</p>
          <form onSubmit={(event) => void reset(event)}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
            <button disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button>
          </form>
          <button type="button" className="auth-secondary" onClick={() => switchMode('signin')}>Back to sign in</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </AuthPage>
  )
}

export function MfaForm({ client, factors, signOut }: {
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
        <p role="alert">Your account doesn’t have an active membership in this workspace. Ask your provider administrator to activate it.</p>
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
