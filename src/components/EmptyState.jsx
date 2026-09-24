/**
 * EmptyState Component - shown when a list has nothing in it yet
 *
 * @param {Component} icon - Lucide icon
 * @param {string} title - Short heading
 * @param {string} text - What happens next
 * @param {ReactNode} action - Optional button/link
 */
export default function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty-state">
      <span className="icon-chip">
        <Icon size={26} aria-hidden="true" />
      </span>
      {title && <h3>{title}</h3>}
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}
