(function () {
  'use strict';
  var C = window.Chiid;
  var K = C.kuku;
  function find(id) { return K.ITEMS.filter(function (i) { return i.id === id; })[0]; }
  function seq(vals) { var n = 0; return function () { var v = vals[n % vals.length]; n++; return v; }; }

  C.test('kuku: 定数', function () {
    C.assertEq(K.AREA, 'kuku'); C.assertEq(K.MAX_LEVEL, 8);
    C.assertEq(K.ROUND_SIZE, 10); C.assertEq(K.STAR_EVERY, 5);
  });
  C.test('kuku: ITEMS は81件で a*b===ans', function () {
    C.assertEq(K.ITEMS.length, 81);
    C.assertEq(find('3×4').ans, 12);
    C.assertEq(K.ITEMS.every(function (i) { return i.a * i.b === i.ans && i.id === i.a + '×' + i.b; }), true);
  });
  C.test('kuku: poolIds のレベルと段', function () {
    var p1 = K.poolIds(1, null);
    C.assertEq(p1.length, 18);
    C.assertEq(p1.every(function (id) { return find(id).a <= 2; }), true);
    C.assertEq(K.poolIds(8, null).length, 81);
    C.assertEq(K.poolIds(9, null).length, 81);
    var p7 = K.poolIds(1, 7);
    C.assertEq(p7.length, 9);
    C.assertEq(p7.every(function (id) { return find(id).a === 7; }), true);
  });
  C.test('kuku: pickItem は直前と同じ式を出さない', function () {
    for (var k = 0; k < 40; k++) {
      var it = K.pickItem({ level: 1, onlyDan: null, missCounts: {}, lastId: '1×1' }, Math.random);
      C.assertEq(it.id !== '1×1', true);
    }
  });
  C.test('kuku: pickItem onlyDan=9 は全て9の段（1の段・9の段でも尽きない）', function () {
    var last = null;
    for (var k = 0; k < 40; k++) {
      var it = K.pickItem({ level: 1, onlyDan: 9, missCounts: {}, lastId: last }, Math.random);
      C.assertEq(it.a, 9); C.assertEq(it.id !== last, true); last = it.id;
    }
    var it1 = K.pickItem({ level: 8, onlyDan: 1, missCounts: {}, lastId: '1×1' }, seq([0, 0.5, 0.99]));
    C.assertEq(it1.a, 1); C.assertEq(it1.id !== '1×1', true);
  });
  C.test('kuku: pickItem は苦手を重く出す', function () {
    var cnt = 0;
    for (var k = 0; k < 200; k++) {
      var it = K.pickItem({ level: 1, onlyDan: null, missCounts: { '2×3': 50 }, lastId: null }, Math.random);
      if (it.id === '2×3') cnt++;
    }
    C.assertEq(cnt > 60, true);
  });
  C.test('kuku: judge', function () {
    var i12 = find('3×4'), i9 = find('1×9');
    C.assertEq(K.judge(i12, '12'), 'correct');
    C.assertEq(K.judge(i12, '13'), 'wrong');
    C.assertEq(K.judge(i12, ''), 'empty');
    C.assertEq(K.judge(i12, '012'), 'wrong');
    C.assertEq(K.judge(i9, '09'), 'correct');
    C.assertEq(K.judge(i9, '9'), 'correct');
    C.assertEq(K.judge(i12, '1a'), 'wrong');
  });
  C.test('kuku: submit の流れ', function () {
    var it = find('3×4'), a = K.newAttempt();
    C.assertEq(K.submit(a, it, '').kind, 'empty'); C.assertEq(a.tries, 0);
    C.assertEq(K.submit(a, it, '5').kind, 'retry'); C.assertEq(a.tries, 1);
    C.assertEq(K.submit(a, it, '').kind, 'empty'); C.assertEq(a.tries, 1);
    C.assertEq(K.submit(a, it, '6').kind, 'reveal');
    var b = K.newAttempt();
    C.assertEq(K.submit(b, it, '12').kind, 'correct');
    var c = K.newAttempt();
    K.submit(c, it, '1');
    C.assertEq(K.submit(c, it, '12').kind, 'correct');
  });
  C.test('kuku: speakText', function () {
    C.assertEq(K.speakText(find('3×4')), 'さん かける よん は？');
    var names = ['いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
    for (var n = 1; n <= 9; n++) {
      C.assertEq(K.speakText(find(n + '×' + n)), names[n - 1] + ' かける ' + names[n - 1] + ' は？');
    }
  });
  function log(id, ok, lv, area) { return { area: area || 'kuku', itemId: id, correct: ok, level: lv }; }
  C.test('kuku: progressFromLogs 空', function () {
    C.assertEq(K.progressFromLogs([]), { level: 1, recent: [], missCounts: {} });
    C.assertEq(K.progressFromLogs(null), { level: 1, recent: [], missCounts: {} });
  });
  C.test('kuku: progressFromLogs 他の area を無視し、誤答を数える', function () {
    var r = K.progressFromLogs([
      log('2×3', false, 1), log('x', false, 1, 'hiragana'), log('2×3', false, 1), log('1×1', true, 1), log('4×4', false, 1)
    ]);
    C.assertEq(r.level, 1);
    C.assertEq(r.missCounts, { '2×3': 2, '4×4': 1 });
    C.assertEq(r.recent, [false, false, true, false]);
  });
  C.test('kuku: progressFromLogs 同じレベルが続いた分だけ・最大5', function () {
    var logs = [log('1×1', false, 1), log('1×2', false, 1)];
    for (var i = 0; i < 7; i++) logs.push(log('2×2', i % 2 === 0, 2));
    var r = K.progressFromLogs(logs);
    C.assertEq(r.level, 2);
    C.assertEq(r.recent, [true, false, true, false, true]);
  });
  C.test('kuku: progressFromLogs 最後の1問でレベルが変わる', function () {
    // レベル1で 正,正,正,正,正 → 4問以上正解で2へ、recent は空
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push(log('2×2', true, 1));
    var r = K.progressFromLogs(logs);
    C.assertEq(r.level, 2); C.assertEq(r.recent, []);
    // 上限8を超えない
    var logs8 = [];
    for (var j = 0; j < 5; j++) logs8.push(log('9×9', true, 8));
    C.assertEq(K.progressFromLogs(logs8).level, 8);
    // 下がる：誤答5回でレベル3→2
    var logsD = [];
    for (var k = 0; k < 5; k++) logsD.push(log('2×2', false, 3));
    var rd = K.progressFromLogs(logsD);
    C.assertEq(rd.level, 2); C.assertEq(rd.recent, []);
  });
  C.test('kuku: progressFromLogs 「○のだんだけ」の記録（dan 付き）はレベルに使わず、苦手には数える', function () {
    var logs = [log('2×2', true, 1), log('1×3', false, 1)];
    for (var i = 0; i < 6; i++) { var e = log('9×' + (i + 1), i !== 0, 1); e.dan = 9; logs.push(e); }
    var r = K.progressFromLogs(logs);
    C.assertEq(r.level, 1);                      // 段の練習で5問以上正解しても、じどうのレベルは上がらない
    C.assertEq(r.recent, [true, false]);         // じどうの記録だけ
    C.assertEq(r.missCounts, { '1×3': 1, '9×1': 1 });
    // dan 付きだけなら、最初の状態
    C.assertEq(K.progressFromLogs(logs.slice(2)).level, 1);
  });
  C.test("kuku: question(blank) は B が答え、judge できる", function () {
    var q = K.question(find("3×4"), "blank");
    C.assertEq(q.ans, 4); C.assertEq(q.prod, 12); C.assertEq(q.a, 3); C.assertEq(q.mode, "blank");
    C.assertEq(K.judge(q, "4"), "correct");
    C.assertEq(K.judge(q, "12"), "wrong");
    C.assertEq(K.judge(q, ""), "empty");
    var m = K.question(find("3×4"), "mul");
    C.assertEq(m.ans, 12); C.assertEq(m.mode, "mul");
    C.assertEq(K.question(find("3×4")).ans, 12);   // 省略は mul
  });
  C.test("kuku: areaOf と digitsOf と speakText（□モード）", function () {
    C.assertEq(K.areaOf("blank"), "kukuB"); C.assertEq(K.areaOf("mul"), "kuku"); C.assertEq(K.areaOf(), "kuku");
    C.assertEq(K.digitsOf("blank"), 1); C.assertEq(K.digitsOf("mul"), 2);
    C.assertEq(K.speakText(K.question(find("3×4"), "blank"), "blank"), "さん かける いくつで 12 になる？");
    C.assertEq(K.speakText(find("3×4")), "さん かける よん は？");
  });
  C.test("kuku: progressFromLogs は mode ごとの area だけを見る", function () {
    var lb = { area: "kukuB", itemId: "2×2", correct: false, level: 3 };
    var lm = { area: "kuku", itemId: "2×3", correct: true, level: 1 };
    C.assertEq(K.progressFromLogs([lb, lm], "blank").missCounts, { "2×2": 1 });
    C.assertEq(K.progressFromLogs([lb, lm]).missCounts, {});
    C.assertEq(K.progressFromLogs([lm], "blank").level, 1);
  });
})();
