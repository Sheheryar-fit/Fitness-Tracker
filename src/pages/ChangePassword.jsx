import { useState } from 'react'
import { KeyRound, Eye, EyeOff, TriangleAlert, CircleCheck, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

const MIN_LENGTH = 8

/**
 * Change Password Page (trainer and clients)
 * Updates the logged-in user's Supabase Auth password
 */
export default function ChangePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <PageHeader title="Change password" subtitle="Choose a new password for your account" />

      <div className="card" style={{ maxWidth: '520px' }}>
        <div className="card-header">
          <span className="card-title">
            <ShieldCheck size={20} aria-hidden="true" />
            New password
          </span>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {done && (
          <div className="alert alert-success" role="status">
            <CircleCheck size={18} aria-hidden="true" />
            <span>Password changed. Use it the next time you log in.</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">
              New password
            </label>
            <div className="input-wrap">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={saving}
                aria-describedby="new-password-hint"
              />
              <button
                type="button"
                className="icon-btn input-action"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            <span className="form-hint" id="new-password-hint">At least {MIN_LENGTH} characters</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving} id="change-password-btn">
              {saving ? <span className="btn-spinner" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
