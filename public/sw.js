self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Task Reminder';
  const options = { body: data.body };
  event.waitUntil(self.registration.showNotification(title, options));
});
