// service-worker.js — DEBUG (no caching; keeps push working)
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Do not intercept fetch while we debug blank screen
self.addEventListener('fetch', () => {});

// Push still works
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch {}
  const title = data.title || 'VAULT';
  const options = {
    body: data.body || 'New message',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    data: { url: data.url || '/' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(cs=>{
    for (const c of cs) { if (new URL(c.url).origin === location.origin) { c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});
