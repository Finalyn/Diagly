/**
 * Service worker Diagly : PWA installable + offline (chantier / sous-sol).
 *
 * Stratégies (runtime caching, sans dépendance de build) :
 *  - Navigations SPA : network-first, repli sur le shell caché -> l'app s'ouvre hors-ligne.
 *    Chaque navigation réussie en ligne remplace la copie du shell : c'est la
 *    dernière version vue en ligne qui tourne hors ligne.
 *  - /assets/ (JS/CSS hashés, immuables) : cache-first.
 *  - /uploads/ (photos, plans) : cache-first.
 *  - /api/ GET : network-first avec repli cache -> données consultables hors-ligne.
 *  - Les requêtes non-GET (créations/modifs) ne sont PAS interceptées : la file
 *    de synchro react-query (mutations en pause) s'en charge.
 *
 * Bump VERSION pour forcer la mise à jour du cache après un déploiement majeur.
 */
// v3 : purge des caches où une page HTML avait pu être gardée à la place d'un
// fichier de code d'une version précédente (page blanche, 13 octobre 2026).
// Pas de v4 pour le shell rafraîchi à chaque navigation : ce fichier ayant
// changé, le navigateur installe ce service worker de lui-même, et son
// installation recharge déjà le shell dans le même cache. Monter la version
// viderait en plus le cache des données de l'API, gardées pour le hors-ligne,
// sans rien corriger.
const VERSION = 'v3'
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
  // Le contrôle de santé dit si le serveur répond (lib/rechargement.ts) : une
  // copie gardée répondrait à sa place pendant une mise en ligne.
  if (url.pathname === '/health') return

  if (request.mode === 'navigate') {
    event.respondWith(naviguer(event, url))
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

/** Une réponse qu'on peut garder : réussie, et pas une page HTML servie à la place d'un fichier. */
function gardable(request, res) {
  if (!res.ok) return false
  const html = (res.headers.get('content-type') || '').includes('text/html')
  return !(html && request.destination !== 'document')
}

/**
 * Une navigation : le réseau d'abord, le shell gardé hors ligne.
 *
 * La copie du shell était celle de l'installation du service worker : après
 * une mise en ligne, l'app hors ligne restait l'ancienne, jusqu'à la
 * réinstallation suivante. Désormais chaque navigation réussie en ligne la
 * remplace, si la réponse est bien le shell de l'app web.
 */
async function naviguer(event, url) {
  try {
    const res = await fetch(event.request)
    if (estLeShell(event.request, url, res)) {
      const copie = res.clone()
      event.waitUntil(
        caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copie)).catch(() => undefined),
      )
    }
    return res
  } catch {
    return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error()
  }
}

/**
 * La réponse d'une navigation est-elle le shell de l'app web ?
 *
 * Pas l'API ni un fichier joint ouverts dans un onglet, pas l'app mobile
 * (/mobile, son propre index.html), pas un fichier (un chemin avec une
 * extension), pas une redirection ; et la règle de `gardable` tient toujours.
 */
function estLeShell(request, url, res) {
  if (res.redirected || res.type !== 'basic') return false
  if (!gardable(request, res)) return false
  if (!(res.headers.get('content-type') || '').includes('text/html')) return false
  if (/^\/(api|uploads|mobile)(\/|$)/.test(url.pathname)) return false
  return !/\.[a-z0-9]{1,8}$/i.test(url.pathname)
}

async function cacheFirst(request, cacheName, opts) {
  const cached = await caches.match(request, opts)
  if (cached) return cached
  const res = await fetch(request)
  if (gardable(request, res)) (await caches.open(cacheName)).put(request, res.clone())
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
      if (gardable(request, res)) caches.open(cacheName).then((c) => c.put(request, res.clone()))
      return res
    })
    .catch(() => cached)
  return cached || network
}
