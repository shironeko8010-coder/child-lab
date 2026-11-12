/* 効果音・BGM（WebAudioで合成）。外部の音声ファイルは使わない。
   AudioContext は最初に音を鳴らすとき（＝タップの中）に作る。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var ctx = null;
  var disabled = false;     // テスト用：AudioContext を使えない状態にする
  var sfxOn = true;
  var bgmOn = true;
  var bgmPlaying = false;
  var bgmTimer = null;
  var ducked = false;       // 読み上げ中は BGM を下げる
  var sfxBus = null, bgmBus = null, comp = null;
  var BGM_SCALE = 1;       // BGM 全体の音量（曲ごとの音量にかける）。前の単音BGMは 0.30 だった
  var SFX_BUS_GAIN = 1.2;   // 効果音は少しだけ上げる
  var DUCK_RATIO = 0.5;

  function getCtx() {
    if (disabled) return null;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        buildGraph(ctx);
      }
      if (ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function bgmGainTarget() { return ducked ? DUCK_RATIO : 1; }

  // 音の通り道：効果音/BGM -> コンプレッサー（音割れ防止）-> スピーカー
  function buildGraph(ac) {
    try {
      comp = ac.createDynamicsCompressor ? ac.createDynamicsCompressor() : null;
      sfxBus = ac.createGain();
      bgmBus = ac.createGain();
      sfxBus.gain.value = SFX_BUS_GAIN;
      bgmBus.gain.value = bgmGainTarget();
      sfxBus.connect(comp || ac.destination);
      bgmBus.connect(comp || ac.destination);
      if (comp) comp.connect(ac.destination);
    } catch (e) { sfxBus = null; bgmBus = null; comp = null; }
  }

  function applyDuck(ac) {
    if (!ac || !bgmBus) return;
    try {
      var t = ac.currentTime;
      bgmBus.gain.cancelScheduledValues(t);
      bgmBus.gain.setTargetAtTime(bgmGainTarget(), t, 0.08);
    } catch (e) { /* 無視 */ }
  }

  // 1音を鳴らす：周波数Hz、開始までの秒、長さ秒、音量、波形
  function tone(ac, freq, start, dur, vol, type, bus) {
    var t0 = ac.currentTime + start;
    var osc = ac.createOscillator();
    var g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus || sfxBus || ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // 効果音の定義：[周波数, 開始, 長さ, 音量, 波形]
  var SOUNDS = {
    tap: [[660, 0, 0.08, 0.15, 'sine']],
    correct: [[523, 0, 0.15, 0.2, 'triangle'], [659, 0.12, 0.15, 0.2, 'triangle'], [784, 0.24, 0.3, 0.2, 'triangle']],
    // やわらかい2音（低く叱る音にしない）
    oops: [[440, 0, 0.2, 0.15, 'sine'], [392, 0.2, 0.3, 0.15, 'sine']],
    star: [[880, 0, 0.1, 0.15, 'sine'], [1175, 0.08, 0.1, 0.15, 'sine'], [1568, 0.16, 0.25, 0.15, 'sine']]
  };

  function play(name) {
    try {
      if (!sfxOn) return;
      var def = SOUNDS[name];
      if (!def) return;
      var ac = getCtx();
      if (!ac) return;
      def.forEach(function (n) { tone(ac, n[0], n[1], n[2], n[3], n[4], sfxBus); });
    } catch (e) { /* 音が出なくても遊びは止めない */ }
  }

  /* ---------- BGM：3曲を順番に流す（ぽかぽか → わくわく → ふわふわ → …） ----------
     曲はこのアプリのために作ったもの。1曲は「メロディ → 飾りの音つきメロディ → 伴奏だけ4小節」で、
     終わると次の曲へ。音は先読み（0.2秒先まで）で予約して鳴らす。 */
  function midi(n) {   // 'C5' 'F#4' 'Bb3' → 周波数
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    var k = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, ((+m[3] + 1) * 12 + k - 69) / 12);
  }
  function env(g, t, vol, atk, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function osc(ac, type, f, t, dur, vol, atk) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    env(g, t, vol, atk, dur); o.connect(g); g.connect(bgmBus || ac.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  var noiseBuf = null;
  var INST = {
    bell: function (ac, f, t, d, v) {          // オルゴール
      osc(ac, 'sine', f, t, 1.2, v, 0.005); osc(ac, 'sine', f * 2, t, 0.5, v * 0.25, 0.005); osc(ac, 'sine', f * 3.01, t, 0.25, v * 0.08, 0.005);
    },
    lead: function (ac, f, t, d, v) {          // やわらかい笛
      var o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      var len = Math.max(0.12, d * 0.9);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02);
      g.gain.setValueAtTime(v * 0.8, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.08);
      o.connect(lp); lp.connect(g); g.connect(bgmBus || ac.destination); o.start(t); o.stop(t + len + 0.12);
    },
    pluck: function (ac, f, t, d, v) {         // はじく音
      var o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.25);
      env(g, t, v, 0.004, 0.35); o.connect(lp); lp.connect(g); g.connect(bgmBus || ac.destination); o.start(t); o.stop(t + 0.4);
    },
    marimba: function (ac, f, t, d, v) {       // 木琴
      osc(ac, 'sine', f, t, 0.7, v, 0.004); osc(ac, 'sine', f * 4, t, 0.08, v * 0.3, 0.002);
    },
    bass: function (ac, f, t, d, v) { osc(ac, 'triangle', f, t, Math.min(Math.max(d * 0.9, 0.2), 0.9), v, 0.01); },
    shaker: function (ac, f, t, d, v) {        // シャカシャカ（ノイズ）
      if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.05), ac.sampleRate);
        var ch = noiseBuf.getChannelData(0);
        for (var i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
      }
      var s = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 6000; g.gain.value = v;
      s.connect(hp); hp.connect(g); g.connect(bgmBus || ac.destination); s.start(t);
    }
  };

  // メロディの書き方： '音名:拍' をスペースで区切る（r は休み）
  function mel(s) { return s.trim().split(/\s+/).map(function (x) { var p = x.split(':'); return [p[0], +p[1]]; }); }
  var CH = { C: ['C3', 'E4', 'G4'], Dm: ['D3', 'F4', 'A4'], Em: ['E3', 'G4', 'B4'], F: ['F3', 'A4', 'C5'], G: ['G2', 'B3', 'D4'],
    Am: ['A2', 'C4', 'E4'], Bb: ['Bb2', 'D4', 'F4'], Gm: ['G2', 'Bb3', 'D4'], D: ['D3', 'F#4', 'A4'] };
  var SONGS = [
    { name: 'poka', bpm: 112, bar: 3, inst: 'bell', vol: 0.20, acc: 'waltz',   // ぽかぽか（ワルツ）
      mel: mel('A4:2 C5:1 F5:2 E5:1 D5:1 C5:1 A4:1 C5:3 Bb4:2 D5:1 G5:2 F5:1 E5:1 D5:1 C5:1 C5:3 ' +
               'A4:2 C5:1 F5:2 A5:1 G5:1 F5:1 E5:1 D5:3 Bb4:1 D5:1 F5:1 E5:2 G5:1 G5:1 E5:1 C5:1 F5:3'),
      chords: ['F', 'Dm', 'Bb', 'C', 'Bb', 'Gm', 'C', 'C', 'F', 'Dm', 'C', 'Gm', 'Bb', 'C', 'C', 'F'] },
    { name: 'waku', bpm: 116, bar: 4, inst: 'lead', vol: 0.16, acc: 'pop',     // わくわく（おさんぽ）
      mel: mel('E5:.5 G5:.5 E5:.5 C5:.5 D5:1 E5:1 F5:.5 A5:.5 F5:.5 D5:.5 E5:1 C5:1 D5:.5 E5:.5 F5:.5 G5:.5 A5:1 G5:1 E5:1.5 D5:.5 C5:2 ' +
               'A4:.5 C5:.5 E5:.5 A5:.5 G5:1 E5:1 F5:.5 E5:.5 D5:.5 C5:.5 D5:1 F5:1 E5:.5 D5:.5 C5:.5 D5:.5 B4:1 G4:1 C5:2 r:2'),
      chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'] },
    { name: 'fuwa', bpm: 84, bar: 4, inst: 'marimba', vol: 0.22, acc: 'arp',   // ふわふわ（マリンバ）
      mel: mel('B4:1 D5:1 G5:1.5 E5:.5 D5:1 B4:1 G4:2 A4:1 B4:1 D5:1 E5:1 D5:3 r:1 ' +
               'G5:1 E5:1 D5:1.5 B4:.5 E5:1 D5:1 B4:2 A4:1 B4:1 D5:1 A4:1 G4:3 r:1'),
      chords: ['G', 'Em', 'C', 'D', 'G', 'C', 'D', 'G'] }
  ];

  // 1曲分の音を、時刻（曲の始めからの秒）つきの一覧にする：[秒, 楽器, 周波数, 長さ, 音量]
  function buildSong(s) {
    var spb = 60 / s.bpm, ev = [], bars = s.chords.length;
    function addMel(start, sparkle) {
      var tt = start;
      s.mel.forEach(function (n) {
        if (n[0] !== 'r') {
          ev.push([tt, s.inst, midi(n[0]), n[1] * spb, s.vol]);
          if (sparkle && n[1] >= 1) ev.push([tt, 'bell', midi(n[0]) * 2, n[1] * spb, s.vol * 0.18]);
        }
        tt += n[1] * spb;
      });
    }
    function addAcc(start, nbars) {
      for (var b = 0; b < nbars; b++) {
        var c = CH[s.chords[b % bars]], t0 = start + b * s.bar * spb, i;
        if (s.acc === 'waltz') {
          ev.push([t0, 'bass', midi(c[0]), spb, 0.20]);
          for (i = 1; i < 3; i++) { ev.push([t0 + i * spb, 'bell', midi(c[1]), spb, 0.06]); ev.push([t0 + i * spb, 'bell', midi(c[2]), spb, 0.06]); }
        } else if (s.acc === 'pop') {
          ev.push([t0, 'bass', midi(c[0]), spb, 0.24]);
          ev.push([t0 + 2 * spb, 'bass', midi(c[0]) * 1.5, spb, 0.20]);
          for (i = 1; i < 4; i += 2) { ev.push([t0 + i * spb, 'pluck', midi(c[1]), spb, 0.05]); ev.push([t0 + i * spb, 'pluck', midi(c[2]), spb, 0.05]); }
          for (i = 0; i < 8; i++) ev.push([t0 + i * spb / 2, 'shaker', 0, 0, i % 2 ? 0.05 : 0.025]);
        } else {   // arp
          ev.push([t0, 'bass', midi(c[0]), s.bar * spb, 0.16]);
          var arp = [c[0], c[1], c[2], c[1]];
          for (i = 0; i < 8; i++) ev.push([t0 + i * spb / 2, 'marimba', midi(arp[i % 4]) * (i % 4 === 0 ? 2 : 1), spb, 0.07]);
        }
      }
    }
    var sec = bars * s.bar * spb;
    addMel(0, false); addAcc(0, bars);
    addMel(sec, true); addAcc(sec, bars);
    addAcc(sec * 2, 4);
    ev.sort(function (a, b) { return a[0] - b[0]; });
    return { ev: ev, len: sec * 2 + 4 * s.bar * spb + spb };   // 最後に1拍あけて次の曲へ
  }

  var songIdx = 0, song = null, songBase = 0, evIdx = 0;
  var LOOKAHEAD = 0.2, TICK_MS = 40;
  function nextSong(ac, at) {
    song = buildSong(SONGS[songIdx % SONGS.length]);
    songBase = at; evIdx = 0;
  }
  function bgmTick() {
    try {
      if (!bgmPlaying || !bgmOn) return;
      var ac = getCtx();
      if (!ac) return;
      if (!song) nextSong(ac, ac.currentTime + 0.1);
      var until = ac.currentTime + LOOKAHEAD;
      for (var guard = 0; guard < 400; guard++) {
        if (evIdx >= song.ev.length) {          // 1曲おわり → 次の曲
          songIdx = (songIdx + 1) % SONGS.length;
          nextSong(ac, songBase + song.len);
        }
        var e = song.ev[evIdx], at = songBase + e[0];
        if (at > until) break;
        if (at >= ac.currentTime - 0.02) INST[e[1]](ac, e[2], at, e[3], e[4] * BGM_SCALE);
        evIdx++;
      }
    } catch (e) { /* 無視 */ }
  }

  function startBgm() {
    try {
      if (!bgmOn || bgmPlaying) return;
      if (disabled) return;
      bgmPlaying = true;
      song = null;                 // 止めたあとは、いまの曲の始めから
      bgmTick();
      bgmTimer = setInterval(bgmTick, TICK_MS);
    } catch (e) { bgmPlaying = false; }
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  C.sfx = {
    play: play,
    startBgm: startBgm,
    stopBgm: stopBgm,
    duck: function (on) {
      ducked = !!on;
      applyDuck(ctx);
    },
    setSfxOn: function (b) { sfxOn = !!b; },
    setBgmOn: function (b) {
      bgmOn = !!b;
      if (!bgmOn) stopBgm();
    },
    isSfxOn: function () { return sfxOn; },
    isBgmOn: function () { return bgmOn; },
    isBgmPlaying: function () { return bgmPlaying; },
    // ---- テスト用 ----
    _bgmGainTarget: bgmGainTarget,
    _songNames: function () { return SONGS.map(function (s) { return s.name; }); },
    _buildSong: function (i) { return buildSong(SONGS[i]); },
    _songIdx: function () { return songIdx; },
    _isDucked: function () { return ducked; },
    _ctxCreated: function () { return ctx !== null; },
    _disable: function () { disabled = true; },
    _reset: function () {
      stopBgm();
      if (ctx && ctx.close) { try { ctx.close(); } catch (e) {} }
      ctx = null;
      sfxBus = null; bgmBus = null; comp = null;
      songIdx = 0; song = null;
      ducked = false;
      disabled = false;
      sfxOn = true;
      bgmOn = true;
    }
  };
})();
