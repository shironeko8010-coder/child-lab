/* 九九の問題画面（数字ボタン・段選択・ごほうび画面）。Chiid.benkyo.kukuScreen
   出題・判定は Chiid.kuku（subjects/kuku.js）、部品は Chiid.benkyo.ui（main.js）を使う。
   記録は1問につき1件：1回目で正解なら true、それ以外（まちがえてから正解・こたえを見た）は false。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CORRECT = 1300;   // 正解のあと、次の式までの時間（ms）
  var WAIT_REVEAL = 3000;    // こたえを見せたあと、次の式までの時間（ms）
  var MAX_DIGITS = 2;        // 九九の答えは最大81
  var KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

  var st = null;             // いまの区切りの状態
  var view = null;           // 描画している要素（テストでは null）
  var pendingFn = null;      // 正解/こたえのあと、次へ進む処理
  var pendSeq = 0;

  function K() { return C.kuku; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function speak(text) { if (drawing()) U().speak(text); }

  /* ---------- 開く ---------- */
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = {
      profileId: pid, level: 1, recent: [], missCounts: {},
      mode: (ctx.mode === "blank" ? "blank" : "mul"),   // "mul"=A×B=□ / "blank"=A×□=C
      dan: null,              // null=じどう、1〜9=そのだんだけ（保存しない）
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
        var p = K().progressFromLogs(logs, st.mode);
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
    var item = K().pickItem({ level: st.level, onlyDan: st.dan, missCounts: st.missCounts, lastId: st.lastId }, st.rng);
    st.item = K().question(item, st.mode);
    st.lastId = item.id;
    st.attempt = K().newAttempt();
    st.input = '';
    st.revealed = false;
    st.phase = 'question';
    st.message = '';
    st.mood = 'normal';
    paint();
    speak(K().speakText(st.item, st.mode));
  }

  /* ---------- 数字ボタン ---------- */
  function press(key) {
    if (!st || st.phase !== 'question') return;
    if (/^[0-9]$/.test(key)) {
      if (st.input.length >= K().digitsOf(st.mode)) return;   // こたえの桁数で止める
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
      var p = C.storage.logAnswer({ profileId: st.profileId, area: K().areaOf(st.mode), itemId: item.id, correct: correct, level: st.level, dan: st.dan });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[item.id] = (st.missCounts[item.id] || 0) + 1;
    // レベル（じどうで開く段）は、じどうのときだけ動かす。段をえらんだ練習では変えない
    if (st.dan === null) {
      st.recent.push(correct);
      var nl = C.adaptive.nextLevel(st.recent, st.level, K().MAX_LEVEL);
      if (nl !== st.level) { st.level = nl; st.recent = []; }
    }
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

  /* ---------- だんを えらぶ ---------- */
  function selectDan(n) {
    if (!st) return;
    n = n == null || n === '' ? null : Number(n);
    if (n !== null && !(n >= 1 && n <= 9)) return;
    // 1回まちがえた式を取りかえるときは、まちがいとして記録する（苦手に数える）。進み具合・レベルは変えない
    if (st.phase === "question" && st.attempt && st.attempt.tries > 0) logMissOnly();
    st.dan = n;
    if (st.phase === 'question') {
      st.lastId = null;
      nextQuestion();                 // いまの式を、えらんだ段の式に取りかえる（記録しない）
    } else {
      paint();                        // 正解/こたえの表示中なら、次の式から
    }
  }

  function logMissOnly() {
    var item = st.item;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: K().areaOf(st.mode), itemId: item.id, correct: false, level: st.level, dan: st.dan });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    st.missCounts[item.id] = (st.missCounts[item.id] || 0) + 1;
    // じどうの記録はレベル計算に使われるので、開き直したときと同じになるよう画面内でも数える
    if (st.dan === null) {
      st.recent.push(false);
      var nl = C.adaptive.nextLevel(st.recent, st.level, K().MAX_LEVEL);
      if (nl !== st.level) { st.level = nl; st.recent = []; }
    }
  }

  /* ---------- ごほうび（10問の区切り） ---------- */
  function showReward() {
    st.phase = 'reward';
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('kuku-reward');
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
    var app = ui.newScreen('kuku');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app, dans: [] };

    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    if (hasVoice) {
      var sp = ui.button('icon-btn kk-speak', function () {
        if (st && st.item) { ui.play('tap'); ui.speak(K().speakText(st.item, st.mode)); }
      });
      sp.setAttribute('aria-label', 'もういちど きく');
      sp.appendChild(ui.svg(ui.ICO.speaker));
      right.insertBefore(sp, right.firstChild);
    }
    // 段選択：ふつうは横並び。低い横向きでは「だん」ボタンで開く
    var mid = ui.el('div', 'kk-mid');
    var toggle = ui.button('kk-dan-toggle', function () {
      ui.play('tap');
      app.classList.toggle('dan-open');
    });
    toggle.setAttribute('aria-haspopup', 'true');
    v.toggleText = ui.el('span', 'kk-dt-text');
    toggle.appendChild(v.toggleText);
    toggle.appendChild(ui.el('span', 'kk-dt-caret', '▼'));
    v.toggle = toggle;
    var dans = ui.el('div', 'kk-dans');
    dans.setAttribute('role', 'group');
    dans.setAttribute('aria-label', 'だんを えらぶ');
    [null, 1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (n) {
      var b = ui.button('kk-dan' + (n === null ? ' auto' : ''), function () {
        ui.play('tap');
        app.classList.remove('dan-open');
        selectDan(n);
      });
      if (n === null) {
        ui.fillR(b, '{自|じ}どう');
        b.setAttribute('aria-label', 'じどう');
      } else {
        b.appendChild(ui.el('b', null, String(n)));
        b.appendChild(ui.el('small', null, 'のだん'));
        b.setAttribute('aria-label', n + 'のだん だけ');
      }
      b.setAttribute('data-dan', n === null ? 'auto' : String(n));
      v.dans.push({ n: n, el: b });
      dans.appendChild(b);
    });
    mid.appendChild(toggle);
    mid.appendChild(dans);
    bar.insertBefore(mid, right);
    app.appendChild(bar);
    var back = ui.el('div', 'kk-dan-back');
    back.addEventListener('click', function () { app.classList.remove('dan-open'); });
    app.appendChild(back);

    var body = ui.el('div', 'kk-body');
    var q = ui.el('div', 'kk-q');
    var expr = ui.el('div', 'kk-expr');
    expr.setAttribute('aria-live', 'polite');
    v.a = ui.el('span', 'kk-num');
    v.b = ui.el('span', 'kk-num');
    v.ans = ui.el('span', 'kk-ans');
    expr.appendChild(v.a);
    expr.appendChild(ui.el('span', 'kk-op', '×'));
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
    var blank = st.mode === "blank";
    var shown = st.input !== "" ? st.input : "?";
    var slotCls = "kk-ans" + (st.input === "" ? " empty" : "") +
      (st.revealed ? " reveal" : "") + (st.phase === "feedback" && !st.revealed ? " right" : "");
    // 答えを入れる場所：九九はあと（A×B=□）、□はB（A×□=C）
    v.a.textContent = it.a;
    v.b.textContent = blank ? shown : it.b;
    v.ans.textContent = blank ? it.prod : shown;
    v.b.className = blank ? slotCls : "kk-num";
    v.ans.className = blank ? "kk-num" : slotCls;
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
    v.dans.forEach(function (d) {
      var on = d.n === st.dan;
      d.el.classList.toggle('on', on);
      d.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    ui.fillR(v.toggleText, st.dan === null ? '{自|じ}どう' : st.dan + 'のだん');
    v.toggle.setAttribute('aria-label', 'だんを えらぶ（いまは ' + (st.dan === null ? 'じどう' : st.dan + 'のだん') + '）');
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var it = st.item;
    return {
      phase: st.phase,
      id: it ? it.id : null, a: it ? it.a : null, b: it ? it.b : null, ans: it ? it.ans : null,
      mode: st.mode,
      expr: !it ? '' : st.mode === 'blank'
        ? it.a + ' × ' + (st.revealed ? it.ans : '?') + ' = ' + it.prod
        : it.a + ' × ' + it.b + ' = ' + (st.revealed ? it.ans : '?'),
      input: st.input, tries: st.attempt ? st.attempt.tries : 0, message: st.message,
      dan: st.dan, solved: st.solved, stars: st.stars, level: st.level
    };
  }

  B.kukuScreen = {
    show: show,
    // テスト用：表示中の待ちがあれば先に進めてから押す（「こたえる」なら進めるだけ）
    _press: function (key) {
      if (pendingFn) { flush(); if (key === 'ok') return; }
      press(String(key));
    },
    _flush: flush,
    _selectDan: selectDan,
    _again: againRound,
    _state: state
  };
})();
