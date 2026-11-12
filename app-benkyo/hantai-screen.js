/* はんたい ことばの問題画面とごほうび画面。Chiid.benkyo.hantaiScreen
   出題・判定は Chiid.hantai（subjects/hantai.js）、部品は Chiid.benkyo.ui（main.js）を使う。
   流れ・記録・星・ごほうびは 長さ・かさ（nagasa-screen.js）と同じ。
   記録は1問につき1件：1回目で正解なら true、それ以外は false。2回目のまちがいで答えを見せて「つぎへ」。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CORRECT = 1300;   // 正解のあと、次の問題までの時間（ms）
  var MSG_START = '正しい ものを えらんでね';
  var MSG_RETRY = 'もう{一回|いっかい} やってみよう！';
  var MSG_RIGHT = '正かい！';

  var st = null;
  var view = null;
  var pendingFn = null;
  var pendSeq = 0;

  function H() { return C.hantai; }
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
      q: null, tries: 0, tried: [], revealed: false, lastId: null,
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
        var p = H().progressFromLogs(logs);
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
    st.q = H().pickQuestion({ level: st.level, missCounts: st.missCounts, lastId: st.lastId }, st.rng);
    st.lastId = st.q.id;
    st.tries = 0;
    st.tried = [];
    st.revealed = false;
    st.phase = 'question';
    st.message = MSG_START;
    st.mood = 'normal';
    paint();
    speak(H().speakText(st.q));
  }

  /* ---------- 答える ---------- */
  function choose(i) {
    if (!st || st.phase !== 'question' || i < 0 || i > 3 || st.tried.indexOf(i) >= 0) return;
    if (H().check(st.q, i)) {
      st.message = MSG_RIGHT;
      st.mood = 'happy';
      play('correct');
      finish(st.tries === 0);
      speak('せいかい！');
      wait(WAIT_CORRECT);
      return;
    }
    st.tries++;
    st.tried.push(i);
    if (st.tries < 2) {
      st.message = MSG_RETRY;
      st.mood = 'think';
      play('oops');
      paint();
      speak('もういっかい、やってみよう！');
      return;
    }
    // 2回目のまちがい：答えを見せて「つぎへ」を待つ
    st.revealed = true;
    st.message = '{答|こた}えは「' + st.q.choices[st.q.answer].t + '」だよ。つぎは できるよ！';
    st.mood = 'normal';
    play('oops');
    finish(false);
    st.phase = 'reveal';
    pendingFn = goNext;
    pendSeq++;
    paint();
    speak(H().answerText(st.q));
  }

  // 1問おわり：記録（1問1件）・苦手・レベル・星
  function finish(correct) {
    var q = st.q;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: H().AREA, itemId: q.id, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[q.id] = (st.missCounts[q.id] || 0) + 1;
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, H().MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.solved++;
    st.phase = 'feedback';
    if (st.solved % H().STAR_EVERY === 0) {
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
    if (st.solved >= H().ROUND_SIZE) { showReward(); return; }
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
    var app = ui.newScreen('hantai-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < st.stars; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', 'よく がんばったね！'));
    info.appendChild(ui.el('p', 'kk-r-sub', H().ROUND_SIZE + 'もん できたよ'));
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
    var app = ui.newScreen('hantai');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app, qid: null, mood: null, starsShown: -1 };

    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    if (hasVoice) {
      var sp = ui.button('icon-btn kk-speak', function () {
        if (st && st.q && st.phase === 'question') { ui.play('tap'); ui.speak(H().speakText(st.q)); }
      });
      sp.setAttribute('aria-label', 'もういちど きく');
      sp.appendChild(ui.svg(ui.ICO.speaker));
      right.insertBefore(sp, right.firstChild);
    }
    app.appendChild(bar);

    var body = ui.el('div', 'ht-body');
    v.ask = ui.el('div', 'ht-ask');
    body.appendChild(v.ask);
    var talk = ui.el('div', 'kk-talk ht-talk');
    v.who = ui.el('div', 'kk-who');
    talk.appendChild(v.who);
    v.bubble = ui.bubble('');
    v.bubble.classList.add('kk-msg');
    v.bubble.setAttribute('aria-live', 'polite');
    talk.appendChild(v.bubble);
    body.appendChild(talk);
    v.choices = ui.el('div', 'ht-choices');
    body.appendChild(v.choices);
    var foot = ui.el('div', 'ht-foot');
    var prog = ui.el('div', 'kk-prog');
    v.dots = [];
    var dots = ui.el('div', 'kk-dots');
    for (var i = 0; i < H().ROUND_SIZE; i++) {
      var d = ui.el('span', 'kk-dot');
      v.dots.push(d);
      dots.appendChild(d);
    }
    prog.appendChild(dots);
    v.stars = ui.el('div', 'kk-stars');
    prog.appendChild(v.stars);
    foot.appendChild(prog);
    v.next = ui.button('btn-big ht-next', function () { ui.play('tap'); flush(); });
    v.next.appendChild(ui.svg(ui.ICO.next || ui.ICO.play));
    v.next.appendChild(ui.el('span', null, 'つぎへ'));
    foot.appendChild(v.next);
    body.appendChild(foot);
    app.appendChild(body);
    v.body = body;
    view = v;
  }

  // 問題：ことばは「」で大きく、文は ことばの部分を太字に
  function paintAsk(v, q) {
    var ui = U();
    v.ask.innerHTML = '';
    v.ask.className = 'ht-ask k-' + q.kind;
    if (q.kind === 'word') {
      v.ask.appendChild(ui.elR('span', 'ht-word', '「' + q.ask.t + '」'));
      v.ask.appendChild(ui.el('span', 'ht-ask-tail', 'の はんたいは？'));
      return;
    }
    var s = H().SENTENCES.filter(function (x) { return 's:' + x.id === q.id; })[0];
    var line = ui.el('span', 'ht-sentence');
    line.appendChild(ui.elR('span', null, s.pre));
    line.appendChild(ui.elR('b', null, s.word.t));
    line.appendChild(ui.elR('span', null, s.post));
    v.ask.appendChild(line);
    v.ask.appendChild(ui.elR('span', 'ht-ask-tail', 'はんたいの 文は どれ？'));
  }

  function paint() {
    if (!view || !st || !st.q || !drawing()) return;
    var ui = U(), v = view, q = st.q;
    if (v.qid !== q.id) {
      v.qid = q.id;
      paintAsk(v, q);
      v.choices.innerHTML = '';
      v.choices.className = 'ht-choices k-' + q.kind;
      q.choices.forEach(function (c, i) {
        var b = ui.button('ht-choice', function () { choose(i); });
        ui.fillR(b, c.t);
        v.choices.appendChild(b);
      });
    }
    Array.prototype.forEach.call(v.choices.children, function (b, i) {
      b.classList.toggle('tried', st.tried.indexOf(i) >= 0 && !(st.revealed && i === q.answer));
      b.classList.toggle('right', (st.phase === 'feedback' || st.phase === 'reveal') && i === q.answer);
      b.disabled = st.tried.indexOf(i) >= 0;
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
    v.next.style.visibility = st.phase === 'reveal' ? 'visible' : 'hidden';
    v.body.classList.toggle('is-wait', st.phase !== 'question');
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var q = st.q;
    return {
      phase: st.phase, id: q ? q.id : null, kind: q ? q.kind : null, level: q ? q.level : st.level,
      answer: q ? q.answer : -1, tried: st.tried.slice(), tries: st.tries, revealed: st.revealed,
      message: st.message, solved: st.solved, stars: st.stars
    };
  }

  B.hantaiScreen = {
    show: show,
    _choose: function (i) { if (pendingFn && st.phase !== 'reveal') flush(); choose(i); },
    _next: flush,
    _flush: flush,
    _again: againRound,
    _state: state
  };
})();
