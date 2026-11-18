/* きおく（知育・カードめくり）のテスト。設計書：docs/superpowers/specs/2026-11-18-chiiku-kioku-design.md */
(function () {
  'use strict';
  var C = window.Chiid;
  function K() { return C.kioku; }
  var PID = 'p-kioku';
  function seeded(n) { var s = n; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function withLogs(logs, fn) {
    var S = C.storage, og = S.getLogs, ol = S.logAnswer, saved = [];
    S.getLogs = function () { return Promise.resolve(logs); };
    S.logAnswer = function (e) { saved.push(e); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { S.getLogs = og; S.logAnswer = ol; return v; }, function (e) { S.getLogs = og; S.logAnswer = ol; throw e; });
  }
  // 絵ごとに 2まいの 場所
  function pairs(cards) {
    var m = {};
    cards.forEach(function (c, i) { (m[c] = m[c] || []).push(i); });
    return Object.keys(m).map(function (k) { return m[k]; });
  }
  function solve(k, misses) {   // misses 回 はずしてから ぜんぶ そろえる
    var s = k._state(), ps = pairs(s.cards);
    for (var i = 0; i < misses; i++) { k._flip(ps[0][0]); k._flip(ps[1][0]); k._flush(); }
    ps.forEach(function (p) { k._flip(p[0]); k._flip(p[1]); k._flush(); });
  }

  C.test('kioku: 定数（5レベル、6・10・16・24・36まい、はじめに見せる 2・2・4・4・4秒）', function () {
    var k = K();
    C.assertEq(k.AREA, 'kioku'); C.assertEq(k.MAX_LEVEL, 5);
    C.assertEq(JSON.stringify(k.PREVIEW_MS), JSON.stringify([2000, 2000, 4000, 4000, 4000]));
    C.assertEq(JSON.stringify(k.COUNTS), JSON.stringify([6, 10, 16, 24, 36]));
    C.assertEq(k.PICS.length >= 18, true);
    C.assertEq(k.PICS.filter(function (p, i) { return k.PICS.indexOf(p) === i; }).length, k.PICS.length);
  });
  C.test('kioku: deal はレベルの まい数で、どの絵も ちょうど2まい', function () {
    var k = K();
    [1, 2, 3, 4, 5].forEach(function (lv) {
      var cards = k.deal(lv, seeded(lv));
      C.assertEq(cards.length, k.COUNTS[lv - 1]);
      pairs(cards).forEach(function (p) { if (p.length !== 2) throw new Error('lv' + lv + ' ' + p.length); });
      C.assertEq(pairs(cards).length, k.COUNTS[lv - 1] / 2);
    });
  });
  C.test('kioku: isCorrect は はずした回数が 組の数 以下なら true', function () {
    var k = K();
    C.assertEq(k.isCorrect(3, 3), true); C.assertEq(k.isCorrect(4, 3), false); C.assertEq(k.isCorrect(0, 18), true);
  });
  C.test('kioku: layout は 8つの画面 × 5レベルで カード48px以上、はみ出さない', function () {
    var k = K(), bad = [];
    // 板の広さ（画面から 上の帯と すきまを ひいた ていど）
    [[667, 375], [740, 360], [812, 375], [375, 667], [360, 740], [390, 844], [1280, 800], [1024, 600]].forEach(function (sz) {
      var w = sz[0] - 24, h = sz[1] - 86;
      k.COUNTS.forEach(function (n) {
        var L = k.layout(n, w, h, 6);
        if (L.cols * L.rows < n || L.cell < 48 || L.cols * L.cell + (L.cols - 1) * 6 > w + 0.5 || L.rows * L.cell + (L.rows - 1) * 6 > h + 0.5) bad.push(sz.join('x') + ' n' + n + ' ' + JSON.stringify(L));
      });
    });
    if (bad.length) throw new Error(bad.slice(0, 4).join(' / '));
  });
  C.test('kioku: progressFromLogs', function () {
    var k = K();
    C.assertEq(k.progressFromLogs([]).level, 1);
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push({ area: 'kioku', level: 2, correct: true });
    C.assertEq(k.progressFromLogs(logs).level >= 2, true);
  });

  C.test('kioku: start(PID) は 記録の レベル、start(PID, 4) は レベル4', function () {
    var k = K();
    return withLogs([], function () {
      return k.start(PID).then(function () {
        var s = k._state();
        C.assertEq(s.phase, 'play'); C.assertEq(s.level, 1); C.assertEq(s.cards.length, 6); C.assertEq(s.round, 1);
        return k.start(PID, 4);
      }).then(function () {
        C.assertEq(k._state().level, 4); C.assertEq(k._state().cards.length, 24);
      });
    });
  });
  C.test('kioku: 同じ絵なら そろって残る、ちがう絵は もどる、見せている間は めくれない', function () {
    var k = K();
    return withLogs([], function () {
      return k.start(PID, 1).then(function () {
        var ps = pairs(k._state().cards);
        k._flip(ps[0][0]); k._flip(ps[1][0]);                 // ちがう絵
        C.assertEq(k._state().open.length, 2);
        k._flip(ps[2][0]);                                    // 見せている間は めくれない
        C.assertEq(k._state().open.length, 2);
        k._flush();                                           // うらに もどる
        C.assertEq(k._state().open.length, 0); C.assertEq(k._state().misses, 1);
        k._flip(ps[0][0]); k._flip(ps[0][0]);                 // 同じカードを2回は めくれない
        C.assertEq(k._state().open.length, 1);
        k._flip(ps[0][1]); k._flush();                        // 同じ絵
        C.assertEq(k._state().matched.length, 2); C.assertEq(k._state().open.length, 0);
        k._flip(ps[0][0]);                                    // そろったカードは めくれない
        C.assertEq(k._state().open.length, 0);
      });
    });
  });
  C.test('kioku: ぜんぶ そろえると 記録1件（はずしが 組の数以下なら true）', function () {
    var k = K();
    return withLogs([], function (saved) {
      return k.start(PID, 1).then(function () {
        solve(k, 1);
        C.assertEq(k._state().done, true);
        C.assertEq(saved.length, 1);
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct, saved[0].level]), JSON.stringify(['kioku', 'lv1', true, 1]));
        return k.start(PID, 1);
      }).then(function () {
        solve(k, 4);
        C.assertEq(saved[1].correct, false);
      });
    });
  });
  C.test('kioku: ぜんぶ そろえたら ごほうび、つぎへで 新しい ばん', function () {
    var k = K();
    return withLogs([], function (saved) {
      return k.start(PID, 1).then(function () {
        solve(k, 0); k._next();
        C.assertEq(k._state().phase, 'reward');
        C.assertEq(saved.length, 1);
        k._again();
        C.assertEq(k._state().phase, 'play'); C.assertEq(k._state().matched.length, 0);
      });
    });
  });
  C.test('kioku: 遊んでいる途中では 止めず、ごほうびの あと「つぎへ」で 時間を こえていたら お休み', function () {
    var k = K(), T = C.timer, orig = T.isOver;
    return withLogs([], function () {
      return k.start(PID, 1).then(function () {
        T.isOver = function () { return true; };
        try { solve(k, 0); k._next(); C.assertEq(k._state().phase, 'reward'); k._again(); } finally { T.isOver = orig; }
        C.assertEq(k._state().phase, 'rest');
      });
    });
  });
  C.test('kioku: 読み上げの文', function () {
    var T = K().TEXT;
    C.assertEq(JSON.stringify([T.choose, T.start, T.preview, T.match, T.clear, T.reward]),
      JSON.stringify(['どれに する？', 'おなじ えを 2まい さがそう', 'よく みて おぼえてね', 'そろったね！', 'ぜんぶ そろったね！', 'すごい！ よく おぼえたね']));
  });
  C.test('kioku: 親画面と ホームに「きおく」がある', function () {
    C.assertEq(C.chiikuHome.ORDER.indexOf('kioku') >= 0, true);
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) { C.assertEq(/kioku: 'きおく'/.test(t), true); });
  });

  /* 2026-11-19 の直し：ならびに はんぱを 出さない・ヒント・ホームの カードの 色 */
  C.test('kioku: layout は どの画面・まい数でも 最後の 段が はんぱに ならない', function () {
    var k = K(), bad = [];
    [[667, 375], [740, 360], [812, 375], [375, 667], [360, 740], [390, 844], [1280, 800], [1024, 600]].forEach(function (sz) {
      var w = sz[0] - 24, h = sz[1] - 86;
      k.COUNTS.forEach(function (n) {
        var L = k.layout(n, w, h, 6);
        if (n % L.cols !== 0) bad.push(sz.join('x') + ' n' + n + ' cols' + L.cols);
      });
    });
    if (bad.length) throw new Error(bad.slice(0, 4).join(' / '));
  });
  C.test('kioku: ヒントで ぜんぶ 見え、おわると もどる（はずし1回と 数える）。そろった カードは そのまま', function () {
    var k = K();
    return withLogs([], function () {
      return k.start(PID, 1).then(function () {
        var ps = pairs(k._state().cards);
        k._flip(ps[0][0]); k._flip(ps[0][1]); k._flush();     // 1組 そろえる
        k._hint();
        C.assertEq(k._state().peek, true);
        k._flip(ps[1][0]);                                     // 見せている間は めくれない
        C.assertEq(k._state().open.length, 0);
        k._flush();
        C.assertEq(k._state().peek, false); C.assertEq(k._state().misses, 1);
        C.assertEq(k._state().matched.length, 2);
        k._flip(ps[1][0]); k._hint();                           // 1まい めくっている ときは ヒントを 出さない
        C.assertEq(k._state().peek, false);
      });
    });
  });
  C.test('kioku: ホームの「きおく」の カードに 色が ある', function () {
    return fetch('../app-chiiku/app.css').then(function (r) { return r.text(); }).then(function (t) { C.assertEq(/\.hc-kioku \{ background:/.test(t), true); });
  });
})();
