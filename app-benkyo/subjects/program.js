/* プログラミングの しくみ。Chiid.program
   矢印の命令（くりかえし も）を ならべて、ロボットを はたまで うごかす問題の 作り方・数え方・うごかした結果・レベル。
   画面には触らない（画面は program-screen.js）。設計書：docs/superpowers/specs/2026-11-19-benkyo-program-design.md */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'program';
  var MAX_LEVEL = 5;
  var ROUND_SIZE = 3;
  // rocks：[いちばん少ない, 多い]。len：道の マス数。segs：まっすぐの 区切りの数（まがる回数＋1）
  var LEVELS = {
    1: { w: 4, h: 4, slots: 6, rocks: [0, 0], stars: 0, len: [3, 4], segs: [1, 2] },
    2: { w: 5, h: 5, slots: 8, rocks: [2, 3], stars: 0, len: [5, 6], segs: [3, 4] },
    3: { w: 6, h: 5, slots: 10, rocks: [4, 5], stars: 1, len: [7, 9], segs: [3, 5] },
    4: { w: 6, h: 5, slots: 5, rocks: [2, 3], stars: 0, loop: true, kind: 'runs' },
    5: { w: 7, h: 6, slots: 5, rocks: [4, 4], stars: 2, loop: true, kind: 'stair' }
  };
  var D = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  var MAX_BODY = 3;   // かっこの中に 入れられる 矢印の数
  // 画面の文（1年生の漢字は そのまま、2年生の漢字は {漢字|よみ}）
  var TEXT = {
    choose: 'どれに する？',
    start: 'やじるしを ならべて、ロボットを はたまで うごかそう',
    star: 'ほしを ぜんぶ とってから、はたへ いこう',
    loop: 'くりかえしを つかって、まとめて ならべよう',
    goal: 'ゴール！ やったね',
    crash: 'ぶつかっちゃった！ もういっかい やってみよう',
    short: 'はたまで とどかなかったね。もういっかい やってみよう',
    stars: 'ほしが のこって いるよ。もういっかい やってみよう',
    full: 'もう ならべられないよ',
    reward: 'よく がんばったね！'
  };

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function key(x, y) { return x + ',' + y; }
  function xy(k) { var p = String(k).split(','); return [+p[0], +p[1]]; }
  function rint(a, b, rng) { return a + Math.floor(rng() * (b - a + 1)); }
  function pick(a, rng) { return a[Math.floor(rng() * a.length)]; }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- 命令の 数え方 ---------- */
  function slotCount(prog) {
    return (prog || []).reduce(function (n, it) { return n + (typeof it === 'string' ? 1 : 1 + it.body.length); }, 0);
  }
  function expand(prog) {
    var out = [];
    (prog || []).forEach(function (it) {
      if (typeof it === 'string') { out.push(it); return; }
      for (var i = 0; i < it.rep; i++) out = out.concat(it.body);
    });
    return out;
  }

  /* ---------- うごかす ---------- */
  // 結果：'goal'（はた。ほしは ぜんぶ）／'crash'（岩・地図の外）／'stars'（はたで おわったが ほしが のこる）／'short'（とどかない）
  function run(pz, prog) {
    var at = xy(pz.start), steps = [], got = {}, rocks = {}, stars = pz.stars || [];
    (pz.rocks || []).forEach(function (r) { rocks[r] = 1; });
    var dirs = expand(prog);
    for (var i = 0; i < dirs.length; i++) {
      var d = D[dirs[i]], nx = at[0] + d[0], ny = at[1] + d[1], nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= pz.w || ny >= pz.h || rocks[nk]) return { result: 'crash', steps: steps, at: key(at[0], at[1]), hit: nk, got: got };
      at = [nx, ny]; steps.push(nk);
      if (stars.indexOf(nk) >= 0) got[nk] = 1;
      if (nk === pz.goal && Object.keys(got).length === stars.length) return { result: 'goal', steps: steps, at: nk, got: got };
    }
    var end = key(at[0], at[1]);
    return { result: end === pz.goal ? 'stars' : 'short', steps: steps, at: end, got: got };
  }

  /* ---------- 問題を 作る ---------- */
  // 命令の列（矢印）で 道を かく。地図の外や 同じマスを 2回 通るときは null
  function trace(w, h, start, dirs) {
    var at = xy(start), path = [start], seen = {}; seen[start] = 1;
    for (var i = 0; i < dirs.length; i++) {
      var d = D[dirs[i]]; at = [at[0] + d[0], at[1] + d[1]];
      var k = key(at[0], at[1]);
      if (at[0] < 0 || at[1] < 0 || at[0] >= w || at[1] >= h || seen[k]) return null;
      seen[k] = 1; path.push(k);
    }
    return path;
  }
  // まっすぐの 区切り（向き・長さ）を 作る。となりの 区切りは 90度 まがる
  function runsDirs(segLens, rng) {
    var horiz = rng() < 0.5, out = [];
    segLens.forEach(function (n) {
      var d = horiz ? pick(['l', 'r'], rng) : pick(['u', 'd'], rng);
      for (var i = 0; i < n; i++) out.push(d);
      horiz = !horiz;
    });
    return out;
  }
  function splitLen(total, segs, rng) {   // total を segs こ（どれも 1 以上）に 分ける
    var a = []; for (var i = 0; i < segs; i++) a.push(1);
    for (var j = segs; j < total; j++) a[Math.floor(rng() * segs)]++;
    return a;
  }
  function solutionOf(level, dirs, plan) {
    if (plan) return plan;
    return dirs.slice();
  }
  function tryMake(level, rng) {
    var L = LEVELS[level], w = L.w, h = L.h, dirs, sol;
    if (!L.loop) {
      var total = rint(L.len[0], L.len[1], rng), segs = Math.min(total, rint(L.segs[0], L.segs[1], rng));
      dirs = runsDirs(splitLen(total, segs, rng), rng);
      sol = dirs.slice();
    } else if (L.kind === 'runs') {
      // 2区切り（3〜4マスずつ）、または 3区切り（3〜4・3〜4・1）。どれも まとめれば 5こ以内
      var lens = rng() < 0.5 ? [rint(3, 4, rng), rint(3, 4, rng)] : [rint(3, 4, rng), rint(3, 4, rng), 1];
      dirs = runsDirs(lens, rng);
      sol = []; var i = 0;
      lens.forEach(function (n) { var d = dirs[i]; sol.push(n === 1 ? d : { rep: n, body: [d] }); i += n; });
    } else {
      // かいだん：（よこ・たて）を 3かい ＋ まっすぐ 2〜3マス
      var a = pick(['l', 'r'], rng), b = pick(['u', 'd'], rng), tail = rint(2, 3, rng);
      var c = rng() < 0.5 ? a : b;
      dirs = [a, b, a, b, a, b]; for (var t = 0; t < tail; t++) dirs.push(c);
      sol = [{ rep: 3, body: [a, b] }, { rep: tail, body: [c] }];
    }
    var cand = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) cand.push(key(x, y));
    var start = null, path = null;
    shuffle(cand, rng).some(function (s) { var p = trace(w, h, s, dirs); if (p) { start = s; path = p; return true; } return false; });
    if (!path) return null;
    var onPath = {}; path.forEach(function (k) { onPath[k] = 1; });
    var goal = path[path.length - 1];
    var mid = path.slice(1, -1);
    var stars = shuffle(mid, rng).slice(0, L.stars || 0);
    var free = cand.filter(function (k) { return !onPath[k]; });
    var nRocks = rint(L.rocks[0], L.rocks[1], rng);
    // 岩は 道の となりを 先に（道を まちがえやすく する）
    var near = free.filter(function (k) { var p = xy(k); return ['u', 'd', 'l', 'r'].some(function (d) { return onPath[key(p[0] + D[d][0], p[1] + D[d][1])]; }); });
    var rocks = shuffle(near, rng).concat(shuffle(free.filter(function (k) { return near.indexOf(k) < 0; }), rng)).slice(0, nRocks);
    if (rocks.length < L.rocks[0]) return null;
    return { level: level, w: w, h: h, start: start, goal: goal, rocks: rocks, stars: stars, slots: L.slots, loop: !!L.loop, solution: solutionOf(level, dirs, sol) };
  }
  function make(level, rng) {
    level = lv(level); rng = rng || Math.random;
    for (var i = 0; i < 300; i++) { var pz = tryMake(level, rng); if (pz) return pz; }
    // ここには 来ない（念のため：いちばん かんたんな 形）
    return { level: level, w: LEVELS[level].w, h: LEVELS[level].h, start: key(0, 0), goal: key(2, 0), rocks: [], stars: [], slots: LEVELS[level].slots, loop: !!LEVELS[level].loop, solution: ['r', 'r'] };
  }

  // 記録から、いまのレベルと直近の結果（ほかの教科と 同じ形）
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [] };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    if (mine.length) {
      res.level = lv(mine[mine.length - 1].level);
      var run0 = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run0.unshift(!!mine[i].correct);
      res.recent = run0.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  C.program = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, LEVELS: LEVELS, TEXT: TEXT, DIRS: D, MAX_BODY: MAX_BODY,
    slotCount: slotCount, expand: expand, run: run, make: make, progressFromLogs: progressFromLogs
  };
})();
