import { useState, useEffect } from 'react'
import { Ruler } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import MeasurementCard from '../../components/MeasurementCard'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

/**
 * Client Measurement History Page (Read-Only)
 * Displays all measurements as cards, newest first
 * Shows change from previous entry, color-coded
 */
export default function MeasurementHistory() {
  const { user } = useAuth()
  const [measurements, setMeasurements] = useState([])
  const [goal, setGoal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        // First get client_id from user_id
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('id, goal')
          .eq('user_id', user.id)
          .single()

        if (clientErr || !clientData) throw clientErr || new Error('Client not found')
        setGoal(clientData.goal)

        // Fetch all measurements
        const { data: measData, error: measErr } = await supabase
          .from('measurements')
          .select('*')
          .eq('client_id', clientData.id)
          .order('date', { ascending: false })

        if (!measErr) setMeasurements(measData || [])
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader
        title="My progress"
        subtitle="Your weight and measurement history, newest first"
      />

      {measurements.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No measurements yet"
          text="Your trainer will add your measurements here."
        />
      ) : (
        <div className="timeline stagger">
          {measurements.map((m, index) => (
            <MeasurementCard
              key={m.id}
              measurement={m}
              prev={index < measurements.length - 1 ? measurements[index + 1] : null}
              // Weight is compared with the previous entry that has a weight
              prevWeighIn={measurements.slice(index + 1).find((x) => x.weight != null)}
              goal={goal}
            />
          ))}
        </div>
      )}
    </div>
  )
}
