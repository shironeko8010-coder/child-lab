/* かげあわせ（知育）のテスト。設計書：docs/superpowers/specs/2026-11-19-chiiku-kage-design.md */
(function () {
  'use strict';
  var C = window.Chiid;
  function K() { return C.kage; }
  var PID = 'p-kage';
  function seeded(n) { var s = n; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function withLogs(logs, fn) {
    var S = C.storage, og = S.getLogs, ol = S.logAnswer, saved = [];
    S.getLogs = function () { return Promise.resolve(logs); };
    S.logAnswer = function (e) { saved.push(e); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { S.getLogs = og; S.logAnswer = ol; return v; }, function (e) { S.getLogs = og; S.logAnswer = ol; throw e; });
  }
  function groupOf(pic) { return K().ITEMS.filter(function (it) { return it.pic === pic; })[0].g; }
  function right() { var s = K()._state(); K()._choose(s.q.choices.indexOf(s.q.answer)); K()._flush(); }
  function wrongIdx(s, skip) { for (var i = 0; i < s.q.choices.length; i++) if (s.q.choices[i] !== s.q.answer && (skip || []).indexOf(i) < 0) return i; return -1; }

  C.test('kage: 定数（5レベル、えらぶ数 3・4・4・6・6、5問で ごほうび）', function () {
    var k = K();
    C.assertEq(k.AREA, 'kage'); C.assertEq(k.MAX_LEVEL, 5); C.assertEq(k.ROUND, 5);
    C.assertEq(JSON.stringify([1, 2, 3, 4, 5].map(function (l) { return k.LEVELS[l].n; })), JSON.stringify([3, 4, 4, 6, 6]));
    var pics = k.ITEMS.map(function (it) { return it.pic; });
    C.assertEq(pics.filter(function (p, i) { return pics.indexOf(p) === i; }).length, pics.length);
  });
  C.test('kage: 問題は 答えを ふくむ ちがう絵。レベル1・2は ちがう なかま、3は 同じ なかま2つ以上、4・5は ぜんぶ 同じ', function () {
    var k = K(), bad = [];
    [1, 2, 3, 4, 5].forEach(function (lv) {
      for (var i = 0; i < 40; i++) {
        var q = k.makeQuestion(lv, seeded(lv * 50 + i)), g = groupOf(q.answer);
        var same = q.choices.filter(function (c) { return groupOf(c) === g; }).length;
        if (q.choices.length !== k.LEVELS[lv].n || q.choices.indexOf(q.answer) < 0) bad.push(lv + ' n');
        if (q.choices.filter(function (c, j) { return q.choices.indexOf(c) === j; }).length !== q.choices.length) bad.push(lv + ' dup');
        if (lv <= 2 && same !== 1) bad.push(lv + ' group ' + same);
        if (lv === 3 && same < 2) bad.push(lv + ' same ' + same);
        if (lv >= 4 && same !== q.choices.length) bad.push(lv + ' all ' + same);
        if (lv < 5 && q.flip) bad.push(lv + ' flip');
      }
    });
    if (bad.length) throw new Error(bad.slice(0, 5).join(' / '));
    var flips = 0; for (var j = 0; j < 40; j++) if (k.makeQuestion(5, seeded(900 + j)).flip) flips++;
    C.assertEq(flips > 5 && flips < 35, true);
  });
  C.test('kage: start(PID) は 記録の レベル、start(PID, 3) は レベル3', function () {
    var k = K();
    return withLogs([], function () {
      return k.start(PID).then(function () {
        C.assertEq(k._state().phase, 'play'); C.assertEq(k._state().level, 1); C.assertEq(k._state().q.choices.length, 3);
        return k.start(PID, 3);
      }).then(function () { C.assertEq(k._state().level, 3); C.assertEq(k._state().q.choices.length, 4); });
    });
  });
  C.test('kage: 1回目で あたりなら 記録 true、はずしてから あたりは false', function () {
    var k = K();
    return withLogs([], function (saved) {
      return k.start(PID, 1).then(function () {
        right();
        C.assertEq(saved.length, 1); C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct]), JSON.stringify(['kage', 'lv1', true]));
        var s = k._state(); k._choose(wrongIdx(s));
        C.assertEq(k._state().tried.length, 1);
        right();
        C.assertEq(saved[1].correct, false);
      });
    });
  });
  C.test('kage: 2回 はずれたら 答えを 見せて、さわると 次へ', function () {
    var k = K();
    return withLogs([], function (saved) {
      return k.start(PID, 2).then(function () {
        var s = k._state(), w1 = wrongIdx(s);
        k._choose(w1); k._choose(wrongIdx(s, [w1]));
        C.assertEq(k._state().phase, 'reveal');
        C.assertEq(saved.length, 1); C.assertEq(saved[0].correct, false);
        k._flush();
        C.assertEq(k._state().phase, 'play'); C.assertEq(k._state().done, 1);
      });
    });
  });
  C.test('kage: 5問で ごほうび', function () {
    var k = K();
    return withLogs([], function (saved) {
      return k.start(PID, 1).then(function () {
        for (var i = 0; i < 5; i++) right();
        C.assertEq(k._state().phase, 'reward'); C.assertEq(saved.length, 5);
      });
    });
  });
  C.test('kage: 文・ホーム・親画面・カードの 色', function () {
    var T = K().TEXT;
    C.assertEq(JSON.stringify([T.choose, T.ask, T.right, T.retry, T.reveal, T.reward]),
      JSON.stringify(['どれに する？', 'おなじ かたちは どれかな？', 'せいかい！', 'もういっかい、えらんでみよう', 'これだよ', 'すごい！ よく みつけたね']));
    C.assertEq(C.chiikuHome.ORDER.indexOf('kage') >= 0, true);
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/kage: 'かげあわせ'/.test(t), true);
      return fetch('../app-chiiku/app.css');
    }).then(function (r) { return r.text(); }).then(function (t) { C.assertEq(/\.hc-kage \{ background:/.test(t), true); });
  });
})();
