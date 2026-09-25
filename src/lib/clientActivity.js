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

// The date a client has been quiet since. A new client gets the same grace period as everyone
// else: the join date counts as their first activity, so someone who joined yesterday isn't
// reported as neglected.
export function getQuietSince(client) {
  return latestDate([client.lastActivity, client.joinDate])
}

export function isQuiet(client, activeSince) {
  const since = getQuietSince(client)
  return since == null || since < activeSince
}

// Clients with no recent activity, longest quiet first
export function findQuietClients(clients, activeSince) {
  return clients
    .filter((client) => isQuiet(client, activeSince))
    .map((client) => ({ ...client, quietSince: getQuietSince(client) }))
    .sort((a, b) => (a.quietSince ?? '').localeCompare(b.quietSince ?? '') || a.name.localeCompare(b.name))
}

// Clients with the date of their last activity: the newer of their latest measurement and
// check-in. Pass a trainer id for one trainer's clients; leave it out for everyone the logged-in
// user's access rules allow (the master sees all). It loads the whole list at once, which suits
// a gym (Supabase returns at most 1000 rows per request).
export async function fetchClientActivity(trainerId) {
  let query = supabase
    .from('clients')
    .select('id, name, goal, trainer_id, join_date, measurements(date), weekly_checkins(date)')
    // Only each client's latest measurement and check-in date, not their whole history
    .order('date', { referencedTable: 'measurements', ascending: false, nullsFirst: false })
    .limit(1, { referencedTable: 'measurements' })
    .order('date', { referencedTable: 'weekly_checkins', ascending: false, nullsFirst: false })
    .limit(1, { referencedTable: 'weekly_checkins' })

  if (trainerId) query = query.eq('trainer_id', trainerId)

  const { data, error } = await query
  if (error) throw error

  return (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    goal: c.goal,
    trainerId: c.trainer_id,
    joinDate: c.join_date,
    lastActivity: latestDate([...c.measurements, ...c.weekly_checkins].map((row) => row.date))
  }))
}
