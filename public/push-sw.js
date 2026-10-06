self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'NexTime';
  const options = {
    body: payload.body || 'Eine neue Buchung ist eingegangen.',
    icon: '/nextime-app-icon-192.png',
    badge: '/nextime-app-icon-48.png',
    tag: payload.tag || 'nextime-booking',
    renotify: true,
    data: { url: payload.url || '/unternehmen' },
  };

  const tasks = [self.registration.showNotification(title, options)];
  if (payload.badgeCount && self.navigator && 'setAppBadge' in self.navigator) {
    tasks.push(self.navigator.setAppBadge(payload.badgeCount));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/unternehmen', self.location.origin)
    .href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existingClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existingClient) {
        if ('navigate' in existingClient) {
          await existingClient.navigate(targetUrl);
        }
        return existingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
