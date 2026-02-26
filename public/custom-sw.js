self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, tag } = event.data.payload;
    self.registration.showNotification(title, { body, icon, badge, tag });
  }
});
