/* Service Worker：ネットワーク優先＋オフライン用の保存。外部への通信はしない。 */
'use strict';
var CACHE_NAME = 'chiid-v11'; // ファイルを変えたら番号を上げる
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
  'app-chiiku/game.js',
  'app-chiiku/kazu.js',
  'app-chiiku/tokei.js',
  'app-benkyo/index.html',
  'app-benkyo/app.css',
  'app-benkyo/main.js',
  'app-benkyo/kuku-screen.js',
  'app-benkyo/subjects/kuku.js',
  'app-benkyo/keisan-screen.js',
  'app-benkyo/subjects/keisan.js',
  'app-benkyo/kanji-screen.js',
  'app-benkyo/subjects/kanji-data.js',
  'app-benkyo/subjects/kanji.js'
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
  // ネットワーク優先（4秒待っても来なければ保存済みを使う）。つながる時は常に最新が出て、
  // 機内モードなど通信できない時は保存済みのファイルで動く。
  e.respondWith(
    new Promise(function (resolve, reject) {
      var timer = setTimeout(reject, 4000);
      fetch(req).then(function (res) { clearTimeout(timer); resolve(res); },
                      function (err) { clearTimeout(timer); reject(err); });
    }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
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
