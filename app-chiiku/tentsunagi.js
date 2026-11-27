/* てんつなぎ。Chiid.tentsunagi
   1→2→3…と 数字の 順に 点を つなぐと、絵が できる。レベル1〜3。5問で ごほうび。
   園児が見る文字は、ひらがなと数字だけ。通信は行わない。設計書：docs/superpowers/specs/2026-11-27-chiiku-tentsunagi-design.md
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。絵は viewBox 400×300。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'tentsunagi';
  var MAX_LEVEL = 3;
  var ROUND = 5;
  var HIT_R = 30;            // 点の 当たりの 半径（指で 押しやすく）
  var WAIT_DONE = 2600;      // 完成してから 次の問題まで（ms）
  var IDLE_HINT = 15000;     // この時間 なにも しないと 次の点が 光る
  var W = 400, H = 300;
  var BGS = ['umi', 'sora', 'nohara'];   // 背景（FigmaのAIで 作った 水彩画。img/tentsunagi/○○.jpg）
  var YOMI = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう', 'じゅう', 'じゅういち', 'じゅうに', 'じゅうさん', 'じゅうよん'];
  var TEXT = { choose: 'どれに する？', ask: '1から じゅんばんに つないでね', reward: 'すごい！ よく できたね' };
  var LINE = ' stroke="#5a4632" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';

  function circ(x, y, r, fill, extra) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function poly(pts, fill, extra) { return '<polygon points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function starPts(cx, cy, ro, ri) {
    var a = [];
    for (var k = 0; k < 10; k++) {
      var ang = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? ri : ro;
      a.push([Math.round(cx + r * Math.cos(ang)), Math.round(cy + r * Math.sin(ang))]);
    }
    return a;
  }

  /* ---------- 絵 ----------
     pts：点（1番から じゅんに）。完成すると さいごの点から 1番へ 線が もどって 閉じる。
     fill：ぬる色。deco：完成したときに 上に 描く もの（目・まど など）。anim：完成したときの 動き */
  var PICS = [
    { id: 'ie', name: 'いえ', level: 1, bg: 'nohara', fill: '#f6b26b', anim: 'bounce',
      pts: [[200, 45], [325, 135], [325, 262], [75, 262], [75, 135]],
      deco: '<rect x="178" y="205" width="44" height="57" fill="#a8744a"' + LINE + '/><rect x="248" y="165" width="42" height="38" fill="#bfe6f5"' + LINE + '/><rect x="110" y="165" width="42" height="38" fill="#bfe6f5"' + LINE + '/>' },
    { id: 'heart', name: 'はーと', level: 1, bg: 'sora', fill: '#f06fa8', anim: 'beat',
      pts: [[200, 100], [275, 48], [345, 120], [200, 262], [55, 120], [125, 48]],
      deco: '<ellipse cx="118" cy="100" rx="18" ry="11" fill="#fff" opacity=".6" transform="rotate(-35 118 100)"/>' },
    { id: 'sakana', name: 'さかな', level: 1, bg: 'umi', fill: '#f28c28', anim: 'swim',
      pts: [[340, 150], [245, 82], [150, 128], [60, 88], [60, 212], [150, 172], [245, 218]],
      deco: circ(292, 136, 9, '#3a3a3a') + circ(295, 133, 3, '#fff') + '<path d="M200 108 Q185 150 200 192" fill="none" stroke="#c8641a" stroke-width="4" stroke-linecap="round"/>' },
    { id: 'fune', name: 'ふね', level: 1, bg: 'umi', fill: '#2f7fd6', anim: 'swim',
      pts: [[60, 170], [195, 40], [300, 170], [345, 170], [290, 245], [110, 245]],
      deco: '<path d="M78 166 L195 56 L284 166 Z" fill="#ffffff" opacity=".92"/><path d="M195 40 L195 170" stroke="#5a4632" stroke-width="4"/>' + circ(160, 207, 10, '#bfe6f5', LINE) + circ(240, 207, 10, '#bfe6f5', LINE) },
    { id: 'kasa', name: 'かさ', level: 2, bg: 'nohara', fill: '#8e5bd0', anim: 'bounce',
      pts: [[60, 160], [110, 88], [200, 58], [290, 88], [340, 160], [222, 160], [222, 252], [178, 252], [178, 160]],
      deco: '<path d="M200 60 Q160 110 130 160 M200 60 Q240 110 270 160 M200 60 L200 160" fill="none" stroke="#6b42a8" stroke-width="3"/><rect x="178" y="160" width="44" height="92" fill="#f4c430"' + LINE + '/>' },
    { id: 'roketto', name: 'ろけっと', level: 2, bg: 'sora', fill: '#e2483d', anim: 'fly',
      pts: [[200, 30], [245, 95], [245, 195], [290, 250], [235, 232], [165, 232], [110, 250], [155, 195], [155, 95]],
      deco: circ(200, 130, 24, '#bfe6f5', ' stroke="#ffffff" stroke-width="6"') + '<path d="M175 236 L200 282 L225 236 Z" fill="#f4c430"/><path d="M188 236 L200 262 L212 236 Z" fill="#f28c28"/>' },
    { id: 'ringo', name: 'りんご', level: 2, bg: 'nohara', fill: '#e2483d', anim: 'bounce',
      pts: [[200, 95], [260, 72], [330, 118], [322, 212], [258, 262], [200, 244], [142, 262], [78, 212], [70, 118], [140, 72]],
      deco: '<path d="M200 96 Q198 70 210 50" fill="none" stroke="#7a5a3a" stroke-width="6" stroke-linecap="round"/><path d="M212 62 Q245 40 262 58 Q238 78 212 62 Z" fill="#4caf50"' + LINE + '/><ellipse cx="120" cy="140" rx="14" ry="26" fill="#fff" opacity=".45"/>' },
    { id: 'hoshi', name: 'ほし', level: 2, bg: 'sora', fill: '#f4c430', anim: 'beat',
      pts: starPts(200, 152, 120, 50),
      deco: circ(180, 150, 7, '#3a3a3a') + circ(220, 150, 7, '#3a3a3a') + '<path d="M186 172 Q200 184 214 172" fill="none" stroke="#3a3a3a" stroke-width="4" stroke-linecap="round"/>' },
    { id: 'neko', name: 'ねこ', level: 3, bg: 'nohara', fill: '#f28c28', anim: 'bounce',
      pts: [[105, 115], [115, 40], [170, 88], [230, 88], [285, 40], [295, 115], [315, 175], [280, 235], [240, 255], [160, 255], [120, 235], [85, 175]],
      deco: circ(162, 155, 10, '#3a3a3a') + circ(238, 155, 10, '#3a3a3a') + circ(165, 152, 3, '#fff') + circ(241, 152, 3, '#fff') +
        '<path d="M190 182 L210 182 L200 194 Z" fill="#f06fa8"/><path d="M200 194 Q190 210 178 204 M200 194 Q210 210 222 204" fill="none" stroke="#3a3a3a" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M150 190 L95 182 M150 200 L98 206 M250 190 L305 182 M250 200 L302 206" stroke="#3a3a3a" stroke-width="2.5" stroke-linecap="round"/>' },
    { id: 'tori', name: 'とり', level: 3, bg: 'sora', fill: '#4fb3e8', anim: 'fly',
      pts: [[352, 120], [310, 140], [305, 195], [245, 235], [170, 228], [65, 215], [110, 175], [70, 135], [160, 140], [220, 100], [270, 68], [320, 92]],
      deco: '<path d="M312 96 L352 120 L310 138 Z" fill="#f4c430"' + LINE + '/>' + circ(292, 100, 7, '#3a3a3a') + circ(294, 98, 2, '#fff') +
        '<path d="M180 160 Q230 140 265 175 Q225 200 180 160 Z" fill="#2f7fd6" opacity=".7"/>' },
    { id: 'choucho', name: 'ちょうちょ', level: 3, bg: 'nohara', fill: '#ffb03b', anim: 'beat',
      pts: [[200, 95], [250, 50], [330, 45], [345, 110], [285, 150], [340, 205], [295, 255], [200, 235], [105, 255], [60, 205], [115, 150], [55, 110], [70, 45], [150, 50]],
      deco: '<ellipse cx="200" cy="165" rx="11" ry="72" fill="#5a4632"/><path d="M196 96 Q180 60 160 52 M204 96 Q220 60 240 52" fill="none" stroke="#5a4632" stroke-width="3" stroke-linecap="round"/>' +
        circ(290, 95, 16, '#fff', ' opacity=".7"') + circ(110, 95, 16, '#fff', ' opacity=".7"') + circ(285, 205, 12, '#f06fa8') + circ(115, 205, 12, '#f06fa8') },
    { id: 'kuruma', name: 'くるま', level: 3, bg: 'nohara', fill: '#2f7fd6', anim: 'drive',
      pts: [[40, 212], [40, 165], [95, 152], [135, 95], [200, 95], [265, 95], [305, 152], [360, 165], [360, 212], [280, 212], [200, 212], [120, 212]],
      deco: '<path d="M145 105 L195 105 L195 150 L110 150 Z M205 105 L255 105 L292 150 L205 150 Z" fill="#bfe6f5"' + LINE + '/>' +
        circ(110, 215, 26, '#3a3a3a') + circ(290, 215, 26, '#3a3a3a') + circ(110, 215, 10, '#ddd') + circ(290, 215, 10, '#ddd') + circ(348, 180, 7, '#f4c430') }
  ];

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function numYomi(n) { return YOMI[n] || String(n); }
  function nextText(n) { return 'つぎは ' + numYomi(n) + ' だよ'; }
  function doneText(pic) { return pic.name + ' だったね！'; }

  // 1問：そのレベルの 絵から 1つ。avoid（さっき出た 絵の id）は さける。ぜんぶ さけると えらべないときは さけない
  function makeQuestion(level, rng, avoid) {
    rng = rng || Math.random;
    var list = PICS.filter(function (p) { return p.level === lv(level); });
    var pool = list.filter(function (p) { return (avoid || []).indexOf(p.id) < 0; });
    if (!pool.length) pool = list;
    return pool[Math.floor(rng() * pool.length)];
  }

  // (x, y) に いちばん 近い 点の 番号（半径 HIT_R の中）。なければ -1
  function hitDot(pts, x, y) {
    var best = -1, bd = Infinity;
    pts.forEach(function (p, i) {
      var d = Math.hypot(x - p[0], y - p[1]);
      if (d <= HIT_R && d < bd) { bd = d; best = i; }
    });
    return best;
  }
  // next：次に つなぐ 点の 番号。dragging：指を 動かして いる とちゅう（ほかの点を 通っても まちがいに しない）
  function tapResult(pts, next, x, y, dragging) {
    var i = hitDot(pts, x, y);
    if (i < 0 || i < next) return 'none';
    if (i === next) return 'next';
    return dragging ? 'none' : 'miss';
  }

  // 絵の SVG。connected：つないだ 点の数（1番は 始めから つないだ ことに する）。done：完成（閉じて ぬる）
  function picSvg(pic, connected, done) {
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#f4fbff"/>';
    s += '<image href="img/tentsunagi/' + pic.bg + '.jpg" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice"/>';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff" opacity=".3"/>';
    var pts = pic.pts, n = pts.length;
    s += '<g class="tn-pic' + (done ? ' done anim-' + pic.anim : '') + '">';
    if (done) s += '<g class="tn-fill">' + poly(pts, pic.fill, LINE) + pic.deco + '</g>';
    var upto = done ? n : Math.min(connected, n);
    for (var i = 1; i < upto; i++) s += '<line class="tn-line" x1="' + pts[i - 1][0] + '" y1="' + pts[i - 1][1] + '" x2="' + pts[i][0] + '" y2="' + pts[i][1] + '"/>';
    if (done) s += '<line class="tn-line" x1="' + pts[n - 1][0] + '" y1="' + pts[n - 1][1] + '" x2="' + pts[0][0] + '" y2="' + pts[0][1] + '"/>';
    s += '</g>';
    if (!done) {
      pts.forEach(function (p, i) {
        var cls = 'tn-dot' + (i < connected ? ' on' : '') + (i === connected ? ' next' : '');
        s += '<g class="tn-dotg" data-i="' + i + '"><circle class="' + cls + '" cx="' + p[0] + '" cy="' + p[1] + '" r="15"/>' +
          '<text class="tn-num" x="' + p[0] + '" y="' + (p[1] + 7) + '" text-anchor="middle">' + (i + 1) + '</text></g>';
      });
    }
    return s + '</svg>';
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
    st = { profileId: profileId, level: 1, recent: [], autoLevel: 1, done: 0, phase: 'loading', recentPics: [] };
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
    var app = ui.newScreen('tentsunagi-choose');
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
    var SUB = { 1: '1〜7', 2: '1〜10', 3: '1〜14' };
    [1, 2, 3].forEach(function (n) { btn(String(n), SUB[n], 'kk-ch-lv' + (n === st.autoLevel ? ' now' : ''), n); });
    body.appendChild(row);
    app.appendChild(body);
    ui.speak(TEXT.choose);
  }

  function next() {
    if (isOver()) { st.phase = 'rest'; if (hasApp()) U().showRest(); return; }
    st.pic = makeQuestion(st.level, Math.random, st.recentPics);
    st.recentPics = st.recentPics.concat([st.pic.id]).slice(-3);
    st.next = 1; st.misses = 0; st.phase = 'play'; st.pending = null; st.dom = null; st.idle = 0;
    render();
    say(TEXT.ask);
    armIdle();
  }
  function log(correct) {
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: st.pic.id, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    var lvNow = st.level;
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
    if (nl !== lvNow) { st.level = nl; st.recent = []; }
  }
  function advance() {
    st.done++;
    if (st.done >= ROUND) { showReward(); return; }
    next();
  }

  // 点 i に さわった（dragging：なぞりの とちゅう）
  function touchDot(i, dragging) {
    if (!st || st.phase !== 'play' || !onScreen()) return;
    var p = st.pic.pts[i];
    var r = tapResult(st.pic.pts, st.next, p[0], p[1], dragging);
    if (r === 'next') connect();
    else if (r === 'miss') miss(i);
  }
  function connect() {
    var n = st.pic.pts.length;
    st.next++;
    armIdle();
    if (st.next < n) {
      play('tap');
      say(numYomi(st.next));
      draw();
      return;
    }
    // さいごの 点 → 完成
    log(st.misses === 0);
    st.phase = 'done';
    play('star');
    draw();
    say(doneText(st.pic));
    later(function () { advance(); }, WAIT_DONE);
  }
  function miss(i) {
    st.misses++;
    play('oops');
    say(nextText(st.next + 1));
    shake(i);
    armIdle();
  }

  /* ---------- 描画 ---------- */
  function render() {
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('tentsunagi');
    st.sid = ui.screenId ? ui.screenId() : null;
    var bar = ui.topBar({ home: true });
    var talk = ui.el('div', 'kg-talk');
    var bub = ui.bubble(TEXT.ask); bub.classList.add('kg-bub');
    talk.appendChild(bub);
    bar.insertBefore(talk, bar.lastChild);
    app.appendChild(bar);
    var body = ui.el('div', 'tn-body');
    var box = ui.el('div', 'tn-box');
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', 'てんつなぎ');
    body.appendChild(box);
    app.appendChild(body);
    st.dom = { bub: bub, box: box };
    draw();
    var down = false;
    function at(ev, dragging) {
      var svg = box.firstChild;
      if (!svg) return;
      var rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      var x = (ev.clientX - rect.left) / rect.width * W, y = (ev.clientY - rect.top) / rect.height * H;
      var i = hitDot(st.pic.pts, x, y);
      if (i >= 0) touchDot(i, dragging);
    }
    box.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      down = true;
      try { box.setPointerCapture(ev.pointerId); } catch (e) {}
      at(ev, false);
    });
    box.addEventListener('pointermove', function (ev) { if (down) at(ev, true); });
    function up() { down = false; }
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
  }
  function draw() {
    if (!st.dom) return;
    st.dom.box.innerHTML = picSvg(st.pic, st.next, st.phase === 'done');   // 中身は この ファイルで 作った 絵だけ
  }
  function dotEl(i) { return st.dom ? st.dom.box.querySelector('.tn-dotg[data-i="' + i + '"]') : null; }
  function shake(i) {
    var g = dotEl(i);
    if (!g) return;
    g.classList.remove('shake');
    void g.getBoundingClientRect();
    g.classList.add('shake');
  }
  // しばらく なにも しないと、次の点を 光らせる
  function armIdle() {
    if (!hasApp() || !st) return;
    var gen = ++st.idle, sid = st.sid;
    U().later(function () {
      if (!st || st.idle !== gen || st.sid !== sid || st.phase !== 'play') return;
      var g = dotEl(st.next);
      if (g) g.classList.add('hint');
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
    return { phase: st.phase, level: st.level, done: st.done, pic: st.pic, next: st.next, misses: st.misses };
  }

  C.tentsunagi = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND: ROUND, HIT_R: HIT_R, BGS: BGS, PICS: PICS, TEXT: TEXT, W: W, H: H,
    makeQuestion: makeQuestion, hitDot: hitDot, tapResult: tapResult, picSvg: picSvg, progressFromLogs: progressFromLogs,
    numYomi: numYomi, nextText: nextText, doneText: doneText, start: start,
    // テスト用
    _state: state, _tapDot: function (i) { touchDot(i, false); }, _flush: flush, _pick: choose
  };
})();
