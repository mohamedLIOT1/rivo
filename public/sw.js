// Liofy Service Worker v5 — Offline Support
const CACHE_VER = 'liofy-v5';
const STATIC_ASSETS = ['/', '/index.html'];

// ── Install ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VER)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate — delete old caches ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET and cross-origin API requests
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // API calls — network first, no caching
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'Offline — no network' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Audio files — cache first (for downloaded songs)
  if (
    url.pathname.startsWith('/audio/') ||
    request.destination === 'audio' ||
    url.href.includes('/api/proxy-audio')
  ) {
    event.respondWith(
      caches.open(CACHE_VER).then(cache =>
        cache.match(request).then(cached => cached || fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }))
      )
    );
    return;
  }

  // App shell — network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE_VER).then(c => c.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request).then(c => c || caches.match('/index.html')))
  );
});

// ── Background Sync (for offline track download queue) ──
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
