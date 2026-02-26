// Foreground postMessage handler (legacy fallback)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, tag } = event.data.payload;
    self.registration.showNotification(title, { body, icon, badge, tag });
  }
});

// Background push event handler (VAPID Web Push)
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('Push event has no data');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    console.error('Failed to parse push payload:', error);
    return;
  }

  const { title, body, tag, icon, badge, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title || 'Party Update', {
      body: body || '',
      tag: tag || 'party-update',
      icon: icon || '/pwa-192x192.png',
      badge: badge || '/pwa-192x192.png',
      data: data || {},
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click handler — focus or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
