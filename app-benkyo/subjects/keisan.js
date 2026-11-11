/* けいさん（たし算・ひき算）のロジック（画面には触らない）。Chiid.keisan
   レベル1〜8：1桁 → くり上がり・くり下がり → 2桁 → 答えが100をこえる。
   式の id は '23+45' / '72-38'。記録は area='keisan'。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'keisan';
  var MAX_LEVEL = 8;
  var ROUND_SIZE = 10;
  var STAR_EVERY = 5;
  var MAX_DIGITS = 3;        // こたえは最大198
  var MISS_RATE = 1 / 3;     // 苦手の式を出しなおす割合

  function make(a, op, b) {
    return { id: a + op + b, a: a, b: b, op: op, ans: op === '+' ? a + b : a - b };
  }
  // id（'23+45'）から式にもどす。形がちがえば null
  function parseId(id) {
    var m = /^([0-9]{1,3})([+-])([0-9]{1,3})$/.exec(String(id == null ? '' : id));
    if (!m) return null;
    return make(Number(m[1]), m[2], Number(m[3]));
  }

  // 式が、どのレベルの問題か（どれにも当たらなければ null）
  function levelOf(it) {
    if (!it) return null;
    var a = it.a, b = it.b, oa = a % 10, ob = b % 10;
    if (it.op === '+') {
      if (a < 1 || b < 1) return null;
      if (a < 10 && b < 10) return a + b <= 9 ? 1 : 3;
      if (a < 10 || b < 10 || a > 99 || b > 99) return null;
      if (a + b >= 100) return 8;
      return oa + ob <= 9 ? 5 : 6;
    }
    if (it.op !== '-' || b < 1 || a - b < 0) return null;
    if (a < 10) return 2;
    if (a >= 100) return (a <= 199 && b >= 10 && b <= 99 && a - b <= 99 && a - b >= 1) ? 8 : null;
    if (b < 10) return (a >= 11 && a <= 18 && oa < b) ? 4 : null;
    if (oa >= ob && Math.floor(a / 10) > Math.floor(b / 10)) return 5;
    if (oa < ob && a - b >= 1) return 7;
    return null;
  }

  // lo〜hi の整数（両はしをふくむ）
  function ri(rng, lo, hi) {
    var v = lo + Math.floor(rng() * (hi - lo + 1));
    return v > hi ? hi : v < lo ? lo : v;
  }
  function two(t, o) { return t * 10 + o; }

  // そのレベルの式を、乱数で1つ作る（どの乱数でも必ずそのレベルになる作り方）
  function generate(level, rng) {
    var lv = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
    var a, b, ta, tb, oa, ob;
    switch (lv) {
      case 1: a = ri(rng, 1, 8); b = ri(rng, 1, 9 - a); return make(a, '+', b);
      case 2: a = ri(rng, 2, 9); b = ri(rng, 1, a); return make(a, '-', b);
      case 3: a = ri(rng, 2, 9); b = ri(rng, Math.max(2, 10 - a), 9); return make(a, '+', b);
      case 4: oa = ri(rng, 1, 8); b = ri(rng, oa + 1, 9); return make(10 + oa, '-', b);
      case 5:
        if (rng() < 0.5) {
          ta = ri(rng, 1, 8); tb = ri(rng, 1, 9 - ta); oa = ri(rng, 0, 9); ob = ri(rng, 0, 9 - oa);
          return make(two(ta, oa), '+', two(tb, ob));
        }
        ta = ri(rng, 2, 9); tb = ri(rng, 1, ta - 1); oa = ri(rng, 0, 9); ob = ri(rng, 0, oa);
        return make(two(ta, oa), '-', two(tb, ob));
      case 6:
        ta = ri(rng, 1, 7); tb = ri(rng, 1, 8 - ta); oa = ri(rng, 1, 9); ob = ri(rng, Math.max(1, 10 - oa), 9);
        return make(two(ta, oa), '+', two(tb, ob));
      case 7:
        ta = ri(rng, 2, 9); tb = ri(rng, 1, ta - 1); oa = ri(rng, 0, 8); ob = ri(rng, oa + 1, 9);
        return make(two(ta, oa), '-', two(tb, ob));
      default:
        if (rng() < 0.5) {
          ta = ri(rng, 1, 9); tb = ri(rng, Math.max(1, 10 - ta), 9); oa = ri(rng, 0, 9); ob = ri(rng, 0, 9);
          return make(two(ta, oa), '+', two(tb, ob));
        }
        a = ri(rng, 101, 149); b = ri(rng, Math.max(10, a - 99), 99);
        return make(a, '-', b);
    }
  }

  // 出題：ときどき（約3回に1回）そのレベルの苦手から、ほかは新しく作る。直前と同じ式は出さない
  function pickItem(opts, rng) {
    opts = opts || {};
    rng = rng || Math.random;
    var lv = Math.max(1, Math.min(MAX_LEVEL, Number(opts.level) || 1));
    var miss = opts.missCounts || {};
    var ids = Object.keys(miss).filter(function (id) {
      return miss[id] > 0 && id !== opts.lastId && levelOf(parseId(id)) === lv;
    });
    if (ids.length && rng() < MISS_RATE) {
      var id = C.adaptive.pickWeighted(ids, miss, rng);
      if (id) return parseId(id);
    }
    var it = generate(lv, rng);
    for (var k = 0; k < 20 && it.id === opts.lastId; k++) it = generate(lv, rng);
    if (it.id === opts.lastId) it = generate(lv, Math.random);   // 決まった乱数のテストでも止まらないように
    return it;
  }

  // 数字だけ受け付ける。先頭の0は無視。4桁以上は wrong。
  function judge(item, input) {
    var s = String(input == null ? '' : input);
    if (s === '') return 'empty';
    if (!/^[0-9]+$/.test(s)) return 'wrong';
    if (s.length > MAX_DIGITS) return 'wrong';
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

  // 数字は合成音声が「にじゅうさん」と読む
  function speakText(item) {
    return item.a + (item.op === '+' ? 'たす' : 'ひく') + '｜' + item.b + 'は？';   // 「｜」で分けて、音声ファイルの部品をつなぐ
  }

  // 記録から、レベル・直近の正誤・苦手を組み立てる（九九と同じ考え方）
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    if (mine.length) {
      var lv = Number(mine[mine.length - 1].level) || 1;
      res.level = Math.max(1, Math.min(MAX_LEVEL, lv));
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  C.keisan = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY, MAX_DIGITS: MAX_DIGITS,
    make: make, parseId: parseId, levelOf: levelOf, generate: generate, pickItem: pickItem,
    judge: judge, newAttempt: newAttempt, submit: submit, speakText: speakText, progressFromLogs: progressFromLogs
  };
})();
