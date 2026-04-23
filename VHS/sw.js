const CACHE_NAME = 'vhs-cam-v2';
const assets = [
  './',
  './index.html',
  './manifest.json',
  './image.png',
  'https://unpkg.com/dexie/dist/dexie.js'
];

// インストール時にファイルをキャッシュする
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

// アプリ起動時にキャッシュから読み込んで高速化する
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
