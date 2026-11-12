/* 長さ・かさ（subjects/nagasa.js） */
(function () {
  'use strict';
  var C = window.Chiid;
  var N = C.nagasa;

  C.test('nagasa: 定数と kindsFor', function () {
    C.assertEq([N.AREA, N.MAX_LEVEL, N.ROUND_SIZE, N.STAR_EVERY, N.MAX_DIGITS], ['nagasa', 3, 10, 5, 4]);
    C.assertEq(N.kindsFor(1), ['readLen', 'readVol']);
    C.assertEq(N.kindsFor(2), ['readLen', 'readVol', 'convert', 'unit']);
    C.assertEq(N.kindsFor(3), ['readLen', 'readVol', 'convert', 'unit']);
    C.assertEq(N.UNIT_ITEMS.length, 12);
  });
  C.test('nagasa: idsFor の範囲（レベル1は cm ちょうど・dL だけ、レベル2に m・mL がない）', function () {
    var l1 = N.idsFor(1), l2 = N.idsFor(2), l3 = N.idsFor(3);
    C.assertEq(l1.indexOf('readLen:150') >= 0 && l1.indexOf('readLen:35') < 0 && l1.indexOf('readVol:9') >= 0, true);
    C.assertEq(l1.every(function (id) { return /^read/.test(id); }), true);
    C.assertEq(l2.indexOf('readLen:35') >= 0 && l2.indexOf('readLen:30') < 0 && l2.indexOf('readVol:20') < 0, true);
    C.assertEq(l2.some(function (id) { return /^convert:(m2cm|cm2m|dl2ml|l2ml|ml2dl):|^unit:(pool|kokuban|petto|spoon)$/.test(id); }), false);
    C.assertEq(l3.indexOf('convert:l2ml:3') >= 0 && l3.indexOf('unit:pool') >= 0 && l3.indexOf('convert:ml2dl:900') >= 0, true);
  });
  C.test('nagasa: makeQuestion の答え', function () {
    C.assertEq(N.makeQuestion('convert:cm2mm:35').answer, [35]);
    C.assertEq(N.makeQuestion('convert:mm2cm:159').answer, [15, 9]);
    C.assertEq(N.makeQuestion('convert:m2cm:120').answer, [120]);
    C.assertEq(N.makeQuestion('convert:cm2m:120').answer, [1, 20]);
    C.assertEq(N.makeQuestion('convert:l2dl:13').answer, [13]);
    C.assertEq(N.makeQuestion('convert:dl2l:25').answer, [2, 5]);
    C.assertEq(N.makeQuestion('convert:dl2ml:3').answer, [300]);
    C.assertEq(N.makeQuestion('convert:l2ml:2').answer, [2000]);
    C.assertEq(N.makeQuestion('convert:ml2dl:300').answer, [3]);
    C.assertEq(N.makeQuestion('readLen:35').boxes, ['cm', 'mm']);
    C.assertEq(N.makeQuestion('readLen:30', 1).boxes, ['cm']);
    C.assertEq(N.makeQuestion('readLen:30', 1).answer, [3]);
    C.assertEq(N.makeQuestion('readVol:13').answer, [1, 3]);
    C.assertEq(N.makeQuestion('readVol:7', 1).answer, [7]);
    C.assertEq(N.makeQuestion('unit:ari', 3).choices, ['m', 'cm', 'mm']);
    C.assertEq(N.makeQuestion('unit:cup', 2).choices, ['L', 'dL']);
    C.assertEq(N.makeQuestion('unit:ari', 2).boxes, []);
  });
  C.test('nagasa: check（箱2つは両方合って せいかい、0 も入れる）', function () {
    var q = N.makeQuestion('convert:mm2cm:120');
    C.assertEq(N.check(q, [12, 0]), true); C.assertEq(N.check(q, ['12', '0']), true);
    C.assertEq(N.check(q, [12, 1]), false); C.assertEq(N.check(q, [1, 20]), false);
    C.assertEq(N.check(N.makeQuestion('unit:ari', 2), 'mm'), true);
    C.assertEq(N.check(N.makeQuestion('unit:ari', 2), 'cm'), false);
    C.assertEq(N.isEmpty(q, [12, '']), true); C.assertEq(N.isEmpty(q, [12, 0]), false);
    C.assertEq(N.isEmpty(N.makeQuestion('unit:ari', 2), ''), true);
  });
  C.test('nagasa: submit は2回目のまちがいで reveal', function () {
    var q = N.makeQuestion('convert:cm2mm:35'), a = N.newAttempt();
    C.assertEq(N.submit(a, q, ['']).kind, 'empty');
    C.assertEq(N.submit(a, q, [34]).kind, 'retry');
    C.assertEq(N.submit(a, q, [33]).kind, 'reveal');
    C.assertEq(N.submit(N.newAttempt(), q, [35]).kind, 'correct');
  });
  C.test('nagasa: speakText と answerText（0 は読まない、は で始まる部品がない）', function () {
    C.assertEq(N.speakText(N.makeQuestion('convert:cm2mm:35')), '3センチ｜5ミリ｜を ミリで いうと？');
    C.assertEq(N.speakText(N.makeQuestion('convert:cm2mm:30')), '3センチ｜を ミリで いうと？');
    C.assertEq(N.speakText(N.makeQuestion('convert:mm2cm:35')), '35ミリ｜を センチと ミリで いうと？');
    C.assertEq(N.speakText(N.makeQuestion('readLen:30', 1)), 'テープの {長|なが}さは なんセンチ？');
    C.assertEq(N.speakText(N.makeQuestion('readVol:13')), '水の かさは なんリットル なんデシリットル？');
    C.assertEq(N.answerText(N.makeQuestion('convert:mm2cm:120')), 'こたえは｜12センチ｜だよ。｜つぎは できるよ！');
    C.assertEq(N.answerText(N.makeQuestion('readLen:35')), 'こたえは｜3センチ｜5ミリ｜だよ。｜つぎは できるよ！');
    C.assertEq(N.speakText(N.makeQuestion('unit:enpitsu', 2)), 'えんぴつの {長|なが}さは｜15｜どの たんいかな？');
    C.assertEq(N.answerText(N.makeQuestion('unit:petto', 3)), 'こたえは｜500ミリリットル｜だよ。｜つぎは できるよ！');
    [1, 2, 3].forEach(function (lv) {
      N.idsFor(lv).forEach(function (id) {
        var q = N.makeQuestion(id, lv);
        (N.speakText(q) + '｜' + N.answerText(q)).split('｜').forEach(function (p) { if (/^\s*は/.test(p)) throw new Error(id + ': ' + p); });
      });
    });
  });
  C.test('nagasa: pickQuestion は少ない種類から、同じ問題を続けない', function () {
    var q = N.pickQuestion({ level: 2, missCounts: {}, lastId: null, kindCounts: { readLen: 2, readVol: 2, convert: 0, unit: 2 } }, Math.random);
    C.assertEq(q.kind, 'convert');
    var last = null;
    for (var i = 0; i < 40; i++) {
      var p = N.pickQuestion({ level: 3, missCounts: {}, lastId: last, kindCounts: {} }, Math.random);
      if (p.id === last || N.idsFor(3).indexOf(p.id) < 0) throw new Error(p.id);
      last = p.id;
    }
    var l1 = N.pickQuestion({ level: 1, missCounts: {}, lastId: null, kindCounts: {} }, Math.random);
    C.assertEq(/^read/.test(l1.kind), true);
  });
  function log(id, ok, lv, area) { return { area: area || 'nagasa', itemId: id, correct: ok, level: lv }; }
  C.test('nagasa: progressFromLogs', function () {
    C.assertEq(N.progressFromLogs([]), { level: 1, recent: [], missCounts: {} });
    var r = N.progressFromLogs([log('readLen:30', false, 1), log('3+4', false, 1, 'keisan'), log('readLen:30', false, 1), log('readVol:3', true, 1)]);
    C.assertEq(r.missCounts, { 'readLen:30': 2 }); C.assertEq(r.recent, [false, false, true]);
    var up = []; for (var i = 0; i < 5; i++) up.push(log('readVol:3', true, 1));
    C.assertEq(N.progressFromLogs(up).level, 2);
    var top = []; for (var j = 0; j < 5; j++) top.push(log('unit:pool', true, 3));
    C.assertEq(N.progressFromLogs(top).level, 3);
  });
})();

/* 長さ・かさの画面（nagasa-screen.js）。#app が無いので描画はせず、状態だけを動かす */
(function () {
  'use strict';
  var C = window.Chiid;
  var S = function () { return C.benkyo.nagasaScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); }
  function fill(vals) {
    vals.forEach(function (n, i) { S()._tap(i); String(n).split('').forEach(function (d) { S()._press(d); }); });
  }
  function answer(ok) {
    S()._flush();
    var s = S()._state();
    if (s.kind === 'unit') { S()._pick(ok ? s.unit : s.choices.filter(function (u) { return u !== s.unit; })[0]); return; }
    fill(ok ? s.answer : s.answer.map(function (n, i) { return i === 0 ? n + 1 : n; }));
    S()._press('ok');
  }
  function logsOf(pid) {
    return C.storage.getLogs(pid).then(function (l) { return l.filter(function (e) { return e.area === 'nagasa'; }); });
  }
  function open(seed) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('はなこ', 'benkyo');
      C.storage.setActive(pid);
      (seed || []).forEach(function (e) { C.storage.logAnswer({ profileId: pid, area: 'nagasa', itemId: e.itemId, correct: e.correct, level: e.level }); });
      return S().show({ profileId: pid }).then(function () { return pid; });
    });
  }
  function lv3() { var a = []; for (var i = 0; i < 3; i++) a.push({ itemId: 'unit:pool', correct: true, level: 3 }); return a; }
  function nt(name, fn) {
    C.test('nagasaScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  nt('最初はレベル1。正解で記録 true が1件', function () {
    return open().then(function (pid) {
      var s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.level, 1); C.assertEq(/^read/.test(s.kind), true);
      answer(true);
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.message, '正かい！'); C.assertEq(s.solved, 1);
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, true); C.assertEq(logs[0].itemId, s.id); });
    });
  });
  nt('1回目まちがい→やり直し、2回目まちがい→答えを見せる（記録 false が1件）', function () {
    return open().then(function (pid) {
      var id = S()._state().id;
      answer(false);
      var s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.message, 'もう{一回|いっかい} やってみよう！'); C.assertEq(s.tries, 1);
      C.assertEq(s.input.every(function (x) { return x === ''; }), true); C.assertEq(s.active, 0);
      answer(false);
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.id, id); C.assertEq(s.revealed, true);
      C.assertEq(s.input, s.answer.map(String));
      S()._key('3');
      C.assertEq(S()._state().input, s.answer.map(String));   // 見せている間の数字ボタンは効かない
      C.assertEq(S()._state().phase, 'feedback');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });
  nt('箱が2つで片方だけ入れた「答える」は数えない。けすは選んだ箱の1字', function () {
    return open(lv3()).then(function () {
      var guard = 0;
      while (S()._state().boxes.length !== 2 && guard++ < 50) { answer(true); S()._flush(); if (S()._state().phase !== 'question') S()._again(); }
      var s = S()._state();
      C.assertEq(s.boxes.length, 2);
      S()._tap(0); S()._press('1'); S()._press('2');
      S()._press('ok');
      C.assertEq(S()._state().tries, 0);
      C.assertEq(S()._state().active, 1);   // 空いている箱へ うつる
      S()._tap(0);
      S()._press('del');
      C.assertEq(S()._state().input[0], '1');
    });
  });
  nt('数字は1つの箱に4けたまで', function () {
    return open().then(function () {
      S()._tap(0);
      '12345'.split('').forEach(function (d) { S()._press(d); });
      C.assertEq(S()._state().input[0], '1234');
    });
  });
  nt('5問正解で星1、10問でごほうび（星2）、もういっかいで0から', function () {
    return open().then(function () {
      for (var i = 0; i < 5; i++) answer(true);
      S()._flush();
      C.assertEq(S()._state().stars, 1);
      for (var j = 0; j < 5; j++) answer(true);
      S()._flush();
      var s = S()._state();
      C.assertEq(s.phase, 'reward'); C.assertEq(s.solved, 10); C.assertEq(s.stars, 2);
      S()._again();
      s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.solved, 0); C.assertEq(s.stars, 0);
    });
  });
  nt('レベル3では4種類とも出る', function () {
    return open(lv3()).then(function () {
      var seen = {};
      for (var i = 0; i < 8; i++) { seen[S()._state().kind] = 1; answer(true); S()._flush(); }
      C.assertEq(Object.keys(seen).sort(), ['convert', 'readLen', 'readVol', 'unit']);
    });
  });
  C.test('nagasa: 親画面に「ながさ・かさ」、SUBJECTS に nagasa がある', function () {
    return Promise.all([fetch('../shared/parent.js').then(function (r) { return r.text(); }), fetch('../app-benkyo/main.js').then(function (r) { return r.text(); })]).then(function (t) {
      C.assertEq(/nagasa: 'ながさ・かさ'/.test(t[0]), true);
      C.assertEq(/id: 'nagasa', name: '\{長\|なが\}さ・かさ', sub: 'ものさし・ます', enabled: true/.test(t[1]), true);
    });
  });
})();
