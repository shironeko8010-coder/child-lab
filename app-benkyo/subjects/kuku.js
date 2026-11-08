/* 九九のロジック（画面には触らない）。Chiid.kuku */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'kuku';
  var MAX_LEVEL = 8;
  var ROUND_SIZE = 10;
  var STAR_EVERY = 5;
  var YOMI = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];

  var ITEMS = [];
  for (var a = 1; a <= 9; a++) {
    for (var b = 1; b <= 9; b++) ITEMS.push({ id: a + '×' + b, a: a, b: b, ans: a * b });
  }
  var BY_ID = {};
  ITEMS.forEach(function (it) { BY_ID[it.id] = it; });

  // レベル1: 1・2の段 … レベル8: 9の段まで。onlyDan があればその段だけ。
  function poolIds(level, onlyDan) {
    var maxDan = Math.min((Number(level) || 1) + 1, 9);
    return ITEMS.filter(function (it) {
      return onlyDan ? it.a === onlyDan : it.a <= maxDan;
    }).map(function (it) { return it.id; });
  }

  function pickItem(opts, rng) {
    opts = opts || {};
    var ids = poolIds(opts.level, opts.onlyDan);
    if (ids.length >= 2 && opts.lastId) {
      ids = ids.filter(function (id) { return id !== opts.lastId; });
    }
    var id = C.adaptive.pickWeighted(ids, opts.missCounts || {}, rng || Math.random);
    return BY_ID[id];
  }

  // 数字だけ受け付ける。先頭の0は無視。3桁以上は wrong。
  function judge(item, input) {
    var s = String(input == null ? '' : input);
    if (s === '') return 'empty';
    if (!/^[0-9]+$/.test(s)) return 'wrong';
    if (s.length >= 3) return 'wrong'; // 入力は2桁まで（'012'のように3桁以上は、0付きでも不正解）
    return Number(s) === item.ans ? 'correct' : 'wrong';
  }

  function newAttempt() { return { tries: 0 }; }

  function submit(attempt, item, input) {
    var j = judge(item, input);
    if (j === 'empty') return { kind: 'empty' };
    if (j === 'correct') return { kind: 'correct' };
    attempt.tries++;
    return { kind: attempt.tries >= 2 ? 'reveal' : 'retry' };
  }

  function speakText(item) {
    return YOMI[item.a] + ' かける ' + YOMI[item.b] + ' は？';
  }

  // 記録から、レベル・直近の正誤・苦手を組み立てる（app-chiiku/game.js の loadProgress と同じ考え方）
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    // レベルは「じどう」の記録だけで決める（「○のだんだけ」の練習＝dan 付きの記録は、苦手には数えるがレベルには使わない）
    var auto = mine.filter(function (e) { return e.dan == null; });
    if (auto.length) {
      var lv = Number(auto[auto.length - 1].level) || 1;
      res.level = Math.max(1, Math.min(MAX_LEVEL, lv));
      var run = [];
      for (var i = auto.length - 1; i >= 0 && Number(auto[i].level) === res.level; i--) run.unshift(!!auto[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  C.kuku = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY,
    ITEMS: ITEMS, poolIds: poolIds, pickItem: pickItem, judge: judge,
    newAttempt: newAttempt, submit: submit, speakText: speakText, progressFromLogs: progressFromLogs
  };
})();
