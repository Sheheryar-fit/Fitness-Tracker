import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * PageHeader Component - page title, optional back link, eyebrow and actions
 *
 * @param {string} title - Page title
 * @param {ReactNode} subtitle - Line under the title
 * @param {string} eyebrow - Small label above the title
 * @param {{ to: string, label: string }} back - Optional back link
 * @param {ReactNode} actions - Buttons shown on the right
 * @param {ReactNode} lead - Optional element before the title (e.g. an avatar)
 */
export default function PageHeader({ title, subtitle, eyebrow, back, actions, lead }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link to={back.to} className="back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            {back.label}
          </Link>
        )}
        <div className="profile-head">
          {lead}
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
            <h1 className="page-title">{title}</h1>
            {subtitle && <div className="page-subtitle">{subtitle}</div>}
          </div>
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
