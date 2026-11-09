/* ひらがなゲーム「おとを きいて、なぞろう」。Chiid.game.start(profileId)
   流れ：よみあげ → えらぶ（3〜4たく）→ なぞる → ごほうび → つぎの もんだい。
   園児が見る文字は、ひらがなと絵だけ（親画面・おとなゲートは大人向けなので例外）。
   通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'hiragana';
  var MAX_LEVEL = 3;
  var MASK = 160;          // なぞり判定のマスクの大きさ（画素）
  var LINE = 0.11;         // なぞり線の太さ（キャンバスの大きさに対する割合）
  var GLYPH_FONT = 'sans-serif'; // trace.rasterizeGlyph と同じ字形で薄い文字を描く

  var app = null;
  var token = 0;           // 画面ごとの番号。古い画面のタイマーやタップを無視する
  var cleanup = [];        // 画面を切り替えるときに外すもの
  var st = {
    profileId: null,
    level: 1,
    recent: [],            // 今のレベルになってからの正誤（古い順）
    missCounts: {},
    lastCh: null,
    resting: false
  };

  /* ---------- 小道具 ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(markup, cls) {
    var w = el('span', cls || 'ico');
    w.innerHTML = markup;
    return w;
  }
  function button(cls, onTap) {
    var b = el('button', cls);
    b.type = 'button';
    var myToken = token;
    b.addEventListener('click', function (ev) {
      if (myToken !== token) return;   // 前の画面のボタン
      onTap(ev, b);
    });
    return b;
  }
  function later(fn, ms) {
    var myToken = token;
    var h = setTimeout(function () { if (myToken === token) fn(); }, ms);
    cleanup.push(function () { clearTimeout(h); });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function item(ch) {
    var list = C.hira.ITEMS;
    for (var i = 0; i < list.length; i++) if (list[i].ch === ch) return list[i];
    return null;
  }
  function speak(text) {
    try { return C.voice.speak(text); } catch (e) { return Promise.resolve(); }
  }
  // 手書きの形で見せたい字（き・さ・ふ・り）は、線のデータで描く（glyphs.js）
  function hira(node, text) {
    node.textContent = "";
    if (C.glyphs) C.glyphs.fill(node, text); else node.textContent = text;
    return node;
  }
  function play(name) { try { C.sfx.play(name); } catch (e) { /* 音なしでも続ける */ } }

  function newScreen(name) {
    token++;
    cleanup.forEach(function (f) { try { f(); } catch (e) {} });
    cleanup = [];
    try { C.voice.cancel(); } catch (e) {}
    app.innerHTML = '';
    app.className = 'app scr-' + name;
    try { window.scrollTo(0, 0); } catch (e) {}
    return app;
  }

  /* ---------- 絵（SVG） ---------- */
  // キャラクター「ぴよ」。mood: 'normal' | 'happy' | 'think' | 'sleep'
  function chara(mood) {
    var eyes;
    if (mood === 'happy') {
      eyes = '<path d="M38 50 q6 -8 12 0" class="c-line"/><path d="M70 50 q6 -8 12 0" class="c-line"/>';
    } else if (mood === 'sleep') {
      eyes = '<path d="M37 50 q7 6 14 0" class="c-line"/><path d="M69 50 q7 6 14 0" class="c-line"/>';
    } else {
      eyes = '<circle cx="44" cy="50" r="6" fill="#3a3a3a"/><circle cx="76" cy="50" r="6" fill="#3a3a3a"/>' +
             '<circle cx="46" cy="47" r="2" fill="#fff"/><circle cx="78" cy="47" r="2" fill="#fff"/>';
    }
    var mouth = mood === 'happy'
      ? '<path d="M52 64 L68 64 L60 76 Z" fill="#ff8a3d"/>'
      : '<path d="M53 62 L67 62 L60 71 Z" fill="#ff8a3d"/>';
    var zzz = mood === 'sleep'
      // ねむりの しるし（文字ではなく、線でかく）
      ? '<path d="M94 14 h10 l-10 11 h10" class="c-z"/><path d="M108 2 h7 l-7 8 h7" class="c-z small"/>' : '';
    return svg(
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
        '<ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(0,0,0,.08)"/>' +
        '<path d="M58 14 q-6 -12 4 -12 q-2 6 4 8" fill="#ffc21a"/>' +
        '<ellipse cx="60" cy="62" rx="44" ry="46" fill="#ffd84d"/>' +
        '<ellipse cx="60" cy="74" rx="28" ry="26" fill="#fff0b3"/>' +
        '<path d="M16 66 q-12 8 -4 20 q8 -2 10 -10 Z" fill="#ffc21a" class="c-wing-l"/>' +
        '<path d="M104 66 q12 8 4 20 q-8 -2 -10 -10 Z" fill="#ffc21a" class="c-wing-r"/>' +
        eyes +
        '<ellipse cx="32" cy="64" rx="7" ry="4.5" fill="#ff9fb0" opacity=".8"/>' +
        '<ellipse cx="88" cy="64" rx="7" ry="4.5" fill="#ff9fb0" opacity=".8"/>' +
        mouth +
        '<path d="M46 106 l-4 8 M50 106 l0 8 M70 106 l0 8 M74 106 l4 8" stroke="#ff8a3d" stroke-width="3" stroke-linecap="round"/>' +
        zzz +
      '</svg>', 'chara chara-' + (mood || 'normal'));
  }
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.3 7 1-5 4.9 1.2 6.9L12 17.6l-6.3 3.3 1.2-6.9-5-4.9 7-1z" fill="#ffd23f" stroke="#f0a800" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  var ICO = {
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3v11.3A3.5 3.5 0 1 0 11 17V8h7V3z"/></svg>',
    noteOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3v11.3A3.5 3.5 0 1 0 11 17V8h7V3z" opacity=".45"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3l9 8h-3v9h-4.5v-6h-3v6H6v-9H3z"/></svg>',
    entry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l12.5-7.5z"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.1 3.6l5.3 5.3-9.6 9.6H6.3l-3-3zM12 20h9v-1.5h-7.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 4.5v15L15 12zM16 4.5h3v15h-3z"/></svg>'
  };

  function bubble(text) {
    var b = el('div', 'bubble');
    b.textContent = text;
    return b;
  }

  /* ---------- 上の帯（いえ・おんがく・はぐるま） ---------- */
  function topBar(opts) {
    var bar = el('div', 'topbar');
    var left = el('div', 'tb-left');
    var right = el('div', 'tb-right');
    if (opts.entry) {
      var en = button('icon-btn', function () { play('tap'); location.href = '../index.html'; });
      en.setAttribute('aria-label', 'アプリを えらびなおす');
      en.appendChild(svg(ICO.entry));
      left.appendChild(en);
    }
    if (opts.home) {
      var h = button('icon-btn', function () { play('tap'); showHome(); });
      h.setAttribute('aria-label', 'おうちに もどる');
      h.appendChild(svg(ICO.home));
      left.appendChild(h);
    }
    var bgm = button('icon-btn bgm-btn', function () { toggleBgm(bgm); });
    paintBgm(bgm);
    right.appendChild(bgm);
    if (opts.gear) {
      var g = button('icon-btn gear-btn', function () { openParent(); });
      g.setAttribute('aria-label', 'おとなの せってい');
      g.appendChild(svg(ICO.gear));
      right.appendChild(g);
    }
    bar.appendChild(left);
    bar.appendChild(right);
    return bar;
  }
  function paintBgm(b) {
    var on = C.storage.getSettings().bgmOn;
    b.innerHTML = '';
    b.appendChild(svg(on ? ICO.note : ICO.noteOff));
    b.classList.toggle('off', !on);
    b.setAttribute('aria-label', on ? 'おんがく あり' : 'おんがく なし');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function toggleBgm(b) {
    var v = !C.storage.getSettings().bgmOn;
    C.storage.setSettings({ bgmOn: v });
    C.sfx.setBgmOn(v);
    if (v && !st.resting) C.sfx.startBgm();
    paintBgm(b);
  }

  /* ---------- 音の開始（最初のタップで AudioContext を作る） ---------- */
  var audioReady = false;
  function unlockAudio() {
    if (audioReady) return;
    audioReady = true;
    var s = C.storage.getSettings();
    if (s.sfxOn) play('tap');          // ここで AudioContext ができる
    if (s.bgmOn && !st.resting) C.sfx.startBgm();
  }
  function applySettings() {
    var s = C.storage.getSettings();
    C.sfx.setSfxOn(s.sfxOn);
    C.sfx.setBgmOn(s.bgmOn);
  }

  /* ---------- プロフィール ---------- */
  // 「いま使っているプロフィール」は勉強アプリと共有。知育（kind:'chiiku'）のものだけを使う
  function pickProfile() {
    var a = C.storage.getActive();
    if (a && a.kind === 'chiiku') return a;
    // 前に使っていた知育の子（勉強アプリから戻ったとき、最初の子に戻らないように）
    var last = C.storage.lastOfKind ? C.storage.lastOfKind('chiiku') : null;
    if (last) { C.storage.setActive(last.id); return last; }
    var list = C.storage.listProfiles();
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === 'chiiku') { C.storage.setActive(list[i].id); return list[i]; }
    }
    return null;
  }

  function showProfileCreate() {
    newScreen('profile');
    st.profileId = null;
    try { C.timer.stop(); } catch (e) {}
    var box = el('div', 'profile-box card');
    box.appendChild(chara('normal'));
    box.appendChild(el('h1', 'p-title', 'なまえを おしえてね'));
    var form = el('form', 'p-form');
    var input = el('input', 'p-input');
    input.type = 'text';
    input.maxLength = 10;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'なまえ');
    input.placeholder = 'なまえ';
    var msg = el('p', 'p-msg', '');
    var ok = el('button', 'btn-big', 'はじめる');
    ok.type = 'submit';
    var done = false;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (done) return;
      var name = (input.value || '').replace(/^\s+|\s+$/g, '');
      if (!name) { msg.textContent = 'なまえを いれてね'; input.focus(); return; }
      done = true;
      play('tap');
      var id = C.storage.addProfile(name, 'chiiku');
      C.storage.setActive(id);
      enterProfile({ id: id, nickname: name });
    });
    form.appendChild(input);
    form.appendChild(ok);
    box.appendChild(form);
    box.appendChild(msg);
    app.appendChild(box);
  }

  function enterProfile(p) {
    st.profileId = p.id;
    try { C.timer.start(p.id); } catch (e) {}
    loadProgress(p.id).then(function () { showHome(); });
  }

  // 記録から、レベル・苦手・直近の正誤を組み立てる
  function loadProgress(pid) {
    st.level = 1; st.recent = []; st.missCounts = {}; st.lastCh = null;
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        var mine = logs.filter(function (e) { return e && e.area === AREA; });
        mine.forEach(function (e) {
          if (!e.correct) st.missCounts[e.itemId] = (st.missCounts[e.itemId] || 0) + 1;
        });
        if (mine.length) {
          var lv = Number(mine[mine.length - 1].level) || 1;
          st.level = Math.max(1, Math.min(MAX_LEVEL, lv));
          // 最後に同じレベルが続いた分を「今のレベルになってから」とみなす
          var run = [];
          for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === st.level; i--) run.unshift(!!mine[i].correct);
          st.recent = run.slice(-5);
          // 最後の1問でレベルが変わっていた場合も、遊んでいたときと同じにする
          var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
          if (nl !== st.level) { st.level = nl; st.recent = []; }
        }
      });
  }

  /* ---------- ホーム ---------- */
  function showHome() {
    var p = pickProfile();
    if (!p) { showProfileCreate(); return; }
    newScreen('home');
    st.resting = false;
    app.appendChild(topBar({ gear: true, entry: true }));
    var body = el('div', 'home-body');
    var left = el('div', 'home-chara');
    left.appendChild(chara('normal'));
    var right = el('div', 'home-main');
    right.appendChild(el('p', 'home-hello', 'こんにちは、' + p.nickname + '！'));
    right.appendChild(el("h1", "home-title", "なにで あそぶ？"));
    var btns = el("div", "home-btns");
    var all = [];
    function playBtn(label, run) {
      var go = button("btn-big btn-play", function () {
        if (go.disabled) return;
        all.forEach(function (b) { b.disabled = true; });
        play("tap");
        if (audioReady && C.storage.getSettings().bgmOn) C.sfx.startBgm();
        run();
      });
      go.setAttribute("aria-label", label);
      go.appendChild(svg(ICO.play));
      go.appendChild(el("span", null, label));
      all.push(go);
      btns.appendChild(go);
    }
    playBtn("ひらがな", function () { C.game.start(p.id); });
    playBtn("かず", function () { C.kazu.start(p.id); });
    playBtn("とけい", function () { C.tokei.start(p.id); });
    playBtn("いろ・かたち", function () { C.iro.start(p.id); });
    right.appendChild(btns);
    body.appendChild(left);
    body.appendChild(right);
    app.appendChild(body);
  }

  /* ---------- おとなゲート → 親画面 ---------- */
  function openParent() {
    play('tap');
    C.gate.open(function () { showParent(); }, function () {});
  }
  function showParent() {
    newScreen('parent');
    var head = el('div', 'parent-head');
    var back = button('btn-big secondary', function () { leaveParent(); });
    back.textContent = '← もどる';
    head.appendChild(back);
    app.appendChild(head);
    var box = el('div', 'parent-box');
    app.appendChild(box);
    C.parent.render(box);
  }
  function leaveParent() {
    applySettings();
    var p = pickProfile();
    if (!p) { showProfileCreate(); return; }
    if (p.id !== st.profileId) { enterProfile(p); return; }
    // リセットや設定変更のあとでも合うように、記録を読み直す
    loadProgress(p.id).then(function () { showHome(); });
  }

  /* ---------- 1もん ---------- */
  function start(profileId) {
    if (profileId && profileId !== st.profileId) {
      st.profileId = profileId;
      try { C.timer.start(profileId); } catch (e) {}
      loadProgress(profileId).then(nextQuestion);
      return;
    }
    nextQuestion();
  }

  function nextQuestion() {
    // 問題と問題のあいだでだけ、利用時間を確かめる（問題の途中では出さない）
    var over = false;
    try { over = C.timer.isOver(st.profileId); } catch (e) { over = false; }
    if (over) { showRest(); return; }

    var cfg = C.hira.levelConfig(st.level);
    var pool = cfg.pool.slice();
    var cand = pool.length > 1 ? pool.filter(function (c) { return c !== st.lastCh; }) : pool;
    var ch = C.adaptive.pickWeighted(cand, st.missCounts, Math.random) || pool[0];
    st.lastCh = ch;
    var others = shuffle(pool.filter(function (c) { return c !== ch; })).slice(0, cfg.choices - 1);
    var opts = shuffle([ch].concat(others)).map(item);
    var q = { ch: ch, item: item(ch), level: st.level, missed: false, done: false, busy: false, logged: false };
    showChoice(q, opts);
  }

  function questionText(ch) { return '「' + ch + '」は どれかな？'; }

  function showChoice(q, opts) {
    newScreen('choice');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    app.classList.toggle('no-voice', !hasVoice);
    app.appendChild(topBar({ home: true }));

    var head = el('div', 'q-head');
    var who = el('div', 'q-chara');
    var ch = chara('normal');
    who.appendChild(ch);
    var letter = hira(el("div", "q-letter"), q.ch);
    var talk = el('div', 'q-talk');
    var bub = hira(bubble(''), questionText(q.ch));
    bub.classList.add('q-text');
    talk.appendChild(bub);
    if (hasVoice) {
      var again = button('icon-btn speak-btn', function () { play('tap'); speak(q.ch + '。 ' + q.ch + 'は、どれかな？'); });
      again.setAttribute('aria-label', 'もういちど きく');
      again.appendChild(svg(ICO.speaker));
      talk.appendChild(again);
    }
    head.appendChild(who);
    head.appendChild(letter);
    head.appendChild(talk);
    app.appendChild(head);

    var grid = el('div', 'cards n' + opts.length);
    opts.forEach(function (it) {
      var card = button('pick-card', function () { choose(it, card); });
      card.setAttribute('aria-label', it.word);
      card.appendChild(el('span', 'pc-pic', it.pic));
      var len = it.word.length;
      var w = el('span', 'pc-word' + (len >= 5 ? ' len5' : len === 4 ? ' len4' : ''));
      var wi = el('span', 'pw-in');
      // その字だけ目立たせる（ふつうは先頭。「を」「ん」は言葉の途中・最後）
      var at = Math.max(0, it.word.indexOf(it.ch));
      if (at) hira(wi.appendChild(el('span')), it.word.slice(0, at));
      hira(wi.appendChild(el('b')), it.word.charAt(at));
      hira(wi.appendChild(el('span')), it.word.slice(at + 1));
      w.appendChild(wi);
      card.appendChild(w);
      grid.appendChild(card);
    });
    app.appendChild(grid);

    // 連打しても1回だけ採点する
    function choose(it, card) {
      if (q.done || q.busy) return;
      if (it.ch === q.ch) {
        q.done = true;
        play('correct');
        card.classList.add('right');
        grid.classList.add('settled');
        ch.parentNode.replaceChild(chara('happy'), ch);
        bub.textContent = 'せいかい！';
        var burst = el('div', 'burst');
        for (var i = 0; i < 5; i++) burst.appendChild(svg(STAR, 'reward-star s' + i));
        card.appendChild(burst);
        speak('せいかい！');
        later(function () { showTrace(q); }, 1400);
      } else {
        q.busy = true;
        q.missed = true;
        play('oops');
        card.classList.remove('wiggle');
        void card.offsetWidth;          // アニメを最初から
        card.classList.add('wiggle', 'tried');
        bub.textContent = 'おしい！ もういっかい えらんでみよう';
        speak('おしい！ もういっかい、えらんでみよう');
        later(function () { q.busy = false; }, 700);
      }
    }

    speak(q.ch + '。 ' + q.ch + 'は、どれかな？');
  }

  /* ---------- なぞる ---------- */
  function showTrace(q) {
    newScreen('trace');
    app.appendChild(topBar({ home: true }));
    var wrap = el('div', 'trace-wrap');
    var side = el('div', 'trace-side');
    var who = el('div', 'q-chara small');
    var ch = chara('normal');
    who.appendChild(ch);
    var bub = hira(bubble(""), "ゆびで 「" + q.ch + "」を なぞってみよう");
    side.appendChild(who);
    side.appendChild(bub);
    var area = el('div', 'trace-area');
    var btns = el('div', 'trace-btns');
    var clearBtn = button('btn-big secondary', function () { play('tap'); strokes = []; draw(); });
    clearBtn.appendChild(svg(ICO.eraser));
    clearBtn.appendChild(el('span', null, 'けす'));
    var doneBtn = button('btn-big', function () { judge(); });
    doneBtn.appendChild(svg(ICO.check));
    doneBtn.appendChild(el('span', null, 'できた！'));
    btns.appendChild(clearBtn);
    btns.appendChild(doneBtn);
    side.appendChild(btns);
    wrap.appendChild(area);
    wrap.appendChild(side);
    app.appendChild(wrap);

    var strokes = [];       // [[{x,y}...]...]（0〜1の割合で持つ）
    var cur = null;
    var activeId = null;    // 最初の1本の指だけ
    var canvas = null, ctx = null, size = 0, dpr = 1;
    var judging = false;

    function build() {
      // 作り直す：なぞりは消す
      strokes = []; cur = null; activeId = null;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      var w = area.clientWidth, h = area.clientHeight;
      // 念のため：場所が画面の下にはみ出しているときは、画面に見えている高さを上限にする
      // （dvh が使えない古いブラウザで、アドレスバーの分だけ高く計算される場合など）
      var r = area.getBoundingClientRect();
      var vh = window.innerHeight || 0;
      if (vh && r.bottom > vh) h = Math.min(h, vh - r.top - 8);
      size = Math.max(160, Math.min(640, Math.floor(Math.min(w, h)) - 8));
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas = el('canvas', 'trace-canvas');
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      canvas.setAttribute('aria-label', 'なぞる ところ');
      ctx = canvas.getContext('2d');
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('lostpointercapture', up);
      area.appendChild(canvas);
      draw();
    }
    function pos(ev) {
      var r = canvas.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
    }
    function down(ev) {
      if (activeId !== null || judging) return;   // 2本目以降の指（手のひら）は無視
      activeId = ev.pointerId;
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      cur = [pos(ev)];
      strokes.push(cur);
      draw();
      ev.preventDefault();
    }
    function move(ev) {
      if (ev.pointerId !== activeId || !cur) return;
      var list = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
      if (list && list.length) list.forEach(function (e2) { cur.push(pos(e2)); });
      else cur.push(pos(ev));
      draw();
      ev.preventDefault();
    }
    function up(ev) {
      if (ev.pointerId !== activeId) return;
      activeId = null;
      cur = null;
    }
    function strokePaths(c, s) {
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = s * LINE;
      strokes.forEach(function (pts) {
        c.beginPath();
        c.moveTo(pts[0].x * s, pts[0].y * s);
        if (pts.length === 1) c.lineTo(pts[0].x * s + 0.01, pts[0].y * s);
        for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x * s, pts[i].y * s);
        c.stroke();
      });
    }
    function draw() {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      // 十字の補助線
      ctx.strokeStyle = '#f1e2cf';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
      ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 薄い お手本（判定用マスクと同じ字形）
      // き・さ・ふ・り は、手書きの形（glyphs.js）で。ほかはフォントで
      if (!(C.glyphs && C.glyphs.draw(ctx, q.ch, size, 'rgba(255,138,61,.22)'))) {
        ctx.fillStyle = 'rgba(255,138,61,.22)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + Math.round(size * 0.8) + 'px ' + GLYPH_FONT;
        ctx.fillText(q.ch, size / 2, size / 2);
      }
      // なぞった線
      ctx.strokeStyle = 'rgba(76,184,196,.9)';
      strokePaths(ctx, size);
    }
    function userMask() {
      var cv = document.createElement('canvas');
      cv.width = MASK; cv.height = MASK;
      var c = cv.getContext('2d');
      var out = new Uint8Array(MASK * MASK);
      if (!c) return out;
      c.strokeStyle = '#000';
      strokePaths(c, MASK);
      var d = c.getImageData(0, 0, MASK, MASK).data;
      for (var i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] > 128 ? 1 : 0;
      return out;
    }
    function judge() {
      if (judging) return;
      if (!strokes.length) {
        bub.textContent = 'ゆびで なぞってね';
        play('tap');
        return;
      }
      judging = true;
      var res;
      try { res = C.trace.score(C.trace.rasterizeGlyph(q.ch, MASK), userMask()); }
      catch (e) { res = { pass: true }; }   // 判定できない端末では、ほめて進む
      q.lastTrace = res;
      if (res.pass) {
        play('star');
        finishQuestion(q);
      } else {
        play('oops');
        bub.textContent = 'もうちょっと！ いっしょに やってみよう';
        speak('もうちょっと！ いっしょに、やってみよう');
        area.classList.remove('pulse');
        void area.offsetWidth;
        area.classList.add('pulse');
        later(function () { strokes = []; draw(); judging = false; }, 900);
      }
    }

    // サイズ変更・回転で作り直す
    var rt = null;
    function onResize() {
      clearTimeout(rt);
      rt = setTimeout(function () { if (!judging) build(); }, 150);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    cleanup.push(function () {
      clearTimeout(rt);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    });

    build();
    speak('ゆびで、なぞってみよう');
  }

  /* ---------- 1もん おわり ---------- */
  function finishQuestion(q) {
    if (q.logged) return;
    q.logged = true;
    var correct = !q.missed;   // えらぶ ところで 1回で あたったか
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: q.ch, correct: correct, level: q.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[q.ch] = (st.missCounts[q.ch] || 0) + 1;
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    showReward(q);
  }

  function showReward(q) {
    newScreen('reward');
    app.appendChild(topBar({ home: true }));
    var body = el('div', 'reward-body');
    var stars = el('div', 'stars');
    for (var i = 0; i < 3; i++) stars.appendChild(svg(STAR, 'reward-star s' + i));
    body.appendChild(stars);
    var row = el('div', 'reward-row');
    row.appendChild(chara('happy'));
    var info = el('div', 'reward-info');
    info.appendChild(el('p', 'reward-msg', 'すごい！'));
    var w = el('p', 'reward-word');
    w.appendChild(el('span', 'rw-pic', q.item ? q.item.pic : ''));
    w.appendChild(hira(el("span"), q.item ? q.item.word : q.ch));
    info.appendChild(w);
    var next = button('btn-big btn-next', function () {
      if (next.disabled) return;
      next.disabled = true;
      play('tap');
      nextQuestion();
    });
    next.setAttribute('aria-label', 'つぎへ');
    next.appendChild(svg(ICO.next));
    next.appendChild(el('span', null, 'つぎへ'));
    info.appendChild(next);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    speak('すごい！ ' + (q.item ? q.item.word + 'の、' + q.ch + '。' : ''));
  }

  /* ---------- おやすみ ---------- */
  function showRest() {
    newScreen('rest');
    st.resting = true;
    try { C.sfx.stopBgm(); } catch (e) {}
    app.appendChild(topBar({ home: true }));
    var body = el('div', 'rest-body');
    body.appendChild(chara('sleep'));
    var msg = el('p', 'rest-msg');
    msg.appendChild(el('span', null, 'きょうは ここまで！'));
    msg.appendChild(el('span', null, 'また あした あそぼうね'));
    body.appendChild(msg);
    app.appendChild(body);
    speak('きょうは ここまで！ また あした、あそぼうね');
  }

  /* ---------- 起動 ---------- */
  function boot() {
    app = document.getElementById('app');
    if (!app) return;
    ['pointerup', 'touchend', 'keydown'].forEach(function (t) {
      document.addEventListener(t, unlockAudio, true);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { try { C.sfx.stopBgm(); } catch (e) {} }
      else if (audioReady && !st.resting && C.storage.getSettings().bgmOn) { try { C.sfx.startBgm(); } catch (e) {} }
    });
    function after() {
      applySettings();
      try { C.timer.onOver(function () { /* 次の問題の前に isOver で確かめる */ }); } catch (e) {}
      var p = pickProfile();
      if (!p) showProfileCreate();
      else enterProfile(p);
    }
    Promise.resolve().then(function () { return C.storage.init(); }).then(after, after);
  }

  C.game = { start: start };
  C.chiikuPickProfile = pickProfile;   // テスト用に公開
  // かず・とけい・いろゲーム（kazu.js・tokei.js・iro.js）が使う画面の部品
  C.chiikuUi = {
    el: el, svg: svg, button: button, later: later, bubble: bubble,
    newScreen: newScreen, chara: chara, topBar: topBar,
    play: play, speak: speak, ICO: ICO, STAR: STAR,
    showHome: showHome, showRest: showRest
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
