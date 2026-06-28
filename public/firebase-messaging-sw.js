/* Firebase Cloud Messaging service worker — handles push notifications when the
   app is closed/backgrounded. Served at the site root so FCM can find it.
   Uses the compat SDK (service workers can't use ES module imports here).
   The config below is the public web-app config (safe to ship to the client). */
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBJ1zrw4XDXneBvbkSspJFkxaY6kfMv8ik',
  authDomain: 'vaulta-3ff82.firebaseapp.com',
  projectId: 'vaulta-3ff82',
  messagingSenderId: '968487922698',
  appId: '1:968487922698:web:62755d05082852546ec3f3',
});

const messaging = firebase.messaging();

// Background/closed-app messages. Foreground messages are handled in-app via
// onForegroundMessage(). We only render a notification here for data-only
// payloads; if the message already has a `notification` block the browser
// shows it automatically, so we avoid a duplicate.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const title = payload.data?.title || 'Vaulta';
  self.registration.showNotification(title, {
    body: payload.data?.body || '',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    data: payload.data || {},
  });
});

// Focus/open the app when a notification is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
