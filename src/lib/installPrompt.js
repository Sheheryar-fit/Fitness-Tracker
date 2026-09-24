// "Install as an app" support.
// Chrome/Edge/Android fire `beforeinstallprompt` (sometimes before React renders),
// so it is captured at startup and components subscribe to changes.
// iPhone/iPad and Mac Safari have no install API: users add the app themselves.

let deferredPrompt = null
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener())
}

// Call once at startup (main.jsx)
export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // use our own Install button instead of the browser's mini-infobar
    deferredPrompt = event
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Running as an installed app (home screen / app window)
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

/**
 * How this browser can install the app
 * @returns {'installed'|'prompt'|'ios'|'mac-safari'|'unsupported'}
 */
export function getInstallMode() {
  if (isStandalone()) return 'installed'
  if (deferredPrompt) return 'prompt'

  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac, but has a touch screen
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return 'ios'

  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Firefox/.test(ua)
  if (isSafari && /Macintosh/.test(ua)) return 'mac-safari'

  return 'unsupported'
}

// Show the browser's install dialog; resolves true if the user installed
export async function promptInstall() {
  if (!deferredPrompt) return false
  const promptEvent = deferredPrompt
  deferredPrompt = null // each prompt can only be shown once
  promptEvent.prompt()
  const { outcome } = await promptEvent.userChoice
  notify()
  return outcome === 'accepted'
}
