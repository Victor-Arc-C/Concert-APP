// Showbound service worker: Web Push only. No caching, so the app is always the deployed version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' ? data.title : 'Showbound';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: typeof data.url === 'string' ? data.url : '/app/alerts' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Same-origin paths only: a payload can never send the user to another site.
  const target = new URL(event.notification.data?.url || '/app/alerts', self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          // navigate() rejects for pages this worker does not control yet; open a window then.
          return client
            .navigate(url)
            .then((c) => (c ?? client).focus())
            .catch(() => self.clients.openWindow(url));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
