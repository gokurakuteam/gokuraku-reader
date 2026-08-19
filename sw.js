// Версія кешу. Змінюйте це значення (наприклад, 'gokuraku-cache-v2'),
// коли ви оновлюєте основні файли (css, js, html), щоб примусово оновити кеш.
const CACHE_NAME = 'gokuraku-cache-v3';

// Список статичних файлів для початкового кешування
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/data-manager.js',
  '/storage-manager.js',
  '/catalog.js',
  '/support-zsu-block.js',
  '/home.html',
  '/catalog.html',
  '/cabinet.html',
  '/title.html',
  '/reader.html',
  '/404.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap'
];

// Встановлення Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кешування основних файлів...');
        // Кешуємо статичні файли
        cache.addAll(STATIC_ASSETS);
        // Додатково кешуємо файли з даними, щоб вони були доступні офлайн при першому завантаженні
        return cache.addAll(['/site-data.json', '/api/manga-list.json']);
      })
  );
});

// Активація Service Worker та очищення старого кешу
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Видалення старого кешу:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Перехоплення запитів
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // --- СТРАТЕГІЯ ДЛЯ ФАЙЛІВ З ДАНИМИ (Stale-While-Revalidate) ---
  // Якщо запит іде до api/ (нові дані) або site-data.json
  if (url.pathname.startsWith('/api/') || url.pathname === '/site-data.json') {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        // Незалежно від того, чи є кеш, робимо запит для його оновлення у фоні
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => {
            console.log(`Оновлюю кеш у фоні для: ${url.pathname}`);
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {
          console.log(`Немає інтернету для фонового оновлення: ${url.pathname}`);
        });
        
        // Повертаємо кеш одразу, якщо він є. Якщо ні - чекаємо на відповідь мережі
        return cachedResponse || fetchPromise;
      })
    );
    return; // Важливо завершити виконання тут
  }

  // --- СТРАТЕГІЯ ДЛЯ ВСІХ ІНШИХ ФАЙЛІВ (Cache First) ---
  event.respondWith(
    // 1. Спочатку шукаємо відповідь у кеші
    caches.match(event.request).then(cachedResponse => {
      // Якщо знайшли в кеші - повертаємо її
      if (cachedResponse) {
        return cachedResponse;
      }
      // 2. Якщо в кеші немає - робимо запит до мережі
      return fetch(event.request);
    })
  );
});