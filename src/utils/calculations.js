/**
 * Calculate the total weight change (current - starting)
 * @param {number} current - Current weight in kg
 * @param {number} starting - Starting weight in kg
 * @returns {number} Weight change (positive = gained, negative = lost)
 */
export function calcWeightChange(current, starting) {
  return parseFloat((current - starting).toFixed(1))
}

/**
 * Calculate weight change as a percentage
 * @param {number} current - Current weight in kg
 * @param {number} starting - Starting weight in kg
 * @returns {number} Percentage change
 */
export function calcWeightChangePercent(current, starting) {
  if (!starting || starting === 0) return 0
  return parseFloat((((current - starting) / starting) * 100).toFixed(1))
}

/**
 * Get the color for weight change based on goal
 * Fat Loss: green if lost weight (negative change), red if gained
 * Muscle Gain: green if gained weight (positive change), red if lost
 * @param {number} change - Weight change value
 * @param {string} goal - 'fat_loss' or 'muscle_gain'
 * @returns {string} CSS color variable name
 */
export function getWeightColor(change, goal) {
  if (change === 0) return 'var(--color-gray)'

  if (goal === 'fat_loss') {
    return change < 0 ? 'var(--color-green)' : 'var(--color-red)'
  } else {
    // muscle_gain
    return change > 0 ? 'var(--color-green)' : 'var(--color-red)'
  }
}

/**
 * Determine if progress is "positive" for the progress bar
 * (green direction based on goal)
 * @param {number} change - Weight change value
 * @param {string} goal - 'fat_loss' or 'muscle_gain'
 * @returns {boolean}
 */
export function isPositiveProgress(change, goal) {
  if (goal === 'fat_loss') return change <= 0
  return change >= 0
}

/**
 * Calculate days active since joining
 * @param {string} joinDate - Join date string (YYYY-MM-DD)
 * @returns {number} Number of days
 */
export function calcDaysActive(joinDate) {
  if (!joinDate) return 0
  const join = parseDate(joinDate)
  const today = new Date()
  const diff = today - join
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Calculate the change between two measurement values
 * @param {number} current - Current measurement
 * @param {number} previous - Previous measurement
 * @returns {string} Formatted change string like "+2.0" or "-1.5"
 */
export function calcMeasurementChange(current, previous) {
  if (previous === null || previous === undefined) return null
  const change = parseFloat((current - previous).toFixed(1))
  if (change > 0) return `+${change}`
  if (change < 0) return `${change}`
  return '0'
}

/**
 * Get color for measurement change
 * Green for positive, Red for negative, Gray for zero
 * @param {number} current
 * @param {number} previous
 * @returns {string}
 */
export function getMeasurementColor(current, previous) {
  if (previous === null || previous === undefined) return 'var(--color-gray)'
  const change = current - previous
  if (change > 0) return 'var(--color-green)'
  if (change < 0) return 'var(--color-red)'
  return 'var(--color-gray)'
}

/**
 * Split a stored height (total inches) into feet and inches.
 * Older entries were typed as feet.inches (5.3 = 5 ft 3 in); nobody is
 * under 12 inches tall, so values below 12 are read that way.
 * @param {number} value - Stored height
 * @returns {{feet: number, inches: number}|null} null when there is no height
 */
export function splitHeight(value) {
  const num = parseFloat(value)
  if (!num || num <= 0) return null
  if (num < 12) {
    const feet = Math.floor(num)
    return { feet, inches: Math.round((num - feet) * 10) }
  }
  const feet = Math.floor(num / 12)
  return { feet, inches: parseFloat((num - feet * 12).toFixed(1)) }
}

/**
 * Combine feet and inches form values into total inches for storage
 * @param {string|number} feet
 * @param {string|number} inches
 * @returns {number|null} Total inches, or null when both are empty/zero
 */
export function toTotalInches(feet, inches) {
  const total = (parseFloat(feet) || 0) * 12 + (parseFloat(inches) || 0)
  return total > 0 ? parseFloat(total.toFixed(1)) : null
}

/**
 * Format a stored height for display
 * @param {number} value - Stored height
 * @returns {string} Like "5 ft 7 in", or '—'
 */
export function formatHeight(value) {
  const height = splitHeight(value)
  if (!height) return '—'
  return `${height.feet} ft ${height.inches} in`
}

/**
 * Format a goal enum into display text
 * @param {string} goal - 'fat_loss' or 'muscle_gain'
 * @returns {string} 'Fat Loss' or 'Muscle Gain'
 */
export function formatGoal(goal) {
  if (goal === 'fat_loss') return 'Fat Loss'
  if (goal === 'muscle_gain') return 'Muscle Gain'
  return goal
}

/**
 * Format a date string for display
 * @param {string} dateStr - Date string
 * @returns {string} Formatted date like "Jan 15, 2025"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return parseDate(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Parse a date string, treating date-only values (YYYY-MM-DD) as local dates
 * (new Date('2026-09-24') would be UTC midnight instead)
 * @param {string} dateStr - Date or timestamp string
 * @returns {Date}
 */
function parseDate(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  return new Date(dateStr)
}

/**
 * Get a date as YYYY-MM-DD in the local timezone
 * (toISOString() uses UTC, which is still the previous day before 5 AM in Pakistan)
 * @param {Date} date - Date to format (default: now)
 * @returns {string} Date string like "2026-09-24"
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get a goal's status from its progress and deadline
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} deadline - Deadline date (YYYY-MM-DD) or null
 * @returns {string} 'completed', 'overdue' or 'active'
 */
export function getGoalStatus(percent, deadline) {
  if (percent === 100) return 'completed'
  if (deadline && deadline < getLocalDateString()) return 'overdue'
  return 'active'
}

/**
 * Group goals into display sections by status
 * @param {Array} items - Objects with a `status` from getGoalStatus
 * @returns {Array} Non-empty sections like { status, title, items }
 */
export function groupGoalsByStatus(items) {
  return [
    { status: 'active', title: 'Active Goals' },
    { status: 'overdue', title: 'Past Deadline' },
    { status: 'completed', title: 'Completed' }
  ]
    .map((section) => ({
      ...section,
      items: items.filter((item) => item.status === section.status)
    }))
    .filter((section) => section.items.length > 0)
}

/**
 * Generate a random password of given length
 * @param {number} length - Password length (default 8)
 * @returns {string} Random password
 */
export function generatePassword(length = 8) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Generate a username from a full name (firstname.lastname)
 * @param {string} name - Full name
 * @returns {string} Username like "john.doe"
 */
export function generateUsername(name) {
  const parts = name.trim().toLowerCase().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]}.${parts[parts.length - 1]}`
}
