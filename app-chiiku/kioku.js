/* きおく（カードめくり）。Chiid.kioku
   うらがえしの絵カードを2まいずつ めくって、同じ絵を そろえる。ひとりで遊ぶ。レベル1〜5（6・10・16・24・36まい）。
   園児が見る文字は、ひらがなと数字だけ。通信は行わない。設計書：docs/superpowers/specs/2026-11-18-chiiku-kioku-design.md
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'kioku';
  var MAX_LEVEL = 5;
  // ぜんぶ そろえたら ごほうび（1まいの ばんが 1回分）
  var COUNTS = [6, 10, 16, 24, 36];      // レベルごとの まい数
  var PREVIEW_MS = [2000, 2000, 4000, 4000, 4000];   // はじめに ぜんぶ見せる時間（レベルごと）
  var BACK_MS = 1000, WAIT_CLEAR = 1800, VOICE_AFTER = 400;
  var HINT_MS = 3000;   // ヒント：もう一度 ぜんぶ 見せる 時間   // 正解音の あと、少し あけてから 声
  var GAP = 6, MAX_CARD = 200;
  // 見分けやすい 絵（Unicode 12 以前の絵文字）
  var PICS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🦁', '🐸', '🐵', '🐧', '🐤', '🐙', '🦀', '🐢', '🦋', '🐞', '🍎', '🍌', '🍉', '🍓', '🍇', '🍰', '🍦', '🚗', '🚀', '🌻', '⭐', '🎈', '⚽'];
  var TEXT = {
    choose: 'どれに する？', start: 'おなじ えを 2まい さがそう', preview: 'よく みて おぼえてね',
    match: 'そろったね！', clear: 'ぜんぶ そろったね！', reward: 'すごい！ よく おぼえたね'
  };

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // レベルの まい数ぶん、絵を2まいずつ まぜて ならべる
  function deal(level, rng) {
    rng = rng || Math.random;
    var n = COUNTS[lv(level) - 1], pics = shuffle(PICS, rng).slice(0, n / 2);
    return shuffle(pics.concat(pics), rng);
  }
  function isCorrect(misses, pairs) { return misses <= pairs; }

  // 板（w×h）に n まいの 正方形カードを、いちばん大きく なるように ならべる。最後の 段が はんぱに ならない 列の数だけ 使う
  function layout(n, w, h, gap) {
    gap = gap || 0;
    var best = null;
    for (var cols = 1; cols <= n; cols++) {
      if (n % cols !== 0) continue;
      var rows = Math.ceil(n / cols);
      var cell = Math.floor(Math.min((w - (cols - 1) * gap) / cols, (h - (rows - 1) * gap) / rows));
      if (!best || cell > best.cell) best = { cols: cols, rows: rows, cell: cell };
    }
    return best;
  }

  // 記録から、いまのレベルと直近の結果（めいろと同じ形）
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [] };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    if (mine.length) {
      res.level = lv(mine[mine.length - 1].level);
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  /* ==================== 画面 ==================== */
  var st = null;   // { profileId, level, recent, round, phase, cards, open, matched, misses, busy, done, pending, sid, dom }
  function U() { return C.chiikuUi; }
  function hasApp() { return !!document.getElementById('app'); }   // テストのページには無い：描かずに状態だけ動く
  function onScreen() { var ui = U(); return st && (!hasApp() || !ui.screenId || ui.screenId() === st.sid); }
  function say(text) { if (st && st.dom && st.dom.bub) st.dom.bub.textContent = text; try { if (hasApp()) U().speak(text); } catch (e) {} }
  function play(name) { try { if (hasApp()) U().play(name); } catch (e) {} }
  function isOver() { try { return C.timer.isOver(st.profileId); } catch (e) { return false; } }
  function later(fn, ms) { st.pending = fn; if (hasApp()) U().later(function () { if (st && st.pending === fn) flush(); }, ms); }
  function flush() { if (!st || !st.pending) return; var f = st.pending; st.pending = null; f(); }

  // level をわたすと そのレベルで すぐ始める。わたさないときは 画面では「どれに する？」、テスト（画面なし）では 記録の レベル
  function start(profileId, level) {
    st = { profileId: profileId, level: 1, recent: [], round: 1, phase: 'loading' };
    var ui = U();
    var sid = (hasApp() && ui.screenId) ? ui.screenId() : null;
    var ask = level === undefined && hasApp();
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(profileId); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        var p = progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent; st.autoLevel = p.level;
        if (sid !== null && ui.screenId() !== sid) return;
        if (ask) { showChoose(); return; }
        if (level !== undefined && level !== 'auto') { st.level = lv(level); st.recent = []; }
        newGame();
      });
  }
  function choose(level) {
    if (!st || st.phase !== 'choose') return;
    if (level !== 'auto') { st.level = lv(level); st.recent = []; }
    newGame();
  }

  /* ---------- どれに する？ ---------- */
  function showChoose() {
    st.phase = 'choose';
    var ui = U();
    var app = ui.newScreen('kioku-choose');
    st.sid = ui.screenId ? ui.screenId() : null;
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-ch-body');
    body.appendChild(ui.el('p', 'kk-ch-title', TEXT.choose));
    var row = ui.el('div', 'kk-ch-row');
    function btn(label, sub, cls, level) {
      var b = ui.button('kk-ch ' + cls, function () { if (st.phase !== 'choose') return; ui.play('tap'); choose(level); });
      b.setAttribute('aria-label', label);
      b.appendChild(ui.el('span', 'kk-ch-main', label));
      if (sub) b.appendChild(ui.el('span', 'kk-ch-sub', sub));
      row.appendChild(b);
    }
    btn('つづき', '▶', 'kk-ch-auto', 'auto');
    COUNTS.forEach(function (n, i) { btn(String(n), 'まい', 'kk-ch-lv' + (i + 1 === st.autoLevel ? ' now' : ''), i + 1); });
    body.appendChild(row);
    app.appendChild(body);
    ui.speak(TEXT.choose);
  }

  /* ---------- 1回（1まいの ばん） ---------- */
  function newGame() {
    if (isOver()) { st.phase = 'rest'; if (hasApp()) U().showRest(); return; }
    st.phase = 'play'; st.cards = deal(st.level); st.open = []; st.matched = []; st.misses = 0;
    st.busy = false; st.done = false; st.pending = null; st.dom = null; st.peek = false;
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('kioku');
    st.sid = ui.screenId ? ui.screenId() : null;
    var bar = ui.topBar({ home: true });
    var hb = ui.button('icon-btn kk-hint', function () { hint(); });   // ヒント：もう一度 3びょう ぜんぶ 見る
    hb.setAttribute('aria-label', 'ひんと');
    hb.appendChild(ui.el('span', 'kk-hint-ico', '👀'));
    if (bar.firstChild) bar.firstChild.appendChild(hb);
    var talk = ui.el('div', 'kk-talk');
    var bub = ui.bubble(TEXT.start); bub.classList.add('kk-bub');
    talk.appendChild(bub);
    bar.insertBefore(talk, bar.lastChild);
    var board = ui.el('div', 'kk-board');
    app.appendChild(bar); app.appendChild(board);
    st.dom = { bub: bub, board: board, cards: [] };
    var r = board.getBoundingClientRect(), cs = window.getComputedStyle(board);
    var bw = r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var bh = r.height - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    var L = layout(st.cards.length, Math.max(1, bw), Math.max(1, bh), GAP);
    L.cell = Math.min(L.cell, MAX_CARD);   // タブレットで 大きすぎないように
    var grid = ui.el('div', 'kk-grid');
    grid.style.gridTemplateColumns = 'repeat(' + L.cols + ', ' + L.cell + 'px)';
    grid.style.gridAutoRows = L.cell + 'px';
    grid.style.gap = GAP + 'px';
    st.cards.forEach(function (pic, i) {
      var b = ui.button('kk-card', function () { flip(i); });
      b.setAttribute('aria-label', 'かーど');
      b.style.fontSize = Math.round(L.cell * 0.58) + 'px';
      var inner = ui.el('span', 'kk-inner');
      inner.appendChild(ui.el('span', 'kk-face kk-back', ''));
      inner.appendChild(ui.el('span', 'kk-face kk-front', pic));
      b.appendChild(inner);
      grid.appendChild(b);
      st.dom.cards.push(b);
    });
    board.appendChild(grid);
    {   // はじめに ぜんぶ見せる（どのレベルも）
      st.busy = true;
      st.dom.cards.forEach(function (b) { b.classList.add('up'); });
      say(TEXT.preview);
      U().later(function () {
        if (!onScreen() || st.phase !== 'play') return;
        st.dom.cards.forEach(function (b) { b.classList.remove('up'); });
        st.busy = false;
        say(TEXT.start);
      }, PREVIEW_MS[st.level - 1]);
    }
  }
  // ヒント：そろって いない カードも ぜんぶ 3びょう 見せる（はずし1回と 数える）。1まい めくっている ときは 出さない
  function hint() {
    if (!st || st.phase !== 'play' || st.done || st.busy || st.pending || st.open.length || !onScreen()) return;
    st.misses++; st.peek = true; st.busy = true;
    if (st.dom) st.dom.cards.forEach(function (b) { b.classList.add('up'); });
    play('tap'); say(TEXT.preview);
    later(function () {
      st.peek = false; st.busy = false;
      st.cards.forEach(function (c, i) { paint(i); });
      say(TEXT.start);
    }, HINT_MS);
  }
  function paint(i) {
    if (!st.dom) return;
    var b = st.dom.cards[i];
    b.classList.toggle('up', st.open.indexOf(i) >= 0 || st.matched.indexOf(i) >= 0);
    b.classList.toggle('got', st.matched.indexOf(i) >= 0);
  }
  function flip(i) {
    if (!st || st.phase !== 'play' || st.done || st.busy || st.pending || !onScreen()) return;
    if (i < 0 || i >= st.cards.length || st.open.indexOf(i) >= 0 || st.matched.indexOf(i) >= 0) return;
    st.open.push(i); paint(i); play('tap');
    if (st.open.length < 2) return;
    var a = st.open[0], b = st.open[1];
    if (st.cards[a] === st.cards[b]) {
      later(function () {
        st.matched.push(a, b); st.open = [];
        paint(a); paint(b);
        play('correct');
        if (st.matched.length === st.cards.length) clear(); else sayAfter(TEXT.match);
      }, 350);
    } else {
      st.misses++;
      later(function () { st.open = []; paint(a); paint(b); }, BACK_MS);
    }
  }
  function clear() {
    st.done = true;
    sayAfter(TEXT.clear);
    var pairs = st.cards.length / 2, correct = isCorrect(st.misses, pairs);
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: 'lv' + st.level, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    later(advance, WAIT_CLEAR);
  }
  function advance() { showReward(); }
  // 正解音に 続けて 声（音と 声が 重ならないように）
  function sayAfter(text) {
    if (!hasApp()) { say(text); return; }
    var sid = st.sid;
    U().later(function () { if (st && st.sid === sid) say(text); }, VOICE_AFTER);
  }
  // ごほうびの「つぎへ」：新しい ばん（1日の 目安を こえていたら ここで お休み）
  function again() {
    if (!st || st.phase !== 'reward') return;
    newGame();
  }
  function showReward() {
    st.phase = 'reward';
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('reward');
    st.sid = ui.screenId ? ui.screenId() : null;
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'reward-body');
    var stars = ui.el('div', 'stars');
    for (var i = 0; i < 3; i++) stars.appendChild(ui.svg(ui.STAR, 'reward-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'reward-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'reward-info');
    info.appendChild(ui.el('p', 'reward-msg', 'すごい！'));
    var next = ui.button('btn-big btn-next', function () {
      if (next.disabled) return;
      next.disabled = true;
      ui.play('tap');
      again();
    });
    next.setAttribute('aria-label', 'つぎへ');
    next.appendChild(ui.svg(ui.ICO.next));
    next.appendChild(ui.el('span', null, 'つぎへ'));
    info.appendChild(next);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak(TEXT.reward);
  }

  function state() {
    if (!st) return null;
    return { phase: st.phase, level: st.level, round: st.round, cards: st.cards, open: (st.open || []).slice(), matched: (st.matched || []).slice(),
      misses: st.misses, done: st.done, peek: !!st.peek };
  }

  C.kioku = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, COUNTS: COUNTS, PREVIEW_MS: PREVIEW_MS, PICS: PICS, TEXT: TEXT,
    deal: deal, isCorrect: isCorrect, layout: layout, progressFromLogs: progressFromLogs,
    start: start,
    // テスト用
    _state: state, _flip: function (i) { flip(i); }, _flush: flush, _choose: choose,
    _next: function () { flush(); }, _again: again, _hint: function () { hint(); }
  };
})();
