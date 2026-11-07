(function () {
  'use strict';
  var C = window.Chiid;
  function ones(n) { var a = new Uint8Array(n); a.fill(1); return a; }

  C.test('trace.score: 全部なぞる', function () {
    var r = C.trace.score(ones(16), ones(16));
    C.assertEq(r.coverage, 1); C.assertEq(r.overshoot, 0); C.assertEq(r.pass, true);
  });
  C.test('trace.score: 何もなぞらない', function () {
    var r = C.trace.score(ones(16), new Uint8Array(16));
    C.assertEq(r.pass, false); C.assertEq(r.coverage, 0); C.assertEq(r.overshoot, 0);
  });
  C.test('trace.score: 目標の外だけなぞる', function () {
    var t = new Uint8Array(16), u = new Uint8Array(16);
    for (var i = 0; i < 8; i++) t[i] = 1;
    for (var j = 8; j < 16; j++) u[j] = 1;
    var r = C.trace.score(t, u);
    C.assertEq(r.overshoot, 1); C.assertEq(r.pass, false); C.assertEq(r.coverage, 0);
  });
  C.test('trace.score: 半分だけなぞる', function () {
    var u = new Uint8Array(16);
    for (var i = 0; i < 8; i++) u[i] = 1;
    var r = C.trace.score(ones(16), u);
    C.assertEq(r.coverage, 0.5); C.assertEq(r.overshoot, 0); C.assertEq(r.pass, false);
  });
  C.test('trace.score: 目標が空でも例外なし', function () {
    var r = C.trace.score(new Uint8Array(4), new Uint8Array(4));
    C.assertEq(r.pass, false);
  });
  var BASE46 = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
  var EXCEPT = { 'を': true, 'ん': true }; // この字で始まる言葉がない
  C.test('hira.ITEMS: 基本46字が順に並ぶ', function () {
    C.assertEq(C.hira.ITEMS.length, 46);
    C.assertEq(C.hira.ITEMS.map(function (it) { return it.ch; }).join(''), BASE46);
  });
  C.test('hira.ITEMS: 行ごとの字数', function () {
    var cnt = {};
    C.hira.ITEMS.forEach(function (it) { cnt[it.row] = (cnt[it.row] || 0) + 1; });
    C.assertEq(cnt, { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 3, 9: 5, 10: 3 });
  });
  C.test('hira.ITEMS: ch の重複なし・pic あり', function () {
    var seen = {};
    C.hira.ITEMS.forEach(function (it) {
      if (seen[it.ch]) throw new Error('重複: ' + it.ch);
      seen[it.ch] = true;
      if (!it.pic) throw new Error('絵がない: ' + it.ch);
    });
  });
  C.test('hira.levelConfig: レベルごとの範囲と択数', function () {
    var l1 = C.hira.levelConfig(1), l2 = C.hira.levelConfig(2), l3 = C.hira.levelConfig(3);
    C.assertEq(l1.pool, BASE46.slice(0, 10).split(''));
    C.assertEq(l1.choices, 3);
    C.assertEq(C.hira.levelConfig(0).pool.length, 10);
    C.assertEq(l2.pool, BASE46.slice(0, 25).split(''));
    C.assertEq(l2.choices, 3);
    C.assertEq(l3.pool.length, 46);
    C.assertEq(l3.choices, 4);
    C.assertEq(C.hira.levelConfig(5).pool.length, 46);
  });
  C.test('hira.ITEMS: word の先頭が ch（を・ん は例外）', function () {
    C.hira.ITEMS.forEach(function (it) {
      if (EXCEPT[it.ch]) {
        if (it.word.indexOf(it.ch) < 1) throw new Error('例外の字が言葉の途中・最後にない: ' + it.ch + ' ' + it.word);
      } else if (it.word.charAt(0) !== it.ch) {
        throw new Error('先頭が違う: ' + it.ch + ' ' + it.word);
      }
    });
  });
  C.test('hira.ITEMS: 既存10字の言葉は そのまま', function () {
    var old = ['あり', 'いぬ', 'うさぎ', 'えび', 'おに', 'かに', 'きりん', 'くま', 'けーき', 'こあら'];
    C.assertEq(C.hira.ITEMS.slice(0, 10).map(function (it) { return it.word; }), old);
  });
  C.test('trace.rasterizeGlyph: 46字すべてマスクが空でない', function () {
    var bad = [];
    C.hira.ITEMS.forEach(function (it) {
      var m = C.trace.rasterizeGlyph(it.ch, 160);
      var n = 0; for (var i = 0; i < m.length; i++) n += m[i];
      if (n < 300) bad.push(it.ch + ':' + n);
    });
    if (bad.length) throw new Error('マスクが小さすぎる: ' + bad.join(', '));
  });
  C.test('hira.ITEMS: word はひらがなのみ', function () {
    C.hira.ITEMS.forEach(function (it) {
      if (!/^[\u3041-\u3096\u30fc]+$/.test(it.word)) throw new Error('ひらがな以外: ' + it.word);
    });
  });
  C.test('trace.rasterizeGlyph: あ が描ける', function () {
    var m = C.trace.rasterizeGlyph('あ', 200);
    C.assertEq(m.length, 200 * 200);
    var n = 0; for (var i = 0; i < m.length; i++) n += m[i];
    if (n < 500 || n > 20000) throw new Error('画素数が不自然: ' + n);
  });
})();
