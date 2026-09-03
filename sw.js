const CACHE_NAME = "calibre-core-v8.0";

// Static local assets & external CDNs to cache on install
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap"
];

// Installation: Cache all critical dependencies immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use individual adds so a single CDN failure doesn't break install
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(err => {
          console.warn("[SW] Failed to cache:", url, err);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activation: Purge outdated caches from prior versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first for local assets, Network-first for CDN resources
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== "GET" || url.protocol === "chrome-extension:") return;

  // Network-first for Google Fonts (always fresh)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== "opaque") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
