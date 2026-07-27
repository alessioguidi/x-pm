const CACHE_NAME = 'pms-v1';
const OFFLINE_URL = '/dashboard';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        '/',
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Nuovo messaggio',
    body: 'Hai un nuovo messaggio nella chat',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'chat-message',
    data: {}
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('Push data parse error:', e);
  }

  const options = {
    body: data.body || 'Hai un nuovo messaggio',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'chat-message',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Apri chat' },
      { action: 'dismiss', title: 'Ignora' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Property Manager', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].navigate('/messages');
      }
      return clients.openWindow('/messages');
    })
  );
});