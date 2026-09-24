import { useState, useEffect } from 'react'
import { CalendarCheck, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import StarRating from '../../components/StarRating'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

export default function WeeklyCheckinClient() {
  const { user } = useAuth()
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (clientErr || !clientData) throw clientErr

        const { data: checkinData, error: checkinErr } = await supabase
          .from('weekly_checkins')
          .select('*')
          .eq('client_id', clientData.id)
          .order('date', { ascending: false })

        if (!checkinErr) setCheckins(checkinData || [])
      } catch (err) {
        console.error('Error fetching checkins:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader title="Weekly check-ins" subtitle="Your trainer's weekly ratings and feedback" />

      {checkins.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No check-ins yet"
          text="Your trainer will log your weekly feedback here."
        />
      ) : (
        <div className="feed stagger">
          {checkins.map((item) => (
            <article className="card feed-item" key={item.id}>
              <div className="feed-item-head">
                <span className="measurement-date-label">
                  <Calendar size={16} aria-hidden="true" />
                  {formatDate(item.date)}
                </span>
                <StarRating value={item.rating} size={18} />
              </div>
              <p className="feed-item-body">{item.notes}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
