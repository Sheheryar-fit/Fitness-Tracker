import { useState, useEffect } from 'react'
import { NotebookPen, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

export default function ClientCoachNotes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNotes() {
      try {
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (clientErr || !clientData) throw clientErr

        const { data: notesData, error: notesErr } = await supabase
          .from('coach_notes')
          .select('*')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false })

        if (!notesErr) setNotes(notesData || [])
      } catch (err) {
        console.error('Error fetching coach notes:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotes()
  }, [])

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader title="Coach notes" subtitle="Feedback and notes from your trainer" />

      {notes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No notes yet"
          text="When your trainer adds a note, you'll find it here."
        />
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
    </div>
  )
}
