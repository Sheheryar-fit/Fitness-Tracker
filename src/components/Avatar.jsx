/**
 * Avatar Component - initials in a brand-colored circle
 *
 * @param {string} name - Full name or username
 * @param {string} size - 'sm' | 'md' | 'lg'
 */
export default function Avatar({ name, size = 'md' }) {
  const initials = (name || '?')
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return (
    <span className={`avatar ${size === 'md' ? '' : `avatar-${size}`}`} aria-hidden="true">
      {initials || '?'}
    </span>
  )
}
