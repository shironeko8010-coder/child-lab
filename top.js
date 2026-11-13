/* トップ画面（どれで あそぶ？）の動き。Chiid.top
   さいしょは「タッチしてね」。さわると 汽笛が鳴って 汽車が2台 走ってきて、トップの曲（はじまりの うた）が はじまる。
   車両を さわると 汽車が しゅっぱつして、ちいく／べんきょうへ すすむ。
   音を出せるのは さわったあとだけ（ブラウザの決まり）。音楽の ON/OFF は 親画面の設定にしたがう。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var TARGET = { chiiku: 'app-chiiku/index.html', benkyo: 'app-benkyo/index.html' };
  var ARRIVE_MS = 2400;    // 汽車が とまるまで（2台目が おくれて着く分もふくむ）
  var DEPART_MS = 1100;    // しゅっぱつしてから 次の画面へ うつるまで
  var scene = null, started = false, going = false, timers = [];

  function settings() {
    try { return C.storage.getSettings(); } catch (e) { return { bgmOn: true, sfxOn: true }; }
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function start() {
    if (started || !scene) return;
    started = true;
    var s = settings();
    try { C.sfx.setSfxOn(s.sfxOn); C.sfx.setBgmOn(s.bgmOn); } catch (e) {}
    try { C.sfx.play('whistle'); } catch (e) {}
    if (s.bgmOn) { try { C.sfx.startTopBgm(); } catch (e) {} }
    scene.classList.add('started');
    later(function () { try { C.voice.speak('どれで あそぶ？'); } catch (e) {} }, ARRIVE_MS);
  }

  function go(kind, row) {
    if (going || !scene || !TARGET[kind]) return;
    going = true;
    try { C.sfx.play('whistle'); } catch (e) {}
    if (row) row.classList.add('go');
    later(function () { location.href = TARGET[kind]; }, DEPART_MS);
  }

  // 「もどる」で このページに もどったとき（ページが そのまま残っていた場合）は、はじめの形に もどす
  function reset() {
    timers.forEach(clearTimeout); timers = [];
    started = false; going = false;
    try { C.sfx.stopBgm(); } catch (e) {}
    if (!scene) return;
    scene.classList.remove('started');
    Array.prototype.forEach.call(scene.querySelectorAll('.go'), function (r) { r.classList.remove('go'); });
  }

  function boot() {
    scene = document.querySelector('[data-top]');
    if (!scene) return;           // テストなど、トップのページでないとき
    try { C.storage.init().catch(function () {}); } catch (e) {}
    scene.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-start]')) { start(); return; }
      var car = ev.target.closest('[data-kind]');
      if (!car) return;
      ev.preventDefault();
      if (!started) { start(); return; }
      go(car.getAttribute('data-kind'), car.closest('.row'));
    });
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) reset(); });
  }

  C.top = { TARGET: TARGET, start: start, go: go, reset: reset, _state: function () { return { started: started, going: going }; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
