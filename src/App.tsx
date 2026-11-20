import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes } from 'react-router'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ConversationsScreen,
  DocumentsScreen,
  IndexingScreen,
  MembersScreen,
  OverviewScreen,
  SettingsScreen,
  UsageScreen,
} from './admin-screens'
import { AuthView } from './AuthView'
import { useClientAccess } from './client-auth'
import type { TenantRole } from './client-auth'
import { canOpenScreen, groups, screens } from './navigation'

function ClientShell({ role, signOut }: {
  role: TenantRole
  signOut: () => void
}) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link to="/" className="brand">RAGbot <span>Admin</span></Link>
        <nav aria-label="Client navigation">
          <NavLink to="/" end>Overview</NavLink>
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <h2>{group.label}</h2>
              <ul>
                {group.screens.filter((screen) => canOpenScreen(screen, role)).map(({ path, label }) => (
                  <li key={path}><NavLink to={path}>{label}</NavLink></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Client workspace · {role}</span>
          <button type="button" onClick={signOut}>Sign out</button>
        </header>
        <main id="main-content" className="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function ScreenHeading({ title, children }: { title: string; children: ReactNode }) {
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

function Placeholder({ title, summary, availability }: {
  title: string
  summary: string
  availability: string
}) {
  return (
    <>
      <ScreenHeading title={title}>{summary}</ScreenHeading>
      <section className="panel" aria-labelledby="setup-heading">
        <h2 id="setup-heading">Setup status</h2>
        <p>{availability}</p>
      </section>
    </>
  )
}

function NotFound() {
  return (
    <>
      <ScreenHeading title="Page not found">Check the address or return to your workspace.</ScreenHeading>
      <Link to="/">Back to overview</Link>
    </>
  )
}

function LiveRoute({ screen, role, client }: {
  screen: { path: string }
  role: TenantRole
  client: SupabaseClient
}) {
  switch (screen.path) {
    case 'settings':
      return <SettingsScreen client={client} role={role} />
    case 'conversations':
      return <ConversationsScreen client={client} role={role} />
    case 'usage':
      return <UsageScreen client={client} />
    case 'members':
      return <MembersScreen client={client} />
    case 'knowledge/documents':
      return <DocumentsScreen client={client} role={role} />
    case 'knowledge/indexing':
      return <IndexingScreen client={client} />
    default:
      return null
  }
}

const LIVE_PATHS = new Set([
  'settings',
  'conversations',
  'usage',
  'members',
  'knowledge/documents',
  'knowledge/indexing',
])

export function App({ client }: { client: SupabaseClient }) {
  const { access, signOut } = useClientAccess(client)
  const handleSignOut = () => void signOut()
  useEffect(() => {
    document.title = 'Overview | RAGbot Admin'
  }, [])
  if (access.kind !== 'authorized') {
    return <AuthView client={client} access={access} signOut={handleSignOut} />
  }

  return (
    <Routes>
      <Route element={<ClientShell role={access.role} signOut={handleSignOut} />}>
        <Route index element={<OverviewScreen client={client} />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        {screens.map((screen) => (
          <Route key={screen.path} path={screen.path} element={
            canOpenScreen(screen, access.role)
              ? LIVE_PATHS.has(screen.path)
                ? <LiveRoute screen={screen} role={access.role} client={client} />
                : <Placeholder title={screen.label} summary={screen.summary} availability={screen.availability} />
              : <ScreenHeading title="Permission denied">Your role does not have access to this page.</ScreenHeading>
          } />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
