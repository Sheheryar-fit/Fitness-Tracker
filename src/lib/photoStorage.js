import { supabase } from './supabase'

const BUCKET = 'photos'

// How long a temporary photo link works (the bucket is private)
const SIGNED_URL_SECONDS = 60 * 60

// Storage path of a photo from its public URL (.../object/public/photos/<path>)
export function photoPath(photoUrl) {
  const marker = `/object/public/${BUCKET}/`
  const index = photoUrl?.indexOf(marker) ?? -1
  return index === -1 ? null : decodeURIComponent(photoUrl.slice(index + marker.length))
}

// Temporary links for showing photos (stored photo_url links don't open a private bucket)
// Returns { [photo_url]: signedUrl }; photos that couldn't be signed are left out
export async function signedPhotoUrls(photoUrls) {
  const paths = photoUrls.map(photoPath)
  const validPaths = paths.filter(Boolean)
  if (validPaths.length === 0) return {}

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(validPaths, SIGNED_URL_SECONDS)
  if (error) {
    console.error('Error creating photo links:', error)
    return {}
  }

  const byPath = Object.fromEntries(
    data.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl])
  )
  return Object.fromEntries(
    photoUrls.map((url, i) => [url, byPath[paths[i]]]).filter(([, signed]) => signed)
  )
}

// Delete photo files from storage (deleting a database row leaves the file behind)
// Returns the storage error, or null
export async function removePhotoFiles(photoUrls) {
  const paths = photoUrls.map(photoPath).filter(Boolean)
  if (paths.length === 0) return null
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  return error
}
