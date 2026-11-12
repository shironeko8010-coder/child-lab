/* 「長さ・かさ」の出題・判定（画面には触らない）。Chiid.nagasa
   問題の種類：
     readLen … ものさしでテープの長さを読む（□cm／□cm□mm）
     readVol … ますの水のかさを読む（□dL／□L□dL）
     convert … 単位をかえる（3cm5mm → □mm など）            ※レベル2から
     unit    … ものに合う単位をえらぶ（えんぴつの長さ 15□）  ※レベル2から
   レベル1＝cm ちょうど・dL だけ、レベル2＝mm・L も、レベル3＝m・mL も。
   問題の id は 'readLen:35'（mm）・'readVol:13'（dL）・'convert:cm2mm:35'・'unit:enpitsu'。記録は area='nagasa'。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'nagasa';
  var MAX_LEVEL = 3;
  var ROUND_SIZE = 10;
  var STAR_EVERY = 5;
  var MAX_DIGITS = 4;        // こたえは最大 3000（mL）
  // 読み上げの単位（画面は記号のまま）
  var SAY = { cm: 'センチ', mm: 'ミリ', m: 'メートル', L: 'リットル', dL: 'デシリットル', mL: 'ミリリットル' };
  // 単位をえらぶ問題のもの。text は画面用、say は読み上げ用（「は」を前の言葉につける）
  var UNIT_ITEMS = [
    { id: 'enpitsu', text: 'えんぴつの {長|なが}さ', n: 15, unit: 'cm', kind: 'len', min: 2 },
    { id: 'note', text: 'ノートの よこの {長|なが}さ', n: 18, unit: 'cm', kind: 'len', min: 2 },
    { id: 'ari', text: 'ありの {長|なが}さ', n: 5, unit: 'mm', kind: 'len', min: 2 },
    { id: 'ichien', text: '1円玉の あつさ', n: 1, unit: 'mm', kind: 'len', min: 2 },
    { id: 'pool', text: 'プールの {長|なが}さ', n: 25, unit: 'm', kind: 'len', min: 3 },
    { id: 'kokuban', text: 'こくばんの よこの {長|なが}さ', n: 4, unit: 'm', kind: 'len', min: 3 },
    { id: 'bucket', text: 'バケツに 入る 水', n: 8, unit: 'L', kind: 'vol', min: 2 },
    { id: 'gyunyu', text: 'ぎゅうにゅうパックに 入る ぎゅうにゅう', n: 1, unit: 'L', kind: 'vol', min: 2 },
    { id: 'cup', text: 'コップに 入る 水', n: 2, unit: 'dL', kind: 'vol', min: 2 },
    { id: 'suito', text: '水とうに 入る お{茶|ちゃ}', n: 6, unit: 'dL', kind: 'vol', min: 2 },
    { id: 'petto', text: 'ペットボトルに 入る 水', n: 500, unit: 'mL', kind: 'vol', min: 3 },
    { id: 'spoon', text: 'スプーン 1ぱいの 水', n: 5, unit: 'mL', kind: 'vol', min: 3 }
  ];
  UNIT_ITEMS.forEach(function (it) { it.say = it.text + 'は'; });

  // 単位をかえる問題：from（もとの数と単位）、boxes（答えの単位）、answer
  var CONVERT = {
    cm2mm: { lv: 2, vals: range(10, 159), f: function (v) { return { from: [[fl(v, 10), 'cm'], [v % 10, 'mm']], boxes: ['mm'], answer: [v] }; } },
    mm2cm: { lv: 2, vals: range(11, 159), f: function (v) { return { from: [[v, 'mm']], boxes: ['cm', 'mm'], answer: [fl(v, 10), v % 10] }; } },
    l2dl: { lv: 2, vals: range(10, 39), f: function (v) { return { from: [[fl(v, 10), 'L'], [v % 10, 'dL']], boxes: ['dL'], answer: [v] }; } },
    dl2l: { lv: 2, vals: range(11, 39), f: function (v) { return { from: [[v, 'dL']], boxes: ['L', 'dL'], answer: [fl(v, 10), v % 10] }; } },
    m2cm: { lv: 3, vals: range(100, 399), f: function (v) { return { from: [[fl(v, 100), 'm'], [v % 100, 'cm']], boxes: ['cm'], answer: [v] }; } },
    cm2m: { lv: 3, vals: range(101, 399), f: function (v) { return { from: [[v, 'cm']], boxes: ['m', 'cm'], answer: [fl(v, 100), v % 100] }; } },
    dl2ml: { lv: 3, vals: range(1, 9), f: function (v) { return { from: [[v, 'dL']], boxes: ['mL'], answer: [v * 100] }; } },
    l2ml: { lv: 3, vals: range(1, 3), f: function (v) { return { from: [[v, 'L']], boxes: ['mL'], answer: [v * 1000] }; } },
    ml2dl: { lv: 3, vals: [100, 200, 300, 400, 500, 600, 700, 800, 900], f: function (v) { return { from: [[v, 'mL']], boxes: ['dL'], answer: [v / 100] }; } }
  };

  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
  function fl(v, d) { return Math.floor(v / d); }
  function lvOf(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }

  function kindsFor(level) {
    return lvOf(level) === 1 ? ['readLen', 'readVol'] : ['readLen', 'readVol', 'convert', 'unit'];
  }

  function idsFor(level) {
    var l = lvOf(level), out = [];
    if (l === 1) {
      for (var c = 1; c <= 15; c++) out.push('readLen:' + c * 10);
      for (var d = 1; d <= 9; d++) out.push('readVol:' + d);
      return out;
    }
    range(11, 149).forEach(function (mm) { if (mm % 10) out.push('readLen:' + mm); });
    range(11, 39).forEach(function (dl) { if (dl % 10) out.push('readVol:' + dl); });
    Object.keys(CONVERT).forEach(function (k) {
      if (CONVERT[k].lv <= l) CONVERT[k].vals.forEach(function (v) { out.push('convert:' + k + ':' + v); });
    });
    UNIT_ITEMS.forEach(function (it) { if (it.min <= l) out.push('unit:' + it.id); });
    return out;
  }

  function itemOf(id) { return UNIT_ITEMS.filter(function (it) { return it.id === id; })[0] || null; }

  // id から問題を作る。level は unit の単位ボタンだけが使う（ほかは id で決まる）
  function makeQuestion(id, level) {
    var p = String(id).split(':'), kind = p[0], q = { id: String(id), kind: kind, boxes: [], answer: [], choices: null, show: {} };
    if (kind === 'readLen') {
      var mm = Number(p[1]);
      q.show = { mm: mm };
      if (mm % 10 === 0) { q.boxes = ['cm']; q.answer = [mm / 10]; } else { q.boxes = ['cm', 'mm']; q.answer = [fl(mm, 10), mm % 10]; }
    } else if (kind === 'readVol') {
      var dl = Number(p[1]);
      q.show = { dl: dl };
      if (dl < 10) { q.boxes = ['dL']; q.answer = [dl]; } else { q.boxes = ['L', 'dL']; q.answer = [fl(dl, 10), dl % 10]; }
    } else if (kind === 'convert') {
      var r = CONVERT[p[1]].f(Number(p[2]));
      q.boxes = r.boxes; q.answer = r.answer;
      q.show = { from: r.from.filter(function (x) { return x[0] > 0; }), type: p[1] };
    } else if (kind === 'unit') {
      var it = itemOf(p[1]), l = lvOf(level == null ? 3 : level);
      q.show = { item: it };
      if (it.kind === 'len') q.choices = l >= 3 ? ['m', 'cm', 'mm'] : ['cm', 'mm'];
      else q.choices = l >= 3 ? ['L', 'dL', 'mL'] : ['L', 'dL'];
    }
    return q;
  }

  function pickQuestion(opts, rng) {
    opts = opts || {};
    rng = rng || Math.random;
    var l = lvOf(opts.level), counts = opts.kindCounts || {};
    var kinds = kindsFor(l);
    var min = Math.min.apply(null, kinds.map(function (k) { return counts[k] || 0; }));
    var few = kinds.filter(function (k) { return (counts[k] || 0) === min; });
    var kind = few[Math.floor(rng() * few.length)] || few[0];
    var ids = idsFor(l).filter(function (id) { return id.indexOf(kind + ':') === 0 && id !== opts.lastId; });
    var id = C.adaptive.pickWeighted(ids, opts.missCounts || {}, rng) || ids[0];
    return makeQuestion(id, l);
  }

  function isEmpty(q, input) {
    if (q.kind === 'unit') return !input;
    var a = input || [];
    for (var i = 0; i < q.boxes.length; i++) if (a[i] == null || String(a[i]) === '') return true;
    return false;
  }
  function check(q, input) {
    if (q.kind === 'unit') return input === q.show.item.unit;
    var a = input || [];
    if (a.length < q.answer.length) return false;
    for (var i = 0; i < q.answer.length; i++) {
      var s = String(a[i] == null ? '' : a[i]);
      if (!/^[0-9]{1,4}$/.test(s) || Number(s) !== q.answer[i]) return false;
    }
    return true;
  }
  function newAttempt() { return { tries: 0 }; }
  function submit(attempt, q, input) {
    if (isEmpty(q, input)) return { kind: 'empty' };
    if (check(q, input)) return { kind: 'correct' };
    attempt.tries++;
    return { kind: attempt.tries >= 2 ? 'reveal' : 'retry' };
  }

  /* ---------- 読み上げ（「｜」で分けて、音声ファイルの部品をつなぐ。0 の部品は読まない） ---------- */
  function partsOf(pairs) { return pairs.filter(function (x) { return x[0] > 0; }).map(function (x) { return x[0] + SAY[x[1]]; }); }
  function speakText(q) {
    if (q.kind === 'readLen') return q.boxes.length === 1 ? 'テープの {長|なが}さは なんセンチ？' : 'テープの {長|なが}さは なんセンチ なんミリ？';
    if (q.kind === 'readVol') return q.boxes.length === 1 ? '水の かさは なんデシリットル？' : '水の かさは なんリットル なんデシリットル？';
    if (q.kind === 'convert') {
      return partsOf(q.show.from).concat(['を ' + q.boxes.map(function (u) { return SAY[u]; }).join('と ') + 'で いうと？']).join('｜');
    }
    var it = q.show.item;
    return it.say + '｜' + it.n + '｜どの たんいかな？';
  }
  function answerText(q) {
    var parts = q.kind === 'unit' ? [q.show.item.n + SAY[q.show.item.unit]]
      : partsOf(q.answer.map(function (n, i) { return [n, q.boxes[i]]; }));
    return 'こたえは｜' + parts.join('｜') + '｜だよ。｜つぎは できるよ！';
  }

  // 記録から、レベル・直近の正誤・苦手を組み立てる（けいさんと同じ考え方）
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    if (mine.length) {
      res.level = lvOf(mine[mine.length - 1].level);
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  C.nagasa = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY, MAX_DIGITS: MAX_DIGITS,
    SAY: SAY, UNIT_ITEMS: UNIT_ITEMS,
    kindsFor: kindsFor, idsFor: idsFor, makeQuestion: makeQuestion, pickQuestion: pickQuestion,
    isEmpty: isEmpty, check: check, newAttempt: newAttempt, submit: submit,
    speakText: speakText, answerText: answerText, progressFromLogs: progressFromLogs
  };
})();
