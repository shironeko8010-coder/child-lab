/* 音声読み上げ。speak は reject しない。読み終わるか最大6秒で resolve。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var MAX_MS = 6000;
  var disabled = false;
  var override = null; // テスト用 { synth, make }

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
          resolve();
        }
        try {
          var synth = getSynth();
          if (!synth || !text) { finish(); return; }
          var u = makeUtterance(String(text));
          if (!u) { finish(); return; }
          u.lang = 'ja-JP';
          u.rate = 0.85;
          u.onend = finish;
          u.onerror = finish;
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

    // テスト用
    _disable: function () { disabled = true; override = null; },
    _enable: function () { disabled = false; override = null; },
    _setSynth: function (synth, make) { disabled = false; override = { synth: synth, make: make }; }
  };

  C.voice = voice;
})();
