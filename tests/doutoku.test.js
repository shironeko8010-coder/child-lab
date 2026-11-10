/* 知育「どうとく」（app-chiiku/doutoku.js）のテスト */
(function () {
  'use strict';
  var C = window.Chiid;
  var D = C.chiikuDoutoku;
  var KANA = /^[ぁ-ゖー 、。！？「」]+$/;   // 園児が見る・聞く文は ひらがなと記号だけ
  function seq(vals) { var i = 0; return function () { return vals[(i++) % vals.length]; }; }

  C.test('doutoku: 定数と場面の数（ふつう25・あなたなら4）', function () {
    C.assertEq(D.AREA, 'doutoku');
    C.assertEq(D.ROUND_SIZE, 5);
    C.assertEq(D.SCENES.length, 25);
    C.assertEq(D.OPEN.length, 4);
    var ids = D.SCENES.concat(D.OPEN).map(function (s) { return s.id; });
    C.assertEq(ids.filter(function (x, i) { return ids.indexOf(x) === i; }).length, 29);
    ids.forEach(function (id) { C.assertEq(D.sceneById(id).id, id); });
    C.assertEq(D.sceneById('nai'), null);
  });

  C.test('doutoku: ふつうの場面は2択で、のぞましいほうが1つ。あなたならの場面は正解なし', function () {
    D.SCENES.forEach(function (s) {
      C.assertEq(s.choices.length, 2);
      C.assertEq(s.choices.filter(function (c) { return c.good; }).length, 1);
      C.assertEq(!!s.open, false);
    });
    D.OPEN.forEach(function (s) {
      C.assertEq(s.choices.length, 2);
      C.assertEq(s.choices.filter(function (c) { return c.good; }).length, 0);
      C.assertEq(s.open, true);
    });
  });

  C.test('doutoku: 文・選択肢・返事は ひらがなだけ', function () {
    D.SCENES.concat(D.OPEN).forEach(function (s) {
      [s.text].concat(s.choices.map(function (c) { return c.text; }), s.choices.map(function (c) { return D.replyFor(s, c); }))
        .forEach(function (t) {
          if (!t || !KANA.test(t)) throw new Error(s.id + ': ' + t);
        });
    });
    C.assertEq(KANA.test(D.OPEN_TAIL), true);
  });

  C.test('doutoku: やまとさんが決めた言葉が入っている', function () {
    var g = D.sceneById('gomenne');
    C.assertEq(g.choices.filter(function (c) { return !c.good; })[0].reply, 'かくすと、ともだちは かなしいかも。「ごめんね」って いえたら、すてきだね。');
    var sh = D.sceneById('shiranai').choices.filter(function (c) { return c.good; })[0];
    C.assertEq(sh.text, '「いかない！」と おおきな こえで いって、にげる');
    C.assertEq(/おうちで/.test(D.sceneById('gomi').text), true);
    ['onee-omocha', 'onee-papa', 'fuku', 'osara', 'kushami'].forEach(function (id) {
      if (!D.sceneById(id)) throw new Error('ない: ' + id);
    });
    // ゆずったあとに「つぎは あなたの ばん」と伝える
    C.assertEq(/つぎは あなたの ばん/.test(D.sceneById('onee-omocha').choices.filter(function (c) { return c.good; })[0].reply), true);
  });

  C.test('doutoku: replyFor は あなたならの場面だけ「おうちの ひとは どうするかな？」を足す', function () {
    var s = D.sceneById('ohayou');
    C.assertEq(D.replyFor(s, s.choices[0]), s.choices[0].reply);
    var o = D.sceneById('hitotsu');
    C.assertEq(D.replyFor(o, o.choices[1]), o.choices[1].reply + ' ' + D.OPEN_TAIL);
    C.assertEq(D.OPEN_TAIL, 'おうちの ひとは どうするかな？ きいてみてね。');
  });

  C.test('doutoku: progressFromLogs は どうとくの記録だけで、見た回数と もう一方の回数を数える', function () {
    var p = D.progressFromLogs([
      { area: 'doutoku', itemId: 'ohayou', correct: true, level: 1 },
      { area: 'doutoku', itemId: 'ohayou', correct: false, level: 1 },
      { area: 'doutoku', itemId: 'douro', correct: false, level: 1 },
      { area: 'doutoku_b', itemId: 'ohayou', correct: false, level: 1 },
      { area: 'iro', itemId: 'aka', correct: false, level: 1 },
      null
    ]);
    C.assertEq(p.seen, { ohayou: 2, douro: 1 });
    C.assertEq(p.missCounts, { ohayou: 1, douro: 1 });
    C.assertEq(D.progressFromLogs(null), { seen: {}, missCounts: {} });
  });

  C.test('doutoku: pickScene は まだ見ていない場面を先に出し、直前と同じ場面を出さない', function () {
    var seen = {};
    D.SCENES.forEach(function (s) { seen[s.id] = 3; });
    seen.tearai = 0; seen.kutsu = 0;
    for (var k = 0; k < 40; k++) {
      var id = D.pickScene({ seen: seen, missCounts: {}, lastId: null }, Math.random).id;
      if (id !== 'tearai' && id !== 'kutsu') throw new Error('見ていない場面が先に出ない: ' + id);
      C.assertEq(D.pickScene({ seen: seen, missCounts: {}, lastId: 'tearai' }, Math.random).id, 'kutsu');
    }
    // 全部同じ回数なら どの場面も出る（直前は出ない）
    var got = {}, last = null;
    for (var r = 0; r < 600; r++) {
      var sc = D.pickScene({ seen: {}, missCounts: {}, lastId: last }, Math.random);
      if (sc.id === last || sc.open) throw new Error('だめ: ' + sc.id);
      got[sc.id] = true; last = sc.id;
    }
    C.assertEq(Object.keys(got).length, 25);
  });

  C.test('doutoku: pickScene は もう一方を えらんだことがある場面を 早めに出す', function () {
    var seen = {};
    D.SCENES.forEach(function (s) { seen[s.id] = 2; });
    seen.shingou = 3;
    var id = D.pickScene({ seen: seen, missCounts: { shingou: 2 }, lastId: null }, Math.random).id;
    C.assertEq(id, 'shingou');
  });

  C.test('doutoku: pickOpen は あなたならの場面から、直前と ちがうものを出す', function () {
    var got = {};
    for (var r = 0; r < 200; r++) {
      var s = D.pickOpen('hitori', Math.random);
      C.assertEq(s.open, true);
      if (s.id === 'hitori') throw new Error('直前と同じ');
      got[s.id] = true;
    }
    C.assertEq(Object.keys(got).length, 3);
  });

  C.test('doutoku: isOpenSlot は 5場面のうち3つめ', function () {
    var slots = [];
    for (var n = 0; n < 10; n++) if (D.isOpenSlot(n)) slots.push(n);
    C.assertEq(slots, [2, 7]);
  });

  C.test('doutoku: order は2つとも残し、左右を入れかえる', function () {
    var s = D.sceneById('kashite');
    var a = D.order(s.choices, seq([0.9]));
    var b = D.order(s.choices, seq([0.1]));
    C.assertEq(a.length, 2); C.assertEq(b.length, 2);
    C.assertEq(a[0] === b[0], false);
    C.assertEq(s.choices.length, 2);   // もとの並びは変えない
  });

  C.test('doutoku: picSvg は全部の場面を描き、絵に文字を入れない', function () {
    D.SCENES.concat(D.OPEN).forEach(function (s) {
      var svg = D.picSvg(s);
      if (!/^<svg[\s\S]*<\/svg>$/.test(svg)) throw new Error('svg でない: ' + s.id);
      if (/<text/.test(svg)) throw new Error('文字がある: ' + s.id);
      if (svg.length < 400) throw new Error('絵が少ない: ' + s.id);
    });
  });

  C.test('doutoku: 親画面に「どうとく」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/doutoku: 'どうとく'/.test(t), true);
    });
  });
})();
