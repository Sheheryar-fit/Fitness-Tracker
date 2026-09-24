import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Scale,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  User,
  Ruler,
  Target,
  NotebookPen,
  CalendarCheck,
  ChevronRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  calcWeightChange,
  calcDaysActive,
  getWeightColor,
  isPositiveProgress,
  formatDate
} from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import GoalBadge from '../../components/GoalBadge'
import Loading from '../../components/Loading'

const QUICK_LINKS = [
  { to: '/client/measurements', icon: Ruler, title: 'My Progress', text: 'Weight and measurement history' },
  { to: '/client/goals', icon: Target, title: 'My Goals', text: 'Targets, milestones and photos' },
  { to: '/client/notes', icon: NotebookPen, title: 'Coach Notes', text: 'Feedback from your trainer' },
  { to: '/client/checkins', icon: CalendarCheck, title: 'Check-ins', text: 'Your weekly ratings' },
  { to: '/client/profile', icon: User, title: 'My Profile', text: 'Your details and weight progress' }
]

/**
 * Client Dashboard Page
 * Welcome, key numbers and links to every section
 */
export default function ClientDashboard() {
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchClient() {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (!error && data) {
          setClient(data)
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchClient()
  }, [])

  if (loading) return <Loading />

  const firstName = client?.name?.split(' ')[0] || user.username
  const hasWeights = client?.current_weight != null && client?.starting_weight != null
  const change = hasWeights ? calcWeightChange(client.current_weight, client.starting_weight) : 0
  const positive = isPositiveProgress(change, client?.goal)

  return (
    <div>
      <PageHeader
        eyebrow="Your fitness journey"
        title={`Welcome, ${firstName}`}
        subtitle={client ? <GoalBadge goal={client.goal} /> : 'Track your progress with your trainer'}
      />

      {client && (
        <div className="stat-grid stagger">
          <StatCard
            icon={Scale}
            label="Current weight"
            value={client.current_weight != null ? <>{client.current_weight}<small>kg</small></> : '—'}
            hint={client.starting_weight != null ? `Started at ${client.starting_weight} kg` : null}
            to="/client/measurements"
          />
          <StatCard
            icon={positive ? TrendingDown : TrendingUp}
            tone={positive ? 'green' : 'red'}
            label="Total change"
            value={hasWeights ? <>{change > 0 ? '+' : ''}{change}<small>kg</small></> : '—'}
            valueStyle={hasWeights ? { color: getWeightColor(change, client.goal) } : undefined}
            hint="Since you joined"
          />
          <StatCard
            icon={CalendarDays}
            tone="blue"
            label="Days active"
            value={calcDaysActive(client.join_date)}
            hint={`Joined ${formatDate(client.join_date)}`}
          />
        </div>
      )}

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Explore</h2>
        </div>
        <div className="quick-grid stagger">
          {QUICK_LINKS.map(({ to, icon: Icon, title, text }) => (
            <Link key={to} to={to} className="card card-interactive quick-link">
              <span className="icon-chip">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="quick-link-text">
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <ChevronRight size={20} className="chevron" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
