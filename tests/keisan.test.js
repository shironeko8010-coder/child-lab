(function () {
  'use strict';
  var C = window.Chiid;
  var K = C.keisan;
  function seq(vals) { var n = 0; return function () { var v = vals[n % vals.length]; n++; return v; }; }
  function each(level, n, fn) { for (var k = 0; k < n; k++) fn(K.generate(level, Math.random)); }

  C.test('keisan: 定数', function () {
    C.assertEq(K.AREA, 'keisan'); C.assertEq(K.MAX_LEVEL, 8);
    C.assertEq(K.ROUND_SIZE, 10); C.assertEq(K.STAR_EVERY, 5); C.assertEq(K.MAX_DIGITS, 3);
  });
  C.test('keisan: make と parseId', function () {
    C.assertEq(K.make(23, '+', 45), { id: '23+45', a: 23, b: 45, op: '+', ans: 68 });
    C.assertEq(K.parseId('72-38'), { id: '72-38', a: 72, b: 38, op: '-', ans: 34 });
    C.assertEq(K.parseId('3×4'), null);
    C.assertEq(K.parseId(''), null);
    C.assertEq(K.parseId(null), null);
  });
  C.test('keisan: levelOf の見分け', function () {
    var cases = { '3+4': 1, '8-3': 2, '7+8': 3, '15-7': 4, '23+45': 5, '68-25': 5, '38+47': 6, '72-38': 7, '67+58': 8, '134-68': 8 };
    Object.keys(cases).forEach(function (id) { C.assertEq([id, K.levelOf(K.parseId(id))], [id, cases[id]]); });
    C.assertEq(K.levelOf(K.parseId('3-5')), null);     // マイナスになる
    C.assertEq(K.levelOf(K.parseId('23+4')), null);    // 2桁+1桁は出さない
    C.assertEq(K.levelOf(K.parseId('15-3')), null);    // くり下がりなしの十いくつ-1桁は出さない
  });
  C.test('keisan: generate はどのレベルでも、そのレベルの式だけ（各300回）', function () {
    for (var lv = 1; lv <= 8; lv++) {
      each(lv, 300, function (it) {
        if (K.levelOf(it) !== lv) throw new Error('レベル' + lv + ' なのに ' + it.id + '（' + K.levelOf(it) + '）');
        if (it.ans < 0 || String(it.ans).length > K.MAX_DIGITS) throw new Error('こたえの範囲外 ' + it.id);
      });
    }
  });
  C.test('keisan: generate は乱数のはし（0 と 0.999…）でも範囲内', function () {
    [0, 0.9999999].forEach(function (r) {
      for (var lv = 1; lv <= 8; lv++) {
        var it = K.generate(lv, function () { return r; });
        C.assertEq([lv, K.levelOf(it)], [lv, lv]);
      }
    });
    C.assertEq(K.levelOf(K.generate(0, Math.random)), 1);     // 範囲外のレベルは丸める
    C.assertEq(K.levelOf(K.generate(99, Math.random)), 8);
  });
  C.test('keisan: レベルごとの中身（くり上がり・くり下がり）', function () {
    each(1, 100, function (it) { C.assertEq(it.op === '+' && it.ans <= 9, true); });
    each(2, 100, function (it) { C.assertEq(it.op === '-' && it.a <= 9 && it.ans >= 0, true); });
    each(3, 100, function (it) { C.assertEq(it.op === '+' && it.ans >= 10 && it.ans <= 18, true); });
    each(4, 100, function (it) { C.assertEq(it.op === '-' && it.a >= 11 && it.a <= 18 && it.ans <= 9, true); });
    each(6, 100, function (it) { C.assertEq(it.op === '+' && (it.a % 10 + it.b % 10) >= 10 && it.ans <= 99, true); });
    each(7, 100, function (it) { C.assertEq(it.op === '-' && it.a % 10 < it.b % 10 && it.b >= 10 && it.ans >= 1, true); });
    each(8, 100, function (it) { C.assertEq(it.op === '+' ? it.ans >= 100 : (it.a >= 100 && it.ans <= 99), true); });
    var ops = {}; each(5, 200, function (it) { ops[it.op] = true; });
    C.assertEq(Object.keys(ops).sort(), ['+', '-']);
  });
  C.test('keisan: pickItem は直前と同じ式を出さない（決まった乱数でも）', function () {
    for (var k = 0; k < 60; k++) {
      var it = K.pickItem({ level: 1, missCounts: {}, lastId: '1+1' }, Math.random);
      C.assertEq(it.id !== '1+1', true);
    }
    var fixed = K.pickItem({ level: 1, missCounts: {}, lastId: '1+1' }, function () { return 0; });
    C.assertEq(fixed.id !== '1+1', true);
  });
  C.test('keisan: pickItem はそのレベルの苦手を出しなおす（ほかのレベルの苦手は出さない）', function () {
    var cnt = 0, other = 0;
    for (var k = 0; k < 300; k++) {
      var it = K.pickItem({ level: 3, missCounts: { '7+8': 5, '3+4': 9 }, lastId: null }, Math.random);
      if (it.id === '7+8') cnt++;
      if (it.id === '3+4') other++;
      C.assertEq(K.levelOf(it), 3);
    }
    C.assertEq(cnt > 60, true);
    C.assertEq(other, 0);
    // 苦手があっても直前のものは出しなおさない
    var r = K.pickItem({ level: 3, missCounts: { '7+8': 5 }, lastId: '7+8' }, seq([0, 0.3, 0.6]));
    C.assertEq(r.id !== '7+8', true);
  });
  C.test('keisan: judge', function () {
    var i = K.make(67, '+', 58);   // 125
    C.assertEq(K.judge(i, '125'), 'correct');
    C.assertEq(K.judge(i, '124'), 'wrong');
    C.assertEq(K.judge(i, ''), 'empty');
    C.assertEq(K.judge(i, '0125'), 'wrong');   // 4桁
    C.assertEq(K.judge(i, '12a'), 'wrong');
    var z = K.make(5, '-', 5);
    C.assertEq(K.judge(z, '0'), 'correct');
    C.assertEq(K.judge(K.make(3, '+', 4), '07'), 'correct');
  });
  C.test('keisan: submit の流れ', function () {
    var it = K.make(38, '+', 47), a = K.newAttempt();
    C.assertEq(K.submit(a, it, '').kind, 'empty'); C.assertEq(a.tries, 0);
    C.assertEq(K.submit(a, it, '75').kind, 'retry'); C.assertEq(a.tries, 1);
    C.assertEq(K.submit(a, it, '').kind, 'empty'); C.assertEq(a.tries, 1);
    C.assertEq(K.submit(a, it, '86').kind, 'reveal');
    C.assertEq(K.submit(K.newAttempt(), it, '85').kind, 'correct');
  });
  C.test('keisan: speakText', function () {
    C.assertEq(K.speakText(K.make(23, '+', 45)), '23 たす 45 は？');
    C.assertEq(K.speakText(K.make(72, '-', 38)), '72 ひく 38 は？');
  });
  function log(id, ok, lv, area) { return { area: area || 'keisan', itemId: id, correct: ok, level: lv }; }
  C.test('keisan: progressFromLogs 空と、ほかの area', function () {
    C.assertEq(K.progressFromLogs([]), { level: 1, recent: [], missCounts: {} });
    C.assertEq(K.progressFromLogs(null), { level: 1, recent: [], missCounts: {} });
    var r = K.progressFromLogs([log('3+4', false, 1), log('2×3', false, 5, 'kuku'), log('3+4', false, 1), log('1+1', true, 1)]);
    C.assertEq(r.level, 1);
    C.assertEq(r.missCounts, { '3+4': 2 });
    C.assertEq(r.recent, [false, false, true]);
  });
  C.test('keisan: progressFromLogs レベルの上下と上限', function () {
    var up = []; for (var i = 0; i < 5; i++) up.push(log('7+8', true, 3));
    C.assertEq(K.progressFromLogs(up), { level: 4, recent: [], missCounts: {} });
    var top = []; for (var j = 0; j < 5; j++) top.push(log('67+58', true, 8));
    C.assertEq(K.progressFromLogs(top).level, 8);
    var down = []; for (var k = 0; k < 5; k++) down.push(log('72-38', false, 7));
    var d = K.progressFromLogs(down);
    C.assertEq(d.level, 6); C.assertEq(d.recent, []); C.assertEq(d.missCounts, { '72-38': 5 });
  });
})();

/* けいさんの画面（keisan-screen.js）。#app が無いので描画はせず、状態だけを動かす */
(function () {
  'use strict';
  var C = window.Chiid;
  var S = function () { return C.benkyo.keisanScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); }
  function typeNum(n) { String(n).split('').forEach(function (d) { S()._press(d); }); }
  function answer(ok) {
    S()._flush();                     // 前の式の「せいかい」表示中なら、先に次の式へ
    var s = S()._state();
    typeNum(ok ? s.ans : s.ans + 1);
    S()._press('ok');
  }
  function logsOf(pid) {
    return C.storage.getLogs(pid).then(function (l) { return l.filter(function (e) { return e.area === 'keisan'; }); });
  }
  function open(seed) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('たろう', 'benkyo');
      C.storage.setActive(pid);
      (seed || []).forEach(function (e) { C.storage.logAnswer({ profileId: pid, area: 'keisan', itemId: e.itemId, correct: e.correct, level: e.level }); });
      return S().show({ profileId: pid }).then(function () { return pid; });
    });
  }
  function kt(name, fn) {
    C.test('keisanScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  kt('最初はレベル1の式。正解で記録 true が1件', function () {
    return open().then(function (pid) {
      var s = S()._state();
      C.assertEq(s.phase, 'question');
      C.assertEq(s.level, 1);
      C.assertEq(C.keisan.levelOf(C.keisan.parseId(s.id)), 1);
      C.assertEq(s.expr, s.a + ' + ' + s.b + ' = ?');
      answer(true);
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.message, '正かい！'); C.assertEq(s.solved, 1);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, true); C.assertEq(logs[0].itemId, s.id); C.assertEq(logs[0].level, 1);
      });
    });
  });
  kt('1回目まちがい→はげまし、2回目まちがい→こたえを見せる（記録 false が1件）', function () {
    return open().then(function (pid) {
      var id = S()._state().id;
      answer(false);
      var s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.message, 'もう{一回|いっかい} やってみよう！'); C.assertEq(s.input, ''); C.assertEq(s.tries, 1);
      answer(false);
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.id, id);
      C.assertEq(s.message, '{答|こた}えは ' + s.ans + ' だよ。つぎは できるよ！');
      C.assertEq(s.input, String(s.ans));
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });
  kt('空の「こたえる」は数えない。入力は3桁まで、けすで1字もどる', function () {
    return open().then(function (pid) {
      S()._press('ok');
      C.assertEq(S()._state().tries, 0);
      typeNum('1234');
      C.assertEq(S()._state().input, '123');
      S()._press('del');
      C.assertEq(S()._state().input, '12');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 0); });
    });
  });
  kt('5問正解でレベル2（ひき算）へ。10問でごほうび、星2つ。もういっかいで0から', function () {
    return open().then(function () {
      for (var i = 0; i < 5; i++) answer(true);
      S()._flush();
      var s = S()._state();
      C.assertEq(s.level, 2); C.assertEq(s.op, '-'); C.assertEq(s.stars, 1);
      for (var j = 0; j < 5; j++) answer(true);
      S()._flush();
      s = S()._state();
      C.assertEq(s.phase, 'reward'); C.assertEq(s.solved, 10); C.assertEq(s.stars, 2);
      S()._again();
      s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.solved, 0); C.assertEq(s.stars, 0); C.assertEq(s.level, 3);
    });
  });
  kt('記録からレベルを組み立てて始める（レベル6で記録あり→レベル6）', function () {
    return open([{ itemId: '38+47', correct: true, level: 6 }, { itemId: '29+46', correct: false, level: 6 }]).then(function () {
      var s = S()._state();
      C.assertEq(s.level, 6);
      C.assertEq(C.keisan.levelOf(C.keisan.parseId(s.id)), 6);
    });
  });
  C.test('benkyo: SUBJECTS の keisan は有効で、たしざん・ひきざん', function () {
    var s = C.benkyo.SUBJECTS.filter(function (x) { return x.id === 'keisan'; })[0];
    C.assertEq(s.enabled, true); C.assertEq(s.sub, 'たし{算|ざん}・ひき{算|ざん}'); C.assertEq(s.name, '計算');
  });
})();
