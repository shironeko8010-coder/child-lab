(function () {
  'use strict';
  var C = window.Chiid;
  var O = C.okaimono;
  function log(itemId, correct, level) { return { area: 'okaimono', itemId: itemId, correct: correct, level: level }; }

  C.test('okaimono: 定数', function () {
    C.assertEq(O.AREA, 'okaimono'); C.assertEq(O.MAX_LEVEL, 3); C.assertEq(O.ROUND_SIZE, 5);
    C.assertEq(O.COINS, [1, 5, 10, 50, 100, 500]);
    C.assertEq(O.ITEMS.length, 16);
    O.ITEMS.forEach(function (it) { if (!it.pic || !/^[ぁ-ゖー]+$/.test(it.word) || !(it.min < it.max)) throw new Error(it.id); });
  });
  C.test('okaimono: coinsFor', function () {
    C.assertEq(O.coinsFor(1), [1, 10, 100]);
    C.assertEq(O.coinsFor(2), [1, 5, 10, 50, 100]);
    C.assertEq(O.coinsFor(3), [1, 5, 10, 50, 100, 500]);
  });
  C.test('okaimono: pricesFor はレベルの決まりと品物の幅を守る', function () {
    O.ITEMS.forEach(function (it) {
      O.pricesFor(it, 1).forEach(function (p) {
        if (p < 10 || p > 399 || /[5-9]/.test(String(p)) || p < it.min || p > it.max) throw new Error('lv1 ' + it.id + ' ' + p);
      });
      O.pricesFor(it, 2).forEach(function (p) { if (p < 10 || p > 499 || p < it.min || p > it.max) throw new Error('lv2 ' + it.id + ' ' + p); });
      O.pricesFor(it, 3).forEach(function (p) { if (p < 100 || p > 999 || p < it.min || p > it.max) throw new Error('lv3 ' + it.id + ' ' + p); });
    });
    var ame = O.ITEMS.filter(function (it) { return it.id === 'ame'; })[0];
    C.assertEq(O.pricesFor(ame, 1).indexOf(44) >= 0, true);
    C.assertEq(O.pricesFor(ame, 1).indexOf(45), -1);
  });
  C.test('okaimono: itemsFor はどのレベルでも1つ以上で、すいかはレベル3だけ', function () {
    [1, 2, 3].forEach(function (lv) { C.assertEq(O.itemsFor(lv).length > 0, true); });
    function has(lv) { return O.itemsFor(lv).some(function (it) { return it.id === 'suika'; }); }
    C.assertEq([has(1), has(2), has(3)], [false, false, true]);
  });
  C.test('okaimono: makeQuestion と pickItem（同じ品物を続けない）', function () {
    [1, 2, 3].forEach(function (lv) {
      var last = null;
      for (var k = 0; k < 60; k++) {
        var q = O.makeQuestion(lv, { missCounts: {}, lastId: last }, Math.random);
        if (q.item.id === last || q.level !== lv || O.pricesFor(q.item, lv).indexOf(q.price) < 0) throw new Error(lv + ' ' + q.item.id + ' ' + q.price);
        last = q.item.id;
      }
    });
  });
  C.test('okaimono: pickItem は苦手を重く出す', function () {
    var cnt = 0;
    for (var k = 0; k < 200; k++) if (O.pickItem({ level: 1, missCounts: { onigiri: 50 }, lastId: null }, Math.random).id === 'onigiri') cnt++;
    C.assertEq(cnt > 60, true);
  });
  C.test('okaimono: splitCoins', function () {
    C.assertEq(O.splitCoins(15, 2), [10, 5]);
    C.assertEq(O.splitCoins(15, 1), [10, 1, 1, 1, 1, 1]);
    C.assertEq(O.splitCoins(880, 3), [500, 100, 100, 100, 50, 10, 10, 10]);
    C.assertEq(O.splitCoins(0, 3), []);
  });
  C.test('okaimono: judge', function () {
    C.assertEq(O.judge(120, 120), 'just'); C.assertEq(O.judge(120, 110), 'short'); C.assertEq(O.judge(120, 130), 'over');
  });
  C.test('okaimono: speakText', function () {
    C.assertEq(O.speakText({ item: { word: 'おにぎり' }, price: 120 }), 'おにぎりは｜120えん。｜おかねを いれてね');
  });
  C.test('okaimono: progressFromLogs', function () {
    C.assertEq(O.progressFromLogs([]).level, 1);
    C.assertEq(O.progressFromLogs([{ area: 'kazu', itemId: '3', correct: false, level: 3 }]).level, 1);
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push(log('ame', true, 1));
    var r = O.progressFromLogs(logs);
    C.assertEq(r.level, 2); C.assertEq(r.recent, []);
    var d = [];
    for (var j = 0; j < 5; j++) d.push(log('cake', false, 3));
    var rd = O.progressFromLogs(d);
    C.assertEq(rd.level, 2); C.assertEq(rd.missCounts, { cake: 5 });
    var up = [];
    for (var k = 0; k < 5; k++) up.push(log('pan', true, 3));
    C.assertEq(O.progressFromLogs(up).level, 3);
  });
  C.test('okaimono: 親画面に「おかいもの」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/okaimono: 'おかいもの'/.test(t), true);
    });
  });
  C.test('okaimono: 知育のホームに「おかいもの」のボタンがある', function () {
    return fetch('../app-chiiku/game.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/playBtn\("おかいもの", function \(\) \{ C\.okaimono\.start\(p\.id\); \}\);/.test(t), true);
    });
  });
  C.test('okaimono: 読み上げる文は ひらがな・カタカナ・数字だけ', function () {
    Object.keys(O.TEXT).forEach(function (k) { if (!/^[ぁ-ゖァ-ヶー！。、 ]+$/.test(O.TEXT[k])) throw new Error(k); });
    C.assertEq(O.coinText(50), '50えん。');
  });
  C.test('okaimono: 画面に出す文は ひらがなだけ（読み上げの文とは別）', function () {
    Object.keys(O.TEXT).forEach(function (k) { if (!/^[ぁ-ゖー！。、 ]+$/.test(O.shownText(k))) throw new Error(k + ': ' + O.shownText(k)); });
    C.assertEq(O.shownText('hintOver'), 'とれーの おかねを たっぷすると もどせるよ');
    C.assertEq(O.shownText('short'), O.TEXT.short);
  });
  C.test('okaimono: judgeTray は トレーが空なら null（まちがいにしない）', function () {
    C.assertEq(O.judgeTray(120, []), null);
    C.assertEq(O.judgeTray(120, [100, 10, 10]), 'just');
    C.assertEq(O.judgeTray(120, [100]), 'short');
    C.assertEq(O.judgeTray(120, [100, 50]), 'over');
  });
})();
