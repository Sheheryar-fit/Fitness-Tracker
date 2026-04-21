import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Create the Auth Context
const AuthContext = createContext(null)

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
        setUser(JSON.parse(storedUser))
      } catch {
        clearStoredUser()
      }
    }
    setLoading(false)
  }, [])

  // Login function - calls the authenticate_user RPC
  async function login(username, password) {
    try {
      const { data, error } = await supabase.rpc('authenticate_user', {
        p_username: username,
        p_password: password
      })

      if (error) throw error

      // RPC returns an array; check if we got a user
      if (!data || data.length === 0) {
        return { success: false, error: 'Invalid username or password' }
      }

      const userData = data[0]
      // Store user in state and localStorage (no password)
      setUser(userData)
      setStoredUser(userData)

      return { success: true, user: userData }
    } catch (err) {
      console.error('Login error:', err)
      return { success: false, error: err.message || 'Login failed' }
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
