(function () {
  'use strict';
  var C = window.Chiid;

  // メモリ保存で、まっさらな状態から始める
  function fresh() {
    var S = C.storage;
    S._forceMemory(true);
    return S.init().then(function () { return S.resetAll(); });
  }
  function done() { C.storage._forceMemory(false); }

  C.test('benkyo.SUBJECTS: 5件で、有効なのは kuku, kukuB, keisan', function () {
    var list = C.benkyo.SUBJECTS;
    C.assertEq(list.length, 5);
    C.assertEq(list.map(function (s) { return s.id; }), ['kuku', 'kukuB', 'keisan', 'kanji', 'eigo']);
    C.assertEq(list.filter(function (s) { return s.enabled; }).map(function (s) { return s.id; }), ['kuku', 'kukuB', 'keisan']);
    list.forEach(function (s) { if (!s.name) throw new Error('名前がない: ' + s.id); });
  });

  C.test('benkyo.pickProfile: chiiku だけ（アクティブ）なら null', function () {
    return fresh().then(function () {
      var S = C.storage;
      var cid = S.addProfile('はな', 'chiiku');
      S.setActive(cid);
      C.assertEq(C.benkyo.pickProfile(), null);
      C.assertEq(S.getActive().id, cid);   // 知育側のアクティブは変えない
      done();
    }, function (e) { done(); throw e; });
  });

  C.test('benkyo.pickProfile: benkyo があれば（アクティブでなくても）それを返す', function () {
    return fresh().then(function () {
      var S = C.storage;
      var cid = S.addProfile('はな', 'chiiku');
      var bid = S.addProfile('たろう', 'benkyo');
      S.setActive(cid);
      var p = C.benkyo.pickProfile();
      C.assertEq(p && p.id, bid);
      C.assertEq(p.kind, 'benkyo');
      // アクティブが benkyo ならそれを返す
      var bid2 = S.addProfile('じろう', 'benkyo');
      S.setActive(bid2);
      C.assertEq(C.benkyo.pickProfile().id, bid2);
      done();
    }, function (e) { done(); throw e; });
  });

  C.test('chiikuPickProfile: アクティブが benkyo でも chiiku を返す（無ければ null）', function () {
    return fresh().then(function () {
      var S = C.storage;
      var bid = S.addProfile('たろう', 'benkyo');
      S.setActive(bid);
      C.assertEq(C.chiikuPickProfile(), null);
      var cid = S.addProfile('はな', 'chiiku');
      var p = C.chiikuPickProfile();
      C.assertEq(p && p.id, cid);
      C.assertEq(p.kind, 'chiiku');
      // アクティブが chiiku なら、そのまま（既存の挙動）
      var cid2 = S.addProfile('ゆき', 'chiiku');
      S.setActive(cid2);
      C.assertEq(C.chiikuPickProfile().id, cid2);
      done();
    }, function (e) { done(); throw e; });
  });

  C.test('benkyo.checkRest: 時間内なら false', function () {
    return fresh().then(function () {
      C.assertEq(typeof C.benkyo.checkRest, 'function');
      C.assertEq(C.benkyo.checkRest(), false);
      done();
    }, function (e) { done(); throw e; });
  });

  /* ---------- 九九の画面（kuku-screen.js）。#app が無いので描画はせず、状態だけを動かす ---------- */
  var K = function () { return C.benkyo.kukuScreen; };
  function typeNum(n) { String(n).split('').forEach(function (d) { K()._press(d); }); }
  function answer(ok) {                      // 今の式に答える（ok=false なら、わざと間違える）
    var s = K()._state();
    var v = ok ? s.ans : (s.ans === 1 ? 2 : s.ans - 1);
    typeNum(v);
    K()._press('ok');
  }
  function kukuLogs(pid) {
    return C.storage.getLogs(pid).then(function (logs) {
      return logs.filter(function (e) { return e.area === 'kuku'; });
    });
  }
  // プロフィールを作って画面を開く（記録 seed があれば先に入れる）
  function openKuku(seed) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('たろう', 'benkyo');
      C.storage.setActive(pid);
      (seed || []).forEach(function (e) {
        C.storage.logAnswer({ profileId: pid, area: 'kuku', itemId: e.itemId || '2×2', correct: e.correct, level: e.level });
      });
      return K().show({ profileId: pid }).then(function () { return pid; });
    });
  }
  function kt(name, fn) {
    C.test('kukuScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  kt('初期状態で式が出て、正解を入れて「こたえる」で正解になる（記録は true が1件）', function () {
    return openKuku().then(function (pid) {
      var s = K()._state();
      C.assertEq(s.phase, 'question');
      C.assertEq(s.a * s.b, s.ans);
      C.assertEq(s.expr, s.a + ' × ' + s.b + ' = ?');
      C.assertEq(s.input, '');
      C.assertEq(s.dan, null);
      C.assertEq(s.solved, 0);
      C.assertEq(s.stars, 0);
      if (s.a > 2) throw new Error('レベル1なのに ' + s.a + 'のだん');
      answer(true);
      s = K()._state();
      C.assertEq(s.phase, 'feedback');
      C.assertEq(s.solved, 1);
      C.assertEq(s.message, 'せいかい！');
      return kukuLogs(pid).then(function (logs) {
        C.assertEq(logs.length, 1);
        C.assertEq(logs[0].correct, true);
        C.assertEq(logs[0].itemId, s.id);
        C.assertEq(logs[0].level, 1);
      });
    });
  });

  kt('1回目の誤答：入力が空に戻り同じ式。2回目の誤答：正解を見せて次の式へ（記録は false が1件だけ）', function () {
    return openKuku().then(function (pid) {
      var first = K()._state();
      answer(false);
      var s = K()._state();
      C.assertEq(s.phase, 'question');
      C.assertEq(s.id, first.id);
      C.assertEq(s.input, '');
      C.assertEq(s.message, 'もういっかい やってみよう！');
      C.assertEq(s.solved, 0);
      answer(false);
      s = K()._state();
      C.assertEq(s.phase, 'feedback');
      C.assertEq(s.message, 'こたえは ' + first.ans + ' だよ。つぎは できるよ！');
      C.assertEq(s.expr, first.a + ' × ' + first.b + ' = ' + first.ans);
      C.assertEq(s.solved, 1);
      K()._flush();
      s = K()._state();
      C.assertEq(s.phase, 'question');
      if (s.id === first.id) throw new Error('同じ式が続いた');
      return kukuLogs(pid).then(function (logs) {
        C.assertEq(logs.length, 1);
        C.assertEq(logs[0].correct, false);
        C.assertEq(logs[0].itemId, first.id);
      });
    });
  });

  kt('1回間違えてから正解：記録は false が1件', function () {
    return openKuku().then(function (pid) {
      answer(false);
      answer(true);
      C.assertEq(K()._state().message, 'せいかい！');
      return kukuLogs(pid).then(function (logs) {
        C.assertEq(logs.map(function (e) { return e.correct; }), [false]);
      });
    });
  });

  kt('空のまま「こたえる」では何も進まず、記録も増えない', function () {
    return openKuku().then(function (pid) {
      var first = K()._state();
      K()._press('ok');
      K()._press('ok');
      var s = K()._state();
      C.assertEq(s.phase, 'question');
      C.assertEq(s.id, first.id);
      C.assertEq(s.tries, 0);
      C.assertEq(s.solved, 0);
      C.assertEq(s.message, first.message);
      // そのあと2回間違えて、はじめて正解が見える（空は数えていない）
      answer(false);
      C.assertEq(K()._state().message, 'もういっかい やってみよう！');
      return kukuLogs(pid).then(function (logs) { C.assertEq(logs.length, 0); });
    });
  });

  kt('数字は2桁で止まり、「けす」で1桁戻る。「09」は 9 として正解', function () {
    return openKuku().then(function () {
      K()._press('1'); K()._press('2'); K()._press('3');
      C.assertEq(K()._state().input, '12');
      K()._press('del');
      C.assertEq(K()._state().input, '1');
      K()._press('del'); K()._press('del');
      C.assertEq(K()._state().input, '');
      // 1のだんで、こたえが1桁の式に「0」を前につけて答える
      K()._selectDan(1);
      var s = K()._state();
      C.assertEq(s.a, 1);
      K()._press('0'); K()._press(String(s.ans));
      C.assertEq(K()._state().input, '0' + s.ans);
      K()._press('ok');
      C.assertEq(K()._state().message, 'せいかい！');
    });
  });

  kt('5問目で星が1つ、10問で区切り（ごほうび）。もういっかいで次の区切り', function () {
    return openKuku().then(function () {
      for (var i = 1; i <= 4; i++) { answer(true); K()._flush(); }
      C.assertEq(K()._state().stars, 0);
      answer(true);
      C.assertEq(K()._state().stars, 1);
      C.assertEq(K()._state().solved, 5);
      K()._flush();
      for (i = 6; i <= 9; i++) { answer(true); K()._flush(); }
      // 2回まちがえた問題も1問に数える
      answer(false); answer(false);
      C.assertEq(K()._state().solved, 10);
      C.assertEq(K()._state().stars, 2);
      K()._flush();
      var s = K()._state();
      C.assertEq(s.phase, 'reward');
      K()._press('5');                         // ごほうび画面では数字は効かない
      C.assertEq(K()._state().phase, 'reward');
      K()._again();
      s = K()._state();
      C.assertEq(s.phase, 'question');
      C.assertEq(s.solved, 0);
      C.assertEq(s.stars, 0);
    });
  });

  kt('「7のだん」を選ぶと以降は7のだんだけ。「じどう」で戻る（レベル1なら1・2のだん）', function () {
    return openKuku().then(function () {
      K()._selectDan(7);
      C.assertEq(K()._state().dan, 7);
      for (var i = 0; i < 6; i++) {
        C.assertEq(K()._state().a, 7);
        answer(true); K()._flush();
      }
      C.assertEq(K()._state().level, 1);           // 段をえらんだ練習では、じどうのレベルは変えない
      K()._selectDan(null);
      C.assertEq(K()._state().dan, null);
      // じどうで5問正解するとレベル2になり、6問目は3のだんも出うる。確かめるのは、レベルが上がる前の5問
      for (i = 0; i < 5; i++) {
        C.assertEq(K()._state().level, 1);
        var a = K()._state().a;
        if (a > 2) throw new Error('じどうに戻ったのに ' + a + 'のだん');
        answer(true); K()._flush();
        if (K()._state().phase === 'reward') K()._again();
      }
      C.assertEq(K()._state().level, 2);
    });
  });

  kt('直近5問で4問正解するとレベルが上がる', function () {
    return openKuku().then(function (pid) {
      C.assertEq(K()._state().level, 1);
      answer(true); K()._flush();
      answer(false); answer(true); K()._flush();   // 1回間違えたので false
      answer(true); K()._flush();
      answer(true); K()._flush();
      C.assertEq(K()._state().level, 1);
      answer(true);
      C.assertEq(K()._state().level, 2);
      return kukuLogs(pid).then(function (logs) {
        C.assertEq(logs.map(function (e) { return e.correct; }), [true, false, true, true, true]);
        C.assertEq(logs[4].level, 1);              // 記録は、出題したときのレベル
      });
    });
  });

  kt('レベルは8を超えない', function () {
    var seed = [];
    for (var i = 0; i < 4; i++) seed.push({ correct: true, level: 8 });
    return openKuku(seed).then(function () {
      C.assertEq(K()._state().level, 8);
      for (var j = 0; j < 6; j++) { answer(true); K()._flush(); }
      C.assertEq(K()._state().level, 8);
    });
  });

  kt('問題と問題のあいだで checkRest を呼び、超えていたら止まる', function () {
    var orig = C.benkyo.checkRest;
    var calls = 0;
    return openKuku().then(function () {
      C.benkyo.checkRest = function () { calls++; return true; };
      answer(true);
      C.assertEq(calls, 0);                         // 問題の途中では呼ばない
      K()._flush();
      C.assertEq(calls, 1);
      C.assertEq(K()._state().phase, 'rest');
      var before = K()._state();
      K()._press('1'); K()._press('ok');           // お休み中は数字もこたえるも効かない
      C.assertEq(K()._state(), before);
      C.benkyo.checkRest = orig;
    }).then(null, function (e) { C.benkyo.checkRest = orig; throw e; });
  });

  kt('段をえらんで練習したあと開き直しても、レベルは画面内と同じ（記録に dan の印）', function () {
    var pid;
    return openKuku().then(function (p) {
      pid = p;
      K()._selectDan(9);
      for (var i = 0; i < 6; i++) { answer(true); K()._flush(); }
      C.assertEq(K()._state().level, 1);
      return kukuLogs(pid);
    }).then(function (logs) {
      C.assertEq(logs.length, 6);
      C.assertEq(logs[0].dan, 9);
      return K().show({ profileId: pid });
    }).then(function () {
      C.assertEq(K()._state().level, 1);          // 以前は 2 になっていた
      C.assertEq(K()._state().dan, null);
    });
  });

  kt("□モード：A×□=C を出し、B を入れて正解。記録は area=kukuB", function () {
    var pid;
    return fresh().then(function () {
      pid = C.storage.addProfile("たろう", "benkyo");
      C.storage.setActive(pid);
      return K().show({ profileId: pid, mode: "blank" });
    }).then(function () {
      var s = K()._state();
      C.assertEq(s.mode, "blank");
      C.assertEq(s.expr, s.a + " × ? = " + (s.a * s.b));
      C.assertEq(s.ans, s.b);
      if (s.a > 2) throw new Error("レベル1なのに " + s.a + "のだん");
      K()._press("1"); K()._press("2");           // 1桁で止まる
      C.assertEq(K()._state().input.length, 1);
      K()._press("del");
      answer(true);
      s = K()._state();
      C.assertEq(s.phase, "feedback");
      C.assertEq(s.message, "せいかい！");
      return C.storage.getLogs(pid);
    }).then(function (logs) {
      C.assertEq(logs.length, 1);
      C.assertEq(logs[0].area, "kukuB");
      C.assertEq(logs[0].correct, true);
    });
  });

  kt("□モード：2回まちがえるとBが表示され、苦手に数える", function () {
    var pid;
    return fresh().then(function () {
      pid = C.storage.addProfile("たろう", "benkyo");
      C.storage.setActive(pid);
      return K().show({ profileId: pid, mode: "blank" });
    }).then(function () {
      var b = K()._state().b;
      answer(false);
      C.assertEq(K()._state().phase, "question");
      C.assertEq(K()._state().message, "もういっかい やってみよう！");
      answer(false);
      var s = K()._state();
      C.assertEq(s.phase, "feedback");
      C.assertEq(s.input, String(b));
      return C.storage.getLogs(pid);
    }).then(function (logs) {
      C.assertEq(logs.length, 1);
      C.assertEq(logs[0].correct, false);
      C.assertEq(logs[0].area, "kukuB");
    });
  });

  kt("□モードの記録は、ふつうの九九のレベルに混ざらない", function () {
    var pid;
    return fresh().then(function () {
      pid = C.storage.addProfile("たろう", "benkyo");
      C.storage.setActive(pid);
      for (var i = 0; i < 5; i++) C.storage.logAnswer({ profileId: pid, area: "kukuB", itemId: "2×2", correct: true, level: 1 });
      return K().show({ profileId: pid });
    }).then(function () {
      C.assertEq(K()._state().level, 1);
      C.assertEq(K()._state().mode, "mul");
      return K().show({ profileId: pid, mode: "blank" });
    }).then(function () {
      C.assertEq(K()._state().level, 2);           // 5問正解で □ 側のレベルだけ上がる
    });
  });

  C.test("benkyo: SUBJECTS に kukuB（□を こたえる）がある", function () {
    var s = C.benkyo.SUBJECTS.filter(function (x) { return x.id === "kukuB"; })[0];
    C.assertEq(!!s && s.enabled, true);
    C.assertEq(s.kuku, "blank");
  });

  kt("1回まちがえた式の途中で段を切り替えると、まちがいとして記録する（進み具合は変えない）", function () {
    var pid, id;
    return openKuku().then(function (p) {
      pid = p;
      id = K()._state().id;
      answer(false);
      K()._selectDan(5);
      var s = K()._state();
      C.assertEq(s.solved, 0);
      C.assertEq(s.dan, 5);
      C.assertEq(s.a, 5);
      return kukuLogs(pid);
    }).then(function (logs) {
      C.assertEq(logs.length, 1);
      C.assertEq(logs[0].itemId, id);
      C.assertEq(logs[0].correct, false);
      C.assertEq(logs[0].dan, undefined);
    });
  });

  kt("まちがえる前に段を切り替えたときは、記録しない", function () {
    return openKuku().then(function (pid) {
      K()._selectDan(3);
      return kukuLogs(pid);
    }).then(function (logs) { C.assertEq(logs.length, 0); });
  });

  C.test("storage.lastOfKind: アプリごとに、最後に使った子へ戻る", function () {
    return fresh().then(function () {
      var S = C.storage;
      var b1 = S.addProfile("たろう", "benkyo"), b2 = S.addProfile("じろう", "benkyo");
      var c1 = S.addProfile("はな", "chiiku");
      S.setActive(b2);
      S.setActive(c1);                              // 知育アプリへ
      C.assertEq(C.benkyo.pickProfile().id, b2);   // 戻ると じろう（最初の たろう ではない）
      C.assertEq(S.lastOfKind("chiiku").id, c1);
      C.assertEq(S.lastOfKind("eigo"), null);
      C.assertEq(b1 !== b2, true);
      done();
    }, function (e) { done(); throw e; });
  });
})();
