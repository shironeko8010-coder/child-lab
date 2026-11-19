/* ロジックぬりえの画面。Chiid.benkyo.logicScreen
   どれに する？（つづき・1〜5）→ 数字の ついた 表と ボタン（ぬる・×・けす・ヒント・こたえあわせ）→ できた（絵に 色）→ ごほうび（1問ごと）。
   しくみは Chiid.logic（subjects/logic.js）、部品は Chiid.benkyo.ui（main.js）。
   マスの 状態：0＝まだ、1＝ぬった、2＝×（ぬらない しるし）。
   記録は1問1件（ヒントを 使わず、まちがいが 1回以下なら true）。#app が無いとき（テスト）は描画せず、状態だけを動かす。
   設計書：docs/superpowers/specs/2026-11-20-benkyo-logic-design.md */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CLEAR = 2600;
  var st = null, view = null, pendingFn = null, pendSeq = 0, lastId = null;

  function G() { return C.logic; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function speak(text) { if (drawing()) U().speak(text); }
  function L() { return G().LEVELS[st.level]; }

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
        var p = G().progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent; st.autoLevel = p.level;
        if (ask) { showChoose(); return; }
        if (ctx.level !== undefined && ctx.level !== 'auto') { st.level = Math.max(1, Math.min(G().MAX_LEVEL, Number(ctx.level) || 1)); st.recent = []; }
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
    var p = G().make(st.level, Math.random, lastId);
    lastId = p.id;
    st.size = p.size; st.solution = p.solution; st.rowClues = p.rowClues; st.colClues = p.colClues;
    st.name = p.name; st.color = p.color; st.picId = p.id;
    st.grid = p.solution.map(function () { return 0; });
    st.mode = 'fill'; st.bad = []; st.mistakes = 0; st.hints = 0; st.phase = 'play';
    st.msg = L().instant ? G().TEXT.rule : G().TEXT.start;
    render();
    speak(st.msg);
  }

  /* ---------- ぬる ---------- */
  function setMode(m) {
    if (!st || st.phase !== 'play' || ['fill', 'cross', 'erase'].indexOf(m) < 0) return;
    st.mode = m; play('tap'); paint();
  }
  function done() {   // ぬる マスが ぜんぶ ぬれていて、まちがいの ぬりが ない
    return st.solution.every(function (v, i) { return v ? st.grid[i] === 1 : st.grid[i] !== 1; });
  }
  function tap(i) {
    if (!st || st.phase !== 'play' || i < 0 || i >= st.grid.length) return;
    var cur = st.grid[i], next;
    if (st.mode === 'fill') next = cur === 1 ? 0 : 1;
    else if (st.mode === 'cross') next = cur === 2 ? 0 : 2;
    else next = 0;
    if (next === cur) return;
    st.grid[i] = next;
    st.bad = st.bad.filter(function (b) { return b !== i; });
    play('tap');
    if (L().instant && next) {
      var wrong = next === 1 ? !st.solution[i] : !!st.solution[i];
      if (wrong) {
        st.bad.push(i); st.mistakes++;
        st.msg = next === 1 ? G().TEXT.wrongFill : G().TEXT.wrongCross;
        play('oops'); paint(); speak(st.msg); return;
      }
    }
    afterChange();
  }
  function afterChange() {
    if (L().instant && done()) { clear(); return; }
    paint();
  }
  // ヒント：まちがって ぬった マスが あれば × に なおす。なければ ぬる マスを 1つ ぬる
  function hint() {
    if (!st || st.phase !== 'play') return;
    var i = st.grid.findIndex(function (v, j) { return v === 1 && !st.solution[j]; }), val = 2;
    if (i < 0) { i = st.grid.findIndex(function (v, j) { return v !== 1 && st.solution[j]; }); val = 1; }
    if (i < 0) return;
    st.grid[i] = val; st.hints++;
    st.bad = st.bad.filter(function (b) { return b !== i; });
    st.msg = G().TEXT.hint;
    play('tap'); speak(st.msg);
    afterChange();
  }
  // こたえあわせ（レベル3〜5）。ぬらない マスを ぬって いたら 赤く。たりない だけなら 知らせるだけ（まちがいに しない）
  function check() {
    if (!st || st.phase !== 'play' || L().instant) return;
    st.bad = st.grid.map(function (v, i) { return v === 1 && !st.solution[i] ? i : -1; }).filter(function (i) { return i >= 0; });
    if (st.bad.length) { st.mistakes++; st.msg = G().TEXT.check; play('oops'); paint(); speak(st.msg); return; }
    if (!done()) { st.msg = G().TEXT.more; paint(); speak(st.msg); return; }
    clear();
  }
  function clear() {
    var correct = st.hints === 0 && st.mistakes <= 1;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: G().AREA, itemId: 'lv' + st.level, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, G().MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.phase = 'clear'; st.bad = [];
    st.msg = G().TEXT.clear + ' ' + G().TEXT.reveal.replace('＊', st.name);
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
    var app = ui.newScreen('logic-choose');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'pg-ch-body');
    body.appendChild(ui.el('p', 'pg-ch-title', G().TEXT.choose));
    var row = ui.el('div', 'pg-ch-row');
    function btn(main, sub, cls, level) {
      var b = ui.button('pg-ch ' + cls, function () { if (st.phase !== 'choose') return; ui.play('tap'); choose(level); });
      b.setAttribute('aria-label', main);
      b.appendChild(ui.el('span', 'pg-ch-main', main));
      if (sub) b.appendChild(ui.el('span', 'pg-ch-sub', sub));
      row.appendChild(b);
    }
    btn('つづき', '▶', 'pg-ch-auto', 'auto');
    [1, 2, 3, 4, 5].forEach(function (n) { var z = G().LEVELS[n].size; btn('レベル ' + n, z + '×' + z + (n === 5 ? ' おとな' : ''), 'pg-ch-lv' + (n === st.autoLevel ? ' now' : ''), n); });
    body.appendChild(row);
    app.appendChild(body);
    ui.speak(G().TEXT.choose);
  }

  /* ---------- 描画 ---------- */
  function clueW(c) {   // よこの 数字の 幅（字の 大きさ 1 に たいして）
    if (!c.length) return 0.9;
    return c.reduce(function (s, n) { return s + String(n).length * 0.62 + 0.42; }, 0.2);
  }
  function render() {
    view = null;
    if (!drawing()) return;
    var ui = U(), N = st.size;
    var app = ui.newScreen('logic');
    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    var sp = ui.button('icon-btn', function () { ui.play('tap'); ui.speak(st.phase === 'play' && L().instant ? G().TEXT.rule : st.msg); });
    sp.setAttribute('aria-label', 'もういちど きく');
    sp.appendChild(ui.svg(ui.ICO.speaker));
    if (right) right.insertBefore(sp, right.firstChild);
    var talk = ui.el('div', 'sd-talk lg-talk');
    var bub = ui.bubble(''); bub.classList.add('sd-bub');
    ui.fillR(bub, st.msg);   // 文を 入れてから 表の 広さを はかる
    talk.appendChild(bub);
    bar.insertBefore(talk, bar.lastChild);
    app.appendChild(bar);
    var body = ui.el('div', 'lg-body');
    var board = ui.el('div', 'lg-board');
    var panel = ui.el('div', 'lg-panel');
    body.appendChild(board); body.appendChild(panel);
    app.appendChild(body);
    var modes = ui.el('div', 'lg-modes');
    var modeB = {};
    function mbtn(m, label, aria) {
      var b = ui.button('sd-btn lg-mode lg-m-' + m, function () { setMode(m); });
      b.setAttribute('aria-label', aria);
      b.appendChild(ui.el('span', 'lg-m-ico'));
      b.appendChild(ui.el('span', null, label));
      modes.appendChild(b); modeB[m] = b;
    }
    mbtn('fill', 'ぬる', 'ぬる');
    mbtn('cross', '×', 'ばつ');
    mbtn('erase', 'けす', 'けす');
    panel.appendChild(modes);
    var ctl = ui.el('div', 'lg-ctl');
    function cbtn(label, cls, fn) { var b = ui.button('sd-btn ' + cls, fn); b.appendChild(ui.elR('span', null, label)); ctl.appendChild(b); return b; }
    cbtn('ヒント', 'sd-sub', hint);
    var checkB = L().instant ? null : cbtn('こたえあわせ', 'sd-check', check);
    panel.appendChild(ctl);
    // 表（板の 広さから マスの 大きさ。数字の 字は マスの 0.55）
    var r = board.getBoundingClientRect();
    var K = 0.55;
    var a = Math.max.apply(null, st.rowClues.map(clueW)) * K + 0.2;
    var bmax = Math.max.apply(null, st.colClues.map(function (c) { return Math.max(1, c.length); }));
    var b2 = bmax * 1.08 * K + 0.25;
    var cell = Math.floor(Math.min((r.width - 8) / (N + a), (r.height - 8) / (N + b2)));
    cell = Math.max(18, cell);
    var font = Math.max(12, Math.round(cell * K));
    var grid = ui.el('div', 'lg-grid s' + N);
    grid.style.gridTemplateColumns = Math.ceil(a * cell) + 'px repeat(' + N + ', ' + cell + 'px)';
    grid.style.gridTemplateRows = Math.ceil(b2 * cell) + 'px repeat(' + N + ', ' + cell + 'px)';
    grid.style.fontSize = font + 'px';
    grid.appendChild(ui.el('div', 'lg-corner'));
    var colEls = st.colClues.map(function (c, x) {
      var d = ui.el('div', 'lg-cc' + (N === 10 && x === 4 ? ' br' : ''));
      (c.length ? c : [0]).forEach(function (n) { d.appendChild(ui.el('span', null, String(n))); });
      grid.appendChild(d); return d;
    });
    var rowEls = [], cells = [];
    for (var y = 0; y < N; y++) {
      var rc = ui.el('div', 'lg-rc' + (N === 10 && y === 4 ? ' bb' : ''));
      (st.rowClues[y].length ? st.rowClues[y] : [0]).forEach(function (n) { rc.appendChild(ui.el('span', null, String(n))); });
      grid.appendChild(rc); rowEls.push(rc);
      for (var x = 0; x < N; x++) (function (i, x, y) {
        var b = ui.button('lg-cell' + (N === 10 && x === 4 ? ' br' : '') + (N === 10 && y === 4 ? ' bb' : ''), function () { tap(i); });
        b.setAttribute('aria-label', (y + 1) + 'だん ' + (x + 1) + 'れつ');
        grid.appendChild(b); cells.push(b);
      })(y * N + x, x, y);
    }
    board.appendChild(grid);
    view = { bub: bub, cells: cells, rowEls: rowEls, colEls: colEls, modeB: modeB, checkB: checkB, body: body, grid: grid };
    paint();
  }
  function paint() {
    if (!view || !drawing()) return;
    var ui = U(), N = st.size, clearNow = st.phase !== 'play';
    ui.fillR(view.bub, st.msg);
    view.cells.forEach(function (b, i) {
      var v = st.grid[i];
      b.classList.toggle('f', v === 1);
      b.classList.toggle('x', v === 2 && !clearNow);
      b.classList.toggle('bad', st.bad.indexOf(i) >= 0);
      b.style.background = clearNow && st.solution[i] ? st.color : '';
    });
    view.rowEls.forEach(function (el, y) { el.classList.toggle('done', G().lineOk(st.rowClues[y], st.grid.slice(y * N, y * N + N))); });
    view.colEls.forEach(function (el, x) {
      var col = []; for (var y = 0; y < N; y++) col.push(st.grid[y * N + x]);
      el.classList.toggle('done', G().lineOk(st.colClues[x], col));
    });
    Object.keys(view.modeB).forEach(function (m) { view.modeB[m].classList.toggle('on', st.mode === m); });
    view.grid.classList.toggle('is-clear', clearNow);
    view.body.classList.toggle('is-done', clearNow);
  }

  /* ---------- ごほうび ---------- */
  function showReward() {
    st.phase = 'reward';
    pendingFn = null; view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('logic-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < 3; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', G().TEXT.reward));
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
    ui.speak(G().TEXT.reward);
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    return { phase: st.phase, level: st.level, size: st.size, solution: st.solution, grid: (st.grid || []).slice(), name: st.name, picId: st.picId,
      mode: st.mode, bad: (st.bad || []).slice(), mistakes: st.mistakes, hints: st.hints, msg: st.msg };
  }

  B.logicScreen = {
    show: show,
    _choose: choose, _tap: tap, _mode: setMode, _hint: hint, _check: check, _flush: flush, _state: state
  };
})();
