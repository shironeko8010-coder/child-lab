/* しりとり（知育）のテスト */
(function () {
  'use strict';
  var C = window.Chiid;
  function S() { return C.shiritori; }
  function log(itemId, correct, level) { return { area: 'shiritori', itemId: itemId, correct: correct, level: level }; }
  function opts() { return { missCounts: {}, rng: Math.random }; }

  C.test('shiritori: 定数とことば', function () {
    var s = S();
    C.assertEq(s.AREA, 'shiritori'); C.assertEq(s.MAX_LEVEL, 3); C.assertEq(s.GOAL, 5);
    C.assertEq(s.WORDS.length, 98);
    var ids = {}, count = {};
    s.WORDS.forEach(function (w) {
      if (ids[w.id] || !w.pic || !/^[ぁ-ゖー]+$/.test(w.word) || /[ーぁぃぅぇぉゃゅょっ]$/.test(w.word)) throw new Error(w.id);
      ids[w.id] = 1;
      count[s.firstKana(w.word)] = (count[s.firstKana(w.word)] || 0) + 1;
    });
    Object.keys(count).forEach(function (k) { if (count[k] < 3) throw new Error('3こ未満: ' + k); });
    C.assertEq(Object.keys(count).length, 30);
    C.assertEq(s.WORDS.filter(function (w) { return s.endsN(w.word); }).length, 15);
  });

  C.test('shiritori: どのことばも続けられる', function () {
    var s = S();
    s.WORDS.forEach(function (w) {
      if (s.endsN(w.word)) return;
      var ok = s.WORDS.some(function (x) { return x !== w && !s.endsN(x.word) && s.firstKana(x.word) === s.lastKana(w.word); });
      if (!ok) throw new Error(w.word);
    });
  });

  C.test('shiritori: 音の関数', function () {
    var s = S();
    C.assertEq(s.lastKana('たまご'), 'ご'); C.assertEq(s.firstKana('ごりら'), 'ご');
    C.assertEq(s.endsN('みかん'), true); C.assertEq(s.endsN('りんご'), false);
    C.assertEq(s.similar('ご'), 'こ'); C.assertEq(s.similar('こ'), 'ご'); C.assertEq(s.similar('あ'), null);
    C.assertEq(s.judge('ご', { word: 'ごりら' }), 'good');
    C.assertEq(s.judge('ご', { word: 'こあら' }), 'wrong');
    C.assertEq(s.judge('ご', { word: 'ごはん' }), 'n');
  });

  C.test('shiritori: makeChoices（まい数・正しいカード・出たことば）', function () {
    var s = S();
    [1, 2, 3].forEach(function (lv) {
      for (var k = 0; k < 30; k++) {
        var used = { gorira: true };
        var c = s.makeChoices('ご', lv, used, opts());
        C.assertEq(c.cards.length, lv === 1 ? 3 : 4);
        var good = c.cards.filter(function (w) { return s.judge('ご', w) === 'good'; });
        C.assertEq(good.length, 1); C.assertEq(good[0], c.answer);
        if (c.cards.some(function (w) { return used[w.id]; })) throw new Error('used');
        var ids = c.cards.map(function (w) { return w.id; }).sort();
        for (var i = 1; i < ids.length; i++) if (ids[i] === ids[i - 1]) throw new Error('同じカード');
      }
    });
    var c2 = s.makeChoices('ご', 2, {}, opts());
    C.assertEq(c2.cards.some(function (w) { return s.firstKana(w.word) === 'こ'; }), true);
    var c3 = s.makeChoices('ご', 3, {}, opts());
    C.assertEq(c3.cards.some(function (w) { return w.id === 'gohan'; }), true);
    var c1 = s.makeChoices('ご', 1, {}, opts());   // レベル1は まったくちがう音だけ（「こ」も「ん」も入れない）
    C.assertEq(c1.cards.some(function (w) { return w.id === 'gohan' || s.firstKana(w.word) === 'こ'; }), false);
    var c4 = s.makeChoices('こ', 3, {}, opts());   // 「こ」で始まる「ん」のことばはない
    C.assertEq(c4.cards.length, 4);
  });

  C.test('shiritori: pickReply', function () {
    var s = S();
    for (var k = 0; k < 20; k++) {
      var r = s.pickReply('ら', {}, Math.random);
      if (['rakko', 'rajio'].indexOf(r.id) < 0) throw new Error(r.id);
    }
    C.assertEq(s.pickReply('ら', { rakko: true, rajio: true }, Math.random), null);
  });

  C.test('shiritori: 使い切ったときは null で、例外を出さない', function () {
    var s = S();
    var used = {};
    s.WORDS.forEach(function (w) { if (s.firstKana(w.word) === 'ご') used[w.id] = true; });
    C.assertEq(s.makeChoices('ご', 1, used, opts()), null);
  });

  C.test('shiritori: 100回やっても、ひよこが続けられなくなる前に5回つながる', function () {
    var s = S();
    for (var g = 0; g < 100; g++) {
      var used = {}, cur = s.pickStart(used, Math.random);
      used[cur.id] = true;
      for (var t = 0; t < s.GOAL; t++) {
        var c = s.makeChoices(s.lastKana(cur.word), 3, used, opts());
        if (!c) throw new Error('こどもの番 ' + g + '/' + t);
        used[c.answer.id] = true;
        if (t === s.GOAL - 1) break;
        cur = s.pickReply(s.lastKana(c.answer.word), used, Math.random);
        if (!cur) throw new Error('ひよこの番 ' + g + '/' + t);
        used[cur.id] = true;
      }
    }
  });

  C.test('shiritori: 読み上げ文', function () {
    var s = S();
    C.assertEq(s.speakAsk('ご', 1), 'ごから はじまる ものは どれかな？');
    C.assertEq(s.speakAsk('ご', 2), 'つぎは どれかな？');
    C.assertEq(s.speakAsk('ご', 3), 'つぎは どれかな？');
    C.assertEq(s.speakWrong('ご'), 'ごから はじまる ものだよ。｜もういっかい！');
    Object.keys(s.TEXT).forEach(function (k) { s.TEXT[k].split('｜').forEach(function (p) { if (/^は/.test(p)) throw new Error(k); }); });
    C.assertEq(s.linkKana().indexOf('ん'), -1);
    C.assertEq(s.linkKana().indexOf('ご') >= 0, true);
  });

  C.test('shiritori: 知育のホームに「しりとり」のカードがある', function () {
    return fetch('../app-chiiku/game.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/playCard\('しりとり', 'sr', function \(\) \{ C\.shiritori\.start\(p\.id\); \}\);/.test(t), true);
    });
  });

  C.test('shiritori: 親画面に「しりとり」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/shiritori: 'しりとり'/.test(t), true);
    });
  });

  C.test('shiritori: progressFromLogs', function () {
    var s = S();
    C.assertEq(s.progressFromLogs([]).level, 1);
    C.assertEq(s.progressFromLogs([{ area: 'kazu', itemId: '3', correct: false, level: 3 }]).level, 1);
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push(log('gorira', true, 1));
    var r = s.progressFromLogs(logs);
    C.assertEq(r.level, 2); C.assertEq(r.recent, []);
    var d = [];
    for (var j = 0; j < 5; j++) d.push(log('rakko', false, 3));
    var rd = s.progressFromLogs(d);
    C.assertEq(rd.level, 2); C.assertEq(rd.missCounts, { rakko: 5 });
  });
})();
