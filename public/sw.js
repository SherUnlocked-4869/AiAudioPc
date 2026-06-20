const CACHE_NAME = 'claudio-v7';
const PRECACHE = ['/', '/index.html?v=7', '/style.css?v=7', '/app.js?v=7', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // API / WS / TTS / stream / cache 不缓存
  if (request.url.includes('/api/') || request.url.includes('/stream') || request.url.includes('/cache/')) return;

  // 网络优先：确保每次都能拿到最新前端代码
  e.respondWith(
    fetch(request)
      .then(resp => {
        // 只缓存有效的 200 基础响应，不缓存 206 / opaque 等
        if (resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(request))
  );
});
