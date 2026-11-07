/* 難易度調整と、苦手の重み付け出題。Chiid.adaptive.nextLevel / pickWeighted */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var WINDOW = 5;     // 直近何問を見るか
  var UP_AT = 4;      // この数以上正解で +1
  var DOWN_AT = 2;    // この数以下正解で -1

  // recent: 正解なら true の配列（古い順）。直近5問だけを見る。
  C.adaptive = C.adaptive || {};

  C.adaptive.nextLevel = function (recent, level, maxLevel) {
    var last = (recent || []).slice(-WINDOW);
    var next = level;
    if (last.length >= WINDOW) {
      var correct = 0;
      for (var i = 0; i < last.length; i++) {
        if (last[i]) correct++;
      }
      if (correct >= UP_AT) next = level + 1;
      else if (correct <= DOWN_AT) next = level - 1;
    }
    if (next < 1) next = 1;
    if (next > maxLevel) next = maxLevel;
    return next;
  };

  // 重み = 1 + 間違えた回数。rng は 0 以上 1 未満の乱数を返す関数。
  // ids が空のときは null を返す。
  C.adaptive.pickWeighted = function (ids, missCounts, rng) {
    if (!ids || ids.length === 0) return null;
    var weights = [];
    var total = 0;
    for (var i = 0; i < ids.length; i++) {
      var m = (missCounts && missCounts[ids[i]]) || 0;
      var w = 1 + m;
      weights.push(w);
      total += w;
    }
    var x = rng() * total;
    for (var j = 0; j < ids.length; j++) {
      if (x < weights[j]) return ids[j];
      x -= weights[j];
    }
    return ids[ids.length - 1]; // 浮動小数点の誤差など、念のための最後の要素
  };
})();
