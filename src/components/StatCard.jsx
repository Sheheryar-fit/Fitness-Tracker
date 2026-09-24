import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/**
 * StatCard Component - one key number with an icon
 *
 * @param {Component} icon - Lucide icon
 * @param {string} label - What the number is
 * @param {ReactNode} value - The number (can include a <small> unit)
 * @param {ReactNode} hint - Optional line under the number
 * @param {string} tone - 'yellow' | 'green' | 'blue' | 'orange' | 'red'
 * @param {string} to - Optional link; the whole card becomes clickable
 * @param {object} valueStyle - Optional style for the number (e.g. progress color)
 */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'yellow', to, valueStyle }) {
  const content = (
    <>
      <div className="stat-top">
        <span className={`icon-chip tone-${tone}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
        {to && <ChevronRight size={18} className="stat-link-arrow" aria-hidden="true" />}
      </div>
      <div className="stat-value" style={valueStyle}>{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </>
  )

  if (to) {
    return (
      <Link to={to} className="stat-card">
        {content}
      </Link>
    )
  }
  return <div className="stat-card">{content}</div>
}
