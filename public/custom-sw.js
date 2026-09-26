// Foreground postMessage handler (legacy fallback)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
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

  if (payload.type !== 'live_chat') {
    // Existing behavior (ready-up notifications etc.)
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
    return;
  }

  // New-message push for the Live DM Table
  event.waitUntil(
    (async () => {
      const badgeCount = Number(payload.badgeCount);
      if (self.navigator.setAppBadge && Number.isFinite(badgeCount) && badgeCount > 0) {
        try {
          await self.navigator.setAppBadge(badgeCount);
        } catch (error) {
          // App badges are best-effort; ignore failures.
        }
      }

      // Skip the notification when the player has the app open on screen —
      // except on Apple devices, where Safari treats a silent push as a
      // failed one and can cancel the push subscription after a few.
      const isApple = /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent || '');
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (!isApple && clientList.some((client) => client.visibilityState === 'visible')) {
        return;
      }

      await self.registration.showNotification(payload.title || 'Live DM Table', {
        body: payload.body || '',
        tag: payload.tag || 'live-chat',
        renotify: false,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data || {},
        vibrate: [120, 60, 120],
      });
    })()
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
