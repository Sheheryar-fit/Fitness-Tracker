import { Calendar, Trash2 } from 'lucide-react'
import {
  calcMeasurementChange,
  calcWeightChange,
  getMeasurementColor,
  getWeightColor,
  formatDate
} from '../utils/calculations'

const TAPE_METRICS = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'arms', label: 'Arms' },
  { key: 'thigh', label: 'Thigh' }
]

/**
 * MeasurementCard Component - one measurement entry with changes since the previous one
 *
 * @param {object} measurement - The entry
 * @param {object} prev - The entry before it (for tape measurement changes)
 * @param {object} prevWeighIn - The previous entry that has a weight
 * @param {string} goal - Client goal, for colouring changes
 * @param {function} onDelete - Optional; shows a delete button
 */
export default function MeasurementCard({ measurement: m, prev, prevWeighIn, goal, onDelete }) {
  return (
    <div className="measurement-card">
      <div className="measurement-date">
        <span className="measurement-date-label">
          <Calendar size={16} aria-hidden="true" />
          {formatDate(m.date)}
        </span>
        {onDelete && (
          <button
            className="icon-btn danger"
            onClick={onDelete}
            aria-label={`Delete measurement from ${formatDate(m.date)}`}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="measurement-values">
        {/* Weight */}
        <div className="measurement-item measurement-item-wide">
          <div className="m-label">Weight</div>
          <div className="m-value">
            {m.weight ?? '—'}<span className="m-unit">kg</span>
          </div>
          {m.weight != null && prevWeighIn && (
            <div
              className="m-change"
              style={{ color: getWeightColor(calcWeightChange(m.weight, prevWeighIn.weight), goal) }}
            >
              {calcMeasurementChange(m.weight, prevWeighIn.weight)} kg
            </div>
          )}
        </div>

        {TAPE_METRICS.map(({ key, label }) => (
          <div className="measurement-item" key={key}>
            <div className="m-label">{label}</div>
            <div className="m-value">
              {m[key] ?? '—'}<span className="m-unit">in</span>
            </div>
            {prev && m[key] != null && prev[key] != null && (
              <div
                className="m-change"
                style={{ color: getMeasurementColor(m[key], prev[key], goal, key) }}
              >
                {calcMeasurementChange(m[key], prev[key])} in
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
