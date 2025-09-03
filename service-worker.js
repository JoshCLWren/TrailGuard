self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('tg-cache-v1').then((cache) => cache.addAll([
      './', './index.html', './styles.css', './app.js', './manifest.json',
      './icon-72.png','./icon-96.png','./icon-128.png','./icon-144.png','./icon-152.png','./icon-180.png','./icon-192.png','./icon-256.png','./icon-384.png','./icon-512.png'
    ]))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
