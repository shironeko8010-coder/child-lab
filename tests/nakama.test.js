/* なかまわけ（知育）のテスト。設計書：docs/superpowers/specs/2026-11-27-chiiku-nakama-design.md */
(function () {
  'use strict';
  var C = window.Chiid;
  function N() { return C.nakama; }
  var PID = 'p-nakama';
  function seeded(n) { var s = n; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function withLogs(logs, fn) {
    var S = C.storage, og = S.getLogs, ol = S.logAnswer, saved = [];
    S.getLogs = function () { return Promise.resolve(logs); };
    S.logAnswer = function (e) { saved.push(e); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { S.getLogs = og; S.logAnswer = ol; return v; }, function (e) { S.getLogs = og; S.logAnswer = ol; throw e; });
  }
  function item(id) { return N().ITEMS.filter(function (it) { return it.id === id; })[0]; }
  // いまの 問題を ぜんぶ 正しく 入れる
  function solve() { var n = N(), q = n._state().q; q.items.forEach(function (it, i) { n._drop(i, it.answer); }); n._flush(); }

  C.test('nakama: 定数（3レベル、5問で ごほうび、分け方は5つ）', function () {
    var n = N();
    C.assertEq(n.AREA, 'nakama'); C.assertEq(n.MAX_LEVEL, 3); C.assertEq(n.ROUND, 5);
    C.assertEq(n.RULE_TYPES, ['mono', 'iro', 'tobu', 'taberu', 'ookisa']);
  });

  C.test('nakama: 絵は45まい。名前は ひらがな、画像は img/nakama/○○.jpg、なかまの 決まりを 守る', function () {
    var n = N(), bad = [];
    C.assertEq(n.ITEMS.length, 45);
    var ids = n.ITEMS.map(function (it) { return it.id; });
    C.assertEq(ids.filter(function (x, i) { return ids.indexOf(x) === i; }).length, 45);
    n.ITEMS.forEach(function (it) {
      if (!/^[ぁ-ゖー]+$/.test(it.name)) bad.push(it.id + ' 名前');
      if (['kudamono', 'yasai', 'doubutsu', 'umi', 'norimono', 'mushi'].indexOf(it.cat) < 0) bad.push(it.id + ' cat');
      if (it.cat === 'umi' && it.eat !== null) bad.push(it.id + ' うみは たべる問題に 出さない');
      if ((it.cat === 'kudamono' || it.cat === 'yasai') && it.eat !== true) bad.push(it.id + ' eat');
    });
    if (bad.length) throw new Error(bad.slice(0, 5).join(' / '));
    C.assertEq(item('kabutomushi').fly, null);
    C.assertEq(item('zou').size, 'big'); C.assertEq(item('ari').size, 'small'); C.assertEq(item('inu').size, null);
    C.assertEq(n.imgSrc(item('ringo')), 'img/nakama/ringo.jpg');
  });

  C.test('nakama: makeQuestion は レベルどおりの 数。どの絵も 答えの かごが 1つ、見本は かごの なかま', function () {
    var n = N(), bad = [];
    [1, 2, 3].forEach(function (lv) {
      n.RULE_TYPES.forEach(function (rt) {
        for (var i = 0; i < 25; i++) {
          var q = n.makeQuestion(lv, seeded(lv * 1000 + i * 7 + rt.length), rt);
          var k = (lv === 3 && (rt === 'mono' || rt === 'iro')) ? 3 : 2;
          if (q.rule !== rt) bad.push('rule');
          if (q.baskets.length !== k) bad.push(lv + rt + ' かご' + q.baskets.length);
          if (q.items.length !== (lv === 1 ? 4 : 6)) bad.push(lv + rt + ' 絵' + q.items.length);
          if (q.think !== (lv === 3)) bad.push('think');
          var key = n.RULES[rt].key, used = {};
          q.baskets.forEach(function (b, bi) {
            if (b.example[key] !== b.value) bad.push(rt + ' 見本');
            used[b.example.id] = 1;
            if (!q.items.some(function (it) { return it.answer === bi; })) bad.push(lv + rt + ' からの かご');
          });
          q.items.forEach(function (it) {
            if (used[it.id]) bad.push('同じ絵 ' + it.id); used[it.id] = 1;
            if (it[key] !== q.baskets[it.answer].value) bad.push(rt + ' 答え ' + it.id);
          });
          // レベル1の「もの」は にている なかま どうしに しない、レベル2は にている なかま どうし
          if (rt === 'mono' && lv < 3) {
            var pair = q.baskets.map(function (b) { return b.value; }).sort().join('+');
            var near = n.NEAR.map(function (p) { return p.slice().sort().join('+'); }).indexOf(pair) >= 0;
            if (lv === 1 && near) bad.push('lv1 near ' + pair);
            if (lv === 2 && !near) bad.push('lv2 far ' + pair);
          }
          if (lv === 3 && n.isAmbiguous(q)) bad.push('lv3 ambiguous ' + rt);
        }
      });
    });
    if (bad.length) throw new Error(bad.slice(0, 6).join(' / '));
  });

  C.test('nakama: isAmbiguous は ほかの 分け方でも 分けられる ときに true', function () {
    var n = N();
    function q(rule, groups) {
      return { rule: rule, baskets: groups.map(function (g) { return { example: item(g[0]) }; }),
        items: [].concat.apply([], groups.map(function (g, bi) { return g.slice(1).map(function (id) { var it = Object.assign({}, item(id)); it.answer = bi; return it; }); })) };
    }
    // たべられる／たべられない なのに、くだもの と どうぶつ だけ → 「もの」でも 分けられる
    C.assertEq(n.isAmbiguous(q('taberu', [['ringo', 'banana', 'mikan'], ['inu', 'neko', 'usagi']])), true);
    // やさい と のりもの が まざると「もの」では 分けられない
    C.assertEq(n.isAmbiguous(q('taberu', [['ringo', 'tomato', 'mikan'], ['inu', 'kuruma', 'ari']])), false);
  });

  C.test('nakama: 文（分け方・入れたとき・かごの名前）は ひらがな', function () {
    var n = N();
    C.assertEq(['mono', 'iro', 'tobu', 'taberu', 'ookisa'].map(function (r) { return n.ruleText(r); }),
      ['なかまに わけよう！', 'いろで わけよう！', 'そらを とぶかな？ とばないかな？', 'たべられるかな？ たべられないかな？', 'おおきいかな？ ちいさいかな？']);
    C.assertEq(n.TEXT.think, 'かごの なかを みて、なかまを かんがえてね');
    C.assertEq(n.placeText(item('ringo'), { label: 'くだもの' }), 'りんごは くだもの！');
    C.assertEq(n.label('tobu', false), 'とばない');
    C.assertEq(n.label('mono', 'umi'), 'うみの いきもの');
    C.assertEq(n.label('iro', 'kiiro'), 'きいろ');
  });

  C.test('nakama: 正しい かごで 入る、ちがう かごは もどる。まちがいが あると 記録は false', function () {
    var n = N();
    return withLogs([], function (saved) {
      return n.start(PID, 1).then(function () {
        var q = n._state().q;
        C.assertEq(n._state().phase, 'play');
        var wrong = (q.items[0].answer + 1) % q.baskets.length;
        n._drop(0, wrong);
        C.assertEq(n._state().misses, 1); C.assertEq(n._state().placed[0], false);
        n._drop(0, q.items[0].answer);
        C.assertEq(n._state().placed[0], true);
        q.items.forEach(function (it, i) { if (i) n._drop(i, it.answer); });
        C.assertEq(n._state().phase, 'done');
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct]), JSON.stringify(['nakama', q.rule, false]));
      });
    });
  });

  C.test('nakama: 5問で ごほうび。1回分で 5つの 分け方が 1回ずつ', function () {
    var n = N();
    return withLogs([], function (saved) {
      return n.start(PID, 2).then(function () {
        for (var i = 0; i < 5; i++) solve();
        C.assertEq(n._state().phase, 'reward');
        C.assertEq(saved.map(function (e) { return e.itemId; }).sort(), ['iro', 'mono', 'ookisa', 'taberu', 'tobu']);
        C.assertEq(saved.every(function (e) { return e.correct; }), true);
      });
    });
  });

  C.test('nakama: ホーム・親画面・カードの色・PRECACHE（絵45まい・かご・背景）', function () {
    var n = N();
    C.assertEq(C.chiikuHome.ORDER.indexOf('nakama') >= 0, true);
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/nakama: 'なかまわけ'/.test(t), true);
      return fetch('../app-chiiku/app.css');
    }).then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/\.hc-nakama \{ background:/.test(t), true);
      return fetch('../sw.js');
    }).then(function (r) { return r.text(); }).then(function (t) {
      var need = ['app-chiiku/nakama.js', 'app-chiiku/img/nakama/kago.png', 'app-chiiku/img/nakama/bg.jpg'].concat(n.ITEMS.map(function (it) { return 'app-chiiku/' + n.imgSrc(it); }));
      var miss = need.filter(function (f) { return t.indexOf("'" + f + "'") < 0; });
      if (miss.length) throw new Error('PRECACHE にない: ' + miss.slice(0, 4).join(', '));
    });
  });
})();
