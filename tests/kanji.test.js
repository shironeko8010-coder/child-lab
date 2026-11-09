/* かんじ（subjects/kanji-data.js・subjects/kanji.js・kanji-screen.js）のテスト */
(function () {
  'use strict';
  var C = window.Chiid;
  var K = C.kanji;

  // 正解表：文部科学省「学年別漢字配当表」（2020年度からの現行版）。データとは別に、配当表の順（音読みの五十音順）で持つ
  var REF1 = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';
  var REF2 = '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話';

  function sorted(s) { return s.split('').sort().join(''); }
  function seeded(n) {           // 決まった乱数（くり返し確かめるため）
    var x = n * 9301 + 49297;
    return function () { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  }

  /* ---------- 教材データの正確さ ---------- */
  C.test('kanji-data: 正解表そのものが 80字・160字で重複なし', function () {
    C.assertEq(REF1.length, 80);
    C.assertEq(REF2.length, 160);
    C.assertEq(new Set((REF1 + REF2).split('')).size, 240);
  });
  C.test('kanji-data: 1年生80字・2年生160字、字の重複なし', function () {
    var d = C.kanjiData;
    C.assertEq(d.length, 240);
    C.assertEq(d.filter(function (r) { return r[1] === 1; }).length, 80);
    C.assertEq(d.filter(function (r) { return r[1] === 2; }).length, 160);
    var seen = {};
    d.forEach(function (r) {
      if (seen[r[0]]) throw new Error('重複: ' + r[0]);
      seen[r[0]] = true;
      if (r[0].length !== 1) throw new Error('1字でない: ' + r[0]);
    });
  });
  C.test('kanji-data: 字と学年が配当表と一致する', function () {
    var g1 = C.kanjiData.filter(function (r) { return r[1] === 1; }).map(function (r) { return r[0]; }).join('');
    var g2 = C.kanjiData.filter(function (r) { return r[1] === 2; }).map(function (r) { return r[0]; }).join('');
    C.assertEq(sorted(g1), sorted(REF1));
    C.assertEq(sorted(g2), sorted(REF2));
  });
  C.test('kanji-data: 読みはひらがな、例の言葉は □ が1つで、ほかはひらがなだけ', function () {
    var KANA = /^[ぁ-ゖー]+$/;
    var EX = /^[ぁ-ゖー □]+$/;
    C.kanjiData.forEach(function (r) {
      var ys = r[2];
      if (!ys || ys.length < 1 || ys.length > 2) throw new Error('読みの数: ' + r[0]);
      ys.forEach(function (y) {
        if (!KANA.test(y[0])) throw new Error('読みがひらがなでない: ' + r[0] + ' ' + y[0]);
        if (!EX.test(y[1]) || y[1].split('□').length !== 2) throw new Error('例の言葉: ' + r[0] + ' ' + y[1]);
      });
      if (ys.length === 2 && ys[0][0] === ys[1][0]) throw new Error('同じ読みが2つ: ' + r[0]);
      (r[3] || []).forEach(function (k) {
        if (!K.byKanji(k)) throw new Error('形の似た字がデータにない: ' + r[0] + ' → ' + k);
        if (k === r[0]) throw new Error('形の似た字が自分: ' + r[0]);
      });
    });
  });
  C.test('kanji-data: 同じ字に同じ例の言葉が2つない・ほかの字と例の言葉と読みが全く同じものがない', function () {
    var seen = {};
    C.kanjiData.forEach(function (r) {
      r[2].forEach(function (y) {
        var key = y[0] + '|' + y[1];
        if (seen[key]) throw new Error('読みと例の言葉が同じ: ' + seen[key] + ' と ' + r[0] + '（' + key + '）');
        seen[key] = r[0];
      });
    });
  });

  /* ---------- グループとレベル ---------- */
  C.test('kanji: グループは20字ずつ12こ。1〜4が1年生、5〜12が2年生', function () {
    C.assertEq(K.MAX_LEVEL, 12);
    C.assertEq(K.GROUPS.length, 12);
    K.GROUPS.forEach(function (g, i) {
      C.assertEq(g.length, 20);
      var want = i < 4 ? 1 : 2;
      g.forEach(function (k) { C.assertEq([k, K.byKanji(k).grade], [k, want]); });
    });
    C.assertEq(K.gradeOfLevel(4), 1);
    C.assertEq(K.gradeOfLevel(5), 2);
    C.assertEq(K.firstLevelOf(2), 5);
  });
  C.test('kanji: itemIdOf と parseId', function () {
    C.assertEq(K.itemIdOf('花', 'yomi'), '花（よみ）');
    C.assertEq(K.itemIdOf('花', 'kaki'), '花（かき）');
    C.assertEq(K.parseId('花（かき）'), { k: '花', kind: 'kaki' });
    C.assertEq(K.parseId('花'), null);
    C.assertEq(K.parseId('鬼（よみ）'), null);
    C.assertEq(K.parseId(null), null);
    C.assertEq(K.missByKanji({ '花（よみ）': 2, '花（かき）': 1, '3×4': 5 }), { '花': 3 });
  });

  /* ---------- 選択肢の決まり ---------- */
  function checkQuestion(q, label) {
    if (!q) throw new Error('問題が作れない: ' + label);
    if (q.choices.length !== 3) throw new Error('選択肢が3つでない: ' + label + ' ' + q.choices.join(','));
    if (new Set(q.choices).size !== 3) throw new Error('選択肢が重複: ' + label + ' ' + q.choices.join(','));
    if (q.choices.indexOf(q.ans) < 0) throw new Error('こたえが選択肢にない: ' + label);
    var it = K.byKanji(q.k);
    q.choices.forEach(function (c) {
      if (c === q.ans) return;
      if (q.kind === 'yomi' && K.hasReading(it, c)) throw new Error('よみ: ほかの選択肢が正しい読み: ' + label + ' ' + c);
      if (q.kind === 'kaki' && K.hasReading(K.byKanji(c), q.r)) throw new Error('かき: 同じ読みの字が選択肢: ' + label + ' ' + c);
    });
  }
  C.test('kanji: 240字すべて・読みすべて・よみ/かき で、3択が作れ、まぎらわしい選択肢が出ない（乱数を変えて5回）', function () {
    K.ITEMS.forEach(function (it, n) {
      ['yomi', 'kaki'].forEach(function (kind) {
        for (var yi = 0; yi < it.yomi.length; yi++) {
          for (var s = 0; s < 5; s++) {
            var q = K.makeQuestion(it.k, kind, seeded(n * 31 + s * 7 + yi), yi);
            checkQuestion(q, it.k + ' ' + kind + ' ' + it.yomi[yi].r);
            C.assertEq(q.r, it.yomi[yi].r);
            C.assertEq(q.ans, kind === 'yomi' ? it.yomi[yi].r : it.k);
          }
        }
      });
    });
  });
  C.test('kanji: 乱数のはし（0 と 0.999…）でも問題が作れる', function () {
    [0, 0.9999999].forEach(function (r) {
      var rng = function () { return r; };
      K.ITEMS.forEach(function (it) {
        checkQuestion(K.makeQuestion(it.k, 'yomi', rng), it.k + ' yomi');
        checkQuestion(K.makeQuestion(it.k, 'kaki', rng), it.k + ' kaki');
      });
    });
  });
  C.test('kanji: 形の似た字が指定されていれば、1つ選択肢に入る（右 → 石か左）', function () {
    for (var s = 0; s < 10; s++) {
      var q = K.makeQuestion('右', 'kaki', seeded(s));
      C.assertEq(q.choices.indexOf('石') >= 0 || q.choices.indexOf('左') >= 0, true);
    }
  });

  /* ---------- 出題 ---------- */
  C.test('kanji: pickItem はレベルの範囲（いまのグループ＋それまで）だけ、直前の字は出さない', function () {
    for (var lv = 1; lv <= 12; lv++) {
      var allowed = [];
      for (var i = 0; i < lv; i++) allowed = allowed.concat(K.GROUPS[i]);
      for (var n = 0; n < 60; n++) {
        var q = K.pickItem({ level: lv, missCounts: {}, lastK: K.GROUPS[lv - 1][0] }, Math.random);
        if (allowed.indexOf(q.k) < 0) throw new Error('レベル' + lv + ' の範囲外: ' + q.k);
        if (q.k === K.GROUPS[lv - 1][0]) throw new Error('直前の字が出た');
        checkQuestion(q, q.k);
      }
    }
  });
  C.test('kanji: pickItem はレベル1で、1グループ目の字だけ。よみ・かき の両方が出る', function () {
    var kinds = {};
    for (var n = 0; n < 100; n++) {
      var q = K.pickItem({ level: 1, missCounts: {} }, Math.random);
      C.assertEq(K.GROUPS[0].indexOf(q.k) >= 0, true);
      kinds[q.kind] = true;
    }
    C.assertEq(Object.keys(kinds).sort(), ['kaki', 'yomi']);
  });
  C.test('kanji: pickItem は学年をえらぶと、その学年の字だけ', function () {
    [1, 2].forEach(function (g) {
      for (var n = 0; n < 100; n++) {
        var q = K.pickItem({ level: 1, grade: g, missCounts: {} }, Math.random);
        C.assertEq([q.k, q.grade], [q.k, g]);
      }
    });
  });
  C.test('kanji: pickItem は苦手な字を多めに出す', function () {
    var miss = { '山（よみ）': 30 };
    var hit = 0;
    for (var n = 0; n < 200; n++) if (K.pickItem({ level: 1, missCounts: miss }, Math.random).k === '山') hit++;
    if (hit < 60) throw new Error('苦手の山が少ない: ' + hit + '/200');
  });

  /* ---------- 判定 ---------- */
  C.test('kanji: submit は 1回目まちがい→retry、同じ選択肢はもう数えない、2回目→reveal', function () {
    var q = K.makeQuestion('花', 'yomi', seeded(1), 0);
    var wrong = q.choices.filter(function (c) { return c !== q.ans; });
    var a = K.newAttempt();
    C.assertEq(K.submit(a, q, '').kind, 'empty');
    C.assertEq(K.submit(a, q, 'ほげ').kind, 'empty');   // 選択肢にないもの
    C.assertEq(K.submit(a, q, wrong[0]).kind, 'retry');
    C.assertEq(K.submit(a, q, wrong[0]).kind, 'empty');
    C.assertEq(a.tries, 1);
    C.assertEq(K.submit(a, q, wrong[1]).kind, 'reveal');
    C.assertEq(K.submit(K.newAttempt(), q, 'はな').kind, 'correct');
  });
  C.test('kanji: 声の文', function () {
    var q = K.makeQuestion('花', 'kaki', seeded(1), 0);
    C.assertEq(K.speakText(q), 'はな。 はなが さく の、 はな は どれ？');
    C.assertEq(K.speakText(K.makeQuestion('花', 'yomi', seeded(1), 0)), 'この かんじの よみかたは？');
  });
  C.test('kanji: progressFromLogs（学年えらびの記録はレベルに使わない）', function () {
    var logs = [
      { area: 'kanji', itemId: '花（よみ）', correct: false, level: 3 },
      { area: 'kanji', itemId: '花（かき）', correct: true, level: 3 },
      { area: 'kanji', itemId: '春（よみ）', correct: false, level: 3, grade: 2 },
      { area: 'kuku', itemId: '3×4', correct: false, level: 9 }
    ];
    var p = K.progressFromLogs(logs);
    C.assertEq(p.level, 3);
    C.assertEq(p.recent, [false, true]);
    C.assertEq(p.missCounts, { '花（よみ）': 1, '春（よみ）': 1 });
    C.assertEq(K.progressFromLogs([]).level, 1);
    var up = [];
    for (var i = 0; i < 5; i++) up.push({ area: 'kanji', itemId: '一（よみ）', correct: true, level: 12 });
    C.assertEq(K.progressFromLogs(up).level, 12);   // 12より上には行かない
  });

  /* ---------- 画面（#app が無いので描画はせず、状態だけを動かす） ---------- */
  var S = function () { return C.benkyo.kanjiScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); }
  function answer(ok) {
    S()._flush();
    var s = S()._state();
    var pick = ok ? s.ans : s.choices.filter(function (c) { return c !== s.ans && s.wrong.indexOf(c) < 0; })[0];
    S()._choose(pick);
  }
  function logsOf(pid) {
    return C.storage.getLogs(pid).then(function (l) { return l.filter(function (e) { return e.area === 'kanji'; }); });
  }
  function open(seed) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('たろう', 'benkyo');
      C.storage.setActive(pid);
      (seed || []).forEach(function (e) { C.storage.logAnswer({ profileId: pid, area: 'kanji', itemId: e.itemId, correct: e.correct, level: e.level }); });
      return S().show({ profileId: pid }).then(function () { return pid; });
    });
  }
  function kt(name, fn) {
    C.test('kanjiScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  kt('最初はレベル1（1グループ目の字）。正解で記録 true が1件', function () {
    return open().then(function (pid) {
      var s = S()._state();
      C.assertEq(s.phase, 'question');
      C.assertEq(s.level, 1);
      C.assertEq(K.GROUPS[0].indexOf(s.k) >= 0, true);
      C.assertEq(s.choices.length, 3);
      answer(true);
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.message, 'せいかい！'); C.assertEq(s.solved, 1);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, true); C.assertEq(logs[0].itemId, s.id); C.assertEq(logs[0].level, 1);
      });
    });
  });
  kt('1回目まちがい→はげまし、2回目まちがい→こたえを見せる（記録 false が1件）', function () {
    return open().then(function (pid) {
      var id = S()._state().id;
      answer(false);
      var s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.message, 'もういっかい やってみよう！'); C.assertEq(s.tries, 1); C.assertEq(s.wrong.length, 1);
      S()._choose(s.wrong[0]);                 // うすくなった選択肢は、押しても数えない
      C.assertEq(S()._state().tries, 1);
      answer(false);
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.id, id); C.assertEq(s.revealed, true);
      C.assertEq(s.message, 'こたえは 「' + s.ans + '」 だよ。つぎは できるよ！');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });
  kt('5問正解でレベル2へ。10問でごほうび、星2つ。もういっかいで0から', function () {
    return open().then(function () {
      for (var i = 0; i < 5; i++) answer(true);
      S()._flush();
      var s = S()._state();
      C.assertEq(s.level, 2); C.assertEq(s.stars, 1);
      for (var j = 0; j < 5; j++) answer(true);
      S()._flush();
      s = S()._state();
      C.assertEq(s.phase, 'reward'); C.assertEq(s.solved, 10); C.assertEq(s.stars, 2);
      S()._again();
      s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.solved, 0); C.assertEq(s.stars, 0); C.assertEq(s.level, 3);
    });
  });
  kt('学年をえらぶと、その学年の字に取りかわる。記録に grade が付き、レベルは動かない', function () {
    return open().then(function (pid) {
      S()._selectGrade(2);
      var s = S()._state();
      C.assertEq(s.grade, 2); C.assertEq(K.byKanji(s.k).grade, 2);
      for (var i = 0; i < 5; i++) answer(true);
      S()._flush();
      s = S()._state();
      C.assertEq(s.level, 1);
      C.assertEq(K.byKanji(s.k).grade, 2);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 5);
        logs.forEach(function (e) { C.assertEq(e.grade, 2); });
      });
    });
  });
  kt('まちがえる前に学年を切り替えたときは記録しない。1回まちがえてから切り替えると false が1件', function () {
    return open().then(function (pid) {
      S()._selectGrade(1);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 0);
        answer(false);
        S()._selectGrade(null);
        C.assertEq(S()._state().grade, null);
        return logsOf(pid);
      }).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });
  kt('記録からレベルを組み立てて始める（レベル6で記録あり→レベル6、2年生の字）', function () {
    return open([{ itemId: '春（よみ）', correct: true, level: 6 }, { itemId: '夏（かき）', correct: false, level: 6 }]).then(function () {
      var s = S()._state();
      C.assertEq(s.level, 6);
      var allowed = [];
      for (var i = 0; i < 6; i++) allowed = allowed.concat(K.GROUPS[i]);
      C.assertEq(allowed.indexOf(s.k) >= 0, true);
    });
  });
  C.test('benkyo: SUBJECTS の kanji は有効で、よみ・かきわけ', function () {
    var s = C.benkyo.SUBJECTS.filter(function (x) { return x.id === 'kanji'; })[0];
    C.assertEq(s.enabled, true); C.assertEq(s.sub, 'よみ・かきわけ');
  });
})();
