/* どうとく（小2）の問題画面とごほうび画面。Chiid.benkyo.doutokuScreen
   場面・判定は Chiid.doutoku（subjects/doutoku.js）、部品は Chiid.benkyo.ui（main.js）を使う。
   - 絵（SVG）と文で場面を見せ、3つから選ぶ。×は付けない。
   - 望ましい答え → ほめる → 声を言い終わってから次へ（「つぎへ」で早めに進める）。
   - ほかの答え → 理由を伝えて、そのボタンを うすくし、もう一度えらべる。
   - かんがえる もんだい → 受けとめて「パパや ママと はなして みてね」。「つぎへ」を押して進む。
   - 10もんで区切り、5もんごとに星。問題のあいだで利用時間を確かめる（B.checkRest）。
   #app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var MIN_GOOD = 2500;       // ほめたあと、次へ進むまでの最短（ms）。声が出ない端末でも読めるように

  var st = null;             // いまの区切りの状態
  var view = null;           // 描画している要素（テストでは null）
  var pendingFn = null;      // 「つぎへ」で進む処理
  var pendSeq = 0;
  var talkSeq = 0;           // 読み上げの番号（新しい読み上げが始まったら、古い続きは読まない）

  function D() { return C.doutoku; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }

  // 文ごとに続けて読む。読み終わったら resolve（画面がないときは すぐ）
  function talk(text) {
    var my = ++talkSeq;
    if (!drawing()) return Promise.resolve();
    var parts = D().sentences(text);
    var p = Promise.resolve();
    parts.forEach(function (s) {
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
      profileId: pid, prog: { seen: {}, missed: {} }, list: [], index: -1,
      scene: null, order: [], attempt: null, result: null,
      solved: 0, stars: 0, phase: 'loading', mood: 'normal',
      rng: ctx.rng || Math.random
    };
    pendingFn = null;
    view = null;
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(pid); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        if (st !== run) return;            // あいだに別の画面で開き直した
        st.prog = D().progressFromLogs(logs);
        startRound();
      });
  }

  function startRound() {
    st.solved = 0;
    st.stars = 0;
    st.index = -1;
    st.list = D().pickRound(st.prog, st.rng);
    pendingFn = null;
    buildScreen();
    nextQuestion();
  }

  function nextQuestion() {
    st.index++;
    st.scene = D().get(st.list[st.index]);
    st.order = D().arrange(st.scene, st.rng);
    st.attempt = D().newAttempt();
    st.result = null;
    st.phase = 'question';
    st.mood = 'normal';
    paintScene();
    paint();
    talk(D().speakText(st.scene));
  }

  /* ---------- えらぶ ---------- */
  // pos は画面のならびの番号（0〜2）
  function pick(pos) {
    if (!st || st.phase !== 'question') return;
    var c = st.order[pos];
    if (!c) return;
    var r = D().choose(st.attempt, st.scene, c.idx);
    if (r.kind === 'ignore') return;
    st.result = r;
    var quiet = st.scene.quiet;
    if (r.kind === 'retry') {
      st.mood = 'think';
      play('oops');
      paint();
      talk(D().replyText(st.scene, r));
      return;
    }
    if (r.kind === 'good') {
      st.mood = 'happy';
      play('correct');
    } else {                                   // かんがえる もんだい
      st.mood = quiet ? 'normal' : 'happy';
      if (!quiet) play('tap');
    }
    finish(quiet);
    var said = talk(D().replyText(st.scene, r));
    if (r.kind === 'good') waitAfter(said, MIN_GOOD);
    else pendingFn = goNext;                   // かんがえる もんだいは「つぎへ」を押すまで待つ
  }

  // 1問おわり：記録（1問1件）・進み具合・星
  function finish(quiet) {
    var sc = st.scene;
    try {
      var e = D().logEntry(sc, st.attempt);
      var p = C.storage.logAnswer({ profileId: st.profileId, area: e.area, itemId: e.itemId, correct: e.correct, level: e.level });
      if (p && p.catch) p.catch(function () {});
    } catch (err) { /* 保存できなくても続ける */ }
    st.prog.seen[sc.id] = (st.prog.seen[sc.id] || 0) + 1;
    if (sc.kind === 'choice' && !st.attempt.firstTry) st.prog.missed[sc.id] = (st.prog.missed[sc.id] || 0) + 1;
    st.solved++;
    st.phase = 'feedback';
    if (st.solved % D().STAR_EVERY === 0) {
      st.stars++;
      if (!quiet && drawing()) U().later(function () { play('star'); }, 450);
    }
    paint();
  }

  /* ---------- 次へ ---------- */
  // 読み上げが終わってから（最短 minMs）次へ。それまでに「つぎへ」を押したら、すぐ進む
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
    if (st.solved >= D().ROUND_SIZE) { showReward(); return; }
    if (restNow()) return;
    nextQuestion();
  }
  function restNow() {
    var over = false;
    try { over = typeof B.checkRest === 'function' && B.checkRest(); } catch (e) { over = false; }
    if (over) { st.phase = 'rest'; view = null; }
    return over;
  }

  /* ---------- ごほうび（10もんの区切り） ---------- */
  function showReward() {
    st.phase = 'reward';
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('doutoku-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < st.stars; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.elR('p', 'kk-r-msg', 'よく {考|かんが}えたね！'));
    info.appendChild(ui.el('p', 'kk-r-sub', D().ROUND_SIZE + 'もん できたよ'));
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
    ui.speak('よく かんがえたね！ ほしが ' + st.stars + 'こ');
  }
  function againRound() {
    if (!st || st.phase !== 'reward') return;
    if (restNow()) return;
    startRound();
  }

  /* ---------- 描画 ---------- */
  // {漢字|よみ} を ruby にして入れる
  function fillText(node, text) {
    var ui = U();
    node.innerHTML = '';
    D().segments(text).forEach(function (s) {
      if (s.y) node.appendChild(ui.ruby(s.t, s.y));
      else node.appendChild(document.createTextNode(s.t));
    });
  }

  function buildScreen() {
    view = null;
    if (!drawing()) return;
    var ui = U();
    var app = ui.newScreen('doutoku');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app };

    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    if (hasVoice) {
      var sp = ui.button('icon-btn kk-speak', function () {
        if (!st || !st.scene) return;
        ui.play('tap');
        talk(st.result && st.phase === 'feedback' ? D().replyText(st.scene, st.result) : D().speakText(st.scene));
      });
      sp.setAttribute('aria-label', 'もういちど きく');
      sp.appendChild(ui.svg(ui.ICO.speaker));
      right.insertBefore(sp, right.firstChild);
    }
    app.appendChild(bar);

    var body = ui.el('div', 'dt-body');
    var scene = ui.el('div', 'dt-scene');
    v.picBox = ui.el('div', 'dt-pic');
    v.pic = ui.el('div', 'dt-pic-art');
    v.picBox.appendChild(v.pic);
    v.talk = ui.el('div', 'dt-talk');
    v.who = ui.el('div', 'dt-who');
    v.talk.appendChild(v.who);
    v.bubble = ui.bubble('');
    v.bubble.classList.add('dt-msg');
    v.bubble.setAttribute('aria-live', 'polite');
    v.talk.appendChild(v.bubble);
    v.picBox.appendChild(v.talk);
    scene.appendChild(v.picBox);
    v.text = ui.el('p', 'dt-text');
    scene.appendChild(v.text);
    body.appendChild(scene);

    var side = ui.el('div', 'dt-side');
    v.ask = ui.el('p', 'dt-ask');
    side.appendChild(v.ask);
    var list = ui.el('div', 'dt-choices');
    v.btns = [];
    for (var i = 0; i < 3; i++) {
      (function (pos) {
        var b = ui.button('dt-choice', function () { onPick(pos); });
        b.setAttribute('data-pos', String(pos));
        v.btns.push(b);
        list.appendChild(b);
      })(i);
    }
    side.appendChild(list);
    var foot = ui.el('div', 'dt-foot');
    var prog = ui.el('div', 'kk-prog');
    v.dots = [];
    var dots = ui.el('div', 'kk-dots');
    for (var k = 0; k < D().ROUND_SIZE; k++) {
      var d = ui.el('span', 'kk-dot');
      v.dots.push(d);
      dots.appendChild(d);
    }
    prog.appendChild(dots);
    v.stars = ui.el('div', 'kk-stars');
    prog.appendChild(v.stars);
    foot.appendChild(prog);
    v.next = ui.button('btn-big dt-next', function () { if (pendingFn) { ui.play('tap'); flush(); } });
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

  function onPick(pos) {
    if (pendingFn) return;          // 次へ進む待ちのあいだは、えらべない
    pick(pos);
  }

  // 場面が変わったときだけ描く（絵・文・選択肢）
  function paintScene() {
    if (!view || !st || !st.scene || !drawing()) return;
    var v = view, sc = st.scene;
    v.pic.innerHTML = picture(sc.pic);
    fillText(v.text, sc.text);
    fillText(v.ask, sc.kind === 'think' ? '{考|かんが}えて みよう（どれを えらんでも いいよ）' : D().ASK);
    v.body.classList.toggle('is-think', sc.kind === 'think');
    for (var i = 0; i < v.btns.length; i++) {
      var c = st.order[i];
      fillText(v.btns[i], c ? c.text : '');
      v.btns[i].style.display = c ? '' : 'none';
    }
  }

  function paint() {
    if (!view || !st || !st.scene || !drawing()) return;
    var ui = U(), v = view, r = st.result;
    var tried = st.attempt ? st.attempt.tried : [];
    for (var i = 0; i < v.btns.length; i++) {
      var c = st.order[i];
      if (!c) continue;
      var wasTried = tried.indexOf(c.idx) >= 0;
      var chosen = st.phase === 'feedback' && wasTried && tried[tried.length - 1] === c.idx;
      v.btns[i].classList.toggle('tried', wasTried && !chosen);
      v.btns[i].classList.toggle('chosen', chosen);
      v.btns[i].disabled = st.phase !== 'question' || wasTried;
    }
    if (r) {
      var msg = r.kind === 'retry' ? r.reply + ' ' + D().RETRY
        : r.kind === 'think' ? r.reply + ' ' + r.end : r.reply;
      fillText(v.bubble, msg);
      v.talk.classList.add('on');
    } else {
      v.bubble.textContent = '';
      v.talk.classList.remove('on');
    }
    v.bubble.classList.toggle('good', r && r.kind === 'good');
    if (v.mood !== st.mood) {
      v.who.innerHTML = '';
      v.who.appendChild(ui.chara(st.mood));
      v.mood = st.mood;
    }
    for (var k = 0; k < v.dots.length; k++) v.dots[k].classList.toggle('on', k < st.solved);
    if (v.starsShown !== st.stars) {
      v.stars.innerHTML = '';
      for (var s = 0; s < st.stars; s++) {
        v.stars.appendChild(ui.svg(ui.STAR, 'kk-star' + (s === st.stars - 1 && v.starsShown >= 0 && !st.scene.quiet ? ' pop' : '')));
      }
      v.starsShown = st.stars;
    }
    v.next.classList.toggle('on', st.phase === 'feedback');
    v.body.classList.toggle('is-wait', st.phase !== 'question');
  }

  /* ---------- 絵（SVG）。viewBox 0 0 400 260、地面は y=240 ---------- */
  var BG = {
    school: '<rect width="400" height="260" fill="#dcefff"/><rect x="40" y="70" width="320" height="130" fill="#f4eee2" stroke="#d8cdb8" stroke-width="3"/>' +
      '<rect x="170" y="40" width="60" height="40" fill="#f4eee2" stroke="#d8cdb8" stroke-width="3"/><circle cx="200" cy="60" r="13" fill="#fff" stroke="#a89c86" stroke-width="3"/><path d="M200 60v-8M200 60h6" stroke="#6b6253" stroke-width="2.5" stroke-linecap="round"/>' +
      '<g fill="#bfe0f5"><rect x="62" y="95" width="40" height="30"/><rect x="122" y="95" width="40" height="30"/><rect x="238" y="95" width="40" height="30"/><rect x="298" y="95" width="40" height="30"/></g>' +
      '<rect y="200" width="400" height="60" fill="#ead9b8"/>',
    genkan: '<rect width="400" height="260" fill="#f6ead8"/><rect x="20" y="40" width="110" height="180" rx="6" fill="#b98a5e"/><circle cx="112" cy="135" r="6" fill="#f2d16b"/>' +
      '<rect y="220" width="400" height="40" fill="#d9c3a4"/><rect y="212" width="400" height="10" fill="#c7ab86"/>',
    room: '<rect width="400" height="260" fill="#fbf1e2"/><rect x="250" y="30" width="110" height="80" rx="6" fill="#cfe9fb" stroke="#e2cfae" stroke-width="6"/><path d="M305 30v80M250 70h110" stroke="#e2cfae" stroke-width="4"/>' +
      '<rect y="215" width="400" height="45" fill="#e6c69e"/>',
    night: '<rect width="400" height="260" fill="#46557a"/><rect x="290" y="20" width="96" height="76" rx="6" fill="#26304a" stroke="#6b7aa0" stroke-width="5"/>' +
      '<rect y="215" width="400" height="45" fill="#6a5a4a"/>',
    classroom: '<rect width="400" height="260" fill="#eef5ea"/><rect x="60" y="24" width="280" height="90" rx="6" fill="#3f7356" stroke="#a37b52" stroke-width="7"/>' +
      '<path d="M90 60h60M90 80h100" stroke="#e8f2ea" stroke-width="3" stroke-linecap="round" opacity=".6"/><rect y="215" width="400" height="45" fill="#d7b98f"/>',
    hall: '<rect width="400" height="260" fill="#f3f0e6"/><g fill="#cfe9fb" stroke="#d8d2bf" stroke-width="4"><rect x="20" y="30" width="80" height="70"/><rect x="160" y="30" width="80" height="70"/><rect x="300" y="30" width="80" height="70"/></g>' +
      '<rect y="200" width="400" height="60" fill="#dccdb0"/><path d="M0 225h400" stroke="#cbb994" stroke-width="2"/>',
    park: '<rect width="400" height="260" fill="#dcefff"/><circle cx="350" cy="40" r="22" fill="#ffe08a"/><rect y="190" width="400" height="70" fill="#bfe3a5"/>' +
      '<rect x="30" y="110" width="14" height="85" fill="#a3764c"/><circle cx="37" cy="100" r="34" fill="#8ccf7a"/>',
    pond: '<rect width="400" height="260" fill="#dcefff"/><rect y="170" width="400" height="90" fill="#bfe3a5"/><ellipse cx="270" cy="215" rx="120" ry="34" fill="#7cc4ea" stroke="#5aa9d4" stroke-width="3"/>' +
      '<rect x="30" y="90" width="14" height="85" fill="#a3764c"/><circle cx="37" cy="80" r="34" fill="#8ccf7a"/>',
    street: '<rect width="400" height="260" fill="#dcefff"/><path d="M230 150l40-34 40 34z" fill="#e58b6b"/><rect x="238" y="150" width="64" height="55" fill="#f7ecd9"/>' +
      '<path d="M310 160l35-30 35 30z" fill="#7aa0d6"/><rect x="317" y="160" width="56" height="45" fill="#f7ecd9"/><rect y="205" width="400" height="55" fill="#cfcfcf"/><rect y="200" width="400" height="8" fill="#b9b9b9"/>',
    crossing: '<rect width="400" height="260" fill="#dcefff"/><rect y="150" width="400" height="110" fill="#9aa1a8"/><rect y="230" width="400" height="30" fill="#d6d0c4"/>' +
      '<g fill="#fff"><rect x="120" y="160" width="26" height="66"/><rect x="166" y="160" width="26" height="66"/><rect x="212" y="160" width="26" height="66"/><rect x="258" y="160" width="26" height="66"/></g>',
    train: '<rect width="400" height="260" fill="#e7edf4"/><g fill="#cfe9fb" stroke="#b7c3d1" stroke-width="5"><rect x="30" y="30" width="150" height="70" rx="8"/><rect x="220" y="30" width="150" height="70" rx="8"/></g>' +
      '<path d="M0 20h400" stroke="#9aa6b4" stroke-width="4"/><g stroke="#9aa6b4" stroke-width="2" fill="none"><path d="M60 20v14M140 20v14M260 20v14M340 20v14"/><circle cx="60" cy="40" r="6"/><circle cx="140" cy="40" r="6"/><circle cx="260" cy="40" r="6"/><circle cx="340" cy="40" r="6"/></g>' +
      '<rect x="20" y="180" width="360" height="26" rx="8" fill="#5f9f7d"/><rect x="20" y="150" width="360" height="34" rx="8" fill="#76b592"/><rect y="230" width="400" height="30" fill="#b9a993"/>',
    library: '<rect width="400" height="260" fill="#f5efe4"/><rect x="20" y="20" width="360" height="150" fill="#b98a5e"/><g fill="#8a6440"><rect x="26" y="66" width="348" height="6"/><rect x="26" y="116" width="348" height="6"/></g>' +
      '<g><rect x="30" y="28" width="14" height="38" fill="#e46f6f"/><rect x="46" y="32" width="12" height="34" fill="#6fa3e4"/><rect x="60" y="26" width="16" height="40" fill="#f2c04f"/><rect x="250" y="30" width="14" height="36" fill="#7cc28a"/><rect x="266" y="28" width="12" height="38" fill="#b38be0"/>' +
      '<rect x="40" y="78" width="14" height="38" fill="#7cc28a"/><rect x="56" y="82" width="12" height="34" fill="#e46f6f"/><rect x="300" y="78" width="16" height="38" fill="#6fa3e4"/><rect x="318" y="84" width="12" height="32" fill="#f2c04f"/>' +
      '<rect x="120" y="128" width="14" height="38" fill="#b38be0"/><rect x="136" y="132" width="12" height="34" fill="#f2c04f"/><rect x="330" y="128" width="16" height="38" fill="#e46f6f"/></g><rect y="215" width="400" height="45" fill="#d7b98f"/>',
    shop: '<rect width="400" height="260" fill="#fbf4ea"/><rect x="20" y="40" width="200" height="140" fill="#e9dcc8"/><g fill="#d3c2a6"><rect x="20" y="88" width="200" height="6"/><rect x="20" y="136" width="200" height="6"/></g>' +
      '<g><rect x="30" y="56" width="26" height="32" rx="4" fill="#f28b8b"/><rect x="62" y="60" width="26" height="28" rx="4" fill="#f6c34f"/><rect x="94" y="56" width="26" height="32" rx="4" fill="#7fb9ec"/><rect x="160" y="58" width="26" height="30" rx="4" fill="#9ad18b"/>' +
      '<rect x="40" y="104" width="26" height="32" rx="4" fill="#c9a1ec"/><rect x="150" y="104" width="26" height="32" rx="4" fill="#f28b8b"/><rect x="182" y="108" width="26" height="28" rx="4" fill="#f6c34f"/></g><rect y="215" width="400" height="45" fill="#e2d6c2"/>',
    path: '<rect width="400" height="260" fill="#dcefff"/><rect y="160" width="400" height="100" fill="#bfe3a5"/><path d="M0 200 Q200 180 400 205 L400 260 L0 260z" fill="#e3cfa5"/>' +
      '<g fill="#8ccf7a"><circle cx="350" cy="150" r="20"/><circle cx="375" cy="160" r="16"/></g>',
    sky: '<defs><linearGradient id="dtsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe2fb"/><stop offset="1" stop-color="#f7e3ef"/></linearGradient></defs>' +
      '<rect width="400" height="260" fill="url(#dtsky)"/><rect y="215" width="400" height="45" fill="#cfe8b8"/>'
  };

  // 人の種類：[シャツの色, 髪の色, 大きさ（child|small|adult）, 髪型]
  var PEOPLE = {
    me: ['#f6b73c', '#4a3426', 'child', 'short'],
    meSit: ['#f6b73c', '#4a3426', 'child', 'short', 'sit'],
    friend: ['#5aa0e0', '#2b2b2b', 'child', 'short'],
    friendDown: ['#5aa0e0', '#2b2b2b', 'child', 'short', 'down'],
    child: ['#7cc28a', '#5a3a22', 'child', 'bob'],
    child2: ['#e889b5', '#2b2b2b', 'child', 'bob'],
    newkid: ['#b38be0', '#c9832e', 'child', 'curly'],
    ema: ['#ff9ec4', '#4a3426', 'small', 'pig'],
    papa: ['#4f7fb8', '#2f2f2f', 'adult', 'short'],
    mama: ['#e77f7f', '#5a3a22', 'adult', 'long'],
    teacher: ['#5b9a7b', '#3b3b3b', 'adult', 'short', 'glasses'],
    elder: ['#a28c6c', '#c8c8c8', 'adult', 'short', 'cane'],
    stranger: ['#8b8f99', '#3b3b3b', 'adult', 'hat'],
    adultSit: ['#8fa3b8', '#3b3b3b', 'adult', 'short', 'sit']
  };
  var SKIN = '#ffd9b8';

  function face(cx, cy, r, mood) {
    var ex = r * 0.38, ey = cy - r * 0.05, out = '';
    if (mood === 'smile') {
      out += '<path d="M' + (cx - ex - 4) + ' ' + ey + ' q4 -5 8 0 M' + (cx + ex - 4) + ' ' + ey + ' q4 -5 8 0" stroke="#3a3a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    } else {
      out += '<circle cx="' + (cx - ex) + '" cy="' + ey + '" r="2.8" fill="#3a3a3a"/><circle cx="' + (cx + ex) + '" cy="' + ey + '" r="2.8" fill="#3a3a3a"/>';
    }
    var my = cy + r * 0.42;
    if (mood === 'smile') out += '<path d="M' + (cx - 7) + ' ' + (my - 3) + ' q7 8 14 0" stroke="#c4553a" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    else if (mood === 'sad' || mood === 'cry') out += '<path d="M' + (cx - 6) + ' ' + (my + 3) + ' q6 -6 12 0" stroke="#7a4a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    else if (mood === 'think') out += '<circle cx="' + cx + '" cy="' + my + '" r="2.6" fill="none" stroke="#7a4a3a" stroke-width="2"/>';
    else out += '<path d="M' + (cx - 5) + ' ' + my + 'h10" stroke="#7a4a3a" stroke-width="2.5" stroke-linecap="round"/>';
    if (mood === 'cry') out += '<path d="M' + (cx - ex) + ' ' + (ey + 5) + ' q-3 7 0 10 q3 -3 0 -10z M' + (cx + ex) + ' ' + (ey + 5) + ' q-3 7 0 10 q3 -3 0 -10z" fill="#7cc4ea"/>';
    out += '<ellipse cx="' + (cx - r * 0.62) + '" cy="' + (cy + r * 0.22) + '" rx="4" ry="2.6" fill="#ffa6a6" opacity=".7"/><ellipse cx="' + (cx + r * 0.62) + '" cy="' + (cy + r * 0.22) + '" rx="4" ry="2.6" fill="#ffa6a6" opacity=".7"/>';
    if (mood === 'think') out += '<text x="' + (cx + r + 4) + '" y="' + (cy - r) + '" font-size="22" font-weight="bold" fill="#6d55a3">?</text>';
    return out;
  }
  function hair(cx, cy, r, color, style) {
    var o = '';
    if (style === 'long') o += '<rect x="' + (cx - r - 4) + '" y="' + (cy - 4) + '" width="' + (r * 0.7) + '" height="' + (r * 1.7) + '" rx="' + (r * 0.3) + '" fill="' + color + '"/>' +
      '<rect x="' + (cx + r * 0.3 + 4) + '" y="' + (cy - 4) + '" width="' + (r * 0.7) + '" height="' + (r * 1.7) + '" rx="' + (r * 0.3) + '" fill="' + color + '"/>';
    if (style === 'pig') o += '<circle cx="' + (cx - r - 3) + '" cy="' + (cy + 2) + '" r="' + (r * 0.4) + '" fill="' + color + '"/><circle cx="' + (cx + r + 3) + '" cy="' + (cy + 2) + '" r="' + (r * 0.4) + '" fill="' + color + '"/>';
    if (style === 'curly') o += '<circle cx="' + (cx - r * 0.7) + '" cy="' + (cy - r * 0.7) + '" r="' + (r * 0.45) + '" fill="' + color + '"/><circle cx="' + (cx + r * 0.7) + '" cy="' + (cy - r * 0.7) + '" r="' + (r * 0.45) + '" fill="' + color + '"/>';
    if (style === 'bob') o += '<path d="M' + (cx - r - 2) + ' ' + (cy + r * 0.4) + ' v-' + (r * 0.6) + ' a' + (r + 2) + ' ' + (r + 2) + ' 0 0 1 ' + (r * 2 + 4) + ' 0 v' + (r * 0.6) + 'z" fill="' + color + '"/>';
    return o;
  }
  function person(kind, x, mood) {
    var k = PEOPLE[kind] || PEOPLE.me;
    var shirt = k[0], hc = k[1], size = k[2], style = k[3], extra = k[4];
    var scale = size === 'adult' ? 1.45 : size === 'small' ? 0.82 : 1;
    var ground = 240;
    var r = 17 * Math.sqrt(scale);                 // 頭は体ほど大きくしない
    var bodyH = 34 * scale, legH = 30 * scale, w = 30 * scale;
    var o = '';
    if (extra === 'sit') ground = 205;              // 座席にすわる
    if (extra === 'down') { ground = 240; legH = 0; }
    var bodyTop = ground - legH - bodyH;
    var cy = bodyTop - r + 3;
    if (extra === 'cane') { bodyTop += 6; cy += 8; x -= 4; }
    o += '<ellipse cx="' + x + '" cy="' + (ground + 2) + '" rx="' + (w * 0.8) + '" ry="4" fill="rgba(0,0,0,.08)"/>';
    // 足
    if (extra === 'sit') {                         // ひざを前に出して、足は床へ
      o += '<path d="M' + (x - w * 0.22) + ' ' + (ground - 4) + 'h' + (w * 0.5) + 'v' + (236 - ground) + 'M' + (x + w * 0.1) + ' ' + (ground - 2) + 'h' + (w * 0.5) + 'v' + (236 - ground) + '" stroke="#5b6f8a" stroke-width="' + (9 * scale) + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    } else if (extra === 'down') {
      o += '<path d="M' + (x - w * 0.3) + ' ' + (ground - 4) + 'h-' + (w * 0.2) + 'M' + (x + w * 0.3) + ' ' + (ground - 4) + 'h' + (w * 0.9) + '" stroke="#5b6f8a" stroke-width="' + (9 * scale) + '" stroke-linecap="round"/>';
    } else {
      o += '<path d="M' + (x - w * 0.22) + ' ' + (ground - legH) + 'v' + legH + 'M' + (x + w * 0.22) + ' ' + (ground - legH) + 'v' + legH + '" stroke="#5b6f8a" stroke-width="' + (9 * scale) + '" stroke-linecap="round"/>';
    }
    // うで
    o += '<path d="M' + (x - w / 2) + ' ' + (bodyTop + 8) + 'l-' + (8 * scale) + ' ' + (20 * scale) + 'M' + (x + w / 2) + ' ' + (bodyTop + 8) + 'l' + (8 * scale) + ' ' + (20 * scale) + '" stroke="' + shirt + '" stroke-width="' + (8 * scale) + '" stroke-linecap="round"/>';
    // からだ
    o += '<rect x="' + (x - w / 2) + '" y="' + bodyTop + '" width="' + w + '" height="' + (bodyH + 4) + '" rx="' + (10 * scale) + '" fill="' + shirt + '"/>';
    if (extra === 'cane') o += '<path d="M' + (x + w / 2 + 10) + ' ' + (bodyTop + 26) + 'v' + (ground - bodyTop - 26) + '" stroke="#7a5a3a" stroke-width="4" stroke-linecap="round"/>';
    // あたま
    o += hair(x, cy, r, hc, style);
    o += '<circle cx="' + x + '" cy="' + cy + '" r="' + r + '" fill="' + SKIN + '"/>';
    if (style === 'hat') o += '<path d="M' + (x - r - 6) + ' ' + (cy - r * 0.45) + 'h' + (r * 2 + 12) + '" stroke="#5a5f6b" stroke-width="5" stroke-linecap="round"/><rect x="' + (x - r * 0.8) + '" y="' + (cy - r * 1.25) + '" width="' + (r * 1.6) + '" height="' + (r * 0.8) + '" rx="4" fill="#5a5f6b"/>';
    else o += '<path d="M' + (x - r) + ' ' + (cy - 2) + ' a' + r + ' ' + r + ' 0 0 1 ' + (r * 2) + ' 0 q-' + r + ' -' + (r * 0.55) + ' -' + (r * 2) + ' 0z" fill="' + hc + '"/>';
    o += face(x, cy + 3, r, mood);
    if (extra === 'glasses') o += '<g fill="none" stroke="#3a3a3a" stroke-width="1.8"><circle cx="' + (x - r * 0.38) + '" cy="' + (cy + 2) + '" r="5"/><circle cx="' + (x + r * 0.38) + '" cy="' + (cy + 2) + '" r="5"/></g>';
    return o;
  }

  var PROPS = {
    shoes: function (x, y) { return '<g fill="#e46f6f"><ellipse cx="' + (x - 10) + '" cy="' + y + '" rx="11" ry="5"/><ellipse cx="' + (x + 12) + '" cy="' + y + '" rx="11" ry="5"/></g>'; },
    phone: function (x, y) { return '<rect x="' + (x - 30) + '" y="' + (y + 20) + '" width="60" height="45" fill="#c9a77d"/><rect x="' + (x - 22) + '" y="' + y + '" width="44" height="24" rx="6" fill="#f0f0f0" stroke="#999" stroke-width="2"/><path d="M' + (x - 18) + ' ' + (y - 4) + 'q18 -10 36 0" stroke="#e46f6f" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M' + (x + 26) + ' ' + (y - 14) + 'l8 -6M' + (x + 30) + ' ' + (y - 4) + 'l10 0" stroke="#f0a800" stroke-width="3" stroke-linecap="round"/>'; },
    eraser: function (x, y) { return '<rect x="' + (x - 12) + '" y="' + (y - 7) + '" width="24" height="14" rx="3" fill="#fff" stroke="#9ab" stroke-width="2"/><rect x="' + (x - 12) + '" y="' + (y - 7) + '" width="10" height="14" fill="#6fa3e4"/>'; },
    table: function (x, y) { return '<rect x="' + (x - 70) + '" y="' + y + '" width="140" height="10" rx="4" fill="#b98a5e"/><path d="M' + (x - 60) + ' ' + (y + 10) + 'v30M' + (x + 60) + ' ' + (y + 10) + 'v30" stroke="#a3764c" stroke-width="6"/><ellipse cx="' + (x - 25) + '" cy="' + (y - 6) + '" rx="18" ry="9" fill="#fff" stroke="#d3c2a6" stroke-width="2"/><ellipse cx="' + (x + 25) + '" cy="' + (y - 6) + '" rx="18" ry="9" fill="#fff" stroke="#d3c2a6" stroke-width="2"/><path d="M' + (x - 34) + ' ' + (y - 10) + 'q9 -10 18 0" fill="#f2c04f"/><path d="M' + (x + 16) + ' ' + (y - 10) + 'q9 -10 18 0" fill="#9ad18b"/>'; },
    bump: function (x, y) { return '<path d="M' + x + ' ' + (y - 16) + 'l5 10 11 -3 -6 10 9 7 -11 2 0 11 -8 -8 -8 8 0 -11 -11 -2 9 -7 -6 -10 11 3z" fill="#ffe08a" stroke="#f0a800" stroke-width="2"/>'; },
    pencil: function (x, y) { return '<g transform="rotate(-20 ' + x + ' ' + y + ')"><rect x="' + (x - 30) + '" y="' + (y - 5) + '" width="26" height="10" fill="#f2c04f"/><rect x="' + (x + 4) + '" y="' + (y - 5) + '" width="22" height="10" fill="#f2c04f"/><path d="M' + (x + 26) + ' ' + (y - 5) + 'l10 5 -10 5z" fill="#e8c9a0"/></g><path d="M' + (x - 2) + ' ' + (y - 14) + 'l4 8M' + (x + 6) + ' ' + (y - 16) + 'l-1 9" stroke="#e46f6f" stroke-width="2.5" stroke-linecap="round"/>'; },
    note: function (x, y) { return '<rect x="' + (x - 18) + '" y="' + (y - 22) + '" width="36" height="44" rx="3" fill="#fff" stroke="#6fa3e4" stroke-width="3"/><path d="M' + (x - 10) + ' ' + (y - 8) + 'h20M' + (x - 10) + ' ' + (y + 2) + 'h20M' + (x - 10) + ' ' + (y + 12) + 'h14" stroke="#c9d8ea" stroke-width="2"/>'; },
    slide: function (x, y) { return '<path d="M' + (x - 40) + ' 240V' + y + 'h24V240" stroke="#7aa0d6" stroke-width="6" fill="none"/><path d="M' + (x - 16) + ' ' + y + 'L' + (x + 60) + ' 236" stroke="#e46f6f" stroke-width="12" stroke-linecap="round"/><path d="M' + (x - 40) + ' ' + (y + 30) + 'h24M' + (x - 40) + ' ' + (y + 60) + 'h24M' + (x - 40) + ' ' + (y + 90) + 'h24" stroke="#7aa0d6" stroke-width="4"/>'; },
    crayon: function (x, y) { return '<g transform="rotate(-15 ' + x + ' ' + y + ')"><rect x="' + (x - 18) + '" y="' + (y - 6) + '" width="30" height="12" rx="2" fill="#e46f6f"/><path d="M' + (x + 12) + ' ' + (y - 6) + 'l10 6 -10 6z" fill="#c94f4f"/></g>'; },
    ball: function (x, y) { return '<circle cx="' + x + '" cy="' + (y - 12) + '" r="12" fill="#ff8a5c"/><path d="M' + (x - 12) + ' ' + (y - 12) + 'h24M' + x + ' ' + (y - 24) + 'v24" stroke="#fff" stroke-width="2"/>'; },
    ballWater: function (x, y) { return '<circle cx="' + x + '" cy="' + (y - 6) + '" r="13" fill="#ff8a5c"/><path d="M' + (x - 28) + ' ' + (y + 4) + 'q8 -6 16 0 q8 6 16 0 q8 -6 16 0 q8 6 16 0" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8"/>'; },
    toy: function (x, y) { return '<circle cx="' + x + '" cy="' + (y - 18) + '" r="14" fill="#c9a06b"/><circle cx="' + (x - 11) + '" cy="' + (y - 30) + '" r="6" fill="#c9a06b"/><circle cx="' + (x + 11) + '" cy="' + (y - 30) + '" r="6" fill="#c9a06b"/><ellipse cx="' + x + '" cy="' + (y + 4) + '" rx="15" ry="13" fill="#c9a06b"/><circle cx="' + (x - 5) + '" cy="' + (y - 20) + '" r="2" fill="#3a3a3a"/><circle cx="' + (x + 5) + '" cy="' + (y - 20) + '" r="2" fill="#3a3a3a"/>'; },
    toys: function (x, y) { return '<rect x="' + (x - 50) + '" y="' + (y + 10) + '" width="22" height="22" fill="#e46f6f"/><rect x="' + (x - 10) + '" y="' + (y + 16) + '" width="22" height="22" fill="#6fa3e4" transform="rotate(20 ' + x + ' ' + (y + 26) + ')"/><rect x="' + (x + 30) + '" y="' + (y + 8) + '" width="22" height="22" fill="#f2c04f"/><circle cx="' + (x + 70) + '" cy="' + (y + 26) + '" r="10" fill="#7cc28a"/><path d="M' + (x - 80) + ' ' + (y + 34) + 'h30" stroke="#b38be0" stroke-width="8" stroke-linecap="round"/>'; },
    box: function (x, y) { return '<rect x="' + (x - 34) + '" y="' + y + '" width="68" height="46" rx="6" fill="#f2c04f" stroke="#d9a730" stroke-width="3"/><path d="M' + (x - 34) + ' ' + (y + 12) + 'h68" stroke="#d9a730" stroke-width="3"/>'; },
    soap: function (x, y) { return '<rect x="' + (x - 40) + '" y="' + (y + 18) + '" width="80" height="16" rx="6" fill="#dfe8f0"/><ellipse cx="' + x + '" cy="' + (y + 12) + '" rx="16" ry="9" fill="#ffc6dd"/><g fill="#fff" stroke="#9ccbea" stroke-width="2"><circle cx="' + (x - 10) + '" cy="' + (y - 8) + '" r="7"/><circle cx="' + (x + 8) + '" cy="' + (y - 18) + '" r="9"/><circle cx="' + (x + 20) + '" cy="' + (y - 2) + '" r="5"/></g>'; },
    germ: function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="13" fill="#9ad18b"/><path d="M' + (x - 13) + ' ' + y + 'h-6M' + (x + 13) + ' ' + y + 'h6M' + x + ' ' + (y - 13) + 'v-6M' + x + ' ' + (y + 13) + 'v6" stroke="#9ad18b" stroke-width="4" stroke-linecap="round"/><circle cx="' + (x - 4) + '" cy="' + (y - 2) + '" r="2" fill="#3a3a3a"/><circle cx="' + (x + 4) + '" cy="' + (y - 2) + '" r="2" fill="#3a3a3a"/>'; },
    tv: function (x, y) { return '<rect x="' + (x - 45) + '" y="' + (y - 35) + '" width="90" height="62" rx="6" fill="#3a3f4a"/><rect x="' + (x - 38) + '" y="' + (y - 28) + '" width="76" height="48" rx="3" fill="#8fd0f0"/><circle cx="' + (x - 10) + '" cy="' + (y - 4) + '" r="8" fill="#ffe08a"/><path d="M' + (x - 20) + ' ' + (y + 30) + 'h40" stroke="#3a3f4a" stroke-width="6"/><rect x="' + (x - 50) + '" y="' + (y + 34) + '" width="100" height="30" fill="#b98a5e"/>'; },
    moon: function (x, y) { return '<path d="M' + x + ' ' + (y - 18) + 'a18 18 0 1 0 14 30 a14 14 0 1 1 -14 -30z" fill="#ffe08a"/>'; },
    clock: function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="26" fill="#fff" stroke="#7aa0d6" stroke-width="5"/><path d="M' + x + ' ' + y + 'v-16M' + x + ' ' + y + 'h13" stroke="#3a3a3a" stroke-width="3.5" stroke-linecap="round"/><text x="' + x + '" y="' + (y - 9) + '" font-size="8" text-anchor="middle" fill="#7aa0d6">12</text><text x="' + (x + 18) + '" y="' + (y + 3) + '" font-size="8" text-anchor="middle" fill="#7aa0d6">3</text>'; },
    candy: function (x, y) { return '<path d="M' + (x - 22) + ' ' + (y - 8) + 'l10 8 -10 8zM' + (x + 22) + ' ' + (y - 8) + 'l-10 8 10 8z" fill="#f28b8b"/><ellipse cx="' + x + '" cy="' + y + '" rx="13" ry="10" fill="#f6c34f"/>'; },
    question: function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="18" fill="#fff" stroke="#b38be0" stroke-width="3"/><text x="' + x + '" y="' + (y + 9) + '" font-size="26" font-weight="bold" text-anchor="middle" fill="#6d55a3">?</text>'; },
    signal: function (x, y) { return '<path d="M' + x + ' ' + (y + 60) + 'V236" stroke="#6b7480" stroke-width="7"/><rect x="' + (x - 18) + '" y="' + y + '" width="36" height="66" rx="8" fill="#3a3f4a"/><circle cx="' + x + '" cy="' + (y + 18) + '" r="11" fill="#ff5a4f"/><circle cx="' + x + '" cy="' + (y + 46) + '" r="11" fill="#4a5a50"/><path d="M' + (x - 24) + ' ' + (y + 18) + 'h-6M' + (x + 24) + ' ' + (y + 18) + 'h6" stroke="#ff5a4f" stroke-width="3" stroke-linecap="round"/>'; },
    book: function (x, y) { return '<path d="M' + x + ' ' + (y + 4) + 'q-22 -10 -40 0v-26q18 -10 40 0z" fill="#fff" stroke="#6fa3e4" stroke-width="3"/><path d="M' + x + ' ' + (y + 4) + 'q22 -10 40 0v-26q-18 -10 -40 0z" fill="#fff" stroke="#6fa3e4" stroke-width="3"/>'; },
    snack: function (x, y) { return '<path d="M' + (x - 20) + ' ' + (y - 28) + 'h40l-4 56h-32z" fill="#f28b8b"/><path d="M' + (x - 20) + ' ' + (y - 28) + 'l4 -6h32l4 6" fill="#e46f6f"/><circle cx="' + x + '" cy="' + (y + 2) + '" r="10" fill="#ffe08a"/>'; },
    dangomushi: function (x, y) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="22" ry="12" fill="#6b6f7a"/><path d="M' + (x - 12) + ' ' + (y - 11) + 'v22M' + (x - 2) + ' ' + (y - 12) + 'v24M' + (x + 8) + ' ' + (y - 11) + 'v22" stroke="#8a8f9a" stroke-width="2.5"/><circle cx="' + (x + 19) + '" cy="' + (y - 2) + '" r="2" fill="#fff"/><path d="M' + (x + 22) + ' ' + (y - 6) + 'l7 -6M' + (x + 22) + ' ' + (y - 4) + 'l8 -2" stroke="#6b6f7a" stroke-width="2" stroke-linecap="round"/>'; },
    flowers: function (x, y) {
      var o = '<rect x="' + (x - 90) + '" y="' + (y + 10) + '" width="180" height="26" rx="6" fill="#a3764c"/>';
      [-70, -35, 0, 35, 70].forEach(function (dx, i) {
        var col = ['#ff8fb1', '#ffd23f', '#ff8a5c', '#b38be0', '#ff8fb1'][i];
        o += '<path d="M' + (x + dx) + ' ' + (y + 12) + 'v-26" stroke="#5aa055" stroke-width="3"/><circle cx="' + (x + dx) + '" cy="' + (y - 18) + '" r="11" fill="' + col + '"/><circle cx="' + (x + dx) + '" cy="' + (y - 18) + '" r="4" fill="#fff3b0"/>';
      });
      return o;
    },
    cat: function (x, y) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="28" ry="18" fill="#f2a65a"/><circle cx="' + (x - 22) + '" cy="' + (y - 18) + '" r="15" fill="#f2a65a"/><path d="M' + (x - 34) + ' ' + (y - 26) + 'l2 -14 8 9zM' + (x - 18) + ' ' + (y - 31) + 'l8 -10 2 13z" fill="#f2a65a"/><circle cx="' + (x - 27) + '" cy="' + (y - 19) + '" r="2" fill="#3a3a3a"/><circle cx="' + (x - 18) + '" cy="' + (y - 19) + '" r="2" fill="#3a3a3a"/><path d="M' + (x - 26) + ' ' + (y - 12) + 'q3 3 6 0" stroke="#7a4a3a" stroke-width="1.8" fill="none"/><path d="M' + (x + 26) + ' ' + (y - 4) + 'q16 -6 12 -26" stroke="#f2a65a" stroke-width="7" fill="none" stroke-linecap="round"/><text x="' + (x - 50) + '" y="' + (y - 38) + '" font-size="15" font-weight="bold" fill="#c4553a">にゃー</text>'; },
    bowl: function (x, y) { return '<path d="M' + (x - 18) + ' ' + (y - 8) + 'h36l-6 14h-24z" fill="#6fa3e4"/>'; },
    game: function (x, y) { return '<rect x="' + (x - 50) + '" y="' + (y - 30) + '" width="100" height="62" rx="12" fill="#5a5f6b"/><rect x="' + (x - 30) + '" y="' + (y - 22) + '" width="60" height="44" rx="4" fill="#cfe9fb"/><circle cx="' + (x - 40) + '" cy="' + y + '" r="5" fill="#e46f6f"/><circle cx="' + (x + 40) + '" cy="' + y + '" r="5" fill="#7cc28a"/>' +
      '<rect x="' + (x - 10) + '" y="' + (y - 90) + '" width="96" height="44" rx="12" fill="#fff" stroke="#b38be0" stroke-width="3"/><path d="M' + (x + 4) + ' ' + (y - 47) + 'l-8 14 18 -14" fill="#fff" stroke="#b38be0" stroke-width="3"/><text x="' + (x + 38) + '" y="' + (y - 60) + '" font-size="26" font-weight="bold" text-anchor="middle" fill="#6d55a3">?</text>'; },
    gift: function (x, y) { return '<rect x="' + (x - 20) + '" y="' + (y - 16) + '" width="40" height="34" rx="3" fill="#ff8fb1"/><path d="M' + x + ' ' + (y - 16) + 'v34M' + (x - 20) + ' ' + y + 'h40" stroke="#ffd23f" stroke-width="5"/><path d="M' + x + ' ' + (y - 16) + 'q-12 -14 -14 -2zM' + x + ' ' + (y - 16) + 'q12 -14 14 -2z" fill="#ffd23f"/>'; },
    picture: function (x, y) { return '<rect x="' + (x - 34) + '" y="' + (y - 26) + '" width="68" height="52" fill="#fff" stroke="#d3c2a6" stroke-width="3"/><circle cx="' + (x - 14) + '" cy="' + (y - 8) + '" r="9" fill="#ffd23f"/><path d="M' + (x - 30) + ' ' + (y + 20) + 'l20 -18 14 12 10 -8 16 14z" fill="#7cc28a"/>'; },
    coin: function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="16" fill="#f2c04f" stroke="#d9a730" stroke-width="3"/><circle cx="' + (x + 22) + '" cy="' + (y + 6) + '" r="12" fill="#d8dde3" stroke="#aab2bb" stroke-width="3"/>'; },
    heart: function (x, y) { return '<path d="M' + x + ' ' + (y + 12) + 'C' + (x - 22) + ' ' + (y - 2) + ' ' + (x - 12) + ' ' + (y - 20) + ' ' + x + ' ' + (y - 8) + 'C' + (x + 12) + ' ' + (y - 20) + ' ' + (x + 22) + ' ' + (y - 2) + ' ' + x + ' ' + (y + 12) + 'z" fill="#ff8fb1"/>'; },
    talk: function (x, y) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="22" ry="15" fill="#fff" stroke="#9ab" stroke-width="2"/><path d="M' + (x - 4) + ' ' + (y + 13) + 'l-4 10 12 -10" fill="#fff" stroke="#9ab" stroke-width="2"/><path d="M' + (x - 10) + ' ' + y + 'h20" stroke="#9ab" stroke-width="3" stroke-linecap="round"/>'; },
    catStar: function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="46" fill="#fff" opacity=".55"/><circle cx="' + x + '" cy="' + (y + 4) + '" r="22" fill="#f2a65a"/><path d="M' + (x - 20) + ' ' + (y - 8) + 'l2 -18 12 10zM' + (x + 20) + ' ' + (y - 8) + 'l-2 -18 -12 10z" fill="#f2a65a"/><path d="M' + (x - 11) + ' ' + (y + 2) + 'q4 -4 8 0M' + (x + 3) + ' ' + (y + 2) + 'q4 -4 8 0" stroke="#3a3a3a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M' + (x - 3) + ' ' + (y + 12) + 'q3 3 6 0" stroke="#7a4a3a" stroke-width="1.8" fill="none"/>' +
      '<path d="M' + (x + 40) + ' ' + (y - 40) + 'l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="#ffd23f"/><path d="M' + (x - 44) + ' ' + (y - 30) + 'l2 4 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z" fill="#ffd23f"/>'; }
  };

  function picture(pic) {
    pic = pic || {};
    var o = '<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + (BG[pic.bg] || BG.room);
    var props = pic.o || [];
    // 地面より奥の小物（y が小さい）→ 人 → 手前の小物
    props.forEach(function (p) { if (p[2] < 180 && PROPS[p[0]]) o += PROPS[p[0]](p[1], p[2]); });
    (pic.p || []).forEach(function (p) { o += person(p[0], p[1], p[2]); });
    props.forEach(function (p) { if (p[2] >= 180 && PROPS[p[0]]) o += PROPS[p[0]](p[1], p[2]); });
    return o + '</svg>';
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var sc = st.scene;
    return {
      phase: st.phase, id: sc ? sc.id : null, name: sc ? sc.name : null, kind: sc ? sc.kind : null,
      choices: st.order.map(function (c) { return { idx: c.idx, text: c.text, good: c.good }; }),
      tried: st.attempt ? st.attempt.tried.slice() : [],
      result: st.result ? st.result.kind : null,
      waiting: !!pendingFn, index: st.index, list: st.list.slice(),
      solved: st.solved, stars: st.stars
    };
  }

  B.doutokuScreen = {
    show: show,
    _pick: function (pos) { pick(pos); },
    _next: flush,
    _again: againRound,
    _state: state,
    _picture: picture,
    _people: PEOPLE, _props: PROPS, _bg: BG
  };
})();
