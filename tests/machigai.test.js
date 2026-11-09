(function () {
  'use strict';
  var C = window.Chiid;
  var M = C.machigai;
  // 同じ種なら同じ乱数列（テストを毎回同じ結果にする）
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  C.test('machigai: 定数とレベル設定', function () {
    C.assertEq(M.AREA, 'machigai'); C.assertEq(M.MAX_LEVEL, 3); C.assertEq(M.ROUND_SIZE, 5);
    C.assertEq(M.levelConfig(1).diffs, 1);
    C.assertEq(M.levelConfig(2).diffs, 2);
    C.assertEq(M.levelConfig(3).diffs, 3);
    C.assertEq(M.levelConfig(0).diffs, 1);
    C.assertEq(M.levelConfig(1).sizes, ['big']);
    C.assertEq(M.levelConfig(3).sizes, ['big', 'mid', 'small']);
    // 大きさの違いは、レベルが上がるほど ひかえめ
    C.assertEq(M.levelConfig(1).scale < M.levelConfig(2).scale && M.levelConfig(2).scale < M.levelConfig(3).scale, true);
  });

  C.test('machigai: makeProblem は違いの数がレベルどおりで、左右の違いがその場所だけ', function () {
    for (var lv = 1; lv <= 3; lv++) {
      var cfg = M.levelConfig(lv);
      for (var r = 0; r < 60; r++) {
        var p = M.makeProblem({ level: lv }, seeded(lv * 1000 + r));
        C.assertEq(p.level, lv);
        C.assertEq(p.left.length, M.SLOTS.length);
        C.assertEq(p.diffs.length, cfg.diffs);
        var slots = p.diffs.map(function (d) { return d.slot; });
        C.assertEq(slots.filter(function (s, i) { return slots.indexOf(s) === i; }).length, slots.length);   // 同じ部品に2つ入れない
        // 部品はかぶらない
        var types = p.left.map(function (x) { return x.type; });
        C.assertEq(types.filter(function (t, i) { return types.indexOf(t) === i; }).length, types.length);
        p.left.forEach(function (a, i) {
          var b = p.right[i], di = slots.indexOf(i);
          C.assertEq(a.type, b.type);
          C.assertEq(M.PARTS[a.type].zone, M.SLOTS[i].zone);   // 空の部品は空に
          if (di < 0) { C.assertEq(b, a); return; }
          var d = p.diffs[di];
          if (cfg.sizes.indexOf(M.PARTS[a.type].size) < 0) throw new Error('lv' + lv + ' に ' + a.type);
          if (d.kind === 'iro') { C.assertEq(b.color !== a.color && !!b.color, true); C.assertEq(b.s, 1); C.assertEq(b.hidden, false); }
          else if (d.kind === 'nai') { C.assertEq(b.hidden, true); }
          else if (d.kind === 'ookisa') { C.assertEq(b.s, cfg.scale); C.assertEq(b.color, a.color); }
          else throw new Error('kind ' + d.kind);
          C.assertEq(d.r >= M.MIN_HIT_R, true);
        });
        C.assertEq(p.itemId, p.diffs.map(function (d) { return d.kind; }).join('+'));
      }
    }
  });

  C.test('machigai: レベル1の「いろ」は はっきり違う色（反対の色）', function () {
    var seen = 0;
    for (var r = 0; r < 200; r++) {
      var p = M.makeProblem({ level: 1, missCounts: { iro: 30 } }, seeded(5000 + r));
      var d = p.diffs[0];
      if (d.kind !== 'iro') continue;
      seen++;
      var a = p.left[d.slot].color, b = p.right[d.slot].color;
      C.assertEq(['#2f7fd6', '#f4c430'].indexOf(b) >= 0, true);
      C.assertEq(a !== b, true);
    }
    C.assertEq(seen > 50, true);
  });

  C.test('machigai: 苦手な種類（missCounts）を多めに出す', function () {
    var nai = 0;
    for (var r = 0; r < 200; r++) {
      if (M.makeProblem({ level: 1, missCounts: { nai: 40 } }, seeded(9000 + r)).diffs[0].kind === 'nai') nai++;
    }
    C.assertEq(nai > 150, true);
  });

  C.test('machigai: hitTest は違いの円の中だけ当たり、見つけていないほうを先に選ぶ', function () {
    var p = { diffs: [{ x: 100, y: 100, r: 40 }, { x: 150, y: 100, r: 40 }] };
    C.assertEq(M.hitTest(p, 100, 100), 0);
    C.assertEq(M.hitTest(p, 120, 100), 0);   // 両方の円の中 → 近いほう
    C.assertEq(M.hitTest(p, 130, 100), 1);
    C.assertEq(M.hitTest(p, 189, 100), 1);
    C.assertEq(M.hitTest(p, 300, 250), -1);
    C.assertEq(M.hitTest(p, 100, 141), -1);
    C.assertEq(M.hitTest(p, 120, 100, [true, false]), 1);   // 0は見つけ済み → 重なっている1を選ぶ
    C.assertEq(M.hitTest(p, 100, 100, [true, false]), 0);   // 1の円の外なら 0（見つけ済み）を返す
    // 実際の問題でも、違いの中心は当たる
    var q = M.makeProblem({ level: 3 }, seeded(42));
    q.diffs.forEach(function (d, i) { C.assertEq(M.hitTest(q, d.x, d.y), i); });
  });

  C.test('machigai: sceneSvg は ない部品を描かず、大きさを変えて描く', function () {
    var parts = [{ type: 'house', x: 75, y: 205, s: 1, color: '#e2483d', hidden: false },
                 { type: 'sun', x: 70, y: 55, s: 0.55, color: null, hidden: false },
                 { type: 'ball', x: 135, y: 282, s: 1, color: '#2f7fd6', hidden: true }];
    var s = M.sceneSvg(parts);
    C.assertEq(/^<svg viewBox="0 0 400 300"/.test(s), true);
    C.assertEq(s.indexOf('translate(75 205) scale(1)') >= 0, true);
    C.assertEq(s.indexOf('translate(70 55) scale(0.55)') >= 0, true);
    C.assertEq(s.indexOf('translate(135 282)') < 0, true);
    C.assertEq(s.indexOf('#e2483d') >= 0, true);
    // すべての部品が描ける（エラーにならない）
    Object.keys(M.PARTS).forEach(function (k) { M.sceneSvg([{ type: k, x: 0, y: 0, s: 1, color: '#2f7fd6' }]); });
  });

  C.test('machigai: 声のことばは ひらがなだけ', function () {
    [1, 2, 3].forEach(function (n) { C.assertEq(/^[ぁ-ゖ ]+$/.test(M.askText(n)), true); });
  });

  function log(id, ok, lv) { return { area: 'machigai', itemId: id, correct: ok, level: lv }; }
  C.test('machigai: progressFromLogs', function () {
    C.assertEq(M.progressFromLogs([]).level, 1);
    C.assertEq(M.progressFromLogs([{ area: 'kazu', itemId: '3', correct: true, level: 3 }]).level, 1);
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push(log('iro', true, 1));
    var r = M.progressFromLogs(logs);
    C.assertEq(r.level, 2); C.assertEq(r.recent, []);
    var d = [];
    for (var j = 0; j < 5; j++) d.push(log('nai+ookisa', false, 3));
    var rd = M.progressFromLogs(d);
    C.assertEq(rd.level, 2); C.assertEq(rd.missCounts, { nai: 5, ookisa: 5 });
    var up = [];
    for (var k = 0; k < 5; k++) up.push(log('iro+nai+nai', true, 3));
    C.assertEq(M.progressFromLogs(up).level, 3);   // 上限3を超えない
  });

  C.test('machigai: 親画面に「まちがいさがし」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/machigai: 'まちがいさがし'/.test(t), true);
    });
  });
})();
