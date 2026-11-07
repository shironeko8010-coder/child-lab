(function () {
  'use strict';
  var C = window.Chiid;

  function L(itemId, correct, area) {
    return { profileId: 'x', area: area || 'hiragana', itemId: itemId, correct: correct, level: 1, ts: 1 };
  }

  C.test('parent: ひらがな4件(正解3) → rate 0.75', function () {
    var s = C.parent.summarize([L('あ', true), L('い', true), L('う', true), L('え', false)], []);
    C.assertEq(s.byArea.hiragana.rate, 0.75);
    C.assertEq(s.byArea.hiragana.total, 4);
    C.assertEq(s.byArea.hiragana.correct, 3);
  });

  C.test('parent: 同じ itemId を2回間違えると weak[0].misses===2', function () {
    var s = C.parent.summarize([L('か', false), L('あ', false), L('か', false), L('い', true)], []);
    C.assertEq(s.weak[0], { itemId: 'か', misses: 2 });
    C.assertEq(s.weak.length, 2);
  });

  C.test('parent: weak は最大5件、間違いの多い順', function () {
    var logs = [];
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(function (id, i) {
      for (var k = 0; k <= i; k++) logs.push(L(id, false));
    });
    var s = C.parent.summarize(logs, []);
    C.assertEq(s.weak.length, 5);
    C.assertEq(s.weak[0].itemId, 'g');
    C.assertEq(s.weak[0].misses, 7);
  });

  C.test('parent: ログ0件・日0件でも例外なし、playDays===0', function () {
    var s = C.parent.summarize([], []);
    C.assertEq(s.playDays, 0);
    C.assertEq(s.totalMin, 0);
    C.assertEq(s.byArea, {});
    C.assertEq(s.weak, []);
    C.assertEq(C.parent.summarize(undefined, undefined).playDays, 0);
  });

  C.test('parent: 遊んだ日と合計分（0秒の日は数えない）', function () {
    var s = C.parent.summarize([], [
      { date: '2026-11-01', sec: 600 }, { date: '2026-11-02', sec: 0 }, { date: '2026-11-03', sec: 90 }
    ]);
    C.assertEq(s.playDays, 2);
    C.assertEq(s.totalMin, 12); // 690秒 = 11.5分 → 四捨五入で12
  });
})();
