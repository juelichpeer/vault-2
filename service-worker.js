// service-worker.js
const CACHE = 'vault-v1';
const ASSETS = [
  '/', '/index.html',
  '/assets/styles.css', '/assets/logo.svg',
  '/js/app.js', '/js/views.js', '/js/ui.js', '/js/supabase.js', '/js/config.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=> self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});

// ---- Web Push: show notification ----
self.addEventListener('push', e => {
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

self.addEventListener('notificationclick', e => {
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
