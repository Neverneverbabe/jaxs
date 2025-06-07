self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open("jaxs-cache").then(async cache => {
      const files = [
        "/jaxs/app/index.html",
        "/jaxs/app/appMain.js",
        "/jaxs/app/manifest.json",
        "/jaxs/app/icon-192.png"
      ];
      await Promise.all(
        files.map(async file => {
          try {
            const response = await fetch(file);
            if (response.ok) await cache.put(file, response);
          } catch (err) {
            console.warn("⚠️ Failed to cache", file, err);
          }
        })
      );
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
