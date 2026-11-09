/* 手書き（教科書体）の形で見せたい ひらがな。Chiid.glyphs
   スマホのゴシック体では、下や途中の線がつながって表示される字（き・さ・ふ・り）を、
   学校で書く形（線が離れた形）で、線のデータから描く。外部フォントは使わない。
   座標は 100×100 の箱。字の大きさは、フォントで描くとき（箱の 80%）と同じ 10〜90 に収める。
   なぞりのお手本・判定（trace.rasterizeGlyph）と、問題の大きな字・カードの言葉に使う。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var WIDTH = 9;   // 線の太さ（100 の箱に対して）。太字のフォントとほぼ同じ

  // 1画ずつの SVG パス
  var STROKES = {
    'き': [
      'M27 31 Q49 28 70 25',
      'M24 47 Q49 44 75 40',
      'M41 13 Q52 40 63 62',
      'M38 67 Q31 84 52 85 Q63 86 73 83'
    ],
    'さ': [
      'M25 38 Q50 35 75 31',
      'M44 15 Q54 42 63 58 Q59 63 52 66',
      'M35 74 Q41 86 69 85'
    ],
    'ふ': [
      'M43 17 Q53 21 56 30',
      'M49 37 Q62 51 56 64 Q50 74 38 72',
      'M27 59 Q22 69 15 78',
      'M70 60 Q80 68 86 79'
    ],
    'り': [
      'M33 22 Q27 45 33 64 Q35 69 41 57',
      'M63 18 Q75 48 64 70 Q56 84 39 89'
    ]
  };

  function has(ch) { return Object.prototype.hasOwnProperty.call(STROKES, ch); }
  function strokes(ch) { return has(ch) ? STROKES[ch].slice() : []; }

  // インラインの SVG（文字の代わりに置く。大きさは 1em、色は文字の色）
  function svg(ch) {
    if (!has(ch)) return '';
    return '<svg class="hira-glyph" viewBox="0 0 100 100" role="img" aria-label="' + ch + '">' +
      STROKES[ch].map(function (d) {
        return '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + WIDTH +
          '" stroke-linecap="round" stroke-linejoin="round"/>';
      }).join('') + '</svg>';
  }

  // キャンバスに描く（size は正方形の一辺）。描けたら true
  function draw(ctx, ch, size, style) {
    if (!has(ch) || !ctx || typeof window.Path2D !== 'function') return false;
    try {
      ctx.save();
      ctx.scale(size / 100, size / 100);
      ctx.strokeStyle = style || '#000';
      ctx.lineWidth = WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // 1本のパスにまとめて描く（半透明のとき、線の重なりが濃くならないように）
      ctx.stroke(new window.Path2D(STROKES[ch].join(' ')));
      ctx.restore();
      return true;
    } catch (e) {
      try { ctx.restore(); } catch (e2) {}
      return false;
    }
  }

  // 文字列を、手書きの形にしたい字だけ SVG にして要素へ入れる
  function fill(node, text) {
    String(text).split('').forEach(function (ch) {
      if (has(ch)) {
        var s = document.createElement('span');
        s.className = 'hira-g';
        s.innerHTML = svg(ch);
        node.appendChild(s);
      } else {
        node.appendChild(document.createTextNode(ch));
      }
    });
    return node;
  }

  C.glyphs = { WIDTH: WIDTH, has: has, strokes: strokes, svg: svg, draw: draw, fill: fill };
})();
