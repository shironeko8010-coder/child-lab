/* Service Worker：ネットワーク優先＋オフライン用の保存。外部への通信はしない。 */
'use strict';
var CACHE_NAME = 'chiid-v60'; // ファイルを変えたら番号を上げる
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
  'top.js',
  'manifest.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'shared/ui.css',
  'shared/core.js',
  'shared/storage.js',
  'shared/sfx.js',
  'shared/bgm/home-chiiku.mp3',
  'shared/bgm/home-benkyo.mp3',
  'shared/voice-clips.js',
  'shared/voice.js',
  'shared/voice-en.js',
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
  'app-chiiku/img/machigai/park.jpg',
  'app-chiiku/img/machigai/beach.jpg',
  'app-chiiku/img/machigai/forest.jpg',
  'app-chiiku/img/machigai/snow.jpg',
  'app-chiiku/img/machigai/flower.jpg',
  'app-chiiku/img/machigai/sunset.jpg',
  'app-chiiku/doutoku.js',
  'app-chiiku/okaimono.js',
  'app-chiiku/shiritori.js',
  'app-chiiku/meiro.js',
  'app-chiiku/kioku.js',
  'app-chiiku/kage.js',
  'app-chiiku/tentsunagi.js',
  'app-chiiku/img/tentsunagi/umi.jpg',
  'app-chiiku/img/tentsunagi/sora.jpg',
  'app-chiiku/img/tentsunagi/nohara.jpg',
  'app-chiiku/nakama.js',
  'app-chiiku/img/nakama/kago.png',
  'app-chiiku/img/nakama/bg.jpg',
  'app-chiiku/img/nakama/ringo.jpg',
  'app-chiiku/img/nakama/ichigo.jpg',
  'app-chiiku/img/nakama/banana.jpg',
  'app-chiiku/img/nakama/remon.jpg',
  'app-chiiku/img/nakama/budou.jpg',
  'app-chiiku/img/nakama/mikan.jpg',
  'app-chiiku/img/nakama/suika.jpg',
  'app-chiiku/img/nakama/tomato.jpg',
  'app-chiiku/img/nakama/ninjin.jpg',
  'app-chiiku/img/nakama/toumorokoshi.jpg',
  'app-chiiku/img/nakama/nasu.jpg',
  'app-chiiku/img/nakama/kyuuri.jpg',
  'app-chiiku/img/nakama/kyabetsu.jpg',
  'app-chiiku/img/nakama/kabocha.jpg',
  'app-chiiku/img/nakama/zou.jpg',
  'app-chiiku/img/nakama/kirin.jpg',
  'app-chiiku/img/nakama/kaba.jpg',
  'app-chiiku/img/nakama/raion.jpg',
  'app-chiiku/img/nakama/usagi.jpg',
  'app-chiiku/img/nakama/inu.jpg',
  'app-chiiku/img/nakama/neko.jpg',
  'app-chiiku/img/nakama/kotori.jpg',
  'app-chiiku/img/nakama/nezumi.jpg',
  'app-chiiku/img/nakama/kujira.jpg',
  'app-chiiku/img/nakama/iruka.jpg',
  'app-chiiku/img/nakama/tako.jpg',
  'app-chiiku/img/nakama/kani.jpg',
  'app-chiiku/img/nakama/kurage.jpg',
  'app-chiiku/img/nakama/kame.jpg',
  'app-chiiku/img/nakama/hitode.jpg',
  'app-chiiku/img/nakama/shoubousha.jpg',
  'app-chiiku/img/nakama/kuruma.jpg',
  'app-chiiku/img/nakama/basu.jpg',
  'app-chiiku/img/nakama/hikouki.jpg',
  'app-chiiku/img/nakama/heri.jpg',
  'app-chiiku/img/nakama/fune.jpg',
  'app-chiiku/img/nakama/densha.jpg',
  'app-chiiku/img/nakama/kikyuu.jpg',
  'app-chiiku/img/nakama/ari.jpg',
  'app-chiiku/img/nakama/tentoumushi.jpg',
  'app-chiiku/img/nakama/chouchou.jpg',
  'app-chiiku/img/nakama/hachi.jpg',
  'app-chiiku/img/nakama/tonbo.jpg',
  'app-chiiku/img/nakama/kabutomushi.jpg',
  'app-chiiku/img/nakama/semi.jpg',
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
  'app-benkyo/subjects/zukan-data.js',
  'app-benkyo/subjects/zukan-pages-1.js',
  'app-benkyo/subjects/zukan-pages-2.js',
  'app-benkyo/subjects/zukan-pages-3.js',
  'app-benkyo/subjects/zukan-pages-4.js',
  'app-benkyo/subjects/zukan-pages-5.js',
  'app-benkyo/subjects/zukan-pages-6.js',
  'app-benkyo/subjects/zukan-pages-7.js',
  'app-benkyo/subjects/zukan.js',
  'app-benkyo/zukan-art.js',
  'app-benkyo/zukan-screen.js',
  'app-benkyo/subjects/eigo-data.js',
  'app-benkyo/subjects/eigo.js',
  'app-benkyo/eigo-screen.js',
  'app-benkyo/subjects/program.js',
  'app-benkyo/program-screen.js',
  'app-benkyo/subjects/sudoku.js',
  'app-benkyo/sudoku-screen.js',
  'app-benkyo/subjects/logic.js',
  'app-benkyo/logic-screen.js',
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
