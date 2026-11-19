/* すうどく（べんきょう）のテスト。設計書：docs/superpowers/specs/2026-11-19-benkyo-sudoku-design.md */
(function () {
  'use strict';
  var C = window.Chiid;
  function S() { return C.sudoku; }
  function seeded(n) { var s = n; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function validFull(sz, g) {   // 表が ルールどおり（たて・よこ・わくに 1〜N が1つずつ）
    var L = S().SIZES[sz], N = L.n;
    function ok(cells) { var s = cells.slice().sort(function (a, b) { return a - b; }).join(','); var w = []; for (var i = 1; i <= N; i++) w.push(i); return s === w.join(','); }
    for (var r = 0; r < N; r++) { if (!ok(g.slice(r * N, r * N + N))) return false; var col = []; for (var c = 0; c < N; c++) col.push(g[c * N + r]); if (!ok(col)) return false; }
    for (var br = 0; br < N; br += L.bh) for (var bc = 0; bc < N; bc += L.bw) { var box = []; for (var y = 0; y < L.bh; y++) for (var x = 0; x < L.bw; x++) box.push(g[(br + y) * N + bc + x]); if (!ok(box)) return false; }
    return true;
  }

  C.test('sudoku: 定数（5レベル、4×4・4×4・6×6・9×9・9×9、空き 5-6・9-10・16-18・36-40・52-56）', function () {
    var s = S();
    C.assertEq(s.AREA, 'sudoku'); C.assertEq(s.MAX_LEVEL, 5);
    C.assertEq(JSON.stringify([1, 2, 3, 4, 5].map(function (l) { return [s.LEVELS[l].size, s.LEVELS[l].blanks]; })),
      JSON.stringify([[4, [5, 6]], [4, [9, 10]], [6, [16, 18]], [9, [36, 40]], [9, [52, 56]]]));
    C.assertEq(JSON.stringify([1, 2, 3, 4, 5].map(function (l) { return [!!s.LEVELS[l].instant, !!s.LEVELS[l].memo]; })),
      JSON.stringify([[true, false], [true, false], [false, false], [false, true], [false, true]]));
  });
  C.test('sudoku: countSolutions は 答えの数を 数える（2で 止める）', function () {
    var s = S();
    var g = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
    C.assertEq(s.countSolutions(4, g.slice()), 1);
    var holes = g.slice(); [0, 1, 4, 5].forEach(function (i) { holes[i] = 0; });   // 1と2・3と4の 入れかえで 2通り になる 空け方
    holes[2] = 0; holes[3] = 0; holes[6] = 0; holes[7] = 0;
    C.assertEq(s.countSolutions(4, holes) >= 1, true);
    C.assertEq(s.countSolutions(4, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 2);
  });
  C.test('sudoku: make は ルールどおりの 答えと、答えが1つだけの 問題（空きの 数も レベルどおり）', function () {
    var s = S(), bad = [];
    [1, 2, 3, 4].forEach(function (lv) {
      for (var i = 0; i < (lv < 4 ? 8 : 3); i++) {
        var p = s.make(lv, seeded(lv * 31 + i)), L = s.LEVELS[lv];
        var blanks = p.puzzle.filter(function (v) { return !v; }).length;
        if (!validFull(L.size, p.solution)) bad.push(lv + ' sol');
        if (blanks < L.blanks[0] || blanks > L.blanks[1]) bad.push(lv + ' blanks ' + blanks);
        if (s.countSolutions(L.size, p.puzzle.slice()) !== 1) bad.push(lv + ' unique');
        p.puzzle.forEach(function (v, j) { if (v && v !== p.solution[j]) bad.push(lv + ' clue'); });
      }
    });
    if (bad.length) throw new Error(bad.slice(0, 5).join(' / '));
  });
  C.test('sudoku: レベル5（大人むけ）も 答えが1つだけ、空き 52〜56', function () {
    var s = S(), p = s.make(5, seeded(77));
    var blanks = p.puzzle.filter(function (v) { return !v; }).length;
    C.assertEq(blanks >= 52 && blanks <= 56, true);
    C.assertEq(s.countSolutions(9, p.puzzle.slice()), 1);
  });
  C.test('sudoku: conflicts は たて・よこ・わくに 同じ数字が あるマスを 返す', function () {
    var s = S(), g = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    C.assertEq(s.conflicts(4, g, 3, 1).length, 1);    // 同じ よこ
    C.assertEq(s.conflicts(4, g, 12, 1).length, 1);   // 同じ たて
    C.assertEq(s.conflicts(4, g, 5, 1).length, 1);    // 同じ わく
    C.assertEq(s.conflicts(4, g, 10, 1).length, 0);
  });
  C.test('sudoku: 文', function () {
    var T = S().TEXT;
    ['choose', 'rule', 'start', 'conflict', 'wrong', 'check', 'clear', 'hint', 'reward'].forEach(function (k) { if (!T[k]) throw new Error(k); });
  });
})();

/* すうどくの画面（sudoku-screen.js）。#app が無いので描画はせず、状態だけを動かす */
(function () {
  'use strict';
  var C = window.Chiid;
  var V = function () { return C.benkyo.sudokuScreen; };
  var PID = 'p-sudoku';
  function withLogs(logs, fn) {
    var St = C.storage, og = St.getLogs, ol = St.logAnswer, saved = [];
    St.getLogs = function () { return Promise.resolve(logs); };
    St.logAnswer = function (e) { saved.push(e); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { St.getLogs = og; St.logAnswer = ol; return v; }, function (e) { St.getLogs = og; St.logAnswer = ol; throw e; });
  }
  function blanks() { var s = V()._state(); return s.puzzle.map(function (v, i) { return v ? -1 : i; }).filter(function (i) { return i >= 0; }); }
  function fillAll() { var s = V()._state(); blanks().forEach(function (i) { V()._select(i); V()._put(s.solution[i]); }); }
  function wrongDigit(i) { var s = V()._state(), n = s.size; for (var d = 1; d <= n; d++) if (d !== s.solution[i]) return d; }

  C.test('sudokuScreen: show は 記録の レベル、level で そのレベル', function () {
    return withLogs([], function () {
      return V().show({ profileId: PID }).then(function () {
        C.assertEq(V()._state().phase, 'play'); C.assertEq(V()._state().level, 1); C.assertEq(V()._state().size, 4);
        return V().show({ profileId: PID, level: 3 });
      }).then(function () { C.assertEq(V()._state().size, 6); });
    });
  });
  C.test('sudokuScreen: レベル1は まちがいを すぐ 知らせ、ぜんぶ 正しく うめると 正解・記録・ごほうび', function () {
    return withLogs([], function (saved) {
      return V().show({ profileId: PID, level: 1 }).then(function () {
        var i = blanks()[0];
        V()._select(i); V()._put(wrongDigit(i));
        C.assertEq(V()._state().bad.indexOf(i) >= 0, true); C.assertEq(V()._state().mistakes, 1);
        fillAll();
        C.assertEq(V()._state().phase, 'clear');
        C.assertEq(saved.length, 1); C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct]), JSON.stringify(['sudoku', 'lv1', true]));
        V()._flush();
        C.assertEq(V()._state().phase, 'reward');
      });
    });
  });
  C.test('sudokuScreen: もとの数字は 変えられない、けすで 消える', function () {
    return withLogs([], function () {
      return V().show({ profileId: PID, level: 1 }).then(function () {
        var s = V()._state(), given = s.puzzle.findIndex(function (v) { return v; }), i = blanks()[0];
        V()._select(given); V()._put(wrongDigit(given));
        C.assertEq(V()._state().grid[given], s.puzzle[given]);
        V()._select(i); V()._put(s.solution[i]); V()._erase();
        C.assertEq(V()._state().grid[i], 0);
      });
    });
  });
  C.test('sudokuScreen: レベル3は すぐには 知らせず、こたえあわせで ちがうマスを 赤く', function () {
    return withLogs([], function (saved) {
      return V().show({ profileId: PID, level: 3 }).then(function () {
        var s = V()._state(), b = blanks();
        b.forEach(function (i, n) { V()._select(i); V()._put(n === 0 ? wrongDigit(i) : s.solution[i]); });
        C.assertEq(V()._state().bad.length, 0);
        V()._check();
        C.assertEq(V()._state().bad, [b[0]]); C.assertEq(V()._state().mistakes, 1); C.assertEq(saved.length, 0);
        V()._select(b[0]); V()._put(s.solution[b[0]]); V()._check();
        C.assertEq(V()._state().phase, 'clear'); C.assertEq(saved[0].correct, true);
      });
    });
  });
  C.test('sudokuScreen: メモ（レベル4）は 小さい数字を 書いて 消せる。レベル1〜3では 使えない', function () {
    return withLogs([], function () {
      return V().show({ profileId: PID, level: 4 }).then(function () {
        var i = blanks()[0];
        V()._select(i); V()._memo(); V()._put(3); V()._put(5);
        C.assertEq(V()._state().memos[i].join(','), '3,5'); C.assertEq(V()._state().grid[i], 0);
        V()._put(3);
        C.assertEq(V()._state().memos[i].join(','), '5');
        return V().show({ profileId: PID, level: 2 });
      }).then(function () {
        V()._memo(); C.assertEq(V()._state().memoMode, false);
      });
    });
  });
  C.test('sudokuScreen: ヒントで 正しい数字が1つ 入り、使うと 記録は false', function () {
    return withLogs([], function (saved) {
      return V().show({ profileId: PID, level: 1 }).then(function () {
        var before = blanks().length;
        V()._hint();
        C.assertEq(blanks().length, before);   // もとの 問題は そのまま
        C.assertEq(V()._state().grid.filter(function (v) { return !v; }).length, before - 1);
        fillAll();
        C.assertEq(saved[0].correct, false);
      });
    });
  });
  C.test('sudoku: 親画面と 教科の一覧に「すうどく」がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/sudoku: 'すうどく'/.test(t), true);
      return fetch('../app-benkyo/main.js');
    }).then(function (r) { return r.text(); }).then(function (t) { C.assertEq(/id: 'sudoku'/.test(t), true); });
  });
})();
