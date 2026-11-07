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
  var bgmStep = 0;
  var ducked = false;       // 読み上げ中は BGM を下げる
  var sfxBus = null, bgmBus = null, comp = null;
  var BGM_VOL = 0.18;       // 旧0.05の約3.6倍
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

  // BGM：短い旋律（ドレミ系）を一定間隔でくり返す
  var MELODY = [523, 587, 659, 784, 659, 587, 523, 0, 587, 659, 784, 880, 784, 659, 587, 0];
  var STEP_MS = 450;

  function bgmTick() {
    try {
      if (!bgmPlaying || !bgmOn) return;
      var ac = getCtx();
      if (!ac) return;
      var f = MELODY[bgmStep % MELODY.length];
      bgmStep++;
      if (f) tone(ac, f, 0, 0.35, BGM_VOL, 'sine', bgmBus);
    } catch (e) { /* 無視 */ }
  }

  function startBgm() {
    try {
      if (!bgmOn || bgmPlaying) return;
      if (disabled) return;
      bgmPlaying = true;
      bgmStep = 0;
      bgmTick();
      bgmTimer = setInterval(bgmTick, STEP_MS);
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
    _isDucked: function () { return ducked; },
    _ctxCreated: function () { return ctx !== null; },
    _disable: function () { disabled = true; },
    _reset: function () {
      stopBgm();
      if (ctx && ctx.close) { try { ctx.close(); } catch (e) {} }
      ctx = null;
      sfxBus = null; bgmBus = null; comp = null;
      ducked = false;
      disabled = false;
      sfxOn = true;
      bgmOn = true;
    }
  };
})();
