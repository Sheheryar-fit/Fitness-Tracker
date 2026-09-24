import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Plus, X, Send, Trash2, Clock, Users, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, getLocalDateString } from '../../utils/calculations'
import ConfirmDialog from '../../components/ConfirmDialog'
import PageHeader from '../../components/PageHeader'
import StarRating from '../../components/StarRating'
import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

export default function WeeklyCheckinAdmin() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [checkins, setCheckins] = useState([])
  
  // Form State
  const [selectedClientId, setSelectedClientId] = useState('')
  const [date, setDate] = useState(getLocalDateString())
  const [rating, setRating] = useState(3)
  const [notes, setNotes] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      // Get all clients for this trainer
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('id, name')
        .eq('trainer_id', user.id)
        .order('name')

      if (clientErr) throw clientErr
      setClients(clientsData || [])

      // Get all checkins
      const { data: checkinData, error: checkinErr } = await supabase
        .from('weekly_checkins')
        .select('*, client:clients(name)')
        .eq('trainer_id', user.id)
        .order('date', { ascending: false })

      if (checkinErr) throw checkinErr
      setCheckins(checkinData || [])
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
        .from('weekly_checkins')
        .insert({
          client_id: selectedClientId,
          trainer_id: user.id,
          date,
          rating,
          notes: notes.trim()
        })
        .select('*, client:clients(name)')

      if (error) throw error

      if (data && data[0]) {
        setCheckins((prev) => [data[0], ...prev])
        setNotes('')
        setRating(3)
        setShowForm(false)
      }
    } catch (err) {
      console.error('Error adding checkin:', err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase
        .from('weekly_checkins')
        .delete()
        .eq('id', deleteTarget)

      if (error) throw error
      setCheckins((prev) => prev.filter((c) => c.id !== deleteTarget))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting checkin:', err)
    }
  }

  if (loading) return <Loading />

  // The form is always open while there are no check-ins yet
  const formOpen = showForm || checkins.length === 0

  return (
    <div>
      <PageHeader
        title="Weekly check-ins"
        subtitle="Log and review weekly feedback for your clients"
        actions={
          checkins.length > 0 && (
            <button
              className={`btn ${formOpen ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => setShowForm((open) => !open)}
              aria-expanded={formOpen}
              aria-controls="new-checkin-form"
            >
              {formOpen ? <X size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
              {formOpen ? 'Close' : 'Log Check-in'}
            </button>
          )
        }
      />

      {formOpen && (
        <div className="card page" id="new-checkin-form" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <span className="card-title">
              <CalendarCheck size={20} aria-hidden="true" />
              Log a check-in
            </span>
          </div>

          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              text="Add a client first, then log their weekly check-ins here."
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
                  <label className="form-label" htmlFor="checkin-client">Client *</label>
                  <select
                    id="checkin-client"
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
                  <label className="form-label" htmlFor="checkin-date">Date</label>
                  <input
                    id="checkin-date"
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <span className="form-label" id="checkin-rating-label">How was the week?</span>
                <StarRating value={rating} onChange={setRating} disabled={submitting} />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="checkin-notes">Feedback notes *</label>
                <textarea
                  id="checkin-notes"
                  className="form-input"
                  rows="4"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="How did the client perform this week? Any adjustments needed?"
                ></textarea>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting || !selectedClientId}>
                  {submitting ? <span className="btn-spinner" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                  {submitting ? 'Logging...' : 'Log Check-in'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <section>
        <div className="section-header">
          <h2 className="section-title">
            History
            <span className="section-count">{checkins.length}</span>
          </h2>
        </div>

        {checkins.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No check-ins yet" text="Check-ins you log appear here, newest first." />
        ) : (
          <div className="feed stagger">
            {checkins.map((item) => (
              <article className="card feed-item" key={item.id}>
                <div className="feed-item-head">
                  <div className="feed-item-meta">
                    <Avatar name={item.client?.name} size="sm" />
                    <div>
                      <div className="feed-item-title">{item.client?.name || 'Unknown client'}</div>
                      <span className="feed-item-date">
                        <Clock size={14} aria-hidden="true" />
                        {formatDate(item.date)}
                      </span>
                    </div>
                  </div>
                  <div className="feed-item-meta">
                    <StarRating value={item.rating} size={18} />
                    <button
                      className="icon-btn danger"
                      onClick={() => setDeleteTarget(item.id)}
                      aria-label={`Delete check-in for ${item.client?.name || 'client'}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <p className="feed-item-body">{item.notes}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Check-in"
        message="Are you sure you want to delete this check-in entry?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
