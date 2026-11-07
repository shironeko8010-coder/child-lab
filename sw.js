/* Service Worker：キャッシュ優先。外部への通信はしない。 */
'use strict';
var CACHE_NAME = 'chiid-v4'; // ファイルを変えたら番号を上げる
var PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'shared/ui.css',
  'shared/core.js',
  'shared/storage.js',
  'shared/sfx.js',
  'shared/voice.js',
  'shared/gate.js',
  'shared/timer.js',
  'shared/adaptive.js',
  'shared/parent.js',
  'app-chiiku/index.html',
  'app-chiiku/app.css',
  'app-chiiku/data.js',
  'app-chiiku/trace.js',
  'app-chiiku/game.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) { // 外部へは出さない
    e.respondWith(new Response('', { status: 404, statusText: 'blocked' }));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).catch(function () {
        if (req.mode === 'navigate') {
          return caches.match('index.html').then(function (r) {
            return r || new Response('offline', { status: 503 });
          });
        }
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
