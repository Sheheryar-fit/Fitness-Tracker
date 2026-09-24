import { Star } from 'lucide-react'

/**
 * StarRating Component - pick 1-5 stars, or show a rating read-only
 *
 * @param {number} value - Current rating (1-5)
 * @param {function} onChange - Called with the new rating; omit for read-only
 * @param {boolean} disabled - Disable picking
 * @param {number} size - Icon size
 */
export default function StarRating({ value, onChange, disabled = false, size = 22 }) {
  const stars = [1, 2, 3, 4, 5]

  if (!onChange) {
    return (
      <span className="stars-static" aria-label={`${value} out of 5 stars`}>
        {stars.map((n) => (
          <Star
            key={n}
            size={size}
            className={n <= value ? '' : 'off'}
            fill={n <= value ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        ))}
      </span>
    )
  }

  return (
    <div className="star-rating" role="radiogroup" aria-label="Rating">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={`star-btn ${n <= value ? 'filled' : ''}`}
          onClick={() => onChange(n)}
          disabled={disabled}
        >
          <Star size={size} fill={n <= value ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
