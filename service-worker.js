// service-worker.js (SPA + cache + update)
// Version bump to force update
const CACHE = 'vault-v3';

// Files we always cache
const ASSETS = [
  '/', '/index.html', '/manifest.webmanifest',
  '/assets/styles.css', '/assets/logo.svg',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png',
  '/js/app.js', '/js/views.js', '/js/ui.js', '/js/supabase.js', '/js/config.js'
];

// --- Install: pre-cache core assets ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// --- Activate: clean old caches + take control ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Helper strategies
async function cacheFirst(req){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, fallbackPath = '/index.html'){
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok && req.method === 'GET') cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(fallbackPath);
    return cached || new Response('Offline', { status: 503 });
  }
}

// --- Fetch: SPA routing + smart caching ---
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // For navigation requests, serve the SPA shell with network-first (fallback to cached index)
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(networkFirst(req, '/index.html'));
    return;
  }

  // Same-origin static assets -> cache-first
  if (url.origin === location.origin && ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else -> try network (don’t cache APIs by default)
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// --- Support "skipWaiting" from the page ---
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ---- Web Push: show notification ----
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = {}; }
  const title = data.title || 'VAULT';
  const body  = data.body  || 'New message';
  const url   = data.url   || '/';
  const options = {
    body,
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    data: { url }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      try {
        const cUrl = new URL(client.url);
        if (cUrl.origin === location.origin) {
          client.navigate(url);
          return client.focus();
        }
      } catch {}
    }
    return clients.openWindow(url);
  })());
});
