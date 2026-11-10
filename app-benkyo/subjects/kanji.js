/* かんじのロジック（画面には触らない）。Chiid.kanji
   教材は Chiid.kanjiData（subjects/kanji-data.js）。20字で1グループ＝1レベル。
   1年生 → レベル1〜4、2年生 → レベル5〜12。
   問題の形は2つ（書き取り式）：
     'yomi'：字を見て、読みをひらがなキーボードで入力する。アプリが採点する。
     'kaki'：読みを見て（聞いて）、字を指で書く。正しい字を見て、本人が「かけた／もういっかい」を選ぶ（自己採点）。
   1つの区切り（10問）に、よみ5問・かき5問をまぜて出す。
   記録は area='kanjiYomi'（よみ）／'kanjiKaki'（かき）、itemId は「字（形）」：'花（よみ）' / '花（かき）'。
   3択の版の記録（area='kanji'）は苦手には数えるが、レベルには使わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREAS = { yomi: 'kanjiYomi', kaki: 'kanjiKaki' };
  var OLD_AREA = 'kanji';    // 3択の版
  var GROUP_SIZE = 20;
  var ROUND_SIZE = 10;
  var STAR_EVERY = 5;
  var YOMI_PER_ROUND = 5;    // 10問のうち、よみの数（のこりは、かき）
  var NEW_RATE = 0.6;        // いまのグループから出す割合（のこりは、それまでのグループのふくしゅう）
  var KIND_LABEL = { yomi: 'よみ', kaki: 'かき' };

  var ITEMS = [];            // { k, grade, yomi:[{r, ex}], sim:[], group }
  var BY_K = {};
  var GROUPS = [];           // GROUPS[level-1] = [字, ...]

  function build(data) {
    ITEMS = [];
    BY_K = {};
    GROUPS = [];
    (data || []).forEach(function (row) {
      var it = {
        k: row[0], grade: row[1],
        yomi: (row[2] || []).map(function (y) { return { r: y[0], ex: y[1] }; }),
        sim: row[3] || []
      };
      ITEMS.push(it);
      BY_K[it.k] = it;
    });
    // グループ：1年生の字を20字ずつ、つづけて2年生の字を20字ずつ
    [1, 2].forEach(function (g) {
      var list = ITEMS.filter(function (it) { return it.grade === g; });
      for (var i = 0; i < list.length; i += GROUP_SIZE) {
        var grp = list.slice(i, i + GROUP_SIZE);
        GROUPS.push(grp.map(function (it) { return it.k; }));
        grp.forEach(function (it) { it.group = GROUPS.length; });
      }
    });
    api.ITEMS = ITEMS;
    api.GROUPS = GROUPS;
    api.MAX_LEVEL = GROUPS.length;
  }

  function maxLevel() { return GROUPS.length || 1; }
  function clampLevel(lv) { return Math.max(1, Math.min(maxLevel(), Number(lv) || 1)); }
  function gradeOfLevel(lv) {
    var g = GROUPS[clampLevel(lv) - 1];
    return g && BY_K[g[0]] ? BY_K[g[0]].grade : 1;
  }
  function firstLevelOf(grade) {
    for (var i = 0; i < GROUPS.length; i++) if (BY_K[GROUPS[i][0]].grade === grade) return i + 1;
    return 1;
  }

  function itemIdOf(k, kind) { return k + '（' + KIND_LABEL[kind] + '）'; }
  function areaOf(kind) { return kind === 'kaki' ? AREAS.kaki : AREAS.yomi; }
  // '花（よみ）' → { k: '花', kind: 'yomi' }。形がちがえば null
  function parseId(id) {
    var m = /^(.)（(よみ|かき)）$/.exec(String(id == null ? '' : id));
    if (!m || !BY_K[m[1]]) return null;
    return { k: m[1], kind: m[2] === 'よみ' ? 'yomi' : 'kaki' };
  }

  // 字ごとのまちがい回数（よみ・かきの合計）
  function missByKanji(missCounts) {
    var res = {};
    Object.keys(missCounts || {}).forEach(function (id) {
      var p = parseId(id);
      if (p && missCounts[id] > 0) res[p.k] = (res[p.k] || 0) + missCounts[id];
    });
    return res;
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      if (j > i) j = i;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function hasReading(it, r) {
    if (!it) return false;
    for (var i = 0; i < it.yomi.length; i++) if (it.yomi[i].r === r) return true;
    return false;
  }

  // 1問を作る。kind: 'yomi' / 'kaki'。yi: 読みの番号（なければ乱数）
  function makeQuestion(k, kind, rng, yi) {
    rng = rng || Math.random;
    var it = BY_K[k];
    if (!it) return null;
    kind = kind === 'kaki' ? 'kaki' : 'yomi';
    var n = it.yomi.length;
    var y = it.yomi[yi != null ? Math.max(0, Math.min(n - 1, yi)) : Math.min(n - 1, Math.floor(rng() * n))];
    return {
      id: itemIdOf(it.k, kind), area: areaOf(kind), k: it.k, grade: it.grade, kind: kind,
      r: y.r, ex: y.ex, ans: kind === 'yomi' ? y.r : it.k
    };
  }

  // 10問ぶんの形のならび（よみ5・かき5をまぜる）
  function roundKinds(rng) {
    rng = rng || Math.random;
    var list = [];
    for (var i = 0; i < ROUND_SIZE; i++) list.push(i < YOMI_PER_ROUND ? 'yomi' : 'kaki');
    return shuffle(list, rng);
  }

  // 出す字のなかま（字のならび）。grade があればその学年の字全部。
  // なければ、そのレベルのグループ（新しい字）と、それより前のグループ（ふくしゅう）
  function poolOf(level, grade) {
    if (grade === 1 || grade === 2) {
      return { now: ITEMS.filter(function (it) { return it.grade === grade; }).map(function (it) { return it.k; }), past: [] };
    }
    var lv = clampLevel(level);
    var past = [];
    for (var i = 0; i < lv - 1; i++) past = past.concat(GROUPS[i]);
    return { now: GROUPS[lv - 1].slice(), past: past };
  }

  // 出題：字を選ぶ（苦手は多めに）。形は opts.kind（なければ半分ずつ）。直前と同じ字は出さない
  function pickItem(opts, rng) {
    opts = opts || {};
    rng = rng || Math.random;
    var pool = poolOf(opts.level, opts.grade);
    var miss = missByKanji(opts.missCounts);
    var ids = pool.past.length && rng() >= NEW_RATE ? pool.past : pool.now;
    var not = function (k) { return k !== opts.lastK; };
    if (ids.filter(not).length) ids = ids.filter(not);
    var k = C.adaptive.pickWeighted(ids, miss, rng);
    var kind = opts.kind || (rng() < 0.5 ? 'yomi' : 'kaki');
    return makeQuestion(k, kind, rng);
  }

  /* ---------- よみの採点 ---------- */
  // 'empty'（何も入っていない）／'short'（枠があいている）／'correct'／
  // 'other'（この字の別の正しい読み。まちがいに数えない）／'wrong'
  function judgeYomi(q, value) {
    var v = String(value == null ? '' : value);
    if (!v) return 'empty';
    if (v === q.ans) return 'correct';
    if (v.length < q.ans.length) return 'short';
    if (hasReading(BY_K[q.k], v)) return 'other';
    return 'wrong';
  }

  function newAttempt() { return { tries: 0 }; }

  // よみの答えを出す。kind: empty/short/other/correct は回数を数えない。まちがいは1回目 retry、2回目 reveal
  function submitYomi(attempt, q, value) {
    var j = judgeYomi(q, value);
    if (j !== 'wrong') return { kind: j };
    attempt.tries++;
    return { kind: attempt.tries >= 2 ? 'reveal' : 'retry' };
  }

  // 例の言葉：□ に字（または読み）を入れる
  function fill(ex, s) { return String(ex).replace('□', s); }

  function speakText(q) {
    if (q.kind === 'yomi') return 'この かんじの よみかたは？';
    return q.r + '。 ' + fill(q.ex, q.r) + ' の、 ' + q.r + ' を かこう';
  }

  // 記録から、レベル・直近の正誤・苦手を組み立てる（九九と同じ考え方）。
  // レベルは、よみ・かきの「じどう」の記録（grade なし）だけで決める。学年をえらんだ練習・3択の版の記録は苦手には数える
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var isNew = function (e) { return e && (e.area === AREAS.yomi || e.area === AREAS.kaki); };
    (logs || []).forEach(function (e) {
      if (e && (isNew(e) || e.area === OLD_AREA) && !e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    var auto = (logs || []).filter(function (e) { return isNew(e) && e.grade == null; });
    if (auto.length) {
      res.level = clampLevel(auto[auto.length - 1].level);
      var run = [];
      for (var i = auto.length - 1; i >= 0 && Number(auto[i].level) === res.level; i--) run.unshift(!!auto[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, maxLevel());
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  var api = C.kanji = {
    AREAS: AREAS, OLD_AREA: OLD_AREA, GROUP_SIZE: GROUP_SIZE, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY,
    YOMI_PER_ROUND: YOMI_PER_ROUND,
    ITEMS: ITEMS, GROUPS: GROUPS, MAX_LEVEL: 1,
    build: build, byKanji: function (k) { return BY_K[k] || null; },
    gradeOfLevel: gradeOfLevel, firstLevelOf: firstLevelOf,
    itemIdOf: itemIdOf, areaOf: areaOf, parseId: parseId, missByKanji: missByKanji, hasReading: hasReading,
    poolOf: poolOf, makeQuestion: makeQuestion, roundKinds: roundKinds, pickItem: pickItem,
    judgeYomi: judgeYomi, newAttempt: newAttempt, submitYomi: submitYomi, fill: fill,
    speakText: speakText, progressFromLogs: progressFromLogs
  };
  build(C.kanjiData);
})();
