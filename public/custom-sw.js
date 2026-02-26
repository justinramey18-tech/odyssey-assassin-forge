// Handle notification requests from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, tag } = event.data.payload;
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      requireInteraction: false,
    });
  }
});

// Handle Web Push events (server-sent, works when app is backgrounded/closed)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'New notification', body: event.data.text() };
  }

  const { title, body, icon, badge, tag, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title || 'Party Alert', {
      body: body || '',
      icon: icon || '/pwa-192x192.png',
      badge: badge || '/pwa-192x192.png',
      tag: tag || `push-${Date.now()}`,
      renotify: true,
      requireInteraction: false,
      data: data || {},
    })
  );
});

// Re-focus or open the app when a notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
