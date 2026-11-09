/* かんじのロジック（画面には触らない）。Chiid.kanji
   教材は Chiid.kanjiData（subjects/kanji-data.js）。20字で1グループ＝1レベル。
   1年生 → レベル1〜4、2年生 → レベル5〜12。
   問題の形は2つ：'yomi'（字を見て読みを選ぶ）と 'kaki'（読みを見て字を選ぶ）。選択肢は3つ。
   記録は area='kanji'、itemId は「字（形）」：'花（よみ）' / '花（かき）'。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'kanji';
  var GROUP_SIZE = 20;
  var ROUND_SIZE = 10;
  var STAR_EVERY = 5;
  var CHOICES = 3;
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
      var g = row[1];
      var it = {
        k: row[0], grade: g,
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
    for (var i = 0; i < it.yomi.length; i++) if (it.yomi[i].r === r) return true;
    return false;
  }

  // ほかの字を、近い順にならべる（形の似た字 → 同じグループ → 同じ学年 → ほか）。同じ順位の中はまぜる
  function others(it, rng) {
    var sim = it.sim.filter(function (k) { return BY_K[k] && k !== it.k; });
    var rest = ITEMS.filter(function (o) { return o.k !== it.k && sim.indexOf(o.k) < 0; });
    var same = shuffle(rest.filter(function (o) { return o.group === it.group; }), rng);
    var grade = shuffle(rest.filter(function (o) { return o.group !== it.group && o.grade === it.grade; }), rng);
    var far = shuffle(rest.filter(function (o) { return o.grade !== it.grade; }), rng);
    // 形の似た字は1つまで（全部が似た字だと、むずかしすぎるため）
    var head = sim.length ? [BY_K[shuffle(sim, rng)[0]]] : [];
    return head.concat(same, grade, far);
  }

  // 1問を作る。kind: 'yomi' / 'kaki'。yi: 読みの番号（なければ乱数）
  function makeQuestion(k, kind, rng, yi) {
    rng = rng || Math.random;
    var it = BY_K[k];
    if (!it) return null;
    kind = kind === 'kaki' ? 'kaki' : 'yomi';
    var n = it.yomi.length;
    var y = it.yomi[yi != null ? Math.max(0, Math.min(n - 1, yi)) : Math.min(n - 1, Math.floor(rng() * n))];
    var choices = [];
    var ans;
    if (kind === 'yomi') {
      // よみ：ほかの選択肢は、この字の正しい読みと同じにならない読み
      ans = y.r;
      choices.push(ans);
      var cand = others(it, rng);
      for (var i = 0; i < cand.length && choices.length < CHOICES; i++) {
        var oy = cand[i].yomi[Math.floor(rng() * cand[i].yomi.length) % cand[i].yomi.length].r;
        if (hasReading(it, oy) || choices.indexOf(oy) >= 0) {
          // その読みがだめなら、その字のほかの読みをためす
          oy = null;
          for (var j = 0; j < cand[i].yomi.length; j++) {
            var r2 = cand[i].yomi[j].r;
            if (!hasReading(it, r2) && choices.indexOf(r2) < 0) { oy = r2; break; }
          }
        }
        if (oy) choices.push(oy);
      }
    } else {
      // かき：ほかの選択肢は、同じ読みを持たない字
      ans = it.k;
      choices.push(ans);
      var cand2 = others(it, rng);
      for (var m = 0; m < cand2.length && choices.length < CHOICES; m++) {
        if (!hasReading(cand2[m], y.r)) choices.push(cand2[m].k);
      }
    }
    return {
      id: itemIdOf(it.k, kind), k: it.k, grade: it.grade, kind: kind,
      r: y.r, ex: y.ex, ans: ans, choices: shuffle(choices, rng)
    };
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

  // 出題：字を選び（苦手は多めに）、形（よみ/かき）を半分ずつで選ぶ。直前と同じ字は出さない
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

  function judge(q, choice) {
    if (choice == null || choice === '') return 'empty';
    return String(choice) === q.ans ? 'correct' : 'wrong';
  }

  function newAttempt() { return { tries: 0, wrong: [] }; }

  // 1回目でまちがえた選択肢は、もう押せない（押しても何も起きない）
  function submit(attempt, q, choice) {
    var j = judge(q, choice);
    if (j === 'empty') return { kind: 'empty' };
    if (q.choices.indexOf(String(choice)) < 0) return { kind: 'empty' };
    if (j === 'correct') return { kind: 'correct' };
    if (attempt.wrong.indexOf(String(choice)) >= 0) return { kind: 'empty' };
    attempt.wrong.push(String(choice));
    attempt.tries++;
    return { kind: attempt.tries >= 2 ? 'reveal' : 'retry' };
  }

  // 例の言葉：□ に字（または読み）を入れる
  function fill(ex, s) { return String(ex).replace('□', s); }

  function speakText(q) {
    if (q.kind === 'yomi') return 'この かんじの よみかたは？';
    return q.r + '。 ' + fill(q.ex, q.r) + ' の、 ' + q.r + ' は どれ？';
  }

  // 記録から、レベル・直近の正誤・苦手を組み立てる（九九と同じ考え方）。
  // レベルは「じどう」の記録（grade なし）だけで決める。学年をえらんだ練習は苦手には数える
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    var auto = mine.filter(function (e) { return e.grade == null; });
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
    AREA: AREA, GROUP_SIZE: GROUP_SIZE, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY, CHOICES: CHOICES,
    ITEMS: ITEMS, GROUPS: GROUPS, MAX_LEVEL: 1,
    build: build, byKanji: function (k) { return BY_K[k] || null; },
    gradeOfLevel: gradeOfLevel, firstLevelOf: firstLevelOf,
    itemIdOf: itemIdOf, parseId: parseId, missByKanji: missByKanji, hasReading: hasReading,
    poolOf: poolOf, makeQuestion: makeQuestion, pickItem: pickItem,
    judge: judge, newAttempt: newAttempt, submit: submit, fill: fill,
    speakText: speakText, progressFromLogs: progressFromLogs
  };
  build(C.kanjiData);
})();
