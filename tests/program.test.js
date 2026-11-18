/* プログラミング（べんきょう）のテスト。設計書：docs/superpowers/specs/2026-11-19-benkyo-program-design.md */
(function () {
  'use strict';
  var C = window.Chiid;
  function P() { return C.program; }
  function seeded(n) { var s = n; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function k(x, y) { return x + ',' + y; }

  C.test('program: 定数（5レベル、3問で ごほうび、ならべる場所 6・8・10・5・5）', function () {
    var p = P();
    C.assertEq(p.AREA, 'program'); C.assertEq(p.MAX_LEVEL, 5); C.assertEq(p.ROUND_SIZE, 3);
    C.assertEq(JSON.stringify([1, 2, 3, 4, 5].map(function (l) { return p.LEVELS[l].slots; })), JSON.stringify([6, 8, 10, 5, 5]));
    C.assertEq(JSON.stringify([1, 2, 3, 4, 5].map(function (l) { return [p.LEVELS[l].w, p.LEVELS[l].h]; })), JSON.stringify([[4, 4], [5, 5], [6, 5], [6, 5], [7, 6]]));
    C.assertEq(JSON.stringify([1, 2, 3, 4, 5].map(function (l) { return !!p.LEVELS[l].loop; })), JSON.stringify([false, false, false, true, true]));
  });
  C.test('program: slotCount と expand（くりかえしは かっこ1こ＋中の矢印）', function () {
    var p = P(), prog = ['r', { rep: 3, body: ['r', 'u'] }, 'd'];
    C.assertEq(p.slotCount(prog), 5);
    C.assertEq(p.expand(prog).join(''), 'rrururud');
    C.assertEq(p.slotCount([]), 0);
  });
  C.test('program: run は はた・ぶつかる・とどかない・ほしが のこる を 見分ける', function () {
    var p = P();
    var pz = { w: 4, h: 4, start: k(0, 3), goal: k(2, 3), rocks: [k(0, 2)], stars: [] };
    C.assertEq(p.run(pz, ['r', 'r']).result, 'goal');
    C.assertEq(p.run(pz, ['r', 'r', 'r']).result, 'goal');               // はたで 止まる
    C.assertEq(p.run(pz, ['u']).result, 'crash');                        // 岩
    C.assertEq(p.run(pz, ['d']).result, 'crash');                        // 地図の外
    C.assertEq(p.run(pz, ['r']).result, 'short');
    var st = { w: 4, h: 4, start: k(0, 3), goal: k(2, 3), rocks: [], stars: [k(1, 2)] };
    C.assertEq(p.run(st, ['r', 'r']).result, 'stars');                   // はたに 着いたが ほしが のこる
    C.assertEq(p.run(st, ['u', 'r', 'd', 'r']).result, 'goal');
    var r = p.run(pz, ['r', 'u', 'u']);
    C.assertEq(r.steps.length, 3); C.assertEq(r.steps[0], k(1, 3));     // 動いた マス
  });
  C.test('program: どのレベルも 解ける問題（答えは ならべる場所に入り、run で はた）', function () {
    var p = P(), bad = [];
    [1, 2, 3, 4, 5].forEach(function (lv) {
      for (var i = 0; i < 40; i++) {
        var pz = p.make(lv, seeded(lv * 100 + i)), L = p.LEVELS[lv];
        if (pz.w !== L.w || pz.h !== L.h) bad.push(lv + ' size');
        if (p.slotCount(pz.solution) > pz.slots) bad.push(lv + ' slots');
        if (p.run(pz, pz.solution).result !== 'goal') bad.push(lv + ' run ' + JSON.stringify(pz.solution));
        if (pz.rocks.indexOf(pz.start) >= 0 || pz.rocks.indexOf(pz.goal) >= 0) bad.push(lv + ' rock');
        if (pz.stars.length !== (L.stars || 0)) bad.push(lv + ' stars');
        var rk = L.rocks || [0, 0];
        if (pz.rocks.length < rk[0] || pz.rocks.length > rk[1]) bad.push(lv + ' rocks ' + pz.rocks.length);
        if (!L.loop && pz.solution.some(function (it) { return typeof it !== 'string'; })) bad.push(lv + ' loop');
      }
    });
    if (bad.length) throw new Error(bad.slice(0, 5).join(' / '));
  });
  C.test('program: レベル4・5は 矢印だけでは 場所が 足りない（まとめないと 入らない）', function () {
    var p = P();
    [4, 5].forEach(function (lv) {
      for (var i = 0; i < 30; i++) {
        var pz = p.make(lv, seeded(lv * 7 + i));
        if (p.expand(pz.solution).length <= pz.slots) throw new Error(lv + ' ' + p.expand(pz.solution).join(''));
      }
    });
    var pz5 = p.make(5, seeded(3));
    C.assertEq(pz5.solution.some(function (it) { return it.body && it.body.length === 2; }), true);   // かいだん
  });
  C.test('program: progressFromLogs', function () {
    var p = P();
    C.assertEq(p.progressFromLogs([]).level, 1);
    var logs = []; for (var i = 0; i < 5; i++) logs.push({ area: 'program', level: 3, correct: true });
    C.assertEq(p.progressFromLogs(logs).level >= 3, true);
  });
  C.test('program: 文（漢字は2年まで）', function () {
    var T = P().TEXT;
    ['choose', 'start', 'star', 'loop', 'goal', 'crash', 'short', 'stars', 'full', 'reward'].forEach(function (key) { if (!T[key]) throw new Error(key); });
    C.assertEq(T.choose, 'どれに する？');
  });
})();

/* プログラミングの画面（program-screen.js）。#app が無いので描画はせず、状態だけを動かす */
(function () {
  'use strict';
  var C = window.Chiid;
  var S = function () { return C.benkyo.programScreen; };
  var PID = 'p-program';
  function withLogs(logs, fn) {
    var St = C.storage, og = St.getLogs, ol = St.logAnswer, saved = [];
    St.getLogs = function () { return Promise.resolve(logs); };
    St.logAnswer = function (e) { saved.push(e); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { St.getLogs = og; St.logAnswer = ol; return v; }, function (e) { St.getLogs = og; St.logAnswer = ol; throw e; });
  }
  function typeProg(prog) {   // 画面の ボタンで 命令を ならべる
    prog.forEach(function (it) {
      if (typeof it === 'string') { S()._press(it); return; }
      S()._press('loop');
      it.body.forEach(function (d) { S()._press(d); });
      S()._press('loop');
      for (var n = 2; n < it.rep; n++) S()._cycle(S()._state().program.length - 1);
    });
  }
  function solveNow() { typeProg(S()._state().puzzle.solution); S()._run(); S()._flush(); }

  C.test('programScreen: show は 記録の レベル、level を わたすと そのレベル', function () {
    return withLogs([], function () {
      return S().show({ profileId: PID }).then(function () {
        C.assertEq(S()._state().phase, 'play'); C.assertEq(S()._state().level, 1);
        return S().show({ profileId: PID, level: 4 });
      }).then(function () { C.assertEq(S()._state().level, 4); C.assertEq(S()._state().puzzle.slots, 5); });
    });
  });
  C.test('programScreen: 矢印を ならべて うごかすと 正解、記録1件（はじめて なら true）', function () {
    return withLogs([], function (saved) {
      return S().show({ profileId: PID, level: 1 }).then(function () {
        solveNow();
        C.assertEq(saved.length, 1);
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct]), JSON.stringify(['program', 'lv1', true]));
        C.assertEq(S()._state().solved, 1);
      });
    });
  });
  C.test('programScreen: ぶつかったら スタートに もどり、命令は のこる。2回 失敗すると false', function () {
    return withLogs([], function (saved) {
      return S().show({ profileId: PID, level: 1 }).then(function () {
        var pz = S()._state().puzzle;
        // はたを 通らずに 地図の外へ 出る 向きを さがして、はみ出すまで ならべる
        var D = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }, s0 = pz.start.split(',').map(Number);
        var dir = Object.keys(D).filter(function (d) {
          for (var x = s0[0] + D[d][0], y = s0[1] + D[d][1]; x >= 0 && y >= 0 && x < pz.w && y < pz.h; x += D[d][0], y += D[d][1]) if (x + ',' + y === pz.goal) return false;
          return true;
        })[0];
        for (var i = 0; i < Math.min(pz.w, pz.h) + 1 && S()._state().program.length < pz.slots; i++) S()._press(dir);
        S()._run(); S()._flush();
        C.assertEq(S()._state().fails, 1); C.assertEq(S()._state().program.length > 0, true);
        S()._run(); S()._flush();
        C.assertEq(S()._state().fails, 2);
        S()._press('clear');
        C.assertEq(S()._state().program.length, 0);
        solveNow();
        C.assertEq(saved[0].correct, false);
      });
    });
  });
  C.test('programScreen: ならべる場所が いっぱいなら それ以上 入らない、けすで 1つ もどる', function () {
    return withLogs([], function () {
      return S().show({ profileId: PID, level: 4 }).then(function () {
        for (var i = 0; i < 8; i++) S()._press('r');
        C.assertEq(S()._state().program.length, 5);
        S()._press('back');
        C.assertEq(S()._state().program.length, 4);
      });
    });
  });
  C.test('programScreen: くりかえし（かっこ・回数）で まとめて 正解（レベル4・5）', function () {
    return withLogs([], function (saved) {
      return S().show({ profileId: PID, level: 5 }).then(function () {
        solveNow();
        C.assertEq(saved.length, 1); C.assertEq(saved[0].correct, true);
      });
    });
  });
  C.test('programScreen: レベル1〜3では くりかえしは 使えない', function () {
    return withLogs([], function () {
      return S().show({ profileId: PID, level: 2 }).then(function () {
        S()._press('loop'); S()._press('r');
        C.assertEq(JSON.stringify(S()._state().program), JSON.stringify(['r']));
      });
    });
  });
  C.test('programScreen: 3問で ごほうび', function () {
    return withLogs([], function (saved) {
      return S().show({ profileId: PID, level: 1 }).then(function () {
        for (var i = 0; i < 3; i++) { solveNow(); S()._flush(); }
        C.assertEq(S()._state().phase, 'reward'); C.assertEq(saved.length, 3);
      });
    });
  });
  C.test('program: 親画面と 教科の一覧に「プログラミング」がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/program: 'プログラミング'/.test(t), true);
      return fetch('../app-benkyo/main.js');
    }).then(function (r) { return r.text(); }).then(function (t) { C.assertEq(/id: 'program'/.test(t), true); });
  });
})();
