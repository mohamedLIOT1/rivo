// Liofy Service Worker v6 — iOS PWA & Offline Support
const CACHE_VER = 'liofy-v6';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

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

// ── Fetch Strategy ───────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 1. API Calls — Network First, JSON fallback when offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'أنت غير متصل بالإنترنت حالياً (Offline Mode)', offline: true }),
        { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      ))
    );
    return;
  }

  // 2. Audio & Media files — Cache First
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

  // 3. Static Assets & App Shell — Stale While Revalidate (Cache first, then network update)
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok && (url.origin === self.location.origin || request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image')) {
          caches.open(CACHE_VER).then(cache => cache.put(request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        if (cachedResponse) return cachedResponse;
        if (request.headers.get('accept')?.includes('text/html') || request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
