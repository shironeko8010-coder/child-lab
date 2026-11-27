/* なかまわけ。Chiid.nakama
   絵を 指で 引っぱって、同じ なかまの かごへ 入れる。分け方は 5つ（もの・いろ・とぶ・たべられる・おおきさ）を まぜて 出す。
   レベル1・2は 分け方を 読み上げ、レベル3は かごの 見本を 見て 考える。5問で ごほうび。
   園児が見る文字は、ひらがなだけ。通信は行わない。設計書：docs/superpowers/specs/2026-11-27-chiiku-nakama-design.md
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。絵は FigmaのAIで 作った 画像（img/nakama/）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'nakama';
  var MAX_LEVEL = 3;
  var ROUND = 5;
  var WAIT_DONE = 2200;
  var IDLE_HINT = 15000;
  var THINK_HINT_MISSES = 3;   // レベル3：この回数 まちがえたら 分け方を 言う
  var RULE_TYPES = ['mono', 'iro', 'tobu', 'taberu', 'ookisa'];
  var LEVELS = { 1: { n: 4 }, 2: { n: 6 }, 3: { n: 6, think: true } };

  /* ---------- 絵 ----------
     cat：もの の なかま。color：'aka'／'ao'／'kiiro'（色の 問題に 出さない絵は null）。
     fly・eat：true／false（まよう 絵は null で 出さない）。size：'big'／'small'（はっきり 差が あるものだけ） */
  var ITEMS = [];
  function add(id, name, cat, color, fly, eat, size) { ITEMS.push({ id: id, name: name, cat: cat, color: color, fly: fly, eat: eat, size: size }); }
  add('ringo', 'りんご', 'kudamono', 'aka', false, true, null);
  add('ichigo', 'いちご', 'kudamono', 'aka', false, true, null);
  add('banana', 'ばなな', 'kudamono', 'kiiro', false, true, null);
  add('remon', 'れもん', 'kudamono', 'kiiro', false, true, null);
  add('budou', 'ぶどう', 'kudamono', null, false, true, null);
  add('mikan', 'みかん', 'kudamono', null, false, true, null);
  add('suika', 'すいか', 'kudamono', null, false, true, null);
  add('tomato', 'とまと', 'yasai', 'aka', false, true, null);
  add('ninjin', 'にんじん', 'yasai', null, false, true, null);
  add('toumorokoshi', 'とうもろこし', 'yasai', 'kiiro', false, true, null);
  add('nasu', 'なす', 'yasai', null, false, true, null);
  add('kyuuri', 'きゅうり', 'yasai', null, false, true, null);
  add('kyabetsu', 'きゃべつ', 'yasai', null, false, true, null);
  add('kabocha', 'かぼちゃ', 'yasai', null, false, true, null);
  add('zou', 'ぞう', 'doubutsu', null, false, false, 'big');
  add('kirin', 'きりん', 'doubutsu', null, false, false, 'big');
  add('kaba', 'かば', 'doubutsu', null, false, false, 'big');
  add('raion', 'らいおん', 'doubutsu', null, false, false, null);
  add('usagi', 'うさぎ', 'doubutsu', null, false, false, null);
  add('inu', 'いぬ', 'doubutsu', null, false, false, null);
  add('neko', 'ねこ', 'doubutsu', null, false, false, null);
  add('kotori', 'ことり', 'doubutsu', 'ao', true, false, null);
  add('nezumi', 'ねずみ', 'doubutsu', null, false, false, 'small');
  add('kujira', 'くじら', 'umi', 'ao', false, null, 'big');
  add('iruka', 'いるか', 'umi', 'ao', false, null, null);
  add('tako', 'たこ', 'umi', 'aka', false, null, null);
  add('kani', 'かに', 'umi', 'aka', false, null, null);
  add('kurage', 'くらげ', 'umi', null, false, null, null);
  add('kame', 'かめ', 'umi', null, false, null, null);
  add('hitode', 'ひとで', 'umi', 'kiiro', false, null, null);
  add('shoubousha', 'しょうぼうしゃ', 'norimono', 'aka', false, false, null);
  add('kuruma', 'くるま', 'norimono', 'ao', false, false, null);
  add('basu', 'ばす', 'norimono', 'kiiro', false, false, null);
  add('hikouki', 'ひこうき', 'norimono', null, true, false, null);
  add('heri', 'へりこぷたー', 'norimono', null, true, false, null);
  add('fune', 'ふね', 'norimono', null, false, false, null);
  add('densha', 'でんしゃ', 'norimono', null, false, false, null);
  add('kikyuu', 'ききゅう', 'norimono', null, true, false, null);
  add('ari', 'あり', 'mushi', null, false, false, 'small');
  add('tentoumushi', 'てんとうむし', 'mushi', 'aka', true, false, 'small');
  add('chouchou', 'ちょうちょ', 'mushi', null, true, false, 'small');
  add('hachi', 'はち', 'mushi', 'kiiro', true, false, 'small');
  add('tonbo', 'とんぼ', 'mushi', null, true, false, 'small');
  add('kabutomushi', 'かぶとむし', 'mushi', null, null, false, 'small');
  add('semi', 'せみ', 'mushi', null, true, false, 'small');

  // 分け方。key：絵の どの 値で 分けるか。values：かごに なる 値。labels：かごの 名前
  var RULES = {
    mono: { key: 'cat', values: ['kudamono', 'yasai', 'doubutsu', 'umi', 'norimono', 'mushi'],
      labels: { kudamono: 'くだもの', yasai: 'やさい', doubutsu: 'どうぶつ', umi: 'うみの いきもの', norimono: 'のりもの', mushi: 'むし' }, text: 'なかまに わけよう！' },
    iro: { key: 'color', values: ['aka', 'ao', 'kiiro'], labels: { aka: 'あか', ao: 'あお', kiiro: 'きいろ' }, text: 'いろで わけよう！' },
    tobu: { key: 'fly', values: [true, false], labels: { 'true': 'とぶ', 'false': 'とばない' }, text: 'そらを とぶかな？ とばないかな？' },
    taberu: { key: 'eat', values: [true, false], labels: { 'true': 'たべられる', 'false': 'たべられない' }, text: 'たべられるかな？ たべられないかな？' },
    ookisa: { key: 'size', values: ['big', 'small'], labels: { big: 'おおきい', small: 'ちいさい' }, text: 'おおきいかな？ ちいさいかな？' }
  };
  // レベル2で 使う「にている なかま」。レベル1の「もの」は これ いがいの 組み合わせ
  var NEAR = [['kudamono', 'yasai'], ['doubutsu', 'umi'], ['doubutsu', 'mushi']];
  var COLOR_CSS = { aka: '#e2483d', ao: '#2f7fd6', kiiro: '#f4c430' };
  var TEXT = {
    choose: 'どれに する？', think: 'かごの なかを みて、なかまを かんがえてね', retry: 'もういっかい やってみよう',
    done: 'ぜんぶ わけられたね！', reward: 'すごい！ よく できたね'
  };

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function imgSrc(it) { return 'img/nakama/' + it.id + '.jpg'; }
  function label(rule, value) { return RULES[rule].labels[String(value)]; }
  function ruleText(rule) { return RULES[rule].text; }
  function placeText(it, basket) { return it.name + 'は ' + basket.label + '！'; }
  function isNear(a, b) { return NEAR.some(function (p) { return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a); }); }

  // かごの 値を えらぶ
  function pickValues(rule, level, rng) {
    var vals = RULES[rule].values;
    if (rule === 'mono') {
      if (level === 3) return shuffle(vals, rng).slice(0, 3);
      var pairs = [];
      for (var i = 0; i < vals.length; i++) for (var j = i + 1; j < vals.length; j++) {
        if (isNear(vals[i], vals[j]) === (level === 2)) pairs.push([vals[i], vals[j]]);
      }
      return shuffle(pairs[Math.floor(rng() * pairs.length)], rng);
    }
    if (rule === 'iro') return shuffle(vals, rng).slice(0, level === 3 ? 3 : 2);
    return shuffle(vals, rng);
  }

  // ほかの 分け方でも、かご（見本＋答え）が きれいに 分かれて しまうなら true
  function isAmbiguous(q) {
    var groups = q.baskets.map(function (b) { return [b.example]; });
    q.items.forEach(function (it) { groups[it.answer].push(it); });
    return RULE_TYPES.some(function (rt) {
      if (rt === q.rule) return false;
      var key = RULES[rt].key, seen = [];
      for (var g = 0; g < groups.length; g++) {
        var v = groups[g][0][key];
        if (v === null || v === undefined) return false;
        for (var k = 1; k < groups[g].length; k++) if (groups[g][k][key] !== v) return false;
        if (seen.indexOf(v) >= 0) return false;
        seen.push(v);
      }
      return true;
    });
  }

  function makeOnce(level, rng, rule) {
    var R = RULES[rule], L = LEVELS[level], values = pickValues(rule, level, rng);
    var pools = values.map(function (v) { return shuffle(ITEMS.filter(function (it) { return it[R.key] === v; }), rng); });
    var baskets = values.map(function (v, bi) { return { value: v, label: R.labels[String(v)], example: pools[bi].shift() }; });
    // まず どの かごにも 1まい、のこりは 絵が のこっている かごへ
    var counts = values.map(function () { return 1; }), total = values.length;
    while (total < L.n) {
      var open = values.map(function (v, bi) { return bi; }).filter(function (bi) { return pools[bi].length > counts[bi]; });
      if (!open.length) return null;
      counts[open[Math.floor(rng() * open.length)]]++;
      total++;
    }
    var items = [];
    counts.forEach(function (c, bi) {
      if (pools[bi].length < c) return;
      pools[bi].slice(0, c).forEach(function (it) { var o = Object.assign({}, it); o.answer = bi; items.push(o); });
    });
    if (items.length !== L.n) return null;
    return { level: level, rule: rule, think: !!L.think, baskets: baskets, items: shuffle(items, rng) };
  }
  // 1問。rule をわたさないときは まぜて えらぶ
  function makeQuestion(level, rng, rule) {
    rng = rng || Math.random;
    level = lv(level);
    rule = rule || RULE_TYPES[Math.floor(rng() * RULE_TYPES.length)];
    var q = null;
    for (var t = 0; t < 300; t++) {
      q = makeOnce(level, rng, rule);
      if (q && !(q.think && isAmbiguous(q))) return q;
    }
    return q;
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

  function start(profileId, level) {
    st = { profileId: profileId, level: 1, recent: [], autoLevel: 1, done: 0, phase: 'loading', queue: [] };
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
  // 1回分（5問）で 5つの 分け方が 1回ずつ
  function startRound() { st.done = 0; st.queue = shuffle(RULE_TYPES, Math.random); next(); }

  function showChoose() {
    st.phase = 'choose';
    var ui = U();
    var app = ui.newScreen('nakama-choose');
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
    [1, 2, 3].forEach(function (n) { btn(String(n), LEVELS[n].n + 'まい', 'kk-ch-lv' + (n === st.autoLevel ? ' now' : ''), n); });
    body.appendChild(row);
    app.appendChild(body);
    ui.speak(TEXT.choose);
  }

  function next() {
    if (isOver()) { st.phase = 'rest'; if (hasApp()) U().showRest(); return; }
    var rule = st.queue.length ? st.queue.shift() : RULE_TYPES[Math.floor(Math.random() * RULE_TYPES.length)];
    st.q = makeQuestion(st.level, Math.random, rule);
    st.placed = st.q.items.map(function () { return false; });
    st.misses = 0; st.selected = -1; st.phase = 'play'; st.pending = null; st.dom = null; st.idle = 0; st.showLabels = !st.q.think;
    render();
    say(st.q.think ? TEXT.think : ruleText(st.q.rule));
    armIdle();
  }
  function log(correct) {
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: st.q.rule, correct: correct, level: st.level });
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

  // 絵 i を かご bi へ
  function drop(i, bi) {
    if (!st || st.phase !== 'play' || !onScreen()) return;
    var q = st.q;
    if (i < 0 || i >= q.items.length || st.placed[i] || bi < 0 || bi >= q.baskets.length) return;
    st.selected = -1;
    armIdle();
    if (q.items[i].answer === bi) {
      st.placed[i] = true;
      paintPlaced(i, bi);
      if (st.placed.every(Boolean)) {
        log(st.misses === 0);
        st.phase = 'done';
        play('star');
        paintDone();
        say(TEXT.done);
        later(function () { advance(); }, WAIT_DONE);
        return;
      }
      play('correct');
      say(placeText(q.items[i], q.baskets[bi]));
      return;
    }
    st.misses++;
    play('oops');
    paintBack(i);
    if (q.think && st.misses >= THINK_HINT_MISSES && !st.showLabels) {
      st.showLabels = true;   // レベル3：何回も まちがえたら 分け方を 教える
      paintLabels();
      say(ruleText(q.rule));
      return;
    }
    say(TEXT.retry);
  }

  /* ---------- 描画 ---------- */
  function render() {
    if (!hasApp()) return;
    var ui = U(), q = st.q;
    var app = ui.newScreen('nakama');
    st.sid = ui.screenId ? ui.screenId() : null;
    var bar = ui.topBar({ home: true });
    var talk = ui.el('div', 'kg-talk');
    var bub = ui.bubble(q.think ? TEXT.think : ruleText(q.rule)); bub.classList.add('kg-bub');
    talk.appendChild(bub);
    bar.insertBefore(talk, bar.lastChild);
    app.appendChild(bar);
    var body = ui.el('div', 'nk-body');
    var tray = ui.el('div', 'nk-tray n' + q.items.length);
    var cards = q.items.map(function (it, i) {
      var c = ui.el('div', 'nk-card');
      c.setAttribute('role', 'button');
      c.setAttribute('aria-label', it.name);
      var img = document.createElement('img');
      img.src = imgSrc(it); img.alt = ''; img.draggable = false;
      c.appendChild(img);
      dragable(c, i);
      tray.appendChild(c);
      return c;
    });
    var row = ui.el('div', 'nk-baskets k' + q.baskets.length);
    var baskets = q.baskets.map(function (b, bi) {
      var el = ui.el('div', 'nk-basket' + (st.q.rule === 'iro' ? ' iro' : ''));
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'かご');
      el.dataset.bi = String(bi);
      if (st.q.rule === 'iro') el.style.setProperty('--nk-color', COLOR_CSS[b.value]);
      var inn = ui.el('div', 'nk-in');
      var ex = document.createElement('img');
      ex.src = imgSrc(b.example); ex.alt = ''; ex.draggable = false; ex.className = 'nk-thumb ex';
      inn.appendChild(ex);
      el.appendChild(inn);
      el.appendChild(ui.el('div', 'nk-kago'));
      el.appendChild(ui.el('div', 'nk-label', b.label));
      el.addEventListener('click', function () {
        if (!st || st.phase !== 'play') return;
        if (st.selected >= 0) { drop(st.selected, bi); return; }
        if (st.showLabels) { ui.play('tap'); ui.speak(b.label); }
      });
      row.appendChild(el);
      return el;
    });
    body.appendChild(tray);
    body.appendChild(row);
    app.appendChild(body);
    st.dom = { bub: bub, cards: cards, baskets: baskets, body: body };
    paintLabels();
  }
  // 引っぱる。少し 動かしたら 引っぱり、動かさずに はなしたら「えらぶ」（そのあと かごを タッチ）
  function dragable(card, i) {
    var sx = 0, sy = 0, moving = false, down = false;
    card.addEventListener('pointerdown', function (ev) {
      if (!st || st.phase !== 'play' || st.placed[i]) return;
      ev.preventDefault();
      down = true; moving = false; sx = ev.clientX; sy = ev.clientY;
      try { card.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    card.addEventListener('pointermove', function (ev) {
      if (!down) return;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moving && Math.hypot(dx, dy) > 10) { moving = true; card.classList.add('drag'); select(-1); }
      if (moving) card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.08)';
    });
    function up(ev) {
      if (!down) return;
      down = false;
      if (!moving) { U().play('tap'); select(st.selected === i ? -1 : i); return; }
      card.style.visibility = 'hidden';
      var under = document.elementFromPoint(ev.clientX, ev.clientY);
      card.style.visibility = '';
      var b = under && under.closest ? under.closest('.nk-basket') : null;
      card.classList.remove('drag');
      if (b) drop(i, Number(b.dataset.bi));
      else paintBack(i, true);
    }
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', function () { down = false; card.classList.remove('drag'); paintBack(i, true); });
  }
  function select(i) {
    st.selected = i;
    if (!st.dom) return;
    st.dom.cards.forEach(function (c, k) { c.classList.toggle('sel', k === i); });
  }
  function clearHint() { if (!st.dom) return; st.dom.cards.concat(st.dom.baskets).forEach(function (e) { e.classList.remove('hint'); }); }
  function paintPlaced(i, bi) {
    if (!st.dom) return;
    clearHint();
    var c = st.dom.cards[i];
    c.style.transform = '';
    c.classList.remove('drag', 'sel');
    c.classList.add('gone');
    var t = document.createElement('img');
    t.src = imgSrc(st.q.items[i]); t.alt = ''; t.draggable = false; t.className = 'nk-thumb';
    st.dom.baskets[bi].querySelector('.nk-in').appendChild(t);
    var b = st.dom.baskets[bi];
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
  function paintBack(i, quiet) {
    if (!st.dom) return;
    var c = st.dom.cards[i];
    c.classList.remove('drag', 'sel');
    c.style.transform = '';
    if (!quiet) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
  }
  function paintLabels() { if (st.dom) st.dom.body.classList.toggle('labels', !!st.showLabels); }
  function paintDone() { if (st.dom) st.dom.baskets.forEach(function (b) { b.classList.add('happy'); }); }
  // しばらく 止まっていると、のこっている 絵と その かごを 光らせる
  function armIdle() {
    if (!hasApp() || !st) return;
    var gen = ++st.idle, sid = st.sid;
    U().later(function () {
      if (!st || st.idle !== gen || st.sid !== sid || st.phase !== 'play' || !st.dom) return;
      var i = st.placed.indexOf(false);
      if (i < 0) return;
      st.dom.cards[i].classList.add('hint');
      st.dom.baskets[st.q.items[i].answer].classList.add('hint');
    }, IDLE_HINT);
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
    return { phase: st.phase, level: st.level, done: st.done, q: st.q, misses: st.misses, placed: (st.placed || []).slice() };
  }

  C.nakama = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND: ROUND, RULE_TYPES: RULE_TYPES, LEVELS: LEVELS, ITEMS: ITEMS, RULES: RULES, NEAR: NEAR, TEXT: TEXT,
    makeQuestion: makeQuestion, isAmbiguous: isAmbiguous, progressFromLogs: progressFromLogs, imgSrc: imgSrc,
    label: label, ruleText: ruleText, placeText: placeText, start: start,
    // テスト用
    _state: state, _drop: drop, _flush: flush, _pick: choose
  };
})();
