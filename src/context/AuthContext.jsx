import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Create the Auth Context
const AuthContext = createContext(null)

// Give up on a login request after this long (slow mobile networks, paused Supabase project)
const LOGIN_TIMEOUT_MS = 15000

// A stored session must look like a row returned by authenticate_user
function isValidStoredUser(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.username === 'string' &&
    (value.role === 'admin' || value.role === 'client')
  )
}

// Calls the authenticate_user RPC; returns the user or null, throws on request errors
async function authenticateUser(username, password, signal) {
  const { data, error, status } = await supabase
    .rpc('authenticate_user', {
      p_username: username,
      p_password: password
    })
    .abortSignal(signal)

  if (error) {
    const requestError = new Error(error.message)
    requestError.status = status
    throw requestError
  }

  // RPC returns an array; check if we got a user
  return data && data.length > 0 ? data[0] : null
}

// Turn a failed login request into a message the user can act on
function getLoginErrorMessage(err, timedOut) {
  if (timedOut) {
    return 'The server is taking too long to respond. Check your connection and try again.'
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Check your internet connection and try again.'
  }
  // status 0 = the request never got a response (network error, server unreachable)
  if (err?.status === 0) {
    return 'Could not reach the server. Please try again in a moment.'
  }
  return 'Something went wrong while signing in. Please try again.'
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

  function getStoredUser() {
    try {
      return localStorage.getItem('gym_user')
    } catch (error) {
      console.warn('Could not read localStorage:', error)
      return null
    }
  }

  function setStoredUser(userData) {
    try {
      localStorage.setItem('gym_user', JSON.stringify(userData))
    } catch (error) {
      console.warn('Could not write localStorage:', error)
    }
  }

  function clearStoredUser() {
    try {
      localStorage.removeItem('gym_user')
    } catch (error) {
      console.warn('Could not clear localStorage:', error)
    }
  }

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = getStoredUser()
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        if (isValidStoredUser(parsed)) {
          setUser(parsed)
        } else {
          clearStoredUser()
        }
      } catch {
        clearStoredUser()
      }
    }
    setLoading(false)
  }, [])

  // Login function - calls the authenticate_user RPC
  async function login(username, password) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS)

    try {
      let userData = await authenticateUser(username, password, controller.signal)

      // Phone keyboards often capitalise the first letter; generated usernames are lowercase
      const lowered = username.toLowerCase()
      if (!userData && lowered !== username) {
        userData = await authenticateUser(lowered, password, controller.signal)
      }

      if (!userData) {
        return { success: false, error: 'Invalid username or password' }
      }

      // Store user in state and localStorage (no password)
      setUser(userData)
      setStoredUser(userData)

      return { success: true, user: userData }
    } catch (err) {
      console.error('Login error:', err)
      return { success: false, error: getLoginErrorMessage(err, controller.signal.aborted) }
    } finally {
      clearTimeout(timer)
    }
  }

  // Logout function
  function logout() {
    setUser(null)
    clearStoredUser()
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
