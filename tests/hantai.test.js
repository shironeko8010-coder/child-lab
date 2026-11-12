/* はんたい ことば（subjects/hantai.js） */
(function () {
  'use strict';
  var C = window.Chiid;
  function H() { return C.hantai; }
  function log(itemId, correct, level, area) { return { area: area || 'hantai', itemId: itemId, correct: correct, level: level }; }
  function plain(t) { return t.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$1'); }
  function gradeOf(ch) { var r = C.kanjiData.filter(function (k) { return k[0] === ch; })[0]; return r ? r[1] : 9; }
  function kanjiOk(t) {   // ルビの中の漢字は2年だけ（1年の字にふりがなはつけない）、ルビの外の漢字は1年だけ
    var inside = (t.match(/\{([^|{}]+)\|/g) || []).join('');
    var outside = t.replace(/\{[^}]*\}/g, '');
    return (inside.match(/[一-龯]/g) || []).every(function (c) { return gradeOf(c) === 2; }) &&
           (outside.match(/[一-龯]/g) || []).every(function (c) { return gradeOf(c) === 1; });
  }

  C.test('hantai: 定数とことばの数', function () {
    var h = H();
    C.assertEq([h.AREA, h.MAX_LEVEL, h.ROUND_SIZE, h.STAR_EVERY], ['hantai', 3, 10, 5]);
    C.assertEq(h.PAIRS.filter(function (p) { return p.level === 1; }).length, 27);
    C.assertEq(h.PAIRS.filter(function (p) { return p.level === 2; }).length, 37);
    C.assertEq(h.SENTENCES.length, 37);
    C.assertEq([1, 2, 3].map(function (lv) { return h.idsFor(lv).length; }), [54, 74, 37]);
  });

  C.test('hantai: id が重ならず、ことばは1回だけ、よみは ひらがな、漢字は2年まで', function () {
    var h = H(), ids = {}, words = {};
    h.PAIRS.forEach(function (p) {
      if (ids[p.id]) throw new Error('id ' + p.id);
      ids[p.id] = 1;
      [p.a, p.b].forEach(function (w) {
        var k = plain(w.t);
        if (words[k]) throw new Error('2回: ' + k);
        words[k] = 1;
        if (!/^[ぁ-ゖー]+$/.test(w.y) || !kanjiOk(w.t)) throw new Error(w.t);
      });
    });
    h.SENTENCES.forEach(function (s) {
      if (ids['s' + s.id]) throw new Error('id ' + s.id);
      ids['s' + s.id] = 1;
      C.assertEq(s.wrong.length, 3);
      if (s.wrong.some(function (w) { return plain(w.t) === plain(s.ans.t); })) throw new Error(s.id);
      [s.word, s.ans].concat(s.wrong).forEach(function (w) { if (!kanjiOk(w.t)) throw new Error(s.id + ' ' + w.t); });
      [s.pre, s.post].forEach(function (t) { if (!kanjiOk(t)) throw new Error(s.id + ' ' + t); });
    });
  });

  C.test('hantai: 2年までに習う漢字は、ひらがなで書かない', function () {
    var h = H();
    var mustKanji = ['かう', 'よむ', 'あるく', 'はしる', 'ほそい', 'みる'];
    var all = [];
    h.SENTENCES.forEach(function (s) { all.push(s.pre, s.post, s.word.t, s.ans.t); s.wrong.forEach(function (w) { all.push(w.t); }); });
    all.forEach(function (t) { if (mustKanji.indexOf(t) >= 0) throw new Error('ひらがな: ' + t); });
    h.SENTENCES.forEach(function (s) { if (/^(かぜ|いけ)が/.test(s.pre)) throw new Error('ひらがな: ' + s.pre); });
  });

  C.test('hantai: もう1つの反対になることばは、まちがいの選択肢に出さない', function () {
    var h = H();
    var avoid = [['w:ani:a', '{姉|あね}'], ['w:ani:b', '{妹|いもうと}'], ['w:ane:a', '{兄|あに}'], ['w:ane:b', '{弟|おとうと}'],
      ['w:akeru:a', 'とじる'], ['w:hiraku:b', 'あける'], ['w:hiraku:a', 'しめる'], ['w:akeru:b', 'ひらく'],
      ['w:iku:a', 'もどる'], ['w:susumu:b', '{行|い}く'], ['w:hiroi:b', '大きい']];
    avoid.forEach(function (x) {
      for (var k = 0; k < 120; k++) {
        var q = h.makeQuestion(x[0], Math.random);
        if (q.choices.some(function (c) { return c.t === x[1]; })) throw new Error(x[0] + ' に ' + x[1]);
      }
    });
  });

  C.test('hantai: makeQuestion（ことば）', function () {
    var h = H();
    h.idsFor(1).concat(h.idsFor(2)).forEach(function (id) {
      var q = h.makeQuestion(id, Math.random);
      C.assertEq(q.kind, 'word');
      C.assertEq(q.choices.length, 4);
      var ts = q.choices.map(function (c) { return c.t; });
      if (ts.indexOf(q.ask.t) >= 0) throw new Error('問題のことばが選択肢に ' + id);
      if (ts.filter(function (t, i) { return ts.indexOf(t) === i; }).length !== 4) throw new Error('同じ選択肢 ' + id);
      C.assertEq(h.check(q, q.answer), true);
      C.assertEq(h.check(q, (q.answer + 1) % 4), false);
    });
    var big = h.makeQuestion('w:ookii:a', Math.random);   // 大きい → 小さい。まちがいは 大きさ のなかまだけ
    var size = h.PAIRS.filter(function (p) { return p.group === '大きさ'; }).reduce(function (a, p) { return a.concat([p.a.t, p.b.t]); }, []);
    C.assertEq(big.ask.t, '大きい');
    C.assertEq(big.choices[big.answer].t, '小さい');
    big.choices.forEach(function (c) { if (size.indexOf(c.t) < 0) throw new Error(c.t); });
    var rev = h.makeQuestion('w:ookii:b', Math.random);
    C.assertEq(rev.ask.t, '小さい');
    C.assertEq(rev.choices[rev.answer].t, '大きい');
  });

  C.test('hantai: makeQuestion（文）', function () {
    var h = H();
    var q = h.makeQuestion('s:biru', Math.random);
    C.assertEq(q.kind, 'sentence');
    C.assertEq(q.level, 3);
    C.assertEq(q.ask.t, 'この ビルは {高|たか}い。');
    C.assertEq(q.choices[q.answer].t, 'この ビルは ひくい。');
    C.assertEq(q.choices.some(function (c) { return c.t === 'この ビルは やすい。'; }), true);
    C.assertEq(q.choices[q.answer].y, 'この ビルは ひくい。');
    h.idsFor(3).forEach(function (id) {
      var s = h.makeQuestion(id, Math.random);
      C.assertEq(s.choices.length, 4);
      C.assertEq(h.check(s, s.answer), true);
    });
  });

  C.test('hantai: pickQuestion は同じ問題を続けない', function () {
    var h = H(), last = null;
    for (var k = 0; k < 60; k++) {
      var q = h.pickQuestion({ level: 1 + (k % 3), missCounts: {}, lastId: last }, Math.random);
      if (q.id === last || h.idsFor(q.level).indexOf(q.id) < 0) throw new Error(q.id);
      last = q.id;
    }
  });

  C.test('hantai: 読み上げ文', function () {
    var h = H();
    var w = h.makeQuestion('w:ookii:a', Math.random), s = h.makeQuestion('s:biru', Math.random);
    C.assertEq(h.speakText(w), '「大きい」の はんたいは？');
    C.assertEq(h.speakYomi(w), '「おおきい」の はんたいは？');
    C.assertEq(h.speakText(s), 'この ビルは {高|たか}い。｜どれが はんたいの 文かな？');
    C.assertEq(h.answerText(w), 'こたえは｜小さい｜だよ。｜つぎは できるよ！');
    C.assertEq(h.answerYomi(s), 'こたえは｜この ビルは ひくい。｜だよ。｜つぎは できるよ！');
    [1, 2, 3].forEach(function (lv) {
      h.idsFor(lv).forEach(function (id) {
        var q = h.makeQuestion(id, Math.random);
        // 「は」で始まる部品は作らない（ことばそのもの「はじまる」は ハジマルと読むので よい）
        [h.speakText(q), h.answerText(q)].forEach(function (t) {
          t.split('｜').forEach(function (p) { if (/^は/.test(p) && p !== q.choices[q.answer].t) throw new Error(id); });
        });
        C.assertEq(h.speakYomi(q).split('｜').length, h.speakText(q).split('｜').length);
      });
    });
  });

  C.test('hantai: progressFromLogs', function () {
    var h = H();
    C.assertEq(h.progressFromLogs([]), { level: 1, recent: [], missCounts: {} });
    var r = h.progressFromLogs([log('w:ookii:a', false, 1), log('3+4', false, 1, 'keisan'), log('w:ookii:a', false, 1), log('w:nagai:b', true, 1)]);
    C.assertEq(r.missCounts, { 'w:ookii:a': 2 });
    C.assertEq(r.recent, [false, false, true]);
    var up = [];
    for (var i = 0; i < 5; i++) up.push(log('w:nagai:a', true, 1));
    C.assertEq(h.progressFromLogs(up).level, 2);
    var top = [];
    for (var j = 0; j < 5; j++) top.push(log('s:biru', true, 3));
    C.assertEq(h.progressFromLogs(top).level, 3);
  });
})();

/* はんたい ことばの画面（hantai-screen.js）。#app が無いので描画はせず、状態だけを動かす */
(function () {
  'use strict';
  var C = window.Chiid;
  var S = function () { return C.benkyo.hantaiScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); }
  function wrongIndex(s, skip) { for (var i = 0; i < 4; i++) if (i !== s.answer && (skip || []).indexOf(i) < 0) return i; return -1; }
  function logsOf(pid) {
    return C.storage.getLogs(pid).then(function (l) { return l.filter(function (e) { return e.area === 'hantai'; }); });
  }
  function open(seed) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('はなこ', 'benkyo');
      C.storage.setActive(pid);
      (seed || []).forEach(function (e) { C.storage.logAnswer({ profileId: pid, area: 'hantai', itemId: e.itemId, correct: e.correct, level: e.level }); });
      return S().show({ profileId: pid }).then(function () { return pid; });
    });
  }
  function nt(name, fn) {
    C.test('hantaiScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  nt('最初はレベル1。正解で記録 true が1件', function () {
    return open().then(function (pid) {
      var s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.level, 1); C.assertEq(s.kind, 'word');
      S()._choose(s.answer);
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.message, '正かい！'); C.assertEq(s.solved, 1);
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, true); C.assertEq(logs[0].itemId, s.id); });
    });
  });
  nt('1回目まちがい→うすく。同じボタンをもう一度押しても tries は1のまま', function () {
    return open().then(function () {
      var s = S()._state(), w = wrongIndex(s);
      S()._choose(w);
      S()._choose(w);
      s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.tries, 1); C.assertEq(s.tried, [w]);
      C.assertEq(s.message, 'もう{一回|いっかい} やってみよう！');
    });
  });
  nt('2回目まちがい→答えを見せる。選択肢・つぎへの連打でも記録は1件、問題は1つだけ進む', function () {
    return open().then(function (pid) {
      var s = S()._state(), id = s.id, w1 = wrongIndex(s);
      S()._choose(w1);
      S()._choose(wrongIndex(s, [w1]));
      s = S()._state();
      C.assertEq(s.phase, 'reveal'); C.assertEq(s.revealed, true); C.assertEq(s.id, id);
      S()._choose(s.answer);                 // 見せている間の選択肢は何もしない
      C.assertEq(S()._state().phase, 'reveal');
      S()._next(); S()._next();
      s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.solved, 1);
      if (s.id === id) throw new Error('次の問題になっていない');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); C.assertEq(logs[0].itemId, id); });
    });
  });
  nt('5問正解で星1、10問でごほうび（星2）、もういっかいで0から', function () {
    return open().then(function () {
      for (var i = 0; i < 10; i++) { S()._choose(S()._state().answer); S()._flush(); }
      var s = S()._state();
      C.assertEq(s.phase, 'reward'); C.assertEq(s.solved, 10); C.assertEq(s.stars, 2);
      S()._again();
      s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.solved, 0); C.assertEq(s.stars, 0);
    });
  });
  nt('レベル3（記録から）は文の問題', function () {
    var seed = []; for (var i = 0; i < 3; i++) seed.push({ itemId: 's:biru', correct: true, level: 3 });
    return open(seed).then(function () {
      var s = S()._state();
      C.assertEq(s.level, 3); C.assertEq(s.kind, 'sentence');
    });
  });
  C.test('hantai: 親画面に「はんたい ことば」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/hantai: 'はんたい ことば'/.test(t), true);
    });
  });
})();
