/* 「せかいの 国」の出題・判定（画面には触らない）。Chiid.world
   問題の種類：
     flag … 国旗を見て国名をえらぶ      pick … 国名を見て国旗をえらぶ
     map  … 地図で光る国の名前をえらぶ   cont … 地図で光る大陸の名前をえらぶ（レベル2から）
   レベル1＝10か国・3択、レベル2＝20か国・4択（大陸も）、レベル3＝36か国・4択。
   模様の細かい国旗（complex）は、レベル3になるまで国旗の問題に出さない。
   データは Chiid.worldData（subjects/world-data.js）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'chizuW';
  var MAX_LEVEL = 3;
  var ROUND_SIZE = 10;
  var STAR_EVERY = 5;
  var TYPES = ['flag', 'pick', 'map', 'cont'];

  function W() { return C.worldData; }
  function byId(id) {
    var l = W().COUNTRIES;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function contById(id) {
    var l = W().CONTINENTS;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  /* ---------- 文字 ---------- */
  var RUBY = /\{([^|{}]+)\|([^|{}]+)\}/g;
  // ふりがなを外して漢字だけにする（記録の名前・声に使う）
  function plain(text) { return String(text || '').replace(RUBY, '$1'); }
  // 声用の文：漢字まじり・すき間なし（ひらがなの分かち書きだと「は」を「わ」と読む端末があるため）
  function voice(text) { return plain(text).replace(/[ 　]+/g, ''); }
  // 長い文は、文ごとに分けて読む
  function sentences(text) {
    return String(text || '').replace(/([。！？])\s*/g, '$1\n').split('\n')
      .map(function (s) { return s.replace(/^\s+|\s+$/g, ''); })
      .filter(function (s) { return s.length > 0; });
  }

  /* ---------- レベル ---------- */
  function clampLevel(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function poolIds(level) {
    var L = clampLevel(level);
    return W().COUNTRIES.filter(function (c) { return c.level <= L; }).map(function (c) { return c.id; });
  }
  function flagOk(id, level) { var c = byId(id); return !!c && (!c.complex || clampLevel(level) >= 3); }
  function typesFor(level) { return clampLevel(level) >= 2 ? TYPES.slice() : ['flag', 'pick', 'map']; }
  function choiceCount(level) { return clampLevel(level) >= 2 ? 4 : 3; }
  function contIds() { return W().CONTINENTS.map(function (c) { return c.id; }); }

  /* ---------- 名前 ---------- */
  function nameOf(type, id) {
    if (type === 'cont') { var k = contById(id); return k ? k.name : ''; }
    var c = byId(id); return c ? c.name : '';
  }
  function sayName(type, id) {
    if (type === 'cont') { var k = contById(id); return k ? k.say : ''; }
    return voice(nameOf(type, id));
  }
  // 親画面の「苦手」に出る名前
  function itemIdOf(type, id) {
    if (type === 'cont') return plain(nameOf('cont', id));
    return plain(nameOf(type, id)) + (type === 'map' ? '（ちず）' : '（こっき）');
  }
  function keyOf(type, id) { return (type === 'pick' ? 'flag' : type) + ':' + id; }   // 国旗あて・国旗えらびは同じ国旗なので、1回に1つだけ

  /* ---------- 出題 ---------- */
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // 種類ごとの出しやすさ（大陸は少なめ）
  var WEIGHT = { flag: 3, pick: 3, map: 3, cont: 1 };

  function candidatesFor(type, level) {
    if (type === 'cont') return contIds();
    var ids = poolIds(level);
    if (type === 'flag' || type === 'pick') ids = ids.filter(function (id) { return flagOk(id, level); });
    return ids;
  }

  // opts: { level, missCounts（itemId → まちがえた回数）, lastId, used（keyOf → true） }
  function makeQuestion(opts, rng) {
    opts = opts || {};
    rng = rng || Math.random;
    var level = clampLevel(opts.level);
    var used = opts.used || {};
    var miss = opts.missCounts || {};
    var types = typesFor(level);
    // 種類をえらぶ（重みつき）
    var total = 0;
    types.forEach(function (t) { total += WEIGHT[t]; });
    var x = rng() * total, type = types[types.length - 1];
    for (var i = 0; i < types.length; i++) { if (x < WEIGHT[types[i]]) { type = types[i]; break; } x -= WEIGHT[types[i]]; }

    var all = candidatesFor(type, level);
    var ids = all.filter(function (id) { return !used[keyOf(type, id)] && id !== opts.lastId; });
    if (!ids.length) ids = all.filter(function (id) { return id !== opts.lastId; });
    if (!ids.length) ids = all;
    // 苦手（まちがえた回数）で重みをつける
    var mc = {};
    ids.forEach(function (id) { mc[id] = miss[itemIdOf(type, id)] || 0; });
    var id = C.adaptive.pickWeighted(ids, mc, rng);

    var n = Math.min(choiceCount(level), all.length);
    var others = shuffle(all.filter(function (o) { return o !== id; }), rng).slice(0, n - 1);
    var choices = shuffle([id].concat(others), rng);
    return { type: type, id: id, answer: id, key: keyOf(type, id), itemId: itemIdOf(type, id), choices: choices, level: level };
  }

  /* ---------- 問いかけ ---------- */
  function askText(q) {
    if (!q) return '';
    if (q.type === 'flag') return 'この {国|こっ}きは どこの {国|くに}？';
    if (q.type === 'pick') return nameOf('pick', q.id) + 'の {国|こっ}きは どれ？';
    if (q.type === 'map') return '{光|ひか}って いる {国|くに}は どこかな？';
    return '{光|ひか}って いる 大りくは どこかな？';
  }
  // 声（「国旗」「大陸」は漢字で渡して、読みまちがいを防ぐ）
  function askSay(q) {
    if (!q) return '';
    if (q.type === 'flag') return 'この国旗は、どこの国？';
    if (q.type === 'pick') return sayName('pick', q.id) + 'の国旗は、どれ？';
    if (q.type === 'map') return '光っている国は、どこかな？';
    return '光っている大陸は、どこかな？';
  }
  function factOf(q) {
    if (!q) return '';
    if (q.type === 'cont') { var k = contById(q.id); return k ? k.fact : ''; }
    var c = byId(q.id); return c ? c.fact : '';
  }
  function factSay(q) {
    var f = voice(factOf(q));
    // 「大りく」は漢字で読ませる
    return f.replace(/大りく/g, '大陸').replace(/南きょく/g, '南極');
  }

  /* ---------- 判定 ---------- */
  function newAttempt() { return { tries: 0, tried: [] }; }
  // 2回まちがえたら、こたえを見せる（reveal）
  function choose(attempt, q, choiceId) {
    if (!q || q.choices.indexOf(choiceId) < 0 || attempt.tried.indexOf(choiceId) >= 0) return { kind: 'ignore' };
    attempt.tried.push(choiceId);
    if (choiceId === q.answer) return { kind: 'correct' };
    attempt.tries++;
    return { kind: attempt.tries >= 2 ? 'reveal' : 'retry' };
  }
  var RETRY = 'もう{一回|いっかい} やってみよう！';
  function replyText(q, kind) {
    if (kind === 'retry') return RETRY;
    if (kind === 'correct') return '正かい！ ' + factOf(q);
    if (kind === 'reveal') return '{答|こた}えは ' + nameOf(q.type, q.answer) + 'だよ。 ' + factOf(q);
    return '';
  }
  function replySay(q, kind) {
    if (kind === 'retry') return 'もういっかい、やってみよう！';
    if (kind === 'correct') return 'せいかい！ ' + factSay(q);
    if (kind === 'reveal') return 'こたえは、' + sayName(q.type, q.answer) + 'だよ。 ' + factSay(q);
    return '';
  }

  /* ---------- 記録から ---------- */
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) { if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1; });
    if (mine.length) {
      res.level = clampLevel(mine[mine.length - 1].level);
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  C.world = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY, TYPES: TYPES, RETRY: RETRY,
    byId: byId, contById: contById, plain: plain, voice: voice, sentences: sentences,
    poolIds: poolIds, flagOk: flagOk, typesFor: typesFor, choiceCount: choiceCount, candidatesFor: candidatesFor,
    nameOf: nameOf, sayName: sayName, itemIdOf: itemIdOf, keyOf: keyOf,
    makeQuestion: makeQuestion, askText: askText, askSay: askSay, factOf: factOf, factSay: factSay,
    newAttempt: newAttempt, choose: choose, replyText: replyText, replySay: replySay,
    progressFromLogs: progressFromLogs
  };
})();
