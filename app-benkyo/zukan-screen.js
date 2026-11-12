/* ずかんの画面。Chiid.benkyo.zukanScreen
   テーマ選び → 図鑑のページ（読み上げ）→「よめた！」→ 問題2問 → カード → 3ページで ごほうび。
   「わたしのずかん」はテーマ選びの画面からだけ開く。
   しくみは Chiid.zukan、中身は Chiid.zukanData、絵は Chiid.zukanArt、部品は Chiid.benkyo.ui（main.js）。
   記録は1ページにつき1件（2問とも1回目で正解なら true）。#app が無いとき（テスト）は描画せず、状態だけを動かす。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CORRECT = 1300;   // 正解のあと、次へ進むまで（ms）
  var MSG_START = '正しい ものを えらんでね';
  var MSG_RETRY = 'もう{一回|いっかい} やってみよう！';
  var MSG_RIGHT = '正かい！';

  var st = null;
  var view = null;
  var pendingFn = null;
  var pendSeq = 0;

  function Z() { return C.zukan; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function speak(text) { if (drawing()) U().speak(text); }
  function item() { return st.quiz[st.qIndex]; }

  /* ---------- 開く ---------- */
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = {
      profileId: pid, cards: {}, theme: null, usedIds: [], pagesDone: 0,
      page: null, quiz: null, qIndex: 0, tries: 0, tried: [], revealed: false, allFirst: true,
      got: null, bookTheme: null, bookPageId: null, phase: 'loading', message: '', mood: 'normal',
      rng: ctx.rng || Math.random
    };
    pendingFn = null;
    view = null;
    var sid = B.ui && B.ui.screenId ? B.ui.screenId() : null;   // 記録を読むあいだに ほかの画面へ行ったら、開かない
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        if (st !== run) return;
        if (sid !== null && B.ui.screenId() !== sid) { st = null; return; }
        st.cards = Z().cardsFromLogs(logs);
        goThemes();
      });
  }

  /* ---------- テーマ選び ---------- */
  function goThemes() {
    pendingFn = null;
    st.phase = 'themes';
    st.page = null;
    renderThemes();
  }
  function startTheme(id) {
    if (!Z().themeById(id)) return;
    st.theme = id;
    st.usedIds = [];
    st.pagesDone = 0;
    nextPage();
  }

  /* ---------- ページ ---------- */
  function nextPage() {
    pendingFn = null;
    if (restNow()) return;
    st.page = Z().pickPage(st.theme, st.cards, st.usedIds, st.rng);
    st.usedIds.push(st.page.id);
    st.quiz = Z().makeQuiz(st.page, st.rng);
    st.qIndex = 0;
    st.allFirst = true;
    st.got = null;
    st.phase = 'page';
    renderPage();
    speak(st.page.text);
  }
  function ready() {
    if (!st || st.phase !== 'page') return;
    startQuestion(true);
  }

  /* ---------- 問題 ---------- */
  function startQuestion(build) {
    st.tries = 0;
    st.tried = [];
    st.revealed = false;
    st.phase = 'quiz';
    st.message = MSG_START;
    st.mood = 'normal';
    if (build) renderQuiz(); else paintQuiz(true);
    speak(item().ask);
  }
  function choose(i) {
    if (!st || st.phase !== 'quiz' || i < 0 || i > 3 || st.tried.indexOf(i) >= 0) return;
    if (Z().check(item(), i)) {
      st.phase = 'feedback';
      st.message = MSG_RIGHT;
      st.mood = 'happy';
      play('correct');
      paintQuiz(false);
      speak('せいかい！');
      wait(WAIT_CORRECT, afterQuestion);
      return;
    }
    st.tries++;
    st.tried.push(i);
    st.allFirst = false;
    play('oops');
    if (st.tries < 2) {
      st.message = MSG_RETRY;
      st.mood = 'think';
      paintQuiz(false);
      speak('もういっかい、やってみよう！');
      return;
    }
    // 2回目のまちがい：答えを見せて「つぎへ」を待つ
    st.phase = 'reveal';
    st.revealed = true;
    st.message = '{答|こた}えは「' + item().choices[item().answer] + '」だよ。つぎは できるよ！';
    st.mood = 'normal';
    pendingFn = afterQuestion;
    pendSeq++;
    paintQuiz(false);
    speak(Z().answerText(item()));
  }
  function afterQuestion() {
    if (st.qIndex === 0) { st.qIndex = 1; startQuestion(false); return; }
    finishPage();
  }

  /* ---------- カード ---------- */
  function finishPage() {
    var p = st.page, kira = st.allFirst;
    try {
      var r = C.storage.logAnswer({ profileId: st.profileId, area: Z().AREA, itemId: p.id, correct: kira, level: 1 });
      if (r && r.catch) r.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    var had = st.cards[p.id];
    if (kira) st.cards[p.id] = 'kira';
    else if (!had) st.cards[p.id] = 'card';
    // got：'kira'（きらきら）／'card'（ふつう）／'keep'（前から きらきら。今回まちがえても そのまま）
    st.got = kira ? 'kira' : (had === 'kira' ? 'keep' : 'card');
    st.pagesDone++;
    st.phase = 'card';
    pendingFn = afterCard;
    pendSeq++;
    renderCard();
    play('star');
    speak(gotText());
  }
  function gotText() { return st.got === 'kira' ? Z().TEXT.kira : st.got === 'keep' ? Z().TEXT.keep : Z().TEXT.card; }
  function afterCard() {
    if (st.pagesDone >= Z().PAGES_PER_ROUND) { showReward(); return; }
    nextPage();
  }

  /* ---------- 次へ・お休み ---------- */
  function wait(ms, fn) {
    pendingFn = fn;
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
  function restNow() {
    var over = false;
    try { over = typeof B.checkRest === 'function' && B.checkRest(); } catch (e) { over = false; }
    if (over) { st.phase = 'rest'; view = null; }
    return over;
  }

  /* ---------- ごほうび ---------- */
  function showReward() {
    st.phase = 'reward';
    pendingFn = null;
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('zukan-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', 'よく がんばったね！'));
    info.appendChild(ui.el('p', 'kk-r-sub', Z().PAGES_PER_ROUND + 'ページ よんだよ'));
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
      goThemes();
    });
    end.appendChild(ui.el('span', null, 'おわる'));
    btns.appendChild(again);
    btns.appendChild(end);
    info.appendChild(btns);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak('よく がんばったね！');
  }
  function againRound() {
    if (!st || st.phase !== 'reward') return;
    startTheme(st.theme);
  }

  /* ---------- わたしのずかん ---------- */
  function openBook(themeId) {
    pendingFn = null;
    st.phase = 'book';
    st.bookPageId = null;
    st.bookTheme = themeId || st.bookTheme || st.theme || C.zukanData.THEMES[0].id;
    renderBook();
  }
  function openCard(id) {
    if (!st || st.phase !== 'book' || !st.cards[id]) return;
    st.phase = 'bookPage';
    st.bookPageId = id;
    renderBookPage();
    speak(Z().pageById(id).text);
  }
  function back() {
    if (!st) return;
    if (st.phase === 'bookPage') { openBook(st.bookTheme); return; }
    if (st.phase === 'themes') { if (typeof B.showHome === 'function' && drawing()) B.showHome(); return; }
    goThemes();
  }

  /* ---------- 描画 ---------- */
  function picNode(p, cls) {
    var ui = U();
    var box = ui.el('div', cls);
    if (p.art) box.innerHTML = C.zukanArt[p.art] || '';
    else box.appendChild(ui.el('span', 'zk-emoji', p.pic));
    return box;
  }
  function backBtn(label) {
    var ui = U();
    var b = ui.button('btn-big secondary zk-back', function () { ui.play('tap'); back(); });
    b.appendChild(ui.el('span', null, label || 'もどる'));
    return b;
  }

  function renderThemes() {
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('zukan');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'zk-themes-body');
    body.appendChild(ui.elR('h1', 'zk-title', 'どの ずかんを {読|よ}む？'));
    var grid = ui.el('div', 'zk-themes');
    C.zukanData.THEMES.forEach(function (t) {
      var n = Z().countFor(t.id, st.cards);
      var b = ui.button('zk-theme', function () { ui.play('tap'); startTheme(t.id); });
      b.setAttribute('data-theme', t.id);
      b.appendChild(ui.el('span', 'zk-theme-ico', t.icon));
      b.appendChild(ui.elR('span', 'zk-theme-name', t.name));
      var cnt = ui.el('span', 'zk-theme-count', n.got + '/' + n.total);
      if (n.kira) cnt.appendChild(ui.el('span', 'zk-kira-n', ' ✨' + n.kira));
      b.appendChild(cnt);
      grid.appendChild(b);
    });
    body.appendChild(grid);
    var book = ui.button('btn-big zk-book-btn', function () { ui.play('tap'); openBook(); });
    book.appendChild(ui.el('span', null, '📖 わたしの ずかん'));
    body.appendChild(book);
    app.appendChild(body);
  }

  function renderPage() {
    view = null;
    if (!drawing()) return;
    var ui = U(), p = st.page;
    var app = ui.newScreen('zukan');
    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    var sp = ui.button('icon-btn kk-speak', function () { if (st.phase === 'page') { ui.play('tap'); ui.speak(p.text); } });
    sp.setAttribute('aria-label', 'もういちど きく');
    sp.appendChild(ui.svg(ui.ICO.speaker));
    if (right) right.insertBefore(sp, right.firstChild);
    app.appendChild(bar);
    var body = ui.el('div', 'zk-page');
    body.appendChild(picNode(p, 'zk-pic'));
    var side = ui.el('div', 'zk-page-side');
    side.appendChild(ui.elR('h2', 'zk-name', p.name));
    side.appendChild(ui.elR('p', 'zk-text', p.text));
    var go = ui.button('btn-big zk-ready', function () {
      if (go.disabled) return;
      go.disabled = true;
      ui.play('tap');
      try { C.voice.cancel(); } catch (e) {}
      ready();
    });
    go.appendChild(ui.elR('span', null, Z().TEXT.ready));
    side.appendChild(go);
    body.appendChild(side);
    app.appendChild(body);
    app.appendChild(progress(ui));
  }

  function progress(ui) {
    var prog = ui.el('div', 'zk-prog');
    for (var i = 0; i < Z().PAGES_PER_ROUND; i++) prog.appendChild(ui.el('span', 'kk-dot' + (i < st.pagesDone ? ' on' : '')));
    return prog;
  }

  function renderQuiz() {
    view = null;
    if (!drawing()) return;
    var ui = U(), p = st.page;
    var app = ui.newScreen('zukan');
    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    var sp = ui.button('icon-btn kk-speak', function () {
      if (st.phase === 'quiz') { ui.play('tap'); ui.speak(item().ask); }
      else if (st.phase === 'reveal') { ui.play('tap'); ui.speak(Z().answerText(item())); }
    });
    sp.setAttribute('aria-label', 'もういちど きく');
    sp.appendChild(ui.svg(ui.ICO.speaker));
    if (right) right.insertBefore(sp, right.firstChild);
    app.appendChild(bar);
    var body = ui.el('div', 'zk-quiz');
    var head = ui.el('div', 'zk-q-head');
    head.appendChild(picNode(p, 'zk-pic small'));
    var v = { qno: ui.el('span', 'zk-qno'), ask: ui.el('div', 'zk-ask') };
    var qbox = ui.el('div', 'zk-q-text');
    qbox.appendChild(v.qno);
    qbox.appendChild(v.ask);
    head.appendChild(qbox);
    body.appendChild(head);
    var talk = ui.el('div', 'kk-talk zk-talk');
    v.who = ui.el('div', 'kk-who');
    talk.appendChild(v.who);
    v.bubble = ui.bubble('');
    v.bubble.classList.add('kk-msg');
    talk.appendChild(v.bubble);
    body.appendChild(talk);
    v.choices = ui.el('div', 'zk-choices');
    body.appendChild(v.choices);
    var foot = ui.el('div', 'zk-foot');
    foot.appendChild(progress(ui));
    v.next = ui.button('btn-big zk-next', function () { ui.play('tap'); flush(); });
    v.next.appendChild(ui.svg(ui.ICO.next || ui.ICO.play));
    v.next.appendChild(ui.el('span', null, 'つぎへ'));
    foot.appendChild(v.next);
    body.appendChild(foot);
    app.appendChild(body);
    v.body = body;
    view = v;
    paintQuiz(true);
  }

  function paintQuiz(rebuild) {
    if (!view || !drawing()) return;
    var ui = U(), v = view, it = item();
    if (rebuild) {
      v.qno.textContent = (st.qIndex + 1) + 'もんめ';
      ui.fillR(v.ask, it.ask);
      v.choices.innerHTML = '';
      it.choices.forEach(function (c, i) {
        var b = ui.button('zk-choice', function () { choose(i); });
        ui.fillR(b, c);
        v.choices.appendChild(b);
      });
    }
    Array.prototype.forEach.call(v.choices.children, function (b, i) {
      b.classList.toggle('tried', st.tried.indexOf(i) >= 0);
      b.classList.toggle('right', (st.phase === 'feedback' || st.phase === 'reveal') && i === it.answer);
      b.disabled = st.tried.indexOf(i) >= 0;
    });
    ui.fillR(v.bubble, st.message);
    v.bubble.classList.toggle('good', st.mood === 'happy');
    v.who.innerHTML = '';
    v.who.appendChild(ui.chara(st.mood));
    v.next.style.visibility = st.phase === 'reveal' ? 'visible' : 'hidden';
    v.body.classList.toggle('is-wait', st.phase !== 'quiz');
  }

  function renderCard() {
    view = null;
    if (!drawing()) return;
    var ui = U(), p = st.page;
    var app = ui.newScreen('zukan');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'zk-get');
    var card = ui.el('div', 'zk-card big' + (st.got === 'card' ? '' : ' kira'));
    card.appendChild(picNode(p, 'zk-card-pic'));
    card.appendChild(ui.elR('div', 'zk-card-name', p.name));
    body.appendChild(card);
    var side = ui.el('div', 'zk-get-side');
    side.appendChild(ui.el('p', 'zk-get-msg', gotText()));
    var next = ui.button('btn-big zk-next', function () {
      if (next.disabled) return;
      next.disabled = true;
      ui.play('tap');
      flush();
    });
    next.appendChild(ui.svg(ui.ICO.next || ui.ICO.play));
    next.appendChild(ui.el('span', null, 'つぎへ'));
    side.appendChild(next);
    body.appendChild(side);
    app.appendChild(body);
    app.appendChild(progress(ui));
  }

  function renderBook() {
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('zukan');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'zk-book');
    var tabs = ui.el('div', 'zk-tabs');
    C.zukanData.THEMES.forEach(function (t) {
      var b = ui.button('zk-tab' + (t.id === st.bookTheme ? ' on' : ''), function () { ui.play('tap'); openBook(t.id); });
      b.setAttribute('aria-label', t.name);
      b.appendChild(ui.el('span', 'zk-tab-ico', t.icon));
      tabs.appendChild(b);
    });
    body.appendChild(tabs);
    var th = Z().themeById(st.bookTheme), n = Z().countFor(st.bookTheme, st.cards);
    var title = ui.el('div', 'zk-book-title');
    title.appendChild(ui.elR('span', null, th.name));
    title.appendChild(ui.el('span', 'zk-book-count', '  ' + n.got + '/' + n.total + (n.kira ? '  ✨' + n.kira : '')));
    body.appendChild(title);
    var grid = ui.el('div', 'zk-grid');
    Z().pagesOf(st.bookTheme).forEach(function (p) {
      var got = st.cards[p.id];
      var b = ui.button('zk-card' + (got ? '' : ' none') + (got === 'kira' ? ' kira' : ''), function () {
        if (!got) return;
        ui.play('tap');
        openCard(p.id);
      });
      if (got) {
        b.appendChild(picNode(p, 'zk-card-pic'));
        b.appendChild(ui.elR('span', 'zk-card-name', p.name));
      } else {
        b.appendChild(ui.el('span', 'zk-card-q', '？'));
      }
      grid.appendChild(b);
    });
    body.appendChild(grid);
    body.appendChild(backBtn());
    app.appendChild(body);
  }

  function renderBookPage() {
    view = null;
    if (!drawing()) return;
    var ui = U(), p = Z().pageById(st.bookPageId);
    var app = ui.newScreen('zukan');
    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    var sp = ui.button('icon-btn kk-speak', function () { ui.play('tap'); ui.speak(p.text); });
    sp.setAttribute('aria-label', 'もういちど きく');
    sp.appendChild(ui.svg(ui.ICO.speaker));
    if (right) right.insertBefore(sp, right.firstChild);
    app.appendChild(bar);
    var body = ui.el('div', 'zk-page');
    var pic = picNode(p, 'zk-pic');
    if (st.cards[p.id] === 'kira') pic.classList.add('kira');
    body.appendChild(pic);
    var side = ui.el('div', 'zk-page-side');
    side.appendChild(ui.elR('h2', 'zk-name', p.name));
    side.appendChild(ui.elR('p', 'zk-text', p.text));
    side.appendChild(backBtn());
    body.appendChild(side);
    app.appendChild(body);
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var it = st.quiz && st.page ? st.quiz[st.qIndex] : null;
    return {
      phase: st.phase, theme: st.theme, pageId: st.phase === 'bookPage' ? st.bookPageId : (st.page ? st.page.id : null),
      qIndex: st.qIndex, answer: it ? it.answer : -1, tried: st.tried.slice(), tries: st.tries, revealed: st.revealed,
      got: st.got, pagesDone: st.pagesDone, message: st.message
    };
  }

  B.zukanScreen = {
    show: show,
    _theme: function (id) { if (st && st.phase === 'themes') startTheme(id); },
    _ready: ready,
    _choose: choose,
    _next: flush,
    _flush: flush,
    _openBook: function () { if (st && st.phase === 'themes') openBook(); },
    _bookTheme: function (id) { if (st && (st.phase === 'book' || st.phase === 'bookPage')) openBook(id); },
    _openCard: openCard,
    _back: back,
    _again: againRound,
    _state: state
  };
})();
