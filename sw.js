/* Service Worker：ネットワーク優先＋オフライン用の保存。外部への通信はしない。 */
'use strict';
var CACHE_NAME = 'chiid-v30'; // ファイルを変えたら番号を上げる
// 読み上げの音声ファイル（VOICEVOX:ずんだもん）の対応表。音声ファイルも保存して、オフラインで鳴らす
try { importScripts('shared/voice-clips.js'); } catch (e) { /* なくても動く */ }
function voiceFiles() {
  var g = self.CHIID_VOICE, seen = {}, out = [];
  if (!g || !g.clips) return out;
  Object.keys(g.clips).forEach(function (k) { var id = g.clips[k]; if (!seen[id]) { seen[id] = 1; out.push(g.dir + id + g.ext); } });
  return out;
}
// 少しずつ保存する（1つ失敗しても、ほかは保存する）
function cacheVoices(c) {
  var list = voiceFiles(), i = 0;
  function batch() {
    if (i >= list.length) return Promise.resolve();
    var part = list.slice(i, i + 40); i += 40;
    return Promise.all(part.map(function (u) { return c.add(u).catch(function () {}); })).then(batch);
  }
  return batch();
}
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
  'shared/voice-clips.js',
  'shared/voice.js',
  'shared/gate.js',
  'shared/timer.js',
  'shared/adaptive.js',
  'shared/parent.js',
  'app-chiiku/index.html',
  'app-chiiku/app.css',
  'app-chiiku/data.js',
  'app-chiiku/glyphs.js',
  'app-chiiku/trace.js',
  'app-chiiku/game.js',
  'app-chiiku/kazu.js',
  'app-chiiku/tokei.js',
  'app-chiiku/iro.js',
  'app-chiiku/machigai.js',
  'app-chiiku/doutoku.js',
  'app-chiiku/okaimono.js',
  'app-chiiku/shiritori.js',
  'app-benkyo/index.html',
  'app-benkyo/app.css',
  'app-benkyo/main.js',
  'app-benkyo/kuku-screen.js',
  'app-benkyo/subjects/kuku.js',
  'app-benkyo/keisan-screen.js',
  'app-benkyo/subjects/keisan.js',
  'app-benkyo/kanji-screen.js',
  'app-benkyo/subjects/kanji-data.js',
  'app-benkyo/subjects/kanji.js',
  'app-benkyo/kana-pad.js',
  'app-benkyo/subjects/japan-data.js',
  'app-benkyo/subjects/japan.js',
  'app-benkyo/japan-screen.js',
  'app-benkyo/subjects/doutoku.js',
  'app-benkyo/subjects/world-data.js',
  'app-benkyo/subjects/world.js',
  'app-benkyo/world-screen.js',
  'app-benkyo/subjects/nagasa.js',
  'app-benkyo/nagasa-screen.js',
  'app-benkyo/subjects/hantai.js',
  'app-benkyo/hantai-screen.js',
  'app-benkyo/doutoku-screen.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) { return c.addAll(PRECACHE).then(function () { return cacheVoices(c); }); })
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
