import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Dumbbell, Eye, EyeOff, TriangleAlert, Ruler, Target, CalendarCheck, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  { icon: Ruler, text: 'Weight and body measurements, tracked over time' },
  { icon: Target, text: 'Goals with live progress and milestones' },
  { icon: CalendarCheck, text: 'Weekly check-ins and notes from your coach' }
]

/**
 * Login Page
 * Username/password form with role-based redirect
 */
export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, user } = useAuth()
  const navigate = useNavigate()

  // If already logged in, redirect
  if (user) {
    const target = user.role === 'admin' ? '/admin/dashboard' : '/client/dashboard'
    return <Navigate to={target} replace />
  }

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Basic validation
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }

    setLoading(true)
    const result = await login(username.trim(), password)
    setLoading(false)

    if (result.success) {
      // Redirect based on role
      const target = result.user.role === 'admin'
        ? '/admin/dashboard'
        : '/client/dashboard'
      navigate(target, { replace: true })
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="login-page">
      {/* Brand panel (larger screens) */}
      <section className="login-hero" aria-hidden="true">
        <div className="brand">
          <span className="brand-mark">
            <Dumbbell size={22} />
          </span>
          <div className="brand-text">
            <span className="brand-name">Sheheryar Fitness</span>
            <span className="brand-tagline">FitTracker</span>
          </div>
        </div>

        <div>
          <h2 className="login-hero-title">
            Train. Track.<br /><span>Transform.</span>
          </h2>
          <p className="login-hero-text">
            Your coaching, your numbers and your progress in one place.
          </p>
        </div>

        <ul className="login-features stagger">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text}>
              <span className="icon-chip">
                <Icon size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* Sign-in form */}
      <section className="login-panel">
        <div className="login-card">
          <div className="brand login-card-brand">
            <span className="brand-mark">
              <Dumbbell size={22} aria-hidden="true" />
            </span>
            <div className="brand-text">
              <span className="brand-name">Sheheryar Fitness</span>
              <span className="brand-tagline">FitTracker</span>
            </div>
          </div>

          <h1 className="page-title">Welcome back</h1>
          <p className="login-card-sub">Sign in with the username your trainer gave you.</p>

          {/* Error Message */}
          {error && (
            <div className="alert alert-error" id="login-error" role="alert">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g. john.doe"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError('')
                }}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="input-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="icon-btn input-action"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: '0.5rem' }}
              disabled={loading}
              id="login-submit-btn"
            >
              {loading ? <span className="btn-spinner" aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="login-footnote">Forgot your password? Ask your trainer to reset it.</p>
        </div>
      </section>
    </div>
  )
}
