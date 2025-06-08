const CACHE_NAME = 'watch-tv-cache-v1';
const urlsToCache = [
    './', // Caches the root directory, which will typically be index.html
    'index.html',
    'manifest.json', // Cache the manifest file
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'
    // Note: Placehold.co images are external and won't be cached by this service worker directly.
    // For a real PWA with robust offline image support, you'd implement a network-first strategy
    // or cache specific image URLs if they are known and controlled.
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Failed to cache:', error);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // No cache - fetch from network
                return fetch(event.request);
            })
            .catch((error) => {
                console.error('Fetch failed:', error);
                // You could return a custom offline page here
                // return caches.match('/offline.html');
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName); // Delete old caches
                    }
                })
            );
        })
    );
});
