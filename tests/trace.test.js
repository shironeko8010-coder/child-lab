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
  C.test('hira.ITEMS と levelConfig', function () {
    C.assertEq(C.hira.ITEMS.length, 10);
    C.assertEq(C.hira.levelConfig(3).choices, 4);
    C.assertEq(C.hira.levelConfig(1).pool, ['あ', 'い', 'う', 'え', 'お']);
    C.assertEq(C.hira.levelConfig(1).choices, 3);
    C.assertEq(C.hira.levelConfig(2).pool.length, 10);
    C.assertEq(C.hira.levelConfig(2).choices, 3);
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
