import React from 'react'
import ReactDOM from 'react-dom/client'
import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

class AppCrashBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      message: ''
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error'
    }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-crash-screen" role="alert" aria-live="assertive">
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
    localStorage.removeItem('gym_user')
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

    function handlePreloadError(event) {
      event.preventDefault()
      markUpdateNeeded()
    }

    function handleRuntimeError(event) {
      const message = event?.message || ''
      if (message.includes('Failed to fetch dynamically imported module')) {
        markUpdateNeeded()
      }
    }

    function handleRejection(event) {
      const message = String(event?.reason?.message || event?.reason || '')
      if (
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed')
      ) {
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
      <button type="button" className="update-banner-button" onClick={handleRefresh}>
        Refresh now
      </button>
    </div>
  )
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
