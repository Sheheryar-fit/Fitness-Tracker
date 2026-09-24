import { useState, useEffect } from 'react'
import { Target } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getGoalStatus, groupGoalsByStatus } from '../../utils/calculations'
import ProgressPhotos from '../../components/ProgressPhotos'
import PageHeader from '../../components/PageHeader'
import GoalCard from '../../components/GoalCard'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'

export default function ClientGoals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [clientData, setClientData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: cData, error: clientErr } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (clientErr || !cData) throw clientErr
        setClientData(cData)

        const { data: goalsData, error: goalsErr } = await supabase
          .from('goals')
          .select('*')
          .eq('client_id', cData.id)
          .order('created_at', { ascending: false })

        if (goalsErr) throw goalsErr
        setGoals(goalsData || [])

        const { data: measData, error: measErr } = await supabase
          .from('measurements')
          .select('*')
          .eq('client_id', cData.id)
          .order('date', { ascending: false })
        
        if (!measErr) setMeasurements(measData || [])
      } catch (err) {
        console.error('Error fetching goals:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  function calculateProgress(goal) {
    let currentVal = goal.starting_value
    
    if (goal.target_metric === 'Weight' && clientData?.current_weight) {
      currentVal = clientData.current_weight
    } else {
      const clientMeas = measurements[0] // newest measurement
      if (clientMeas) {
        if (goal.target_metric === 'Chest' && clientMeas.chest) currentVal = clientMeas.chest
        if (goal.target_metric === 'Waist' && clientMeas.waist) currentVal = clientMeas.waist
        if (goal.target_metric === 'Arms' && clientMeas.arms) currentVal = clientMeas.arms
        if (goal.target_metric === 'Thigh' && clientMeas.thigh) currentVal = clientMeas.thigh
      }
    }

    const start = parseFloat(goal.starting_value)
    const target = parseFloat(goal.target_value)
    const current = parseFloat(currentVal)
    
    if (isNaN(start) || isNaN(target) || isNaN(current)) return { percent: 0, current, badges: [] }

    const totalDiff = Math.abs(start - target)
    if (totalDiff === 0) return { percent: 100, current, badges: ['100% Goal Hit 🏆'] }

    const isDecreasing = target < start
    
    let progressPercent = 0
    if (isDecreasing) {
      if (current <= target) progressPercent = 100
      else if (current >= start) progressPercent = 0
      else progressPercent = ((start - current) / totalDiff) * 100
    } else {
      if (current >= target) progressPercent = 100
      else if (current <= start) progressPercent = 0
      else progressPercent = ((current - start) / totalDiff) * 100
    }

    progressPercent = Math.max(0, Math.min(100, Math.round(progressPercent)))

    const badges = []
    if (progressPercent >= 25 && progressPercent < 50) badges.push('Started Strong 🥉')
    if (progressPercent >= 50 && progressPercent < 100) badges.push('Halfway There 🥈')
    if (progressPercent === 100) badges.push('Target Reached 🏆')

    return { percent: progressPercent, current, badges }
  }

  if (loading) return <Loading />

  const goalSections = groupGoalsByStatus(
    goals.map((goal) => {
      const progress = calculateProgress(goal)
      return { goal, ...progress, status: getGoalStatus(progress.percent, goal.deadline) }
    })
  )

  return (
    <div>
      <PageHeader
        title="My goals"
        subtitle="Your targets, milestones and progress photos"
      />

      {goals.length === 0 && (
        <EmptyState
          icon={Target}
          title="No goals assigned yet"
          text="Your trainer will set your goals. They'll show up here with live progress."
        />
      )}

      {goalSections.map((section) => (
        <section key={section.status} style={{ marginBottom: '2rem' }}>
          <div className="section-header">
            <h2 className="section-title">
              {section.title}
              <span className="section-count">{section.items.length}</span>
            </h2>
          </div>
          <div className="goal-list stagger">
            {section.items.map(({ goal, percent, current, badges, status }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                title={`${goal.target_metric} goal`}
                percent={percent}
                current={current}
                badges={badges}
                status={status}
              />
            ))}
          </div>
        </section>
      ))}

      {clientData && (
        <div className="card section">
          <ProgressPhotos clientId={clientData.id} />
        </div>
      )}
    </div>
  )
}
