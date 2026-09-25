import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import { Target, Plus, X, Users, UserPlus, Save, TriangleAlert } from 'lucide-react'
import { calculateGoalProgress, getGoalStatus, groupGoalsByStatus } from '../../utils/calculations'
import ConfirmDialog from '../../components/ConfirmDialog'
import ProgressPhotos from '../../components/ProgressPhotos'
import PageHeader from '../../components/PageHeader'
import GoalCard from '../../components/GoalCard'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

export default function GoalProgressAdmin() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [goals, setGoals] = useState([])
  const [measurements, setMeasurements] = useState([])
  
  // Form State
  const [selectedClientId, setSelectedClientId] = useState('')
  const [description, setDescription] = useState('')
  const [targetMetric, setTargetMetric] = useState('Weight')
  const [targetValue, setTargetValue] = useState('')
  const [startingValue, setStartingValue] = useState('')
  const [deadline, setDeadline] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null) // goal being edited, or null when adding
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  // Bring the form into view when a goal is opened for editing
  useEffect(() => {
    if (!editingGoal) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('new-goal-form')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    document.getElementById('goal-target')?.focus({ preventScroll: true })
  }, [editingGoal])

  async function fetchData() {
    try {
      // Get all clients
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('id, name, current_weight')
        .eq('trainer_id', user.id)
        .order('name')

      if (clientErr) throw clientErr
      setClients(clientsData || [])

      // Get all goals
      const { data: goalsData, error: goalsErr } = await supabase
        .from('goals')
        .select('*, client:clients(name, current_weight)')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false })

      if (goalsErr) throw goalsErr
      setGoals(goalsData || [])

      // Get measurements for this trainer's clients only (newest first)
      const clientIds = (clientsData || []).map((c) => c.id)
      if (clientIds.length > 0) {
        const { data: measData, error: measErr } = await supabase
          .from('measurements')
          .select('client_id, date, chest, waist, arms, thigh')
          .in('client_id', clientIds)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (!measErr) setMeasurements(measData || [])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  function clearForm() {
    setDescription('')
    setTargetValue('')
    setStartingValue('')
    setDeadline('')
    setFormError('')
  }

  // Leave edit mode and put the form back to its empty "new goal" state
  function stopEditing() {
    setEditingGoal(null)
    setSelectedClientId('')
    setTargetMetric('Weight')
    clearForm()
  }

  function closeForm() {
    if (editingGoal) stopEditing()
    setFormError('')
    setShowForm(false)
  }

  // Only the description, values and deadline can change; client and metric are fixed
  function startEditing(goal) {
    setEditingGoal(goal)
    setSelectedClientId(goal.client_id)
    setTargetMetric(goal.target_metric)
    setStartingValue(goal.starting_value == null ? '' : String(goal.starting_value))
    setTargetValue(String(goal.target_value))
    setDescription(goal.description || '')
    setDeadline(goal.deadline || '')
    setFormError('')
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedClientId) return

    setFormError('')
    setSubmitting(true)
    try {
      const values = {
        description: description.trim(),
        target_value: parseFloat(targetValue),
        starting_value: parseFloat(startingValue),
        deadline: deadline || null
      }

      if (editingGoal) {
        const { data, error } = await supabase
          .from('goals')
          .update(values)
          .eq('id', editingGoal.id)
          .select('*, client:clients(name, current_weight)')

        if (error) throw error
        // RLS answers "no rows" instead of an error when the goal isn't the trainer's
        if (!data || !data[0]) throw new Error('The goal could not be found')

        setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? data[0] : g)))
        stopEditing()
        setShowForm(false)
        return
      }

      const { data, error } = await supabase
        .from('goals')
        .insert({
          client_id: selectedClientId,
          trainer_id: user.id,
          target_metric: targetMetric,
          ...values
        })
        .select('*, client:clients(name, current_weight)')

      if (error) throw error

      if (data && data[0]) {
        setGoals((prev) => [data[0], ...prev])
        clearForm()
        setShowForm(false)
      }
    } catch (err) {
      console.error('Error saving goal:', err)
      setFormError(err.message || 'Could not save the goal. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', deleteTarget)

      if (error) throw error
      setGoals((prev) => prev.filter((g) => g.id !== deleteTarget))
      if (editingGoal?.id === deleteTarget) {
        stopEditing()
        setShowForm(false)
      }
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting goal:', err)
    }
  }

  // Pre-fill starting value when client/metric changes (new goals only)
  useEffect(() => {
    if (!selectedClientId || editingGoal) return

    const client = clients.find(c => c.id === selectedClientId)
    const clientMeas = measurements.find(m => m.client_id === selectedClientId)

    if (targetMetric === 'Weight' && client?.current_weight) {
      setStartingValue(client.current_weight.toString())
    } else if (clientMeas) {
      if (targetMetric === 'Chest' && clientMeas.chest) setStartingValue(clientMeas.chest.toString())
      if (targetMetric === 'Waist' && clientMeas.waist) setStartingValue(clientMeas.waist.toString())
      if (targetMetric === 'Arms' && clientMeas.arms) setStartingValue(clientMeas.arms.toString())
      if (targetMetric === 'Thigh' && clientMeas.thigh) setStartingValue(clientMeas.thigh.toString())
    } else {
      setStartingValue('')
    }
  }, [selectedClientId, targetMetric, clients, measurements, editingGoal])

  if (loading) return <Loading />

  // Group goals by status; show each client's photos once, under their first card
  const photosShownFor = new Set()
  const goalSections = groupGoalsByStatus(
    goals.map((goal) => {
      // measurements are newest first, so find() gives this client's latest
      const latest = measurements.find((m) => m.client_id === goal.client_id)
      const progress = calculateGoalProgress(goal, goal.client?.current_weight, latest)
      return { goal, ...progress, status: getGoalStatus(progress.percent, goal.deadline) }
    })
  )
  goalSections.forEach((section) => {
    section.items.forEach((item) => {
      item.showPhotos = !photosShownFor.has(item.goal.client_id)
      photosShownFor.add(item.goal.client_id)
    })
  })

  // The form is always open while there are no goals yet
  const formOpen = showForm || goals.length === 0
  const unit = targetMetric === 'Weight' ? 'kg' : 'in'

  return (
    <div>
      <PageHeader
        title="Goal progress"
        subtitle="Set metric goals for your clients and follow their progress"
        actions={
          goals.length > 0 && (
            <button
              className={`btn ${formOpen ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => (formOpen ? closeForm() : setShowForm(true))}
              aria-expanded={formOpen}
              aria-controls="new-goal-form"
            >
              {formOpen ? <X size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
              {formOpen ? 'Close' : 'New Goal'}
            </button>
          )
        }
      />

      {formOpen && (
        <div className="card page" id="new-goal-form" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <span className="card-title">
              <Target size={20} aria-hidden="true" />
              {editingGoal ? `Edit goal: ${editingGoal.client?.name || 'Unknown client'} · ${editingGoal.target_metric}` : 'Set a new goal'}
            </span>
          </div>

          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              text="Add a client first, then set goals for them here."
              action={
                <Link to="/admin/clients/add" className="btn btn-primary">
                  <UserPlus size={18} aria-hidden="true" />
                  Add Client
                </Link>
              }
            />
          ) : (
            <form onSubmit={handleSubmit}>
              {formError && (
                <div className="alert alert-error" role="alert">
                  <TriangleAlert size={18} aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="goal-client">Client *</label>
                  <select
                    id="goal-client"
                    className="form-select"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    required
                    disabled={submitting || !!editingGoal}
                  >
                    <option value="" disabled>Select a client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="goal-metric">Metric *</label>
                  <select
                    id="goal-metric"
                    className="form-select"
                    value={targetMetric}
                    onChange={(e) => setTargetMetric(e.target.value)}
                    required
                    disabled={submitting || !!editingGoal}
                  >
                    <option value="Weight">Weight (kg)</option>
                    <option value="Chest">Chest (in)</option>
                    <option value="Waist">Waist (in)</option>
                    <option value="Arms">Arms (in)</option>
                    <option value="Thigh">Thigh (in)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="goal-start">Starting value ({unit}) *</label>
                  <input
                    id="goal-start"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    className="form-input"
                    value={startingValue}
                    onChange={(e) => setStartingValue(e.target.value)}
                    required
                    disabled={submitting}
                  />
                  {!editingGoal && <span className="form-hint">Filled in from the latest measurement</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="goal-target">Target value ({unit}) *</label>
                  <input
                    id="goal-target"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    className="form-input"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="goal-desc">Description *</label>
                  <input
                    id="goal-desc"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Lose fat for the summer"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="goal-deadline">Deadline</label>
                  <input
                    id="goal-deadline"
                    type="date"
                    className="form-input"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting || !selectedClientId}>
                  {submitting ? (
                    <span className="btn-spinner" aria-hidden="true" />
                  ) : editingGoal ? (
                    <Save size={18} aria-hidden="true" />
                  ) : (
                    <Target size={18} aria-hidden="true" />
                  )}
                  {editingGoal
                    ? submitting ? 'Saving...' : 'Save Changes'
                    : submitting ? 'Setting Goal...' : 'Set Goal'}
                </button>
                {editingGoal && (
                  <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={submitting}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {goals.length === 0 && (
        <EmptyState icon={Target} title="No goals set yet" text="Goals you set appear here with live progress." />
      )}

      {goalSections.map((section) => (
        <section key={section.status} style={{ marginBottom: '2rem' }}>
          <div className="section-header">
            <h2 className="section-title">
              {section.title}
              <span className="section-count">{section.items.length}</span>
            </h2>
          </div>

          <div className="goal-list stagger">
            {section.items.map(({ goal, percent, current, badges, status, showPhotos }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                title={`${goal.client?.name || 'Unknown client'} · ${goal.target_metric}`}
                percent={percent}
                current={current}
                badges={badges}
                status={status}
                onEdit={() => startEditing(goal)}
                onDelete={() => setDeleteTarget(goal.id)}
              >
                {/* Progress Photos - once per client, under their first goal */}
                {showPhotos && <ProgressPhotos clientId={goal.client_id} />}
              </GoalCard>
            ))}
          </div>
        </section>
      ))}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Goal"
        message="Are you sure you want to remove this goal?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
