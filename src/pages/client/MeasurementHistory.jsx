import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  calcMeasurementChange,
  calcWeightChange,
  getMeasurementColor,
  getWeightColor,
  formatDate
} from '../../utils/calculations'

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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h2>My Progress</h2>
        <p>Your measurement history over time</p>
      </div>

      {measurements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📏</div>
          <h3>No measurements yet</h3>
          <p>Your trainer will add your measurements here</p>
        </div>
      ) : (
        measurements.map((m, index) => {
          const prev = index < measurements.length - 1 ? measurements[index + 1] : null
          // Weight is compared with the previous entry that has a weight
          const prevWeighIn = measurements.slice(index + 1).find((x) => x.weight != null)

          return (
            <div className="measurement-card" key={m.id}>
              <div className="measurement-date">
                <span>📅 {formatDate(m.date)}</span>
              </div>
              <div className="measurement-values">
                {/* Weight */}
                <div className="measurement-item measurement-item-wide">
                  <div className="m-label">Weight</div>
                  <div className="m-value">{m.weight ?? '—'} kg</div>
                  {m.weight != null && prevWeighIn && (
                    <div
                      className="m-change"
                      style={{ color: getWeightColor(calcWeightChange(m.weight, prevWeighIn.weight), goal) }}
                    >
                      ({calcMeasurementChange(m.weight, prevWeighIn.weight)} kg)
                    </div>
                  )}
                </div>
                {/* Chest */}
                <div className="measurement-item">
                  <div className="m-label">Chest</div>
                  <div className="m-value">{m.chest ?? '—'} in</div>
                  {prev && m.chest != null && prev.chest != null && (
                    <div
                      className="m-change"
                      style={{ color: getMeasurementColor(m.chest, prev.chest, goal, 'chest') }}
                    >
                      ({calcMeasurementChange(m.chest, prev.chest)} in)
                    </div>
                  )}
                </div>
                {/* Waist */}
                <div className="measurement-item">
                  <div className="m-label">Waist</div>
                  <div className="m-value">{m.waist ?? '—'} in</div>
                  {prev && m.waist != null && prev.waist != null && (
                    <div
                      className="m-change"
                      style={{ color: getMeasurementColor(m.waist, prev.waist, goal, 'waist') }}
                    >
                      ({calcMeasurementChange(m.waist, prev.waist)} in)
                    </div>
                  )}
                </div>
                {/* Arms */}
                <div className="measurement-item">
                  <div className="m-label">Arms</div>
                  <div className="m-value">{m.arms ?? '—'} in</div>
                  {prev && m.arms != null && prev.arms != null && (
                    <div
                      className="m-change"
                      style={{ color: getMeasurementColor(m.arms, prev.arms, goal, 'arms') }}
                    >
                      ({calcMeasurementChange(m.arms, prev.arms)} in)
                    </div>
                  )}
                </div>
                {/* Thigh */}
                <div className="measurement-item">
                  <div className="m-label">Thigh</div>
                  <div className="m-value">{m.thigh ?? '—'} in</div>
                  {prev && m.thigh != null && prev.thigh != null && (
                    <div
                      className="m-change"
                      style={{ color: getMeasurementColor(m.thigh, prev.thigh, goal, 'thigh') }}
                    >
                      ({calcMeasurementChange(m.thigh, prev.thigh)} in)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
