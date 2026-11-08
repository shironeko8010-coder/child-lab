(function () {
  'use strict';
  var C = window.Chiid;
  var Z = C.kazu;
  function seq(vals) { var n = 0; return function () { var v = vals[n % vals.length]; n++; return v; }; }

  C.test('kazu: 定数とレベル設定', function () {
    C.assertEq(Z.AREA, 'kazu'); C.assertEq(Z.MAX_LEVEL, 3); C.assertEq(Z.ROUND_SIZE, 5);
    C.assertEq(Z.levelConfig(1), { max: 3, choices: 3 });
    C.assertEq(Z.levelConfig(2), { max: 5, choices: 3 });
    C.assertEq(Z.levelConfig(3), { max: 10, choices: 4 });
    C.assertEq(Z.levelConfig(0).max, 3);
  });
  C.test('kazu: PICS は絵と言葉を持ち、言葉はひらがなだけ', function () {
    C.assertEq(Z.PICS.length >= 5, true);
    Z.PICS.forEach(function (p) {
      if (!p.pic || !/^[ぁ-ゖー]+$/.test(p.word)) throw new Error('だめ: ' + p.word);
    });
  });
  C.test('kazu: pickNumber は範囲内で、直前と同じ数を出さない', function () {
    for (var lv = 1; lv <= 3; lv++) {
      var max = Z.levelConfig(lv).max, last = 1;
      for (var k = 0; k < 60; k++) {
        var n = Z.pickNumber({ level: lv, missCounts: {}, lastN: last }, Math.random);
        if (n < 1 || n > max || n === last) throw new Error('lv' + lv + ' n=' + n);
        last = n;
      }
    }
  });
  C.test('kazu: pickNumber は苦手を重く出す', function () {
    var cnt = 0;
    for (var k = 0; k < 200; k++) if (Z.pickNumber({ level: 3, missCounts: { '7': 50 }, lastN: null }, Math.random) === 7) cnt++;
    C.assertEq(cnt > 60, true);
  });
  C.test('kazu: makeChoices は答えを含み、重ならず、範囲内', function () {
    for (var lv = 1; lv <= 3; lv++) {
      var cfg = Z.levelConfig(lv);
      for (var n = 1; n <= cfg.max; n++) {
        var c = Z.makeChoices(n, lv, Math.random);
        C.assertEq(c.length, cfg.choices);
        C.assertEq(c.indexOf(n) >= 0, true);
        C.assertEq(c.filter(function (x, i) { return c.indexOf(x) === i; }).length, c.length);
        C.assertEq(c.every(function (x) { return x >= 1 && x <= cfg.max; }), true);
      }
    }
    C.assertEq(Z.makeChoices(2, 1, seq([0.1, 0.9, 0.5])).indexOf(2) >= 0, true);
  });
  function log(id, ok, lv) { return { area: 'kazu', itemId: id, correct: ok, level: lv }; }
  C.test('kazu: progressFromLogs', function () {
    C.assertEq(Z.progressFromLogs([]).level, 1);
    C.assertEq(Z.progressFromLogs([{ area: 'hiragana', itemId: 'あ', correct: false, level: 3 }]).level, 1);
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push(log('2', true, 1));
    var r = Z.progressFromLogs(logs);
    C.assertEq(r.level, 2); C.assertEq(r.recent, []);
    var d = [];
    for (var j = 0; j < 5; j++) d.push(log('9', false, 3));
    var rd = Z.progressFromLogs(d);
    C.assertEq(rd.level, 2); C.assertEq(rd.missCounts, { '9': 5 });
    var up = [];
    for (var k = 0; k < 5; k++) up.push(log('1', true, 3));
    C.assertEq(Z.progressFromLogs(up).level, 3);   // 上限3を超えない
  });
  C.test('kazu: 親画面に「かず」「くく（□をこたえる）」の名前がある', function () {
    var txt = '';
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      txt = t;
      C.assertEq(/kazu: 'かず'/.test(txt), true);
      C.assertEq(/kukuB: /.test(txt), true);
    });
  });
})();
