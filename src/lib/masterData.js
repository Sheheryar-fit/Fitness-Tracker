import { supabase } from './supabase'
import { fetchClientActivity } from './clientActivity'

// Every trainer and every client with the date of their last activity.
// The database lets a master see all rows, so this is platform-wide.
export async function fetchMasterRoster() {
  const [trainerResult, clients] = await Promise.all([
    supabase.from('users').select('id, username').eq('role', 'admin'),
    fetchClientActivity()
  ])

  if (trainerResult.error) throw trainerResult.error

  return { trainers: trainerResult.data || [], clients }
}
