/* =========================================================
   service-worker.js - Offline support (Progressive Web App)

   Strategy
   - App shell (pages, CSS, JS, icons) is saved on install,
     so the app opens and works without internet.
   - Same-origin files: "stale-while-revalidate" (show the
     saved copy instantly, then update it in the background).
   - Map library, fonts, map tiles and the AI library used by the
     photo captcha are saved the first time they load (runtime cache).
   - Road routing requests (OSRM) always go to the network;
     the app falls back to a straight line when offline.

   IMPORTANT: change VERSION whenever you deploy new files,
   so users receive the update.
   ========================================================= */
'use strict';

const VERSION = 'v1.7.3';
const SHELL_CACHE = 'cb-shell-' + VERSION;
const RUNTIME_CACHE = 'cb-runtime-' + VERSION;
const TILE_CACHE = 'cb-tiles-' + VERSION;
const MAX_TILES = 400;

const APP_SHELL = [
    './',
    './index.html',
    './home.html',
    './routes.html',
    './fares.html',
    './places.html',
    './feedback.html',
    './manifest.webmanifest',
    './css/main.css',
    './css/pages.css',
    './js/data.js',
    './js/fare.js',
    './js/storage.js',
    './js/ui.js',
    './js/pwa.js',
    './js/config.js',
    './js/map.js',
    './js/geo.js',
    './js/roads.js',
    './js/search.js',
    './js/ocr.js',
    './js/pages/welcome.js',
    './js/pages/home.js',
    './js/pages/routes.js',
    './js/pages/fares.js',
    './js/pages/places.js',
    './js/pages/feedback.js',
    './assets/icons/favicon.svg',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/apple-touch-icon.png'
];

// Third-party files we try to save early (failures are ignored)
const OPTIONAL_PRECACHE = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// cdn.jsdelivr.net + tessdata.projectnaptha.com: the AI (Tesseract.js) used by the photo captcha, saved after first use
const RUNTIME_HOSTS = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'tessdata.projectnaptha.com'];
// Road routing and place search always use the network (never cached here)
const TILE_HOST = 'basemaps.cartocdn.com';

/* ---------- Install: save the app shell ---------- */
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const shell = await caches.open(SHELL_CACHE);
        await shell.addAll(APP_SHELL);

        const runtime = await caches.open(RUNTIME_CACHE);
        await Promise.all(OPTIONAL_PRECACHE.map((url) =>
            runtime.add(new Request(url, { mode: 'cors' })).catch(() => null)
        ));
        await self.skipWaiting();
    })());
});

/* ---------- Activate: remove caches from older versions ---------- */
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keep = [SHELL_CACHE, RUNTIME_CACHE, TILE_CACHE];
        const names = await caches.keys();
        await Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)));
        await self.clients.claim();
    })());
});

/* ---------- Helpers ---------- */
async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        await Promise.all(keys.slice(0, keys.length - maxItems).map((k) => cache.delete(k)));
    }
}

async function staleWhileRevalidate(request, cacheName, event) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });

    const network = fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);

    if (cached) {
        event.waitUntil(network);
        return cached;
    }
    const fresh = await network;
    if (fresh) return fresh;

    // Offline and not cached: show the home page for navigations
    if (request.mode === 'navigate') {
        const fallback = await caches.match('./home.html');
        if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function cacheFirst(request, cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) {
            await cache.put(request, response.clone());
            if (maxItems) trimCache(cacheName, maxItems);
        }
        return response;
    } catch (err) {
        return new Response('', { status: 504, statusText: 'Offline' });
    }
}

/* ---------- Fetch: decide how each request is handled ---------- */
self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Same-origin pages and files
    if (url.origin === self.location.origin) {
        event.respondWith(staleWhileRevalidate(request, SHELL_CACHE, event));
        return;
    }

    // Map tiles
    if (url.hostname.endsWith(TILE_HOST)) {
        event.respondWith(cacheFirst(request, TILE_CACHE, MAX_TILES));
        return;
    }

    // Map library and fonts
    if (RUNTIME_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, event));
    }

    // Everything else (e.g. OSRM routing) goes straight to the network
});
