import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, Activity, UserPlus, CalendarCheck, Target, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { calcDaysActive, formatDate, formatGoal, getLocalDateString } from '../../utils/calculations'
import { ACTIVE_DAYS, fetchClientActivity, findQuietClients, getActiveSince } from '../../lib/clientActivity'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

const QUICK_ACTIONS = [
  { to: '/admin/clients/add', icon: UserPlus, title: 'Add a client', text: 'Create a profile and login' },
  { to: '/admin/checkins', icon: CalendarCheck, title: 'Log a check-in', text: 'Weekly rating and feedback' },
  { to: '/admin/goals', icon: Target, title: 'Set a goal', text: 'Targets with live progress' }
]

const QUIET_SHOWN = 5

/**
 * Admin Dashboard Page
 * Key numbers, clients who have gone quiet, quick actions and the most recently added clients
 */
export default function AdminDashboard() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [activeClients, setActiveClients] = useState(0)
  const [checkinsThisWeek, setCheckinsThisWeek] = useState(0)
  const [quietClients, setQuietClients] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const startOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1))
  const weekAgo = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))

  useEffect(() => {
    fetchStats()
  }, [])

  // Fetch dashboard statistics
  async function fetchStats() {
    try {
      // Get all clients for this trainer (newest first)
      const { data: clientData, error } = await supabase
        .from('clients')
        .select('id, name, join_date, goal, current_weight, created_at')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setClients(clientData || [])

      const clientIds = clientData?.map((c) => c.id) || []

      if (clientIds.length > 0) {
        // Active this month = clients who have measurements this month
        const { data: measurements, error: mError } = await supabase
          .from('measurements')
          .select('client_id')
          .in('client_id', clientIds)
          .gte('date', startOfMonth)

        if (!mError && measurements) {
          setActiveClients(new Set(measurements.map((m) => m.client_id)).size)
        }

        // Check-ins logged in the last 7 days
        const { count, error: cError } = await supabase
          .from('weekly_checkins')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', user.id)
          .gte('date', weekAgo)

        if (!cError) setCheckinsThisWeek(count || 0)

        // A failure here only hides the "quiet clients" list, not the rest of the dashboard
        try {
          const activity = await fetchClientActivity(user.id)
          setQuietClients(findQuietClients(activity, getActiveSince()))
        } catch (activityErr) {
          console.error('Error fetching client activity:', activityErr)
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading />

  const newThisMonth = clients.filter((c) => c.join_date && c.join_date >= startOfMonth).length
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      <PageHeader
        eyebrow={today}
        title={`Welcome back, ${user.username}`}
        subtitle="Here's how your clients are doing"
        actions={
          <Link to="/admin/clients/add" className="btn btn-primary" id="add-client-btn">
            <UserPlus size={18} aria-hidden="true" />
            Add Client
          </Link>
        }
      />

      {/* Key numbers */}
      <div className="stat-grid stagger">
        <StatCard icon={Users} label="Total clients" value={clients.length} to="/admin/clients" />
        <StatCard
          icon={Activity}
          tone="green"
          label="Measured this month"
          value={activeClients}
          hint={clients.length ? `${Math.round((activeClients / clients.length) * 100)}% of clients` : null}
        />
        <StatCard icon={UserPlus} tone="blue" label="New this month" value={newThisMonth} />
        <StatCard
          icon={CalendarCheck}
          tone="orange"
          label="Check-ins, last 7 days"
          value={checkinsThisWeek}
          to="/admin/checkins"
        />
      </div>

      {/* Clients with no measurement or check-in lately, longest quiet first */}
      {quietClients.length > 0 && (
        <section className="section" aria-labelledby="quiet-clients-title">
          <div className="section-header">
            <h2 className="section-title" id="quiet-clients-title">
              Quiet clients
              <span className="section-count">{quietClients.length}</span>
            </h2>
            <Link to="/admin/clients?status=quiet&sort=quiet" className="btn btn-ghost btn-sm">
              View all
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="card">
            <ul className="list stagger">
              {quietClients.slice(0, QUIET_SHOWN).map((client) => (
                <li key={client.id}>
                  <Link to={`/admin/clients/${client.id}`} className="list-row">
                    <Avatar name={client.name} size="sm" />
                    <div className="list-row-main">
                      <div className="list-row-title">{client.name}</div>
                      <div className="list-row-meta">
                        {client.lastActivity
                          ? `Last activity ${formatDate(client.lastActivity)}`
                          : 'No activity since joining'}
                      </div>
                    </div>
                    {client.quietSince && (
                      <span className="badge badge-warning">{calcDaysActive(client.quietSince)} days</span>
                    )}
                    <ChevronRight size={18} className="stat-link-arrow" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="section-note">
            {quietClients.length > QUIET_SHOWN && `Showing the ${QUIET_SHOWN} quietest. `}
            Quiet means no measurement or check-in in the last {ACTIVE_DAYS} days.
          </p>
        </section>
      )}

      <div className="grid-2 section">
        {/* Quick actions */}
        <section>
          <div className="section-header">
            <h2 className="section-title">Quick actions</h2>
          </div>
          <div className="quick-grid stagger" style={{ gridTemplateColumns: '1fr' }}>
            {QUICK_ACTIONS.map(({ to, icon: Icon, title, text }) => (
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

        {/* Recently added clients */}
        <section>
          <div className="section-header">
            <h2 className="section-title">Recent clients</h2>
            {clients.length > 0 && (
              <Link to="/admin/clients" className="btn btn-ghost btn-sm">
                View all
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              text="Add your first client to start tracking their progress."
              action={
                <Link to="/admin/clients/add" className="btn btn-primary">
                  <UserPlus size={18} aria-hidden="true" />
                  Add Client
                </Link>
              }
            />
          ) : (
            <div className="card">
              <ul className="list stagger">
                {clients.slice(0, 5).map((client) => (
                  <li key={client.id}>
                    <Link to={`/admin/clients/${client.id}`} className="list-row">
                      <Avatar name={client.name} size="sm" />
                      <div className="list-row-main">
                        <div className="list-row-title">{client.name}</div>
                        <div className="list-row-meta">
                          {formatGoal(client.goal)} · joined {formatDate(client.join_date)}
                        </div>
                      </div>
                      <ChevronRight size={18} className="stat-link-arrow" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
