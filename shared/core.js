/* 共通の名前空間。すべての部品は window.Chiid にぶら下げる。 */
(function () {
  'use strict';
  window.Chiid = window.Chiid || {};

  // 画面の高さ1%（--vh）を、実際に見えている高さ（window.innerHeight）から決める。
  // CSS の 100dvh は、古いブラウザでは使えず 100vh（アドレスバーを除かない高さ）になり、
  // 実機で 画面の下が見切れることがあったため。CSS 側は --vh を使う（ui.css に 1dvh の予備あり）。
  function setVh() {
    try {
      var h = window.innerHeight;
      if (h > 0) document.documentElement.style.setProperty('--vh', (h / 100) + 'px');
    } catch (e) { /* できなくても CSS の予備で動く */ }
  }
  setVh();
  try {
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', function () { setTimeout(setVh, 300); });
  } catch (e) {}
})();
