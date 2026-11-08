(function () {
  'use strict';
  var C = window.Chiid;
  var T = C.tokei;
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  C.test('tokei: 定数とレベル設定', function () {
    C.assertEq(T.AREA, 'tokei'); C.assertEq(T.MAX_LEVEL, 3); C.assertEq(T.ROUND_SIZE, 5);
    C.assertEq(T.levelConfig(1), { minutes: [0], choices: 3 });
    C.assertEq(T.levelConfig(2), { minutes: [0, 30], choices: 3 });
    C.assertEq(T.levelConfig(3), { minutes: [0, 30], choices: 4 });
    C.assertEq(T.levelConfig(0).minutes, [0]);
  });
  C.test('tokei: id と時刻の変換・ひょうじ・よみ', function () {
    C.assertEq(T.toId({ h: 3, m: 0 }), '3:00');
    C.assertEq(T.toId({ h: 12, m: 30 }), '12:30');
    C.assertEq(T.parseId('11:30'), { h: 11, m: 30 });
    C.assertEq(T.label({ h: 3, m: 0 }), '3じ');
    C.assertEq(T.label({ h: 12, m: 30 }), '12じはん');
    C.assertEq(T.yomi({ h: 4, m: 0 }), 'よじ');
    C.assertEq(T.yomi({ h: 9, m: 30 }), 'くじはん');
    C.assertEq(T.yomi({ h: 7, m: 0 }), 'しちじ');
    for (var h = 1; h <= 12; h++) {
      [0, 30].forEach(function (m) {
        // 園児が見る文字は数字とひらがなだけ
        if (!/^[0-9ぁ-ゖ]+$/.test(T.label({ h: h, m: m }))) throw new Error('label ' + h);
        if (!/^[ぁ-ゖ]+$/.test(T.yomi({ h: h, m: m }))) throw new Error('yomi ' + h);
      });
    }
  });
  C.test('tokei: はりの角度（12時が0度、時計回り）', function () {
    C.assertEq(T.handAngles({ h: 3, m: 0 }), { hour: 90, minute: 0 });
    C.assertEq(T.handAngles({ h: 12, m: 0 }), { hour: 0, minute: 0 });
    C.assertEq(T.handAngles({ h: 3, m: 30 }), { hour: 105, minute: 180 });   // 3と4のあいだ
    C.assertEq(T.handAngles({ h: 12, m: 30 }), { hour: 15, minute: 180 });
  });
  C.test('tokei: allIds はレベルの時刻をすべて返す', function () {
    C.assertEq(T.allIds(1).length, 12);
    C.assertEq(T.allIds(2).length, 24);
    C.assertEq(T.allIds(1).every(function (id) { return /:00$/.test(id); }), true);
  });
  C.test('tokei: pickTime は範囲内で、直前と同じ時刻を出さない', function () {
    for (var lv = 1; lv <= 3; lv++) {
      var ids = T.allIds(lv), last = '3:00';
      for (var k = 0; k < 80; k++) {
        var t = T.pickTime({ level: lv, missCounts: {}, lastId: last }, Math.random);
        var id = T.toId(t);
        if (ids.indexOf(id) < 0 || id === last) throw new Error('lv' + lv + ' ' + id);
        last = id;
      }
    }
  });
  C.test('tokei: pickTime はレベル2で「はん」も出し、苦手を重く出す', function () {
    var half = 0, weak = 0;
    for (var k = 0; k < 200; k++) {
      if (T.pickTime({ level: 2, missCounts: {}, lastId: null }, Math.random).m === 30) half++;
      if (T.toId(T.pickTime({ level: 1, missCounts: { '7:00': 50 }, lastId: null }, Math.random)) === '7:00') weak++;
    }
    C.assertEq(half > 40, true);
    C.assertEq(weak > 60, true);
  });
  C.test('tokei: makeChoices は答えを含み、重ならず、レベルの時刻だけ', function () {
    for (var lv = 1; lv <= 3; lv++) {
      var cfg = T.levelConfig(lv), ids = T.allIds(lv);
      ids.forEach(function (ans) {
        for (var r = 0; r < 5; r++) {
          var c = T.makeChoices(T.parseId(ans), lv, Math.random);
          C.assertEq(c.length, cfg.choices);
          C.assertEq(c.indexOf(ans) >= 0, true);
          C.assertEq(uniq(c).length, c.length);
          C.assertEq(c.every(function (x) { return ids.indexOf(x) >= 0; }), true);
        }
      });
    }
  });
  C.test('tokei: makeChoices はレベル2で同じ「じ」のちょうど／はんを混ぜる', function () {
    for (var r = 0; r < 20; r++) {
      C.assertEq(T.makeChoices({ h: 3, m: 30 }, 2, Math.random).indexOf('3:00') >= 0, true);
      C.assertEq(T.makeChoices({ h: 12, m: 0 }, 2, Math.random).indexOf('12:30') >= 0, true);
    }
  });
  C.test('tokei: makeChoices はレベル3の「はん」で となりの じはん を混ぜる', function () {
    for (var r = 0; r < 20; r++) {
      var c = T.makeChoices({ h: 3, m: 30 }, 3, Math.random);
      C.assertEq(c.indexOf('2:30') >= 0 && c.indexOf('4:30') >= 0, true);
      var d = T.makeChoices({ h: 12, m: 30 }, 3, Math.random);
      C.assertEq(d.indexOf('11:30') >= 0 && d.indexOf('1:30') >= 0, true);   // 12のつぎは1
    }
  });
  function log(id, ok, lv) { return { area: 'tokei', itemId: id, correct: ok, level: lv }; }
  C.test('tokei: progressFromLogs', function () {
    C.assertEq(T.progressFromLogs([]).level, 1);
    C.assertEq(T.progressFromLogs([{ area: 'kazu', itemId: '3', correct: true, level: 3 }]).level, 1);
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push(log('2:00', true, 1));
    var r = T.progressFromLogs(logs);
    C.assertEq(r.level, 2); C.assertEq(r.recent, []);
    var d = [];
    for (var j = 0; j < 5; j++) d.push(log('9:30', false, 3));
    var rd = T.progressFromLogs(d);
    C.assertEq(rd.level, 2); C.assertEq(rd.missCounts, { '9:30': 5 });
    var up = [];
    for (var k = 0; k < 5; k++) up.push(log('1:00', true, 3));
    C.assertEq(T.progressFromLogs(up).level, 3);   // 上限3を超えない
  });
  C.test('tokei: clockSvg は数字1〜12と、2本のはりを描く', function () {
    var s = T.clockSvg({ h: 3, m: 30 });
    C.assertEq(/class="tk-hour"/.test(s) && /class="tk-min"/.test(s), true);
    for (var n = 1; n <= 12; n++) if (s.indexOf('>' + n + '</text>') < 0) throw new Error('数字 ' + n);
  });
  C.test('tokei: 親画面に「とけい」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/tokei: 'とけい'/.test(t), true);
    });
  });
})();
