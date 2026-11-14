/* めいろ。Chiid.meiro
   ひよこを指で引っぱって、ごはんまで連れていく。毎回ちがう形のめいろを作る。レベル1〜5（大きさ＋ほし・かぎと とびら）。
   園児が見る文字は、ひらがなだけ。通信は行わない。設計書：docs/superpowers/specs/2026-11-14-chiiku-meiro-design.md
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'meiro';
  var MAX_LEVEL = 5;
  var ROUND = 3;             // めいろ3つで1回分（ごほうび）
  var MIN_CELL = 56, MIN_CELL_LOW = 48;

  // レベルごとの決まり（設計書4章）。大きさは「いちばん大きいとき」。loops：こわす壁の割合（多いほど まよいにくい）
  var LEVELS = {
    1: { land: [5, 3], port: [4, 5], tab: [6, 4], loops: 0.25, stars: 0, key: false },
    2: { land: [7, 4], port: [4, 6], tab: [8, 5], loops: 0.05, stars: 0, key: false },
    3: { land: [10, 5], port: [6, 8], tab: [12, 8], loops: 0.05, stars: 3, key: false },
    4: { land: [10, 5], port: [6, 8], tab: [12, 8], loops: 0.05, stars: 0, key: true },
    5: { land: [10, 5], port: [6, 8], tab: [12, 8], loops: 0.03, stars: 3, key: true }
  };
  var TEXT = {
    star: 'ほし ゲット！', lidOpen: 'ごはんの ふたが あいたよ！', findKey: 'つぎは かぎを さがそう',
    doorOpen: 'とびらが あいたよ！', doorOpenStars: 'とびらが あいた！ ほしも あつめよう',
    goal: 'ごはん だ！ やったね', reward: 'すごい！ めいろ 3つ できたね', hint: 'ひかっている みちを すすんでね', touchChick: 'ひよこを さわって うごかしてね'
  };
  var DIRS = { n: [0, -1, 's'], e: [1, 0, 'w'], s: [0, 1, 'n'], w: [-1, 0, 'e'] };   // [dx, dy, 反対]

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function key(x, y) { return x + ',' + y; }
  function xy(k) { var p = String(k).split(','); return [+p[0], +p[1]]; }

  function dims(level, kind) {
    var L = LEVELS[lv(level)];
    if (kind === 'tabPort') return { w: L.tab[1], h: L.tab[0] };
    var d = L[kind] || L.land;
    return { w: d[0], h: d[1] };
  }
  function kindOf(viewW, viewH) {
    var tab = Math.min(viewW, viewH) >= 700;
    if (viewW >= viewH) return tab ? 'tab' : 'land';
    return tab ? 'tabPort' : 'port';
  }
  // マスが minCell 以上になるまで、マスが小さい方の向きのマス数を1つずつ減らす（3より小さくしない）
  function fit(level, kind, availW, availH, minCell) {
    var d = dims(level, kind), w = d.w, h = d.h;
    function cell() { return Math.floor(Math.min(availW / w, availH / h)); }
    while (cell() < minCell && (w > 3 || h > 3)) {
      if ((availW / w < availH / h && w > 3) || h <= 3) w--; else h--;
    }
    return { w: w, h: h, cell: cell() };
  }

  /* ---------- めいろを作る ---------- */
  function shuffle(a, rng) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function openWall(cells, x, y, d) {
    var D = DIRS[d]; cells[y][x][d] = 1; cells[y + D[1]][x + D[0]][D[2]] = 1;
  }
  function closeWall(cells, x, y, d) {
    var D = DIRS[d]; cells[y][x][d] = 0; cells[y + D[1]][x + D[0]][D[2]] = 0;
  }
  function carve(w, h, loops, rng) {
    var cells = [], seen = [], x, y;
    for (y = 0; y < h; y++) { cells[y] = []; seen[y] = []; for (x = 0; x < w; x++) { cells[y][x] = { n: 0, e: 0, s: 0, w: 0 }; seen[y][x] = false; } }
    var stack = [[0, h - 1]]; seen[h - 1][0] = true;
    while (stack.length) {     // 穴ほり法：まだ行っていない となりへ ほり、行き止まりで もどる
      var c = stack[stack.length - 1];
      var opts = shuffle(['n', 'e', 's', 'w'], rng).filter(function (d) {
        var nx = c[0] + DIRS[d][0], ny = c[1] + DIRS[d][1];
        return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny][nx];
      });
      if (!opts.length) { stack.pop(); continue; }
      var d = opts[0], nx = c[0] + DIRS[d][0], ny = c[1] + DIRS[d][1];
      openWall(cells, c[0], c[1], d); seen[ny][nx] = true; stack.push([nx, ny]);
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {   // 少しだけ壁をこわして、道をつなげる
      if (x < w - 1 && !cells[y][x].e && rng() < loops) openWall(cells, x, y, 'e');
      if (y < h - 1 && !cells[y][x].s && rng() < loops) openWall(cells, x, y, 's');
    }
    return cells;
  }

  // 進めるか（とびらは かぎが ないと、ごはんは ほしが のこっていると 入れない）
  function canMove(maze, from, dir, state) {
    var D = DIRS[dir]; if (!D || !from) return null;
    var p = xy(from); if (!maze.cells[p[1]] || !maze.cells[p[1]][p[0]] || !maze.cells[p[1]][p[0]][dir]) return null;
    var to = key(p[0] + D[0], p[1] + D[1]);
    state = state || {};
    if (maze.door && to === maze.door && !state.hasKey) return null;
    if (to === maze.goal && (state.starsLeft || 0) > 0) return null;
    return to;
  }
  // いまの状態で通れる道だけで、from からの いちばん近い道（幅優先）
  function search(maze, from, state) {
    var prev = {}, q = [from], seen = {}; seen[from] = 1;
    while (q.length) {
      var k = q.shift();
      for (var d in DIRS) {
        var nk = canMove(maze, k, d, state);
        if (nk && !seen[nk]) { seen[nk] = 1; prev[nk] = k; q.push(nk); }
      }
    }
    return { prev: prev, seen: seen };
  }
  function path(maze, from, to, state) {
    if (from === to) return [from];
    var r = search(maze, from, state);
    if (!r.seen[to]) return null;
    var p = [to]; while (p[0] !== from) p.unshift(r.prev[p[0]]);
    return p;
  }
  function distances(maze, from, state) {
    var r = search(maze, from, state), d = {};
    Object.keys(r.seen).forEach(function (k) { var n = 0, c = k; while (c !== from) { c = r.prev[c]; n++; } d[k] = n; });
    return d;
  }
  // いま行くべき所（設計書6章）
  function nextTarget(maze, at, state) {
    state = state || {};
    var got = state.got || {};
    var left = maze.stars.filter(function (k) { return !got[k]; });
    if (left.length) {
      var best = null, bl = Infinity;
      left.forEach(function (k) { var p = path(maze, at, k, state); if (p && p.length < bl) { bl = p.length; best = k; } });
      if (best) return best;
    }
    if (maze.key && !state.hasKey) return maze.key;
    return maze.goal;
  }
  function solvable(maze) {
    var st = { hasKey: false, starsLeft: maze.stars.length, got: {} }, at = maze.start;
    for (var steps = 0; steps < 2000; steps++) {
      if (at === maze.goal) return true;
      var p = path(maze, at, nextTarget(maze, at, st), st);
      if (!p || p.length < 2) return false;
      at = p[1];
      if (maze.stars.indexOf(at) >= 0 && !st.got[at]) { st.got[at] = 1; st.starsLeft--; }
      if (at === maze.key) st.hasKey = true;
    }
    return false;
  }
  // ごはんを行き止まりにすると、ごはんの先のマスが 切りはなされることがある。
  // そのときは、とどくマス（ごはん以外）と となりあう所の壁を あけて、全部のマスを つなぎ直す
  function reconnect(maze) {
    var all = { hasKey: true, starsLeft: 0 };
    for (var guard = 0; guard < maze.w * maze.h; guard++) {
      var seen = search(maze, maze.start, all).seen, fixed = false;
      if (Object.keys(seen).length === maze.w * maze.h) return;
      for (var y = 0; y < maze.h && !fixed; y++) for (var x = 0; x < maze.w && !fixed; x++) {
        if (seen[key(x, y)]) continue;
        for (var d in DIRS) {
          var nx = x + DIRS[d][0], ny = y + DIRS[d][1], nk = key(nx, ny);
          if (seen[nk] && nk !== maze.goal) { openWall(maze.cells, x, y, d); fixed = true; break; }
        }
      }
      if (!fixed) return;
    }
  }
  function build(level, w, h, rng) {
    var L = LEVELS[lv(level)];
    var cells = carve(w, h, L.loops, rng);
    var start = key(0, h - 1), goal = key(w - 1, 0);
    var open = { hasKey: true, starsLeft: 0 };
    var main = path({ cells: cells, stars: [], goal: '-' }, start, goal, open);
    // ごはんは行き止まり（入り口は1つ）。通りぬけられると、ふたが しまっている間に その先へ行けなくなる
    var entrance = main[main.length - 2], g = xy(goal);
    ['n', 'e', 's', 'w'].forEach(function (d) {
      if (!cells[g[1]][g[0]][d]) return;
      if (key(g[0] + DIRS[d][0], g[1] + DIRS[d][1]) !== entrance) closeWall(cells, g[0], g[1], d);
    });
    var maze = { w: w, h: h, cells: cells, start: start, goal: goal, stars: [], key: null, door: null };
    reconnect(maze);
    var onMain = {}; main.forEach(function (k) { onMain[k] = 1; });
    if (L.key) {
      maze.door = entrance;   // とびらは ごはんの入り口
      var dk = distances(maze, start, { hasKey: false, starsLeft: 0 });
      var reach = Object.keys(dk).filter(function (k) { return k !== start && k !== goal && k !== maze.door; });
      reach.sort(function (a, b) { return dk[b] - dk[a]; });
      var off = reach.filter(function (k) { return !onMain[k]; });
      maze.key = off[0] || reach[0] || null;
    }
    if (L.stars) {
      var da = distances(maze, start, { hasKey: true, starsLeft: 0 }), used = {};
      [start, goal, maze.key, maze.door].forEach(function (k) { if (k) used[k] = 1; });
      var cand = Object.keys(da).filter(function (k) { return !used[k]; }).sort(function (a, b) { return da[b] - da[a]; });
      var step = Math.max(1, Math.floor(cand.length / (L.stars + 1)));
      for (var i = 0; maze.stars.length < L.stars && i < cand.length; i += step) maze.stars.push(cand[i]);
      for (i = 0; maze.stars.length < L.stars && i < cand.length; i++) if (maze.stars.indexOf(cand[i]) < 0) maze.stars.push(cand[i]);
    }
    return maze;
  }
  function make(level, w, h, rng) {
    rng = rng || Math.random;
    var m = null;
    for (var t = 0; t < 20; t++) { m = build(level, w, h, rng); if (solvable(m)) return m; }
    return m;
  }

  function speakStart(level) {
    var L = lv(level);
    if (L === 3) return 'ほしを 3つ ひろってから、ごはんへ いこう';
    if (L === 4) return 'かぎで とびらを あけて、ごはんへ いこう';
    if (L === 5) return 'ほし 3つと かぎを ひろって、ごはんへ いこう';
    return 'ごはんまで つれていってね';
  }

  // 記録から、いまのレベルと直近の結果（shiritori と同じ形）
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
  var HINT_SEC = 6;          // この秒数 動かないと、道を光らせる
  var WAIT_GOAL = 1500;      // ゴールから 次のめいろまで
  var st = null;             // { profileId, level, recent, round, phase, maze, kind, at, got, hasKey, hinted, hintSaid, done, idle, offTouches, trail, sid, dom, pending }
  var dragging = false, resizeBound = false;

  function U() { return C.chiikuUi; }
  function hasApp() { return !!document.getElementById('app'); }   // テストのページには無い：描かずに状態だけ動く
  function onScreen() { var ui = U(); return st && (!hasApp() || !ui.screenId || ui.screenId() === st.sid); }
  function say(text) { if (st && st.dom) st.dom.bub.textContent = text; try { if (hasApp()) U().speak(text); } catch (e) {} }
  function play(name) { try { if (hasApp()) U().play(name); } catch (e) {} }
  function starsLeft() { return st.maze.stars.length - Object.keys(st.got).length; }
  function moveState() { return { hasKey: st.hasKey, starsLeft: starsLeft(), got: st.got }; }

  function start(profileId) {
    st = { profileId: profileId, level: 1, recent: [], round: 1, phase: 'loading' };
    var ui = U();
    var sid = (hasApp() && ui.screenId) ? ui.screenId() : null;   // 記録を読むあいだに ホームへ戻ったら、始めない
    if (!resizeBound && hasApp()) { resizeBound = true; window.addEventListener('resize', onResize); }
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(profileId); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        var p = progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent;
        if (sid !== null && ui.screenId() !== sid) return;
        newMaze(false);
      });
  }

  function isOver() { try { return C.timer.isOver(st.profileId); } catch (e) { return false; } }

  // 新しい めいろ。rebuild：画面の向きが変わったときの作り直し（記録しない・声も出し直さない）
  function newMaze(rebuild) {
    var ui = U();
    if (!rebuild && isOver()) { st.phase = 'rest'; if (hasApp()) ui.showRest(); return; }
    st.phase = 'play'; st.got = {}; st.hasKey = false; st.hinted = false; st.hintSaid = false;
    st.done = false; st.idle = 0; st.offTouches = 0; st.pending = null; st.dom = null; dragging = false; activeId = null; st.walk = []; st.walking = false;
    if (!hasApp()) {     // テスト：表の大きさ（スマホ よこ）で作る
      var d = fit(st.level, 'land', 788, 289, MIN_CELL);
      st.kind = 'land'; st.maze = make(st.level, d.w, d.h); st.at = st.maze.start; st.trail = [st.at];
      return;
    }
    var app = ui.newScreen('meiro');
    st.sid = ui.screenId ? ui.screenId() : null;
    var bar = ui.topBar({ home: true });
    var talk = ui.el('div', 'mr-talk');
    var bub = ui.bubble(speakStart(st.level)); bub.classList.add('mr-bub');   // 文を入れてから 板の広さを はかる
    var goals = ui.el('div', 'mr-goals');
    talk.appendChild(bub);
    bar.insertBefore(talk, bar.lastChild);
    bar.insertBefore(goals, bar.lastChild);
    var board = ui.el('div', 'mr-board');
    app.appendChild(bar); app.appendChild(board);
    st.dom = { bub: bub, goals: goals, board: board };
    // めいろの大きさは、板に使える 実際の広さから決める
    var r = board.getBoundingClientRect(), cs = window.getComputedStyle(board);
    var bw = r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var bh = r.height - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    var vw = window.innerWidth, vh = window.innerHeight;
    st.kind = kindOf(vw, vh);
    var low = vw > vh && vh <= 340;
    var f = fit(st.level, st.kind, Math.max(1, bw), Math.max(1, bh), low ? MIN_CELL_LOW : MIN_CELL);
    st.maze = make(st.level, f.w, f.h); st.cell = f.cell; st.at = st.maze.start; st.trail = [st.at];
    render();
    if (!rebuild) say(speakStart(st.level));
    watch();
  }

  /* ---------- 絵 ---------- */
  var ART = {
    chick: '<g class="mr-body"><ellipse cx="0" cy="34" rx="24" ry="5" fill="rgba(0,0,0,.1)"/><ellipse cx="0" cy="4" rx="30" ry="31" fill="#ffd84d"/><ellipse cx="0" cy="14" rx="19" ry="17" fill="#fff0b3"/><circle cx="-10" cy="-3" r="4.5" fill="#3a3a3a"/><circle cx="10" cy="-3" r="4.5" fill="#3a3a3a"/><ellipse cx="-19" cy="7" rx="5" ry="3" fill="#ff9fb0"/><ellipse cx="19" cy="7" rx="5" ry="3" fill="#ff9fb0"/><path d="M-6 5 L6 5 L0 12 Z" fill="#ff8a3d"/><path d="M-4 -26 Q0 -34 4 -26" fill="none" stroke="#ffc93d" stroke-width="4" stroke-linecap="round"/></g>',
    food: '<ellipse cx="0" cy="22" rx="30" ry="6" fill="rgba(0,0,0,.1)"/><path d="M-28 -2 H28 Q26 22 0 24 Q-26 22 -28 -2 Z" fill="#ff8a5b"/><path d="M-26 -2 Q-20 -22 0 -20 Q20 -22 26 -2 Z" fill="#ffd23f"/><circle cx="-10" cy="-10" r="4" fill="#ffe680"/><circle cx="4" cy="-13" r="4" fill="#ffe680"/><circle cx="14" cy="-6" r="4" fill="#ffe680"/>',
    lid: '<path d="M-31 -2 Q-28 -30 0 -30 Q28 -30 31 -2 Z" fill="#c9d3dc" stroke="#9aa6b2" stroke-width="3"/><circle cx="0" cy="-33" r="5" fill="#9aa6b2"/>',
    star: '<path d="M0 -22 L6 -7 L22 -7 L9 3 L14 19 L0 9 L-14 19 L-9 3 L-22 -7 L-6 -7 Z" fill="#ffd23f" stroke="#e8a92d" stroke-width="2.5" stroke-linejoin="round"/>',
    key: '<circle cx="-10" cy="0" r="10" fill="none" stroke="#e8a92d" stroke-width="6"/><path d="M0 0 H24 M16 0 V9 M22 0 V7" stroke="#e8a92d" stroke-width="6" stroke-linecap="round"/>',
    door: '<rect x="-26" y="-30" width="52" height="60" rx="8" fill="#b07a3a"/><rect x="-20" y="-24" width="40" height="48" rx="5" fill="#c98e48"/><circle cx="12" cy="2" r="4" fill="#ffd23f"/><rect x="-7" y="-6" width="14" height="12" rx="3" fill="#7a5226"/>'
  };
  function center(k) { var p = xy(k); return [(p[0] + 0.5) * st.cell, (p[1] + 0.5) * st.cell]; }
  function lineOf(list) { return list.map(function (k, i) { var p = center(k); return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(''); }
  function render() {
    var mz = st.maze, cs = st.cell, W = mz.w * cs, H = mz.h * cs, wall = Math.max(8, cs * 0.16), sc = cs / 86;
    var s = '<svg class="mr-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="' + wall + '" fill="#fff6dc"/>';
    s += '<path class="mr-hint" stroke-width="' + (cs * 0.3) + '" d=""/>';
    s += '<path class="mr-trail" stroke-width="' + (cs * 0.18) + '" stroke-dasharray="1 ' + (cs * 0.32) + '" d=""/>';
    var wp = '';
    for (var y = 0; y < mz.h; y++) for (var x = 0; x < mz.w; x++) {
      var c = mz.cells[y][x], X = x * cs, Y = y * cs;
      if (!c.n) wp += 'M' + X + ' ' + Y + 'H' + (X + cs);
      if (!c.w) wp += 'M' + X + ' ' + Y + 'V' + (Y + cs);
      if (y === mz.h - 1 && !c.s) wp += 'M' + X + ' ' + (Y + cs) + 'H' + (X + cs);
      if (x === mz.w - 1 && !c.e) wp += 'M' + (X + cs) + ' ' + Y + 'V' + (Y + cs);
    }
    s += '<path d="' + wp + '" stroke="#5aa64a" stroke-width="' + wall + '" stroke-linecap="round" fill="none"/>';
    s += '<path d="' + wp + '" stroke="#7ccb63" stroke-width="' + (wall * 0.45) + '" stroke-linecap="round" fill="none"/>';
    function at(k, inner, cls) { var p = center(k); return '<g class="' + cls + '" data-at="' + k + '" transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + sc + ')">' + inner + '</g>'; }
    s += at(mz.goal, ART.food + '<g class="mr-lid"' + (starsLeft() ? '' : ' style="display:none"') + '>' + ART.lid + '</g>', 'mr-food');
    mz.stars.forEach(function (k) { s += at(k, ART.star, 'mr-star'); });
    if (mz.key) s += at(mz.key, ART.key, 'mr-key');
    if (mz.door) s += at(mz.door, ART.door, 'mr-door');
    var cp = center(st.at);
    s += '<g class="mr-chick" style="transform:translate(' + cp[0] + 'px,' + cp[1] + 'px)"><g transform="scale(' + sc + ')">' + ART.chick + '</g></g>';
    s += '</svg>';
    st.dom.board.innerHTML = s;
    st.dom.svg = st.dom.board.firstChild;
    st.dom.chick = st.dom.svg.querySelector('.mr-chick');
    st.dom.trail = st.dom.svg.querySelector('.mr-trail');
    st.dom.hint = st.dom.svg.querySelector('.mr-hint');
    var g = '';
    mz.stars.forEach(function () { g += '<span class="mr-g">⭐</span>'; });
    if (mz.key) g += '<span class="mr-g mr-gk">🔑</span>';
    st.dom.goals.innerHTML = g;
    bindPointer(st.dom.svg);
    drawTrail();
  }
  function drawTrail() { if (st.dom && st.dom.trail) st.dom.trail.setAttribute('d', lineOf(st.trail)); }
  function hideItem(cls, k) {
    if (!st.dom) return;
    var e = st.dom.svg.querySelector('.' + cls + '[data-at="' + k + '"]');
    if (e) { e.classList.add('mr-pop'); U().later(function () { e.style.display = 'none'; }, 380); }
  }
  function markGoal(sel) { if (!st.dom) return; var e = st.dom.goals.querySelector(sel); if (e) e.classList.add('got'); }

  /* ---------- 指の動き ---------- */
  function cellAt(ev) {
    var r = st.dom.svg.getBoundingClientRect();
    var x = Math.floor((ev.clientX - r.left) / (r.width / st.maze.w)), y = Math.floor((ev.clientY - r.top) / (r.height / st.maze.h));
    if (x < 0 || y < 0 || x >= st.maze.w || y >= st.maze.h) return null;
    return key(x, y);
  }
  // 指の動きは、さいしょに ひよこを さわった1本の指（activeId）だけを見る。
  // 2本目の指や てのひらで ひよこが引っぱられたり、それを はなしたときに 引っぱりが止まったりしないように
  var activeId = null;
  function pointerDown(id, c) {   // ひよこを つかんだら true
    if (!st || !onScreen() || st.phase !== 'play' || st.done || !c) return false;
    if (dragging) return false;                                 // もう1本の指が 引っぱっている
    var a = xy(st.at), b = xy(c);
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 1) {   // ひよこから離れた所
      st.offTouches++;
      if (st.offTouches >= 3) { st.offTouches = 0; say(TEXT.touchChick); hop(); }
      return false;
    }
    st.offTouches = 0; dragging = true; activeId = id;
    moveToward(c);
    return true;
  }
  function pointerMove(id, c) { if (dragging && id === activeId && onScreen()) moveToward(c); }
  function pointerUp(id) { if (id !== activeId) return; dragging = false; activeId = null; if (st) st.idle = 0; }
  function bindPointer(svg) {
    svg.addEventListener('pointerdown', function (ev) {
      if (pointerDown(ev.pointerId, cellAt(ev))) {
        try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
        ev.preventDefault();
      }
    });
    svg.addEventListener('pointermove', function (ev) { pointerMove(ev.pointerId, cellAt(ev)); });
    function up(ev) { pointerUp(ev.pointerId); }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('lostpointercapture', up);
  }
  function hop() {
    if (!st.dom || !st.dom.chick) return;
    var c = st.dom.chick; c.classList.remove('mr-hop'); void c.getBoundingClientRect(); c.classList.add('mr-hop');
  }
  var STEP_DIR = function (dx, dy) { return dx ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n'); };
  // 指のあるマスへ向かって、たて・よこの 指に近い方から1マスずつ（最大4マス）
  function moveToward(cell) {
    if (!st || st.phase !== 'play' || st.done || !cell) return;
    var t = xy(cell);
    if (!(t[0] >= 0 && t[1] >= 0 && t[0] < st.maze.w && t[1] < st.maze.h)) return;
    for (var n = 0; n < 4 && st.at !== cell && !st.done; n++) {
      var a = xy(st.at), dx = t[0] - a[0], dy = t[1] - a[1];
      var order = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
      var moved = false;
      for (var i = 0; i < 2 && !moved; i++) {
        if (!order[i][0] && !order[i][1]) continue;
        var nk = canMove(st.maze, st.at, STEP_DIR(order[i][0], order[i][1]), moveState());
        if (nk) { arrive(nk); moved = true; }
      }
      if (!moved) break;
    }
  }
  // ひよこの絵は1マスずつ歩かせる（一度に何マスも進んだとき、まっすぐ動かすと 生けがきを通りぬけて見えるため）
  var STEP_MS = 110;
  function walkTo(k) {
    if (!st.dom || !st.dom.chick) return;
    st.walk = st.walk || [];
    st.walk.push(k);
    if (!st.walking) walkNext();
  }
  function walkNext() {
    if (!st.dom || !st.dom.chick || !st.walk || !st.walk.length) { if (st) st.walking = false; return; }
    st.walking = true;
    var p = center(st.walk.shift());
    st.dom.chick.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)';
    hop();
    U().later(walkNext, STEP_MS);
  }
  function arrive(k) {
    st.at = k; st.idle = 0; showHint(false);
    if (st.trail[st.trail.length - 2] === k) st.trail.pop(); else st.trail.push(k);
    walkTo(k);
    drawTrail();
    var mz = st.maze;
    if (mz.stars.indexOf(k) >= 0 && !st.got[k]) {
      st.got[k] = 1; play('star'); hideItem('mr-star', k);
      if (st.dom) { var gs = st.dom.goals.querySelectorAll('.mr-g:not(.mr-gk):not(.got)'); if (gs[0]) gs[0].classList.add('got'); }
      if (!starsLeft()) {
        if (st.dom) { var lid = st.dom.svg.querySelector('.mr-lid'); if (lid) lid.style.display = 'none'; }
        say(mz.key && !st.hasKey ? TEXT.findKey : TEXT.lidOpen);
      } else say(TEXT.star);
    }
    if (mz.key && k === mz.key && !st.hasKey) {
      st.hasKey = true; play('star'); hideItem('mr-key', k); markGoal('.mr-gk');
      if (st.dom) hideItem('mr-door', mz.door);
      say(starsLeft() ? TEXT.doorOpenStars : TEXT.doorOpen);
    }
    if (k === mz.goal) goal();
  }

  /* ---------- ゴール・次へ ---------- */
  function goal() {
    if (st.done) return;
    st.done = true; dragging = false; activeId = null; showHint(false);
    play('correct'); say(TEXT.goal);
    var correct = !st.hinted;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: 'lv' + st.level, correct: correct, level: st.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.pending = advance;
    if (hasApp()) U().later(function () { if (st.pending) st.pending(); }, WAIT_GOAL);
  }
  function advance() {
    st.pending = null;
    if (st.round >= ROUND) { showReward(); return; }
    st.round++;
    newMaze(false);
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
    var next = ui.button('btn-big btn-next', function () {
      if (next.disabled) return;
      next.disabled = true;
      ui.play('tap');
      st.round = 1;
      newMaze(false);
    });
    next.setAttribute('aria-label', 'つぎへ');
    next.appendChild(ui.svg(ui.ICO.next));
    next.appendChild(ui.el('span', null, 'つぎへ'));
    info.appendChild(next);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak(TEXT.reward);
  }

  /* ---------- ヒント ---------- */
  function watch() {   // 1秒ごとに、止まっている時間を数える
    var ui = U();
    ui.later(function tick() {
      if (!onScreen() || st.phase !== 'play' || st.done) return;
      if (!dragging) idle(1);
      ui.later(tick, 1000);
    }, 1000);
  }
  function idle(sec) {
    for (var i = 0; i < sec; i++) {
      if (st.phase !== 'play' || st.done) return;
      st.idle++;
      if (st.idle === HINT_SEC) showHint(true);
    }
  }
  function showHint(on) {
    if (!st || !st.maze) return;
    var h = st.dom && st.dom.hint;
    if (!on) { if (h) h.classList.remove('on'); return; }
    st.hinted = true;
    var ms = moveState(), p = path(st.maze, st.at, nextTarget(st.maze, st.at, ms), ms);
    if (h && p) { h.setAttribute('d', lineOf(p)); h.classList.add('on'); }
    if (!st.hintSaid) { st.hintSaid = true; say(TEXT.hint); }
  }

  /* ---------- 画面の向きが変わったら、同じレベルで作り直す ---------- */
  function onResize() {
    if (!st || st.phase !== 'play' || st.done || !onScreen() || !hasApp()) return;
    if (kindOf(window.innerWidth, window.innerHeight) !== st.kind) newMaze(true);
  }

  function state() {
    if (!st) return null;
    return { phase: st.phase, level: st.level, round: st.round, at: st.at, got: st.got, hasKey: st.hasKey,
      hinted: st.hinted, done: st.done, maze: st.maze };
  }

  C.meiro = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND: ROUND, MIN_CELL: MIN_CELL, MIN_CELL_LOW: MIN_CELL_LOW, LEVELS: LEVELS, TEXT: TEXT,
    dims: dims, kindOf: kindOf, fit: fit, make: make, canMove: canMove, path: path, nextTarget: nextTarget,
    speakStart: speakStart, progressFromLogs: progressFromLogs,
    start: start,
    // テスト用
    _state: state, _moveToward: function (c) { moveToward(c); }, _idle: function (s) { idle(s); },
    _next: function () { if (st && st.pending) st.pending(); },
    _down: function (id, c) { return pointerDown(id, c); }, _move: function (id, c) { pointerMove(id, c); }, _up: function (id) { pointerUp(id); }
  };
})();
