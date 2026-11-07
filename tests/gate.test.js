(function () {
  'use strict';
  var C = window.Chiid;

  C.test('gate: rng=0 で 6*6+11=47', function () {
    var p = C.gate.makeProblem(function () { return 0; });
    C.assertEq(p.answer, 47);
    C.assertEq(p.question, '6×6+11');
  });

  C.test('gate: rng=0.999 で 9*9+19=100（範囲の上限）', function () {
    var p = C.gate.makeProblem(function () { return 0.999; });
    C.assertEq(p.answer, 100);
  });

  C.test('gate: _check は正解だけ true', function () {
    var p = C.gate.makeProblem(function () { return 0; });
    C.assertEq(C.gate._check(p, '47'), true);
    C.assertEq(C.gate._check(p, '46'), false);
    C.assertEq(C.gate._check(p, ''), false);
  });

  C.test('gate: 3回連続の誤答でロックされ、ロック中は正解でも通らない', function () {
    C.gate._reset();
    var p = C.gate.makeProblem(function () { return 0; });
    C.assertEq(C.gate._isLocked(), false);
    C.gate._attempt(p, '1');
    C.gate._attempt(p, '2');
    C.assertEq(C.gate._isLocked(), false);
    C.gate._attempt(p, '3');
    C.assertEq(C.gate._isLocked(), true);
    C.assertEq(C.gate._attempt(p, '47'), false);
    C.gate._reset();
    C.assertEq(C.gate._isLocked(), false);
  });

  C.test('gate: 正解すると誤答カウントが戻る', function () {
    C.gate._reset();
    var p = C.gate.makeProblem(function () { return 0; });
    C.gate._attempt(p, '1');
    C.gate._attempt(p, '2');
    C.assertEq(C.gate._attempt(p, '47'), true);
    C.gate._attempt(p, '1');
    C.gate._attempt(p, '2');
    C.assertEq(C.gate._isLocked(), false);
    C.gate._reset();
  });

  C.test('gate: 連打しても onPass は1回だけ', function () {
    C.gate._reset();
    var n = 0;
    C.gate.open(function () { n++; });
    var p = C.gate._current();
    C.gate._submit(String(p.answer));
    C.gate._submit(String(p.answer));
    C.assertEq(n, 1);
    C.assertEq(document.getElementById('chiid-gate'), null);
    C.gate._reset();
  });

  // QAで見つけた不具合の再発防止：誤答のあと「ひらく」をもう一度押すと、空の入力で2回目の誤答に数えていた
  C.test('gate: 誤答で「ひらく」を連打しても、誤答は1回だけ数える', function () {
    C.gate._reset();
    C.gate.open(function () {});
    C.gate._submit('1');
    C.gate._submit('');
    C.gate._submit('2');
    C.gate._submit('');
    C.assertEq(C.gate._isLocked(), false);   // 誤答は2回だけ
    C.gate._submit('3');
    C.assertEq(C.gate._isLocked(), true);    // 3回目でロック
    C.gate._reset();
  });
})();
