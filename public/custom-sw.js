// OneSignal handles push notifications now.
// This service worker only handles custom message events for backward compatibility.

// Handle notification requests from the main thread (non-push, in-app only)
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
