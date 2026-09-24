import { useState, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Search, SearchX, Users, ChevronRight, TriangleAlert } from 'lucide-react'
import { ACTIVE_DAYS, fetchMasterRoster, getActiveSince, isActive } from '../../lib/masterData'
import { formatDate, formatGoal } from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

const GOAL_OPTIONS = [
  { value: 'all', label: 'All goals' },
  { value: 'fat_loss', label: 'Fat Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' }
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: `Active (last ${ACTIVE_DAYS} days)` },
  { value: 'inactive', label: 'Inactive' }
]

// A filter value from the URL, or 'all' if it isn't one of the options
function pickOption(options, value) {
  return options.some((option) => option.value === value) ? value : 'all'
}

/**
 * Master Client List Page
 * Every client across all trainers, with search and trainer / goal / status filters.
 * The filters live in the URL, so coming back from a client keeps them.
 */
export default function MasterClientList() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [trainers, setTrainers] = useState([])
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const activeSince = getActiveSince()

  useEffect(() => {
    fetchRoster()
  }, [])

  async function fetchRoster() {
    try {
      const roster = await fetchMasterRoster()
      setTrainers(roster.trainers)
      setClients(roster.clients)
    } catch (err) {
      console.error('Error fetching clients:', err)
      setError('Could not load the clients. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function setFilter(key, value) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  if (loading) return <Loading />

  const trainerOptions = [
    { value: 'all', label: 'All trainers' },
    ...trainers.map((t) => ({ value: t.id, label: t.username })).sort((a, b) => a.label.localeCompare(b.label))
  ]
  const trainerFilter = pickOption(trainerOptions, params.get('trainer'))
  const goalFilter = pickOption(GOAL_OPTIONS, params.get('goal'))
  const statusFilter = pickOption(STATUS_OPTIONS, params.get('status'))
  const trainerNames = Object.fromEntries(trainers.map((t) => [t.id, t.username]))

  const query = search.trim().toLowerCase()
  const filtering = trainerFilter !== 'all' || goalFilter !== 'all' || statusFilter !== 'all' || query !== ''
  const visibleClients = clients
    .filter(
      (c) =>
        (trainerFilter === 'all' || c.trainerId === trainerFilter) &&
        (goalFilter === 'all' || c.goal === goalFilter) &&
        (statusFilter === 'all' || isActive(c, activeSince) === (statusFilter === 'active')) &&
        (!query || c.name.toLowerCase().includes(query))
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const subtitle = filtering
    ? `Showing ${visibleClients.length} of ${clients.length} clients`
    : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'} across ${trainers.length} ${trainers.length === 1 ? 'trainer' : 'trainers'}`

  return (
    <div>
      <PageHeader title="Clients" subtitle={error ? undefined : subtitle} />

      {error ? (
        <div className="alert alert-error" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          text="Clients show up here once a trainer adds them."
        />
      ) : (
        <>
          {/* Search + filters */}
          <div className="toolbar">
            <div className="input-wrap has-icon">
              <Search size={18} className="input-icon" aria-hidden="true" />
              <input
                type="search"
                className="form-input"
                placeholder="Search clients by name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search clients by name"
              />
            </div>
            <select
              className="form-select"
              value={trainerFilter}
              onChange={(e) => setFilter('trainer', e.target.value)}
              aria-label="Filter by trainer"
            >
              {trainerOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={goalFilter}
              onChange={(e) => setFilter('goal', e.target.value)}
              aria-label="Filter by goal"
            >
              {GOAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setFilter('status', e.target.value)}
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {visibleClients.length === 0 ? (
            <EmptyState icon={SearchX} title="No matching clients" text="Try a different name or filter." />
          ) : (
            <div className="card">
              <ul className="list stagger">
                {visibleClients.map((client) => {
                  const active = isActive(client, activeSince)
                  return (
                    <li key={client.id}>
                      <Link
                        to={`/master/clients/${client.id}`}
                        state={{ from: `${location.pathname}${location.search}` }}
                        className="list-row"
                      >
                        <Avatar name={client.name} size="sm" />
                        <div className="list-row-main">
                          <div className="list-row-title">{client.name}</div>
                          <div className="list-row-meta">
                            Trainer: {trainerNames[client.trainerId] ?? '—'} · {formatGoal(client.goal)}
                          </div>
                          <div className="list-row-meta">
                            {client.lastActivity ? `Last activity ${formatDate(client.lastActivity)}` : 'No activity yet'}
                          </div>
                        </div>
                        <span className={`badge ${active ? 'badge-success' : ''}`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                        <ChevronRight size={18} className="stat-link-arrow" aria-hidden="true" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
