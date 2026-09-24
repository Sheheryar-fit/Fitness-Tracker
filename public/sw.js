// Service worker: makes the app installable and shows a friendly page when it
// is opened without a connection. It deliberately does NOT cache app files,
// so nobody gets stuck on an old version after a deploy.

// Change this name whenever offline.html changes, so installed apps pick up the new copy
const OFFLINE_CACHE = 'offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Store a fresh, non-redirected copy: Cloudflare Pages redirects /offline.html
      // to /offline, and browsers refuse redirected responses for page loads
      const response = await fetch(OFFLINE_URL, { cache: 'reload' })
      const html = await response.text()
      const cache = await caches.open(OFFLINE_CACHE)
      await cache.put(
        OFFLINE_URL,
        new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      )
    })()
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove caches from older versions of this worker
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key)))
      // Start page loads in parallel with the worker starting up
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  // Only page loads are handled; everything else goes straight to the network
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse
        if (preloaded) return preloaded
        return await fetch(event.request)
      } catch {
        return (await caches.match(OFFLINE_URL)) || Response.error()
      }
    })()
  )
})
