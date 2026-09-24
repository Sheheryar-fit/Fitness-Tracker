import { useEffect, useRef } from 'react'
import { TriangleAlert } from 'lucide-react'

/**
 * ConfirmDialog Component
 * Reusable confirmation modal for destructive actions (delete, etc.)
 * Escape or clicking outside cancels; focus starts on Cancel.
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {string} title - Modal title
 * @param {string} message - Descriptive message
 * @param {function} onConfirm - Called when user confirms
 * @param {function} onCancel - Called when user cancels
 * @param {string} confirmText - Text for confirm button (default: 'Delete')
 * @param {string} confirmStyle - Button style class (default: 'btn-danger')
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  confirmStyle = 'btn-danger'
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement
    cancelRef.current?.focus()

    function handleKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`icon-chip ${confirmStyle === 'btn-danger' ? 'tone-red' : ''}`}>
          <TriangleAlert size={22} aria-hidden="true" />
        </span>
        <h3 className="modal-title" id="confirm-title">{title}</h3>
        <p className="modal-message" id="confirm-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} id="confirm-cancel-btn" ref={cancelRef}>
            Cancel
          </button>
          <button
            className={`btn ${confirmStyle}`}
            onClick={onConfirm}
            id="confirm-action-btn"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
