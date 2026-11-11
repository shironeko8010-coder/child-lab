/* かんじの問題画面（書き取り式）。Chiid.benkyo.kanjiScreen
   よみ：字を見て、ひらがなキーボード（kana-pad.js）で入力 → アプリが採点。
   かき：読みを見て（聞いて）、枠に指で書く →「できた」で正しい字を見せる → 本人が「かけた／もういっかい」（自己採点）。
         「もういっかい」・何も書かずに「できた」のときは、お手本をうすく出して、なぞって練習する（採点しない）。
   出題・採点は Chiid.kanji（subjects/kanji.js）、部品は Chiid.benkyo.ui（main.js）を使う。
   見た目は九九の画面（kk-* のクラス）にそろえ、かんじだけの所は kj-* のクラス。
   記録は1問につき1件：よみは1回目で正解なら true、かきは「かけた」なら true。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var WAIT_CORRECT = 1300;   // 正解のあと、次の問題までの時間（ms）
  var WAIT_REVEAL = 3200;    // こたえを見せたあと、次の問題までの時間（ms）
  var GRADES = [null, 1, 2]; // じどう／1ねんせい／2ねんせい
  var GRADE_TEXT = { auto: 'じどう', 1: '1ねんせい', 2: '2ねんせい' };
  var KJ_FONT = '"UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", "YuKyokasho", "Yu Kyokasho", "Hiragino Mincho ProN", serif';
  var LINE = 0.055;          // 書く線の太さ（枠の大きさに対する割合）

  var MSG = {
    yomiAsk: 'よみかたを ひらがなで いれてね',
    kakiAsk: 'わくの なかに かいてみよう',
    empty: 'ひらがなを えらんでね',
    short: 'ますを ぜんぶ うめてね',
    other: 'それも ただしい よみかただね！ この ことばでは なんて よむかな？',
    retry: 'もういっかい やってみよう！',
    correct: 'せいかい！',
    check: 'よく みくらべてね。かけたかな？',
    wrote: 'すごい！ よく かけたね！',
    practice: 'おてほんを なぞって、もういちど かいてみよう',
    look: 'みて おぼえよう！ おてほんを なぞってみよう'
  };

  var st = null;             // いまの区切りの状態
  var view = null;           // 描画している要素（テストでは null）
  var pendingFn = null;      // 正解/こたえ/練習のあと、次へ進む処理
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
      kinds: [],              // この区切りの形のならび（よみ5・かき5）
      item: null, attempt: null, lastK: null,
      phase: 'loading',       // question / check（見比べ）/ practice（なぞり）/ feedback / reward / rest
      input: '',              // よみ：いま入っている字（テスト用。画面ではキーボードが持つ）
      ink: false,             // かき：何か書いたか
      revealed: false, graded: null,
      solved: 0, stars: 0, message: '', mood: 'normal',
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
    st.kinds = K().roundKinds(st.rng);
    pendingFn = null;
    buildScreen();
    nextQuestion();
  }

  function nextQuestion() {
    var kind = st.kinds[st.solved] || 'yomi';
    var q = K().pickItem({ level: st.level, grade: st.grade, missCounts: st.missCounts, lastK: st.lastK, kind: kind }, st.rng);
    st.item = q;
    st.lastK = q.k;
    st.attempt = K().newAttempt();
    st.input = '';
    st.ink = false;
    st.revealed = false;
    st.graded = null;
    st.phase = 'question';
    st.message = '';
    st.mood = 'normal';
    if (view) {
      if (view.pad) view.pad.reset(q.kind === 'yomi' ? q.ans.length : 0);
      if (view.writer) view.writer.reset(null);
    }
    paint(true);
    speak(K().speakText(q));
  }

  /* ---------- よみ：答えを出す ---------- */
  function submitYomi(value) {
    if (!st || st.phase !== 'question' || !st.item || st.item.kind !== 'yomi') return;
    var q = st.item;
    st.input = String(value == null ? '' : value);
    var r = K().submitYomi(st.attempt, q, st.input);
    if (r.kind === 'empty' || r.kind === 'short') {
      say(r.kind === 'empty' ? MSG.empty : MSG.short, 'normal');
      return;
    }
    if (r.kind === 'other') {               // 別の正しい読み：まちがいに数えない
      play('tap');
      clearInput();
      say(MSG.other, 'think');
      return;
    }
    if (r.kind === 'correct') {
      st.message = MSG.correct;
      st.mood = 'happy';
      if (view && view.pad) view.pad.showAnswer(q.ans, 'right');
      play('correct');
      finish(st.attempt.tries === 0);
      speak('せいかい！');
      wait(WAIT_CORRECT);
    } else if (r.kind === 'retry') {
      play('oops');
      clearInput();
      say(MSG.retry, 'think', 'もういっかい、やってみよう！');
    } else {                                // reveal：こたえをそっと見せて次へ
      st.revealed = true;
      st.message = 'こたえは 「' + q.ans + '」 だよ。つぎは できるよ！';
      st.mood = 'normal';
      if (view && view.pad) view.pad.showAnswer(q.ans, 'reveal');
      play('oops');
      finish(false);
      speak('こたえは ' + q.ans + ' だよ。 つぎは できるよ！');
      wait(WAIT_REVEAL);
    }
  }
  function clearInput() {
    st.input = '';
    if (view && view.pad) view.pad.reset();
  }
  function say(text, mood, voice) {
    st.message = text;
    st.mood = mood || 'normal';
    paint();
    speak(voice || text);
  }

  /* ---------- かき：できた → 見比べ → 自己採点 ---------- */
  function kakiDone() {
    if (!st || !st.item || st.item.kind !== 'kaki') return;
    if (st.phase === 'practice') { flush(); return; }     // なぞりの練習のあとは「つぎへ」
    if (st.phase !== 'question') return;
    play('tap');
    if (!st.ink) {
      // 何も書かずに「できた」：お手本を見せて、なぞりの練習へ（記録は ×）
      st.graded = false;
      finish(false);
      toPractice(MSG.look);
      return;
    }
    st.phase = 'check';
    st.message = MSG.check;
    st.mood = 'normal';
    paint();
    speak('よく みくらべてね。 かけたかな？');
  }
  // ok: true=かけた、false=もういっかい
  function selfGrade(ok) {
    if (!st || st.phase !== 'check') return;
    st.graded = !!ok;
    if (ok) {
      st.message = MSG.wrote;
      st.mood = 'happy';
      play('correct');
      finish(true);
      speak('すごい！ よく かけたね！');
      wait(WAIT_CORRECT);
    } else {
      play('tap');
      finish(false);
      toPractice(MSG.practice);
    }
  }
  function toPractice(text) {
    st.phase = 'practice';
    st.ink = false;
    st.message = text;
    st.mood = 'normal';
    pendingFn = goNext;                     // 「つぎへ」で進む（時間では進まない）
    pendSeq++;
    if (view && view.writer) view.writer.reset(st.item.k);
    paint();
    speak(text);
  }
  function clearInk() {
    if (!st || (st.phase !== 'question' && st.phase !== 'practice')) return;
    st.ink = false;
    if (view && view.writer) view.writer.clear();
    paint();
  }

  /* ---------- 記録・区切り ---------- */
  function log(correct) {
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: st.item.area, itemId: st.item.id, correct: correct, level: st.level, grade: st.grade });
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
    // よみで1回まちがえた問題を取りかえるときは、まちがいとして記録する（苦手に数える）。進み具合は変えない
    if (st.phase === 'question' && st.attempt && st.attempt.tries > 0) log(false);
    st.grade = g;
    if (st.phase === 'question') {
      st.lastK = null;
      nextQuestion();                 // いまの問題を、えらんだ学年の問題に取りかえる（記録しない）
    } else {
      paint();                        // 答えの表示中・見比べ中・練習中なら、次の問題から
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
    again.appendChild(ui.elR('span', null, 'もう{一回|いっかい}'));   // ごほうび画面だけ漢字（問題中の文字は、答えの字を見せないよう ひらがな）
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

  /* ---------- 手書きの枠 ---------- */
  // 知育の「なぞり」と同じ作り：pointer イベント、最初の1本の指だけ、大きさが変わったら作り直す（線は割合で持ち、描き直す）
  function makeWriter(area, onInk) {
    var strokes = [];      // [[{x,y}...]...]（0〜1の割合）
    var cur = null, activeId = null;
    var canvas = null, ctx = null, size = 0, dpr = 1;
    var guide = null;      // うすく出すお手本の字（null なら出さない）

    function build() {
      if (!area.isConnected) { window.removeEventListener('resize', onResize); return; }
      cur = null; activeId = null;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      var w = area.clientWidth, h = area.clientHeight;
      var r = area.getBoundingClientRect();
      var vh = window.innerHeight || 0;
      if (vh && r.bottom > vh) h = Math.min(h, vh - r.top - 4);
      size = Math.max(140, Math.min(560, Math.floor(Math.min(w, h)) - 4));
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas = document.createElement('canvas');
      canvas.className = 'kj-canvas';
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      canvas.setAttribute('aria-label', 'かんじを かく ところ');
      ctx = canvas.getContext('2d');
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('lostpointercapture', up);
      area.appendChild(canvas);
      draw();
    }
    var resizeT = null;
    function onResize() {
      clearTimeout(resizeT);
      resizeT = setTimeout(build, 120);
    }
    window.addEventListener('resize', onResize);

    function pos(ev) {
      var r = canvas.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
    }
    function canWrite() { return st && (st.phase === 'question' || st.phase === 'practice'); }
    function down(ev) {
      if (activeId !== null || !canWrite()) return;   // 2本目以降の指（手のひら）は無視
      activeId = ev.pointerId;
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      cur = [pos(ev)];
      strokes.push(cur);
      draw();
      onInk();
      ev.preventDefault();
    }
    function move(ev) {
      if (ev.pointerId !== activeId || !cur) return;
      var list = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
      if (list && list.length) list.forEach(function (e2) { cur.push(pos(e2)); });
      else cur.push(pos(ev));
      draw();
      ev.preventDefault();
    }
    function up(ev) {
      if (ev.pointerId !== activeId) return;
      activeId = null;
      cur = null;
    }
    function draw() {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      // 十字の点線（マス目）
      ctx.strokeStyle = '#d5dfea';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
      ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (guide) {
        ctx.fillStyle = 'rgba(63,132,200,.22)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = Math.round(size * 0.82) + 'px ' + KJ_FONT;
        ctx.fillText(guide, size / 2, size / 2 + size * 0.03);
      }
      ctx.strokeStyle = '#2b3440';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * LINE;
      strokes.forEach(function (pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * size, pts[0].y * size);
        if (pts.length === 1) ctx.lineTo(pts[0].x * size + 0.01, pts[0].y * size);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * size, pts[i].y * size);
        ctx.stroke();
      });
    }
    return {
      build: build,
      clear: function () { strokes = []; cur = null; activeId = null; draw(); },
      reset: function (g) { strokes = []; cur = null; activeId = null; guide = g || null; draw(); },
      hasInk: function () { return strokes.length > 0; }
    };
  }

  /* ---------- 描画 ---------- */
  function buildScreen() {
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('kanji');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app, grades: [] };

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

    var body = ui.el('div', 'kk-body kj-body');
    var q = ui.el('div', 'kk-q kj-q');
    var card = ui.el('div', 'kj-card');
    card.setAttribute('aria-live', 'polite');
    v.big = ui.el('div', 'kj-big');
    v.ex = ui.el('div', 'kj-ex');
    card.appendChild(v.big);
    card.appendChild(v.ex);
    q.appendChild(card);

    // よみ：答えの枠（問題の下）とキーボード（右）
    v.pad = C.kanaPad.render({
      max: 1,
      canTap: function () { return !!st && (st.phase === 'question' || !!pendingFn); },
      onTap: function () { if (pendingFn) { flush(); return; } ui.play('tap'); },
      onChange: function (val) { if (st) st.input = val; },
      onSubmit: function (val) {
        if (pendingFn) { flush(); return; }
        submitYomi(val);
      }
    });
    v.pad.slots.classList.add('kj-slots');
    q.appendChild(v.pad.slots);

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

    var side = ui.el('div', 'kj-side');
    v.padWrap = ui.el('div', 'kj-padwrap');
    v.padWrap.appendChild(v.pad.el);
    side.appendChild(v.padWrap);

    // かき：手書きの枠とボタン
    var write = ui.el('div', 'kj-write');
    var area = ui.el('div', 'kj-area');
    write.appendChild(area);
    var wbtns = ui.el('div', 'kj-wbtns');
    v.wA = ui.button('btn-big secondary kj-wbtn', function () { onWriteBtn('A'); });
    v.wB = ui.button('btn-big kj-wbtn', function () { onWriteBtn('B'); });
    wbtns.appendChild(v.wA);
    wbtns.appendChild(v.wB);
    write.appendChild(wbtns);
    side.appendChild(write);
    v.write = write;
    v.writer = makeWriter(area, function () {
      if (st && !st.ink) { st.ink = true; paint(); }
    });

    body.appendChild(side);
    app.appendChild(body);
    v.body = body;
    v.mood = null;
    v.starsShown = -1;
    v.btnKey = '';
    view = v;
    ui.later(function () { if (view === v) v.writer.build(); }, 0);
  }

  // かきのボタン（左 A・右 B）。場面で役わりが変わる
  function onWriteBtn(which) {
    if (!st || !st.item) return;
    var ph = st.phase;
    if (ph === 'feedback') { flush(); return; }
    if (ph === 'question' || ph === 'practice') {
      if (which === 'A') { play('tap'); clearInk(); }
      else kakiDone();
    } else if (ph === 'check') {
      selfGrade(which === 'B');
    }
  }
  function setBtn(b, cls, label, ico) {
    var ui = U();
    b.className = 'btn-big kj-wbtn' + (cls ? ' ' + cls : '');
    b.innerHTML = '';
    if (ico) b.appendChild(ui.svg(ico));
    b.appendChild(ui.el('span', null, label));
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
    var kaki = q.kind === 'kaki';
    var showKanji = kaki && st.phase !== 'question';     // かき：できたのあとは正しい字を大きく
    v.body.classList.toggle('is-kaki', kaki);
    v.body.classList.toggle('is-yomi', !kaki);
    v.app.classList.toggle('kj-mode-kaki', kaki);
    v.pad.slots.hidden = kaki;
    v.padWrap.hidden = kaki;
    v.write.hidden = !kaki;
    if (fresh && kaki) ui.later(function () { if (view === v) v.writer.build(); }, 0);

    // 上：よみは字を大きく＋例の言葉（字入り）。かきは読みを大きく＋例の言葉（□）→ できたのあとは字
    var bigText = kaki ? (showKanji ? q.k : q.r) : q.k;
    v.big.textContent = bigText;
    v.big.className = 'kj-big' + (kaki && !showKanji ? ' kana' : '') + (showKanji ? ' answer' : '');
    if (!kaki) exNodes(ui, v.ex, q.ex, q.k);
    else exNodes(ui, v.ex, q.ex, showKanji ? q.k : null);
    v.ex.classList.toggle('done', st.phase === 'feedback' && !kaki);

    if (kaki) {
      var key = st.phase;
      if (v.btnKey !== key) {
        if (st.phase === 'check') {
          setBtn(v.wA, 'secondary', 'もういっかい');
          setBtn(v.wB, '', 'かけた', ui.ICO.check);
        } else if (st.phase === 'practice') {
          setBtn(v.wA, 'secondary', 'けす');
          setBtn(v.wB, '', 'つぎへ', ui.ICO.next);
        } else if (st.phase === 'question') {
          setBtn(v.wA, 'secondary', 'けす');
          setBtn(v.wB, '', 'できた', ui.ICO.check);
        }
        v.btnKey = key;
      }
      v.wA.classList.toggle('dim', st.phase === 'feedback');
      v.wB.classList.toggle('dim', st.phase === 'feedback');
    }

    var ask = kaki ? MSG.kakiAsk : MSG.yomiAsk;
    v.bubble.textContent = st.message || ask;
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
    v.body.classList.toggle('is-wait', st.phase === 'feedback');
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
      id: q ? q.id : null, area: q ? q.area : null, k: q ? q.k : null, kind: q ? q.kind : null, r: q ? q.r : null,
      ans: q ? q.ans : null, tries: st.attempt ? st.attempt.tries : 0,
      input: st.input, ink: st.ink, graded: st.graded,
      message: st.message, revealed: st.revealed, kinds: st.kinds.slice(),
      grade: st.grade, solved: st.solved, stars: st.stars, level: st.level
    };
  }

  B.kanjiScreen = {
    show: show,
    // テスト用：表示中の待ちがあれば先に進めてから
    _answer: function (value) { if (pendingFn && st.phase === 'feedback') flush(); submitYomi(value); },
    _draw: function () { if (st && (st.phase === 'question' || st.phase === 'practice')) st.ink = true; },
    _clear: clearInk,
    _done: kakiDone,
    _grade: selfGrade,
    _flush: flush,
    _selectGrade: selectGrade,
    _again: againRound,
    _state: state
  };
})();
