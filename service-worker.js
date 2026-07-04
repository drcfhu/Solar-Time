const CACHE_NAME = 'napora-v3.0.0';
const ASSETS = ['./','./index.html?v=3.0.0','./style.css?v=3.0.0','./app.js?v=3.0.0','./manifest.json?v=3.0.0','./icons/napora_icon_192.png','./icons/napora_icon_512.png'];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => { if(event.request.method !== 'GET') return; event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html?v=3.0.0')))); });
