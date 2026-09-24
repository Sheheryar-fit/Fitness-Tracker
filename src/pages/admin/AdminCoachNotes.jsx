import { useState, useEffect } from 'react'
import { NotebookPen, Send, Trash2, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'
import { formatDate } from '../../utils/calculations'

export default function AdminCoachNotes({ clientId, trainerId }) {
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    fetchNotes()
  }, [clientId])

  async function fetchNotes() {
    try {
      const { data, error } = await supabase
        .from('coach_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotes(data || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!newNote.trim()) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('coach_notes')
        .insert({
          client_id: clientId,
          trainer_id: trainerId,
          note_text: newNote.trim()
        })
        .select()

      if (error) throw error

      if (data && data[0]) {
        setNotes((prev) => [data[0], ...prev])
        setNewNote('')
      }
    } catch (err) {
      console.error('Error adding note:', err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteNote() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase
        .from('coach_notes')
        .delete()
        .eq('id', deleteTarget)

      if (error) throw error
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting note:', err)
    }
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">
          Coach notes
          {!loading && <span className="section-count">{notes.length}</span>}
        </h2>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <form onSubmit={handleAddNote}>
          <div className="form-group">
            <label className="form-label" htmlFor="new-coach-note">
              New note for this client
            </label>
            <textarea
              id="new-coach-note"
              className="form-input"
              rows="3"
              placeholder="Feedback, technique cues, nutrition tips..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting || !newNote.trim()}>
              {submitting ? <span className="btn-spinner" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
              {submitting ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <Loading inline />
      ) : notes.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No coach notes yet" text="Notes you add here show up for the client too." />
      ) : (
        <div className="feed stagger">
          {notes.map((note) => (
            <article className="card feed-item" key={note.id}>
              <div className="feed-item-head">
                <span className="feed-item-date">
                  <Clock size={14} aria-hidden="true" />
                  {formatDate(note.created_at)}
                </span>
                <button
                  className="icon-btn danger"
                  onClick={() => setDeleteTarget(note.id)}
                  aria-label="Delete note"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
              <p className="feed-item-body">{note.note_text}</p>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Note"
        message="Are you sure you want to delete this note?"
        onConfirm={handleDeleteNote}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}
