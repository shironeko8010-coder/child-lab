/* なぞり判定と、文字のマスク化 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  function score(target, user) {
    var t = 0, u = 0, both = 0, n = Math.min(target.length, user.length);
    for (var i = 0; i < n; i++) {
      if (target[i]) t++;
      if (user[i]) {
        u++;
        if (target[i]) both++;
      }
    }
    var coverage = t ? both / t : 0;
    var overshoot = u ? (u - both) / u : 0;
    return { coverage: coverage, overshoot: overshoot, pass: t > 0 && coverage >= 0.6 && overshoot <= 0.4 };
  }

  function rasterizeGlyph(ch, size) {
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    var ctx = cv.getContext('2d');
    var out = new Uint8Array(size * size);
    if (!ctx) return out;
    // き・さ・ふ・り は、お手本と同じ手書きの形（glyphs.js）で判定する
    if (C.glyphs && C.glyphs.draw(ctx, ch, size, '#000')) return toMask(ctx, size, out);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(size * 0.8) + 'px sans-serif';
    ctx.fillText(ch, size / 2, size / 2);
    return toMask(ctx, size, out);
  }
  function toMask(ctx, size, out) {
    var d = ctx.getImageData(0, 0, size, size).data;
    for (var i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] > 128 ? 1 : 0;
    return out;
  }

  C.trace = { score: score, rasterizeGlyph: rasterizeGlyph };
})();
