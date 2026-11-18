/* プログラミングの画面。Chiid.benkyo.programScreen
   どれに する？（つづき・1〜5）→ 地図と 命令の ボタン → うごかす → 3問で ごほうび。
   しくみは Chiid.program（subjects/program.js）、部品は Chiid.benkyo.ui（main.js）。
   記録は1問1件（うまく いかなかった回数が 1回以下なら true）。#app が無いとき（テスト）は描画せず、状態だけを動かす。
   設計書：docs/superpowers/specs/2026-11-19-benkyo-program-design.md */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var STEP_MS = 330;        // ロボットが 1マス うごく 時間
  var WAIT_GOAL = 1600;     // 正解のあと、次の問題まで
  var ARROW = { u: '↑', d: '↓', l: '←', r: '→' };

  var st = null, view = null, pendingFn = null, pendSeq = 0;

  function P() { return C.program; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function speak(text) { if (drawing()) U().speak(text); }
  function L() { return P().LEVELS[st.level]; }

  /* ---------- 開く ---------- */
  // ctx.level を わたすと そのレベルで すぐ始める。わたさないときは 画面では「どれに する？」、テストでは 記録の レベル
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = { profileId: pid, level: 1, recent: [], autoLevel: 1, solved: 0, phase: 'loading', program: [], open: false, fails: 0, puzzle: null, msg: '' };
    pendingFn = null; view = null;
    var sid = B.ui && B.ui.screenId ? B.ui.screenId() : null;
    var ask = ctx.level === undefined && drawing();
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        if (st !== run) return;
        if (sid !== null && B.ui.screenId() !== sid) { st = null; return; }
        var p = P().progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent; st.autoLevel = p.level;
        if (ask) { showChoose(); return; }
        if (ctx.level !== undefined && ctx.level !== 'auto') { st.level = Math.max(1, Math.min(P().MAX_LEVEL, Number(ctx.level) || 1)); st.recent = []; }
        startRound();
      });
  }
  function choose(level) {
    if (!st || st.phase !== 'choose') return;
    if (level !== 'auto') { st.level = level; st.recent = []; }
    startRound();
  }
  function startRound() { st.solved = 0; nextQuestion(); }
  function restNow() {
    var over = false;
    try { over = typeof B.checkRest === 'function' && B.checkRest(); } catch (e) { over = false; }
    if (over) { st.phase = 'rest'; view = null; }
    return over;
  }
  function nextQuestion() {
    pendingFn = null;
    if (restNow()) return;
    st.puzzle = P().make(st.level);
    st.program = []; st.open = false; st.fails = 0; st.phase = 'play';
    st.msg = st.puzzle.loop ? P().TEXT.loop : st.puzzle.stars.length ? P().TEXT.star : P().TEXT.start;
    render();
    speak(st.msg);
  }

  /* ---------- 命令を ならべる ---------- */
  function last() { return st.program[st.program.length - 1]; }
  function openLoop() { var it = last(); return st.open && it && typeof it !== 'string' ? it : null; }
  function room(n) { return P().slotCount(st.program) + n <= st.puzzle.slots; }
  function full() { st.msg = P().TEXT.full; paint(); speak(st.msg); }
  function press(b) {
    if (!st || st.phase !== 'play') return;
    var lp = openLoop();
    if (ARROW[b]) {
      if (lp) { if (lp.body.length >= P().MAX_BODY || !room(1)) { full(); return; } lp.body.push(b); }
      else { if (!room(1)) { full(); return; } st.program.push(b); }
    } else if (b === 'loop') {
      if (!L().loop) return;
      if (lp) { st.open = false; if (!lp.body.length) st.program.pop(); }
      else { if (!room(1)) { full(); return; } st.program.push({ rep: 2, body: [] }); st.open = true; }
    } else if (b === 'times') {
      var t = lp || (last() && typeof last() !== 'string' ? last() : null);
      if (t) cycle(st.program.indexOf(t));
      return;
    } else if (b === 'back') {
      if (lp) { if (lp.body.length) lp.body.pop(); else { st.program.pop(); st.open = false; } }
      else st.program.pop();
    } else if (b === 'clear') {
      st.program = []; st.open = false;
    } else return;
    play('tap');
    paint();
  }
  function cycle(i) {
    var it = st && st.program[i];
    if (!it || typeof it === 'string') return;
    it.rep = it.rep >= 4 ? 2 : it.rep + 1;
    paint();
  }

  /* ---------- うごかす ---------- */
  function runProg() {
    if (!st || st.phase !== 'play' || !st.program.length) return;
    var lp = openLoop();
    if (lp) { st.open = false; if (!lp.body.length) st.program.pop(); }
    if (!st.program.length) { paint(); return; }
    var res = P().run(st.puzzle, st.program);
    st.phase = 'running';
    play('tap');
    paint();
    animate(res.steps, function () { finish(res); });
  }
  function animate(steps, done) {
    if (!drawing() || !view) { pendingFn = done; pendSeq++; return; }
    var i = 0, my = ++pendSeq;
    pendingFn = done;
    (function step() {
      if (my !== pendSeq) return;
      if (i >= steps.length) { U().later(function () { if (my === pendSeq) flush(); }, 250); return; }
      moveRobot(steps[i]);
      if (st.puzzle.stars.indexOf(steps[i]) >= 0) { play('star'); markStar(steps[i]); }
      i++;
      U().later(step, STEP_MS);
    })();
  }
  function finish(res) {
    if (res.result === 'goal') {
      var correct = st.fails <= 1;
      try {
        var p = C.storage.logAnswer({ profileId: st.profileId, area: P().AREA, itemId: 'lv' + st.level, correct: correct, level: st.level });
        if (p && p.catch) p.catch(function () {});
      } catch (e) { /* 保存できなくても続ける */ }
      st.recent.push(correct);
      var nl = C.adaptive.nextLevel(st.recent, st.level, P().MAX_LEVEL);
      if (nl !== st.level) { st.level = nl; st.recent = []; }
      st.solved++;
      st.phase = 'goal'; st.msg = P().TEXT.goal;
      play('correct'); paint(); speak(st.msg);
      wait(WAIT_GOAL, function () { if (st.solved >= P().ROUND_SIZE) showReward(); else nextQuestion(); });
      return;
    }
    st.fails++;
    st.msg = P().TEXT[res.result] || P().TEXT.short;
    if (res.result === 'crash') { play('oops'); bump(); }
    st.phase = 'play';
    resetRobot();
    paint(); speak(st.msg);
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
    var app = ui.newScreen('program-choose');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'pg-ch-body');
    body.appendChild(ui.el('p', 'pg-ch-title', P().TEXT.choose));
    var row = ui.el('div', 'pg-ch-row');
    function btn(main, sub, cls, level) {
      var b = ui.button('pg-ch ' + cls, function () { if (st.phase !== 'choose') return; ui.play('tap'); choose(level); });
      b.setAttribute('aria-label', main);
      b.appendChild(ui.el('span', 'pg-ch-main', main));
      if (sub) b.appendChild(ui.el('span', 'pg-ch-sub', sub));
      row.appendChild(b);
    }
    btn('つづき', '▶', 'pg-ch-auto', 'auto');
    [1, 2, 3, 4, 5].forEach(function (n) { btn('レベル ' + n, n >= 4 ? 'くりかえし' : (P().LEVELS[n].stars ? 'ほし' : ''), 'pg-ch-lv' + (n === st.autoLevel ? ' now' : ''), n); });
    body.appendChild(row);
    app.appendChild(body);
    ui.speak(P().TEXT.choose);
  }

  /* ---------- 描画 ---------- */
  function cellXY(k) { var p = k.split(',').map(Number); return [(p[0] + 0.5) * view.cell, (p[1] + 0.5) * view.cell]; }
  function render() {
    view = null;
    if (!drawing()) return;
    var ui = U(), pz = st.puzzle;
    var app = ui.newScreen('program');
    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    var sp = ui.button('icon-btn', function () { ui.play('tap'); ui.speak(st.msg); });
    sp.setAttribute('aria-label', 'もういちど きく');
    sp.appendChild(ui.svg(ui.ICO.speaker));
    if (right) right.insertBefore(sp, right.firstChild);
    var talk = ui.el('div', 'pg-talk');
    var bub = ui.bubble(''); bub.classList.add('pg-bub');
    talk.appendChild(bub);
    bar.insertBefore(talk, bar.lastChild);
    app.appendChild(bar);
    var body = ui.el('div', 'pg-body');
    var map = ui.el('div', 'pg-map');
    var panel = ui.el('div', 'pg-panel');
    body.appendChild(map); body.appendChild(panel);
    app.appendChild(body);
    // 命令と ボタン
    var progBox = ui.el('div', 'pg-prog');
    var left = ui.el('div', 'pg-left');
    panel.appendChild(progBox);   // 「のこり ○こ」は 命令の 箱の 右はしに 入れる（paint）
    var pal = ui.el('div', 'pg-pal');
    function pbtn(key, label, cls, aria) {
      var b = ui.button('pg-btn ' + (cls || ''), function () { press(key); });
      b.setAttribute('aria-label', aria || label);
      b.appendChild(ui.elR('span', null, label));
      pal.appendChild(b);
      return b;
    }
    pbtn('u', '↑', 'pg-arrow', 'うえ'); pbtn('d', '↓', 'pg-arrow', 'した'); pbtn('l', '←', 'pg-arrow', 'ひだり'); pbtn('r', '→', 'pg-arrow', 'みぎ');
    var loopB = null, timesB = null;
    if (pz.loop) { loopB = pbtn('loop', '🔁', 'pg-loop', 'くりかえし'); timesB = pbtn('times', '×2', 'pg-times', 'かいすう'); }
    panel.appendChild(pal);
    var ctl = ui.el('div', 'pg-ctl');
    var back = ui.button('pg-btn pg-sub', function () { press('back'); }); back.appendChild(ui.el('span', null, '⌫ けす'));
    var clr = ui.button('pg-btn pg-sub', function () { press('clear'); }); clr.appendChild(ui.el('span', null, 'ぜんぶ けす'));
    var go = ui.button('pg-btn pg-go', function () { runProg(); }); go.appendChild(ui.svg(ui.ICO.play)); go.appendChild(ui.el('span', null, 'うごかす'));
    ctl.appendChild(back); ctl.appendChild(clr); ctl.appendChild(go);
    panel.appendChild(ctl);
    // 地図（板の 広さから マスの 大きさを 決める）
    var r = map.getBoundingClientRect();
    var cell = Math.max(24, Math.floor(Math.min(r.width / pz.w, r.height / pz.h)));
    var W = cell * pz.w, Hh = cell * pz.h;
    var s = '<svg class="pg-svg" width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + ' ' + Hh + '" aria-hidden="true">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + Hh + '" rx="' + (cell * 0.18) + '" fill="#eaf6e8"/>';
    for (var y = 0; y < pz.h; y++) for (var x = 0; x < pz.w; x++) s += '<rect x="' + (x * cell + 2) + '" y="' + (y * cell + 2) + '" width="' + (cell - 4) + '" height="' + (cell - 4) + '" rx="' + (cell * 0.14) + '" fill="' + ((x + y) % 2 ? '#d6eed2' : '#e2f3de') + '"/>';
    function at(k, inner, cls) { var p = k.split(',').map(Number); return '<g class="' + cls + '" data-at="' + k + '" transform="translate(' + ((p[0] + 0.5) * cell) + ' ' + ((p[1] + 0.5) * cell) + ')">' + inner + '</g>'; }
    var fs = Math.round(cell * 0.62);
    pz.rocks.forEach(function (k) { s += at(k, '<path d="M' + (-cell * 0.36) + ' ' + (cell * 0.28) + ' L' + (-cell * 0.24) + ' ' + (-cell * 0.12) + ' L' + (-cell * 0.04) + ' ' + (-cell * 0.3) + ' L' + (cell * 0.22) + ' ' + (-cell * 0.18) + ' L' + (cell * 0.36) + ' ' + (cell * 0.28) + ' Z" fill="#8c8f96" stroke="#6b6e75" stroke-width="' + Math.max(2, cell * 0.04) + '" stroke-linejoin="round"/>', 'pg-rock'); });
    pz.stars.forEach(function (k) { s += at(k, '<text font-size="' + fs + '" text-anchor="middle" dominant-baseline="central">⭐</text>', 'pg-star'); });
    s += at(pz.goal, '<text font-size="' + fs + '" text-anchor="middle" dominant-baseline="central">🚩</text>', 'pg-goal');
    var sp0 = pz.start.split(',').map(Number);
    s += '<g class="pg-robot" style="transform:translate(' + ((sp0[0] + 0.5) * cell) + 'px,' + ((sp0[1] + 0.5) * cell) + 'px)"><text font-size="' + fs + '" text-anchor="middle" dominant-baseline="central">🤖</text></g>';
    s += '</svg>';
    map.innerHTML = s;
    view = { cell: cell, bub: bub, progBox: progBox, left: left, svg: map.firstChild, robot: map.querySelector('.pg-robot'), loopB: loopB, timesB: timesB, go: go, body: body };
    paint();
  }
  function paint() {
    if (!view || !drawing()) return;
    var ui = U();
    ui.fillR(view.bub, st.msg);
    var box = view.progBox; box.innerHTML = '';
    if (!st.program.length) box.appendChild(ui.el('span', 'pg-empty', 'ここに ならぶよ'));
    st.program.forEach(function (it, i) {
      if (typeof it === 'string') { box.appendChild(ui.el('span', 'pg-chip', ARROW[it])); return; }
      var g = ui.el('span', 'pg-group' + (st.open && i === st.program.length - 1 ? ' open' : ''));
      g.appendChild(ui.el('span', 'pg-br', '['));
      it.body.forEach(function (d) { g.appendChild(ui.el('span', 'pg-chip', ARROW[d])); });
      if (!it.body.length) g.appendChild(ui.el('span', 'pg-chip pg-ph', '…'));
      g.appendChild(ui.el('span', 'pg-br', ']'));
      g.appendChild(ui.el('span', 'pg-rep', '×' + it.rep));
      box.appendChild(g);
    });
    view.left.textContent = 'のこり ' + (st.puzzle.slots - P().slotCount(st.program)) + 'こ';
    box.appendChild(view.left);
    if (view.loopB) view.loopB.classList.toggle('on', !!openLoop());
    if (view.timesB) {
      var t = openLoop() || (last() && typeof last() !== 'string' ? last() : null);
      view.timesB.firstChild.textContent = '×' + (t ? t.rep : 2);
      view.timesB.disabled = !t;
    }
    view.go.disabled = st.phase !== 'play' || !st.program.length;
    view.body.classList.toggle('is-run', st.phase !== 'play');
  }
  function moveRobot(k) { if (!view || !view.robot) return; var p = cellXY(k); view.robot.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)'; }
  function resetRobot() {
    if (!view) return;
    moveRobot(st.puzzle.start);
    Array.prototype.forEach.call(view.svg.querySelectorAll('.pg-star'), function (e) { e.classList.remove('got'); });
  }
  function markStar(k) { var e = view && view.svg.querySelector('.pg-star[data-at="' + k + '"]'); if (e) e.classList.add('got'); }
  function bump() { if (!view || !view.robot) return; var r = view.robot; r.classList.remove('pg-bump'); void r.getBoundingClientRect(); r.classList.add('pg-bump'); }

  /* ---------- ごほうび ---------- */
  function showReward() {
    st.phase = 'reward';
    pendingFn = null; view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('program-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < 3; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', P().TEXT.reward));
    info.appendChild(ui.el('p', 'kk-r-sub', P().ROUND_SIZE + 'もん できたよ'));
    var btns = ui.el('div', 'kk-r-btns');
    var again = ui.button('btn-big', function () { if (again.disabled) return; again.disabled = true; ui.play('tap'); startRound(); });
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
    ui.speak(P().TEXT.reward);
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    return { phase: st.phase, level: st.level, solved: st.solved, program: JSON.parse(JSON.stringify(st.program || [])), open: st.open, fails: st.fails, puzzle: st.puzzle, msg: st.msg };
  }

  B.programScreen = {
    show: show,
    _choose: choose, _press: press, _cycle: cycle, _run: runProg, _flush: flush, _state: state
  };
})();
