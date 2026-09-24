import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users, Eye, Pencil, Trash2, SearchX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, calcWeightChange, getWeightColor } from '../../utils/calculations'
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

/**
 * Client List Page (Admin)
 * Searchable, filterable cards with view/edit/delete actions
 */
export default function ClientList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [goalFilter, setGoalFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState({ message: '', error: false })

  useEffect(() => {
    fetchClients()
  }, [])

  // Fetch all clients for this trainer
  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setClients(data || [])
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

  if (loading) return <Loading />

  const query = search.trim().toLowerCase()
  const visibleClients = clients.filter(
    (c) =>
      (goalFilter === 'all' || c.goal === goalFilter) &&
      (!query || c.name.toLowerCase().includes(query))
  )

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`}
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
          {/* Search + goal filter */}
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
                  onClick={() => setGoalFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {visibleClients.length === 0 ? (
            <EmptyState icon={SearchX} title="No matching clients" text="Try a different name or filter." />
          ) : (
            <div className="client-grid stagger">
              {visibleClients.map((client) => {
                const change = calcWeightChange(client.current_weight, client.starting_weight)
                const hasWeights = client.current_weight != null && client.starting_weight != null
                return (
                  <article key={client.id} className="card card-interactive client-card">
                    <div className="client-card-head">
                      <Avatar name={client.name} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link to={`/admin/clients/${client.id}`} className="client-card-name">
                          {client.name}
                        </Link>
                        <div className="client-card-meta">Joined {formatDate(client.join_date)}</div>
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
                        onClick={() => navigate(`/admin/clients/${client.id}`)}
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
