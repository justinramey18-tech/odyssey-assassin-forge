// Handle notification requests from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, tag } = event.data.payload;
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true, // Vibrate/sound even when replacing same tag
      requireInteraction: false,
    });
  }
});

// Re-focus or open the app when a notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if available
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow('/');
    })
  );
});
