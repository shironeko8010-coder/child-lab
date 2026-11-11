/* けいさん（たし算・ひき算）の問題画面とごほうび画面。Chiid.benkyo.keisanScreen
   出題・判定は Chiid.keisan（subjects/keisan.js）、部品は Chiid.benkyo.ui（main.js）を使う。
   見た目は九九の画面（kk-* のクラス）と同じ。段選択はなし（じどうのみ）。
   記録は1問につき1件：1回目で正解なら true、それ以外（まちがえてから正解・こたえを見た）は false。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CORRECT = 1300;   // 正解のあと、次の式までの時間（ms）
  var WAIT_REVEAL = 3000;    // こたえを見せたあと、次の式までの時間（ms）
  var KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

  var st = null;             // いまの区切りの状態
  var view = null;           // 描画している要素（テストでは null）
  var pendingFn = null;      // 正解/こたえのあと、次へ進む処理
  var pendSeq = 0;

  function K() { return C.keisan; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function speak(text) { if (drawing()) U().speak(text); }
  function opText(op) { return op === '+' ? '+' : '−'; }

  /* ---------- 開く ---------- */
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = {
      profileId: pid, level: 1, recent: [], missCounts: {},
      item: null, attempt: null, input: '', revealed: false, lastId: null,
      solved: 0, stars: 0, phase: 'loading', message: '', mood: 'normal',
      rng: ctx.rng || Math.random
    };
    pendingFn = null;
    view = null;
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        if (st !== run) return;            // あいだに別の画面で開き直した
        var p = K().progressFromLogs(logs);
        st.level = p.level;
        st.recent = p.recent;
        st.missCounts = p.missCounts;
        startRound();
      });
  }

  function startRound() {
    st.solved = 0;
    st.stars = 0;
    pendingFn = null;
    buildScreen();
    nextQuestion();
  }

  function nextQuestion() {
    st.item = K().pickItem({ level: st.level, missCounts: st.missCounts, lastId: st.lastId }, st.rng);
    st.lastId = st.item.id;
    st.attempt = K().newAttempt();
    st.input = '';
    st.revealed = false;
    st.phase = 'question';
    st.message = '';
    st.mood = 'normal';
    paint();
    speak(K().speakText(st.item));
  }

  /* ---------- 数字ボタン ---------- */
  function press(key) {
    if (!st || st.phase !== 'question') return;
    if (/^[0-9]$/.test(key)) {
      if (st.input.length >= K().MAX_DIGITS) return;
      st.input += key;
      play('tap');
      paint();
      return;
    }
    if (key === 'del') {
      if (st.input === '') return;
      st.input = st.input.slice(0, -1);
      play('tap');
      paint();
      return;
    }
    if (key !== 'ok') return;
    var r = K().submit(st.attempt, st.item, st.input);
    if (r.kind === 'empty') return;                // 空は間違いに数えない。何も起きない
    var ans = st.item.ans;
    if (r.kind === 'correct') {
      st.message = '正かい！';
      st.mood = 'happy';
      play('correct');
      finish(st.attempt.tries === 0);
      speak('せいかい！');
      wait(WAIT_CORRECT);
    } else if (r.kind === 'retry') {
      st.input = '';
      st.message = 'もう{一回|いっかい} やってみよう！';
      st.mood = 'think';
      play('oops');
      paint();
      speak('もういっかい、やってみよう！');
    } else {                                       // reveal：こたえをそっと見せて次へ
      st.input = String(ans);
      st.revealed = true;
      st.message = '{答|こた}えは ' + ans + ' だよ。つぎは できるよ！';
      st.mood = 'normal';
      play('oops');
      finish(false);
      speak('こたえは ' + ans + ' だよ。 つぎは できるよ！');
      wait(WAIT_REVEAL);
    }
  }

  // 1問おわり：記録（1問1件）・苦手・レベル・星
  function finish(correct) {
    var item = st.item;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: K().AREA, itemId: item.id, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[item.id] = (st.missCounts[item.id] || 0) + 1;
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, K().MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.solved++;
    st.phase = 'feedback';
    if (st.solved % K().STAR_EVERY === 0) {
      st.stars++;
      if (drawing()) U().later(function () { play('star'); }, 450);
    }
    paint();
  }

  /* ---------- 次へ（問題と問題のあいだ） ---------- */
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
    if (st.solved >= K().ROUND_SIZE) { showReward(); return; }
    if (restNow()) return;
    nextQuestion();
  }
  // 利用時間を確かめる。超えていたら（お休み画面は main.js が出す）止まる
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
    var app = ui.newScreen('keisan-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < st.stars; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', 'よく がんばったね！'));
    info.appendChild(ui.el('p', 'kk-r-sub', K().ROUND_SIZE + 'もん できたよ'));
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

  /* ---------- 描画 ---------- */
  function buildScreen() {
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('keisan');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app };

    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    if (hasVoice) {
      var sp = ui.button('icon-btn kk-speak', function () {
        if (st && st.item) { ui.play('tap'); ui.speak(K().speakText(st.item)); }
      });
      sp.setAttribute('aria-label', 'もういちど きく');
      sp.appendChild(ui.svg(ui.ICO.speaker));
      right.insertBefore(sp, right.firstChild);
    }
    app.appendChild(bar);

    var body = ui.el('div', 'kk-body');
    var q = ui.el('div', 'kk-q');
    var expr = ui.el('div', 'kk-expr ks-expr');
    expr.setAttribute('aria-live', 'polite');
    v.a = ui.el('span', 'kk-num');
    v.op = ui.el('span', 'kk-op');
    v.b = ui.el('span', 'kk-num');
    v.ans = ui.el('span', 'kk-ans');
    expr.appendChild(v.a);
    expr.appendChild(v.op);
    expr.appendChild(v.b);
    expr.appendChild(ui.el('span', 'kk-op', '='));
    expr.appendChild(v.ans);
    q.appendChild(expr);
    var talk = ui.el('div', 'kk-talk');
    v.who = ui.el('div', 'kk-who');
    talk.appendChild(v.who);
    v.bubble = ui.bubble('');
    v.bubble.classList.add('kk-msg');
    v.bubble.setAttribute('aria-live', 'polite');
    talk.appendChild(v.bubble);
    q.appendChild(talk);
    var prog = ui.el('div', 'kk-prog');
    v.dots = [];
    var dots = ui.el('div', 'kk-dots');
    for (var i = 0; i < K().ROUND_SIZE; i++) {
      var d = ui.el('span', 'kk-dot');
      v.dots.push(d);
      dots.appendChild(d);
    }
    prog.appendChild(dots);
    v.stars = ui.el('div', 'kk-stars');
    prog.appendChild(v.stars);
    q.appendChild(prog);
    body.appendChild(q);

    var pad = ui.el('div', 'kk-pad');
    KEYS.forEach(function (k) {
      var cls = 'kk-key' + (k === 'del' ? ' del' : k === 'ok' ? ' ok' : '');
      var b = ui.button(cls, function () { onKey(k); });
      ui.fillR(b, k === 'del' ? 'けす' : k === 'ok' ? '{答|こた}える' : String(k));
      b.setAttribute('data-key', k);
      pad.appendChild(b);
    });
    body.appendChild(pad);
    app.appendChild(body);
    v.body = body;
    v.mood = null;
    v.starsShown = -1;
    view = v;
  }

  // 画面のボタンから。正解/こたえの表示中は「こたえる」で早めに次へ、数字は効かない
  function onKey(k) {
    if (pendingFn) { if (k === 'ok') flush(); return; }
    press(k);
  }

  function paint() {
    if (!view || !st || !st.item || !drawing()) return;
    var ui = U(), v = view, it = st.item;
    v.a.textContent = it.a;
    v.op.textContent = opText(it.op);
    v.b.textContent = it.b;
    v.ans.textContent = st.input !== '' ? st.input : '?';
    v.ans.className = 'kk-ans' + (st.input === '' ? ' empty' : '') +
      (st.revealed ? ' reveal' : '') + (st.phase === 'feedback' && !st.revealed ? ' right' : '');
    ui.fillR(v.bubble, st.message || '{数字|すうじ}を おして {答|こた}えてね');
    v.bubble.classList.toggle('good', st.mood === 'happy');
    if (v.mood !== st.mood) {
      v.who.innerHTML = '';
      v.who.appendChild(ui.chara(st.mood));
      v.mood = st.mood;
    }
    for (var i = 0; i < v.dots.length; i++) v.dots[i].classList.toggle('on', i < st.solved);
    if (v.starsShown !== st.stars) {
      v.stars.innerHTML = '';
      for (var s = 0; s < st.stars; s++) {
        v.stars.appendChild(ui.svg(ui.STAR, 'kk-star' + (s === st.stars - 1 && v.starsShown >= 0 ? ' pop' : '')));
      }
      v.starsShown = st.stars;
    }
    v.body.classList.toggle('is-wait', st.phase !== 'question');
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var it = st.item;
    return {
      phase: st.phase,
      id: it ? it.id : null, a: it ? it.a : null, b: it ? it.b : null, op: it ? it.op : null, ans: it ? it.ans : null,
      expr: it ? it.a + ' ' + opText(it.op) + ' ' + it.b + ' = ' + (st.revealed ? it.ans : '?') : '',
      input: st.input, tries: st.attempt ? st.attempt.tries : 0, message: st.message,
      solved: st.solved, stars: st.stars, level: st.level
    };
  }

  B.keisanScreen = {
    show: show,
    // テスト用：表示中の待ちがあれば先に進めてから押す（「こたえる」なら進めるだけ）
    _press: function (key) {
      if (pendingFn) { flush(); if (key === 'ok') return; }
      press(String(key));
    },
    _flush: flush,
    _again: againRound,
    _state: state
  };
})();
