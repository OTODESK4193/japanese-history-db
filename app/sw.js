/* sw.js — network-first（オンライン時は常に最新、オフライン時はキャッシュ）。
 * コアシェルのみ precache し、個別に失敗しても install 全体は壊れない。 */
var CACHE_VERSION = 'jh-static-v2';
var CORE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon.svg',
  './js/store.js',
  './js/data.js',
  './js/quiz.js',
  './js/app.js',
  './js/views.js',
  './js/views2.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return Promise.all(CORE.map(function (url) {
        return cache.add(url).catch(function () { /* 1件の失敗で全体を壊さない */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // 外部オリジン（Wikimedia Commons の写真など）は素通し
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE_VERSION).then(function (cache) { cache.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true });
    })
  );
});
