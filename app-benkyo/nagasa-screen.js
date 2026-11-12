/* 長さ・かさの問題画面とごほうび画面。Chiid.benkyo.nagasaScreen
   出題・判定は Chiid.nagasa（subjects/nagasa.js）、部品は Chiid.benkyo.ui（main.js）を使う。
   流れ・記録・星・ごほうびは けいさん（keisan-screen.js）と同じ。数字ボタンも同じ（kk-pad）。
   記録は1問につき1件：1回目で正解なら true、それ以外は false。2回目のまちがいで答えを見せる。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CORRECT = 1300;   // 正解のあと、次の問題までの時間（ms）
  var WAIT_REVEAL = 3000;    // 答えを見せたあと、次の問題までの時間（ms）
  var KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  var MSG_START = '{数字|すうじ}を おして {答|こた}えてね';
  var MSG_START_UNIT = '正しい たんいを えらんでね';
  var MSG_RETRY = 'もう{一回|いっかい} やってみよう！';
  var MSG_RIGHT = '正かい！';

  var st = null;
  var view = null;
  var pendingFn = null;
  var pendSeq = 0;

  function N() { return C.nagasa; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function speak(text) { if (drawing()) U().speak(text); }

  /* ---------- 開く ---------- */
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = {
      profileId: pid, level: 1, recent: [], missCounts: {}, kindCounts: {},
      q: null, attempt: null, input: [], active: 0, picked: '', revealed: false, lastId: null,
      solved: 0, stars: 0, phase: 'loading', message: '', mood: 'normal',
      rng: ctx.rng || Math.random
    };
    pendingFn = null;
    view = null;
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        if (st !== run) return;
        var p = N().progressFromLogs(logs);
        st.level = p.level;
        st.recent = p.recent;
        st.missCounts = p.missCounts;
        startRound();
      });
  }

  function startRound() {
    st.solved = 0;
    st.stars = 0;
    st.kindCounts = {};
    pendingFn = null;
    buildScreen();
    nextQuestion();
  }

  function emptyInput() { return st.q.boxes.map(function () { return ''; }); }

  function nextQuestion() {
    st.q = N().pickQuestion({ level: st.level, missCounts: st.missCounts, lastId: st.lastId, kindCounts: st.kindCounts }, st.rng);
    st.lastId = st.q.id;
    st.kindCounts[st.q.kind] = (st.kindCounts[st.q.kind] || 0) + 1;
    st.attempt = N().newAttempt();
    st.input = emptyInput();
    st.active = 0;
    st.picked = '';
    st.revealed = false;
    st.phase = 'question';
    st.message = st.q.kind === 'unit' ? MSG_START_UNIT : MSG_START;
    st.mood = 'normal';
    paint();
    speak(N().speakText(st.q));
  }

  /* ---------- 入力 ---------- */
  function tapBox(i) {
    if (!st || st.phase !== 'question' || i < 0 || i >= st.input.length) return;
    st.active = i;
    play('tap');
    paint();
  }
  function press(key) {
    if (!st || st.phase !== 'question' || st.q.kind === 'unit') return;
    var cur = st.input[st.active] || '';
    if (/^[0-9]$/.test(key)) {
      if (cur.length >= N().MAX_DIGITS) return;
      st.input[st.active] = cur + key;
      play('tap');
      paint();
      return;
    }
    if (key === 'del') {
      if (cur === '') return;
      st.input[st.active] = cur.slice(0, -1);
      play('tap');
      paint();
      return;
    }
    if (key === 'ok') judge(st.input.slice());
  }
  function pick(unit) {
    if (!st || st.phase !== 'question' || st.q.kind !== 'unit') return;
    st.picked = unit;
    judge(unit);
  }

  function judge(input) {
    var r = N().submit(st.attempt, st.q, input);
    if (r.kind === 'empty') {                      // 空は数えない。空いている箱へ うつして知らせる
      if (st.q.kind !== 'unit') {
        for (var i = 0; i < st.input.length; i++) if (st.input[i] === '') { st.active = i; break; }
        play('tap');
        paint();
      }
      return;
    }
    if (r.kind === 'correct') {
      st.message = MSG_RIGHT;
      st.mood = 'happy';
      play('correct');
      finish(st.attempt.tries === 0);
      speak('せいかい！');
      wait(WAIT_CORRECT);
    } else if (r.kind === 'retry') {
      st.input = emptyInput();
      st.active = 0;
      st.picked = '';
      st.message = MSG_RETRY;
      st.mood = 'think';
      play('oops');
      paint();
      speak('もういっかい、やってみよう！');
    } else {                                       // reveal：答えを見せて次へ
      st.input = st.q.answer.map(String);
      st.revealed = true;
      st.message = '{答|こた}えは ' + answerShown(st.q) + ' だよ。つぎは できるよ！';
      st.mood = 'normal';
      play('oops');
      finish(false);
      speak(N().answerText(st.q));
      wait(WAIT_REVEAL);
    }
  }
  // 画面に出す答え（例：3cm5mm、500mL）。0 の単位は出さない（全部 0 のときは 0 を出す）
  function answerShown(q) {
    if (q.kind === 'unit') return q.show.item.n + q.show.item.unit;
    var s = q.answer.map(function (n, i) { return n > 0 ? n + q.boxes[i] : ''; }).join('');
    return s || ('0' + q.boxes[q.boxes.length - 1]);
  }

  // 1問おわり：記録（1問1件）・苦手・レベル・星
  function finish(correct) {
    var q = st.q;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: N().AREA, itemId: q.id, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[q.id] = (st.missCounts[q.id] || 0) + 1;
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, N().MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.solved++;
    st.phase = 'feedback';
    if (st.solved % N().STAR_EVERY === 0) {
      st.stars++;
      if (drawing()) U().later(function () { play('star'); }, 450);
    }
    paint();
  }

  /* ---------- 次へ ---------- */
  function wait(ms) {
    pendingFn = goNext;
    var my = ++pendSeq;
    if (drawing()) U().later(function () { if (my === pendSeq) flush(); }, ms);
  }
  function flush() {
    if (!pendingFn) return;
    var f = pendingFn;
    pendingFn = null;
    pendSeq++;
    f();
  }
  function goNext() {
    if (st.solved >= N().ROUND_SIZE) { showReward(); return; }
    if (restNow()) return;
    nextQuestion();
  }
  function restNow() {
    var over = false;
    try { over = typeof B.checkRest === 'function' && B.checkRest(); } catch (e) { over = false; }
    if (over) { st.phase = 'rest'; view = null; }
    return over;
  }

  /* ---------- ごほうび（10問の区切り） ---------- */
  function showReward() {
    st.phase = 'reward';
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('nagasa-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < st.stars; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', 'よく がんばったね！'));
    info.appendChild(ui.el('p', 'kk-r-sub', N().ROUND_SIZE + 'もん できたよ'));
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
    ui.speak('よく がんばったね！ ほしが ' + st.stars + 'こ');
  }
  function againRound() {
    if (!st || st.phase !== 'reward') return;
    if (restNow()) return;
    startRound();
  }

  /* ---------- 絵（SVG） ---------- */
  // ものさしとテープ。目もりが細かくなりすぎないよう、ものさしは テープ＋1cm（5〜15cm）だけ見せる
  function rulerCm(mm) { return Math.min(15, Math.max(5, Math.ceil(mm / 10) + 1)); }
  function rulerSvg(mm, glow) {
    var cmMax = rulerCm(mm), X0 = 20, PX = 600 / (cmMax * 10), s = '<svg class="ng-ruler" viewBox="0 0 640 150" aria-hidden="true">';
    s += '<rect x="' + X0 + '" y="20" width="' + (mm * PX) + '" height="38" rx="4" fill="#f4a261" stroke="#b5651d" stroke-width="2"/>';
    s += '<rect x="6" y="60" width="628" height="84" rx="8" fill="#fdf0d5" stroke="#b08440" stroke-width="2"/>';
    for (var i = 0; i <= cmMax * 10; i++) {
      var x = X0 + i * PX, h = i % 10 === 0 ? 32 : (i % 5 === 0 ? 22 : 12);
      s += '<line x1="' + x + '" y1="60" x2="' + x + '" y2="' + (60 + h) + '" stroke="#5a3d10" stroke-width="' + (i % 10 === 0 ? 2 : 1) + '"/>';
      if (i % 10 === 0) s += '<text x="' + x + '" y="124" text-anchor="middle" font-size="22" font-weight="bold" fill="#5a3d10">' + (i / 10) + '</text>';
    }
    s += '<text x="620" y="138" text-anchor="end" font-size="16" fill="#7a5a20">cm</text>';
    if (glow) s += '<line class="ng-glow" x1="' + (X0 + mm * PX) + '" y1="6" x2="' + (X0 + mm * PX) + '" y2="100" stroke="#ff5a1f" stroke-width="5" stroke-linecap="round"/>';
    return s + '</svg>';
  }
  // 1Lます（目もり10）。dL の数だけ水を入れる
  function cupSvg(dl, glow) {
    var H = 150, top = 20, wy = top + H - H * dl / 10;
    var s = '<svg class="ng-cup" viewBox="0 0 100 190" aria-hidden="true">';
    s += '<text x="50" y="14" text-anchor="middle" font-size="14" fill="#1d5f8c">1L</text>';
    if (dl > 0) s += '<rect x="11" y="' + wy + '" width="78" height="' + (top + H - wy) + '" fill="#9fd3f2"/>';
    s += '<rect x="10" y="' + top + '" width="80" height="' + H + '" fill="none" stroke="#1d5f8c" stroke-width="3"/>';
    for (var i = 1; i < 10; i++) {
      var y = top + H - H * i / 10;
      s += '<line x1="10" y1="' + y + '" x2="' + (i === 5 ? 40 : 28) + '" y2="' + y + '" stroke="#1d5f8c" stroke-width="1.5"/>';
    }
    if (glow && dl > 0) s += '<line class="ng-glow" x1="4" y1="' + wy + '" x2="96" y2="' + wy + '" stroke="#ff5a1f" stroke-width="5" stroke-linecap="round"/>';
    return s + '</svg>';
  }
  function volHtml(dl, glow) {
    var full = Math.floor(dl / 10), rest = dl % 10, s = '';
    for (var i = 0; i < full; i++) s += cupSvg(10, false);
    if (rest > 0 || full === 0) s += cupSvg(rest, glow);
    return s;
  }

  /* ---------- 描画 ---------- */
  function buildScreen() {
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('nagasa');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app, qid: null, picKey: null, mood: null, starsShown: -1 };

    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    if (hasVoice) {
      var sp = ui.button('icon-btn kk-speak', function () {
        if (st && st.q) { ui.play('tap'); ui.speak(N().speakText(st.q)); }
      });
      sp.setAttribute('aria-label', 'もういちど きく');
      sp.appendChild(ui.svg(ui.ICO.speaker));
      right.insertBefore(sp, right.firstChild);
    }
    app.appendChild(bar);

    var body = ui.el('div', 'ng-body');
    var left = ui.el('div', 'ng-left');
    v.pic = ui.el('div', 'ng-pic');
    left.appendChild(v.pic);
    v.boxes = ui.el('div', 'ng-boxes');
    left.appendChild(v.boxes);
    var talk = ui.el('div', 'kk-talk');
    v.who = ui.el('div', 'kk-who');
    talk.appendChild(v.who);
    v.bubble = ui.bubble('');
    v.bubble.classList.add('kk-msg');
    v.bubble.setAttribute('aria-live', 'polite');
    talk.appendChild(v.bubble);
    left.appendChild(talk);
    var prog = ui.el('div', 'kk-prog');
    v.dots = [];
    var dots = ui.el('div', 'kk-dots');
    for (var i = 0; i < N().ROUND_SIZE; i++) {
      var d = ui.el('span', 'kk-dot');
      v.dots.push(d);
      dots.appendChild(d);
    }
    prog.appendChild(dots);
    v.stars = ui.el('div', 'kk-stars');
    prog.appendChild(v.stars);
    left.appendChild(prog);
    body.appendChild(left);

    var side = ui.el('div', 'ng-side');
    v.pad = ui.el('div', 'kk-pad');
    KEYS.forEach(function (k) {
      var cls = 'kk-key' + (k === 'del' ? ' del' : k === 'ok' ? ' ok' : '');
      var b = ui.button(cls, function () { onKey(k); });
      ui.fillR(b, k === 'del' ? 'けす' : k === 'ok' ? '{答|こた}える' : String(k));
      b.setAttribute('data-key', k);
      v.pad.appendChild(b);
    });
    side.appendChild(v.pad);
    v.units = ui.el('div', 'ng-units');
    side.appendChild(v.units);
    body.appendChild(side);
    app.appendChild(body);
    v.body = body;
    view = v;
  }

  // 正解/答えの表示中は「こたえる」で早めに次へ、ほかは効かない
  function onKey(k) {
    if (pendingFn) { if (k === 'ok') flush(); return; }
    press(k);
  }
  function onUnit(u) {
    if (pendingFn) return;
    pick(u);
  }

  function paint() {
    if (!view || !st || !st.q || !drawing()) return;
    var ui = U(), v = view, q = st.q;
    // 絵：問題が変わったとき・答えを見せたときだけ描き直す
    var key = q.id + (st.revealed ? ':r' : '');
    if (v.picKey !== key) {
      v.picKey = key;
      v.pic.className = 'ng-pic k-' + q.kind;
      if (q.kind === 'readLen') v.pic.innerHTML = rulerSvg(q.show.mm, st.revealed);
      else if (q.kind === 'readVol') v.pic.innerHTML = volHtml(q.show.dl, st.revealed);
      else if (q.kind === 'convert') {
        v.pic.innerHTML = '';
        v.pic.appendChild(ui.el('span', 'ng-from', q.show.from.map(function (x) { return x[0] + x[1]; }).join('') + ' ＝'));
      } else {
        v.pic.innerHTML = '';
        var t = ui.el('div', 'ng-item');
        ui.fillR(t, q.show.item.text);
        v.pic.appendChild(t);
        v.pic.appendChild(ui.el('div', 'ng-item-n', q.show.item.n + (st.revealed ? q.show.item.unit : '□')));
      }
    }
    if (v.qid !== q.id) {
      v.qid = q.id;
      v.units.innerHTML = '';
      (q.choices || []).forEach(function (u) {
        var b = ui.button('ng-unit', function () { onUnit(u); });
        b.textContent = u;
        b.setAttribute('data-unit', u);
        v.units.appendChild(b);
      });
      v.body.classList.toggle('is-unit', q.kind === 'unit');
    }
    // 答えの箱
    v.boxes.innerHTML = '';
    q.boxes.forEach(function (u, i) {
      var b = ui.button('ng-box' + (i === st.active && st.phase === 'question' ? ' on' : '') + (st.input[i] === '' ? ' empty' : '') +
        (st.revealed ? ' reveal' : '') + (st.phase === 'feedback' && !st.revealed ? ' right' : ''), function () { tapBox(i); });
      b.textContent = st.input[i] !== '' ? st.input[i] : '?';
      b.setAttribute('aria-label', u + 'の はこ');
      v.boxes.appendChild(b);
      v.boxes.appendChild(ui.el('span', 'ng-u', u));
    });
    Array.prototype.forEach.call(v.units.children, function (b) {
      var u = b.getAttribute('data-unit');
      b.classList.toggle('right', st.phase === 'feedback' && u === q.show.item.unit);
      b.classList.toggle('tried', st.phase === 'question' && st.attempt.tries > 0 && u === st.picked);
    });
    ui.fillR(v.bubble, st.message);
    v.bubble.classList.toggle('good', st.mood === 'happy');
    if (v.mood !== st.mood) {
      v.who.innerHTML = '';
      v.who.appendChild(ui.chara(st.mood));
      v.mood = st.mood;
    }
    for (var i = 0; i < v.dots.length; i++) v.dots[i].classList.toggle('on', i < st.solved);
    if (v.starsShown !== st.stars) {
      v.stars.innerHTML = '';
      for (var s = 0; s < st.stars; s++) v.stars.appendChild(ui.svg(ui.STAR, 'kk-star' + (s === st.stars - 1 && v.starsShown >= 0 ? ' pop' : '')));
      v.starsShown = st.stars;
    }
    v.body.classList.toggle('is-wait', st.phase !== 'question');
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var q = st.q;
    return {
      phase: st.phase, id: q ? q.id : null, kind: q ? q.kind : null,
      boxes: q ? q.boxes.slice() : [], answer: q ? q.answer.slice() : [], choices: q && q.choices ? q.choices.slice() : null,
      unit: q && q.kind === 'unit' ? q.show.item.unit : null,
      input: st.input.slice(), active: st.active, revealed: st.revealed,
      tries: st.attempt ? st.attempt.tries : 0, message: st.message,
      solved: st.solved, stars: st.stars, level: st.level
    };
  }

  B.nagasaScreen = {
    show: show,
    _press: function (key) {
      if (pendingFn) { flush(); if (key === 'ok') return; }
      press(String(key));
    },
    _key: onKey,       // 画面の数字ボタンと同じ道すじ（待ちの間は「こたえる」以外は効かない）
    _tap: tapBox,
    _pick: function (u) { if (pendingFn) flush(); pick(u); },
    _flush: flush,
    _again: againRound,
    _state: state
  };
})();
