(function () {
  'use strict';
  var C = window.Chiid;
  var G = C.glyphs;

  C.test('glyphs: き・さ・ふ・り は手書きの形を持ち、ほかの字は持たない', function () {
    ['き', 'さ', 'ふ', 'り'].forEach(function (ch) {
      C.assertEq(G.has(ch), true);
      C.assertEq(G.strokes(ch).length >= 2, true);
      C.assertEq(G.svg(ch).indexOf('<path') >= 0, true);
    });
    C.assertEq(G.has('あ'), false);
    C.assertEq(G.svg('あ'), '');
  });
  C.test('glyphs: 画数（き4・さ3・ふ4・り2）', function () {
    C.assertEq(G.strokes('き').length, 4);
    C.assertEq(G.strokes('さ').length, 3);
    C.assertEq(G.strokes('ふ').length, 4);
    C.assertEq(G.strokes('り').length, 2);
  });
  C.test('glyphs: fill は、き だけを SVG にして、ほかは文字のまま', function () {
    var n = G.fill(document.createElement('span'), 'きりん');
    C.assertEq(n.querySelectorAll('.hira-g').length, 2);
    C.assertEq(n.textContent, 'ん');
  });
  C.test('glyphs: 判定のマスクが、お手本の線から作られる（空でなく、箱の中に収まる）', function () {
    var S = 80;
    ['き', 'さ', 'ふ', 'り'].forEach(function (ch) {
      var m = C.trace.rasterizeGlyph(ch, S);
      var on = 0, minX = S, maxX = 0, minY = S, maxY = 0;
      for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) if (m[y * S + x]) {
        on++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      if (on < S * S * 0.04) throw new Error(ch + ' のマスクが少なすぎる: ' + on);
      if (minX < 2 || minY < 2 || maxX > S - 3 || maxY > S - 3) throw new Error(ch + ' が箱からはみ出す');
    });
  });
  C.test('glyphs: 自分のお手本をそのままなぞれば合格', function () {
    var S = 160;
    ['き', 'さ', 'ふ', 'り'].forEach(function (ch) {
      var t = C.trace.rasterizeGlyph(ch, S);
      C.assertEq(C.trace.score(t, t).pass, true);
    });
  });
})();
