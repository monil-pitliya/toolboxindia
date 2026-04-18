// Service Worker for ToolBox India
// Provides offline support, caching strategies, and performance optimization

const CACHE_NAME = 'toolbox-india-v1';

// Assets to cache on install (app shell)
const PRECACHE_ASSETS = [
  'index.html',
  'css/main.css',
  'js/app.js',
  'manifest.json'
];

// ─── Install Event ─────────────────────────────────────────────────────────────
// Pre-cache essential assets so the app works offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting()) // Activate new SW immediately
  );
});

// ─── Activate Event ────────────────────────────────────────────────────────────
// Clean up old caches when a new service worker takes over
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim()) // Take control of all pages immediately
  );
});

// ─── Fetch Event ───────────────────────────────────────────────────────────────
// Network-first for HTML, cache-first for CSS/JS/images
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Determine strategy based on request type
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    // HTML — Network first, fall back to cache
    event.respondWith(networkFirstStrategy(request));
  } else if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    // Static assets — Cache first, fall back to network
    event.respondWith(cacheFirstStrategy(request));
  }
});

// ─── Network-First Strategy ────────────────────────────────────────────────────
// Try network first; on failure serve cached version; ultimate fallback to index.html
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    // If successful, update the cache
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, serving from cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    // Ultimate offline fallback — serve cached index.html
    return caches.match('index.html');
  }
}

// ─── Cache-First Strategy ──────────────────────────────────────────────────────
// Serve from cache if available; otherwise fetch from network and cache it
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache miss and network failed:', request.url);
    // Return a basic offline response for non-HTML assets
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}
