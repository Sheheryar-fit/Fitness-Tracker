import React from 'react'
import ReactDOM from 'react-dom/client'
import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { initInstallPrompt } from './lib/installPrompt'
import { isStaleChunkError, reloadOnceForUpdate } from './lib/staleChunk'
import './index.css'

class AppCrashBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      stale: false, // a page file was replaced by a newer deploy
      updating: false, // reloading automatically for that
      message: ''
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      stale: isStaleChunkError(error),
      message: error?.message || 'Unexpected application error'
    }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
    if (isStaleChunkError(error) && reloadOnceForUpdate()) {
      this.setState({ updating: true })
    }
  }

  render() {
    if (this.state.hasError && this.state.stale) {
      return (
        <div className="app-crash-screen" role="status" aria-live="polite">
          <span className="icon-chip tone-orange" aria-hidden="true">
            <RefreshCw size={22} />
          </span>
          <h1>{this.state.updating ? 'Updating the app…' : 'A new version is ready'}</h1>
          <p>
            {this.state.updating
              ? 'One moment while the latest version loads.'
              : "We've released an update since you opened the app. Reload to keep going."}
          </p>
          {!this.state.updating && (
            <div className="app-crash-actions">
              <button type="button" className="btn btn-primary" onClick={reloadWithCacheBust}>
                Reload
              </button>
            </div>
          )}
        </div>
      )
    }

    if (this.state.hasError) {
      return (
        <div className="app-crash-screen" role="alert" aria-live="assertive">
          <span className="icon-chip tone-orange" aria-hidden="true">!</span>
          <h1>We hit a loading issue</h1>
          <p>
            Your mobile browser may be using an older cached app file. Refresh to load the latest version.
          </p>
          <div className="app-crash-actions">
            <button type="button" className="btn btn-primary" onClick={reloadWithCacheBust}>
              Refresh app
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearSessionAndReload}>
              Clear session and refresh
            </button>
          </div>
          <small>{this.state.message}</small>
        </div>
      )
    }

    return this.props.children
  }
}

function reloadWithCacheBust() {
  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.set('v', Date.now().toString())
  window.location.replace(nextUrl.toString())
}

function clearSessionAndReload() {
  try {
    // Old login key and Supabase Auth session keys (sb-<project>-auth-token)
    localStorage.removeItem('gym_user')
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-'))
      .forEach((key) => localStorage.removeItem(key))
    sessionStorage.clear()
  } catch (error) {
    console.warn('Could not clear browser storage:', error)
  }

  reloadWithCacheBust()
}

function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    function markUpdateNeeded() {
      setUpdateAvailable(true)
    }

    // Don't call event.preventDefault() here: Vite then swallows the error and the page's
    // import resolves to undefined, which crashes React with "reading 'default'". Letting it
    // throw sends the real error to AppCrashBoundary, which knows how to handle it.
    function handlePreloadError() {
      markUpdateNeeded()
    }

    function handleRuntimeError(event) {
      if (isStaleChunkError(event?.message)) {
        markUpdateNeeded()
      }
    }

    function handleRejection(event) {
      if (isStaleChunkError(String(event?.reason?.message || event?.reason || ''))) {
        event.preventDefault()
        markUpdateNeeded()
      }
    }

    window.addEventListener('vite:preloadError', handlePreloadError)
    window.addEventListener('error', handleRuntimeError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('vite:preloadError', handlePreloadError)
      window.removeEventListener('error', handleRuntimeError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  if (!updateAvailable) {
    return null
  }

  function handleRefresh() {
    window.location.reload()
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-banner-content">
        <strong>Update available</strong>
        <span>A newer version of the app is ready. Refresh to avoid stale cached files.</span>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={handleRefresh}>
        Refresh now
      </button>
    </div>
  )
}

// Install as an app: capture the install prompt early and register the service worker
initInstallPrompt()
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppCrashBoundary>
      <BrowserRouter>
        <AuthProvider>
          <UpdateBanner />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </AppCrashBoundary>
  </React.StrictMode>
)
