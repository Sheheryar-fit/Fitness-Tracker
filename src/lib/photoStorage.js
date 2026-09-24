import { supabase } from './supabase'

const BUCKET = 'photos'

// Storage path of a photo from its public URL (.../object/public/photos/<path>)
export function photoPath(photoUrl) {
  const marker = `/object/public/${BUCKET}/`
  const index = photoUrl?.indexOf(marker) ?? -1
  return index === -1 ? null : decodeURIComponent(photoUrl.slice(index + marker.length))
}

// Delete photo files from storage (deleting a database row leaves the file behind)
// Returns the storage error, or null
export async function removePhotoFiles(photoUrls) {
  const paths = photoUrls.map(photoPath).filter(Boolean)
  if (paths.length === 0) return null
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  return error
}
