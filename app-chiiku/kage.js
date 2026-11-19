/* かげあわせ。Chiid.kage
   黒い かげ（シルエット）を 見て、同じ形の 絵を えらぶ。レベル1〜5。5問で ごほうび。
   園児が見る文字は、ひらがなだけ。通信は行わない。設計書：docs/superpowers/specs/2026-11-19-chiiku-kage-design.md
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'kage';
  var MAX_LEVEL = 5;
  var ROUND = 5;
  var WAIT_RIGHT = 1500;
  var VOICE_AFTER = 400;   // 正解の音の あと、少し あけてから 声
  // n：えらぶ数。mix：'other'（ちがう なかまだけ）／'some'（同じ なかま2つ以上）／'all'（ぜんぶ 同じ なかま）。flip：左右 はんたいの かげ
  var LEVELS = {
    1: { n: 3, mix: 'other' },
    2: { n: 4, mix: 'other' },
    3: { n: 4, mix: 'some' },
    4: { n: 6, mix: 'all' },
    5: { n: 6, mix: 'all', flip: true }
  };
  // 絵（Unicode 12 以前の絵文字）。g：なかま
  var ITEMS = [];
  function grp(g, list) { list.forEach(function (p) { ITEMS.push({ pic: p, g: g }); }); }
  grp('animal', ['🐶', '🐱', '🐰', '🐻', '🐼', '🦁', '🐸', '🐵', '🐷', '🐘', '🦒', '🐧', '🐔', '🦊']);
  grp('food', ['🍎', '🍌', '🍉', '🍓', '🍇', '🍒', '🍍', '🥕', '🌽', '🍞', '🍙', '🍦', '🍰']);
  grp('ride', ['🚗', '🚌', '🚑', '🚒', '🚲', '🚂', '✈️', '🚀', '🚁', '⛵', '🚜']);
  grp('life', ['🦋', '🐞', '🐝', '🐌', '🐙', '🦀', '🐢', '🐟', '🐬', '🐳', '🦈']);
  grp('thing', ['✂️', '🔑', '🔨', '☂️', '⏰', '👓', '🎈', '⚽', '🎸', '🧸', '🎁']);
  var TEXT = {
    choose: 'どれに する？', ask: 'おなじ かたちは どれかな？', right: 'せいかい！',
    retry: 'もういっかい、えらんでみよう', reveal: 'これだよ', reward: 'すごい！ よく みつけたね'
  };

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // 1問：答え（かげの 絵）と えらぶ 絵。avoid：つづけて 同じ 答えに しない
  function makeQuestion(level, rng, avoid) {
    rng = rng || Math.random;
    var L = LEVELS[lv(level)];
    var pool = ITEMS.filter(function (it) { return (avoid || []).indexOf(it.pic) < 0; });
    var ans = pool[Math.floor(rng() * pool.length)];
    var same = shuffle(ITEMS.filter(function (it) { return it.g === ans.g && it.pic !== ans.pic; }), rng);
    var other = shuffle(ITEMS.filter(function (it) { return it.g !== ans.g; }), rng);
    var picks;
    if (L.mix === 'other') {
      // ちがう なかまから、なるべく ばらばらの なかまで
      var seen = {}, first = [], rest = [];
      seen[ans.g] = 1;
      other.forEach(function (it) { if (!seen[it.g]) { seen[it.g] = 1; first.push(it); } else rest.push(it); });
      picks = first.concat(rest).slice(0, L.n - 1);
    } else if (L.mix === 'some') {
      picks = same.slice(0, 2).concat(other).slice(0, L.n - 1);
    } else {
      picks = same.slice(0, L.n - 1);
    }
    return {
      answer: ans.pic,
      choices: shuffle([ans].concat(picks), rng).map(function (it) { return it.pic; }),
      flip: !!L.flip && rng() < 0.5
    };
  }
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [] };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    if (mine.length) {
      res.level = lv(mine[mine.length - 1].level);
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  /* ==================== 画面 ==================== */
  var st = null;
  function U() { return C.chiikuUi; }
  function hasApp() { return !!document.getElementById('app'); }
  function onScreen() { var ui = U(); return st && (!hasApp() || !ui.screenId || ui.screenId() === st.sid); }
  function say(text) { if (st && st.dom && st.dom.bub) st.dom.bub.textContent = text; try { if (hasApp()) U().speak(text); } catch (e) {} }
  function play(name) { try { if (hasApp()) U().play(name); } catch (e) {} }
  function isOver() { try { return C.timer.isOver(st.profileId); } catch (e) { return false; } }
  function later(fn, ms) { st.pending = fn; if (hasApp()) U().later(function () { if (st && st.pending === fn) flush(); }, ms); }
  function flush() { if (!st || !st.pending) return; var f = st.pending; st.pending = null; f(); }
  function sayAfter(text) {
    if (!hasApp()) { say(text); return; }
    var sid = st.sid;
    U().later(function () { if (st && st.sid === sid) say(text); }, VOICE_AFTER);
  }

  function start(profileId, level) {
    st = { profileId: profileId, level: 1, recent: [], autoLevel: 1, done: 0, phase: 'loading', recentAns: [] };
    var ui = U();
    var sid = (hasApp() && ui.screenId) ? ui.screenId() : null;
    var ask = level === undefined && hasApp();
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(profileId); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        var p = progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent; st.autoLevel = p.level;
        if (sid !== null && ui.screenId() !== sid) return;
        if (ask) { showChoose(); return; }
        if (level !== undefined && level !== 'auto') { st.level = lv(level); st.recent = []; }
        startRound();
      });
  }
  function choose(level) {
    if (!st || st.phase !== 'choose') return;
    if (level !== 'auto') { st.level = lv(level); st.recent = []; }
    startRound();
  }
  function startRound() { st.done = 0; next(); }

  function showChoose() {
    st.phase = 'choose';
    var ui = U();
    var app = ui.newScreen('kage-choose');
    st.sid = ui.screenId ? ui.screenId() : null;
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'kk-ch-body');
    body.appendChild(ui.el('p', 'kk-ch-title', TEXT.choose));
    var row = ui.el('div', 'kk-ch-row');
    function btn(main, sub, cls, level) {
      var b = ui.button('kk-ch ' + cls, function () { if (st.phase !== 'choose') return; ui.play('tap'); choose(level); });
      b.setAttribute('aria-label', main);
      b.appendChild(ui.el('span', 'kk-ch-main', main));
      if (sub) b.appendChild(ui.el('span', 'kk-ch-sub', sub));
      row.appendChild(b);
    }
    btn('つづき', '▶', 'kk-ch-auto', 'auto');
    [1, 2, 3, 4, 5].forEach(function (n) { btn(String(n), LEVELS[n].n + 'つ', 'kk-ch-lv' + (n === st.autoLevel ? ' now' : ''), n); });
    body.appendChild(row);
    app.appendChild(body);
    ui.speak(TEXT.choose);
  }

  function next() {
    if (isOver()) { st.phase = 'rest'; if (hasApp()) U().showRest(); return; }
    st.q = makeQuestion(st.level, Math.random, st.recentAns);
    st.recentAns = st.recentAns.concat([st.q.answer]).slice(-6);
    st.tried = []; st.phase = 'play'; st.pending = null; st.dom = null;
    render();
    say(TEXT.ask);
  }
  function log(correct) {
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: 'lv' + st.level, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
  }
  function advance() {
    st.done++;
    if (st.done >= ROUND) { showReward(); return; }
    next();
  }
  function choosePic(i) {
    if (!st || st.phase !== 'play' || st.pending || !onScreen()) return;
    var q = st.q;
    if (i < 0 || i >= q.choices.length || st.tried.indexOf(i) >= 0) return;
    if (q.choices[i] === q.answer) {
      log(st.tried.length === 0);
      st.phase = 'right';
      play('correct'); sayAfter(TEXT.right);
      paint(i);
      later(function () { advance(); }, WAIT_RIGHT);
      return;
    }
    st.tried.push(i);
    play('oops');
    if (st.tried.length >= 2) {
      log(false);
      st.phase = 'reveal';
      paint(q.choices.indexOf(q.answer));
      say(TEXT.reveal);
      st.pending = function () { advance(); };   // 光った 絵（または どこか）を さわると 次へ
      return;
    }
    paint(-1);
    say(TEXT.retry);
  }
  // reveal の ときに 絵を さわったら 次へ
  function tap(i) {
    if (st && st.phase === 'reveal') { if (st.pending) { play('tap'); flush(); } return; }
    choosePic(i);
  }

  /* ---------- 描画 ---------- */
  function render() {
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('kage');
    st.sid = ui.screenId ? ui.screenId() : null;
    var bar = ui.topBar({ home: true });
    var talk = ui.el('div', 'kg-talk');
    var bub = ui.bubble(TEXT.ask); bub.classList.add('kg-bub');
    talk.appendChild(bub);
    bar.insertBefore(talk, bar.lastChild);
    app.appendChild(bar);
    var body = ui.el('div', 'kg-body');
    var shadow = ui.el('div', 'kg-shadow');
    var pic = ui.el('span', 'kg-shadow-pic' + (st.q.flip ? ' flip' : ''), st.q.answer);
    shadow.appendChild(pic);
    body.appendChild(shadow);
    var grid = ui.el('div', 'kg-choices n' + st.q.choices.length);
    var btns = [];
    st.q.choices.forEach(function (p, i) {
      var b = ui.button('kg-choice', function () { tap(i); });
      b.setAttribute('aria-label', 'え');
      b.appendChild(ui.el('span', 'kg-choice-pic', p));
      grid.appendChild(b);
      btns.push(b);
    });
    body.appendChild(grid);
    app.appendChild(body);
    st.dom = { bub: bub, pic: pic, btns: btns };
  }
  function paint(rightIdx) {
    if (!st.dom) return;
    st.dom.btns.forEach(function (b, i) {
      b.classList.toggle('tried', st.tried.indexOf(i) >= 0);
      b.classList.toggle('right', i === rightIdx);
    });
    st.dom.pic.classList.toggle('show', st.phase === 'right');
  }
  function showReward() {
    st.phase = 'reward';
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('reward');
    st.sid = ui.screenId ? ui.screenId() : null;
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'reward-body');
    var stars = ui.el('div', 'stars');
    for (var i = 0; i < 3; i++) stars.appendChild(ui.svg(ui.STAR, 'reward-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'reward-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'reward-info');
    info.appendChild(ui.el('p', 'reward-msg', 'すごい！'));
    var nx = ui.button('btn-big btn-next', function () {
      if (nx.disabled) return;
      nx.disabled = true;
      ui.play('tap');
      startRound();
    });
    nx.setAttribute('aria-label', 'つぎへ');
    nx.appendChild(ui.svg(ui.ICO.next));
    nx.appendChild(ui.el('span', null, 'つぎへ'));
    info.appendChild(nx);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak(TEXT.reward);
  }

  function state() {
    if (!st) return null;
    return { phase: st.phase, level: st.level, done: st.done, q: st.q, tried: (st.tried || []).slice() };
  }

  C.kage = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND: ROUND, LEVELS: LEVELS, ITEMS: ITEMS, TEXT: TEXT,
    makeQuestion: makeQuestion, progressFromLogs: progressFromLogs, start: start,
    // テスト用
    _state: state, _choose: function (i) { tap(i); }, _flush: flush, _pick: choose
  };
})();
