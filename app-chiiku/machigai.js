/* まちがいさがし。Chiid.machigai
   2まいの絵（SVG の部品を ならべて作る）を見くらべて、ちがう ところを タップする → ○ → ぜんぶ みつけたら ごほうび。
   園児が見る文字は、ひらがなと数字だけ。通信は行わない。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。
   絵の大きさは viewBox 400×300。部品は「置き場所（スロット）」に1つずつ置く。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'machigai';
  var MAX_LEVEL = 3;
  var ROUND_SIZE = 5;            // 5問ごとにごほうび画面
  var WAIT_CLEAR = 1800;         // ぜんぶ見つけたあと、次へ進むまで（ms）
  var NUDGE_IDLE = 15000;        // 何も見つからないまま この時間で「ひんと を おしてみてね」
  var NUDGE_MISS = 3;            // ちがわない所を この回数おしたら「ひんと を おしてみてね」
  var TAP_BOTH = true;           // true: 左右どちらの絵を押してもよい／false: 右の絵だけ
  var W = 400, H = 300;
  var KINDS = ['iro', 'nai', 'ookisa'];   // いろが ちがう／ない／おおきさが ちがう
  var KAZU_YOMI = ['', 'ひとつ', 'ふたつ', 'みっつ'];

  // 色（草の みどりと まぎれないよう、みどりは使わない）
  var COLORS = ['#e2483d', '#2f7fd6', '#f4c430', '#8e5bd0', '#f28c28', '#f06fa8'];
  // レベル1で使う「はっきり ちがう」色
  var FAR = { '#e2483d': '#2f7fd6', '#2f7fd6': '#f4c430', '#f4c430': '#2f7fd6', '#8e5bd0': '#f4c430', '#f28c28': '#2f7fd6', '#f06fa8': '#2f7fd6' };
  // レベル2で避ける「にている」色の組
  var NEAR = { '#e2483d': ['#f06fa8', '#f28c28'], '#f06fa8': ['#e2483d'], '#f28c28': ['#e2483d', '#f4c430'], '#f4c430': ['#f28c28'] };

  /* ---------- 部品 ----------
     zone: sky（空）／back（地面の おく）／front（地面の てまえ）
     size: big／mid／small（レベルで使う部品が かわる）
     h: 絵の中心が、置き場所の点から どれだけ上か。r: だいたいの半径（当たり判定に使う）
     color: 色を変えられる部品だけ true。draw(c) は原点を置き場所の点として描く */
  function circ(x, y, r, fill, extra) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  var LINE = ' stroke="#5a4632" stroke-width="3" stroke-linejoin="round"';
  var PARTS = {
    sun: { zone: 'sky', size: 'big', h: 0, r: 36, color: false, draw: function () {
      var s = '';
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4, x1 = (27 * Math.cos(a)).toFixed(1), y1 = (27 * Math.sin(a)).toFixed(1),
          x2 = (36 * Math.cos(a)).toFixed(1), y2 = (36 * Math.sin(a)).toFixed(1);
        s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#f0a800" stroke-width="5" stroke-linecap="round"/>';
      }
      return s + circ(0, 0, 22, '#ffd23f', ' stroke="#f0a800" stroke-width="3"');
    } },
    cloud: { zone: 'sky', size: 'big', h: 0, r: 42, color: false, draw: function () {
      return '<g fill="#ffffff" stroke="#c9dbe8" stroke-width="2">' + circ(-22, 4, 17, '#fff') + circ(22, 4, 17, '#fff') + circ(0, -8, 24, '#fff') +
        '<rect x="-22" y="0" width="44" height="21" stroke="none"/></g>';
    } },
    bird: { zone: 'sky', size: 'small', h: 0, r: 20, color: true, draw: function (c) {
      return '<ellipse cx="0" cy="0" rx="17" ry="12" fill="' + c + '"' + LINE + '/>' + circ(9, -4, 2.5, '#3a3a3a') +
        '<path d="M16 -2 L25 1 L16 4 Z" fill="#f0a800"/>' + '<path d="M-8 -2 Q-2 -16 6 -3 Z" fill="#ffffff" opacity=".8"/>';
    } },
    balloon: { zone: 'sky', size: 'small', h: 0, r: 24, color: true, draw: function (c) {
      return '<path d="M0 16 Q-4 26 2 34" fill="none" stroke="#5a4632" stroke-width="2"/>' +
        '<ellipse cx="0" cy="-4" rx="16" ry="20" fill="' + c + '"' + LINE + '/>' + '<ellipse cx="-6" cy="-12" rx="4" ry="6" fill="#fff" opacity=".6"/>';
    } },
    house: { zone: 'back', size: 'big', h: 52, r: 58, color: true, draw: function (c) {
      return '<rect x="-38" y="-60" width="76" height="60" fill="#f6e3c4"' + LINE + '/>' +
        '<path d="M-50 -58 L0 -102 L50 -58 Z" fill="' + c + '"' + LINE + '/>' +
        '<rect x="-12" y="-32" width="24" height="32" fill="#a8744a"' + LINE + '/>' +
        '<rect x="16" y="-48" width="16" height="16" fill="#bfe6f5"' + LINE + '/>';
    } },
    tree: { zone: 'back', size: 'big', h: 60, r: 58, color: false, draw: function () {
      return '<rect x="-9" y="-46" width="18" height="46" fill="#a8744a"' + LINE + '/>' +
        circ(0, -78, 40, '#4caf50', LINE) + circ(-14, -86, 6, '#e2483d') + circ(14, -70, 6, '#e2483d') + circ(6, -96, 6, '#e2483d');
    } },
    car: { zone: 'back', size: 'big', h: 26, r: 54, color: true, draw: function (c) {
      return '<path d="M-48 -12 L-48 -30 L-26 -32 L-14 -52 L20 -52 L34 -32 L48 -28 L48 -12 Z" fill="' + c + '"' + LINE + '/>' +
        '<path d="M-10 -46 L-2 -46 L-2 -34 L-19 -34 Z M4 -46 L17 -46 L26 -34 L4 -34 Z" fill="#bfe6f5"/>' +
        circ(-26, -10, 11, '#3a3a3a') + circ(26, -10, 11, '#3a3a3a') + circ(-26, -10, 4, '#ddd') + circ(26, -10, 4, '#ddd');
    } },
    kinoko: { zone: 'back', size: 'big', h: 36, r: 46, color: true, draw: function (c) {
      return '<rect x="-14" y="-34" width="28" height="34" rx="8" fill="#fbf0dc"' + LINE + '/>' +
        '<path d="M-44 -30 Q-44 -78 0 -78 Q44 -78 44 -30 Z" fill="' + c + '"' + LINE + '/>' +
        circ(-20, -50, 7, '#fff') + circ(8, -62, 8, '#fff') + circ(26, -42, 6, '#fff');
    } },
    flower: { zone: 'front', size: 'small', h: 26, r: 26, color: true, draw: function (c) {
      var s = '<path d="M0 0 L0 -28" stroke="#2e8b3e" stroke-width="4"/>' + '<path d="M0 -10 Q12 -18 14 -6 Q6 -4 0 -10 Z" fill="#2e8b3e"/>';
      for (var k = 0; k < 5; k++) {
        var a = k * Math.PI * 2 / 5 - Math.PI / 2;
        s += circ((11 * Math.cos(a)).toFixed(1), (-36 + 11 * Math.sin(a)).toFixed(1), 8, c, ' stroke="#5a4632" stroke-width="2"');
      }
      return s + circ(0, -36, 6, '#ffd23f', ' stroke="#5a4632" stroke-width="2"');
    } },
    cat: { zone: 'front', size: 'mid', h: 26, r: 32, color: true, draw: function (c) {
      return '<ellipse cx="6" cy="-14" rx="22" ry="14" fill="' + c + '"' + LINE + '/>' +
        '<path d="M26 -16 Q40 -22 36 -40" fill="none" stroke="' + c + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M-28 -36 L-26 -54 L-14 -42 Z M-10 -42 L0 -54 L2 -36 Z" fill="' + c + '"' + LINE + '/>' +
        circ(-13, -32, 15, c, LINE) + circ(-18, -34, 2.5, '#3a3a3a') + circ(-8, -34, 2.5, '#3a3a3a');
    } },
    dog: { zone: 'front', size: 'mid', h: 26, r: 32, color: true, draw: function (c) {
      return '<ellipse cx="6" cy="-14" rx="22" ry="14" fill="' + c + '"' + LINE + '/>' +
        '<path d="M26 -20 L36 -30" stroke="#5a4632" stroke-width="5" stroke-linecap="round"/>' +
        circ(-13, -32, 15, c, LINE) + '<ellipse cx="-27" cy="-30" rx="5" ry="11" fill="#7a5a3a"/>' + '<ellipse cx="1" cy="-30" rx="5" ry="11" fill="#7a5a3a"/>' +
        circ(-18, -34, 2.5, '#3a3a3a') + circ(-8, -34, 2.5, '#3a3a3a') + circ(-13, -26, 3, '#3a3a3a');
    } },
    ball: { zone: 'front', size: 'small', h: 17, r: 22, color: true, draw: function (c) {
      return circ(0, -17, 17, c, LINE) + '<path d="M-17 -17 Q0 -6 17 -17" fill="none" stroke="#fff" stroke-width="4"/>';
    } }
  };
  // 置き場所。sky は部品の中心、back／front は部品の足もと
  var SLOTS = [
    { zone: 'sky', x: 70, y: 55 }, { zone: 'sky', x: 200, y: 42 }, { zone: 'sky', x: 330, y: 58 },
    { zone: 'back', x: 75, y: 205 }, { zone: 'back', x: 200, y: 205 }, { zone: 'back', x: 325, y: 205 },
    { zone: 'front', x: 135, y: 282 }, { zone: 'front', x: 265, y: 282 }
  ];
  var MIN_HIT_R = 40;   // 当たり判定の円は、半径 40 以上（指で押しやすく）

  // レベル1: 1か所・大きい部品・はっきり／2: 2か所・小さい部品以外・ふつう／3: 3か所・どれでも・ひかえめ
  function levelConfig(level) {
    if (level <= 1) return { diffs: 1, sizes: ['big'], scale: 0.55, colorMode: 'far' };
    if (level === 2) return { diffs: 2, sizes: ['big', 'mid'], scale: 0.65, colorMode: 'mid' };
    return { diffs: 3, sizes: ['big', 'mid', 'small'], scale: 0.72, colorMode: 'any' };
  }

  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pickOne(a, rng) { return a[Math.floor(rng() * a.length)]; }

  function otherColor(c, mode, rng) {
    if (mode === 'far') return FAR[c];
    var near = mode === 'mid' ? (NEAR[c] || []) : [];
    return pickOne(COLORS.filter(function (x) { return x !== c && near.indexOf(x) < 0; }), rng);
  }

  // 1問ぶん。{ level, left:[部品], right:[部品], diffs:[{ slot, kind, x, y, r }], itemId }
  // 部品は { type, x, y, s, color, hidden }。left と right は同じ並び（index がそろう）
  function makeProblem(opts, rng) {
    opts = opts || {};
    rng = rng || Math.random;
    var level = Math.max(1, Math.min(MAX_LEVEL, Number(opts.level) || 1));
    var cfg = levelConfig(level);
    var byZone = { sky: [], back: [], front: [] };
    Object.keys(PARTS).forEach(function (k) { byZone[PARTS[k].zone].push(k); });
    Object.keys(byZone).forEach(function (z) { shuffle(byZone[z], rng); });
    var left = SLOTS.map(function (sl) {
      var type = byZone[sl.zone].shift();
      return { type: type, x: sl.x, y: sl.y, s: 1, color: PARTS[type].color ? pickOne(COLORS, rng) : null, hidden: false };
    });
    var right = left.map(function (p) { return { type: p.type, x: p.x, y: p.y, s: p.s, color: p.color, hidden: false }; });

    var diffs = [], used = {};
    for (var n = 0; n < cfg.diffs; n++) {
      var cand = left.map(function (p, i) { return i; }).filter(function (i) {
        return !used[i] && cfg.sizes.indexOf(PARTS[left[i].type].size) >= 0;
      });
      if (!cand.length) break;
      var kind = C.adaptive.pickWeighted(KINDS, opts.missCounts || {}, rng);
      if (kind === 'iro') {
        var colorable = cand.filter(function (i) { return PARTS[left[i].type].color; });
        if (colorable.length) cand = colorable; else kind = 'nai';
      }
      var idx = pickOne(cand, rng);
      used[idx] = true;
      var p = left[idx], def = PARTS[p.type];
      if (kind === 'iro') right[idx].color = otherColor(p.color, cfg.colorMode, rng);
      else if (kind === 'nai') right[idx].hidden = true;
      else right[idx].s = cfg.scale;
      // 当たり判定は「もとの大きさ」の位置で（小さく なった絵の まわりを押しても当たる）
      diffs.push({ slot: idx, kind: kind, x: p.x, y: p.y - def.h, r: Math.max(MIN_HIT_R, Math.round(def.r * 1.15)) });
    }
    return { level: level, left: left, right: right, diffs: diffs, itemId: diffs.map(function (d) { return d.kind; }).join('+') };
  }

  // 絵の中の座標 (x, y) が当たった違いの番号。なければ -1。
  // 円が重なるときは、まだ見つけていない（found[i] が true でない）ものを先に、近いほうを選ぶ
  function hitTest(problem, x, y, found) {
    found = found || [];
    var best = -1, bestKey = Infinity;
    problem.diffs.forEach(function (d, i) {
      var dist = Math.sqrt((x - d.x) * (x - d.x) + (y - d.y) * (y - d.y));
      if (dist > d.r) return;
      var key = (found[i] ? 1e6 : 0) + dist;
      if (key < bestKey) { bestKey = key; best = i; }
    });
    return best;
  }

  function sceneSvg(parts) {
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#d9f1fb"/>';
    s += '<path d="M0 178 Q100 160 200 176 T400 172 L400 300 L0 300 Z" fill="#a6dd8a"/>';
    (parts || []).forEach(function (p) {
      if (p.hidden) return;
      s += '<g transform="translate(' + p.x + ' ' + p.y + ') scale(' + p.s + ')">' + PARTS[p.type].draw(p.color) + '</g>';
    });
    return s + '</svg>';
  }

  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (e.correct) return;
      String(e.itemId || '').split('+').forEach(function (k) {
        if (KINDS.indexOf(k) >= 0) res.missCounts[k] = (res.missCounts[k] || 0) + 1;
      });
    });
    if (mine.length) {
      var lv = Number(mine[mine.length - 1].level) || 1;
      res.level = Math.max(1, Math.min(MAX_LEVEL, lv));
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  function askText(n) { return 'ちがう ところを ' + KAZU_YOMI[n] + ' みつけてね'; }

  /* ---------- 画面 ---------- */
  var st = null;   // { profileId, level, recent, missCounts, solved }
  var SVGNS = 'http://www.w3.org/2000/svg';
  var BULB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zM9 20h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/></svg>';

  function U() { return C.chiikuUi; }

  function start(profileId) {
    st = { profileId: profileId, level: 1, recent: [], missCounts: {}, solved: 0 };
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(profileId); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        var p = progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent; st.missCounts = p.missCounts;
        nextQuestion();
      });
  }

  function nextQuestion() {
    var ui = U();
    var over = false;
    try { over = C.timer.isOver(st.profileId); } catch (e) { over = false; }
    if (over) { ui.showRest(); return; }
    showQuestion(makeProblem({ level: st.level, missCounts: st.missCounts }));
  }

  function addCircle(svgEl, cls, x, y, r) {
    var c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('class', cls);
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
    svgEl.appendChild(c);
    return c;
  }

  function showQuestion(prob) {
    var ui = U();
    var app = ui.newScreen('machigai');
    var q = { prob: prob, found: [], left: prob.diffs.length, hint: false, misses: 0, done: false, idleGen: 0, hintEls: [] };
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    app.classList.toggle('no-voice', !hasVoice);
    app.appendChild(ui.topBar({ home: true }));

    var text = askText(prob.diffs.length);
    var wrap = ui.el('div', 'mg-wrap');
    var head = ui.el('div', 'q-head mg-head');
    var who = ui.el('div', 'q-chara');
    var ch = ui.chara('normal');
    who.appendChild(ch);
    var talk = ui.el('div', 'q-talk');
    var bub = ui.bubble('ちがう ところ あと ' + q.left + 'つ');
    bub.classList.add('q-text');
    talk.appendChild(bub);
    if (hasVoice) {
      var again = ui.button('icon-btn speak-btn', function () { ui.play('tap'); ui.speak(text); });
      again.setAttribute('aria-label', 'もういちど きく');
      again.appendChild(ui.svg(ui.ICO.speaker));
      talk.appendChild(again);
    }
    var hintBtn = ui.button('btn-big secondary mg-hint-btn', function () { showHint(); });
    hintBtn.setAttribute('aria-label', 'ひんと');
    hintBtn.appendChild(ui.svg(BULB));
    hintBtn.appendChild(ui.el('span', null, 'ひんと'));
    talk.appendChild(hintBtn);
    head.appendChild(who);
    head.appendChild(talk);
    wrap.appendChild(head);

    var pics = ui.el('div', 'mg-pics');
    var svgs = [];
    [prob.left, prob.right].forEach(function (parts, side) {
      var box = ui.el('div', 'mg-pic' + (side === 1 || TAP_BOTH ? ' tappable' : ''));
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', side === 0 ? 'ひだりの え' : 'みぎの え');
      box.innerHTML = sceneSvg(parts);
      var s = box.firstChild;
      svgs.push(s);
      if (side === 1 || TAP_BOTH) box.addEventListener('pointerdown', function (ev) { onTap(ev, s); });
      pics.appendChild(box);
    });
    wrap.appendChild(pics);
    app.appendChild(wrap);

    function armIdle() {
      var gen = ++q.idleGen;
      ui.later(function () { if (gen === q.idleGen && !q.done) nudge(); }, NUDGE_IDLE);
    }
    function nudge() {
      q.misses = 0;
      hintBtn.classList.remove('wiggle');
      void hintBtn.offsetWidth;
      hintBtn.classList.add('wiggle');
      ui.speak('ひんと を おしてみてね');
      armIdle();
    }

    function onTap(ev, s) {
      if (q.done) return;
      ev.preventDefault();
      var rect = s.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = (ev.clientX - rect.left) / rect.width * W;
      var y = (ev.clientY - rect.top) / rect.height * H;
      var i = hitTest(prob, x, y, q.found);
      if (i >= 0 && !q.found[i]) found(i);
      else if (i < 0) miss(s, x, y);
    }

    function found(i) {
      var d = prob.diffs[i];
      q.found[i] = true;
      q.left--;
      svgs.forEach(function (s) { addCircle(s, 'mg-mark', d.x, d.y, d.r); });
      clearHint();
      armIdle();
      if (q.left > 0) {
        ui.play('correct');
        bub.textContent = 'みつけた！ あと ' + q.left + 'つ';
        ui.speak('みつけた！ あと ' + KAZU_YOMI[q.left]);
        return;
      }
      q.done = true;
      ui.play('star');
      hintBtn.disabled = true;
      ch.parentNode.replaceChild(ui.chara('happy'), ch);
      bub.textContent = 'ぜんぶ みつけた！';
      var burst = ui.el('div', 'burst');
      for (var k = 0; k < 5; k++) burst.appendChild(ui.svg(ui.STAR, 'reward-star s' + k));
      pics.appendChild(burst);
      finishQuestion(q);
      ui.speakThen('ぜんぶ みつけた！ すごいね', WAIT_CLEAR, afterClear);   // 言い終わってから次へ
    }

    // ちがわない所：ぽよん と 波が出るだけ（叱らない）
    function miss(s, x, y) {
      ui.play('tap');
      var c = addCircle(s, 'mg-miss', x, y, 18);
      ui.later(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 600);
      q.misses++;
      if (q.misses >= NUDGE_MISS) nudge();
    }

    function clearHint() {
      q.hintEls.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
      q.hintEls = [];
    }
    function showHint() {
      if (q.done) return;
      ui.play('tap');
      hintBtn.classList.remove('wiggle');
      var i = -1;
      for (var k = 0; k < prob.diffs.length; k++) if (!q.found[k]) { i = k; break; }
      if (i < 0) return;
      q.hint = true;
      clearHint();
      var d = prob.diffs[i];
      svgs.forEach(function (s) { q.hintEls.push(addCircle(s, 'mg-hint', d.x, d.y, d.r)); });
      ui.speak('ひかっている ところを よく みてね');
      armIdle();
    }

    armIdle();
    ui.speak(text);
  }

  // 1問ぶんの記録（ひんと なしで ぜんぶ見つけたら true）・苦手・レベル
  function finishQuestion(q) {
    var correct = !q.hint;
    var level = q.prob.level;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: q.prob.itemId, correct: correct, level: level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) q.prob.diffs.forEach(function (d) { st.missCounts[d.kind] = (st.missCounts[d.kind] || 0) + 1; });
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.solved++;
  }

  function afterClear() {
    if (st.solved % ROUND_SIZE === 0) { showReward(); return; }
    nextQuestion();
  }

  function showReward() {
    var ui = U();
    var app = ui.newScreen('reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'reward-body');
    var stars = ui.el('div', 'stars');
    for (var i = 0; i < 3; i++) stars.appendChild(ui.svg(ui.STAR, 'reward-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'reward-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'reward-info');
    info.appendChild(ui.el('p', 'reward-msg', 'すごい！'));
    var next = ui.button('btn-big btn-next', function () {
      if (next.disabled) return;
      next.disabled = true;
      ui.play('tap');
      nextQuestion();
    });
    next.setAttribute('aria-label', 'つぎへ');
    next.appendChild(ui.svg(ui.ICO.next));
    next.appendChild(ui.el('span', null, 'つぎへ'));
    info.appendChild(next);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak('すごい！ ' + ROUND_SIZE + 'もん できたね');
  }

  C.machigai = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, KINDS: KINDS, PARTS: PARTS, SLOTS: SLOTS,
    W: W, H: H, MIN_HIT_R: MIN_HIT_R,
    levelConfig: levelConfig, makeProblem: makeProblem, hitTest: hitTest, sceneSvg: sceneSvg,
    progressFromLogs: progressFromLogs, askText: askText, start: start
  };
})();
