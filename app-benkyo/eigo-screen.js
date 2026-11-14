/* えい語の画面。Chiid.benkyo.eigoScreen
   えらぶ（きく／よむ）→ テーマ（きくだけ）→ 問題 → ごほうび。流れ・記録・星・ごほうびは はんたい ことば（hantai-screen.js）と同じ。
   問題作りは Chiid.eigo（subjects/eigo.js）、英語の声は Chiid.voiceEn（shared/voice-en.js）、日本語の説明は Chiid.voice（ずんだもん）。
   記録は1問につき1件：1回目で正解なら true、それ以外は false。2回目のまちがいで答えを見せて「つぎへ」。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。設計書：docs/superpowers/specs/2026-11-14-benkyo-eigo-design.md */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CORRECT = 1600;   // 正解のあと、次の問題までの時間（ms）。英語をもう一度読む分 はんたいより少し長い
  var MSG_RIGHT = '正かい！';
  var ALL_PIC = '🌟';

  var st = null, view = null, pendingFn = null, pendSeq = 0;

  function E() { return C.eigo; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }
  function plain(t) { return String(t || '').replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$1'); }
  // 日本語（ずんだもん）→ 終わったら 英語。描画しないとき（テスト）は何も読まない（テストは _speakers で差しこむ）
  // 英語は 日本語が終わってから読むので、そのあいだに 問題や画面が変わったら 読まない（前の問題の英語が あとから鳴らないように）。
  // talkSeq は 新しく読むとき・答えたとき・次へ進むとき・画面を作り直すときに 1つ進む
  var speakers = null, talkSeq = 0;
  function talk(ja, en) {
    if (!speakers && !drawing()) return;
    var sayJa = speakers ? speakers.ja : function (t) { return U().speak(t); };
    var sayEn = speakers ? speakers.en : function (t) { return C.voiceEn.speak(t); };
    var tok = ++talkSeq, q = st && st.q, sid = (!speakers && B.ui.screenId) ? B.ui.screenId() : null;
    var p = ja ? sayJa(ja) : Promise.resolve();
    if (en) Promise.resolve(p).then(function () {
      if (tok !== talkSeq || !st || st.q !== q) return;
      if (sid !== null && B.ui.screenId() !== sid) return;
      sayEn(en);
    });
  }
  function english() { return st && st.q ? (st.q.cards ? st.q.answer.en : st.q.say) : null; }
  // 問題を出したときに読む英語：きく は英語、よむ は読まない（つづりを読んでわかる練習のため。答えたあとに読む）
  function askEnglish() { return st.mode === 'yomi' ? null : english(); }

  /* ---------- 開く ---------- */
  function show(ctx) {
    ctx = ctx || {};
    var pid = ctx.profileId || (B.ui && B.ui.profileId && B.ui.profileId());
    var run = st = {
      profileId: pid, mode: null, theme: null, prog: {}, q: null, tries: 0, tried: [], revealed: false,
      solved: 0, stars: 0, phase: 'loading', message: '', mood: 'normal', used: {}, first: true,
      noVoice: false, rng: ctx.rng || Math.random
    };
    pendingFn = null; view = null;
    var sid = B.ui && B.ui.screenId ? B.ui.screenId() : null;   // 記録を読むあいだに ほかの画面へ行ったら、開かない
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        if (st !== run) return;
        if (sid !== null && B.ui.screenId() !== sid) { st = null; return; }
        st.prog.kiku = E().progressFromLogs(logs, E().KIKU_AREA);
        st.prog.yomi = E().progressFromLogs(logs, E().YOMI_AREA);
        st.noVoice = !C.voiceEn.available();
        showMode();
      });
  }

  // 英語の声の一覧が あとから届いたら、えらぶ画面を作り直して「きく」を使えるようにする
  var offVoice = null;
  function watchVoice() {
    if (offVoice) offVoice();
    offVoice = C.voiceEn.onChange(function () {
      if (!st || st.phase !== 'mode' || !st.noVoice || !C.voiceEn.available()) return;
      if (drawing() && view === null) return;   // ほかの画面へ移ったあと
      st.noVoice = false;
      showMode();
    });
  }
  function showMode() {
    if (st.noVoice) watchVoice();
    st.phase = 'mode'; st.mode = null;
    st.message = st.noVoice ? E().TEXT.noVoice : E().TEXT.start;
    buildMode();
    if (!st.noVoice) talk(E().TEXT.start);
  }
  function pickMode(m) {
    if (!st || (st.phase !== 'mode')) return;
    if (m === 'kiku' && st.noVoice) return;          // 英語の声がない端末では「きく」は できない
    if (m !== 'kiku' && m !== 'yomi') return;
    st.mode = m;
    st.phase = 'theme'; st.message = E().TEXT.theme; buildTheme(); talk(E().TEXT.theme);   // きく・よむ どちらも テーマを選ぶ（ABC は きく だけ）
  }
  function pickTheme(id) {
    if (!st || st.phase !== 'theme') return;
    var ok = id === 'all' || (id === 'abc' && st.mode === 'kiku') || C.eigoData.THEMES.some(function (t) { return t.id === id; });
    if (!ok) return;
    st.theme = id;
    startRound();
  }
  function level() { return st.prog[st.mode].level; }

  function startRound() {
    st.solved = 0; st.stars = 0; st.used = {}; st.first = true; pendingFn = null;
    buildQuestion();
    nextQuestion();
  }

  function nextQuestion() {
    var p = st.prog[st.mode];
    var make = st.mode === 'kiku' ? E().makeKiku : E().makeYomi;
    st.q = make(level(), st.theme, st.rng, { used: st.used, missCounts: p.missCounts });
    st.used[E().itemIdOf(st.q)] = 1;
    st.tries = 0; st.tried = []; st.revealed = false;
    st.phase = 'question'; st.mood = 'normal';
    st.message = askText();
    paint();
    talk(st.first ? st.message : null, askEnglish());   // 説明は その回の1問目だけ。2問目からは英語だけ
    st.first = false;
  }
  function askText() {
    var T = E().TEXT;
    if (st.mode === 'yomi') return T.yomi;
    if (st.q.kind === 'word') return T.kiku;
    return st.q.kind === 'first' ? T.abcFirst : T.abc12;
  }
  function count() { return st.q.cards ? st.q.cards.length : st.q.choices.length; }
  function choiceAt(i) { return st.q.cards ? st.q.cards[i] : st.q.choices[i]; }
  function rightIndex() { for (var i = 0; i < count(); i++) if (E().check(st.q, choiceAt(i))) return i; return -1; }

  /* ---------- 答える ---------- */
  function choose(i) {
    if (!st || st.phase !== 'question' || i < 0 || i >= count() || st.tried.indexOf(i) >= 0) return;
    talkSeq++;
    var T = E().TEXT;
    if (E().check(st.q, choiceAt(i))) {
      st.message = MSG_RIGHT; st.mood = 'happy';
      play('correct');
      finish(st.tries === 0);
      talk(null, english());
      wait(WAIT_CORRECT);
      return;
    }
    st.tries++; st.tried.push(i);
    if (st.tries < 2) {
      st.message = st.mode === 'yomi' ? T.againRead : T.again;
      st.mood = 'think';
      play('oops');
      paint();
      talk(st.message, askEnglish());
      return;
    }
    // 2回目のまちがい：答えを光らせて「つぎへ」を待つ
    st.revealed = true; st.message = T.reveal; st.mood = 'normal';
    play('oops');
    finish(false);
    st.phase = 'reveal';
    pendingFn = goNext; pendSeq++;
    paint();
    talk(T.reveal, english());
  }

  // 1問おわり：記録（1問1件）・苦手・レベル・星
  function finish(correct) {
    var q = st.q, kiku = st.mode === 'kiku', p = st.prog[st.mode];
    var itemId = E().itemIdOf(q);
    try {
      var r = C.storage.logAnswer({ profileId: st.profileId, area: kiku ? E().KIKU_AREA : E().YOMI_AREA, itemId: itemId, correct: correct, level: q.level });
      if (r && r.catch) r.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) p.missCounts[itemId] = (p.missCounts[itemId] || 0) + 1;
    p.recent.push(correct);
    var nl = C.adaptive.nextLevel(p.recent, p.level, kiku ? E().KIKU_MAX : E().YOMI_MAX);
    if (nl !== p.level) { p.level = nl; p.recent = []; }
    st.solved++;
    st.phase = 'feedback';
    if (st.solved % E().STAR_EVERY === 0) {
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
    talkSeq++;
    var f = pendingFn; pendingFn = null; pendSeq++;
    f();
  }
  function goNext() {
    if (st.solved >= E().ROUND_SIZE) { showReward(); return; }
    if (restNow()) return;
    nextQuestion();
  }
  function restNow() {
    var over = false;
    try { over = typeof B.checkRest === 'function' && B.checkRest(); } catch (e) { over = false; }
    if (over) { st.phase = 'rest'; view = null; try { C.voiceEn.cancel(); } catch (e) {} }
    return over;
  }

  /* ---------- ごほうび（10問の区切り）：はんたい ことばと同じ ---------- */
  function showReward() {
    st.phase = 'reward'; view = null;
    if (!drawing()) return;
    var ui = U();
    try { C.voiceEn.cancel(); } catch (e) {}
    var app = ui.newScreen('eigo-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < st.stars; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', 'よく がんばったね！'));
    info.appendChild(ui.el('p', 'kk-r-sub', E().ROUND_SIZE + 'もん できたよ'));
    var btns = ui.el('div', 'kk-r-btns');
    var again = ui.button('btn-big', function () {
      if (again.disabled) return;
      again.disabled = true; ui.play('tap'); againRound();
    });
    again.appendChild(ui.svg(ui.ICO.play));
    again.appendChild(ui.elR('span', null, 'もう{一回|いっかい}'));
    var end = ui.button('btn-big secondary', function () {
      if (end.disabled) return;
      end.disabled = true; ui.play('tap'); B.showHome();
    });
    end.appendChild(ui.svg(ui.ICO.home));
    end.appendChild(ui.el('span', null, 'おわる'));
    btns.appendChild(again); btns.appendChild(end);
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

  /* ---------- 絵 ---------- */
  var COLORS = { red: '#e8423b', blue: '#2f6fdb', yellow: '#f7c21b', green: '#3aa24b', pink: '#ff8fbd',
    orange: '#ff8a1f', purple: '#8a4fd1', brown: '#8b5a2b', black: '#2b2b2b', white: '#ffffff' };
  var SHAPES = {
    circle: '<circle cx="50" cy="50" r="38" fill="#4f8fe8"/>',
    triangle: '<path d="M50 12 L88 84 H12 Z" fill="#3aa24b" stroke-linejoin="round"/>',
    square: '<rect x="16" y="16" width="68" height="68" rx="4" fill="#ff8a1f"/>',
    star: '<path d="M50 8 L61 38 L93 38 L67 57 L77 89 L50 70 L23 89 L33 57 L7 38 L39 38 Z" fill="#f7c21b" stroke="#e0a400" stroke-width="3" stroke-linejoin="round"/>',
    heart: '<path d="M50 86 S12 62 12 36 a19 19 0 0 1 38-6 a19 19 0 0 1 38 6 c0 26-38 50-38 50z" fill="#ff5a7a"/>'
  };
  function artSvg(art) {
    var p = String(art).split(':'), k = p[0], v = p[1], inner;
    if (k === 'color') inner = '<circle cx="50" cy="50" r="38" fill="' + COLORS[v] + '" stroke="#c9c9c9" stroke-width="' + (v === 'white' ? 4 : 0) + '"/>';
    else if (k === 'num') inner = '<text x="50" y="72" text-anchor="middle" font-size="' + (v.length > 1 ? 58 : 70) + '" font-weight="900" fill="#e06f20" font-family="Segoe UI, Roboto, Arial, sans-serif">' + v + '</text>';
    else inner = SHAPES[v] || '';
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + inner + '</svg>';
  }
  function pictureOf(ui, w, cls) {
    if (w.pic) return ui.el('span', cls + ' eg-emoji', w.pic);
    return ui.svg(artSvg(w.art), cls + ' eg-art');
  }

  /* ---------- 描画 ---------- */
  function newScreen(name) { talkSeq++; try { C.voiceEn.cancel(); } catch (e) {} return U().newScreen(name); }
  function talkRow(ui, v, extraCls) {
    var talkEl = ui.el('div', 'kk-talk eg-talk' + (extraCls ? ' ' + extraCls : ''));
    v.who = ui.el('div', 'kk-who');
    v.who.appendChild(ui.chara('normal'));
    talkEl.appendChild(v.who);
    v.bubble = ui.bubble('');
    v.bubble.classList.add('kk-msg');
    v.bubble.setAttribute('aria-live', 'polite');
    ui.fillR(v.bubble, st.message);
    talkEl.appendChild(v.bubble);
    return talkEl;
  }
  function buildMode() {
    view = null;
    if (!drawing()) return;
    var ui = U(), app = newScreen('eigo'), v = {};
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'eg-body eg-mode-body');
    body.appendChild(talkRow(ui, v));
    var row = ui.el('div', 'eg-modes');
    var kiku = ui.button('eg-modebtn eg-kiku', function () { ui.play('tap'); pickMode('kiku'); });
    kiku.appendChild(ui.svg('<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 40c0-10 4-24 16-24s16 8 16 16c0 10-10 10-10 18 0 6-4 10-10 10" fill="none" stroke="#e06f20" stroke-width="6" stroke-linecap="round"/><circle cx="38" cy="32" r="5" fill="#e06f20"/><path d="M10 14v18a5 5 0 1 0 3 4V20h8v-6z" fill="#4cb8c4"/></svg>', 'eg-mode-ico'));
    kiku.appendChild(ui.el('span', 'eg-mode-name', 'きく'));
    if (st.noVoice) { kiku.disabled = true; kiku.setAttribute('aria-disabled', 'true'); }
    var yomi = ui.button('eg-modebtn eg-yomi', function () { ui.play('tap'); pickMode('yomi'); });
    yomi.appendChild(ui.el('span', 'eg-mode-ico eg-aa', 'Aa'));
    yomi.appendChild(ui.el('span', 'eg-mode-name', 'よむ'));
    row.appendChild(kiku); row.appendChild(yomi);
    body.appendChild(row);
    app.appendChild(body);
    view = v;
  }
  function buildTheme() {
    view = null;
    if (!drawing()) return;
    var ui = U(), app = newScreen('eigo'), v = {};
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'eg-body eg-theme-body');
    body.appendChild(ui.elR('h2', 'eg-title', E().TEXT.theme));
    var grid = ui.el('div', 'eg-themes');
    var list = C.eigoData.THEMES.slice();
    if (st.mode === 'kiku') list.push({ id: 'abc', name: 'ABC', pic: '🔤' });   // 文字を聞いて選ぶ（きく だけ）
    list.concat([{ id: 'all', name: 'ぜんぶ', pic: ALL_PIC }]).forEach(function (t) {
      var b = ui.button('eg-theme' + (t.id === 'all' ? ' eg-all' : ''), function () { ui.play('tap'); pickTheme(t.id); });
      b.appendChild(ui.el('span', 'eg-theme-ico', t.pic));
      b.appendChild(ui.el('span', 'eg-theme-name', t.name));
      grid.appendChild(b);
    });
    body.appendChild(grid);
    app.appendChild(body);
    view = v;
  }
  function buildQuestion() {
    view = null;
    if (!drawing()) return;
    var ui = U(), app = newScreen('eigo'), v = { qkey: null, mood: null, starsShown: -1 };
    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    if (!st.noVoice) {
      var sp = ui.button('icon-btn kk-speak eg-speak', function () {
        if (!st || !st.q || (st.phase !== 'question' && st.phase !== 'reveal') || !canReplay()) return;
        var en = english(); if (!en) return;
        talkSeq++; ui.play('tap'); C.voiceEn.speak(en);
      });
      sp.setAttribute('aria-label', 'もういちど きく');
      sp.appendChild(ui.svg(ui.ICO.speaker));
      right.insertBefore(sp, right.firstChild);
      v.speak = sp;
    }
    app.appendChild(bar);
    var body = ui.el('div', 'eg-body eg-q-body');
    v.ask = ui.el('div', 'eg-ask');
    body.appendChild(v.ask);
    body.appendChild(talkRow(ui, v));
    v.choices = ui.el('div', 'eg-choices');
    body.appendChild(v.choices);
    var foot = ui.el('div', 'ht-foot eg-foot');
    var prog = ui.el('div', 'kk-prog');
    v.dots = [];
    var dots = ui.el('div', 'kk-dots');
    for (var i = 0; i < E().ROUND_SIZE; i++) { var d = ui.el('span', 'kk-dot'); v.dots.push(d); dots.appendChild(d); }
    prog.appendChild(dots);
    v.stars = ui.el('div', 'kk-stars');
    prog.appendChild(v.stars);
    foot.appendChild(prog);
    v.next = ui.button('btn-big ht-next eg-next', function () { ui.play('tap'); flush(); });
    v.next.appendChild(ui.svg(ui.ICO.next || ui.ICO.play));
    v.next.appendChild(ui.el('span', null, 'つぎへ'));
    foot.appendChild(v.next);
    body.appendChild(foot);
    app.appendChild(body);
    v.body = body;
    view = v;
  }

  // 「もういちど きく」：きく は いつでも、よむ は答えを見せたあとだけ（問題のあいだは声を出さない）
  function canReplay() { return !!(st && st.q && english() && (st.mode === 'kiku' || st.phase !== 'question')); }
  function qKey(q) { return q.cards ? q.answer.id + '|' + q.cards.map(function (c) { return c.id; }).join(',') : q.kind + q.answer + q.choices.join(''); }
  function paintAsk(v, q) {
    var ui = U();
    v.ask.innerHTML = '';
    v.ask.className = 'eg-ask k-' + (q.kind || 'kiku');
    if (q.kind === 'read') v.ask.appendChild(ui.el('span', 'eg-word', q.answer.en));   // よむ：つづりを大きく
  }
  function paint() {
    if (!view || !st || !st.q || !drawing() || !view.choices) return;
    var ui = U(), v = view, q = st.q;
    var key = qKey(q);
    if (v.qkey !== key) {
      v.qkey = key;
      paintAsk(v, q);
      v.choices.innerHTML = '';
      v.choices.className = 'eg-choices n' + count() + (q.cards ? ' k-kiku' : ' k-letter');
      for (var i = 0; i < count(); i++) (function (idx) {
        var c = choiceAt(idx);
        var b = ui.button('eg-choice', function () { choose(idx); });
        if (q.cards) {
          b.appendChild(pictureOf(ui, c, 'eg-card-pic'));
          b.setAttribute('aria-label', c.ja);
          var spell = ui.el('span', 'eg-spell');
          spell.appendChild(ui.el('b', null, c.en));
          spell.appendChild(ui.el('small', null, c.ja));
          b.appendChild(spell);
        } else {
          b.appendChild(ui.el('span', 'eg-letter', c));
        }
        v.choices.appendChild(b);
      })(i);
    }
    var ri = rightIndex(), shown = st.phase === 'feedback' || st.phase === 'reveal';
    Array.prototype.forEach.call(v.choices.children, function (b, i) {
      b.classList.toggle('tried', st.tried.indexOf(i) >= 0 && !(st.revealed && i === ri));
      b.classList.toggle('right', shown && i === ri);
      b.disabled = st.tried.indexOf(i) >= 0 || st.phase !== 'question';
    });
    ui.fillR(v.bubble, st.message);
    v.bubble.classList.toggle('good', st.mood === 'happy');
    if (v.mood !== st.mood) { v.who.innerHTML = ''; v.who.appendChild(ui.chara(st.mood)); v.mood = st.mood; }
    for (var d = 0; d < v.dots.length; d++) v.dots[d].classList.toggle('on', d < st.solved);
    if (v.starsShown !== st.stars) {
      v.stars.innerHTML = '';
      for (var s = 0; s < st.stars; s++) v.stars.appendChild(ui.svg(ui.STAR, 'kk-star' + (s === st.stars - 1 && v.starsShown >= 0 ? ' pop' : '')));
      v.starsShown = st.stars;
    }
    v.next.style.visibility = st.phase === 'reveal' ? 'visible' : 'hidden';
    v.body.classList.toggle('is-wait', st.phase !== 'question');
    if (v.speak) v.speak.style.visibility = canReplay() ? 'visible' : 'hidden';
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    return { phase: st.phase, mode: st.mode, theme: st.theme, level: st.mode ? level() : null, q: st.q,
      tried: st.tried.slice(), solved: st.solved, stars: st.stars, noVoice: st.noVoice };
  }

  B.eigoScreen = {
    show: show,
    _mode: pickMode, _theme: pickTheme,
    _choose: choose, _next: flush, _flush: flush, _again: againRound, _state: state,
    _speakers: function (s) { speakers = s || null; }
  };
})();
