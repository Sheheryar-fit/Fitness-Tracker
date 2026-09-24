import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { usernameToEmail } from '../lib/authEmail'

// Create the Auth Context
const AuthContext = createContext(null)

// Give up on a login request after this long (slow mobile networks, paused Supabase project)
const LOGIN_TIMEOUT_MS = 15000

// App user from a Supabase Auth user. Role and username live in app_metadata,
// which only the database can set, so users can't change their own role.
function toAppUser(authUser) {
  const meta = authUser?.app_metadata || {}
  if (meta.app_role !== 'admin' && meta.app_role !== 'client') return null
  return { id: authUser.id, username: meta.username, role: meta.app_role }
}

// Resolves with { timedOut: true } if the promise takes longer than ms
function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Turn a failed login into a message the user can act on
function getLoginErrorMessage(err, timedOut) {
  if (timedOut) {
    return 'The server is taking too long to respond. Check your connection and try again.'
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Check your internet connection and try again.'
  }
  if (err?.status === 429) {
    return 'Too many login attempts. Please wait a few minutes and try again.'
  }
  if (isAuthRetryableFetchError(err)) {
    return 'Could not reach the server. Please try again in a moment.'
  }
  if (err?.code === 'invalid_credentials' || err?.status === 400) {
    return 'Invalid username or password'
  }
  return 'Something went wrong while signing in. Please try again.'
}

// Sessions from the old login system are no longer valid
function clearLegacySession() {
  try {
    localStorage.removeItem('gym_user')
  } catch (error) {
    console.warn('Could not clear localStorage:', error)
  }
}

// Custom hook to use auth
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Auth Provider Component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Follow the Supabase session: restored on load, refreshed automatically,
  // and kept in sync across tabs
  useEffect(() => {
    clearLegacySession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const appUser = session ? toAppUser(session.user) : null

      // Keep the same object on token refreshes so pages don't re-render
      setUser((prev) => (prev?.id === appUser?.id && prev?.role === appUser?.role ? prev : appUser))

      // A login without an app role (e.g. not created by this app) can't use it
      if (session && !appUser) {
        setTimeout(() => supabase.auth.signOut({ scope: 'local' }), 0)
      }
      if (event === 'INITIAL_SESSION') setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Login with username + password through Supabase Auth
  async function login(username, password) {
    try {
      const email = await usernameToEmail(username)
      const result = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        LOGIN_TIMEOUT_MS
      )

      if (result.timedOut) {
        return { success: false, error: getLoginErrorMessage(null, true) }
      }
      if (result.error) {
        console.error('Login error:', result.error)
        return { success: false, error: getLoginErrorMessage(result.error, false) }
      }

      const appUser = toAppUser(result.data.user)
      if (!appUser) {
        await supabase.auth.signOut({ scope: 'local' })
        return { success: false, error: 'This account is not set up for the app. Contact your trainer.' }
      }

      setUser(appUser)
      return { success: true, user: appUser }
    } catch (err) {
      console.error('Login error:', err)
      return { success: false, error: getLoginErrorMessage(err, false) }
    }
  }

  // Logout function (this device only)
  async function logout() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) console.warn('Sign out error:', error)
    setUser(null)
    navigate('/login')
  }

  const value = {
    user,
    login,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
