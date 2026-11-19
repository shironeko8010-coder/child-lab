/* すうどくの しくみ。Chiid.sudoku
   問題の 作り方（答えが 1つだけ）・答えの 数え方・同じ数字の しらべ方・レベル。画面には触らない（画面は sudoku-screen.js）。
   表は 1列に ならべた 配列（0＝空き）。設計書：docs/superpowers/specs/2026-11-19-benkyo-sudoku-design.md */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'sudoku';
  var MAX_LEVEL = 5;
  var SIZES = { 4: { n: 4, bh: 2, bw: 2 }, 6: { n: 6, bh: 2, bw: 3 }, 9: { n: 9, bh: 3, bw: 3 } };
  var LEVELS = {
    1: { size: 4, blanks: [5, 6], instant: true },
    2: { size: 4, blanks: [9, 10], instant: true },
    3: { size: 6, blanks: [16, 18] },
    4: { size: 9, blanks: [36, 40], memo: true },
    5: { size: 9, blanks: [52, 56], memo: true }
  };
  // 画面の文（1年生の漢字は そのまま、2年生の漢字は {漢字|よみ}）
  var TEXT = {
    choose: 'どれに する？',
    rule: 'たて、よこ、ふとい わくの 中に、おなじ {数|すう}字が 1つずつ 入るよ',
    start: 'あいている マスを うめよう',
    conflict: 'たて・よこ・わくに おなじ {数|すう}字が あるよ',
    wrong: 'ほかの {数|すう}字を ためして みよう',
    check: 'あかい マスを みなおそう',
    clear: 'できた！ すごいね',
    hint: 'ひとつ 入れたよ',
    reward: 'よく がんばったね！'
  };

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // マスごとの となり（同じ たて・よこ・わく）
  var peerCache = {};
  function peers(size) {
    if (peerCache[size]) return peerCache[size];
    var L = SIZES[size], N = L.n, out = [];
    for (var i = 0; i < N * N; i++) {
      var r = Math.floor(i / N), c = i % N, br = r - r % L.bh, bc = c - c % L.bw, set = {};
      for (var k = 0; k < N; k++) { set[r * N + k] = 1; set[k * N + c] = 1; }
      for (var y = 0; y < L.bh; y++) for (var x = 0; x < L.bw; x++) set[(br + y) * N + bc + x] = 1;
      delete set[i];
      out.push(Object.keys(set).map(Number));
    }
    peerCache[size] = out;
    return out;
  }
  function candidates(size, g, i) {
    var used = {}, out = [];
    peers(size)[i].forEach(function (p) { if (g[p]) used[g[p]] = 1; });
    for (var d = 1; d <= SIZES[size].n; d++) if (!used[d]) out.push(d);
    return out;
  }
  // 答えの 数（limit で 止める。ふつうは 2）。g は 書きかえて もとに もどす
  function countSolutions(size, g, limit) {
    limit = limit || 2;
    var count = 0;
    (function solve() {
      if (count >= limit) return;
      var best = -1, bestC = null;
      for (var i = 0; i < g.length; i++) {
        if (g[i]) continue;
        var cs = candidates(size, g, i);
        if (!cs.length) return;
        if (!bestC || cs.length < bestC.length) { best = i; bestC = cs; if (cs.length === 1) break; }
      }
      if (best < 0) { count++; return; }
      for (var j = 0; j < bestC.length && count < limit; j++) { g[best] = bestC[j]; solve(); }
      g[best] = 0;
    })();
    return count;
  }
  // ぜんぶ うまった 答えの 表を ランダムに 作る
  function fullGrid(size, rng) {
    var N = SIZES[size].n, g = []; for (var i = 0; i < N * N; i++) g.push(0);
    (function fill(i) {
      if (i >= g.length) return true;
      var cs = shuffle(candidates(size, g, i), rng);
      for (var j = 0; j < cs.length; j++) { g[i] = cs[j]; if (fill(i + 1)) return true; }
      g[i] = 0; return false;
    })(0);
    return g;
  }
  // 問題：答えから マスを 空けていく（答えが 1つだけの あいだ）。空きの 数が レベルの はんいに 入るまで
  function make(level, rng) {
    level = lv(level); rng = rng || Math.random;
    var L = LEVELS[level], size = L.size;
    for (var tries = 0; tries < 30; tries++) {
      var sol = fullGrid(size, rng), puz = sol.slice();
      var target = L.blanks[0] + Math.floor(rng() * (L.blanks[1] - L.blanks[0] + 1)), removed = 0;
      var order = shuffle(sol.map(function (v, i) { return i; }), rng);
      for (var k = 0; k < order.length && removed < target; k++) {
        var i = order[k], keep = puz[i];
        puz[i] = 0;
        if (countSolutions(size, puz.slice()) === 1) removed++;
        else puz[i] = keep;
      }
      if (removed >= L.blanks[0]) return { level: level, size: size, puzzle: puz, solution: sol };
    }
    return { level: level, size: size, puzzle: puz, solution: sol };   // ここには ほぼ 来ない（空きが 少なめでも 解ける）
  }
  // i に d を 入れたとき、同じ たて・よこ・わくで d が ある マス
  function conflicts(size, g, i, d) { return peers(size)[i].filter(function (p) { return g[p] === d; }); }

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

  C.sudoku = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, SIZES: SIZES, LEVELS: LEVELS, TEXT: TEXT,
    countSolutions: countSolutions, make: make, conflicts: conflicts, candidates: candidates, peers: peers, progressFromLogs: progressFromLogs
  };
})();
