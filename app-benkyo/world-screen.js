/* 「せかいの 国」の問題画面とごほうび画面。Chiid.benkyo.worldScreen
   出題・判定は Chiid.world（subjects/world.js）、国旗と地図は Chiid.worldData（subjects/world-data.js）、
   部品は Chiid.benkyo.ui（main.js）を使う。
   - 左：国旗 または 地図（大陸ごとに寄せる）。下に ぴよ と ふきだし（問い・返事・ひとこと説明）。
   - 右：3〜4つのボタン（国名 または 国旗）。
   - 正解 → その国が地図で緑に色づき、ひとこと説明を読む → 読み終わってから次へ（「つぎへ」で早めに進める）。
   - まちがい → 「もういっかい やってみよう！」。押したボタンは うすくなるだけ。2回まちがえたら こたえを見せる。
   - 10もんで区切り、5もんごとに星。問題のあいだで利用時間を確かめる（B.checkRest）。
   記録は1問1件：1回目で正解なら true。#app が無いとき（テスト）は描画せず、状態だけを動かす。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var B = (C.benkyo = C.benkyo || {});

  var MIN_GOOD = 2500;       // 正解のあと、次へ進むまでの最短（ms）
  var MIN_REVEAL = 3200;     // こたえを見せたあと、次へ進むまでの最短（ms）

  var st = null;             // いまの区切りの状態
  var view = null;           // 描画している要素（テストでは null）
  var pendingFn = null;      // 「つぎへ」で進む処理
  var pendSeq = 0;
  var talkSeq = 0;           // 読み上げの番号（新しい読み上げが始まったら、古い続きは読まない）

  function Wq() { return C.world; }
  function WD() { return C.worldData; }
  function U() { return B.ui; }
  function drawing() { return !!(B.ui && B.ui.hasApp && B.ui.hasApp()); }
  function play(name) { if (drawing()) U().play(name); }

  function talk(text) {
    var my = ++talkSeq;
    if (!drawing()) return Promise.resolve();
    var p = Promise.resolve();
    Wq().sentences(text).forEach(function (s) {
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
      profileId: pid, level: 1, recent: [], missCounts: {}, used: {}, lastId: null,
      q: null, attempt: null, result: null,
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
        var p = Wq().progressFromLogs(logs);
        st.level = p.level;
        st.recent = p.recent;
        st.missCounts = p.missCounts;
        startRound();
      });
  }

  function startRound() {
    st.solved = 0;
    st.stars = 0;
    st.used = {};
    pendingFn = null;
    buildScreen();
    nextQuestion();
  }

  function nextQuestion() {
    st.q = Wq().makeQuestion({ level: st.level, missCounts: st.missCounts, lastId: st.lastId, used: st.used }, st.rng);
    st.used[st.q.key] = true;
    st.lastId = st.q.type === 'cont' ? st.lastId : st.q.id;
    st.attempt = Wq().newAttempt();
    st.result = null;
    st.phase = 'question';
    st.mood = 'normal';
    paintQuestion();
    paint();
    talk(Wq().askSay(st.q));
  }

  /* ---------- えらぶ ---------- */
  function pick(choiceId) {
    if (!st || st.phase !== 'question') return;
    var r = Wq().choose(st.attempt, st.q, choiceId);
    if (r.kind === 'ignore') return;
    st.result = r.kind;
    if (r.kind === 'retry') {
      st.mood = 'think';
      play('oops');
      paint();
      talk(Wq().replySay(st.q, 'retry'));
      return;
    }
    if (r.kind === 'correct') { st.mood = 'happy'; play('correct'); }
    else { st.mood = 'normal'; play('oops'); }
    finish(r.kind === 'correct' && st.attempt.tries === 0);
    var said = talk(Wq().replySay(st.q, r.kind));
    waitAfter(said, r.kind === 'correct' ? MIN_GOOD : MIN_REVEAL);
  }

  // 1問おわり：記録（1問1件）・苦手・レベル・星
  function finish(correct) {
    var q = st.q;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: Wq().AREA, itemId: q.itemId, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[q.itemId] = (st.missCounts[q.itemId] || 0) + 1;
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, Wq().MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.solved++;
    st.phase = 'feedback';
    if (st.solved % Wq().STAR_EVERY === 0) {
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
      ui.later(function () { if (my === pendSeq) flush(); }, Math.max(rest, 900));
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
    if (st.solved >= Wq().ROUND_SIZE) { showReward(); return; }
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
    var app = ui.newScreen('world-reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-reward');
    var stars = ui.el('div', 'kk-r-stars');
    for (var i = 0; i < st.stars; i++) stars.appendChild(ui.svg(ui.STAR, 'kk-r-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'kk-r-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'kk-r-info');
    info.appendChild(ui.el('p', 'kk-r-msg', 'よく がんばったね！'));
    info.appendChild(ui.el('p', 'kk-r-sub', Wq().ROUND_SIZE + 'もん できたよ'));
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
    var app = ui.newScreen('world');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    var v = { app: app };

    var bar = ui.topBar({ home: true });
    var right = bar.querySelector('.tb-right');
    if (hasVoice) {
      var sp = ui.button('icon-btn kk-speak', function () {
        if (!st || !st.q) return;
        ui.play('tap');
        talk(st.phase === 'feedback' ? Wq().replySay(st.q, st.result) : Wq().askSay(st.q));
      });
      sp.setAttribute('aria-label', 'もういちど きく');
      sp.appendChild(ui.svg(ui.ICO.speaker));
      right.insertBefore(sp, right.firstChild);
    }
    app.appendChild(bar);

    var body = ui.el('div', 'wd-body');
    var main = ui.el('div', 'wd-main');
    v.stage = ui.el('div', 'wd-stage');
    v.flag = ui.el('div', 'wd-bigflag');
    v.map = ui.el('div', 'wd-map');
    v.map.innerHTML = WD().mapSvg();
    v.svg = v.map.querySelector('svg');
    v.ring = v.svg.querySelector('.wm-ring');
    v.countries = {};
    Array.prototype.forEach.call(v.svg.querySelectorAll('.wm-c'), function (p) { v.countries[p.getAttribute('data-id')] = p; });
    v.conts = {};
    Array.prototype.forEach.call(v.svg.querySelectorAll('.wm-cont'), function (p) { v.conts[p.getAttribute('data-cont')] = p; });
    v.stage.appendChild(v.map);
    v.stage.appendChild(v.flag);
    main.appendChild(v.stage);
    var talkRow = ui.el('div', 'wd-talk');
    v.who = ui.el('div', 'wd-who');
    talkRow.appendChild(v.who);
    v.bubble = ui.bubble('');
    v.bubble.classList.add('wd-msg');
    v.bubble.setAttribute('aria-live', 'polite');
    talkRow.appendChild(v.bubble);
    v.mini = ui.el('div', 'wd-mini');
    talkRow.appendChild(v.mini);
    main.appendChild(talkRow);
    body.appendChild(main);

    var side = ui.el('div', 'wd-side');
    v.list = ui.el('div', 'wd-choices');
    side.appendChild(v.list);
    var foot = ui.el('div', 'wd-foot');
    var prog = ui.el('div', 'kk-prog');
    v.dots = [];
    var dots = ui.el('div', 'kk-dots');
    for (var k = 0; k < Wq().ROUND_SIZE; k++) {
      var d = ui.el('span', 'kk-dot');
      v.dots.push(d);
      dots.appendChild(d);
    }
    prog.appendChild(dots);
    v.stars = ui.el('div', 'kk-stars');
    prog.appendChild(v.stars);
    foot.appendChild(prog);
    v.next = ui.button('btn-big wd-next', function () { if (pendingFn) { ui.play('tap'); flush(); } });
    v.next.appendChild(ui.svg(ui.ICO.next));
    v.next.appendChild(ui.el('span', null, 'つぎへ'));
    foot.appendChild(v.next);
    side.appendChild(foot);
    body.appendChild(side);
    app.appendChild(body);
    v.body = body;
    v.btns = [];
    v.mood = null;
    v.starsShown = -1;
    view = v;
  }

  // 問題が変わったときだけ描く（国旗・選択肢）
  function paintQuestion() {
    if (!view || !st || !st.q || !drawing()) return;
    var ui = U(), v = view, q = st.q;
    v.flag.innerHTML = q.type === 'flag' ? WD().flagSvg(q.id) : '';
    v.stage.classList.toggle('is-flag', q.type === 'flag');
    v.list.innerHTML = '';
    v.list.className = 'wd-choices n' + q.choices.length + (q.type === 'pick' ? ' is-flags' : ' is-names');
    v.btns = q.choices.map(function (id) {
      var b = ui.button('wd-choice', function () { onPick(id); });
      b.setAttribute('data-id', id);
      if (q.type === 'pick') {
        b.innerHTML = WD().flagSvg(id);
        b.setAttribute('aria-label', 'こっき');
      } else {
        ui.fillR(b, Wq().nameOf(q.type, id));
        b.setAttribute('aria-label', Wq().plain(Wq().nameOf(q.type, id)));
      }
      v.list.appendChild(b);
      return { id: id, el: b };
    });
  }

  function onPick(id) {
    if (pendingFn) return;          // 次へ進む待ちのあいだは、えらべない
    pick(id);
  }

  // 地図：寄せる範囲・光る国（大陸）・色づいた国（大陸）・丸
  function paintMap() {
    var v = view, q = st.q, fb = st.phase === 'feedback';
    var showMap = q.type !== 'flag' || fb;
    v.stage.classList.toggle('show-map', showMap);
    v.svg.classList.toggle('cont-mode', q.type === 'cont');   // 大陸の問題では、国は線だけ（大陸の色が見えるように）
    Object.keys(v.countries).forEach(function (id) { v.countries[id].classList.remove('hl', 'ok'); });
    Object.keys(v.conts).forEach(function (id) { v.conts[id].classList.remove('hl', 'ok'); });
    var vb, box = null, cls = fb ? 'ok' : 'hl';
    if (q.type === 'cont') {
      vb = WD().viewBoxOf('world');
      if (v.conts[q.id]) v.conts[q.id].classList.add(cls);
    } else {
      var c = Wq().byId(q.id);
      vb = WD().viewBoxOf(c.region);
      if (v.countries[q.id]) v.countries[q.id].classList.add(cls);
      box = c.bbox;
    }
    v.svg.setAttribute('viewBox', vb.join(' '));
    // 丸は、小さい国（寄せても小さく見える国）だけ
    var small = box && Math.sqrt(Math.pow(box.x2 - box.x1, 2) + Math.pow(box.y2 - box.y1, 2)) < vb[2] * 0.16;
    if (small) {
      var cx = (box.x1 + box.x2) / 2, cy = (box.y1 + box.y2) / 2;
      var half = Math.sqrt(Math.pow(box.x2 - box.x1, 2) + Math.pow(box.y2 - box.y1, 2)) / 2;
      var r = Math.max(half * 1.1 + vb[2] * 0.012, vb[2] * 0.035);
      v.ring.setAttribute('cx', cx.toFixed(1));
      v.ring.setAttribute('cy', cy.toFixed(1));
      v.ring.setAttribute('r', r.toFixed(1));
      v.ring.setAttribute('class', 'wm-ring on' + (fb ? ' ok' : ''));
    } else {
      v.ring.setAttribute('class', 'wm-ring');
    }
  }

  function paint() {
    if (!view || !st || !st.q || !drawing()) return;
    var ui = U(), v = view, q = st.q, fb = st.phase === 'feedback';
    paintMap();
    var tried = st.attempt ? st.attempt.tried : [];
    v.btns.forEach(function (b) {
      var wasTried = tried.indexOf(b.id) >= 0;
      var isAns = b.id === q.answer;
      b.el.classList.toggle('tried', wasTried && !isAns);
      b.el.classList.toggle('chosen', fb && isAns && st.result === 'correct');
      b.el.classList.toggle('answer', fb && isAns && st.result === 'reveal');
      b.el.disabled = st.phase !== 'question' || wasTried;
    });
    var msg = st.result ? Wq().replyText(q, st.result) : Wq().askText(q);
    ui.fillR(v.bubble, msg);
    v.bubble.classList.toggle('good', st.result === 'correct');
    // 正解のあと：その国の国旗を小さく（国旗がある国）
    v.mini.innerHTML = fb && q.type !== 'cont' ? WD().flagSvg(q.id, 'wflag wd-miniflag') : '';
    v.mini.classList.toggle('on', fb && q.type !== 'cont');
    if (v.mood !== st.mood) {
      v.who.innerHTML = '';
      v.who.appendChild(ui.chara(st.mood));
      v.mood = st.mood;
    }
    for (var k = 0; k < v.dots.length; k++) v.dots[k].classList.toggle('on', k < st.solved);
    if (v.starsShown !== st.stars) {
      v.stars.innerHTML = '';
      for (var s = 0; s < st.stars; s++) {
        v.stars.appendChild(ui.svg(ui.STAR, 'kk-star' + (s === st.stars - 1 && v.starsShown >= 0 ? ' pop' : '')));
      }
      v.starsShown = st.stars;
    }
    v.next.classList.toggle('on', fb);
    v.body.classList.toggle('is-wait', st.phase !== 'question');
  }

  /* ---------- テスト用 ---------- */
  function state() {
    if (!st) return null;
    var q = st.q;
    return {
      phase: st.phase, level: st.level, type: q ? q.type : null, id: q ? q.id : null, answer: q ? q.answer : null,
      itemId: q ? q.itemId : null, choices: q ? q.choices.slice() : [],
      tried: st.attempt ? st.attempt.tried.slice() : [], tries: st.attempt ? st.attempt.tries : 0,
      result: st.result, waiting: !!pendingFn, solved: st.solved, stars: st.stars,
      used: Object.keys(st.used)
    };
  }

  B.worldScreen = {
    show: show,
    _pick: function (id) { pick(id); },
    _next: flush,
    _again: againRound,
    _state: state
  };
})();
