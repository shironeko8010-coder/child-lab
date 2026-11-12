/* ずかんの しくみ。Chiid.zukan
   ページの選び方・問題（選択肢をまぜる）・判定・カードの数え方・読み上げの文。画面には触らない（画面は zukan-screen.js）。
   カードは学習記録から作る：記録が1件でもあれば カード、correct: true が1件でもあれば きらきら。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'zukan';
  var PAGES_PER_ROUND = 3;
  var TEXT = { card: 'カードを ゲット！', kira: 'きらきらカード ゲット！', keep: 'きらきらカードは そのままだよ', ready: '{読|よ}めた！' };

  function D() { return C.zukanData; }
  function pagesOf(themeId) { return D().PAGES.filter(function (p) { return p.theme === themeId; }); }
  function pageById(id) { return D().PAGES.filter(function (p) { return p.id === id; })[0] || null; }
  function themeById(id) { return D().THEMES.filter(function (t) { return t.id === id; })[0] || null; }
  function pick(arr, rng) { return arr[Math.floor((rng || Math.random)() * arr.length)]; }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rng || Math.random)() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function cardsFromLogs(logs) {
    var cards = {};
    (logs || []).forEach(function (e) {
      if (!e || e.area !== AREA || !e.itemId) return;
      if (e.correct) cards[e.itemId] = 'kira';
      else if (!cards[e.itemId]) cards[e.itemId] = 'card';
    });
    return cards;
  }

  function countFor(themeId, cards) {
    var list = pagesOf(themeId), got = 0, kira = 0;
    list.forEach(function (p) { if (cards[p.id]) got++; if (cards[p.id] === 'kira') kira++; });
    return { got: got, kira: kira, total: list.length };
  }

  // まだのページ → きらきらでないページ → どれでも。同じ回で出たページ（usedIds）は出さない
  function pickPage(themeId, cards, usedIds, rng) {
    cards = cards || {};
    usedIds = usedIds || [];
    var all = pagesOf(themeId);
    var fresh = all.filter(function (p) { return usedIds.indexOf(p.id) < 0; });
    if (!fresh.length) fresh = all;
    var none = fresh.filter(function (p) { return !cards[p.id]; });
    if (none.length) return pick(none, rng);
    var plain = fresh.filter(function (p) { return cards[p.id] !== 'kira'; });
    if (plain.length) return pick(plain, rng);
    return pick(fresh, rng);
  }

  function makeQuiz(page, rng) {
    return page.qs.map(function (q) {
      var choices = shuffle([q.a].concat(q.wrong), rng);
      return { ask: q.ask, choices: choices, answer: choices.indexOf(q.a) };
    });
  }
  function check(item, index) { return !!item && Number(index) === item.answer; }
  function answerText(item) { return 'こたえは｜' + item.choices[item.answer] + '｜だよ。｜つぎは できるよ！'; }

  C.zukan = {
    AREA: AREA, PAGES_PER_ROUND: PAGES_PER_ROUND, TEXT: TEXT,
    pagesOf: pagesOf, pageById: pageById, themeById: themeById,
    cardsFromLogs: cardsFromLogs, countFor: countFor, pickPage: pickPage,
    makeQuiz: makeQuiz, check: check, answerText: answerText
  };
})();
