/* てんつなぎ（知育）のテスト。設計書：docs/superpowers/specs/2026-11-27-chiiku-tentsunagi-design.md */
(function () {
  'use strict';
  var C = window.Chiid;
  function T() { return C.tentsunagi; }
  var PID = 'p-ten';
  function seeded(n) { var s = n; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function withLogs(logs, fn) {
    var S = C.storage, og = S.getLogs, ol = S.logAnswer, saved = [];
    S.getLogs = function () { return Promise.resolve(logs); };
    S.logAnswer = function (e) { saved.push(e); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { S.getLogs = og; S.logAnswer = ol; return v; }, function (e) { S.getLogs = og; S.logAnswer = ol; throw e; });
  }
  // いまの 絵を さいごまで つなぐ
  function finish() { var t = T(), s = t._state(); for (var i = s.next; i < s.pic.pts.length; i++) t._tapDot(i); t._flush(); }

  C.test('tentsunagi: 定数（3レベル、5問で ごほうび、当たりは 半径30）', function () {
    var t = T();
    C.assertEq(t.AREA, 'tentsunagi'); C.assertEq(t.MAX_LEVEL, 3); C.assertEq(t.ROUND, 5); C.assertEq(t.HIT_R, 30);
    C.assertEq(t.BGS, ['umi', 'sora', 'nohara']);
  });

  C.test('tentsunagi: 絵は 各レベル4つ、点の数は 5〜7／9〜10／12〜14、名前は ひらがな', function () {
    var t = T(), range = { 1: [5, 7], 2: [9, 10], 3: [12, 14] }, bad = [];
    var ids = t.PICS.map(function (p) { return p.id; });
    C.assertEq(ids.filter(function (x, i) { return ids.indexOf(x) === i; }).length, 12);
    [1, 2, 3].forEach(function (lv) {
      var list = t.PICS.filter(function (p) { return p.level === lv; });
      if (list.length !== 4) bad.push('lv' + lv + ' ' + list.length + 'まい');
      list.forEach(function (p) {
        var n = p.pts.length;
        if (n < range[lv][0] || n > range[lv][1]) bad.push(p.id + ' 点' + n);
        if (!/^[ぁ-ゖー]+$/.test(p.name)) bad.push(p.id + ' 名前 ' + p.name);
        if (t.BGS.indexOf(p.bg) < 0) bad.push(p.id + ' bg');
        if (!/^#[0-9a-f]{6}$/.test(p.fill)) bad.push(p.id + ' 色');
        p.pts.forEach(function (q, i) {
          if (q[0] < 25 || q[0] > 375 || q[1] < 25 || q[1] > 275) bad.push(p.id + ' 点' + (i + 1) + ' はみ出し');
          // 点どうしが 近すぎると 押しわけられない
          p.pts.forEach(function (r, j) { if (j > i && Math.hypot(q[0] - r[0], q[1] - r[1]) < 38) bad.push(p.id + ' 点' + (i + 1) + 'と' + (j + 1) + ' 近い'); });
        });
      });
    });
    if (bad.length) throw new Error(bad.slice(0, 6).join(' / '));
  });

  C.test('tentsunagi: makeQuestion は そのレベルの 絵から、さっき出た 絵を さけて えらぶ', function () {
    var t = T();
    [1, 2, 3].forEach(function (lv) {
      for (var i = 0; i < 30; i++) {
        var p = t.makeQuestion(lv, seeded(lv * 100 + i), ['ie', 'kasa', 'neko']);
        C.assertEq(p.level, lv);
        C.assertEq(['ie', 'kasa', 'neko'].indexOf(p.id) < 0, true);
      }
    });
    // ぜんぶ さけると えらべないときは、さけずに えらぶ
    C.assertEq(t.makeQuestion(1, seeded(1), ['ie', 'heart', 'sakana', 'fune']).level, 1);
  });

  C.test('tentsunagi: hitDot は いちばん近い点（半径30の中）', function () {
    var pts = [[100, 100], [150, 100], [300, 200]];
    C.assertEq(T().hitDot(pts, 100, 100), 0);
    C.assertEq(T().hitDot(pts, 128, 100), 1);
    C.assertEq(T().hitDot(pts, 300, 229), 2);
    C.assertEq(T().hitDot(pts, 300, 231), -1);
    C.assertEq(T().hitDot(pts, 220, 150), -1);
  });

  C.test('tentsunagi: tapResult（次の点は next、ちがう点は タッチだけ miss、なぞりや つないだ点は none）', function () {
    var t = T(), pts = [[60, 60], [200, 60], [340, 60], [200, 220]];
    C.assertEq(t.tapResult(pts, 1, 200, 60, false), 'next');
    C.assertEq(t.tapResult(pts, 1, 200, 60, true), 'next');
    C.assertEq(t.tapResult(pts, 1, 340, 60, false), 'miss');
    C.assertEq(t.tapResult(pts, 1, 340, 60, true), 'none');
    C.assertEq(t.tapResult(pts, 2, 60, 60, false), 'none');    // もう つないだ点
    C.assertEq(t.tapResult(pts, 1, 120, 160, false), 'none');  // 点のない ところ
  });

  C.test('tentsunagi: 数の よみと 文は ひらがな', function () {
    var t = T();
    C.assertEq([1, 2, 3, 4, 7, 9, 10, 14].map(t.numYomi), ['いち', 'に', 'さん', 'よん', 'なな', 'きゅう', 'じゅう', 'じゅうよん']);
    C.assertEq(t.TEXT.choose, 'どれに する？');
    C.assertEq(t.TEXT.ask, '1から じゅんばんに つないでね');
    C.assertEq(t.nextText(3), 'つぎは さん だよ');
    C.assertEq(t.doneText({ name: 'さかな' }), 'さかな だったね！');
    C.assertEq(t.TEXT.reward, 'すごい！ よく できたね');
  });

  C.test('tentsunagi: picSvg は 背景・点・番号を 描き、つないだ ぶんだけ 線を 引く', function () {
    var t = T(), p = t.PICS[0];
    var s = t.picSvg(p, 3, false);
    C.assertEq(/^<svg viewBox="0 0 400 300"/.test(s), true);
    C.assertEq(s.indexOf('href="img/tentsunagi/' + p.bg + '.jpg"') >= 0, true);
    C.assertEq((s.match(/class="tn-dot( |")/g) || []).length, p.pts.length);
    C.assertEq((s.match(/class="tn-line"/g) || []).length, 2);         // 1→2、2→3
    C.assertEq(s.indexOf('tn-fill') < 0, true);
    var d = t.picSvg(p, p.pts.length, true);                            // 完成：閉じて 色を ぬる
    C.assertEq((d.match(/class="tn-line"/g) || []).length, p.pts.length);
    C.assertEq(d.indexOf('class="tn-fill"') >= 0, true);
    t.PICS.forEach(function (q) { t.picSvg(q, q.pts.length, true); });  // すべての絵が 描ける
  });

  C.test('tentsunagi: start(PID, 2) は レベル2の絵。つなぐと 次の点へ、さいごで 完成', function () {
    var t = T();
    return withLogs([], function (saved) {
      return t.start(PID, 2).then(function () {
        var s = t._state();
        C.assertEq(s.phase, 'play'); C.assertEq(s.level, 2); C.assertEq(s.pic.level, 2); C.assertEq(s.next, 1);  // 1の点は 始めから つないだ ことに する
        t._tapDot(1);
        C.assertEq(t._state().next, 2);
        for (var i = 2; i < s.pic.pts.length; i++) t._tapDot(i);
        C.assertEq(t._state().phase, 'done');
        C.assertEq(saved.length, 1);
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct, saved[0].level]), JSON.stringify(['tentsunagi', s.pic.id, true, 2]));
        t._flush();
        C.assertEq(t._state().phase, 'play'); C.assertEq(t._state().done, 1);
      });
    });
  });

  C.test('tentsunagi: ちがう点を タッチすると まちがい1回。その問題の 記録は false', function () {
    var t = T();
    return withLogs([], function (saved) {
      return t.start(PID, 1).then(function () {
        t._tapDot(3);
        C.assertEq(t._state().misses, 1); C.assertEq(t._state().next, 1);
        finish();
        C.assertEq(saved[0].correct, false);
      });
    });
  });

  C.test('tentsunagi: 5問で ごほうび。start(PID) は 記録の レベル', function () {
    var t = T();
    var logs = [1, 2, 3, 4, 5].map(function () { return { area: 'tentsunagi', itemId: 'ie', correct: true, level: 1 }; });
    return withLogs(logs, function (saved) {
      return t.start(PID).then(function () {
        C.assertEq(t._state().level, 2);   // 5回つづけて できたので 上がる
        for (var i = 0; i < 5; i++) finish();
        C.assertEq(t._state().phase, 'reward'); C.assertEq(saved.length, 5);
      });
    });
  });

  C.test('tentsunagi: ホーム・親画面・カードの色・PRECACHE', function () {
    C.assertEq(C.chiikuHome.ORDER[C.chiikuHome.ORDER.length - 1], 'ten');
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/tentsunagi: 'てんつなぎ'/.test(t), true);
      return fetch('../app-chiiku/app.css');
    }).then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/\.hc-ten \{ background:/.test(t), true);
      return fetch('../sw.js');
    }).then(function (r) { return r.text(); }).then(function (t) {
      ['app-chiiku/tentsunagi.js'].concat(T().BGS.map(function (b) { return 'app-chiiku/img/tentsunagi/' + b + '.jpg'; })).forEach(function (f) {
        if (t.indexOf("'" + f + "'") < 0) throw new Error(f + ' が PRECACHE にない');
      });
    });
  });
})();
