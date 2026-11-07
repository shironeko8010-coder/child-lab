/* 1日の利用時間の管理。10秒ごとに利用秒数を保存し、画面が隠れている間は数えない。
   日付は端末のローカル日付（0時で切り替え）。超過しても止めず、onOver で知らせるだけ
   （今の問題を終えてからお休みを出すのは、画面側の役目）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var TICK_MS = 10000;
  var timers = { setInterval: function (f, ms) { return window.setInterval(f, ms); },
                 clearInterval: function (h) { window.clearInterval(h); } };
  var visibleOverride = null;   // テスト用
  var clock = function () { return new Date(); };
  var profileId = null;
  var handle = null;
  var last = 0;                 // 最後に数えた時刻（ms）
  var carryMs = 0;              // 1秒に満たない端数
  var overCbs = [];
  var overFired = false;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nextMidnight(ms) {
    var d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  }
  function isVisible() {
    if (visibleOverride !== null) return visibleOverride;
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
  }

  function limitSec() {
    var m = C.storage.getSettings().dailyLimitMin;
    return m > 0 ? m * 60 : 0;
  }
  function today() { return dateStr(clock()); }

  // 最後に数えた時刻から今までを保存する（0時をまたぐ分は日ごとに分ける）
  function flush() {
    if (profileId === null) return;
    var nowMs = clock().getTime();
    if (nowMs < last) { last = nowMs; return; }   // 時計が戻った
    var cur = last;
    while (cur < nowMs) {
      var edge = Math.min(nowMs, nextMidnight(cur));
      var ms = edge - cur + carryMs;
      var sec = Math.floor(ms / 1000);
      carryMs = ms - sec * 1000;
      if (sec > 0) C.storage.addPlaySeconds(profileId, dateStr(new Date(cur)), sec);
      if (edge < nowMs) carryMs = 0;   // 日をまたぐときは端数を捨てる（前日に入れ損ねた分は誤差）
      cur = edge;
    }
    last = nowMs;
  }

  function checkOver() {
    if (profileId !== null && !overFired && timer.isOver(profileId)) {
      overFired = true;
      overCbs.slice().forEach(function (cb) { try { cb(profileId); } catch (e) { /* 無視 */ } });
    }
  }

  function tick() {
    if (profileId === null) return;
    if (isVisible()) { flush(); } else { last = clock().getTime(); carryMs = 0; }
    checkOver();
  }

  function onVisibility() {
    if (profileId === null) return;
    if (isVisible()) { last = clock().getTime(); } else { flush(); }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', onVisibility);
  }

  var timer = {
    start: function (id, now) {
      timer.stop();
      clock = typeof now === 'function' ? now : function () { return new Date(); };
      profileId = id;
      last = clock().getTime();
      carryMs = 0;
      overFired = timer.isOver(id);   // すでに超過なら、開始時に通知しない（isOver で分かる）
      handle = timers.setInterval(tick, TICK_MS);
    },
    stop: function () {
      if (profileId !== null) { if (isVisible()) flush(); }
      if (handle !== null) { timers.clearInterval(handle); handle = null; }
      profileId = null;
    },
    remainingSec: function (id) {
      var lim = limitSec();
      if (!lim) return null;
      if (id === profileId && isVisible()) flush();
      return Math.max(0, lim - C.storage.getPlaySeconds(id, today()));
    },
    isOver: function (id) {
      var r = timer.remainingSec(id);
      return r !== null && r <= 0;
    },
    onOver: function (cb) { if (typeof cb === 'function') overCbs.push(cb); },

    // テスト用
    _tick: tick,
    _setTimers: function (t) {
      timers = t || { setInterval: function (f, ms) { return window.setInterval(f, ms); },
                      clearInterval: function (h) { window.clearInterval(h); } };
    },
    _setVisible: function (b) { visibleOverride = b; if (b !== null) onVisibility(); }
  };

  C.timer = timer;
})();
