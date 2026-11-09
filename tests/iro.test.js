(function () {
  'use strict';
  var C = window.Chiid;
  var I = C.iro;
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function noConfuse(cards) {
    var cs = uniq(cards.map(function (c) { return c.color; }));
    for (var i = 0; i < cs.length; i++) for (var j = i + 1; j < cs.length; j++) if (I.conflicts(cs[i], cs[j])) return false;
    return true;
  }

  C.test('iro: 定数とレベル設定', function () {
    C.assertEq(I.AREA, 'iro'); C.assertEq(I.MAX_LEVEL, 3); C.assertEq(I.ROUND_SIZE, 5);
    C.assertEq(I.levelConfig(1), { kinds: ['iro', 'katachi'], mix: false, choices: 3 });
    C.assertEq(I.levelConfig(2), { kinds: ['iro', 'katachi'], mix: true, choices: 3 });
    C.assertEq(I.levelConfig(3), { kinds: ['both'], mix: true, choices: 4 });
    C.assertEq(I.levelConfig(0).choices, 3);
  });
  C.test('iro: あか と みどり は まぎらわしい組み合わせ', function () {
    C.assertEq(I.conflicts('aka', 'midori'), true);
    C.assertEq(I.conflicts('midori', 'aka'), true);
    C.assertEq(I.conflicts('aka', 'ao'), false);
  });
  C.test('iro: id の変換と 問題文（ひらがなだけ）', function () {
    C.assertEq(I.parseId('aka'), { kind: 'iro', color: 'aka' });
    C.assertEq(I.parseId('maru'), { kind: 'katachi', shape: 'maru' });
    C.assertEq(I.parseId('ao-hoshi'), { kind: 'both', color: 'ao', shape: 'hoshi' });
    C.assertEq(I.itemId({ kind: 'both', color: 'ao', shape: 'hoshi' }), 'ao-hoshi');
    C.assertEq(I.question({ kind: 'iro', color: 'kiiro' }), 'きいろ は どれ？');
    C.assertEq(I.question({ kind: 'katachi', shape: 'sankaku' }), 'さんかく は どれ？');
    C.assertEq(I.question({ kind: 'both', color: 'aka', shape: 'maru' }), 'あかい まる は どれ？');
    C.assertEq(I.question({ kind: 'both', color: 'midori', shape: 'hoshi' }), 'みどりの ほし は どれ？');
    for (var lv = 1; lv <= 3; lv++) {
      I.allIds(lv).forEach(function (id) {
        var it = I.parseId(id);
        C.assertEq(I.itemId(it), id);
        if (!/^[ぁ-ゖ ？]+$/.test(I.question(it))) throw new Error('question ' + id);
      });
    }
  });
  C.test('iro: allIds はレベルの問題をすべて返す', function () {
    C.assertEq(I.allIds(1), ['aka', 'ao', 'kiiro', 'midori', 'maru', 'sankaku', 'shikaku', 'hoshi']);
    C.assertEq(I.allIds(2).length, 8);
    C.assertEq(I.allIds(3).length, 16);
    C.assertEq(I.allIds(3).every(function (id) { return id.indexOf('-') > 0; }), true);
  });
  C.test('iro: pickItem は範囲内で、直前と同じ問題を出さず、苦手を重く出す', function () {
    for (var lv = 1; lv <= 3; lv++) {
      var all = I.allIds(lv), last = all[0];
      for (var k = 0; k < 80; k++) {
        var id = I.itemId(I.pickItem({ level: lv, missCounts: {}, lastId: last }, Math.random));
        if (all.indexOf(id) < 0 || id === last) throw new Error('lv' + lv + ' ' + id);
        last = id;
      }
    }
    var weak = 0, kinds = {};
    for (var r = 0; r < 200; r++) {
      var it = I.pickItem({ level: 1, missCounts: { hoshi: 50 }, lastId: null }, Math.random);
      if (I.itemId(it) === 'hoshi') weak++;
      kinds[I.pickItem({ level: 1, missCounts: {}, lastId: null }, Math.random).kind] = true;
    }
    C.assertEq(weak > 60, true);
    C.assertEq(!!(kinds.iro && kinds.katachi), true);   // いろ と かたち の両方が出る
  });
  C.test('iro: makeChoices は答えが1つだけ、重ならず、あか と みどり を混ぜない', function () {
    for (var lv = 1; lv <= 3; lv++) {
      var n = I.levelConfig(lv).choices;
      I.allIds(lv).forEach(function (id) {
        var it = I.parseId(id);
        for (var r = 0; r < 10; r++) {
          var c = I.makeChoices(it, lv, Math.random);
          C.assertEq(c.length, n);
          C.assertEq(c.filter(function (cd) { return I.isAnswer(it, cd); }).length, 1);
          C.assertEq(uniq(c.map(function (cd) { return cd.id; })).length, n);
          if (!noConfuse(c)) throw new Error('まぎらわしい色 lv' + lv + ' ' + id);
        }
      });
    }
  });
  C.test('iro: レベル1は ほかの要素を そろえる', function () {
    for (var r = 0; r < 20; r++) {
      var a = I.makeChoices({ kind: 'iro', color: 'ao' }, 1, Math.random);
      C.assertEq(uniq(a.map(function (cd) { return cd.shape; })).length, 1);
      var b = I.makeChoices({ kind: 'katachi', shape: 'maru' }, 1, Math.random);
      C.assertEq(uniq(b.map(function (cd) { return cd.color; })).length, 1);
    }
  });
  C.test('iro: レベル3は 同じ色の ちがう形 と 同じ形の ちがう色 を混ぜる', function () {
    for (var r = 0; r < 20; r++) {
      var it = { kind: 'both', color: 'aka', shape: 'maru' };
      var c = I.makeChoices(it, 3, Math.random);
      C.assertEq(c.some(function (cd) { return cd.color === 'aka' && cd.shape !== 'maru'; }), true);
      C.assertEq(c.some(function (cd) { return cd.color !== 'aka' && cd.shape === 'maru'; }), true);
    }
  });
  function log(id, ok, lv) { return { area: 'iro', itemId: id, correct: ok, level: lv }; }
  C.test('iro: progressFromLogs', function () {
    C.assertEq(I.progressFromLogs([]).level, 1);
    C.assertEq(I.progressFromLogs([{ area: 'tokei', itemId: '3:00', correct: true, level: 3 }]).level, 1);
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push(log('aka', true, 1));
    var r = I.progressFromLogs(logs);
    C.assertEq(r.level, 2); C.assertEq(r.recent, []);
    var d = [];
    for (var j = 0; j < 5; j++) d.push(log('ao-hoshi', false, 3));
    var rd = I.progressFromLogs(d);
    C.assertEq(rd.level, 2); C.assertEq(rd.missCounts, { 'ao-hoshi': 5 });
    var up = [];
    for (var k = 0; k < 5; k++) up.push(log('aka-maru', true, 3));
    C.assertEq(I.progressFromLogs(up).level, 3);   // 上限3を超えない
  });
  C.test('iro: shapeSvg は 4つの形と色を描き、文字を入れない', function () {
    I.COLORS.forEach(function (col) {
      I.SHAPES.forEach(function (sh) {
        var s = I.shapeSvg({ color: col.id, shape: sh.id });
        C.assertEq(s.indexOf('fill="' + col.hex + '"') > 0, true);
        C.assertEq(/<text/.test(s), false);
      });
    });
    C.assertEq(/<circle/.test(I.shapeSvg({ color: 'aka', shape: 'maru' })), true);
    C.assertEq(/<rect/.test(I.shapeSvg({ color: 'aka', shape: 'shikaku' })), true);
  });
  C.test('iro: 親画面に「いろ・かたち」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/iro: 'いろ・かたち'/.test(t), true);
    });
  });
})();
