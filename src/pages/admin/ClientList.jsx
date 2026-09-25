import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, UserPlus, Users, Eye, Pencil, Trash2, SearchX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, calcWeightChange, getWeightColor } from '../../utils/calculations'
import { ACTIVE_DAYS, fetchClientActivity, getActiveSince, getQuietSince, isQuiet } from '../../lib/clientActivity'
import ConfirmDialog from '../../components/ConfirmDialog'
import GoalBadge from '../../components/GoalBadge'
import PageHeader from '../../components/PageHeader'
import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'
import Toast from '../../components/Toast'
import { removePhotoFiles } from '../../lib/photoStorage'

const GOAL_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'fat_loss', label: 'Fat Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' }
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'quiet', label: `Quiet (${ACTIVE_DAYS}+ days)` }
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'quiet', label: 'Longest quiet first' }
]

// A filter value from the URL, or the fallback if it isn't one of the options
function pickOption(options, value, fallback) {
  return options.some((option) => option.value === value) ? value : fallback
}

/**
 * Client List Page (Admin)
 * Searchable, filterable, sortable cards with view/edit/delete actions.
 * The goal, status and sort choices live in the URL, so coming back from a client keeps them.
 */
export default function ClientList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [clients, setClients] = useState([])
  const [activity, setActivity] = useState(null) // id -> { lastActivity, joinDate }, null if it couldn't load
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState({ message: '', error: false })

  useEffect(() => {
    fetchClients()
  }, [])

  // Fetch all clients for this trainer, and when each was last active
  async function fetchClients() {
    try {
      // If the activity lookup fails, only the status filter and the "quiet" sort go away
      const activityRequest = fetchClientActivity(user.id).catch((err) => {
        console.error('Error fetching client activity:', err)
        return null
      })

      const [{ data, error }, activityRows] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .eq('trainer_id', user.id)
          .order('created_at', { ascending: false }),
        activityRequest
      ])

      if (error) throw error
      setClients(data || [])
      setActivity(activityRows && Object.fromEntries(activityRows.map((row) => [row.id, row])))
    } catch (err) {
      console.error('Error fetching clients:', err)
    } finally {
      setLoading(false)
    }
  }

  // Delete a client and their related data
  async function handleDelete() {
    if (!deleteTarget) return

    try {
      // Delete the client's photo files first; the database can't remove storage files
      const { data: photos } = await supabase
        .from('progress_photos')
        .select('photo_url')
        .eq('client_id', deleteTarget.id)
      const fileError = await removePhotoFiles((photos || []).map((p) => p.photo_url))
      if (fileError) console.error('Error deleting photo files:', fileError)

      // Deletes the client, all their data and their login in one step
      const { error: deleteError } = await supabase.rpc('delete_client', {
        p_client_id: deleteTarget.id
      })

      if (deleteError) throw deleteError

      // Update UI
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
      showToast('Client deleted successfully')
    } catch (err) {
      console.error('Error deleting client:', err)
      setDeleteTarget(null)
      showToast('Could not delete the client. Please try again.', true)
    }
  }

  // Show toast notification
  function showToast(message, error = false) {
    setToast({ message, error })
    setTimeout(() => setToast({ message: '', error: false }), 3000)
  }

  function setFilter(key, value, defaultValue = 'all') {
    const next = new URLSearchParams(params)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  function clearFilters() {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
  }

  if (loading) return <Loading />

  const activeSince = getActiveSince()
  const hasActivity = activity !== null
  const sortOptions = hasActivity ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.value !== 'quiet')
  const goalFilter = pickOption(GOAL_FILTERS, params.get('goal'), 'all')
  const statusFilter = hasActivity ? pickOption(STATUS_OPTIONS, params.get('status'), 'all') : 'all'
  const sortBy = pickOption(sortOptions, params.get('sort'), 'newest')

  // Each client with the date they have been quiet since (a new client counts from their join date)
  const rows = clients.map((client) => {
    const row = activity?.[client.id] ?? { lastActivity: null, joinDate: client.join_date }
    return {
      client,
      lastActivity: row.lastActivity,
      quietSince: getQuietSince(row),
      quiet: isQuiet(row, activeSince)
    }
  })

  const query = search.trim().toLowerCase()
  const filtering = goalFilter !== 'all' || statusFilter !== 'all' || query !== ''
  const visibleRows = rows
    .filter(
      ({ client, quiet }) =>
        (goalFilter === 'all' || client.goal === goalFilter) &&
        (statusFilter === 'all' || quiet) &&
        (!query || client.name.toLowerCase().includes(query))
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.client.name.localeCompare(b.client.name)
      if (sortBy === 'name_desc') return b.client.name.localeCompare(a.client.name)
      if (sortBy === 'quiet') {
        return (a.quietSince ?? '').localeCompare(b.quietSince ?? '') || a.client.name.localeCompare(b.client.name)
      }
      return 0 // newest first: the order the clients were loaded in
    })

  const backState = { from: `${location.pathname}${location.search}` }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={
          filtering
            ? `Showing ${visibleRows.length} of ${clients.length} clients`
            : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`
        }
        actions={
          <Link to="/admin/clients/add" className="btn btn-primary" id="add-client-btn">
            <UserPlus size={18} aria-hidden="true" />
            Add Client
          </Link>
        }
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          text="Start by adding your first gym client. They get their own login to follow their progress."
          action={
            <Link to="/admin/clients/add" className="btn btn-primary">
              <UserPlus size={18} aria-hidden="true" />
              Add Your First Client
            </Link>
          }
        />
      ) : (
        <>
          {/* Search, goal filter, status filter and sort */}
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
            <div className="badge-row" role="group" aria-label="Filter by goal">
              {GOAL_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`btn btn-sm ${goalFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
                  aria-pressed={goalFilter === f.value}
                  onClick={() => setFilter('goal', f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {hasActivity && (
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
            )}
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setFilter('sort', e.target.value, 'newest')}
              aria-label="Sort clients"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {visibleRows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching clients"
              text="Try a different name or filter."
              action={
                filtering && (
                  <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                )
              }
            />
          ) : (
            <div className="client-grid stagger">
              {visibleRows.map(({ client, lastActivity }) => {
                const change = calcWeightChange(client.current_weight, client.starting_weight)
                const hasWeights = client.current_weight != null && client.starting_weight != null
                return (
                  <article key={client.id} className="card card-interactive client-card">
                    <div className="client-card-head">
                      <Avatar name={client.name} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link to={`/admin/clients/${client.id}`} state={backState} className="client-card-name">
                          {client.name}
                        </Link>
                        <div className="client-card-meta">Joined {formatDate(client.join_date)}</div>
                        {hasActivity && (
                          <div className="client-card-meta">
                            {lastActivity ? `Last activity ${formatDate(lastActivity)}` : 'No activity yet'}
                          </div>
                        )}
                      </div>
                      <GoalBadge goal={client.goal} />
                    </div>

                    <div className="client-card-stats">
                      <div>
                        <div className="mini-stat-label">Current</div>
                        <div className="mini-stat-value">
                          {client.current_weight != null ? `${client.current_weight} kg` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="mini-stat-label">Change</div>
                        <div
                          className="mini-stat-value"
                          style={hasWeights ? { color: getWeightColor(change, client.goal) } : undefined}
                        >
                          {hasWeights ? `${change > 0 ? '+' : ''}${change} kg` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="mini-stat-label">Age</div>
                        <div className="mini-stat-value">{client.age ?? '—'}</div>
                      </div>
                    </div>

                    <div className="client-card-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/admin/clients/${client.id}`, { state: backState })}
                      >
                        <Eye size={16} aria-hidden="true" />
                        View
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/admin/clients/${client.id}/edit`)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => setDeleteTarget(client)}
                        aria-label={`Delete ${client.name}`}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Client"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This also deletes their login, measurements, goals, notes, check-ins and photos. This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast.message} error={toast.error} />
    </div>
  )
}
