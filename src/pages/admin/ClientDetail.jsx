import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  KeyRound,
  Pencil,
  Scale,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Ruler,
  Plus,
  User,
  Copy,
  X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  calcWeightChange,
  calcWeightChangePercent,
  getWeightColor,
  isPositiveProgress,
  calcDaysActive,
  formatDate,
  formatHeight,
  generatePassword,
  getLocalDateString
} from '../../utils/calculations'
import ConfirmDialog from '../../components/ConfirmDialog'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import Avatar from '../../components/Avatar'
import GoalBadge from '../../components/GoalBadge'
import EmptyState from '../../components/EmptyState'
import MeasurementCard from '../../components/MeasurementCard'
import Loading from '../../components/Loading'
import Toast from '../../components/Toast'
import AdminCoachNotes from './AdminCoachNotes'

/**
 * Client Detail Page (Admin)
 * Side-by-side layout: Client Info + Progress Summary
 * Bottom: Add measurements form + measurement history
 */
export default function ClientDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Data state
  const [client, setClient] = useState(null)
  const [clientUsername, setClientUsername] = useState('')
  const [measurements, setMeasurements] = useState([])
  const [loading, setLoading] = useState(true)

  // Measurement form state
  const [mDate, setMDate] = useState(getLocalDateString())
  const [mWeight, setMWeight] = useState('')
  const [mChest, setMChest] = useState('')
  const [mWaist, setMWaist] = useState('')
  const [mArms, setMArms] = useState('')
  const [mThigh, setMThigh] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // UI state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const toastTimer = useRef(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // Fetch client and measurements on mount
  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    try {
      // Fetch client
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('trainer_id', user.id)
        .single()

      if (clientErr || !clientData) {
        navigate('/admin/clients')
        return
      }
      setClient(clientData)

      // Fetch username from users table
      if (clientData.user_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('username')
          .eq('id', clientData.user_id)
          .single()
        if (userData) setClientUsername(userData.username)
      }

      // Fetch measurements (newest first)
      const { data: measData, error: measErr } = await supabase
        .from('measurements')
        .select('*')
        .eq('client_id', id)
        .order('date', { ascending: false })

      if (!measErr) setMeasurements(measData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Add a new measurement
  async function handleAddMeasurement(e) {
    e.preventDefault()

    const values = {
      weight: parseFloat(mWeight) || null,
      chest: parseFloat(mChest) || null,
      waist: parseFloat(mWaist) || null,
      arms: parseFloat(mArms) || null,
      thigh: parseFloat(mThigh) || null
    }
    if (Object.values(values).every((v) => v === null)) {
      showToast('Enter at least one measurement', true)
      return
    }

    setSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('measurements')
        .insert({ client_id: id, date: mDate, ...values })
        .select()

      if (error) throw error

      // Add to list (kept newest date first) and clear form
      if (data && data[0]) {
        setMeasurements((prev) =>
          [data[0], ...prev].sort((a, b) => b.date.localeCompare(a.date))
        )
      }
      clearMeasurementForm()

      // A weigh-in becomes the current weight unless a later-dated weigh-in exists
      const newerWeighIn = measurements.some((m) => m.weight != null && m.date > mDate)
      if (values.weight !== null && !newerWeighIn) {
        await syncCurrentWeight(values.weight, 'Measurement added')
      } else {
        showToast('Measurement added successfully')
      }
    } catch (err) {
      console.error('Error adding measurement:', err)
      showToast('Failed to add measurement', true)
    } finally {
      setSubmitting(false)
    }
  }

  // Delete a measurement entry
  async function handleDeleteMeasurement() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase
        .from('measurements')
        .delete()
        .eq('id', deleteTarget)

      if (error) throw error

      const fallback = weightAfterDelete(deleteTarget)
      setMeasurements((prev) => prev.filter((m) => m.id !== deleteTarget))
      setDeleteTarget(null)

      if (fallback) {
        await syncCurrentWeight(fallback.weight, 'Measurement deleted')
      } else {
        showToast('Measurement deleted')
      }
    } catch (err) {
      console.error('Error deleting measurement:', err)
      showToast('Failed to delete measurement', true)
    }
  }

  // What the current weight becomes if this measurement is deleted: null when it
  // isn't the latest weigh-in, else the previous weigh-in or the starting weight
  function weightAfterDelete(measurementId) {
    // measurements is newest first, so the first one with a weight is the latest weigh-in
    const latestWeighIn = measurements.find((m) => m.weight != null)
    if (latestWeighIn?.id !== measurementId) return null

    const previousWeighIn = measurements.find((m) => m.weight != null && m.id !== measurementId)
    if (previousWeighIn) {
      return { weight: previousWeighIn.weight, label: `${previousWeighIn.weight} kg (previous weigh-in)` }
    }
    if (client.starting_weight != null) {
      return { weight: client.starting_weight, label: `${client.starting_weight} kg (starting weight)` }
    }
    return null
  }

  // Save a weigh-in as the client's current weight
  async function syncCurrentWeight(weight, doneMessage) {
    const { error } = await supabase
      .from('clients')
      .update({ current_weight: weight })
      .eq('id', id)
      .eq('trainer_id', user.id)

    if (error) {
      console.error('Error updating current weight:', error)
      showToast(`${doneMessage}, but current weight could not be updated`, true)
      return
    }
    setClient((prev) => ({ ...prev, current_weight: weight }))
    showToast(`${doneMessage}, current weight is now ${weight} kg`)
  }

  function clearMeasurementForm() {
    setMDate(getLocalDateString())
    setMWeight('')
    setMChest('')
    setMWaist('')
    setMArms('')
    setMThigh('')
  }

  // Reset client password
  async function handleResetPassword() {
    setShowResetConfirm(false)
    if (!client.user_id) return
    setResetting(true)
    try {
      const pwd = generatePassword(8)
      const { error } = await supabase.rpc('reset_client_password', {
        p_user_id: client.user_id,
        p_new_password: pwd
      })
      if (error) throw error
      setNewPassword(pwd)
      setShowResetModal(true)
    } catch (err) {
      console.error('Error resetting password:', err)
      showToast('Failed to reset password', true)
    } finally {
      setResetting(false)
    }
  }

  function showToast(message, isError = false) {
    setToast(message)
    setToastError(isError)
    // Restart the timer so an older toast's timeout can't hide this one early
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }

  if (loading || !client) return <Loading />

  // Calculate progress values
  const weightChange = calcWeightChange(client.current_weight, client.starting_weight)
  const weightPercent = calcWeightChangePercent(client.current_weight, client.starting_weight)
  const weightColor = getWeightColor(weightChange, client.goal)
  const positive = isPositiveProgress(weightChange, client.goal)
  const daysActive = calcDaysActive(client.join_date)
  const latestMeasurement = measurements.length > 0 ? measurements[0] : null
  const deleteFallback = deleteTarget ? weightAfterDelete(deleteTarget) : null
  const progressBarWidth = Math.min(Math.abs(weightPercent), 100)

  return (
    <div>
      <PageHeader
        back={{ to: '/admin/clients', label: 'Clients' }}
        lead={<Avatar name={client.name} size="lg" />}
        title={client.name}
        subtitle={
          <div className="profile-meta">
            <GoalBadge goal={client.goal} />
            {clientUsername && (
              <span className="badge">
                <User size={14} aria-hidden="true" />
                <span className="mono">{clientUsername}</span>
              </span>
            )}
          </div>
        }
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowResetConfirm(true)}
              disabled={resetting}
              id="reset-password-btn"
            >
              {resetting ? <span className="btn-spinner" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
              Reset Password
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/admin/clients/${id}/edit`)}
              id="edit-client-btn"
            >
              <Pencil size={18} aria-hidden="true" />
              Edit
            </button>
          </>
        }
      />

      {/* Key numbers */}
      <div className="stat-grid stagger">
        <StatCard
          icon={Scale}
          label="Current weight"
          value={client.current_weight != null ? <>{client.current_weight}<small>kg</small></> : '—'}
          hint={client.starting_weight != null ? `Started at ${client.starting_weight} kg` : null}
        />
        <StatCard
          icon={positive ? TrendingDown : TrendingUp}
          tone={positive ? 'green' : 'red'}
          label="Total change"
          value={<>{weightChange > 0 ? '+' : ''}{weightChange}<small>kg</small></>}
          valueStyle={{ color: weightColor }}
          hint={`${weightPercent > 0 ? '+' : ''}${weightPercent}% since joining`}
        />
        <StatCard
          icon={CalendarDays}
          tone="blue"
          label="Days active"
          value={daysActive}
          hint={`Joined ${formatDate(client.join_date)}`}
        />
        <StatCard
          icon={Ruler}
          tone="orange"
          label="Measurements"
          value={measurements.length}
          hint={latestMeasurement ? `Last on ${formatDate(latestMeasurement.date)}` : 'None yet'}
        />
      </div>

      <div className="grid-2 section">
        {/* Add Measurement */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Plus size={20} aria-hidden="true" />
              Add measurement
            </span>
          </div>

          <form onSubmit={handleAddMeasurement}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="m-date">
                  Date
                </label>
                <input
                  id="m-date"
                  type="date"
                  className="form-input"
                  value={mDate}
                  onChange={(e) => setMDate(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="m-weight">
                  Weight (kg)
                </label>
                <input
                  id="m-weight"
                  type="number"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="e.g. 78.5"
                  value={mWeight}
                  onChange={(e) => setMWeight(e.target.value)}
                  step="0.1"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="m-chest">
                  Chest (in)
                </label>
                <input
                  id="m-chest"
                  type="number"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="e.g. 40"
                  value={mChest}
                  onChange={(e) => setMChest(e.target.value)}
                  step="0.1"
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="m-waist">
                  Waist (in)
                </label>
                <input
                  id="m-waist"
                  type="number"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="e.g. 34"
                  value={mWaist}
                  onChange={(e) => setMWaist(e.target.value)}
                  step="0.1"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="m-arms">
                  Arms (in)
                </label>
                <input
                  id="m-arms"
                  type="number"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="e.g. 15"
                  value={mArms}
                  onChange={(e) => setMArms(e.target.value)}
                  step="0.1"
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="m-thigh">
                  Thigh (in)
                </label>
                <input
                  id="m-thigh"
                  type="number"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="e.g. 22"
                  value={mThigh}
                  onChange={(e) => setMThigh(e.target.value)}
                  step="0.1"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                id="add-measurement-btn"
              >
                {submitting ? <span className="btn-spinner" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                {submitting ? 'Adding...' : 'Add Measurement'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={clearMeasurementForm}
                disabled={submitting}
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Client Information */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <User size={20} aria-hidden="true" />
              Client information
            </span>
          </div>
          <ul className="info-list">
            <li>
              <span className="info-label">Username</span>
              <span className="info-value mono" style={{ color: 'var(--accent)' }}>
                {clientUsername || '—'}
              </span>
            </li>
            <li>
              <span className="info-label">Age</span>
              <span className="info-value">{client.age || '—'}</span>
            </li>
            <li>
              <span className="info-label">Height</span>
              <span className="info-value">{formatHeight(client.height)}</span>
            </li>
            <li>
              <span className="info-label">Joined</span>
              <span className="info-value">{formatDate(client.join_date)}</span>
            </li>
            <li>
              <span className="info-label">Starting weight</span>
              <span className="info-value">
                {client.starting_weight ? `${client.starting_weight} kg` : '—'}
              </span>
            </li>
            <li>
              <span className="info-label">Current weight</span>
              <span className="info-value">
                {client.current_weight ? `${client.current_weight} kg` : '—'}
              </span>
            </li>
          </ul>

          <div style={{ marginTop: '1.25rem' }}>
            <div className="progress-track">
              <div
                className={`progress-fill ${positive ? 'tone-green' : 'tone-red'}`}
                style={{ transform: `scaleX(${progressBarWidth / 100})` }}
              />
            </div>
            <div className="progress-meta">
              <span>Weight change</span>
              <strong style={{ color: weightColor }}>
                {weightPercent > 0 ? '+' : ''}{weightPercent}%
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Measurement History */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Measurement history
            <span className="section-count">{measurements.length}</span>
          </h2>
        </div>

        {measurements.length === 0 ? (
          <EmptyState
            icon={Ruler}
            title="No measurements yet"
            text="Add the first measurement using the form above."
          />
        ) : (
          <div className="timeline stagger">
            {measurements.map((m, index) => (
              <MeasurementCard
                key={m.id}
                measurement={m}
                // Previous measurement is the next in the array (since sorted newest first)
                prev={index < measurements.length - 1 ? measurements[index + 1] : null}
                // Weight is compared with the previous entry that has a weight
                prevWeighIn={measurements.slice(index + 1).find((x) => x.weight != null)}
                goal={client.goal}
                onDelete={() => setDeleteTarget(m.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Delete Measurement Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Measurement"
        message={
          'Are you sure you want to delete this measurement entry? This action cannot be undone.' +
          (deleteFallback ? ` Current weight will change to ${deleteFallback.label}.` : '')
        }
        onConfirm={handleDeleteMeasurement}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Reset Password Confirmation */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Password"
        message={`Generate a new password for "${client.name}"? Their current password will stop working immediately.`}
        onConfirm={handleResetPassword}
        onCancel={() => setShowResetConfirm(false)}
        confirmText="Reset Password"
      />

      <AdminCoachNotes clientId={client.id} trainerId={user.id} />

      {/* New password after a reset */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="icon-chip">
              <KeyRound size={22} aria-hidden="true" />
            </span>
            <h3 className="modal-title" id="reset-title">New password</h3>
            <p className="modal-message">
              New login details for <strong>{client.name}</strong>. Save them now; the password can't
              be shown again.
            </p>
            <div className="credentials-box">
              <div className="credentials-row">
                <span className="cred-label">Username</span>
                <span className="cred-value">{clientUsername}</span>
              </div>
              <div className="credentials-row">
                <span className="cred-label">New password</span>
                <span className="cred-value">{newPassword}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowResetModal(false)}>
                <X size={18} aria-hidden="true" />
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Username: ${clientUsername}\nPassword: ${newPassword}`
                  )
                  showToast('Credentials copied!')
                }}
              >
                <Copy size={18} aria-hidden="true" />
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} error={toastError} />
    </div>
  )
}
