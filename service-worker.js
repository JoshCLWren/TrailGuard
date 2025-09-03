self.addEventListener('install', (e) => {
  console.info('[TrailGuard][SW] Install');
  // Activate updated SW immediately
  self.skipWaiting();
  e.waitUntil(
    caches.open('tg-cache-v5').then((cache) => cache.addAll([
      './', './index.html', './styles.css', './dist/app.js', './manifest.json',
      './icon-72.png','./icon-96.png','./icon-128.png','./icon-144.png','./icon-152.png','./icon-180.png','./icon-192.png','./icon-256.png','./icon-384.png','./icon-512.png',
      './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
      './vendor/leaflet/images/marker-icon.png', './vendor/leaflet/images/marker-icon-2x.png', './vendor/leaflet/images/marker-shadow.png',
      'https://unpkg.com/react@18/umd/react.production.min.js',
      'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
    ]))
  );
});

self.addEventListener('activate', (event) => {
  console.info('[TrailGuard][SW] Activate');
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k.startsWith('tg-') && k !== 'tg-cache-v5' && k !== 'tg-tiles-v1')
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for navigations (HTML) so updates land without manual steps
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((resp) => {
        // Optionally update cache with fresh index
        const copy = resp.clone();
        caches.open('tg-cache-v5').then((c) => c.put('./', copy).catch(() => {}));
        return resp;
      }).catch((err) => {
        console.warn('[TrailGuard][SW] Navigate fetch failed, using cache', err);
        return caches.match(event.request).then((hit) => hit || caches.match('./index.html'));
      })
    );
    return;
  }

  // Cache-first for OSM tiles (runtime cache)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open('tg-tiles-v1').then((cache) =>
        cache.match(event.request).then((hit) =>
          hit || fetch(event.request).then((resp) => {
            // Only cache successful GET tile responses
            if (resp && resp.status === 200) {
              cache.put(event.request, resp.clone());
            }
            return resp;
          }).catch((err) => {
            console.warn('[TrailGuard][SW] Tile fetch failed; cache miss', err);
            return caches.match(event.request);
          })
        )
      )
    );
    return;
  }

  // App shell cache, network fallback
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
