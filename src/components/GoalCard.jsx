import { Scale, Ruler, Trash2, CalendarClock, Trophy, Medal, Award } from 'lucide-react'
import { formatDate } from '../utils/calculations'

// Milestone badges come from calculateProgress() as text with an emoji at the end
const BADGE_ICONS = { 'Started Strong': Award, 'Halfway There': Medal, 'Target Reached': Trophy, '100% Goal Hit': Trophy }

function badgeParts(badge) {
  const label = badge.replace(/[^\p{L}\p{N}%\s]/gu, '').trim()
  return { label, Icon: BADGE_ICONS[label] || Award }
}

/**
 * GoalCard Component - one goal with start/current/target and a progress bar
 *
 * @param {object} goal - Goal row
 * @param {string} title - Card heading
 * @param {number} percent - Progress 0-100
 * @param {number} current - Current value of the metric
 * @param {string[]} badges - Milestone badges
 * @param {string} status - 'active' | 'overdue' | 'completed'
 * @param {function} onDelete - Optional; shows a delete button
 * @param {ReactNode} children - Extra content (e.g. progress photos)
 */
export default function GoalCard({ goal, title, percent, current, badges, status, onDelete, children }) {
  const unit = goal.target_metric === 'Weight' ? 'kg' : 'in'
  const MetricIcon = goal.target_metric === 'Weight' ? Scale : Ruler
  const tone = status === 'completed' ? 'green' : status === 'overdue' ? 'red' : 'yellow'

  return (
    <article className="card goal-card">
      <div className="goal-card-head">
        <span className={`icon-chip tone-${tone}`}>
          <MetricIcon size={20} aria-hidden="true" />
        </span>
        <div className="goal-card-title">
          <h3>{title}</h3>
          {goal.description && <p>{goal.description}</p>}
        </div>
        {onDelete && (
          <button className="icon-btn danger" onClick={onDelete} aria-label={`Delete goal: ${title}`}>
            <Trash2 size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="goal-values">
        <div className="goal-value">
          <div className="mini-stat-label">Start</div>
          <div className="mini-stat-value">{goal.starting_value ?? '—'} <span className="m-unit">{unit}</span></div>
        </div>
        <div className="goal-value is-current">
          <div className="mini-stat-label">Current</div>
          <div className="mini-stat-value">{Number.isNaN(current) ? '—' : current} <span className="m-unit">{unit}</span></div>
        </div>
        <div className="goal-value">
          <div className="mini-stat-label">Target</div>
          <div className="mini-stat-value">{goal.target_value} <span className="m-unit">{unit}</span></div>
        </div>
      </div>

      <div>
        <div className="progress-track lg">
          <div
            className={`progress-fill ${percent === 100 ? 'tone-green' : ''}`}
            style={{ transform: `scaleX(${percent / 100})` }}
          />
        </div>
        <div className="progress-meta">
          <span>
            <strong>{percent}%</strong> completed
          </span>
          {goal.deadline && (
            <span
              style={status === 'overdue' ? { color: 'var(--danger)' } : undefined}
              className="feed-item-date"
            >
              <CalendarClock size={14} aria-hidden="true" />
              {status === 'overdue' ? 'Was due' : 'Due'} {formatDate(goal.deadline)}
            </span>
          )}
        </div>
      </div>

      {badges.length > 0 && (
        <div className="badge-row">
          {badges.map((badge) => {
            const { label, Icon } = badgeParts(badge)
            return (
              <span key={badge} className={`badge ${percent === 100 ? 'badge-success' : 'badge-accent'}`}>
                <Icon size={14} aria-hidden="true" />
                {label}
              </span>
            )
          })}
        </div>
      )}

      {children}
    </article>
  )
}
