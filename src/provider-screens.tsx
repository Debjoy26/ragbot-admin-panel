import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, Route, Routes, useParams } from 'react-router'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AuthPage, EmailSignIn, MfaForm } from './AuthView'
import { createProviderApi } from './provider-api'
import type { ProviderApi, ProviderError, ProviderRole } from './provider-api'
import { useProviderAccess } from './provider-auth'
import type { ProviderAccess } from './provider-auth'
import type { ProviderConfig } from './provider-config'

const PROVIDER_PATH = import.meta.env.BASE_URL + 'provider'

function useReload(): [number, () => void] {
  const [generation, setGeneration] = useState(0)
  return [generation, () => setGeneration((value) => value + 1)]
}

function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="notice">
      {label}
    </p>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="notice">{text}</p>
}

function providerErrorMessage(error: ProviderError): string {
  switch (error.kind) {
    case 'expired':
      return 'Your provider session ended. Sign in again to continue.'
    case 'denied':
      return 'Your provider role does not allow this operation.'
    case 'not-found':
      return 'The requested provider record was not found.'
    case 'invalid-input':
      return error.message
    case 'unavailable':
      return 'The provider API could not be reached. Try again.'
    default:
      return 'The provider API returned an unexpected error.'
  }
}

function ErrorBox({ error, onRetry }: { error: ProviderError; onRetry?: () => void }) {
  return (
    <div role="alert" className="error-box">
      <p>{providerErrorMessage(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function ScreenHeading({ title, children }: { title: string; children: string }) {
  useEffect(() => {
    document.title = title + ' | RAGbot Admin'
  }, [title])
  return (
    <header className="screen-heading">
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  )
}

function ProviderShell({ role, email, signOut }: {
  role: ProviderRole
  email: string
  signOut: () => void
}) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/provider" className="brand">
          RAGbot <span>Superadmin</span>
        </Link>
        <nav aria-label="Provider navigation">
          <Link to="/provider">Client registry</Link>
          <Link to="/provider/audit">Provider audit</Link>
          <Link to="/provider/staff">Provider staff</Link>
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Provider · {role} · {email}
          </span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </header>
        <main id="main-content" className="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function RegistryScreen({ api }: { api: ProviderApi }) {
  const [reloadKey, reload] = useReload()
  const [rows, setRows] = useState<Awaited<ReturnType<ProviderApi['listClients']>> | null>(null)
  const [error, setError] = useState<ProviderError | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    api
      .listClients()
      .then((result) => {
        if (!cancelled) setRows(result)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure as ProviderError)
      })
    return () => {
      cancelled = true
    }
  }, [api, reloadKey])

  const filtered = (rows ?? []).filter((row) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return row.name.toLowerCase().includes(query) || row.id.toLowerCase().includes(query)
  })

  return (
    <>
      <ScreenHeading title="Client registry">Every client tenant, status, and subscription state.</ScreenHeading>
      <section className="panel" aria-labelledby="registry-heading">
        <div className="panel-heading">
          <h2 id="registry-heading">Clients</h2>
          <button type="button" onClick={reload}>
            Refresh
          </button>
        </div>
        <div className="toolbar">
          <label htmlFor="registry-search">Search</label>
          <input
            id="registry-search"
            value={search}
            placeholder="Filter by name or id"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!error && !rows && <Loading label="Loading client registry…" />}
        {!error && rows && filtered.length === 0 && <Empty text="No clients registered." />}
        {!error && rows && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Subscription</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Open</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      <span className="status" data-status={row.status}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.plan}</td>
                    <td>{row.subscription_status}</td>
                    <td>{formatDateTime(row.last_seen_at)}</td>
                    <td>
                      <Link to={'/provider/clients/' + encodeURIComponent(row.id)}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function ClientDetailScreen({ api, role }: { api: ProviderApi; role: ProviderRole }) {
  const { id } = useParams()
  const [reloadKey, reload] = useReload()
  const [detail, setDetail] = useState<Awaited<ReturnType<ProviderApi['getClient']>> | null>(null)
  const [error, setError] = useState<ProviderError | null>(null)
  const [actionError, setActionError] = useState<ProviderError | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const canMutate = role === 'provider_admin'

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setDetail(null)
    setError(null)
    api
      .getClient(decodeURIComponent(id))
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure as ProviderError)
      })
    return () => {
      cancelled = true
    }
  }, [api, id, reloadKey])

  async function runAction(kind: 'suspend' | 'restore') {
    if (!id || busy) return
    const target = detail?.name ?? decodeURIComponent(id)
    const confirmed = window.confirm(
      kind === 'suspend'
        ? 'Suspend service for "' + target + '"? Its bots stop serving visitors immediately.'
        : 'Restore service for "' + target + '"?',
    )
    if (!confirmed) return
    setBusy(true)
    setActionError(null)
    setNotice('')
    try {
      if (kind === 'suspend') await api.suspendClient(decodeURIComponent(id))
      else await api.restoreClient(decodeURIComponent(id))
      setNotice(kind === 'suspend' ? 'Suspension recorded.' : 'Service restored.')
      reload()
    } catch (failure) {
      setActionError(failure as ProviderError)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!detail) return <Loading label="Loading client detail…" />

  return (
    <>
      <ScreenHeading title={detail.name}>Deployment, subscription, and lifecycle for this client.</ScreenHeading>
      {actionError && <ErrorBox error={actionError} />}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <dl className="metrics">
        <div>
          <dt>Status</dt>
          <dd>{detail.status}</dd>
        </div>
        <div>
          <dt>Deployment</dt>
          <dd>{detail.deployment_status}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{detail.plan}</dd>
        </div>
        <div>
          <dt>Subscription</dt>
          <dd>{detail.subscription_status}</dd>
        </div>
        <div>
          <dt>Enabled</dt>
          <dd>{detail.enabled ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <section className="panel" aria-labelledby="lifecycle-heading">
        <h2 id="lifecycle-heading">Lifecycle</h2>
        {!canMutate && <p className="hint">Only provider admins can suspend or restore service. Operators and support are read-only.</p>}
        {canMutate && (
          <div className="row-actions">
            <button type="button" disabled={busy} onClick={() => void runAction(detail.enabled ? 'suspend' : 'restore')}>
              {busy ? 'Working…' : detail.enabled ? 'Suspend service' : 'Restore service'}
            </button>
            <button type="button" onClick={reload}>
              Refresh
            </button>
          </div>
        )}
        <p className="hint">Every lifecycle change is written to the provider audit log by the provider API.</p>
      </section>
      <Link to="/provider">Back to registry</Link>
    </>
  )
}

function AuditScreen({ api }: { api: ProviderApi }) {
  const [reloadKey, reload] = useReload()
  const [rows, setRows] = useState<Awaited<ReturnType<ProviderApi['listAudit']>> | null>(null)
  const [error, setError] = useState<ProviderError | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    api
      .listAudit(50)
      .then((result) => {
        if (!cancelled) setRows(result)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure as ProviderError)
      })
    return () => {
      cancelled = true
    }
  }, [api, reloadKey])

  return (
    <>
      <ScreenHeading title="Provider audit">Every provider mutation, actor, target, and outcome.</ScreenHeading>
      <section className="panel" aria-labelledby="audit-heading">
        <div className="panel-heading">
          <h2 id="audit-heading">Recent entries</h2>
          <button type="button" onClick={reload}>
            Refresh
          </button>
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!error && !rows && <Loading label="Loading audit entries…" />}
        {!error && rows && rows.length === 0 && <Empty text="No audit entries recorded." />}
        {!error && rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Client</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.at)}</td>
                    <td>{row.actor}</td>
                    <td>{row.action}</td>
                    <td>{row.client_id ?? '—'}</td>
                    <td>{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function StaffScreen({ api }: { api: ProviderApi }) {
  const [reloadKey, reload] = useReload()
  const [rows, setRows] = useState<Awaited<ReturnType<ProviderApi['listStaff']>> | null>(null)
  const [error, setError] = useState<ProviderError | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    api
      .listStaff()
      .then((result) => {
        if (!cancelled) setRows(result)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure as ProviderError)
      })
    return () => {
      cancelled = true
    }
  }, [api, reloadKey])

  return (
    <>
      <ScreenHeading title="Provider staff">Staff roles are read-only here; changes go through the provider API owner process.</ScreenHeading>
      <section className="panel" aria-labelledby="staff-heading">
        <div className="panel-heading">
          <h2 id="staff-heading">Staff list</h2>
          <button type="button" onClick={reload}>
            Refresh
          </button>
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!error && !rows && <Loading label="Loading staff…" />}
        {!error && rows && rows.length === 0 && <Empty text="No staff found." />}
        {!error && rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Role</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user_id}>
                    <td>{row.label}</td>
                    <td>{row.role}</td>
                    <td>{row.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function ProviderAuthView({ client, access, signOut }: {
  client: SupabaseClient
  access: Exclude<ProviderAccess, { kind: 'authorized' }>
  signOut: () => void
}) {
  switch (access.kind) {
    case 'checking':
      return (
        <AuthPage title="Checking access">
          <p role="status">Verifying your provider session…</p>
        </AuthPage>
      )
    case 'mfa':
      return <MfaForm client={client} factors={access.factors} signOut={signOut} />
    case 'denied':
      return (
        <AuthPage title="Access denied">
          <p role="alert">Your account doesn’t have an active provider role.</p>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </AuthPage>
      )
    case 'unavailable':
      return (
        <AuthPage title="Access check unavailable">
          <p role="alert">Provider access couldn’t be verified. Try signing in again.</p>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </AuthPage>
      )
    default:
      return <EmailSignIn client={client} expired={access.kind === 'expired'} redirectPath={PROVIDER_PATH} title="Provider sign in" allowSignup={false} />
  }
}

export function ProviderApp({ config, client }: { config: ProviderConfig; client: SupabaseClient }) {
  const api = useMemo(
    () =>
      createProviderApi(config.apiBaseUrl, async () => (await client.auth.getSession()).data.session?.access_token ?? null),
    [client, config],
  )
  const { access, signOut } = useProviderAccess(api, client)
  const handleSignOut = () => void signOut()

  if (access.kind !== 'authorized') {
    return <ProviderAuthView client={client} access={access} signOut={handleSignOut} />
  }

  return (
    <Routes>
      <Route element={<ProviderShell role={access.role} email={access.email} signOut={handleSignOut} />}>
        <Route index element={<RegistryScreen api={api} />} />
        <Route path="provider" element={<RegistryScreen api={api} />} />
        <Route path="provider/clients/:id" element={<ClientDetailScreen api={api} role={access.role} />} />
        <Route path="provider/audit" element={<AuditScreen api={api} />} />
        <Route path="provider/staff" element={<StaffScreen api={api} />} />
        <Route
          path="*"
          element={
            <>
              <ScreenHeading title="Page not found">Check the address or return to the registry.</ScreenHeading>
              <Link to="/provider">Back to registry</Link>
            </>
          }
        />
      </Route>
    </Routes>
  )
}
