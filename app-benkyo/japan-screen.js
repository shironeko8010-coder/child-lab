/* 日本の 地図（小2）の問題画面とごほうび画面。Chiid.benkyo.japanScreen
   出題・判定・地図の形は Chiid.japan（subjects/japan.js）、部品は Chiid.benkyo.ui（main.js）を使う。
   - 左に地図（SVG）、右に問題・選択肢・ぴよ。たて長のときは上に地図。
   - 小さい県を押しやすくするため、地図を押すと まず その地方が大きくなる（2だんタッチ）。
     県あて・県庁の問題は、はじめから その地方を大きくして光らせる。「ぜんたい」で もどる。
   - 正解 → その県に色がつき、ひとこと説明（おまけの ひとことも）→ 声のあと次へ（「つぎへ」で早めに）。
   - まちがい → 「もういっかい やって みよう！」。2回まちがえたら答えを光らせて、押すと次へ。
   - 10問で区切り、5問ごとに星。問題のあいだで利用時間を確かめる（B.checkRest）。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var MIN_GOOD = 2500;       // ほめたあと、次へ進むまでの最短（ms）
  var ZOOM_MS = 380;         // 拡大の動きの長さ（ms）

  var st = null;
  var view = null;
  var pendingFn = null;
  var pendSeq = 0;
  var talkSeq = 0;

  function J() { return C.japan; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }

  function talk(text) {
    var my = ++talkSeq;
    if (!drawing()) return Promise.resolve();
    var p = Promise.resolve();
    J().sentences(text).forEach(function (s) {
      p = p.then(function () { if (my === talkSeq) return U().speak(s); });
    });
    return p.then(function () { return my === talkSeq; });
  }
  function hush() { talkSeq++; try { C.voice.cancel(); } catch (e) {} }

  /* ---------- 開く ---------- */
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = {
      profileId: pid, level: 1, recent: [], missCounts: {}, colored: {},
      plan: [], used: {}, lastTarget: null,
      q: null, attempt: null, result: null, zoom: null,
      solved: 0, stars: 0, phase: 'loading', mood: 'normal',
      rng: ctx.rng || Math.random
    };
    pendingFn = null;
    view = null;
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        if (st !== run) return;
        var p = J().progressFromLogs(logs);
        st.level = p.level;
        st.recent = p.recent;
        st.missCounts = p.missCounts;
        st.colored = p.colored;
        startRound();
      });
  }

  function startRound() {
    st.solved = 0;
    st.stars = 0;
    st.used = {};
    st.plan = J().kindPlan(st.level, st.rng);
    pendingFn = null;
    buildScreen();
    nextQuestion();
  }

  function nextQuestion() {
    var q = J().pickQuestion({ level: st.level, kind: st.plan[st.solved], missCounts: st.missCounts, used: st.used, lastTarget: st.lastTarget }, st.rng);
    st.used[q.itemId] = true;
    st.lastTarget = q.target;
    st.q = q;
    st.attempt = J().newAttempt();
    st.result = null;
    st.phase = 'question';
    st.mood = 'normal';
    // 県あて・県庁は、その県の地方を大きくして光らせる。ほかは日本全体から
    st.zoom = (q.scope === 'pref' && (q.kind === 'atete' || q.kind === 'kencho')) ? J().pref(q.target).region : null;
    paintQuestion();
    paint();
    talk(J().speakText(q));
  }

  /* ---------- 答える ---------- */
  // 選択肢の id、または地図で押した県の id
  function pick(id) {
    if (!st || st.phase !== 'question') return;
    var q = st.q;
    var r = J().answer(st.attempt, q, id);
    if (r.kind === 'ignore') return;
    st.result = r;
    if (r.kind === 'retry' || r.kind === 'show') {
      st.mood = 'think';
      play('oops');
      if (r.kind === 'show' && q.scope === 'pref') st.zoom = J().pref(q.target).region;
      paint();
      talk(J().replyText(q, r));
      return;
    }
    st.mood = 'happy';
    play('correct');
    if (q.scope === 'pref') { st.colored[q.target] = true; st.zoom = J().pref(q.target).region; }
    finish();
    waitAfter(talk(J().replyText(q, r)), MIN_GOOD);
  }

  // 地図を押した。県の問題のタッチは2だん（地方を大きく → 県を選ぶ）
  function tapMap(id) {
    if (!st || !st.q || !J().pref(id)) return;
    var q = st.q, rid = J().pref(id).region;
    if (st.phase !== 'question') return;
    if (q.kind === 'touch' && q.scope === 'region') { pick(id); return; }
    if (q.scope === 'pref' && st.zoom !== rid) { setZoom(rid); return; }
    if (q.kind === 'touch') pick(id);
  }
  function setZoom(rid) {
    if (!st) return;
    st.zoom = rid || null;
    paint();
  }

  // 1問おわり：記録・レベル・星
  function finish() {
    var q = st.q, a = st.attempt;
    try {
      var e = J().logEntry(q, a);
      var p = C.storage.logAnswer({ profileId: st.profileId, area: e.area, itemId: e.itemId, correct: e.correct, level: e.level });
      if (p && p.catch) p.catch(function () {});
    } catch (err) { /* 保存できなくても続ける */ }
    if (!a.firstTry) st.missCounts[q.itemId] = (st.missCounts[q.itemId] || 0) + 1;
    st.recent.push(!!a.firstTry);
    if (st.recent.length > 5) st.recent.shift();
    var nl = C.adaptive.nextLevel(st.recent, st.level, J().MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.solved++;
    st.phase = 'feedback';
    if (st.solved % J().STAR_EVERY === 0) {
      st.stars++;
      if (drawing()) U().later(function () { play('star'); }, 450);
    }
    paint();
  }

  /* ---------- 次へ ---------- */
  function waitAfter(said, minMs) {
    pendingFn = goNext;
    var my = ++pendSeq;
    if (!drawing()) return;
    var t0 = Date.now();
    var ui = U();
    said.then(function () {
      if (my !== pendSeq) return;
      var rest = minMs - (Date.now() - t0);
      ui.later(function () { if (my === pendSeq) flush(); }, Math.max(rest, 700));
    });
  }
  function flush() {
    if (!pendingFn) return;
    var f = pendingFn;
    pendingFn = null;
    pendSeq++;
    f();
  }
  function goNext() {
    hush();
    if (st.solved >= J().ROUND_SIZE) { showReward(); return; }
    if (restNow()) return;
    nextQuestion();
  }
  function restNow() {
    var over = false;
    try { over = typeof B.checkRest === 'function' && B.checkRest(); } catch (e) { over = false; }
    if (over) { st.phase = 'rest'; view = null; }
    return over;
  }
  function coloredCount() { return Object.keys(st.colored).length; }

  /* ---------- ごほうび ---------- */
  function showReward() {
    st.phase = 'reward';
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('japan-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < st.stars; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.elR('p', 'kk-r-msg', '日本 はかせに ちかづいたね！'));
    info.appendChild(ui.elR('p', 'kk-r-sub', '{色|いろ}が ついた ところ ' + coloredCount() + ' / 47'));
    var btns = ui.el('div', 'kk-r-btns');
    var again = ui.button('btn-big', function () {
      if (again.disabled) return;
      again.disabled = true;
      ui.play('tap');
      againRound();
    });
    again.appendChild(ui.svg(ui.ICO.play));
    again.appendChild(ui.elR('span', null, 'もう{一回|いっかい}'));
    var end = ui.button('btn-big secondary', function () {
      if (end.disabled) return;
      end.disabled = true;
      ui.play('tap');
      B.showHome();
    });
    end.appendChild(ui.svg(ui.ICO.home));
    end.appendChild(ui.el('span', null, 'おわる'));
    btns.appendChild(again);
    btns.appendChild(end);
    info.appendChild(btns);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak('日本はかせにちかづいたね！ ほしが ' + st.stars + 'こ');
  }
  function againRound() {
    if (!st || st.phase !== 'reward') return;
    if (restNow()) return;
    startRound();
  }

  /* ---------- 描画 ---------- */
  var MAP_SVG = null;     // 地図の形（1回だけ作る）
  function mapMarkup(mini) {
    var J_ = J(), out = '';
    var ob = J_.okinawaBox();
    out += '<rect class="jp-oki" x="' + ob[0] + '" y="' + ob[1] + '" width="' + (ob[2] - ob[0]) + '" height="' + (ob[3] - ob[1]) + '" rx="6"/>';
    C.japanData.PREFS.forEach(function (p) {
      out += '<path class="jp-pref r-' + p.region + '"' + (mini ? '' : ' data-id="' + p.id + '"') + ' d="' + J_.pathOf(p.id) + '"/>';
    });
    out += '<path class="jp-lake" d="' + J_.lakePath() + '"/>';
    return out;
  }
  // [左, 上, 右, 下] → viewBox の「x y 幅 高さ」
  function boxStr(b) {
    function r(v) { return Math.round(v * 10) / 10; }
    return [r(b[0]), r(b[1]), r(b[2] - b[0]), r(b[3] - b[1])].join(' ');
  }

  function buildScreen() {
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('japan');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app };

    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    if (hasVoice) {
      var sp = ui.button('icon-btn kk-speak', function () {
        if (!st || !st.q) return;
        ui.play('tap');
        talk(st.result ? J().replyText(st.q, st.result) : J().speakText(st.q));
      });
      sp.setAttribute('aria-label', 'もういちど きく');
      sp.appendChild(ui.svg(ui.ICO.speaker));
      right.insertBefore(sp, right.firstChild);
    }
    app.appendChild(bar);

    var body = ui.el('div', 'jp-body');
    // 地図
    var mapBox = ui.el('div', 'jp-map');
    if (!MAP_SVG) MAP_SVG = mapMarkup(false);
    var world = J().worldBox();
    mapBox.innerHTML = '<svg class="jp-svg" viewBox="' + boxStr(world) + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="日本の ちず">' +
      MAP_SVG + '<text class="jp-label" text-anchor="middle"></text></svg>' +
      '<svg class="jp-mini" viewBox="' + boxStr(world) + '" aria-hidden="true">' + mapMarkup(true) + '<rect class="jp-mini-box"/></svg>';
    v.svg = mapBox.querySelector('.jp-svg');
    v.label = mapBox.querySelector('.jp-label');
    v.mini = mapBox.querySelector('.jp-mini');
    v.miniBox = mapBox.querySelector('.jp-mini-box');
    v.paths = {};
    Array.prototype.forEach.call(v.svg.querySelectorAll('[data-id]'), function (pth) { v.paths[pth.getAttribute('data-id')] = pth; });
    var myView = v;
    v.svg.addEventListener('click', function (ev) {
      if (view !== myView) return;
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-id]') : null;
      if (!t) return;
      ui.play('tap');
      tapMap(t.getAttribute('data-id'));
    });
    v.allBtn = ui.button('jp-all', function () { if (st && st.zoom) { ui.play('tap'); setZoom(null); } });
    fillText(v.allBtn, 'ぜんたい');
    mapBox.appendChild(v.allBtn);
    v.box = world.slice();
    body.appendChild(mapBox);

    // 問題
    var side = ui.el('div', 'jp-side');
    var head = ui.el('div', 'jp-head');
    v.icon = ui.el('div', 'jp-icon');
    head.appendChild(v.icon);
    v.ask = ui.el('p', 'jp-ask');
    head.appendChild(v.ask);
    side.appendChild(head);
    v.hint = ui.el('p', 'jp-hint');
    side.appendChild(v.hint);
    v.list = ui.el('div', 'jp-choices');
    v.btns = [];
    for (var i = 0; i < 4; i++) {
      (function (pos) {
        var b = ui.button('jp-choice', function () { onChoice(pos); });
        b.setAttribute('data-pos', String(pos));
        v.btns.push(b);
        v.list.appendChild(b);
      })(i);
    }
    side.appendChild(v.list);
    v.talk = ui.el('div', 'jp-talk');
    v.who = ui.el('div', 'jp-who');
    v.talk.appendChild(v.who);
    v.bubble = ui.bubble('');
    v.bubble.classList.add('jp-msg');
    v.bubble.setAttribute('aria-live', 'polite');
    v.talk.appendChild(v.bubble);
    side.appendChild(v.talk);
    var foot = ui.el('div', 'jp-foot');
    var prog = ui.el('div', 'kk-prog');
    v.dots = [];
    var dots = ui.el('div', 'kk-dots');
    for (var k = 0; k < J().ROUND_SIZE; k++) {
      var d = ui.el('span', 'kk-dot');
      v.dots.push(d);
      dots.appendChild(d);
    }
    prog.appendChild(dots);
    v.stars = ui.el('div', 'kk-stars');
    prog.appendChild(v.stars);
    foot.appendChild(prog);
    v.next = ui.button('btn-big jp-next', function () { if (pendingFn) { ui.play('tap'); flush(); } });
    v.next.appendChild(ui.svg(ui.ICO.next));
    v.next.appendChild(ui.el('span', null, 'つぎへ'));
    foot.appendChild(v.next);
    side.appendChild(foot);
    body.appendChild(side);
    app.appendChild(body);
    v.body = body;
    v.mood = null;
    v.starsShown = -1;
    view = v;
  }

  function fillText(node, text) { U().fillR(node, text); }

  function onChoice(pos) {
    if (pendingFn || !st || !st.q) return;
    var c = st.q.choices[pos];
    if (c) pick(c.id);
  }

  // 問題が変わったときだけ描く
  function paintQuestion() {
    if (!view || !st || !st.q || !drawing()) return;
    var v = view, q = st.q;
    fillText(v.ask, q.ask);
    var ic = q.kind === 'meibutsu' && q.product ? ICONS[q.product.icon] : null;
    v.icon.innerHTML = ic ? '<svg viewBox="0 0 64 64" aria-hidden="true">' + ic + '</svg>' : '';
    v.icon.style.display = ic ? '' : 'none';
    v.list.className = 'jp-choices n' + q.choices.length;
    for (var i = 0; i < v.btns.length; i++) {
      var c = q.choices[i];
      fillText(v.btns[i], c ? c.text : '');
      v.btns[i].style.display = c ? '' : 'none';
    }
    v.body.classList.toggle('is-touch', q.kind === 'touch');
  }

  function paint() {
    if (!view || !st || !st.q || !drawing()) return;
    var ui = U(), v = view, q = st.q, r = st.result, a = st.attempt;
    // 選択肢
    for (var i = 0; i < v.btns.length; i++) {
      var c = q.choices[i];
      if (!c) continue;
      var tried = a.tried.indexOf(c.id) >= 0;
      var good = st.phase === 'feedback' && c.id === q.target;
      v.btns[i].classList.toggle('tried', tried);
      v.btns[i].classList.toggle('chosen', good);
      v.btns[i].classList.toggle('show', !!(a.shown && c.id === q.target && st.phase === 'question'));
      v.btns[i].disabled = st.phase !== 'question' || tried || (a.shown && c.id !== q.target);
    }
    // 地図：色ぬり・光る・拡大
    var lit = {};
    var showTarget = q.kind === 'atete' || q.kind === 'kencho' || a.shown || st.phase === 'feedback';
    if (showTarget) {
      if (q.scope === 'region') J().prefsOf(q.target).forEach(function (p) { lit[p.id] = true; });
      else lit[q.target] = true;
    }
    Object.keys(v.paths).forEach(function (id) {
      var pth = v.paths[id];
      pth.classList.toggle('done', !!st.colored[id]);
      pth.classList.toggle('hl', !!lit[id] && st.phase === 'question');
      pth.classList.toggle('good', !!lit[id] && st.phase === 'feedback');
    });
    var target = st.zoom ? J().regionBox(st.zoom) : J().worldBox();
    animateBox(target);
    v.allBtn.classList.toggle('on', !!st.zoom);
    // 名前（正解のあと、地図の上に）
    if (st.phase === 'feedback' && q.scope === 'pref') {
      var cen = J().geo()[q.target].center;
      var fs = Math.max(10, (target[2] - target[0]) / 16);
      v.label.setAttribute('x', cen[0]);
      v.label.setAttribute('y', cen[1] + fs * 0.35);
      v.label.setAttribute('font-size', Math.round(fs));
      v.label.textContent = J().plain(J().pref(q.target).name);
    } else v.label.textContent = '';
    // 小さな日本全体の図（拡大しているとき）
    v.mini.classList.toggle('on', !!st.zoom);
    if (st.zoom) {
      v.miniBox.setAttribute('x', target[0]); v.miniBox.setAttribute('y', target[1]);
      v.miniBox.setAttribute('width', target[2] - target[0]); v.miniBox.setAttribute('height', target[3] - target[1]);
    }
    // ヒント
    var hint = '';
    if (q.kind === 'touch' && q.scope === 'pref' && st.phase === 'question') {
      hint = st.zoom ? '{県|けん}を おしてね。ちがう {地方|ちほう}は「ぜんたい」から。' : 'まず {地方|ちほう}を おすと、大きく なるよ。';
    }
    fillText(v.hint, hint);
    v.hint.style.display = hint ? '' : 'none';
    // ぴよの返事
    if (r) {
      var msg = r.kind === 'retry' ? J().RETRY : r.kind === 'show' ? (q.kind === 'touch' ? J().SHOW_MAP : J().SHOW_BTN) : q.fact;
      fillText(v.bubble, msg);
      if (r.kind === 'good' && q.extra) {
        v.bubble.appendChild(ui.el('br'));
        var ex = ui.el('span', 'jp-extra');
        fillText(ex, q.extra);
        v.bubble.appendChild(ex);
      }
      v.talk.classList.add('on');
    } else {
      v.bubble.textContent = '';
      v.talk.classList.remove('on');
    }
    v.bubble.classList.toggle('good', !!(r && r.kind === 'good'));
    if (v.mood !== st.mood) {
      v.who.innerHTML = '';
      v.who.appendChild(ui.chara(st.mood));
      v.mood = st.mood;
    }
    for (var k = 0; k < v.dots.length; k++) v.dots[k].classList.toggle('on', k < st.solved);
    if (v.starsShown !== st.stars) {
      v.stars.innerHTML = '';
      for (var s = 0; s < st.stars; s++) v.stars.appendChild(ui.svg(ui.STAR, 'kk-star' + (s === st.stars - 1 && v.starsShown >= 0 ? ' pop' : '')));
      v.starsShown = st.stars;
    }
    v.next.classList.toggle('on', st.phase === 'feedback');
    v.body.classList.toggle('is-wait', st.phase !== 'question');
  }

  // viewBox を なめらかに動かす
  function animateBox(to) {
    var v = view;
    if (!v) return;
    var from = v.box.slice();
    if (from.join() === to.join()) return;
    v.box = to.slice();
    var reduce = false;
    try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
    var myAnim = v.anim = {};
    if (reduce || !window.requestAnimationFrame) { v.svg.setAttribute('viewBox', boxStr(to)); return; }
    // 始まりの時刻は いま にする（画面が かくれていて最初のコマが遅れても、遅れた分だけ進める）
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    function step(ts) {
      if (v.anim !== myAnim || view !== v) return;
      var k = Math.max(0, Math.min(1, (ts - t0) / ZOOM_MS));
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      v.svg.setAttribute('viewBox', boxStr(from.map(function (f, i) { return f + (to[i] - f) * e; })));
      if (k < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
    // 画面が かくれていて動きが止まったときでも、さいごは目的の枠にする
    U().later(function () { if (v.anim === myAnim && view === v) v.svg.setAttribute('viewBox', boxStr(to)); }, ZOOM_MS + 150);
  }

  /* ---------- 名物の絵（viewBox 0 0 64 64） ---------- */
  var ICONS = {
    potato: '<ellipse cx="32" cy="34" rx="22" ry="16" fill="#c99a5b"/><g fill="#8a6435"><circle cx="22" cy="30" r="2"/><circle cx="36" cy="26" r="2"/><circle cx="42" cy="40" r="2"/><circle cx="28" cy="42" r="2"/></g>',
    apple: '<circle cx="32" cy="36" r="20" fill="#e5484d"/><path d="M32 18v-8" stroke="#7a4a2a" stroke-width="3" stroke-linecap="round"/><path d="M33 14q10 -8 14 2q-10 4 -14 -2z" fill="#5aa055"/>',
    wanko: '<path d="M10 30h44q-2 20 -22 22q-20 -2 -22 -22z" fill="#c94f4f"/><path d="M16 30q8 -10 16 0q8 -10 16 0" stroke="#e8d8a8" stroke-width="5" fill="none"/>',
    kamaboko: '<rect x="8" y="42" width="48" height="8" rx="2" fill="#c99a5b"/><path d="M12 42q20 -30 40 0z" fill="#fff" stroke="#f28baa" stroke-width="4"/>',
    kiritanpo: '<path d="M14 54l36 -44" stroke="#a3764c" stroke-width="4" stroke-linecap="round"/><path d="M22 44l22 -27" stroke="#f0d79a" stroke-width="12" stroke-linecap="round"/><path d="M22 44l22 -27" stroke="#d9a34f" stroke-width="12" stroke-linecap="round" stroke-dasharray="2 6"/>',
    cherry: '<path d="M22 40q4 -20 18 -30q2 16 8 26" stroke="#5aa055" stroke-width="3" fill="none"/><circle cx="21" cy="44" r="10" fill="#d61f45"/><circle cx="46" cy="42" r="10" fill="#d61f45"/>',
    peach: '<circle cx="32" cy="36" r="20" fill="#ffb3b8"/><path d="M32 18q-6 18 0 36" stroke="#f28b93" stroke-width="3" fill="none"/><path d="M32 16q8 -8 14 0q-8 4 -14 0z" fill="#5aa055"/>',
    melon: '<circle cx="32" cy="34" r="20" fill="#9ad18b"/><path d="M16 26q16 10 32 0M14 36q18 8 36 0M20 46q12 6 24 0M24 16q-4 18 2 36M40 16q4 18 -2 36" stroke="#e8f4e0" stroke-width="2" fill="none"/>',
    strawberry: '<path d="M14 24q18 -6 36 0q-2 22 -18 32q-16 -10 -18 -32z" fill="#e5484d"/><path d="M18 22l6 -8 8 6 8 -6 6 8z" fill="#5aa055"/><g fill="#ffe08a"><circle cx="24" cy="32" r="1.6"/><circle cx="32" cy="38" r="1.6"/><circle cx="40" cy="32" r="1.6"/><circle cx="30" cy="46" r="1.6"/><circle cx="36" cy="28" r="1.6"/></g>',
    konnyaku: '<rect x="12" y="20" width="40" height="28" rx="6" fill="#8a8f99"/><g fill="#5b5f68"><circle cx="20" cy="28" r="1.6"/><circle cx="30" cy="36" r="1.6"/><circle cx="42" cy="26" r="1.6"/><circle cx="44" cy="40" r="1.6"/><circle cx="24" cy="42" r="1.6"/></g>',
    senbei: '<circle cx="32" cy="32" r="22" fill="#d9a34f"/><circle cx="32" cy="32" r="22" fill="none" stroke="#a8742c" stroke-width="3"/><path d="M18 30q14 -6 28 4" stroke="#6b4a2a" stroke-width="5" fill="none" stroke-linecap="round"/>',
    peanut: '<path d="M32 10c10 0 14 10 9 18c5 8 1 26 -9 26s-14 -18 -9 -26c-5 -8 -1 -18 9 -18z" fill="#e0c08a" stroke="#b8935a" stroke-width="2"/><path d="M24 22h16M23 40h18" stroke="#b8935a" stroke-width="2"/>',
    tower: '<path d="M32 4l6 52h-12z" fill="#9ccbea" stroke="#5aa9d4" stroke-width="2"/><rect x="26" y="22" width="12" height="5" rx="2" fill="#5aa9d4"/><rect x="25" y="34" width="14" height="4" rx="2" fill="#5aa9d4"/><path d="M12 58h40" stroke="#888" stroke-width="3"/>',
    chinatown: '<path d="M12 38q20 -24 40 0z" fill="#fff" stroke="#d9cbb5" stroke-width="2"/><path d="M14 38h36q-2 10 -18 10q-16 0 -18 -10z" fill="#f4ede0"/><path d="M28 18q4 -4 8 0" stroke="#d9cbb5" stroke-width="2" fill="none"/>',
    rice: '<path d="M10 32h44q-2 20 -22 22q-20 -2 -22 -22z" fill="#6fa3e4"/><path d="M12 32q20 -22 40 0z" fill="#fff" stroke="#e6e6e6" stroke-width="2"/>',
    tulip: '<path d="M32 56v-24" stroke="#5aa055" stroke-width="4"/><path d="M32 46q-14 -2 -16 -12q12 0 16 8" fill="#7cc28a"/><path d="M20 14l6 8 6 -10 6 10 6 -8q2 18 -12 20q-14 -2 -12 -20z" fill="#ff6b8a"/>',
    gold: '<rect x="14" y="14" width="36" height="36" rx="3" fill="#f2c94c" stroke="#d9a730" stroke-width="3"/><path d="M20 22l8 8M36 18l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" stroke="#fff" stroke-width="2" fill="#fff"/>',
    glasses: '<circle cx="20" cy="34" r="11" fill="#dff1fb" stroke="#3a3f4a" stroke-width="4"/><circle cx="44" cy="34" r="11" fill="#dff1fb" stroke="#3a3f4a" stroke-width="4"/><path d="M31 32q1 -3 2 0M9 30l-5 -4M55 30l5 -4" stroke="#3a3f4a" stroke-width="3" fill="none"/>',
    grape: '<path d="M32 12v-6" stroke="#7a4a2a" stroke-width="3"/><g fill="#7b4fa8"><circle cx="24" cy="18" r="7"/><circle cx="38" cy="18" r="7"/><circle cx="31" cy="28" r="7"/><circle cx="18" cy="28" r="7"/><circle cx="44" cy="28" r="7"/><circle cx="25" cy="38" r="7"/><circle cx="38" cy="38" r="7"/><circle cx="31" cy="48" r="7"/></g>',
    lettuce: '<circle cx="32" cy="36" r="20" fill="#9ad18b"/><path d="M16 30q16 -14 32 0M18 40q14 -10 28 0M32 18v34" stroke="#d6efc9" stroke-width="3" fill="none"/>',
    knife: '<path d="M8 40l34 -26q6 -2 6 4l-26 28z" fill="#d8dde3" stroke="#9aa3ad" stroke-width="2"/><path d="M22 46l-6 8q-4 4 -8 0q0 -4 4 -8z" fill="#6b4a2a"/>',
    piano: '<rect x="8" y="18" width="48" height="30" rx="3" fill="#fff" stroke="#3a3f4a" stroke-width="3"/><path d="M16 18v30M24 18v30M32 18v30M40 18v30M48 18v30" stroke="#3a3f4a" stroke-width="1.5"/><g fill="#3a3f4a"><rect x="13" y="18" width="5" height="17"/><rect x="21" y="18" width="5" height="17"/><rect x="37" y="18" width="5" height="17"/><rect x="45" y="18" width="5" height="17"/></g>',
    tea: '<path d="M12 26h34v10q0 16 -17 16q-17 0 -17 -16z" fill="#fff" stroke="#9aa3ad" stroke-width="2"/><ellipse cx="29" cy="27" rx="16" ry="4" fill="#7cb850"/><path d="M46 30q10 0 8 8q-2 6 -10 6" stroke="#9aa3ad" stroke-width="3" fill="none"/>',
    car: '<path d="M8 40v-6q2 -6 8 -6l6 -10h20l8 10q8 0 8 6v6z" fill="#e5484d"/><path d="M24 20h7v8h-12zM35 20h6l5 8h-11z" fill="#cfe9fb"/><circle cx="20" cy="42" r="6" fill="#3a3f4a"/><circle cx="46" cy="42" r="6" fill="#3a3f4a"/>',
    ninja: '<circle cx="32" cy="32" r="22" fill="#3a3f4a"/><rect x="14" y="26" width="36" height="10" rx="5" fill="#ffd9b8"/><circle cx="25" cy="31" r="2.5" fill="#3a3f4a"/><circle cx="39" cy="31" r="2.5" fill="#3a3f4a"/><path d="M50 24l10 -6M50 28l11 0" stroke="#3a3f4a" stroke-width="3" stroke-linecap="round"/>',
    lake: '<path d="M30 6q12 4 10 16q-2 10 -10 18q-6 8 -4 16q-10 -2 -10 -14q2 -12 8 -20q4 -8 6 -16z" fill="#7cc4ea" stroke="#5aa9d4" stroke-width="2"/>',
    kinkaku: '<path d="M10 22l22 -12 22 12z" fill="#d9a730"/><rect x="16" y="22" width="32" height="10" fill="#f2c94c"/><path d="M12 34h40l-4 -2h-32z" fill="#d9a730"/><rect x="14" y="34" width="36" height="14" fill="#f2c94c"/><path d="M6 52h52" stroke="#7cc4ea" stroke-width="5"/>',
    takoyaki: '<rect x="8" y="40" width="48" height="10" rx="3" fill="#c99a5b"/><g fill="#d9a34f" stroke="#a8742c" stroke-width="2"><circle cx="20" cy="34" r="9"/><circle cx="44" cy="34" r="9"/><circle cx="32" cy="30" r="9"/></g><path d="M14 30l8 4M38 30l8 4M26 26l8 4" stroke="#6b4a2a" stroke-width="3"/>',
    castle: '<path d="M14 26l18 -14 18 14z" fill="#5b6f8a"/><rect x="18" y="26" width="28" height="10" fill="#fff" stroke="#c8ccd2"/><path d="M10 38l22 -6 22 6z" fill="#5b6f8a"/><rect x="14" y="38" width="36" height="14" fill="#fff" stroke="#c8ccd2"/><rect x="28" y="44" width="8" height="8" fill="#5b6f8a"/>',
    deer: '<path d="M22 14l-4 -8M22 14l-8 -2M42 14l4 -8M42 14l8 -2" stroke="#8a6435" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="32" rx="12" ry="16" fill="#c99a5b"/><ellipse cx="18" cy="24" rx="6" ry="3" fill="#c99a5b"/><ellipse cx="46" cy="24" rx="6" ry="3" fill="#c99a5b"/><circle cx="27" cy="30" r="2" fill="#3a3a3a"/><circle cx="37" cy="30" r="2" fill="#3a3a3a"/><ellipse cx="32" cy="42" rx="4" ry="3" fill="#5b3a22"/>',
    mikan: '<circle cx="32" cy="36" r="20" fill="#f6a23c"/><path d="M32 16q8 -8 14 0q-8 4 -14 0z" fill="#5aa055"/><g fill="#e08a24"><circle cx="24" cy="30" r="1.5"/><circle cx="38" cy="38" r="1.5"/><circle cx="30" cy="44" r="1.5"/></g>',
    dune: '<rect width="64" height="64" rx="8" fill="#dcefff"/><path d="M0 46q16 -18 32 -6q16 -16 32 0v24h-64z" fill="#e8cf96"/><path d="M8 44q10 -6 20 0" stroke="#d1b06a" stroke-width="2" fill="none"/>',
    shrine: '<path d="M8 16q24 -6 48 0" stroke="#d64545" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M12 24h40" stroke="#d64545" stroke-width="5"/><path d="M18 18v38M46 18v38" stroke="#d64545" stroke-width="6"/>',
    kibi: '<path d="M32 58v-52" stroke="#c99a5b" stroke-width="3"/><g fill="#f0d79a" stroke="#d1b06a" stroke-width="2"><circle cx="32" cy="16" r="8"/><circle cx="32" cy="32" r="8"/><circle cx="32" cy="48" r="8"/></g>',
    oyster: '<path d="M12 40q2 -26 22 -28q18 2 18 18q-2 20 -24 22q-14 0 -16 -12z" fill="#b9bcc3" stroke="#7f848c" stroke-width="2"/><path d="M20 38q8 -16 22 -16M22 46q12 -10 24 -10" stroke="#7f848c" stroke-width="2" fill="none"/>',
    fugu: '<circle cx="30" cy="34" r="18" fill="#f2e6c8"/><path d="M12 34q18 -20 36 0" fill="#c9b78a"/><path d="M48 34l12 -8v16z" fill="#c9b78a"/><circle cx="22" cy="30" r="3" fill="#3a3a3a"/><path d="M14 38q4 2 6 0" stroke="#3a3a3a" stroke-width="2" fill="none"/>',
    awaodori: '<path d="M8 30q24 -30 48 0z" fill="#e8cf96" stroke="#c9a55a" stroke-width="2"/><circle cx="32" cy="40" r="10" fill="#ffd9b8"/><path d="M22 52h20l4 10h-28z" fill="#5aa0e0"/><path d="M14 46l-6 -8M50 46l6 -8" stroke="#ffd9b8" stroke-width="4" stroke-linecap="round"/>',
    udon: '<path d="M10 30h44q-2 22 -22 24q-20 -2 -22 -24z" fill="#f5f0e6" stroke="#c8b99a" stroke-width="2"/><path d="M14 30q6 -8 12 0q6 -8 12 0q6 -8 12 0" stroke="#fff" stroke-width="5" fill="none"/><path d="M14 30q6 -8 12 0q6 -8 12 0q6 -8 12 0" stroke="#e8dcc0" stroke-width="1.5" fill="none"/><path d="M44 10l-10 20M50 12l-12 18" stroke="#a3764c" stroke-width="3"/>',
    towel: '<rect x="12" y="14" width="40" height="36" rx="4" fill="#fff" stroke="#9ccbea" stroke-width="3"/><path d="M12 22h40M12 42h40" stroke="#5aa9d4" stroke-width="3"/><path d="M16 50v4M24 50v4M32 50v4M40 50v4M48 50v4" stroke="#9ccbea" stroke-width="2"/>',
    katsuo: '<path d="M6 32q16 -16 40 -4l12 -8v24l-12 -8q-24 12 -40 -4z" fill="#4f6e9a"/><path d="M16 34q14 6 30 -2" stroke="#cfdbe8" stroke-width="3" fill="none"/><circle cx="14" cy="30" r="2.5" fill="#fff"/>',
    mentaiko: '<rect x="8" y="42" width="48" height="8" rx="3" fill="#fff" stroke="#ddd"/><path d="M12 40q4 -18 20 -16q14 2 10 16z" fill="#e8607a"/><path d="M30 40q4 -14 16 -12q10 2 6 12z" fill="#f07a90"/>',
    nori: '<rect x="14" y="10" width="36" height="44" rx="2" fill="#1f3b2a"/><path d="M20 18h24M20 28h24M20 38h24" stroke="#2f5a40" stroke-width="2"/>',
    castella: '<rect x="10" y="22" width="44" height="26" rx="2" fill="#f6d36b"/><rect x="10" y="18" width="44" height="7" rx="2" fill="#8a5a2a"/><path d="M24 22v26M40 22v26" stroke="#e5be4f" stroke-width="2"/>',
    tomato: '<circle cx="32" cy="36" r="20" fill="#e5484d"/><path d="M32 16l4 6 7 -2 -4 6 6 4 -8 0 -5 6 -5 -6 -8 0 6 -4 -4 -6 7 2z" fill="#5aa055"/>',
    onsen: '<path d="M10 44q22 20 44 0q-2 -8 -22 -8q-20 0 -22 8z" fill="#7cc4ea"/><path d="M22 34q-6 -8 0 -14q6 -6 0 -14M32 32q-6 -8 0 -14q6 -6 0 -14M42 34q-6 -8 0 -14q6 -6 0 -14" stroke="#e5484d" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    mango: '<path d="M18 44q-6 -22 14 -30q20 -6 22 14q2 22 -18 26q-14 2 -18 -10z" fill="#f6a23c"/><path d="M22 40q-2 -14 12 -22" stroke="#e5484d" stroke-width="5" fill="none" opacity=".6"/><path d="M44 16q6 -8 10 -4" stroke="#5aa055" stroke-width="3" fill="none"/>',
    satsumaimo: '<path d="M8 40q8 -18 30 -20q16 0 20 8q-6 16 -28 20q-16 2 -22 -8z" fill="#9a4a8a"/><path d="M58 28l4 -4M8 40l-4 4" stroke="#9a4a8a" stroke-width="3" stroke-linecap="round"/><path d="M22 34l4 4M36 30l4 4" stroke="#7a3a6c" stroke-width="2"/>',
    pineapple: '<path d="M24 18l-6 -12 10 8 4 -12 4 12 10 -8 -6 12z" fill="#5aa055"/><ellipse cx="32" cy="40" rx="15" ry="20" fill="#f2c94c"/><path d="M20 30l24 20M44 30l-24 20M18 40l14 12M46 40l-14 12M24 22l18 16M40 22l-18 16" stroke="#d9a730" stroke-width="1.5"/>'
  };

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var q = st.q;
    return {
      phase: st.phase, level: st.level, kind: q ? q.kind : null, scope: q ? q.scope : null,
      target: q ? q.target : null, itemId: q ? q.itemId : null,
      choices: q ? q.choices.map(function (c) { return { id: c.id, text: c.text }; }) : [],
      tried: st.attempt ? st.attempt.tried.slice() : [], misses: st.attempt ? st.attempt.misses : 0,
      shown: !!(st.attempt && st.attempt.shown),
      result: st.result ? st.result.kind : null, zoom: st.zoom,
      waiting: !!pendingFn, solved: st.solved, stars: st.stars,
      colored: Object.keys(st.colored), plan: st.plan.slice()
    };
  }

  B.japanScreen = {
    show: show,
    _pick: function (id) { pick(id); },
    _tap: function (id) { tapMap(id); },
    _zoom: setZoom,
    _next: flush,
    _again: againRound,
    _state: state,
    _icons: ICONS
  };
})();
