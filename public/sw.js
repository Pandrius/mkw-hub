/*
 * Service worker de MKW Hub (PWA instalable).
 *
 * - Solo maneja peticiones GET del propio dominio. Nunca toca Supabase (*.supabase.co),
 *   /api/ ni nada de otros dominios (fuentes, banderas, YouTube): esas van siempre a la red.
 * - Páginas (navegación): primero la red; sin conexión, la app shell guardada (index.html).
 *   Así un despliegue nuevo se ve en cuanto hay red y nunca se sirve un index.html viejo
 *   que apunte a /assets/ que ya no existen.
 * - Assets estáticos (/assets/ con hash, imágenes de pistas, iconos): stale-while-revalidate.
 *
 * Para invalidar todo lo guardado, sube VERSION.
 */
const VERSION = 'v1'
const PREFIX = 'mkwhub-'
const CACHE = `${PREFIX}${VERSION}`
const SHELL = '/'
const PRECACHE = [SHELL, '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']
/** Máximo de respuestas guardadas: los assets con hash de despliegues antiguos se van descartando */
const MAX_ENTRIES = 200

const STATIC_PREFIXES = ['/assets/', '/tracks/', '/icons/']
const STATIC_FILES = ['/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Otros dominios (incluido supabase.co): siempre a la red, sin pasar por la caché
  if (url.origin !== self.location.origin) return
  if (url.hostname.endsWith('supabase.co')) return
  if (url.pathname.startsWith('/api/')) return
  // Nada que lleve credenciales
  if (request.headers.has('authorization')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(event))
    return
  }

  if (STATIC_FILES.includes(url.pathname) || STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(event))
  }
})

/** Navegación: red primero; si falla, la app shell guardada */
async function networkFirstShell(event) {
  try {
    const response = await fetch(event.request)
    // Todas las rutas sirven el mismo index.html (rewrite de vercel.json): se guarda como la shell
    if (response.ok && response.type === 'basic' && isHtml(response)) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(SHELL, copy)))
    }
    return response
  } catch (error) {
    const cached = await caches.match(SHELL)
    if (cached) return cached
    throw error
  }
}

/** Assets: responde con lo guardado al momento y lo actualiza en segundo plano */
async function staleWhileRevalidate(event) {
  const { request } = event
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) {
        await cache.put(request, response.clone())
        await trim(cache)
      }
      return response
    })
    .catch(() => undefined)

  if (cached) {
    event.waitUntil(network)
    return cached
  }
  return (await network) ?? Response.error()
}

/**
 * Solo respuestas 200 del propio dominio y que no sean HTML: un asset que ya no existe
 * devuelve index.html (por el rewrite) y eso no debe quedarse guardado como si fuera JS o una imagen.
 */
function isCacheable(response) {
  return response.status === 200 && response.type === 'basic' && !isHtml(response)
}

function isHtml(response) {
  return (response.headers.get('content-type') ?? '').includes('text/html')
}

/** Borra las entradas más antiguas si la caché pasa del máximo (la shell se conserva) */
async function trim(cache) {
  const keys = await cache.keys()
  const extra = keys.length - MAX_ENTRIES
  if (extra <= 0) return
  const removable = keys.filter((req) => new URL(req.url).pathname !== SHELL).slice(0, extra)
  await Promise.all(removable.map((req) => cache.delete(req)))
}
