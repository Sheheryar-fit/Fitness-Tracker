import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, Dumbbell, Activity, UserPlus, ChevronRight, TriangleAlert } from 'lucide-react'
import { ACTIVE_DAYS, fetchMasterRoster, getActiveSince, isActive, latestDate } from '../../lib/masterData'
import { formatDate, getLocalDateString } from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

/**
 * Master Dashboard Page
 * Read-only overview across every trainer and client
 */
export default function MasterDashboard() {
  const [trainers, setTrainers] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const now = new Date()
  const startOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1))
  const activeSince = getActiveSince()

  useEffect(() => {
    fetchOverview()
  }, [])

  async function fetchOverview() {
    try {
      const roster = await fetchMasterRoster()
      setTrainers(roster.trainers)
      setClients(roster.clients)
    } catch (err) {
      console.error('Error fetching overview:', err)
      setError('Could not load the overview. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading />

  const activeCount = clients.filter((c) => isActive(c, activeSince)).length
  const newThisMonth = clients.filter((c) => c.joinDate && c.joinDate >= startOfMonth).length
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Busiest trainers first
  const trainerRows = trainers
    .map((trainer) => {
      const mine = clients.filter((c) => c.trainerId === trainer.id)
      return {
        ...trainer,
        clientCount: mine.length,
        activeCount: mine.filter((c) => isActive(c, activeSince)).length,
        lastActivity: latestDate(mine.map((c) => c.lastActivity))
      }
    })
    .sort((a, b) => b.clientCount - a.clientCount || a.username.localeCompare(b.username))

  return (
    <div>
      <PageHeader eyebrow={today} title="Overview" subtitle="Every trainer and client, read-only" />

      {error ? (
        <div className="alert alert-error" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* Key numbers */}
          <div className="stat-grid stagger">
            <StatCard icon={Dumbbell} label="Trainers" value={trainers.length} />
            <StatCard icon={Users} tone="blue" label="Clients" value={clients.length} to="/master/clients" />
            <StatCard
              icon={Activity}
              tone="green"
              label={`Active, last ${ACTIVE_DAYS} days`}
              value={activeCount}
              hint={clients.length ? `${Math.round((activeCount / clients.length) * 100)}% of clients` : null}
              to="/master/clients?status=active"
            />
            <StatCard icon={UserPlus} tone="orange" label="New this month" value={newThisMonth} />
          </div>

          {/* Trainers */}
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">
                Trainers
                <span className="section-count">{trainers.length}</span>
              </h2>
            </div>
            {trainers.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="No trainers yet"
                text="Trainers show up here once they have an account."
              />
            ) : (
              <div className="card">
                <ul className="list stagger">
                  {trainerRows.map((trainer) => (
                    <li key={trainer.id}>
                      <Link to={`/master/clients?trainer=${trainer.id}`} className="list-row">
                        <Avatar name={trainer.username} size="sm" />
                        <div className="list-row-main">
                          <div className="list-row-title">{trainer.username}</div>
                          <div className="list-row-meta">
                            {trainer.clientCount} {trainer.clientCount === 1 ? 'client' : 'clients'} · {trainer.activeCount} active
                          </div>
                          <div className="list-row-meta">
                            {trainer.lastActivity ? `Last activity ${formatDate(trainer.lastActivity)}` : 'No activity yet'}
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
        </>
      )}
    </div>
  )
}
