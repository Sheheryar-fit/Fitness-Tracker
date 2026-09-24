import { Flame, Dumbbell } from 'lucide-react'
import { formatGoal } from '../utils/calculations'

/**
 * GoalBadge Component - a client's fitness goal (Fat Loss / Muscle Gain)
 *
 * @param {string} goal - 'fat_loss' or 'muscle_gain'
 */
export default function GoalBadge({ goal }) {
  const fatLoss = goal === 'fat_loss'
  return (
    <span className={`badge ${fatLoss ? 'badge-warning' : 'badge-info'}`}>
      {fatLoss ? <Flame size={14} aria-hidden="true" /> : <Dumbbell size={14} aria-hidden="true" />}
      {formatGoal(goal)}
    </span>
  )
}
