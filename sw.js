/* ══════════════════════════════════════════════
   SERVICE WORKER — Offline caching for Minimal
══════════════════════════════════════════════ */

const CACHE_NAME = 'minimal-v4';
const ASSETS = [
    '/',
    '/index.html',
    '/css/base.css',
    '/css/themes.css',
    '/css/desktop.css',
    '/js/state.js',
    '/js/auth.js',
    '/js/app.js',
    '/js/screens/overview.js',
    '/js/screens/transactions.js',
    '/js/screens/budgets.js',
    '/js/screens/reports.js',
    '/js/screens/wallet.js',
    '/js/modals/budget-item.js',
    '/js/modals/settings.js',
    '/js/modals/bank-import.js',
    '/js/utils/tutorial.js',
    '/js/utils/transaction-row.js',
    '/manifest.json',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    // Skip non-GET and cross-origin requests (CDNs, Firebase, etc.)
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            // Network-first for HTML, cache-first for assets
            if (e.request.destination === 'document') {
                return fetch(e.request)
                    .then(res => {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                        return res;
                    })
                    .catch(() => cached);
            }
            return cached || fetch(e.request).then(res => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                return res;
            });
        })
    );
});
