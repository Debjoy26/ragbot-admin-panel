import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { AuthPage } from './AuthView'
import { takeAuthCallback } from './auth-callback'
import { createTenantClient } from './client-auth'
import { loadTenantConfig } from './tenant-config'
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

async function start() {
  const callback = takeAuthCallback()
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
  if (callback.kind === 'tokens') {
    try {
      const result = await client.auth.setSession({
        access_token: callback.access_token,
        refresh_token: callback.refresh_token,
      })
      if (result.error || !result.data.session) {
        showInvalidLink()
        return
      }
    } catch {
      showInvalidLink()
      return
    }
  }

  appRoot.render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App client={client} />
      </BrowserRouter>
    </StrictMode>,
  )
}

void start()
