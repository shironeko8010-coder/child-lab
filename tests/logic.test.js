/* ロジックぬりえ（べんきょう）のテスト。設計書：docs/superpowers/specs/2026-11-20-benkyo-logic-design.md */
(function () {
  'use strict';
  var C = window.Chiid;
  function G() { return C.logic; }

  C.test('logic: 定数（5レベル、5×5・5×5・7×7・8×8・10×10、レベル1・2は すぐ知らせる）', function () {
    var g = G();
    C.assertEq(g.AREA, 'logic'); C.assertEq(g.MAX_LEVEL, 5);
    C.assertEq(JSON.stringify([1, 2, 3, 4, 5].map(function (l) { return g.LEVELS[l].size; })), JSON.stringify([5, 5, 7, 8, 10]));
    C.assertEq(JSON.stringify([1, 2, 3, 4, 5].map(function (l) { return !!g.LEVELS[l].instant; })), JSON.stringify([true, true, false, false, false]));
  });
  C.test('logic: clues は つづけて ぬる 数を 数える（なにも ない 列は 空の 配列）', function () {
    var c = G().clues(['.#.#.', '#####', '.....', '##.#.', '#...#']);
    C.assertEq(JSON.stringify(c.rows), JSON.stringify([[1, 1], [5], [], [2, 1], [1, 1]]));
    C.assertEq(JSON.stringify(c.cols), JSON.stringify([[1, 2], [2, 1], [1], [2, 1], [1, 1]]));
  });
  C.test('logic: lineOk は その列の ぬりかたが 数字と 合うか', function () {
    var g = G();
    C.assertEq(g.lineOk([2, 1], [1, 1, 0, 1, 0]), true);
    C.assertEq(g.lineOk([2, 1], [1, 1, 1, 0, 0]), false);
    C.assertEq(g.lineOk([], [0, 2, 0]), true);
  });
  C.test('logic: solve は 答えが 1つに 決まらないと null', function () {
    C.assertEq(G().solve([[1], [1]], [[1], [1]]), null);
    C.assertEq(JSON.stringify(G().solve([[2], [1]], [[2], [1]])), JSON.stringify([1, 1, 1, 0]));
  });
  C.test('logic: 絵は 各レベル 10まい、大きさが 合い、当てずっぽう なしで 1つに とける', function () {
    var g = G(), bad = [];
    [1, 2, 3, 4, 5].forEach(function (lv) {
      var list = g.PICS[lv], N = g.LEVELS[lv].size, names = {};
      if (list.length < 10) bad.push(lv + ' count ' + list.length);
      list.forEach(function (p) {
        if (!p.name || !p.color || names[p.name]) bad.push(lv + ' name ' + p.name);
        names[p.name] = 1;
        if (p.rows.length !== N || p.rows.some(function (r) { return r.length !== N; })) { bad.push(lv + ' size ' + p.name); return; }
        var c = g.clues(p.rows), s = g.solve(c.rows, c.cols);
        var want = p.rows.join('').split('').map(function (ch) { return ch === '#' ? 1 : 0; });
        if (!s || s.join('') !== want.join('')) bad.push(lv + ' solve ' + p.name);
      });
    });
    if (bad.length) throw new Error(bad.slice(0, 5).join(' / '));
  });
  C.test('logic: make は レベルの 絵を 出し、前と 同じ 絵は 出さない', function () {
    var g = G(), last = null;
    for (var i = 0; i < 20; i++) {
      var p = g.make(3, Math.random, last);
      C.assertEq(p.size, 7);
      if (p.id === last) throw new Error('same ' + p.id);
      last = p.id;
    }
  });
  C.test('logic: 文', function () {
    var T = G().TEXT;
    ['choose', 'rule', 'start', 'wrongFill', 'wrongCross', 'check', 'more', 'hint', 'clear', 'reveal', 'reward'].forEach(function (k) { if (!T[k]) throw new Error(k); });
  });
})();

/* ロジックぬりえの画面（logic-screen.js）。#app が無いので描画はせず、状態だけを動かす */
(function () {
  'use strict';
  var C = window.Chiid;
  var V = function () { return C.benkyo.logicScreen; };
  var PID = 'p-logic';
  function withLogs(logs, fn) {
    var St = C.storage, og = St.getLogs, ol = St.logAnswer, saved = [];
    St.getLogs = function () { return Promise.resolve(logs); };
    St.logAnswer = function (e) { saved.push(e); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { St.getLogs = og; St.logAnswer = ol; return v; }, function (e) { St.getLogs = og; St.logAnswer = ol; throw e; });
  }
  function fills() { return V()._state().solution.map(function (v, i) { return v ? i : -1; }).filter(function (i) { return i >= 0; }); }
  function empties() { return V()._state().solution.map(function (v, i) { return v ? -1 : i; }).filter(function (i) { return i >= 0; }); }
  function fillAll() { V()._mode('fill'); fills().forEach(function (i) { if (V()._state().grid[i] !== 1) V()._tap(i); }); }

  C.test('logicScreen: show は 記録の レベル、level で そのレベル', function () {
    return withLogs([], function () {
      return V().show({ profileId: PID }).then(function () {
        C.assertEq(V()._state().phase, 'play'); C.assertEq(V()._state().level, 1); C.assertEq(V()._state().size, 5);
        return V().show({ profileId: PID, level: 5 });
      }).then(function () { C.assertEq(V()._state().size, 10); });
    });
  });
  C.test('logicScreen: レベル1は ぬらない マスを ぬると すぐ 赤く、ぜんぶ ぬると 正解・記録・ごほうび', function () {
    return withLogs([], function (saved) {
      return V().show({ profileId: PID, level: 1 }).then(function () {
        var e = empties()[0];
        V()._mode('fill'); V()._tap(e);
        C.assertEq(V()._state().bad.indexOf(e) >= 0, true); C.assertEq(V()._state().mistakes, 1);
        C.assertEq(V()._state().msg, C.logic.TEXT.wrongFill);
        V()._tap(e);   // もう一度 さわると 消える
        C.assertEq(V()._state().grid[e], 0); C.assertEq(V()._state().bad.length, 0);
        fillAll();
        C.assertEq(V()._state().phase, 'clear');
        C.assertEq(saved.length, 1); C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct]), JSON.stringify(['logic', 'lv1', true]));
        C.assertEq(V()._state().msg.indexOf(V()._state().name) >= 0, true);
        V()._flush();
        C.assertEq(V()._state().phase, 'reward');
      });
    });
  });
  C.test('logicScreen: レベル1で ぬる マスに × を つけると すぐ 知らせる。けすで 消える', function () {
    return withLogs([], function () {
      return V().show({ profileId: PID, level: 1 }).then(function () {
        var f = fills()[0];
        V()._mode('cross'); V()._tap(f);
        C.assertEq(V()._state().grid[f], 2); C.assertEq(V()._state().msg, C.logic.TEXT.wrongCross); C.assertEq(V()._state().mistakes, 1);
        V()._mode('erase'); V()._tap(f);
        C.assertEq(V()._state().grid[f], 0); C.assertEq(V()._state().bad.length, 0);
      });
    });
  });
  C.test('logicScreen: レベル3は すぐには 知らせず、こたえあわせで ちがう マスを 赤く。たりない だけなら まちがいに しない', function () {
    return withLogs([], function (saved) {
      return V().show({ profileId: PID, level: 3 }).then(function () {
        var f = fills(), e = empties()[0];
        V()._mode('fill');
        f.slice(1).forEach(function (i) { V()._tap(i); });
        V()._check();
        C.assertEq(V()._state().msg, C.logic.TEXT.more); C.assertEq(V()._state().mistakes, 0); C.assertEq(V()._state().phase, 'play');
        V()._tap(f[0]); V()._tap(e);
        C.assertEq(V()._state().bad.length, 0);
        V()._check();
        C.assertEq(JSON.stringify(V()._state().bad), JSON.stringify([e])); C.assertEq(V()._state().mistakes, 1); C.assertEq(saved.length, 0);
        V()._tap(e); V()._check();
        C.assertEq(V()._state().phase, 'clear'); C.assertEq(saved[0].correct, true);
      });
    });
  });
  C.test('logicScreen: ヒントは まちがいを なおすか、ぬる マスを 1つ ぬる。使うと 記録は false', function () {
    return withLogs([], function (saved) {
      return V().show({ profileId: PID, level: 1 }).then(function () {
        var e = empties()[0];
        V()._mode('fill'); V()._tap(e);
        V()._hint();
        C.assertEq(V()._state().grid[e] !== 1, true); C.assertEq(V()._state().hints, 1);
        var before = V()._state().grid.filter(function (v) { return v === 1; }).length;
        V()._hint();
        C.assertEq(V()._state().grid.filter(function (v) { return v === 1; }).length, before + 1);
        fillAll();
        C.assertEq(saved[0].correct, false);
      });
    });
  });
  C.test('logic: 親画面と 教科の一覧に「ロジックぬりえ」がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/logic: 'ロジックぬりえ'/.test(t), true);
      return fetch('../app-benkyo/main.js');
    }).then(function (r) { return r.text(); }).then(function (t) { C.assertEq(/id: 'logic'/.test(t), true); });
  });
})();
