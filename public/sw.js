/* CNSP Capture service worker — cache-first app shell, no OPFS involvement. */
const CACHE = 'cnsp-v1'
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      try {
        const fresh = await fetch(req)
        if (fresh.ok) cache.put(req, fresh.clone())
        return fresh
      } catch {
        if (cached) return cached
        throw new Error('offline and not cached')
      }
    })(),
  )
})
