// A page (lazy chunk) fails to load when a newer deploy has replaced the file that a tab opened
// before the deploy still points to. Each browser words the error differently.
const STALE_CHUNK =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i

export function isStaleChunkError(errorOrMessage) {
  const message = typeof errorOrMessage === 'string' ? errorOrMessage : errorOrMessage?.message || ''
  return STALE_CHUNK.test(message)
}

const RELOAD_KEY = 'stale-chunk-reload-at'
const RELOAD_WINDOW_MS = 30 * 1000

// Reloads the page once so a deploy goes unnoticed. Returns false (and does nothing) when it
// already reloaded in the last 30 seconds and the error is still there, when the device is
// offline, or when the tab can't remember that it reloaded (which would risk a reload loop).
export function reloadOnceForUpdate() {
  try {
    if (navigator.onLine === false) return false
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    window.location.reload()
    return true
  } catch {
    return false
  }
}
