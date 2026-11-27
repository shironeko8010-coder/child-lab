/* トップ画面「はてなの きっぷ」（どれで あそぶ？）の動き。Chiid.top
   1まいめは 駅の入口。きっぷ「タッチしてね」を さわると パチンと穴があき、汽笛が鳴って、カメラが右のホームへ動く。
   汽車が2台 入ってきて、トップの曲（はじまりの うた）が はじまる。
   車両を さわると 汽車が出発し、けむりが画面をおおってから ちいく／べんきょうへ すすむ。
   音を出せるのは さわったあとだけ（ブラウザの決まり）。音楽の ON/OFF は 親画面の設定にしたがう。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var APP_NAME = 'はてなの きっぷ';
  // バージョン：あそびや ずかんの テーマを1つ足すたびに 0.01 上げる（1.25 → 1.26）。小さな直しは 1.25.1 のように うしろに足す
  var VERSION = '1.37';
  var TARGET = { chiiku: 'app-chiiku/index.html', benkyo: 'app-benkyo/index.html' };
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var PUNCH_MS = calm ? 50 : 450;      // 穴があいてから カメラが動きだすまで
  var PAN_MS = calm ? 50 : 1800;       // カメラが ホームへ動く時間
  var ARRIVE_MS = 2400;                // 汽車が とまるまで（2台目が おくれて着く分もふくむ）
  var DEPART_MS = calm ? 300 : 1700;   // しゅっぱつしてから 次の画面へ うつるまで
  var scene = null, started = false, going = false, sfxOn = true, ac = null, timers = [];

  function settings() {
    try { return C.storage.getSettings(); } catch (e) { return { bgmOn: true, sfxOn: true }; }
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  // 駅の とけいを 今の時刻に
  function clock() {
    var d = new Date(), h = d.getHours() % 12, m = d.getMinutes();
    var hh = document.querySelector('[data-hh]'), mh = document.querySelector('[data-mh]');
    if (hh) hh.setAttribute('transform', 'rotate(' + (h * 30 + m / 2) + ' 200 56)');
    if (mh) mh.setAttribute('transform', 'rotate(' + (m * 6) + ' 200 56)');
  }

  // きっぷに穴をあける音「パチン」（短い雑音を WebAudio で つくる）
  function punch() {
    if (!sfxOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var t = ac.currentTime, n = Math.floor(ac.sampleRate * 0.06), buf = ac.createBuffer(1, n, ac.sampleRate), ch = buf.getChannelData(0);
      for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      var src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 1500; g.gain.value = 0.5;
      src.connect(hp); hp.connect(g); g.connect(ac.destination); src.start(t);
    } catch (e) { /* 音が出なくても止めない */ }
  }

  function start() {
    if (started || !scene) return;
    started = true;
    var s = settings();
    sfxOn = s.sfxOn !== false;
    try { C.sfx.setSfxOn(s.sfxOn); C.sfx.setBgmOn(s.bgmOn); } catch (e) {}
    punch();
    scene.classList.add('punched');
    later(function () {
      scene.classList.add('started', 'panned');
      try { C.sfx.play('whistle'); } catch (e) {}
      if (s.bgmOn) { try { C.sfx.startTopBgm(); } catch (e) {} }
    }, PUNCH_MS);
    later(function () { scene.classList.add('arrive'); }, calm ? 100 : PUNCH_MS + PAN_MS * 0.55);
    later(function () { try { C.voice.speak('どれで あそぶ？'); } catch (e) {} }, calm ? 300 : PUNCH_MS + PAN_MS * 0.55 + ARRIVE_MS);
  }

  // 出発：汽車が走り出し、けむりが画面をおおう → 次の画面へ
  function go(kind, row) {
    if (going || !scene || !TARGET[kind]) return;
    going = true;
    scene.classList.add('going');
    try { C.sfx.play('whistle'); } catch (e) {}
    if (row) {
      row.classList.add('go');
      puffs(row);
    }
    later(function () { location.href = TARGET[kind]; }, DEPART_MS);
  }

  function puffs(row) {
    var eng = row.querySelector('.eng');
    if (!eng) return;
    var box = scene.getBoundingClientRect(), e = eng.getBoundingClientRect();
    var cx = e.left + e.width * 0.25 - box.left, cy = e.top - box.top;
    var R = Math.hypot(box.width, box.height);
    for (var i = 0; i < 9; i++) {
      var p = document.createElement('div'), s = R * (0.18 + Math.random() * 0.12);
      p.className = 'puff';
      p.style.width = p.style.height = s + 'px';
      var x = cx + (Math.random() - 0.4) * R * 0.9, y = cy + (Math.random() - 0.6) * R * 0.6;
      p.style.left = (x - s / 2) + 'px'; p.style.top = (y - s / 2) + 'px';
      scene.appendChild(p);
      if (p.animate) {
        p.animate([{ transform: 'translate(' + (cx - x) + 'px,' + (cy - y) + 'px) scale(0)', opacity: 0.9 }, { transform: 'translate(0,0) scale(3.2)', opacity: 1 }],
          { duration: calm ? 10 : 900, delay: calm ? 0 : 350 + i * 60, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' });
      }
    }
  }

  // 「もどる」で このページに もどったとき（ページが そのまま残っていた場合）は、はじめの形に もどす
  function reset() {
    timers.forEach(clearTimeout); timers = [];
    started = false; going = false;
    try { C.sfx.stopBgm(); } catch (e) {}
    if (!scene) return;
    location.reload();
  }

  function boot() {
    scene = document.querySelector('[data-top]');
    if (!scene) return;           // テストなど、トップのページでないとき
    // 「タッチしてね」は、このスクリプトが動いたときだけ出す（読めなかったときは ホームの車両から えらべる）
    document.documentElement.classList.add('js');
    var ver = document.querySelector('[data-ver]');
    if (ver) ver.textContent = 'ver ' + VERSION;
    clock(); setInterval(clock, 20000);
    try { C.storage.init().catch(function () {}); } catch (e) {}
    scene.addEventListener('click', function (ev) {
      if (!started) { ev.preventDefault(); start(); return; }
      var car = ev.target.closest('[data-kind]');
      if (!car) return;
      ev.preventDefault();
      if (!scene.classList.contains('arrive')) return;   // 汽車が着く前は まだ えらばない
      go(car.getAttribute('data-kind'), car.closest('.row'));
    });
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) reset(); });
  }

  C.top = {
    APP_NAME: APP_NAME, VERSION: VERSION, TARGET: TARGET,
    start: start, go: go, reset: reset,
    _state: function () { return { started: started, going: going }; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
