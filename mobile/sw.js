// Service Worker for ClassCore Mobile — Offline Cache
const CACHE_NAME = 'classcore-mobile-v1';
const ASSETS = [
  './',
  './index.html',
  './mobile.css',
  './mobile.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Pass through Firebase API requests to network
  if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('firebase')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
