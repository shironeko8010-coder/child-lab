/* すうどくの画面。Chiid.benkyo.sudokuScreen
   どれに する？（つづき・1〜5）→ 表と 数字の ボタン → できた → ごほうび（1問ごと）。
   しくみは Chiid.sudoku（subjects/sudoku.js）、部品は Chiid.benkyo.ui（main.js）。
   記録は1問1件（ヒントを 使わず、まちがいが 1回以下なら true）。#app が無いとき（テスト）は描画せず、状態だけを動かす。
   設計書：docs/superpowers/specs/2026-11-19-benkyo-sudoku-design.md */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CLEAR = 1800;
  var st = null, view = null, pendingFn = null, pendSeq = 0;

  function S() { return C.sudoku; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function speak(text) { if (drawing()) U().speak(text); }
  function L() { return S().LEVELS[st.level]; }

  /* ---------- 開く ---------- */
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = { profileId: pid, level: 1, recent: [], autoLevel: 1, phase: 'loading', msg: '' };
    pendingFn = null; view = null;
    var sid = B.ui && B.ui.screenId ? B.ui.screenId() : null;
    var ask = ctx.level === undefined && drawing();
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        if (st !== run) return;
        if (sid !== null && B.ui.screenId() !== sid) { st = null; return; }
        var p = S().progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent; st.autoLevel = p.level;
        if (ask) { showChoose(); return; }
        if (ctx.level !== undefined && ctx.level !== 'auto') { st.level = Math.max(1, Math.min(S().MAX_LEVEL, Number(ctx.level) || 1)); st.recent = []; }
        newPuzzle();
      });
  }
  function choose(level) {
    if (!st || st.phase !== 'choose') return;
    if (level !== 'auto') { st.level = level; st.recent = []; }
    newPuzzle();
  }
  function restNow() {
    var over = false;
    try { over = typeof B.checkRest === 'function' && B.checkRest(); } catch (e) { over = false; }
    if (over) { st.phase = 'rest'; view = null; }
    return over;
  }
  function newPuzzle() {
    pendingFn = null;
    if (restNow()) return;
    var p = S().make(st.level);
    st.size = p.size; st.puzzle = p.puzzle; st.solution = p.solution; st.grid = p.puzzle.slice();
    st.memos = {}; st.sel = -1; st.memoMode = false; st.bad = []; st.mistakes = 0; st.hints = 0; st.phase = 'play';
    st.msg = L().instant ? S().TEXT.rule : S().TEXT.start;
    render();
    speak(st.msg);
  }

  /* ---------- 入れる ---------- */
  function full() { return st.grid.every(function (v) { return v; }); }
  function select(i) {
    if (!st || st.phase !== 'play' || i < 0 || i >= st.grid.length) return;
    st.sel = i; paint();
  }
  function put(d) {
    if (!st || st.phase !== 'play' || st.sel < 0 || st.puzzle[st.sel]) return;
    var i = st.sel;
    if (st.memoMode && L().memo) {
      if (st.grid[i]) return;
      var m = st.memos[i] = (st.memos[i] || []).slice(), k = m.indexOf(d);
      if (k >= 0) m.splice(k, 1); else { m.push(d); m.sort(function (a, b) { return a - b; }); }
      play('tap'); paint(); return;
    }
    st.grid[i] = d; delete st.memos[i];
    st.bad = st.bad.filter(function (b) { return b !== i; });
    play('tap');
    if (L().instant && d !== st.solution[i]) {
      st.bad.push(i); st.mistakes++;
      var others = st.grid.slice(); others[i] = 0;
      st.msg = S().conflicts(st.size, others, i, d).length ? S().TEXT.conflict : S().TEXT.wrong;
      play('oops'); paint(); speak(st.msg); return;
    }
    afterFill();
  }
  function afterFill() {
    if (full() && L().instant && st.bad.length === 0) { clear(); return; }
    paint();
  }
  function erase() {
    if (!st || st.phase !== 'play' || st.sel < 0 || st.puzzle[st.sel]) return;
    st.grid[st.sel] = 0; delete st.memos[st.sel];
    st.bad = st.bad.filter(function (b) { return b !== st.sel; });
    play('tap'); paint();
  }
  function toggleMemo() {
    if (!st || st.phase !== 'play' || !L().memo) return;
    st.memoMode = !st.memoMode; play('tap'); paint();
  }
  function hint() {
    if (!st || st.phase !== 'play') return;
    var ok = function (i) { return !st.puzzle[i] && st.grid[i] !== st.solution[i]; };
    var i = st.sel >= 0 && ok(st.sel) ? st.sel : st.grid.findIndex(function (v, j) { return ok(j); });
    if (i < 0) return;
    st.grid[i] = st.solution[i]; delete st.memos[i]; st.hints++;
    st.bad = st.bad.filter(function (b) { return b !== i; });
    st.sel = i; st.msg = S().TEXT.hint;
    play('tap'); speak(st.msg);
    afterFill();
  }
  // こたえあわせ（レベル3〜5。ぜんぶ うまっている とき）
  function check() {
    if (!st || st.phase !== 'play' || L().instant || !full()) return;
    st.bad = st.grid.map(function (v, i) { return v !== st.solution[i] ? i : -1; }).filter(function (i) { return i >= 0; });
    if (!st.bad.length) { clear(); return; }
    st.mistakes++;
    st.msg = S().TEXT.check;
    play('oops'); paint(); speak(st.msg);
  }
  function clear() {
    var correct = st.hints === 0 && st.mistakes <= 1;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: S().AREA, itemId: 'lv' + st.level, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, S().MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.phase = 'clear'; st.msg = S().TEXT.clear; st.sel = -1;
    play('correct'); paint(); speak(st.msg);
    wait(WAIT_CLEAR, showReward);
  }
  function wait(ms, fn) {
    pendingFn = fn;
    var my = ++pendSeq;
    if (drawing()) U().later(function () { if (my === pendSeq) flush(); }, ms);
  }
  function flush() { if (!pendingFn) return; var f = pendingFn; pendingFn = null; pendSeq++; f(); }

  /* ---------- どれに する？ ---------- */
  function showChoose() {
    st.phase = 'choose';
    var ui = U();
    var app = ui.newScreen('sudoku-choose');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'pg-ch-body');
    body.appendChild(ui.el('p', 'pg-ch-title', S().TEXT.choose));
    var row = ui.el('div', 'pg-ch-row');
    function btn(main, sub, cls, level) {
      var b = ui.button('pg-ch ' + cls, function () { if (st.phase !== 'choose') return; ui.play('tap'); choose(level); });
      b.setAttribute('aria-label', main);
      b.appendChild(ui.el('span', 'pg-ch-main', main));
      if (sub) b.appendChild(ui.el('span', 'pg-ch-sub', sub));
      row.appendChild(b);
    }
    btn('つづき', '▶', 'pg-ch-auto', 'auto');
    [1, 2, 3, 4, 5].forEach(function (n) { var z = S().LEVELS[n].size; btn('レベル ' + n, z + '×' + z + (n === 5 ? ' おとな' : ''), 'pg-ch-lv' + (n === st.autoLevel ? ' now' : ''), n); });
    body.appendChild(row);
    app.appendChild(body);
    ui.speak(S().TEXT.choose);
  }

  /* ---------- 描画 ---------- */
  function render() {
    view = null;
    if (!drawing()) return;
    var ui = U(), N = st.size, Z = S().SIZES[N];
    var app = ui.newScreen('sudoku');
    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    var sp = ui.button('icon-btn', function () { ui.play('tap'); ui.speak(st.phase === 'play' && L().instant ? S().TEXT.rule : st.msg); });
    sp.setAttribute('aria-label', 'もういちど きく');
    sp.appendChild(ui.svg(ui.ICO.speaker));
    if (right) right.insertBefore(sp, right.firstChild);
    var talk = ui.el('div', 'sd-talk');
    var bub = ui.bubble(''); bub.classList.add('sd-bub');
    ui.fillR(bub, st.msg);   // 文を 入れてから 表の 広さを はかる（2行に なると 上の帯が 高くなるため）
    talk.appendChild(bub);
    bar.insertBefore(talk, bar.lastChild);
    app.appendChild(bar);
    var body = ui.el('div', 'sd-body');
    var board = ui.el('div', 'sd-board');
    var panel = ui.el('div', 'sd-panel');
    body.appendChild(board); body.appendChild(panel);
    app.appendChild(body);
    var pad = ui.el('div', 'sd-pad n' + N);
    var digits = [];
    for (var d = 1; d <= N; d++) (function (d) {
      var b = ui.button('sd-btn sd-num', function () { put(d); });
      b.setAttribute('aria-label', String(d));
      b.appendChild(ui.el('span', null, String(d)));
      pad.appendChild(b); digits.push(b);
    })(d);
    panel.appendChild(pad);
    var ctl = ui.el('div', 'sd-ctl');
    function cbtn(label, cls, fn) { var b = ui.button('sd-btn ' + cls, fn); b.appendChild(ui.elR('span', null, label)); ctl.appendChild(b); return b; }
    cbtn('けす', 'sd-sub', erase);
    var memoB = L().memo ? cbtn('メモ', 'sd-memo', toggleMemo) : null;
    cbtn('ヒント', 'sd-sub', hint);
    var checkB = L().instant ? null : cbtn('こたえあわせ', 'sd-check', check);
    panel.appendChild(ctl);
    // 表（板の 広さから マスの 大きさ）
    var r = board.getBoundingClientRect();
    var extra = 6 + (N - 1) + 3 * (N / Z.bw - 1 + N / Z.bh - 1) / 2;   // わくの すきま・太い線のぶん
    var cell = Math.max(24, Math.floor((Math.min(r.width, r.height) - extra) / N));
    var grid = ui.el('div', 'sd-grid s' + N);
    grid.style.gridTemplateColumns = 'repeat(' + N + ', ' + cell + 'px)';
    grid.style.gridAutoRows = cell + 'px';
    grid.style.fontSize = Math.round(cell * 0.58) + 'px';
    var cells = [];
    st.grid.forEach(function (v, i) {
      var rr = Math.floor(i / N), cc = i % N;
      var b = ui.button('sd-cell' + (cc % Z.bw === Z.bw - 1 && cc < N - 1 ? ' br' : '') + (rr % Z.bh === Z.bh - 1 && rr < N - 1 ? ' bb' : ''), function () { select(i); });
      b.setAttribute('aria-label', (rr + 1) + 'だん ' + (cc + 1) + 'れつ');
      grid.appendChild(b); cells.push(b);
    });
    board.appendChild(grid);
    view = { bub: bub, cells: cells, digits: digits, memoB: memoB, checkB: checkB, body: body, cell: cell };
    paint();
  }
  function paint() {
    if (!view || !drawing()) return;
    var ui = U(), N = st.size, Z = S().SIZES[N];
    ui.fillR(view.bub, st.msg);
    var sr = st.sel >= 0 ? Math.floor(st.sel / N) : -1, sc = st.sel >= 0 ? st.sel % N : -1;
    var sbox = st.sel >= 0 ? (sr - sr % Z.bh) + ',' + (sc - sc % Z.bw) : '';
    var selVal = st.sel >= 0 ? st.grid[st.sel] : 0;
    view.cells.forEach(function (b, i) {
      var r = Math.floor(i / N), c = i % N, v = st.grid[i];
      var box = (r - r % Z.bh) + ',' + (c - c % Z.bw);
      b.classList.toggle('given', !!st.puzzle[i]);
      b.classList.toggle('sel', i === st.sel);
      b.classList.toggle('near', st.sel >= 0 && i !== st.sel && (r === sr || c === sc || box === sbox));
      b.classList.toggle('same', !!selVal && v === selVal && i !== st.sel);
      b.classList.toggle('bad', st.bad.indexOf(i) >= 0);
      b.innerHTML = '';
      if (v) b.appendChild(ui.el('span', 'sd-v', String(v)));
      else if (st.memos[i] && st.memos[i].length) {
        var m = ui.el('span', 'sd-memos n' + N);
        for (var d = 1; d <= N; d++) m.appendChild(ui.el('span', 'sd-m', st.memos[i].indexOf(d) >= 0 ? String(d) : ''));
        b.appendChild(m);
      }
    });
    if (view.memoB) view.memoB.classList.toggle('on', st.memoMode);
    if (view.checkB) view.checkB.disabled = st.phase !== 'play' || !full();
    view.body.classList.toggle('is-done', st.phase !== 'play');
  }

  /* ---------- ごほうび ---------- */
  function showReward() {
    st.phase = 'reward';
    pendingFn = null; view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('sudoku-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < 3; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', S().TEXT.reward));
    var btns = ui.el('div', 'kk-r-btns');
    var again = ui.button('btn-big', function () { if (again.disabled) return; again.disabled = true; ui.play('tap'); newPuzzle(); });
    again.appendChild(ui.svg(ui.ICO.play));
    again.appendChild(ui.elR('span', null, 'もう{一回|いっかい}'));
    var end = ui.button('btn-big secondary', function () { if (end.disabled) return; end.disabled = true; ui.play('tap'); B.showHome(); });
    end.appendChild(ui.svg(ui.ICO.home));
    end.appendChild(ui.el('span', null, 'おわる'));
    btns.appendChild(again); btns.appendChild(end);
    info.appendChild(btns);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak(S().TEXT.reward);
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    return { phase: st.phase, level: st.level, size: st.size, puzzle: st.puzzle, solution: st.solution, grid: (st.grid || []).slice(),
      memos: JSON.parse(JSON.stringify(st.memos || {})), memoMode: !!st.memoMode, bad: (st.bad || []).slice(), mistakes: st.mistakes, hints: st.hints, sel: st.sel, msg: st.msg };
  }

  B.sudokuScreen = {
    show: show,
    _choose: choose, _select: select, _put: put, _erase: erase, _memo: toggleMemo, _hint: hint, _check: check, _flush: flush, _state: state
  };
})();
