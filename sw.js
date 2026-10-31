const CACHE_NAME = 'gokuraku-cache-v8';

// Тільки критичний мінімум для миттєвого старту App Shell (без мережевого шторму)
const ESSENTIAL_ASSETS = [
  '/',
  '/index.html',
  '/404.html'
];

// Встановлення Service Worker: кешуємо тільки базовий каркас
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ESSENTIAL_ASSETS).catch(err => console.log('SW install cache error:', err));
    })
  );
});

// Активація Service Worker та швидке очищення старого кешу
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Перехоплення запитів
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Не перехоплюємо сторонні важкі ресурси (Catbox, Giscus тощо), дозволяємо браузеру працювати нативно
  if (url.origin !== self.location.origin && !url.href.includes('fonts.googleapis.com') && !url.href.includes('fonts.gstatic.com')) {
    return;
  }

  // --- СТРАТЕГІЯ ДЛЯ ДАНИХ (Network First з fallback на кеш) ---
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/site-data.json')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // --- СТРАТЕГІЯ ДЛЯ СТАТИКИ (Cache First з ледачим наповненням кешу) ---
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});