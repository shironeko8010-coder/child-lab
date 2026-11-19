/* ロジックぬりえの しくみ。Chiid.logic
   たて・よこの 数字（つづけて ぬる マスの 数）から マスを ぬると、絵が 出てくる パズル。
   絵（手で 作った ドット絵）・数字の 出し方・とき方（当てずっぽう なしで 1つに 決まるかの しらべ）・レベル。画面には触らない（画面は logic-screen.js）。
   設計書：docs/superpowers/specs/2026-11-20-benkyo-logic-design.md */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'logic';
  var MAX_LEVEL = 5;
  var LEVELS = {
    1: { size: 5, instant: true },
    2: { size: 5, instant: true },
    3: { size: 7 },
    4: { size: 8 },
    5: { size: 10 }
  };
  // 画面の文（1年生の漢字は そのまま、2年生の漢字は {漢字|よみ}）。reveal の ＊ に 絵の 名前が 入る
  var TEXT = {
    choose: 'どれに する？',
    rule: 'よこと たての {数|すう}字は、つづけて ぬる マスの {数|かず}だよ',
    start: '{数|すう}字を ヒントに、マスを ぬろう',
    wrongFill: 'そこは ぬらない マスだよ',
    wrongCross: 'そこは ぬる マスだよ',
    check: 'あかい マスを みなおそう',
    more: 'まだ ぬる マスが あるよ',
    hint: 'ひとつ おしえたよ',
    clear: 'できた！',
    reveal: '＊の えだよ！',
    reward: 'よく がんばったね！'
  };
  // 絵（# が ぬる マス）。どれも tests/logic.test.js で 当てずっぽう なしで 1つに とけるかを しらべている
  var PICS = {
    1: [
      { id: '1-01', name: 'ハート', color: '#e8526a', rows: ['.#.#.', '#####', '#####', '.###.', '..#..'] },
      { id: '1-02', name: 'さかな', color: '#3d8fd6', rows: ['...#.', '#.###', '#####', '#.###', '...#.'] },
      { id: '1-03', name: 'いえ', color: '#c9743b', rows: ['..#..', '.###.', '#####', '##.##', '##.##'] },
      { id: '1-04', name: 'き', color: '#3f9e4d', rows: ['.###.', '#####', '.###.', '..#..', '..#..'] },
      { id: '1-05', name: 'ほし', color: '#f2b705', rows: ['..#..', '#####', '.###.', '.#.#.', '#...#'] },
      { id: '1-06', name: 'かさ', color: '#8a5cc7', rows: ['.###.', '#####', '..#..', '..#..', '.##..'] },
      { id: '1-07', name: 'やじるし', color: '#e86a3a', rows: ['..#..', '.##..', '#####', '.##..', '..#..'] },
      { id: '1-08', name: 'きのこ', color: '#d9483b', rows: ['.###.', '#####', '#####', '..#..', '.###.'] },
      { id: '1-09', name: 'ちょうちょ', color: '#e07bb5', rows: ['#...#', '##.##', '..#..', '##.##', '#...#'] },
      { id: '1-10', name: 'ふね', color: '#2f78c4', rows: ['..#..', '..##.', '..#..', '#####', '.###.'] }
    ],
    2: [
      { id: '2-01', name: 'ねこ', color: '#e0913a', rows: ['#...#', '#####', '#.#.#', '#####', '.###.'] },
      { id: '2-02', name: 'ロボット', color: '#6b7f99', rows: ['#####', '#.#.#', '#####', '#...#', '.###.'] },
      { id: '2-03', name: 'おばけ', color: '#8e7cc3', rows: ['.###.', '#.#.#', '#####', '#####', '#.#.#'] },
      { id: '2-04', name: 'かに', color: '#e0533d', rows: ['#...#', '.###.', '#####', '.###.', '#.#.#'] },
      { id: '2-05', name: 'とり', color: '#3fa7c9', rows: ['.##..', '###..', '.####', '.####', '..#..'] },
      { id: '2-06', name: 'チューリップ', color: '#e8526a', rows: ['#.#.#', '#####', '.###.', '..#..', '.###.'] },
      { id: '2-07', name: 'うさぎ', color: '#d98aa8', rows: ['.#.#.', '.#.#.', '#####', '#.#.#', '.###.'] },
      { id: '2-08', name: 'かぎ', color: '#d4a017', rows: ['.....', '###..', '#.###', '###.#', '.....'] },
      { id: '2-09', name: 'くつ', color: '#9a6233', rows: ['##...', '##...', '##...', '#####', '#####'] },
      { id: '2-10', name: 'コップ', color: '#4aa3d8', rows: ['#####', '#...#', '#...#', '#...#', '.###.'] }
    ],
    3: [
      { id: '3-01', name: 'りんご', color: '#d93a3a', rows: ['...#...', '..#....', '.##.##.', '#######', '#######', '#######', '.##.##.'] },
      { id: '3-02', name: 'ロケット', color: '#5a6fd6', rows: ['...#...', '..###..', '..#.#..', '..###..', '..###..', '.#####.', '.#.#.#.'] },
      { id: '3-03', name: 'ゆきだるま', color: '#6aa9d8', rows: ['..###..', '..###..', '.#####.', '#######', '#######', '#######', '.#####.'] },
      { id: '3-04', name: 'くるま', color: '#e0533d', rows: ['..###..', '.#...#.', '#######', '#######', '#######', '.#...#.', '.......'] },
      { id: '3-05', name: 'ひこうき', color: '#4a8fd6', rows: ['...#...', '...#...', '.#####.', '#######', '...#...', '..###..', '...#...'] },
      { id: '3-06', name: 'かめ', color: '#4c9a52', rows: ['.......', '...###.', '..#####', '#######', '.#####.', '.#...#.', '.......'] },
      { id: '3-07', name: 'くま', color: '#9a6233', rows: ['##...##', '#######', '##.#.##', '#######', '##...##', '.#####.', '.......'] },
      { id: '3-08', name: 'ペンギン', color: '#2f4a6b', rows: ['..###..', '.##.##.', '.#####.', '##.#.##', '.#...#.', '.#####.', '.#.#.#.'] },
      { id: '3-09', name: 'いぬ', color: '#c98a4b', rows: ['#.....#', '##...##', '#######', '#.###.#', '#######', '.##.##.', '.#####.'] },
      { id: '3-10', name: 'でんしゃ', color: '#2f9e6b', rows: ['.......', '#######', '#.#.#.#', '#######', '#######', '.#...#.', '.......'] }
    ],
    4: [
      { id: '4-01', name: 'ねこ', color: '#e0913a', rows: ['#......#', '##....##', '########', '#.####.#', '########', '###..###', '.######.', '..####..'] },
      { id: '4-02', name: 'さかな', color: '#3d8fd6', rows: ['........', '#..####.', '##.###.#', '########', '##.#####', '#..####.', '........', '........'] },
      { id: '4-03', name: 'きのこ', color: '#d9483b', rows: ['..####..', '.######.', '##.##.##', '########', '...##...', '..####..', '..####..', '........'] },
      { id: '4-04', name: 'はな', color: '#e070a0', rows: ['..#..#..', '.######.', '..####..', '...##...', '.#.##.#.', '..####..', '...##...', '...##...'] },
      { id: '4-05', name: 'おしろ', color: '#8a6bbf', rows: ['#.#..#.#', '########', '.######.', '.##..##.', '.######.', '.##..##.', '.######.', '########'] },
      { id: '4-06', name: 'いえ', color: '#c9743b', rows: ['...##...', '..####..', '.######.', '########', '.##..##.', '.##..##.', '.######.', '........'] },
      { id: '4-07', name: 'いか', color: '#e0886a', rows: ['...##...', '..####..', '.######.', '.#.##.#.', '.######.', '.##..##.', '#.#..#.#', '#..##..#'] },
      { id: '4-08', name: 'とけい', color: '#3d7fc4', rows: ['..####..', '.##..##.', '##..#.##', '#...#..#', '#...###.', '##.....#', '.##..##.', '..####..'] },
      { id: '4-09', name: 'ふね', color: '#2f78c4', rows: ['...#....', '...##...', '...###..', '...####.', '...#....', '########', '.######.', '..####..'] },
      { id: '4-10', name: 'ヘリコプター', color: '#e0533d', rows: ['########', '...#....', '.#####..', '##..###.', '.#######', '..#####.', '.#...#..', '########'] }
    ],
    5: [
      { id: '5-01', name: 'きょうりゅう', color: '#4c9a52', rows: ['......####', '......#.##', '......####', '.....###..', '#...#####.', '##.######.', '.#########', '..#######.', '...##.##..', '...##..##.'] },
      { id: '5-02', name: 'ぞう', color: '#7f8fa6', rows: ['...####...', '..######..', '.##.#####.', '.#########', '.#.#######', '.#.####.##', '.#.#..#.##', '....#..#..', '..........', '..........'] },
      { id: '5-03', name: 'くじら', color: '#2f6fb0', rows: ['..........', '.......#.#', '........#.', '..#####.#.', '.#########', '##.#######', '##########', '.########.', '..######..', '..........'] },
      { id: '5-04', name: 'ロボット', color: '#6b7f99', rows: ['....##....', '.########.', '.#..##..#.', '.########.', '.##....##.', '.########.', '...####...', '#.######.#', '#.######.#', '..##..##..'] },
      { id: '5-05', name: 'おしろ', color: '#8a6bbf', rows: ['#.#.##.#.#', '##########', '.########.', '.##.##.##.', '.########.', '.########.', '.###..###.', '.###..###.', '##########', '..........'] },
      { id: '5-06', name: 'ほかけぶね', color: '#2f78c4', rows: ['....#.....', '....##....', '....###...', '....####..', '....#####.', '....#.....', '##########', '.########.', '..######..', '...####...'] },
      { id: '5-07', name: 'き', color: '#3f9e4d', rows: ['..######..', '.########.', '##########', '###.##.###', '##########', '.########.', '...####...', '....##....', '....##....', '..######..'] },
      { id: '5-08', name: 'ねこ', color: '#e0913a', rows: ['#........#', '##......##', '###....###', '##########', '##.####.##', '##########', '####..####', '.###..###.', '..######..', '...####...'] },
      { id: '5-09', name: 'いちご', color: '#e0384f', rows: ['...#..#...', '....##....', '..######..', '.##.##.##.', '.########.', '.#.####.#.', '..######..', '..##.###..', '...####...', '....##....'] },
      { id: '5-10', name: 'バス', color: '#e8a23a', rows: ['..........', '##########', '#.#.#.#..#', '#.#.#.#..#', '##########', '##########', '##########', '.##....##.', '.##....##.', '..........'] }
    ]
  };

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function runs(cells) {   // つづけて ぬった 数の 並び（cells は 1＝ぬる、それ以外＝ぬらない）
    var out = [], n = 0;
    for (var i = 0; i < cells.length; i++) { if (cells[i] === 1) n++; else if (n) { out.push(n); n = 0; } }
    if (n) out.push(n);
    return out;
  }
  function clues(rows) {
    var N = rows.length, W = rows[0].length, g = [];
    rows.forEach(function (r) { for (var x = 0; x < W; x++) g.push(r.charAt(x) === '#' ? 1 : 0); });
    var rc = [], cc = [];
    for (var y = 0; y < N; y++) rc.push(runs(g.slice(y * W, y * W + W)));
    for (var x = 0; x < W; x++) { var col = []; for (var y2 = 0; y2 < N; y2++) col.push(g[y2 * W + x]); cc.push(runs(col)); }
    return { rows: rc, cols: cc };
  }
  function lineOk(clue, cells) { return runs(cells).join(',') === clue.join(','); }

  // 1列の とき方：数字と 今わかっている マス（0＝まだ、1＝ぬる、2＝ぬらない）に 合う ならべ方を ぜんぶ 出し、どれでも 同じ マスだけ 決める
  function lineSolve(clue, st) {
    var n = st.length, out = null;
    function rec(k, pos, acc) {
      var i;
      if (k === clue.length) {
        var l = acc.slice(); while (l.length < n) l.push(2);
        for (i = 0; i < n; i++) if (st[i] && st[i] !== l[i]) return;
        if (!out) out = l; else for (i = 0; i < n; i++) if (out[i] !== l[i]) out[i] = 0;
        return;
      }
      var len = clue[k], rest = 0;
      for (var j = k + 1; j < clue.length; j++) rest += clue[j] + 1;
      for (var s = pos; s + len + rest <= n; s++) {
        var t = acc.slice(), ok = true;
        while (t.length < s) t.push(2);
        for (i = 0; i < len; i++) t.push(1);
        if (k < clue.length - 1) t.push(2);
        if (t.length > n) continue;
        for (i = acc.length; i < t.length; i++) if (st[i] && st[i] !== t[i]) { ok = false; break; }
        if (ok) rec(k + 1, t.length, t);
      }
    }
    rec(0, 0, []);
    return out;
  }
  // 表ぜんぶの とき方。1つに 決まれば 1/0 の 配列、決まらなければ null
  function solve(rowClues, colClues) {
    var H = rowClues.length, W = colClues.length, g = [], i, x, y;
    for (i = 0; i < W * H; i++) g.push(0);
    var changed = true;
    while (changed) {
      changed = false;
      for (y = 0; y < H; y++) {
        var o = lineSolve(rowClues[y], g.slice(y * W, y * W + W));
        if (!o) return null;
        for (x = 0; x < W; x++) if (o[x] && !g[y * W + x]) { g[y * W + x] = o[x]; changed = true; }
      }
      for (x = 0; x < W; x++) {
        var col = []; for (y = 0; y < H; y++) col.push(g[y * W + x]);
        var oc = lineSolve(colClues[x], col);
        if (!oc) return null;
        for (y = 0; y < H; y++) if (oc[y] && !g[y * W + x]) { g[y * W + x] = oc[y]; changed = true; }
      }
    }
    if (g.indexOf(0) >= 0) return null;
    return g.map(function (v) { return v === 1 ? 1 : 0; });
  }
  // 問題：レベルの 絵から 1まい（前と 同じ 絵は さける）
  function make(level, rng, avoidId) {
    level = lv(level); rng = rng || Math.random;
    var list = PICS[level].filter(function (p) { return p.id !== avoidId; });
    var p = list[Math.floor(rng() * list.length)] || PICS[level][0];
    var c = clues(p.rows);
    return { level: level, size: LEVELS[level].size, id: p.id, name: p.name, color: p.color, rowClues: c.rows, colClues: c.cols,
      solution: p.rows.join('').split('').map(function (ch) { return ch === '#' ? 1 : 0; }) };
  }

  function progressFromLogs(logs) {
    var res = { level: 1, recent: [] };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    if (mine.length) {
      res.level = lv(mine[mine.length - 1].level);
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  C.logic = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, LEVELS: LEVELS, TEXT: TEXT, PICS: PICS,
    clues: clues, lineOk: lineOk, solve: solve, make: make, progressFromLogs: progressFromLogs
  };
})();
