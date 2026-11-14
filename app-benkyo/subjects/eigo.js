/* えい語の しくみ。Chiid.eigo
   「きく」（英語を聞いて絵を選ぶ）と「よむ」（アルファベット）の問題作り・判定・レベル。画面には触らない（画面は eigo-screen.js）。
   設計書：docs/superpowers/specs/2026-11-14-benkyo-eigo-design.md（3・4章） */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var KIKU_AREA = 'eigoKiku', YOMI_AREA = 'eigoYomi';
  var KIKU_MAX = 3, YOMI_MAX = 4;
  var ROUND_SIZE = 10, STAR_EVERY = 5;
  // 画面の文（1年生の漢字はそのまま、2年生の漢字は {漢字|よみ}）
  var TEXT = {
    start: 'どっちで あそぶ？',
    theme: 'テーマを えらんでね',
    kiku: 'えい{語|ご}を きいて、{絵|え}を えらんでね',
    yomi12: 'きこえた 文字を えらんでね',
    yomi3: 'おなじ 文字の 小文字を えらんでね',
    yomi4: 'さいしょの 文字を えらんでね',
    again: 'もういっかい きいてみよう',
    again3: 'もういっかい みてみよう',
    reveal: 'ひかっている ものだよ',
    noVoice: 'この たんまつでは えい{語|ご}の こえが でません'
  };

  function D() { return C.eigoData; }
  function rnd(rng) { return (rng || Math.random)(); }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd(rng) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, rng) { return a[Math.floor(rnd(rng) * a.length)]; }
  function byId(id) { return D().WORDS.filter(function (w) { return w.id === id; })[0] || null; }

  function wordsOf(themeId) { return themeId === 'all' ? D().WORDS.slice() : D().WORDS.filter(function (w) { return w.theme === themeId; }); }
  function firstLetter(word) { return String((word && word.en) || word || '').charAt(0); }

  /* ---------- きく ---------- */
  function makeKiku(level, themeId, rng, opts) {
    opts = opts || {};
    level = Math.max(1, Math.min(KIKU_MAX, Number(level) || 1));
    var used = opts.used || {}, pool = wordsOf(themeId);
    var avail = pool.filter(function (w) { return !used[w.id]; });
    if (!avail.length) avail = pool;          // テーマのことばが全部出たら くり返してよい
    var answer = byId(C.adaptive.pickWeighted(avail.map(function (w) { return w.id; }), opts.missCounts || {}, rng || Math.random));
    var n = level === 1 ? 3 : 4, others = [], taken = {}; taken[answer.id] = 1;
    function add(w) { if (others.length < n - 1 && !taken[w.id]) { taken[w.id] = 1; others.push(w); } }
    if (level === 3) {   // 答えと同じ文字で始まることばを できれば2まい（どのテーマからでも）
      shuffle(D().WORDS.filter(function (w) { return w.id !== answer.id && firstLetter(w) === firstLetter(answer); }), rng).slice(0, 2).forEach(add);
    }
    shuffle(D().WORDS.filter(function (w) { return w.theme === answer.theme; }), rng).forEach(add);
    return { answer: answer, cards: shuffle([answer].concat(others), rng), level: level };
  }

  /* ---------- よむ ---------- */
  function confuseOf(ch) {
    var out = [];
    D().CONFUSE.forEach(function (g) { if (g.indexOf(ch) >= 0) g.forEach(function (c) { if (c !== ch && out.indexOf(c) < 0) out.push(c); }); });
    return out;
  }
  // 小文字4つ：答え＋（レベル2・3は まぎらわしい文字を1つ）＋ほか
  function lowerChoices(ans, withConfuse, rng) {
    var picks = [ans];
    if (withConfuse) { var cf = confuseOf(ans); if (cf.length) picks.push(pick(cf, rng)); }
    shuffle(D().LETTERS.split(''), rng).forEach(function (c) { if (picks.length < 4 && picks.indexOf(c) < 0) picks.push(c); });
    return shuffle(picks, rng);
  }
  function makeYomi(level, rng, opts) {
    opts = opts || {};
    level = Math.max(1, Math.min(YOMI_MAX, Number(level) || 1));
    var miss = opts.missCounts || {}, used = opts.used || {};
    function pickLetter(letters) {
      var ok = letters.filter(function (c) { return !used[c]; });
      if (!ok.length) ok = letters;
      var id = C.adaptive.pickWeighted(ok.map(function (c) { return 'L' + level + ':' + c; }), miss, rng || Math.random);
      return id.split(':')[1];
    }
    if (level === 4) {
      var single = D().WORDS.filter(function (w) { return w.en.indexOf(' ') < 0; });
      var letters = [];
      single.forEach(function (w) { var c = firstLetter(w); if (letters.indexOf(c) < 0) letters.push(c); });
      var ch = pickLetter(letters);
      var word = pick(single.filter(function (w) { return firstLetter(w) === ch; }), rng);
      return { kind: 'first', level: 4, prompt: '', say: word.en, answer: ch, choices: lowerChoices(ch, true, rng), word: word };
    }
    var c0 = pickLetter(D().LETTERS.split(''));
    if (level === 1) {
      var up = c0.toUpperCase(), ch1 = lowerChoices(c0, false, rng).map(function (c) { return c.toUpperCase(); });
      return { kind: 'upper', level: 1, prompt: '', say: up, answer: up, choices: ch1, word: null };
    }
    if (level === 2) return { kind: 'lower', level: 2, prompt: '', say: c0.toUpperCase(), answer: c0, choices: lowerChoices(c0, true, rng), word: null };
    return { kind: 'match', level: 3, prompt: c0.toUpperCase(), say: null, answer: c0, choices: lowerChoices(c0, true, rng), word: null };
  }

  function check(q, choice) {
    if (!q) return false;
    if (q.cards) return !!choice && (choice.id || choice) === q.answer.id;
    return choice === q.answer;
  }
  function itemIdYomi(q) { return 'L' + q.level + ':' + q.answer; }

  // 記録から、いまのレベルと直近の結果（きく・よむ 別々）
  function progressFromLogs(logs, area) {
    var max = area === YOMI_AREA ? YOMI_MAX : KIKU_MAX;
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === area; });
    mine.forEach(function (e) { if (!e.correct && e.itemId) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1; });
    if (mine.length) {
      res.level = Math.max(1, Math.min(max, Number(mine[mine.length - 1].level) || 1));
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, max);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  C.eigo = {
    KIKU_AREA: KIKU_AREA, YOMI_AREA: YOMI_AREA, KIKU_MAX: KIKU_MAX, YOMI_MAX: YOMI_MAX, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY,
    TEXT: TEXT, wordsOf: wordsOf, firstLetter: firstLetter, makeKiku: makeKiku, makeYomi: makeYomi,
    check: check, itemIdYomi: itemIdYomi, progressFromLogs: progressFromLogs
  };
})();
