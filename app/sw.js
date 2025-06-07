self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open("jaxs-cache").then(cache => {
      return cache.addAll([
        "/",
        "/app/index.html",
        "/app/appMain.js",
        "/app/manifest.json",
        "/app/icon-192.png"
      ]);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
