import { useState } from 'react'
import { supabase } from '../lib/supabase'

const MIN_LENGTH = 8

/**
 * Change Password Page (trainer and clients)
 * Updates the logged-in user's Supabase Auth password
 */
export default function ChangePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setDone(false)

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      console.error('Error changing password:', updateError)
      setError(
        updateError.code === 'same_password'
          ? 'The new password must be different from your current one'
          : updateError.message || 'Could not change your password. Please try again.'
      )
      return
    }

    setPassword('')
    setConfirm('')
    setDone(true)
  }

  return (
    <div>
      <div className="page-header">
        <h2>Change Password</h2>
        <p>Choose a new password for your account</p>
      </div>

      <div className="card" style={{ maxWidth: '500px' }}>
        {error && <div className="login-error">⚠️ {error}</div>}
        {done && (
          <div className="login-error" style={{ borderColor: 'var(--color-green)', color: 'var(--color-green)' }}>
            ✅ Password changed. Use it the next time you log in.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              className="form-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving} id="change-password-btn">
              {saving ? 'Saving...' : '🔑 Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
