/* 音声読み上げ。speak は reject しない。読み終わるか最大6秒で resolve。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var MAX_MS = 6000;
  var disabled = false;
  var override = null; // テスト用 { synth, make }
  var chosenName = '';
  var NATURAL = /enhanced|premium|neural|natural|kyoko|otoya|o-ren|oren|haruka|hattori|sayaka|ichiro|ayumi|nanami|google/i;

  // 声の選び方（通信しない声 localService=true だけ。自然そうな名前を優先）
  function pickVoice(voices) {
    if (!voices || !voices.length) return null;
    var cands = [];
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if (!v || v.localService !== true) continue;
      var l = String(v.lang || '').replace(/_/g, '-').toLowerCase();
      if (l === 'ja-jp' || l === 'ja') cands.push(v);
    }
    if (!cands.length) return null;
    for (var j = 0; j < cands.length; j++) {
      if (NATURAL.test(String(cands[j].name || ''))) return cands[j];
    }
    return cands[0];
  }

  function currentPick(synth) {
    try {
      var p = pickVoice(synth.getVoices ? synth.getVoices() : []);
      chosenName = p ? String(p.name || '') : '';
      return p;
    } catch (e) { return null; }
  }

  function duck(on) {
    try { if (C.sfx && C.sfx.duck) C.sfx.duck(on); } catch (e) { /* 無視 */ }
  }

  function getSynth() {
    if (disabled) return null;
    if (override) return override.synth;
    try {
      return (typeof window.speechSynthesis !== 'undefined' && window.speechSynthesis) || null;
    } catch (e) { return null; }
  }

  function makeUtterance(text) {
    if (override) return override.make(text);
    if (typeof window.SpeechSynthesisUtterance === 'undefined') return null;
    return new window.SpeechSynthesisUtterance(text);
  }

  var voice = {
    isAvailable: function () {
      return !!getSynth() && (!!override || typeof window.SpeechSynthesisUtterance !== 'undefined');
    },

    speak: function (text) {
      return new Promise(function (resolve) {
        var finished = false;
        var timer = null;
        function finish() {
          if (finished) return;
          finished = true;
          if (timer) clearTimeout(timer);
          duck(false);
          resolve();
        }
        try {
          var synth = getSynth();
          if (!synth || !text) { finish(); return; }
          var u = makeUtterance(String(text));
          if (!u) { finish(); return; }
          u.lang = 'ja-JP';
          u.rate = 0.85;
          u.pitch = 1.1;
          var pv = currentPick(synth);
          if (pv) { try { u.voice = pv; } catch (e) { /* 無視 */ } }
          u.onend = finish;
          u.onerror = finish;
          duck(true);
          timer = setTimeout(finish, MAX_MS);
          try { synth.cancel(); } catch (e) { /* 無視 */ }
          synth.speak(u);
        } catch (e) {
          finish();
        }
      });
    },

    cancel: function () {
      try {
        var synth = getSynth();
        if (synth) synth.cancel();
      } catch (e) { /* 無視 */ }
    },

    currentVoiceName: function () { return chosenName; },

    // テスト用
    _pickVoice: pickVoice,
    _disable: function () { disabled = true; override = null; },
    _enable: function () { disabled = false; override = null; },
    _setSynth: function (synth, make) { disabled = false; override = { synth: synth, make: make }; }
  };

  // getVoices() は後から埋まる。変わったら選び直す
  try {
    var s0 = (typeof window.speechSynthesis !== 'undefined') ? window.speechSynthesis : null;
    if (s0) {
      currentPick(s0);
      if (s0.addEventListener) s0.addEventListener('voiceschanged', function () { currentPick(s0); });
    }
  } catch (e) { /* 無視 */ }

  C.voice = voice;
})();
