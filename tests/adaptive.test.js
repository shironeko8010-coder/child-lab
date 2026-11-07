(function () {
  'use strict';
  var C = window.Chiid;

  C.test('adaptive.nextLevel: 直近5問で難易度を上げ下げする', function () {
    var A = C.adaptive;
    C.assertEq(A.nextLevel([true, true, true, true, false], 1, 3), 2);
    C.assertEq(A.nextLevel([false, false, true, false, false], 2, 3), 1);
    C.assertEq(A.nextLevel([false, false, false, false, false], 1, 3), 1);
    C.assertEq(A.nextLevel([true, true, true, true, true], 3, 3), 3);
    C.assertEq(A.nextLevel([true, true], 1, 3), 1);
  });

  C.test('adaptive.pickWeighted: 間違えた回数が多い id が出やすい', function () {
    var A = C.adaptive;
    C.assertEq(A.pickWeighted(['a', 'b'], { a: 0, b: 3 }, function () { return 0.5; }), 'b');
    // 重み a=1, b=1（missCounts なし）→ 合計2、0.0 は a、0.99 は b
    C.assertEq(A.pickWeighted(['a', 'b'], {}, function () { return 0; }), 'a');
    C.assertEq(A.pickWeighted(['a', 'b'], {}, function () { return 0.99; }), 'b');
  });
})();
