/* かんじの問題画面（3つの選択肢・学年えらび・ごほうび画面）。Chiid.benkyo.kanjiScreen
   出題・判定は Chiid.kanji（subjects/kanji.js）、部品は Chiid.benkyo.ui（main.js）を使う。
   見た目は九九の画面（kk-* のクラス）にそろえ、かんじだけの所は kj-* のクラス。
   記録は1問につき1件：1回目で正解なら true、それ以外（まちがえてから正解・こたえを見た）は false。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CORRECT = 1300;   // 正解のあと、次の問題までの時間（ms）
  var WAIT_REVEAL = 3000;    // こたえを見せたあと、次の問題までの時間（ms）
  var GRADES = [null, 1, 2]; // じどう／1ねんせい／2ねんせい
  var GRADE_TEXT = { auto: 'じどう', 1: '1ねんせい', 2: '2ねんせい' };

  var st = null;             // いまの区切りの状態
  var view = null;           // 描画している要素（テストでは null）
  var pendingFn = null;      // 正解/こたえのあと、次へ進む処理
  var pendSeq = 0;

  function K() { return C.kanji; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function speak(text) { if (drawing()) U().speak(text); }
  function gradeText(g) { return g == null ? GRADE_TEXT.auto : GRADE_TEXT[g]; }

  /* ---------- 開く ---------- */
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = {
      profileId: pid, level: 1, recent: [], missCounts: {},
      grade: null,            // null=じどう、1/2=その学年の字だけ（保存しない）
      item: null, attempt: null, picked: null, revealed: false, lastK: null,
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
    var q = K().pickItem({ level: st.level, grade: st.grade, missCounts: st.missCounts, lastK: st.lastK }, st.rng);
    st.item = q;
    st.lastK = q.k;
    st.attempt = K().newAttempt();
    st.picked = null;
    st.revealed = false;
    st.phase = 'question';
    st.message = '';
    st.mood = 'normal';
    paint(true);
    speak(K().speakText(q));
  }

  /* ---------- 選ぶ ---------- */
  function choose(choice) {
    if (!st || st.phase !== 'question') return;
    var r = K().submit(st.attempt, st.item, choice);
    if (r.kind === 'empty') return;                // 押せない選択肢・空は、何も起きない
    var q = st.item;
    st.picked = String(choice);
    if (r.kind === 'correct') {
      st.message = 'せいかい！';
      st.mood = 'happy';
      play('correct');
      finish(st.attempt.tries === 0);
      speak('せいかい！');
      wait(WAIT_CORRECT);
    } else if (r.kind === 'retry') {
      st.message = 'もういっかい やってみよう！';
      st.mood = 'think';
      play('oops');
      paint();
      speak('もういっかい、やってみよう！');
    } else {                                       // reveal：こたえをそっと見せて次へ
      st.revealed = true;
      st.message = 'こたえは 「' + q.ans + '」 だよ。つぎは できるよ！';
      st.mood = 'normal';
      play('oops');
      finish(false);
      speak(q.kind === 'yomi'
        ? 'こたえは ' + q.ans + ' だよ。 つぎは できるよ！'
        : 'こたえは これだよ。 つぎは できるよ！');
      wait(WAIT_REVEAL);
    }
  }

  function log(correct) {
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: K().AREA, itemId: st.item.id, correct: correct, level: st.level, grade: st.grade });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[st.item.id] = (st.missCounts[st.item.id] || 0) + 1;
    // レベルは、じどうのときだけ動かす。学年をえらんだ練習では変えない
    if (st.grade === null) {
      st.recent.push(correct);
      var nl = C.adaptive.nextLevel(st.recent, st.level, K().MAX_LEVEL);
      if (nl !== st.level) { st.level = nl; st.recent = []; }
    }
  }

  // 1問おわり：記録（1問1件）・苦手・レベル・星
  function finish(correct) {
    log(correct);
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

  /* ---------- 学年を えらぶ ---------- */
  function selectGrade(g) {
    if (!st) return;
    g = g == null || g === '' ? null : Number(g);
    if (g !== null && g !== 1 && g !== 2) return;
    // 1回まちがえた問題を取りかえるときは、まちがいとして記録する（苦手に数える）。進み具合は変えない
    if (st.phase === 'question' && st.attempt && st.attempt.tries > 0) log(false);
    st.grade = g;
    if (st.phase === 'question') {
      st.lastK = null;
      nextQuestion();                 // いまの問題を、えらんだ学年の問題に取りかえる（記録しない）
    } else {
      paint();                        // 正解/こたえの表示中なら、次の問題から
    }
  }

  /* ---------- ごほうび（10問の区切り） ---------- */
  function showReward() {
    st.phase = 'reward';
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('kanji-reward');
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
    again.appendChild(ui.el('span', null, 'もういっかい'));
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
    var app = ui.newScreen('kanji');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app, grades: [], choices: [] };

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
    // 学年えらび：ふつうは横並び。低い横向きでは、ボタンで開く（九九の段えらびと同じ）
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
    var grades = ui.el('div', 'kk-dans kj-grades');
    grades.setAttribute('role', 'group');
    grades.setAttribute('aria-label', 'がくねんを えらぶ');
    GRADES.forEach(function (g) {
      var b = ui.button('kk-dan auto kj-grade', function () {
        ui.play('tap');
        app.classList.remove('dan-open');
        selectGrade(g);
      });
      b.textContent = gradeText(g);
      b.setAttribute('aria-label', g === null ? 'じどう' : gradeText(g) + 'の かんじ');
      b.setAttribute('data-grade', g === null ? 'auto' : String(g));
      v.grades.push({ g: g, el: b });
      grades.appendChild(b);
    });
    mid.appendChild(toggle);
    mid.appendChild(grades);
    bar.insertBefore(mid, right);
    app.appendChild(bar);
    var back = ui.el('div', 'kk-dan-back');
    back.addEventListener('click', function () { app.classList.remove('dan-open'); });
    app.appendChild(back);

    var body = ui.el('div', 'kk-body');
    var q = ui.el('div', 'kk-q');
    var card = ui.el('div', 'kj-card');
    card.setAttribute('aria-live', 'polite');
    v.big = ui.el('div', 'kj-big');
    v.ex = ui.el('div', 'kj-ex');
    card.appendChild(v.big);
    card.appendChild(v.ex);
    q.appendChild(card);
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

    var pad = ui.el('div', 'kj-choices');
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'こたえを えらぶ');
    for (var c = 0; c < K().CHOICES; c++) {
      (function (idx) {
        var b = ui.button('kj-choice', function () { onChoice(idx); });
        v.choices.push(b);
        pad.appendChild(b);
      })(c);
    }
    body.appendChild(pad);
    app.appendChild(body);
    v.body = body;
    v.mood = null;
    v.starsShown = -1;
    view = v;
  }

  // 画面のボタンから。正解/こたえの表示中は、どれを押しても早めに次へ
  function onChoice(idx) {
    if (pendingFn) { flush(); return; }
    if (!st || !st.item) return;
    choose(st.item.choices[idx]);
  }

  // 例の言葉を、□ の所だけ強調して並べる。s: □ に入れる文字（null なら □ のまま）
  function exNodes(ui, box, ex, s) {
    box.innerHTML = '';
    var parts = String(ex).split('□');
    box.appendChild(document.createTextNode(parts[0]));
    box.appendChild(ui.el('span', s == null ? 'kj-slot' : 'kj-mark', s == null ? '' : s));
    box.appendChild(document.createTextNode(parts.slice(1).join('□')));
  }

  function paint(fresh) {
    if (!view || !st || !st.item || !drawing()) return;
    var ui = U(), v = view, q = st.item;
    var done = st.phase !== 'question';
    // 上：よみは字を大きく＋例の言葉（字入り）。かきは読みを大きく＋例の言葉（□）
    if (fresh || v.qid !== q.id + q.r) {
      v.big.textContent = q.kind === 'yomi' ? q.k : q.r;
      v.big.className = 'kj-big' + (q.kind === 'kaki' ? ' kana' : '');
      v.qid = q.id + q.r;
    }
    if (q.kind === 'yomi') exNodes(ui, v.ex, q.ex, q.k);
    else exNodes(ui, v.ex, q.ex, done ? q.k : null);
    v.ex.classList.toggle('done', done);
    for (var c = 0; c < v.choices.length; c++) {
      var b = v.choices[c], s = q.choices[c];
      b.textContent = s;
      b.className = 'kj-choice' + (q.kind === 'kaki' ? ' kanji' : ' kana') +
        (st.attempt.wrong.indexOf(s) >= 0 ? ' out' : '') +
        (done && s === q.ans ? (st.revealed ? ' reveal' : ' right') : '');
      b.setAttribute('aria-label', s);
      b.disabled = false;
    }
    v.bubble.textContent = st.message || (q.kind === 'yomi' ? 'よみかたを えらんでね' : 'かんじを えらんでね');
    v.bubble.classList.toggle('good', st.mood === 'happy');
    if (v.mood !== st.mood) {
      v.who.innerHTML = '';
      v.who.appendChild(ui.chara(st.mood));
      v.mood = st.mood;
    }
    for (var i = 0; i < v.dots.length; i++) v.dots[i].classList.toggle('on', i < st.solved);
    if (v.starsShown !== st.stars) {
      v.stars.innerHTML = '';
      for (var n = 0; n < st.stars; n++) {
        v.stars.appendChild(ui.svg(ui.STAR, 'kk-star' + (n === st.stars - 1 && v.starsShown >= 0 ? ' pop' : '')));
      }
      v.starsShown = st.stars;
    }
    v.body.classList.toggle('is-wait', done);
    v.grades.forEach(function (d) {
      var on = d.g === st.grade;
      d.el.classList.toggle('on', on);
      d.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    v.toggleText.textContent = gradeText(st.grade);
    v.toggle.setAttribute('aria-label', 'がくねんを えらぶ（いまは ' + v.toggleText.textContent + '）');
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var q = st.item;
    return {
      phase: st.phase,
      id: q ? q.id : null, k: q ? q.k : null, kind: q ? q.kind : null, r: q ? q.r : null,
      ans: q ? q.ans : null, choices: q ? q.choices.slice() : [],
      tries: st.attempt ? st.attempt.tries : 0, wrong: st.attempt ? st.attempt.wrong.slice() : [],
      message: st.message, revealed: st.revealed,
      grade: st.grade, solved: st.solved, stars: st.stars, level: st.level
    };
  }

  B.kanjiScreen = {
    show: show,
    // テスト用：表示中の待ちがあれば先に進めてから選ぶ
    _choose: function (choice) {
      if (pendingFn) flush();
      choose(String(choice));
    },
    _flush: flush,
    _selectGrade: selectGrade,
    _again: againRound,
    _state: state
  };
})();
