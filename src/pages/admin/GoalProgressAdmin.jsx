import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import { Target, Plus, X, Users, UserPlus } from 'lucide-react'
import { getGoalStatus, groupGoalsByStatus } from '../../utils/calculations'
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

  useEffect(() => {
    fetchData()
  }, [])

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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedClientId) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          client_id: selectedClientId,
          trainer_id: user.id,
          description: description.trim(),
          target_metric: targetMetric,
          target_value: parseFloat(targetValue),
          starting_value: parseFloat(startingValue),
          deadline: deadline || null
        })
        .select('*, client:clients(name, current_weight)')

      if (error) throw error

      if (data && data[0]) {
        setGoals((prev) => [data[0], ...prev])
        setDescription('')
        setTargetValue('')
        setStartingValue('')
        setDeadline('')
        setShowForm(false)
      }
    } catch (err) {
      console.error('Error adding goal:', err)
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
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting goal:', err)
    }
  }

  // Pre-fill starting value when client/metric changes
  useEffect(() => {
    if (!selectedClientId) return

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
  }, [selectedClientId, targetMetric, clients, measurements])

  function calculateProgress(goal) {
    let currentVal = goal.starting_value
    
    // Find current measured value
    if (goal.target_metric === 'Weight' && goal.client?.current_weight) {
      currentVal = goal.client.current_weight
    } else {
      const clientMeas = measurements.find(m => m.client_id === goal.client_id)
      if (clientMeas) {
        if (goal.target_metric === 'Chest' && clientMeas.chest) currentVal = clientMeas.chest
        if (goal.target_metric === 'Waist' && clientMeas.waist) currentVal = clientMeas.waist
        if (goal.target_metric === 'Arms' && clientMeas.arms) currentVal = clientMeas.arms
        if (goal.target_metric === 'Thigh' && clientMeas.thigh) currentVal = clientMeas.thigh
      }
    }

    const start = parseFloat(goal.starting_value)
    const target = parseFloat(goal.target_value)
    const current = parseFloat(currentVal)
    
    if (isNaN(start) || isNaN(target) || isNaN(current)) return { percent: 0, current, badges: [] }

    const totalDiff = Math.abs(start - target)
    if (totalDiff === 0) return { percent: 100, current, badges: ['100% Goal Hit 🏆'] }

    // Depending on if target is higher or lower than start
    const isDecreasing = target < start
    
    let progressPercent = 0
    if (isDecreasing) {
      if (current <= target) progressPercent = 100
      else if (current >= start) progressPercent = 0
      else progressPercent = ((start - current) / totalDiff) * 100
    } else {
      // Increasing (e.g. Muscle gain)
      if (current >= target) progressPercent = 100
      else if (current <= start) progressPercent = 0
      else progressPercent = ((current - start) / totalDiff) * 100
    }

    progressPercent = Math.max(0, Math.min(100, Math.round(progressPercent)))

    const badges = []
    if (progressPercent >= 25 && progressPercent < 50) badges.push('Started Strong 🥉')
    if (progressPercent >= 50 && progressPercent < 100) badges.push('Halfway There 🥈')
    if (progressPercent === 100) badges.push('Target Reached 🏆')

    return { percent: progressPercent, current, badges }
  }

  if (loading) return <Loading />

  // Group goals by status; show each client's photos once, under their first card
  const photosShownFor = new Set()
  const goalSections = groupGoalsByStatus(
    goals.map((goal) => {
      const progress = calculateProgress(goal)
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
              onClick={() => setShowForm((open) => !open)}
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
              Set a new goal
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
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="goal-client">Client *</label>
                  <select
                    id="goal-client"
                    className="form-select"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    required
                    disabled={submitting}
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
                    disabled={submitting}
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
                  <span className="form-hint">Filled in from the latest measurement</span>
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
                  {submitting ? <span className="btn-spinner" aria-hidden="true" /> : <Target size={18} aria-hidden="true" />}
                  {submitting ? 'Setting Goal...' : 'Set Goal'}
                </button>
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
