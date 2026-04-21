import React from 'react'
import ReactDOM from 'react-dom/client'
import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    function handlePreloadError(event) {
      event.preventDefault()
      setUpdateAvailable(true)
    }

    window.addEventListener('vite:preloadError', handlePreloadError)

    return () => {
      window.removeEventListener('vite:preloadError', handlePreloadError)
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
    <BrowserRouter>
      <AuthProvider>
        <UpdateBanner />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
