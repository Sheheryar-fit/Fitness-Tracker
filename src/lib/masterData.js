import { supabase } from './supabase'
import { getLocalDateString } from '../utils/calculations'

// A client is active if they had a measurement or check-in in this many days (today included)
export const ACTIVE_DAYS = 14

// First date (YYYY-MM-DD) that still counts as recent activity
export function getActiveSince() {
  const now = new Date()
  return getLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (ACTIVE_DAYS - 1)))
}

// Newest of some YYYY-MM-DD dates (empty values ignored), or null if there are none
export function latestDate(dates) {
  return dates.filter(Boolean).sort().pop() ?? null
}

export function isActive(client, activeSince) {
  return client.lastActivity != null && client.lastActivity >= activeSince
}

// Every trainer and every client with the date of their last activity.
// The database lets a master see all rows, so this is platform-wide. It loads the
// whole roster at once, which suits a gym (Supabase returns at most 1000 rows per request).
export async function fetchMasterRoster() {
  const [trainerResult, clientResult] = await Promise.all([
    supabase.from('users').select('id, username').eq('role', 'admin'),
    // Only each client's latest measurement and check-in date, not their whole history
    supabase
      .from('clients')
      .select('id, name, goal, trainer_id, join_date, measurements(date), weekly_checkins(date)')
      .order('date', { referencedTable: 'measurements', ascending: false, nullsFirst: false })
      .limit(1, { referencedTable: 'measurements' })
      .order('date', { referencedTable: 'weekly_checkins', ascending: false, nullsFirst: false })
      .limit(1, { referencedTable: 'weekly_checkins' })
  ])

  if (trainerResult.error) throw trainerResult.error
  if (clientResult.error) throw clientResult.error

  return {
    trainers: trainerResult.data || [],
    clients: (clientResult.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      goal: c.goal,
      trainerId: c.trainer_id,
      joinDate: c.join_date,
      lastActivity: latestDate([...c.measurements, ...c.weekly_checkins].map((row) => row.date))
    }))
  }
}
