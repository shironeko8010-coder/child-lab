/* 日本の 地図（小2）の出題・判定・地図の形の計算。Chiid.japan
   画面には触らない（純粋な関数だけ）。データは subjects/japan-data.js、画面は japan-screen.js。
   中身は docs/superpowers/specs/2026-11-11-benkyo-chizu-japan-design.md（やまとさん承認済み）を正本にする。
   - レベル1＝8つの地方（3択）、レベル2＝有名な15の都道府県（3択）、レベル3＝47都道府県（4択）。
     Chiid.adaptive.nextLevel で上がり下がりする（九九と同じ。レベルは記録から出す）。
   - 問題の種類：atete（光っている所は どこ？）／meibutsu（特産物）／kencho（県庁所在地）／touch（地図を押す）。
     レベル1は atete と touch だけ（地方）。
   - まちがえたら もう一度。2回まちがえたら答えを見せて、押すと次へ（記録は「1回目で正解」かどうか）。
   記録：area 'chizuJ'。itemId は「青森県・ばしょ」「青森県・名ぶつ」「青森県・けんちょう」「青森県・タッチ」
         （地方は「関東地方・ばしょ」「関東地方・タッチ」）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var Dt = function () { return C.japanData; };

  var AREA = 'chizuJ';
  var ROUND_SIZE = 10;
  var STAR_EVERY = 5;
  var MAX_LEVEL = 3;
  var MISS_SHOW = 2;               // この回数まちがえたら答えを見せる
  var RETRY = 'もういっかい やって みよう！';
  var SHOW_BTN = 'こたえは {光|ひか}って いる ボタンだよ。おして みてね。';
  var SHOW_MAP = 'ここだよ。{光|ひか}って いる ところを おして みてね。';
  var KIND_LABEL = { atete: 'ばしょ', meibutsu: '名ぶつ', kencho: 'けんちょう', touch: 'タッチ' };

  /* ---------- ふりがなの記法 {漢字|よみ} ---------- */
  function segments(text) {
    var out = [], re = /\{([^|{}]+)\|([^|{}]+)\}/g, last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: text.slice(last, m.index) });
      out.push({ t: m[1], y: m[2] });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out;
  }
  function plain(text) { return String(text || '').replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$1'); }
  function yomi(text) { return String(text || '').replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$2'); }
  // 声用：漢字のまま、すき間をつめる（ひらがなの分かち書きだと「は」を「わ」と読む端末があるため）
  function voice(text) { return plain(text).replace(/[ 　]+/g, ''); }
  function sentences(text) {
    return String(text || '').replace(/([。！？])\s*/g, '$1\n').split('\n')
      .map(function (s) { return s.replace(/^\s+|\s+$/g, ''); })
      .filter(function (s) { return s.length > 0; });
  }

  /* ---------- 地図の形 ---------- */
  // 経度・緯度 → 絵の座標（左上が 0,0）。日本のあたりで横:たて ≒ 0.82:1 にする
  var X0 = 128.2, Y0 = 45.8, KX = 60, KY = 73;
  function proj(ll) { return [Math.round((ll[0] - X0) * KX * 10) / 10, Math.round((Y0 - ll[1]) * KY * 10) / 10]; }
  function moveOkinawa(ll) {
    var m = Dt().OKINAWA_MOVE;
    return [m.tx + (ll[0] - m.cx) * m.scale, m.ty + (ll[1] - m.cy) * m.scale];
  }
  function nodeLL(name) {
    var n = Dt().NODES[name];
    if (!n) throw new Error('点が ない: ' + name);
    return n;
  }
  function chainLL(name, rev) {
    var b = Dt().BORDERS[name];
    if (!b) throw new Error('県境が ない: ' + name);
    var pts = b.map(function (e) { return typeof e === 'string' ? nodeLL(e) : e; });
    return rev ? pts.slice().reverse() : pts;
  }
  // 輪の書き方を、経度・緯度の点の列にする
  function ringLL(ring) {
    var out = [];
    ring.forEach(function (e) {
      var add;
      if (typeof e === 'string') {
        if (e.charAt(0) === '>') add = chainLL(e.slice(1), false);
        else if (e.charAt(0) === '<') add = chainLL(e.slice(1), true);
        else add = [nodeLL(e)];
      } else add = [e];
      add.forEach(function (p) {
        var last = out[out.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
      });
    });
    var f = out[0], l = out[out.length - 1];
    if (out.length > 1 && f[0] === l[0] && f[1] === l[1]) out.pop();
    return out;
  }

  var GEO = null;      // { id: { rings: [[[x,y],...]], box: [x1,y1,x2,y2], center: [x,y] } }
  function boxOf(points, box) {
    box = box || [Infinity, Infinity, -Infinity, -Infinity];
    points.forEach(function (p) {
      if (p[0] < box[0]) box[0] = p[0];
      if (p[1] < box[1]) box[1] = p[1];
      if (p[0] > box[2]) box[2] = p[0];
      if (p[1] > box[3]) box[3] = p[1];
    });
    return box;
  }
  function area2(pts) {
    var a = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }
  // 多角形の重心（大きい輪で計算する）
  function centroid(pts) {
    var a = area2(pts), cx = 0, cy = 0;
    if (!a) return pts[0];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length], f = p[0] * q[1] - q[0] * p[1];
      cx += (p[0] + q[0]) * f;
      cy += (p[1] + q[1]) * f;
    }
    return [Math.round(cx / (6 * a)), Math.round(cy / (6 * a))];
  }
  function geo() {
    if (GEO) return GEO;
    var g = {};
    Dt().PREFS.forEach(function (p) {
      var rings = p.rings.map(function (r) {
        var ll = ringLL(r);
        if (p.id === 'okinawa') ll = ll.map(moveOkinawa);
        return ll.map(proj);
      });
      var box = null;
      rings.forEach(function (r) { box = boxOf(r, box); });
      var big = rings.slice().sort(function (a, b) { return Math.abs(area2(b)) - Math.abs(area2(a)); })[0];
      g[p.id] = { rings: rings, box: box, center: centroid(big) };
    });
    GEO = g;
    return g;
  }
  function pathOf(id) {
    var s = geo()[id];
    if (!s) return '';
    return s.rings.map(function (r) {
      return 'M' + r.map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + 'Z';
    }).join('');
  }
  function lakePath() {
    var r = Dt().LAKE_BIWA.map(proj);
    return 'M' + r.map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + 'Z';
  }
  function okinawaBox() {
    var b = Dt().OKINAWA_BOX, a = proj([b[0], b[3]]), c = proj([b[2], b[1]]);
    return [a[0], a[1], c[0], c[1]];
  }
  function pad(box, r, minW) {
    var w = box[2] - box[0], h = box[3] - box[1];
    var px = Math.max(w * r, (minW - w) / 2, 0), py = Math.max(h * r, (minW - h) / 2, 0);
    return [box[0] - px, box[1] - py, box[2] + px, box[3] + py];
  }
  // 地方の枠（拡大のとき）。九州には沖縄の枠も入る
  function regionBox(rid) {
    var box = null;
    prefsOf(rid).forEach(function (p) { box = boxOf([[geo()[p.id].box[0], geo()[p.id].box[1]], [geo()[p.id].box[2], geo()[p.id].box[3]]], box); });
    if (rid === 'kyushu') { var o = okinawaBox(); box = boxOf([[o[0], o[1]], [o[2], o[3]]], box); }
    return pad(box, 0.08, 120);
  }
  function worldBox() {
    var box = null;
    Dt().PREFS.forEach(function (p) { var b = geo()[p.id].box; box = boxOf([[b[0], b[1]], [b[2], b[3]]], box); });
    return pad(box, 0.02, 0);
  }

  /* ---------- データの引き方 ---------- */
  var BY_ID = null, BY_NAME = null, REG_BY_ID = null;
  function index() {
    if (BY_ID) return;
    BY_ID = {}; BY_NAME = {}; REG_BY_ID = {};
    Dt().PREFS.forEach(function (p) { BY_ID[p.id] = p; BY_NAME[plain(p.name)] = p.id; });
    Dt().REGIONS.forEach(function (r) { REG_BY_ID[r.id] = r; BY_NAME[plain(r.name)] = r.id; });
  }
  function pref(id) { index(); return BY_ID[id] || null; }
  function region(id) { index(); return REG_BY_ID[id] || null; }
  function prefsOf(rid) { return Dt().PREFS.filter(function (p) { return p.region === rid; }); }

  /* ---------- 出題 ---------- */
  function kindsOf(level) { return level <= 1 ? ['atete', 'touch'] : ['atete', 'meibutsu', 'kencho', 'touch']; }
  function choiceCount(level) { return level >= 3 ? 4 : 3; }
  // そのレベルで出る範囲（id の配列）
  function poolIds(level) {
    if (level <= 1) return Dt().REGIONS.map(function (r) { return r.id; });
    return Dt().PREFS.filter(function (p) { return level >= 3 || p.lv2; }).map(function (p) { return p.id; });
  }
  function itemIdOf(level, kind, id) {
    var nm = level <= 1 ? plain(region(id).name) : plain(pref(id).name);
    return nm + '・' + KIND_LABEL[kind];
  }
  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // 1回（10問）の種類のならび。どの種類も まんべんなく出す
  function kindPlan(level, rng) {
    rng = rng || Math.random;
    var ks = kindsOf(level), out = [];
    while (out.length < ROUND_SIZE) out = out.concat(shuffle(ks, rng));
    return out.slice(0, ROUND_SIZE);
  }

  function pickDistractors(level, kind, target, n, notWith, rng) {
    var pool = poolIds(level).filter(function (id) {
      if (id === target) return false;
      if (notWith && notWith.indexOf(id) >= 0) return false;
      if (kind === 'kencho' && !pref(id).capital) return false;
      return true;
    });
    pool = shuffle(pool, rng);
    var out = [];
    if (level >= 3) {      // 同じ地方の県を1つ以上まぜる（地図を見て考えるように）
      var rid = pref(target).region;
      for (var i = 0; i < pool.length; i++) {
        if (pref(pool[i]).region === rid) { out.push(pool[i]); pool.splice(i, 1); break; }
      }
    }
    for (var k = 0; k < pool.length && out.length < n; k++) out.push(pool[k]);
    return out.slice(0, n);
  }
  function choiceText(level, kind, id) {
    if (level <= 1) return region(id).name;
    if (kind === 'kencho') return pref(id).capital;
    return pref(id).name;
  }

  // 問題を1つ作る。opts: { productIndex }
  function makeQuestion(level, kind, target, rng, opts) {
    rng = rng || Math.random;
    opts = opts || {};
    level = Math.max(1, Math.min(MAX_LEVEL, level));
    var q = { level: level, kind: kind, target: target, scope: level <= 1 ? 'region' : 'pref', choices: [] };
    q.itemId = itemIdOf(level, kind, target);
    var notWith = null;
    if (level <= 1) {
      var r = region(target);
      q.ask = kind === 'touch' ? r.name + 'は どこ？ {地図|ちず}を おしてね。' : '{光|ひか}って いるのは どの {地方|ちほう}？';
      q.fact = r.fact;
      q.extra = null;
    } else {
      var p = pref(target);
      var pi = opts.productIndex != null ? opts.productIndex : Math.floor(rng() * p.products.length);
      var prod = p.products[Math.max(0, Math.min(p.products.length - 1, pi))];
      q.product = prod;
      q.extra = p.extra;
      if (kind === 'atete') { q.ask = '{光|ひか}って いるのは どこ？'; q.fact = p.products[0].fact; }
      else if (kind === 'meibutsu') { q.ask = prod.q; q.fact = prod.fact; notWith = prod.notWith; }
      else if (kind === 'kencho') { q.ask = p.name + 'の ' + p.office + 'が ある {市|し}は？'; q.fact = p.name + 'の ' + p.office + 'は ' + p.capital + 'に あるよ！'; }
      else { q.ask = p.name + 'は どこ？ {地図|ちず}を おしてね。'; q.fact = p.products[0].fact; }
    }
    if (kind !== 'touch') {
      var ids = [target].concat(pickDistractors(level, kind, target, choiceCount(level) - 1, notWith, rng));
      q.choices = shuffle(ids, rng).map(function (id) { return { id: id, text: choiceText(level, kind, id) }; });
    }
    return q;
  }

  // 次の問題を選ぶ。ctx: { level, kind, missCounts, used: {itemId:true}, lastTarget }
  function pickQuestion(ctx, rng) {
    rng = rng || Math.random;
    var level = Math.max(1, Math.min(MAX_LEVEL, ctx.level || 1));
    var kinds = kindsOf(level);
    var kind = kinds.indexOf(ctx.kind) >= 0 ? ctx.kind : kinds[Math.floor(rng() * kinds.length)];
    var used = ctx.used || {};
    var ids = poolIds(level).filter(function (id) { return !(kind === 'kencho' && !pref(id).capital); });
    var fresh = ids.filter(function (id) { return id !== ctx.lastTarget && !used[itemIdOf(level, kind, id)]; });
    if (!fresh.length) fresh = ids.filter(function (id) { return id !== ctx.lastTarget; });
    // 苦手（まちがえた回数）の重みで選ぶ
    var miss = {};
    fresh.forEach(function (id) { miss[id] = (ctx.missCounts && ctx.missCounts[itemIdOf(level, kind, id)]) || 0; });
    var target = C.adaptive.pickWeighted(fresh, miss, rng);
    return makeQuestion(level, kind, target, rng);
  }

  /* ---------- 判定 ---------- */
  function newAttempt() { return { tried: [], misses: 0, done: false, firstTry: null, shown: false }; }
  // 押した答え（選択肢の id、または地図で押した県の id）。返り値 kind: 'good' | 'retry' | 'show' | 'ignore'
  function answer(attempt, q, id) {
    if (!attempt || attempt.done || !q || !id) return { kind: 'ignore' };
    if (q.kind === 'touch' && q.scope === 'region' && pref(id)) id = pref(id).region;   // 地方の問題は、押した県の地方で答える
    if (q.kind !== 'touch' && !q.choices.some(function (c) { return c.id === id; })) return { kind: 'ignore' };
    if (q.kind !== 'touch' && attempt.tried.indexOf(id) >= 0) return { kind: 'ignore' };
    if (id === q.target) {
      attempt.done = true;
      attempt.firstTry = attempt.misses === 0;
      return { kind: 'good', firstTry: attempt.firstTry };
    }
    if (attempt.shown) return { kind: 'ignore' };      // 答えを見せたあとは、答えだけを待つ
    if (q.kind !== 'touch') attempt.tried.push(id);
    attempt.misses++;
    if (attempt.misses >= MISS_SHOW) { attempt.shown = true; return { kind: 'show', firstTry: false }; }
    return { kind: 'retry', firstTry: false };
  }
  function logEntry(q, attempt) {
    return { area: AREA, itemId: q.itemId, correct: !!(attempt && attempt.firstTry), level: q.level };
  }

  /* ---------- 声 ---------- */
  function speakText(q) { return voice(q.ask); }
  function replyText(q, result) {
    if (!result) return '';
    if (result.kind === 'retry') return voice(RETRY);
    if (result.kind === 'show') return voice(q.kind === 'touch' ? SHOW_MAP : SHOW_BTN);
    var t = voice(q.fact);
    if (q.extra) t += ' ' + voice(q.extra);
    return t;
  }

  /* ---------- 記録から ---------- */
  // { level, recent, missCounts, colored: {県のid: true} }。colored は1回でも正解した県（色ぬり）
  function progressFromLogs(logs) {
    index();
    var res = { level: 1, recent: [], missCounts: {}, colored: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
      else {
        var id = BY_NAME[String(e.itemId || '').split('・')[0]];
        if (id && BY_ID[id]) res.colored[id] = true;
      }
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

  C.japan = {
    AREA: AREA, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY, MAX_LEVEL: MAX_LEVEL, MISS_SHOW: MISS_SHOW,
    RETRY: RETRY, SHOW_BTN: SHOW_BTN, SHOW_MAP: SHOW_MAP, KIND_LABEL: KIND_LABEL,
    segments: segments, plain: plain, yomi: yomi, voice: voice, sentences: sentences,
    pref: pref, region: region, prefsOf: prefsOf,
    proj: proj, ringLL: ringLL, geo: geo, pathOf: pathOf, lakePath: lakePath, okinawaBox: okinawaBox,
    regionBox: regionBox, worldBox: worldBox, area2: area2,
    kindsOf: kindsOf, choiceCount: choiceCount, poolIds: poolIds, itemIdOf: itemIdOf, kindPlan: kindPlan,
    makeQuestion: makeQuestion, pickQuestion: pickQuestion,
    newAttempt: newAttempt, answer: answer, logEntry: logEntry,
    speakText: speakText, replyText: replyText, progressFromLogs: progressFromLogs
  };
})();
