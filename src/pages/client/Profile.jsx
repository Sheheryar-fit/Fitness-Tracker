import { useState, useEffect } from 'react'
import { User, Scale, Calendar, CalendarDays, Ruler, UserX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  calcWeightChange,
  calcWeightChangePercent,
  getWeightColor,
  isPositiveProgress,
  calcDaysActive,
  formatGoal,
  formatDate,
  formatHeight
} from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import Avatar from '../../components/Avatar'
import GoalBadge from '../../components/GoalBadge'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

/**
 * Client Profile Page (Read-Only)
 * Shows profile info, weight progress, and latest measurements
 */
export default function ClientProfile() {
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [latestMeasurement, setLatestMeasurement] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch client data
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (clientErr) throw clientErr
        setClient(clientData)

        // Fetch latest measurement
        if (clientData) {
          const { data: measData } = await supabase
            .from('measurements')
            .select('*')
            .eq('client_id', clientData.id)
            .order('date', { ascending: false })
            .limit(1)

          if (measData && measData.length > 0) {
            setLatestMeasurement(measData[0])
          }
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <Loading />

  if (!client) {
    return (
      <EmptyState
        icon={UserX}
        title="Profile not found"
        text="Your trainer hasn't finished setting up your profile yet. Try again later."
      />
    )
  }

  // Calculate progress
  const weightChange = calcWeightChange(client.current_weight, client.starting_weight)
  const weightPercent = calcWeightChangePercent(client.current_weight, client.starting_weight)
  const weightColor = getWeightColor(weightChange, client.goal)
  const positive = isPositiveProgress(weightChange, client.goal)
  const daysActive = calcDaysActive(client.join_date)
  const progressBarWidth = Math.min(Math.abs(weightPercent), 100)

  const latestItems = [
    { key: 'weight', label: 'Weight', unit: 'kg', wide: true },
    { key: 'chest', label: 'Chest', unit: 'in' },
    { key: 'waist', label: 'Waist', unit: 'in' },
    { key: 'arms', label: 'Arms', unit: 'in' },
    { key: 'thigh', label: 'Thigh', unit: 'in' }
  ]

  return (
    <div>
      <PageHeader
        lead={<Avatar name={client.name} size="lg" />}
        title={client.name}
        subtitle={
          <div className="profile-meta">
            <GoalBadge goal={client.goal} />
            <span className="badge">
              <CalendarDays size={14} aria-hidden="true" />
              {daysActive} days active
            </span>
          </div>
        }
      />

      <div className="grid-2">
        {/* Profile Card (Read-Only) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <User size={20} aria-hidden="true" />
              Personal information
            </span>
          </div>
          <ul className="info-list">
            <li>
              <span className="info-label">Age</span>
              <span className="info-value">{client.age || '—'}</span>
            </li>
            <li>
              <span className="info-label">Height</span>
              <span className="info-value">{formatHeight(client.height)}</span>
            </li>
            <li>
              <span className="info-label">Goal</span>
              <span className="info-value">{formatGoal(client.goal)}</span>
            </li>
            <li>
              <span className="info-label">Joined</span>
              <span className="info-value">{formatDate(client.join_date)}</span>
            </li>
          </ul>
        </div>

        {/* Weight Progress Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Scale size={20} aria-hidden="true" />
              Weight progress
            </span>
          </div>

          <div className="stat-label">Total weight change</div>
          <div className="weight-change-value" style={{ color: weightColor, marginTop: '0.35rem' }}>
            {weightChange > 0 ? '+' : ''}{weightChange} kg
          </div>

          <div style={{ margin: '1.25rem 0' }}>
            <div className="progress-track">
              <div
                className={`progress-fill ${positive ? 'tone-green' : 'tone-red'}`}
                style={{ transform: `scaleX(${progressBarWidth / 100})` }}
              />
            </div>
            <div className="progress-meta">
              <span>Change since joining</span>
              <strong style={{ color: weightColor }}>
                {weightPercent > 0 ? '+' : ''}{weightPercent}%
              </strong>
            </div>
          </div>

          <ul className="info-list">
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
        </div>
      </div>

      {/* Latest Measurements */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Latest measurements</h2>
          {latestMeasurement && (
            <span className="feed-item-date">
              <Calendar size={14} aria-hidden="true" />
              {formatDate(latestMeasurement.date)}
            </span>
          )}
        </div>

        {latestMeasurement ? (
          <div className="measurement-card">
            <div className="measurement-values stagger">
              {latestItems.map(({ key, label, unit, wide }) => (
                <div className={`measurement-item ${wide ? 'measurement-item-wide' : ''}`} key={key}>
                  <div className="m-label">{label}</div>
                  <div className="m-value">
                    {latestMeasurement[key] ?? '—'}<span className="m-unit">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState icon={Ruler} title="No measurements yet" text="Your trainer will add your measurements." />
        )}
      </section>
    </div>
  )
}
