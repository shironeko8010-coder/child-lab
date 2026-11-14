/* 英語の読み上げ。Chiid.voiceEn
   端末に入っている英語の声（通信しない声＝localService だけ）で読む。ずんだもん（voice.js）とは別の部品。
   声がない端末では available() が false になり、speak は何もせずに終わる。speak は reject しない。
   設計書：docs/superpowers/specs/2026-11-14-benkyo-eigo-design.md（6章） */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var RATE = 0.8;
  var MAX_MS = 5000;           // 読み終わりの合図が来なくても、この時間で終わりにする
  var override = null, maxMs = MAX_MS;
  var chosen = null, current = null;   // current：いま読んでいる分の後かたづけ

  function synth() {
    if (override) return override;
    try { return window.speechSynthesis || null; } catch (e) { return null; }
  }
  function isEn(v) { return /^en([-_]|$)/i.test((v && v.lang) || ''); }
  function score(v) {
    var l = String(v.lang || '').toLowerCase();
    return (/^en[-_]us/.test(l) ? 20 : /^en[-_]gb/.test(l) ? 10 : 0) + (v['default'] ? 1 : 0);
  }
  // アメリカ英語 → イギリス英語 → そのほかの英語。同じ中では、端末の「標準」の声を先に
  function pick() {
    var s = synth(); chosen = null;
    if (!s || !s.getVoices) return null;
    var list;
    try { list = s.getVoices() || []; } catch (e) { list = []; }
    var local = list.filter(function (v) { return v && v.localService === true && isEn(v); });
    local.sort(function (a, b) { return score(b) - score(a); });
    chosen = local[0] || null;
    return chosen;
  }
  // 声の一覧が変わったときに知らせる先（えい語の画面が「きく」を使えるようにするため）
  var listeners = [];
  function changed() {
    pick();
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { /* 無視 */ } });
  }
  function watch() {   // 声の一覧が遅れて届く端末のため、届いたら選び直す
    var s = synth(); if (!s) return;
    try {
      // 本物は addEventListener（voice.js の日本語の声の見張りを 上書きしない）。テストの代わりは onvoiceschanged
      if (!override && s.addEventListener) s.addEventListener('voiceschanged', changed);
      else s.onvoiceschanged = changed;
    } catch (e) { /* 無視 */ }
  }
  function onChange(fn) {
    listeners.push(fn);
    return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }
  function duck(on) { try { if (C.sfx && C.sfx.duck) C.sfx.duck(on); } catch (e) { /* 無視 */ } }

  function available() { return !!(chosen || pick()); }
  function voiceName() { var v = chosen || pick(); return v ? v.name : ''; }

  function cancel() {
    var s = synth();
    if (current) { var c = current; current = null; c(); }
    try { if (s && s.cancel) s.cancel(); } catch (e) { /* 無視 */ }
  }

  function speak(text) {
    return new Promise(function (resolve) {
      var s = synth(), v = chosen || pick();
      if (!s || !v || !text) { resolve(); return; }
      cancel();
      try { if (C.voice && C.voice.cancel) C.voice.cancel(); } catch (e) { /* 無視 */ }
      var finished = false, timer = null;
      function finish() {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        if (current === finish) current = null;
        duck(false);
        resolve();
      }
      current = finish;
      duck(true);
      var u;
      try { u = override ? {} : new window.SpeechSynthesisUtterance(text); } catch (e) { u = {}; }
      u.text = text; u.voice = v; u.lang = v.lang; u.rate = RATE;
      u.onend = finish; u.onerror = finish;
      timer = setTimeout(finish, maxMs);
      try { s.speak(u); } catch (e) { finish(); }
    });
  }

  C.voiceEn = {
    RATE: RATE, MAX_MS: MAX_MS,
    available: available, voiceName: voiceName, speak: speak, cancel: cancel, onChange: onChange,
    // テスト用：本物の speechSynthesis の代わりを差しこむ（null で もどす）。opts.maxMs で待ち時間を短くできる
    _override: function (fake, opts) {
      cancel();
      override = fake || null;
      maxMs = (opts && opts.maxMs) || MAX_MS;
      chosen = null;
      watch(); pick();
    }
  };
  watch(); pick();
})();
