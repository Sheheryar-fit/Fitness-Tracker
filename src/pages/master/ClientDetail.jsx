import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import {
  Scale,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Ruler,
  User,
  Calendar,
  Clock,
  UserX,
  TriangleAlert
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  calcWeightChange,
  calcWeightChangePercent,
  getWeightColor,
  isPositiveProgress,
  calcDaysActive,
  calculateGoalProgress,
  getGoalStatus,
  groupGoalsByStatus,
  formatDate,
  formatHeight
} from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import Avatar from '../../components/Avatar'
import GoalBadge from '../../components/GoalBadge'
import GoalCard from '../../components/GoalCard'
import MeasurementCard from '../../components/MeasurementCard'
import StarRating from '../../components/StarRating'
import ProgressPhotos from '../../components/ProgressPhotos'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

// Placeholder for a section that has nothing in it yet
function SectionEmpty({ children }) {
  return (
    <div className="empty-state" style={{ padding: '1.5rem' }}>
      <p>{children}</p>
    </div>
  )
}

/**
 * Master Client Page (read-only)
 * Everything about one client in one place: profile, goals, measurements,
 * check-ins, coach notes and photos. Nothing here can be changed.
 */
export default function MasterClientDetail() {
  const { id } = useParams()
  const location = useLocation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Back to the list the master came from, with its filters
  const backTo = location.state?.from || '/master/clients'

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (clientErr) throw clientErr
      if (!client) {
        setData(null)
        return
      }

      const results = await Promise.all([
        supabase.from('users').select('id, username').in('id', [client.trainer_id, client.user_id].filter(Boolean)),
        supabase.from('measurements').select('*').eq('client_id', id).order('date', { ascending: false }),
        supabase.from('goals').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('weekly_checkins').select('*').eq('client_id', id).order('date', { ascending: false }),
        supabase.from('coach_notes').select('*').eq('client_id', id).order('created_at', { ascending: false })
      ])
      const failed = results.find((result) => result.error)
      if (failed) throw failed.error

      const [users, measurements, goals, checkins, notes] = results.map((result) => result.data || [])
      const usernames = Object.fromEntries(users.map((u) => [u.id, u.username]))
      setData({
        client,
        trainerName: usernames[client.trainer_id],
        clientUsername: usernames[client.user_id],
        measurements,
        goals,
        checkins,
        notes
      })
    } catch (err) {
      console.error('Error fetching client:', err)
      setError('Could not load this client. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading />

  if (error || !data) {
    return (
      <div>
        <PageHeader back={{ to: backTo, label: 'Clients' }} title="Client" />
        {error ? (
          <div className="alert alert-error" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : (
          <EmptyState icon={UserX} title="Client not found" text="This client doesn't exist or was deleted." />
        )}
      </div>
    )
  }

  const { client, trainerName, clientUsername, measurements, goals, checkins, notes } = data

  // Progress values, worked out the same way as the trainer's client page
  const weightChange = calcWeightChange(client.current_weight, client.starting_weight)
  const weightPercent = calcWeightChangePercent(client.current_weight, client.starting_weight)
  const weightColor = getWeightColor(weightChange, client.goal)
  const positive = isPositiveProgress(weightChange, client.goal)
  const daysActive = calcDaysActive(client.join_date)
  const latestMeasurement = measurements[0] ?? null
  const latestCheckin = checkins[0] ?? null
  const progressBarWidth = Math.min(Math.abs(weightPercent), 100)

  // Goals with progress, open ones first
  const goalItems = groupGoalsByStatus(
    goals.map((goal) => {
      const progress = calculateGoalProgress(goal, client.current_weight, latestMeasurement)
      return { goal, ...progress, status: getGoalStatus(progress.percent, goal.deadline) }
    })
  ).flatMap((section) => section.items)
  const completedGoals = goalItems.filter((item) => item.status === 'completed').length

  return (
    <div>
      <PageHeader
        back={{ to: backTo, label: 'Clients' }}
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
        {/* Client information */}
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

        {/* Coaching summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <CalendarDays size={20} aria-hidden="true" />
              Coaching
            </span>
          </div>
          <ul className="info-list">
            <li>
              <span className="info-label">Trainer</span>
              <span className="info-value">{trainerName || '—'}</span>
            </li>
            <li>
              <span className="info-label">Last measurement</span>
              <span className="info-value">{latestMeasurement ? formatDate(latestMeasurement.date) : '—'}</span>
            </li>
            <li>
              <span className="info-label">Last check-in</span>
              <span className="info-value">
                {latestCheckin ? `${formatDate(latestCheckin.date)} · ${latestCheckin.rating}/5` : '—'}
              </span>
            </li>
            <li>
              <span className="info-label">Goals</span>
              <span className="info-value">
                {goals.length ? `${completedGoals} of ${goals.length} completed` : '—'}
              </span>
            </li>
            <li>
              <span className="info-label">Coach notes</span>
              <span className="info-value">{notes.length}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Goals */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Goals
            <span className="section-count">{goals.length}</span>
          </h2>
        </div>
        {goalItems.length === 0 ? (
          <SectionEmpty>No goals set yet.</SectionEmpty>
        ) : (
          <div className="goal-list stagger">
            {goalItems.map(({ goal, percent, current, badges, status }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                title={`${goal.target_metric} goal`}
                percent={percent}
                current={current}
                badges={badges}
                status={status}
              />
            ))}
          </div>
        )}
      </section>

      {/* Measurement history */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Measurement history
            <span className="section-count">{measurements.length}</span>
          </h2>
        </div>
        {measurements.length === 0 ? (
          <SectionEmpty>No measurements yet.</SectionEmpty>
        ) : (
          <div className="timeline stagger">
            {measurements.map((m, index) => (
              <MeasurementCard
                key={m.id}
                measurement={m}
                // Previous measurement is the next in the array (newest first)
                prev={index < measurements.length - 1 ? measurements[index + 1] : null}
                // Weight is compared with the previous entry that has a weight
                prevWeighIn={measurements.slice(index + 1).find((x) => x.weight != null)}
                goal={client.goal}
              />
            ))}
          </div>
        )}
      </section>

      {/* Weekly check-ins */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Weekly check-ins
            <span className="section-count">{checkins.length}</span>
          </h2>
        </div>
        {checkins.length === 0 ? (
          <SectionEmpty>No check-ins yet.</SectionEmpty>
        ) : (
          <div className="feed stagger">
            {checkins.map((item) => (
              <article className="card feed-item" key={item.id}>
                <div className="feed-item-head">
                  <span className="measurement-date-label">
                    <Calendar size={16} aria-hidden="true" />
                    {formatDate(item.date)}
                  </span>
                  <StarRating value={item.rating} size={18} />
                </div>
                <p className="feed-item-body">{item.notes}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Coach notes */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Coach notes
            <span className="section-count">{notes.length}</span>
          </h2>
        </div>
        {notes.length === 0 ? (
          <SectionEmpty>No coach notes yet.</SectionEmpty>
        ) : (
          <div className="feed stagger">
            {notes.map((note) => (
              <article className="card feed-item" key={note.id}>
                <div className="feed-item-head">
                  <span className="feed-item-date">
                    <Clock size={14} aria-hidden="true" />
                    {formatDate(note.created_at)}
                  </span>
                </div>
                <p className="feed-item-body">{note.note_text}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Progress photos */}
      <div className="card section">
        <ProgressPhotos clientId={client.id} readOnly />
      </div>
    </div>
  )
}
