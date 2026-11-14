/* めいろ（知育）のテスト */
(function () {
  'use strict';
  var C = window.Chiid;
  function M() { return C.meiro; }
  function seeded(n) { var s = n; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  var SCREENS = [[667, 375], [740, 360], [812, 375], [375, 667], [360, 740], [390, 844], [1280, 800], [1024, 600]];
  var DIR = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
  function xy(k) { var p = k.split(','); return [+p[0], +p[1]]; }
  // 確かめる大きさ：各レベルの 表の land/port/tab と、740×360（よこ）での fit 後
  function sizes(lv) {
    var m = M(), out = [];
    ['land', 'port', 'tab'].forEach(function (k) { out.push(m.dims(lv, k)); });
    out.push(m.fit(lv, 'land', 740 - 24, 360 - 72 - 14, 56));
    return out;
  }
  function reachAll(maze) {   // 道だけで（ふた・とびらを見ずに）行けるマス
    var seen = {}, q = [maze.start]; seen[maze.start] = 1;
    while (q.length) {
      var k = q.shift(), p = xy(k), c = maze.cells[p[1]][p[0]];
      Object.keys(DIR).forEach(function (d) {
        if (!c[d]) return;
        var nk = (p[0] + DIR[d][0]) + ',' + (p[1] + DIR[d][1]);
        if (!seen[nk]) { seen[nk] = 1; q.push(nk); }
      });
    }
    return seen;
  }
  function openings(maze, k) { var p = xy(k), c = maze.cells[p[1]][p[0]]; return ['n', 'e', 's', 'w'].filter(function (d) { return c[d]; }); }

  C.test('meiro: 定数と表', function () {
    var m = M();
    C.assertEq(m.AREA, 'meiro'); C.assertEq(m.MAX_LEVEL, 5); C.assertEq(m.ROUND, 3);
    C.assertEq(JSON.stringify(m.dims(1, 'land')), JSON.stringify({ w: 5, h: 3 }));
    C.assertEq(JSON.stringify(m.dims(3, 'port')), JSON.stringify({ w: 6, h: 8 }));
    C.assertEq(JSON.stringify(m.dims(3, 'tabPort')), JSON.stringify({ w: 8, h: 12 }));
  });

  C.test('meiro: kindOf', function () {
    var m = M();
    C.assertEq(m.kindOf(812, 375), 'land'); C.assertEq(m.kindOf(375, 667), 'port');
    C.assertEq(m.kindOf(1280, 800), 'tab'); C.assertEq(m.kindOf(800, 1280), 'tabPort');
  });

  C.test('meiro: fit はマスの下限を守る', function () {
    var m = M();
    SCREENS.forEach(function (s) {
      var kind = m.kindOf(s[0], s[1]), port = s[1] > s[0];
      var aw = s[0] - 24, ah = s[1] - (port ? 134 : 72) - 14, min = (!port && s[1] <= 340) ? 48 : 56;
      for (var lv = 1; lv <= 5; lv++) {
        var f = m.fit(lv, kind, aw, ah, min), d = m.dims(lv, kind);
        if (f.cell < min || f.w < 3 || f.h < 3 || f.w > d.w || f.h > d.h) throw new Error(s + ' lv' + lv + ' ' + JSON.stringify(f));
      }
    });
    var a = m.fit(3, 'land', 788, 289, 56);
    C.assertEq(a.w + 'x' + a.h, '10x5');
    C.assertEq(m.fit(3, 'land', 716, 274, 56).h, 4);
  });

  C.test('meiro: めいろは全部つながり、ゴールは行き止まり', function () {
    var m = M();
    for (var lv = 1; lv <= 5; lv++) sizes(lv).forEach(function (sz) {
      for (var n = 0; n < 50; n++) {
        var mz = m.make(lv, sz.w, sz.h, seeded(n * 31 + lv));
        if (Object.keys(reachAll(mz)).length !== sz.w * sz.h) throw new Error('つながらない lv' + lv + ' ' + sz.w + 'x' + sz.h + ' #' + n);
        if (openings(mz, mz.goal).length !== 1) throw new Error('ゴールの入り口 lv' + lv + ' #' + n);
        if (mz.start !== '0,' + (sz.h - 1) || mz.goal !== (sz.w - 1) + ',0') throw new Error('スタート/ゴール');
      }
    });
  });

  C.test('meiro: ほし・かぎ・とびらの置き方', function () {
    var m = M();
    for (var lv = 1; lv <= 5; lv++) sizes(lv).forEach(function (sz) {
      for (var n = 0; n < 50; n++) {
        var mz = m.make(lv, sz.w, sz.h, seeded(n * 17 + lv));
        var wantStars = (lv === 3 || lv === 5) ? 3 : 0, wantKey = lv >= 4;
        if (mz.stars.length !== wantStars) throw new Error('ほしの数 lv' + lv);
        if (!!mz.key !== wantKey || !!mz.door !== wantKey) throw new Error('かぎ/とびら lv' + lv);
        var objs = mz.stars.concat(wantKey ? [mz.key, mz.door] : []);
        var uniq = {}; objs.forEach(function (k) { uniq[k] = 1; });
        if (Object.keys(uniq).length !== objs.length || uniq[mz.start] || uniq[mz.goal]) throw new Error('重なり lv' + lv + ' #' + n);
        if (wantKey) {
          var gp = xy(mz.goal), d = openings(mz, mz.goal)[0];
          if ((gp[0] + DIR[d][0]) + ',' + (gp[1] + DIR[d][1]) !== mz.door) throw new Error('とびらがゴールの入り口でない');
          if (!m.path(mz, mz.start, mz.key, { hasKey: false, starsLeft: 99 })) throw new Error('かぎに行けない lv' + lv + ' #' + n);
        }
      }
    });
  });

  C.test('meiro: canMove', function () {
    var m = M(), mz = m.make(4, 6, 6, seeded(3));
    // 壁の方向
    var s = xy(mz.start), c = mz.cells[s[1]][s[0]];
    ['n', 'e', 's', 'w'].forEach(function (d) { if (!c[d]) C.assertEq(m.canMove(mz, mz.start, d, { hasKey: true, starsLeft: 0 }), null); });
    // とびら：となりのマスから
    var dp = xy(mz.door), into = null, from = null;
    ['n', 'e', 's', 'w'].forEach(function (d) {
      var nx = dp[0] + DIR[d][0], ny = dp[1] + DIR[d][1], k = nx + ',' + ny;
      if (mz.cells[dp[1]][dp[0]][d] && k !== mz.goal && !from) { from = k; into = { n: 's', e: 'w', s: 'n', w: 'e' }[d]; }
    });
    C.assertEq(m.canMove(mz, from, into, { hasKey: false, starsLeft: 0 }), null);
    C.assertEq(m.canMove(mz, from, into, { hasKey: true, starsLeft: 0 }), mz.door);
    // ふた：とびらのマスから ゴールへ
    var gd = openings(mz, mz.goal)[0], back = { n: 's', e: 'w', s: 'n', w: 'e' }[gd];
    C.assertEq(m.canMove(mz, mz.door, back, { hasKey: true, starsLeft: 1 }), null);
    C.assertEq(m.canMove(mz, mz.door, back, { hasKey: true, starsLeft: 0 }), mz.goal);
  });

  C.test('meiro: どのめいろも解ける', function () {
    var m = M();
    for (var lv = 1; lv <= 5; lv++) sizes(lv).forEach(function (sz) {
      for (var n = 0; n < 50; n++) {
        var mz = m.make(lv, sz.w, sz.h, seeded(n * 7 + lv * 3));
        var st = { hasKey: false, starsLeft: mz.stars.length, got: {} }, at = mz.start, steps = 0;
        while (at !== mz.goal) {
          var t = m.nextTarget(mz, at, st), p = m.path(mz, at, t, st);
          if (!p || p.length < 2 || ++steps > 500) throw new Error('解けない lv' + lv + ' ' + sz.w + 'x' + sz.h + ' #' + n + ' at ' + at + ' → ' + t);
          at = p[1];
          if (mz.stars.indexOf(at) >= 0 && !st.got[at]) { st.got[at] = 1; st.starsLeft--; }
          if (at === mz.key) st.hasKey = true;
        }
      }
    });
  });

  C.test('meiro: speakStart', function () {
    var m = M();
    C.assertEq(m.speakStart(1), 'ごはんまで つれていってね');
    C.assertEq(m.speakStart(2), 'ごはんまで つれていってね');
    C.assertEq(m.speakStart(3), 'ほしを 3つ ひろってから、ごはんへ いこう');
    C.assertEq(m.speakStart(4), 'かぎで とびらを あけて、ごはんへ いこう');
    C.assertEq(m.speakStart(5), 'ほし 3つと かぎを ひろって、ごはんへ いこう');
  });

  C.test('meiro: progressFromLogs', function () {
    var m = M();
    C.assertEq(m.progressFromLogs([]).level, 1);
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push({ area: 'meiro', itemId: 'lv1', correct: true, level: 1 });
    C.assertEq(m.progressFromLogs(logs).level, 2);
  });

  /* ---------- 画面（テストのページには #app が無いので、状態だけ動く） ---------- */
  var PID = 'test-meiro';
  function withLogs(logs, fn) {   // 記録の読み書きを、テストの中だけ差しかえる
    var S = C.storage, og = S.getLogs, ol = S.logAnswer, saved = [];
    S.getLogs = function () { return Promise.resolve(logs || []); };
    S.logAnswer = function (o) { saved.push(o); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); })
      .then(function (v) { S.getLogs = og; S.logAnswer = ol; return v; }, function (e) { S.getLogs = og; S.logAnswer = ol; throw e; });
  }
  function solveNow(m) {   // いまの めいろを、道どおりに ゴールまで進める
    for (var guard = 0; guard < 600 && !m._state().done; guard++) {
      var s = m._state(), st = { hasKey: s.hasKey, starsLeft: s.maze.stars.length - Object.keys(s.got).length, got: s.got };
      var p = m.path(s.maze, s.at, m.nextTarget(s.maze, s.at, st), st);
      m._moveToward(p[1]);
    }
  }

  C.test('meiro: start でレベル1のめいろ', function () {
    var m = M();
    return withLogs([], function () {
      return m.start(PID).then(function () {
        var s = m._state();
        C.assertEq(s.level, 1); C.assertEq(s.round, 1); C.assertEq(s.phase, 'play'); C.assertEq(s.at, s.maze.start);
      });
    });
  });

  C.test('meiro: 壁の方へは進まない', function () {
    var m = M();
    return withLogs([], function () {
      return m.start(PID).then(function () {
        var s = m._state(), p = xy(s.at), c = s.maze.cells[p[1]][p[0]];
        ['n', 'e', 's', 'w'].forEach(function (d) {
          var nx = p[0] + DIR[d][0], ny = p[1] + DIR[d][1];
          if (c[d] || nx < 0 || ny < 0 || nx >= s.maze.w || ny >= s.maze.h) return;
          m._moveToward(nx + ',' + ny);
          C.assertEq(m._state().at, s.maze.start);
        });
      });
    });
  });

  C.test('meiro: 板の外へ指を出しても 止まるだけ', function () {
    var m = M();
    return withLogs([], function () {
      return m.start(PID).then(function () {
        var at = m._state().at;
        m._moveToward(null); m._moveToward('99,99'); m._moveToward('-1,0');
        C.assertEq(m._state().at, at);
      });
    });
  });

  C.test('meiro: ゴールは1回だけ記録する', function () {
    var m = M();
    return withLogs([], function (saved) {
      return m.start(PID).then(function () {
        solveNow(m);
        C.assertEq(m._state().done, true);
        var s = m._state();
        m._moveToward(s.maze.start); m._moveToward(s.maze.goal);
        C.assertEq(saved.length, 1);
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct, saved[0].level]), JSON.stringify(['meiro', 'lv1', true, 1]));
      });
    });
  });

  C.test('meiro: ヒントが出たら まちがい', function () {
    var m = M();
    return withLogs([], function (saved) {
      return m.start(PID).then(function () {
        m._idle(5); C.assertEq(m._state().hinted, false);
        m._idle(1); C.assertEq(m._state().hinted, true);
        solveNow(m);
        C.assertEq(saved[0].correct, false);
      });
    });
  });

  C.test('meiro: 3つで ごほうび', function () {
    var m = M();
    return withLogs([], function (saved) {
      return m.start(PID).then(function () {
        for (var i = 0; i < 3; i++) { solveNow(m); if (i < 2) { m._next(); C.assertEq(m._state().round, i + 2); } }
        m._next();
        C.assertEq(m._state().phase, 'reward');
        C.assertEq(saved.length, 3);
      });
    });
  });

  C.test('meiro: 時間を超えていたら つぎのめいろの前に お休み', function () {
    var m = M(), T = C.timer, orig = T.isOver;
    return withLogs([], function () {
      return m.start(PID).then(function () {
        solveNow(m);
        T.isOver = function () { return true; };
        try { m._next(); } finally { T.isOver = orig; }
        C.assertEq(m._state().phase, 'rest');
      });
    });
  });

  C.test('meiro: 親画面に「めいろ」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/meiro: 'めいろ'/.test(t), true);
    });
  });

  /* ---------- 知育のホーム（2ページ） ---------- */
  C.test('home: 並びとページ', function () {
    var H = C.chiikuHome;
    C.assertEq(H.PER_PAGE, 6);
    C.assertEq(H.pageCount(), 2);
    C.assertEq(H.kinds(0).join(','), 'hira,kazu,tokei,iro,machi,kai');
    C.assertEq(H.kinds(1).join(','), 'sr,dou,meiro');
  });

  C.test('home: 遊びのあるページを返す', function () {
    var H = C.chiikuHome;
    C.assertEq(H.pageOf('meiro'), 1); C.assertEq(H.pageOf('sr'), 1); C.assertEq(H.pageOf('hira'), 0);
    C.assertEq(H.pageOf('nanika'), 0);
  });

  C.test('home: めいろのカードがある', function () {
    return fetch('../app-chiiku/game.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(t.indexOf("playCard('めいろ', 'meiro', function () { C.meiro.start(p.id); });") >= 0, true);
    });
  });

  /* ---------- 最後のチェックで見つかった点 ---------- */
  C.test('meiro: 2本目の指（てのひら）は ひよこを動かさず、引っぱりも止めない', function () {
    var m = M();
    return withLogs([], function () {
      return m.start(PID).then(function () {
        var s = m._state(), mz = s.maze, st0 = { hasKey: true, starsLeft: 0, got: {} };
        var p = m.path(mz, mz.start, mz.goal, { hasKey: true, starsLeft: 0 }) || [mz.start];
        m._down(1, mz.start);                        // 1本目：ひよこのマス
        m._down(2, mz.goal);                         // 2本目（はなれた所）：無視
        m._move(2, p[1]);                            // 2本目の動きでは 動かない
        C.assertEq(m._state().at, mz.start);
        m._up(2);                                    // 2本目をはなしても、1本目の引っぱりは つづく
        m._move(1, p[1]);
        C.assertEq(m._state().at, p[1]);
        m._up(1);
        m._move(1, p[2] || p[1]);                    // はなしたあとは 動かない
        C.assertEq(m._state().at, p[1]);
      });
    });
  });

  C.test('home: ページの場所は 横のスワイプを ブラウザに取られない（touch-action: pan-y）', function () {
    return fetch('../app-chiiku/app.css').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/\.home-pager \{[^}]*touch-action: pan-y/.test(t), true);
    });
  });
})();
