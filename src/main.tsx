import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import type { SupabaseClient } from '@supabase/supabase-js'
import { App } from './App'
import { AuthPage } from './AuthView'
import { takeAuthCallback } from './auth-callback'
import { createTenantClient } from './client-auth'
import { createProviderClient } from './provider-auth'
import { loadProviderConfig } from './provider-config'
import { loadTenantConfig } from './tenant-config'
import { ProviderApp } from './provider-screens'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')
const appRoot = createRoot(root)

function showInvalidLink() {
  appRoot.render(
    <AuthPage title="Sign-in link unavailable">
      <p role="alert">This link couldn’t be used. Request a fresh link to continue.</p>
      <a href={import.meta.env.BASE_URL}>Return to sign in</a>
    </AuthPage>,
  )
}

async function setCallbackSession(client: SupabaseClient, callback: { access_token: string; refresh_token: string }) {
  try {
    const result = await client.auth.setSession({
      access_token: callback.access_token,
      refresh_token: callback.refresh_token,
    })
    if (result.error || !result.data.session) {
      showInvalidLink()
      return false
    }
    return true
  } catch {
    showInvalidLink()
    return false
  }
}

function providerPath(): boolean {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const pathname = window.location.pathname
  return pathname === base + '/provider' || pathname.startsWith(base + '/provider/')
}

async function startProvider(callback: ReturnType<typeof takeAuthCallback>) {
  appRoot.render(
    <AuthPage title="Loading provider">
      <p role="status">Checking provider configuration…</p>
    </AuthPage>,
  )
  const config = await loadProviderConfig()
  if (!config) {
    appRoot.render(
      <AuthPage title="Provider unavailable">
        <p role="alert">This deployment is missing valid provider configuration.</p>
      </AuthPage>,
    )
    return
  }

  if (callback.kind === 'invalid') {
    showInvalidLink()
    return
  }

  const client = createProviderClient(config)
  if (callback.kind === 'tokens' && !(await setCallbackSession(client, callback))) return

  appRoot.render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ProviderApp config={config} client={client} />
      </BrowserRouter>
    </StrictMode>,
  )
}

async function start() {
  const callback = takeAuthCallback()
  if (providerPath()) {
    await startProvider(callback)
    return
  }

  appRoot.render(<AuthPage title="Loading workspace"><p role="status">Checking tenant configuration…</p></AuthPage>)
  const config = await loadTenantConfig()
  if (!config) {
    appRoot.render(<AuthPage title="Workspace unavailable"><p role="alert">This deployment is missing valid tenant configuration.</p></AuthPage>)
    return
  }

  if (callback.kind === 'invalid') {
    showInvalidLink()
    return
  }

  const client = createTenantClient(config)
  if (callback.kind === 'tokens' && !(await setCallbackSession(client, callback))) return

  appRoot.render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App client={client} />
      </BrowserRouter>
    </StrictMode>,
  )
}

void start()
