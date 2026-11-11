/* 音声読み上げ。音声ファイル（VOICEVOX:ずんだもん）があれば鳴らし、なければ端末の声で読む。speak は reject しない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var MAX_MS = 6000;
  var disabled = false;
  var override = null; // テスト用 { synth, make }
  var chosenName = '';
  var NATURAL = /enhanced|premium|neural|natural|kyoko|otoya|o-ren|oren|haruka|hattori|sayaka|ichiro|ayumi|nanami|google/i;

  // 数字（例：10）を、ひらがなの読み（じゅう）にしてから読ませる。
  // 日本語の声がまだ用意できていない時などに、端末が「テン」のように英語で読むのを防ぐ。
  var D = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
  var HYAKU = ["", "ひゃく", "にひゃく", "さんびゃく", "よんひゃく", "ごひゃく", "ろっぴゃく", "ななひゃく", "はっぴゃく", "きゅうひゃく"];
  var SEN = ["", "せん", "にせん", "さんぜん", "よんせん", "ごせん", "ろくせん", "ななせん", "はっせん", "きゅうせん"];
  function numToKana(n) {
    n = Math.floor(Number(n));
    if (!(n >= 0) || n > 9999) return String(n);
    if (n === 0) return "ゼロ";
    var s = SEN[Math.floor(n / 1000)] + HYAKU[Math.floor(n / 100) % 10];
    var t = Math.floor(n / 10) % 10, o = n % 10;
    if (t) s += (t === 1 ? "" : D[t]) + "じゅう";
    return s + D[o];
  }
  function kanaNumbers(text) {
    return String(text).replace(/[0-9]+/g, function (m) { return numToKana(m); });
  }

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

  /* ---------- 音声ファイル（VOICEVOX:ずんだもん） ----------
     shared/voice-clips.js が self.CHIID_VOICE = { dir, ext, clips: { 文: id } } を用意する。
     文の見分け方：ふりがなの記号を取り、空白をつめたもの。「｜」は部品の区切り（画面には出ない）。 */
  var clipsOn = true;          // テストで端末の声だけにするとき false
  var clipsOverride = null;    // テスト用 { clips, play }
  var audioSeq = 0;
  var curAudio = null;
  var baseDir = null;

  function keyOf(text) {
    return String(text == null ? '' : text)
      .replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$1')
      .replace(/[\s　]+/g, '');
  }
  // 「｜」で部品に分け、さらに文（。！？ のあと）ごとに分ける
  function pieces(text) {
    var out = [];
    String(text == null ? '' : text).split('｜').forEach(function (part) {
      String(part).replace(/([。！？])/g, '$1\n').split('\n').forEach(function (s) {
        var k = keyOf(s);
        if (k) out.push(k);
      });
    });
    return out;
  }
  function plainText(text) { return String(text == null ? '' : text).replace(/｜/g, ' '); }

  function globalVoice() { return (typeof self !== 'undefined' && self.CHIID_VOICE) || null; }
  function clipTable() {
    if (clipsOverride) return clipsOverride.clips;
    var g = globalVoice();
    return (g && g.clips) || null;
  }
  function clipDir() {
    if (baseDir != null) return baseDir;
    var dir = (globalVoice() || {}).dir || 'voice/z/';
    baseDir = '../' + dir;   // アプリ・テストのページは1つ下のフォルダにある
    try {
      var ss = document.getElementsByTagName('script');
      for (var i = 0; i < ss.length; i++) {
        var src = ss[i].getAttribute('src') || '';
        if (/(^|\/)shared\/voice\.js(\?|$)/.test(src)) { baseDir = src.replace(/shared\/voice\.js.*$/, '') + dir; break; }
      }
    } catch (e) { /* 無視 */ }
    return baseDir;
  }
  function clipUrl(id) { return clipDir() + id + ((globalVoice() || {}).ext || '.ogg'); }

  // 文がぜんぶ音声ファイルにあれば、その id の並びを返す。1つでもなければ null
  function clipIds(text) {
    var table = clipsOn ? clipTable() : null;
    if (!table) return null;
    var ps = pieces(text), ids = [];
    if (!ps.length) return null;
    for (var i = 0; i < ps.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(table, ps[i])) { noteMiss(ps[i]); return null; }
      ids.push(table[ps[i]]);
    }
    return ids;
  }
  // 開発用：音声ファイルがなかった文を記録する（localStorage の chiid-voice-dev が '1' のときだけ）
  function noteMiss(k) {
    try {
      if (window.localStorage.getItem('chiid-voice-dev') !== '1') return;
      var list = JSON.parse(window.localStorage.getItem('chiid-voice-miss') || '[]');
      if (list.indexOf(k) < 0 && list.length < 1000) {
        list.push(k);
        window.localStorage.setItem('chiid-voice-miss', JSON.stringify(list));
      }
    } catch (e) { /* 無視 */ }
  }

  // 1つの音声ファイルを鳴らす。終われば true、鳴らせなければ false で resolve
  function playOne(id, seq) {
    if (clipsOverride && clipsOverride.play) return clipsOverride.play(id);
    return new Promise(function (resolve) {
      var done = false, timer = null, a = null;
      function end(ok) {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        if (curAudio === a) curAudio = null;
        resolve(ok);
      }
      try {
        if (seq !== audioSeq) { end(true); return; }
        a = new window.Audio(clipUrl(id));
        curAudio = a;
        a.onended = function () { end(true); };
        a.onerror = function () { end(false); };
        a.onloadedmetadata = function () {
          var d = Number(a.duration);
          if (d > 0 && isFinite(d)) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () { end(true); }, d * 1000 + 1500);
          }
        };
        timer = setTimeout(function () { end(true); }, 15000);
        var p = a.play();
        if (p && p.catch) p.catch(function () { end(false); });
      } catch (e) { end(false); }
    });
  }
  function stopAudio() {
    audioSeq++;
    try { if (curAudio) { curAudio.pause(); curAudio = null; } } catch (e) { /* 無視 */ }
  }

  // 端末の声で読む（音声ファイルがないとき）。読み終わるか最大6秒で resolve
  function speakTts(text) {
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
        var u = makeUtterance(kanaNumbers(plainText(text)));
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
  }

  var voice = {
    isAvailable: function () {
      if (disabled) return false;
      if (clipsOn && clipTable() && (clipsOverride || typeof window.Audio !== 'undefined')) return true;
      return !!getSynth() && (!!override || typeof window.SpeechSynthesisUtterance !== 'undefined');
    },

    speak: function (text) {
      if (disabled || !text) return Promise.resolve();
      var ids = clipIds(text);
      if (!ids) return speakTts(text);
      stopAudio();
      try { var sy = getSynth(); if (sy) sy.cancel(); } catch (e) { /* 無視 */ }
      var seq = audioSeq, i = 0;
      duck(true);
      return new Promise(function (resolve) {
        function next() {
          if (seq !== audioSeq || i >= ids.length) { duck(false); resolve(); return; }
          playOne(ids[i++], seq).then(function (ok) {
            if (ok) { next(); return; }
            duck(false);
            if (seq !== audioSeq) { resolve(); return; }
            speakTts(text).then(resolve);   // 鳴らせなかったら、端末の声で読む
          });
        }
        next();
      });
    },

    cancel: function () {
      stopAudio();
      try {
        var synth = getSynth();
        if (synth) synth.cancel();
      } catch (e) { /* 無視 */ }
    },

    currentVoiceName: function () { return chosenName; },
    hasClip: function (text) { return !!clipIds(text); },
    keyOf: keyOf,
    pieces: pieces,
    CREDIT: 'VOICEVOX:ずんだもん',

    // テスト用
    _pickVoice: pickVoice,
    _disable: function () { disabled = true; override = null; },
    numToKana: numToKana,
    kanaNumbers: kanaNumbers,
    _enable: function () { disabled = false; override = null; clipsOn = true; clipsOverride = null; },
    // 端末の声だけで試す（音声ファイルは使わない）
    _setSynth: function (synth, make) { disabled = false; override = { synth: synth, make: make }; clipsOn = false; },
    // 音声ファイルの代わり（clips: {文: id}、play(id) → Promise<true/false>）
    _setClips: function (clips, play) { disabled = false; clipsOn = true; clipsOverride = { clips: clips, play: play }; }
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
