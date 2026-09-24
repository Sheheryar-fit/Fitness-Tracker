import { CircleCheck, TriangleAlert } from 'lucide-react'

/**
 * Toast Component - short confirmation or error at the bottom of the screen
 * Announced to screen readers without moving focus.
 *
 * @param {string} message - Text to show; nothing renders when empty
 * @param {boolean} error - Show as an error
 */
export default function Toast({ message, error = false }) {
  if (!message) return null

  return (
    <div className={`toast ${error ? 'toast-error' : ''}`} role="status" aria-live="polite">
      {error ? <TriangleAlert size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
      <span>{message}</span>
    </div>
  )
}
