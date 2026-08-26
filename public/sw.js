/**
 * Service worker Diagly — PWA installable + offline (chantier / sous-sol).
 *
 * Stratégies (runtime caching, sans dépendance de build) :
 *  - Navigations SPA : network-first, repli sur le shell caché -> l'app s'ouvre hors-ligne.
 *  - /assets/ (JS/CSS hashés, immuables) : cache-first.
 *  - /uploads/ (photos, plans) : cache-first.
 *  - /api/ GET : network-first avec repli cache -> données consultables hors-ligne.
 *  - Les requêtes non-GET (créations/modifs) ne sont PAS interceptées : la file
 *    de synchro react-query (mutations en pause) s'en charge.
 *
 * Bump VERSION pour forcer la mise à jour du cache après un déploiement majeur.
 */
const VERSION = 'v2'
const SHELL_CACHE = `diagly-shell-${VERSION}`
const ASSET_CACHE = `diagly-assets-${VERSION}`
const API_CACHE = `diagly-api-${VERSION}`
const UPLOAD_CACHE = `diagly-uploads-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(['/', '/index.html'])).catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, API_CACHE, UPLOAD_CACHE])
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // mutations gérées par la file react-query
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // externe (polices, etc.)

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }
  if (url.pathname.startsWith('/uploads/')) {
    // Le jeton d'accès (?t=...) est renouvelé régulièrement : on ignore la query
    // pour ne pas remettre le même plan en cache à chaque rotation.
    event.respondWith(cacheFirst(request, UPLOAD_CACHE, { ignoreSearch: true }))
    return
  }
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }
  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE))
})

// ---------- Notifications push ----------

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text ? event.data.text() : '' } }
  const title = data.title || 'Diagly'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/app/dashboard' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/app/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Réutilise un onglet Diagly déjà ouvert si possible.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => undefined)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

async function cacheFirst(request, cacheName, opts) {
  const cached = await caches.match(request, opts)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) (await caches.open(cacheName)).put(request, res.clone())
  return res
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request)
    if (res.ok) (await caches.open(cacheName)).put(request, res.clone())
    return res
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res.ok) caches.open(cacheName).then((c) => c.put(request, res.clone()))
      return res
    })
    .catch(() => cached)
  return cached || network
}
