/* 勉強アプリ「どうとく」のテスト（データ・判定・画面の流れ・記録） */
(function () {
  'use strict';
  var C = window.Chiid;
  var D = function () { return C.doutoku; };
  function seq(vals) { var n = 0; return function () { var v = vals[n % vals.length]; n++; return v; }; }

  // 場面に出てくる文を全部
  function allTexts(s) {
    var out = [s.text, s.name, s.end || ''];
    s.choices.forEach(function (c) { out.push(c.text, c.reply); });
    return out;
  }

  C.test('doutoku: 定数', function () {
    C.assertEq(D().AREA, 'doutoku_b'); C.assertEq(D().AREA_THINK, 'doutoku_bk');
    C.assertEq(D().ROUND_SIZE, 10); C.assertEq(D().STAR_EVERY, 5);
  });

  C.test('doutoku: 場面は えらぶ29・かんがえる7。id と名前は重ならない', function () {
    var list = D().SCENES, ids = {}, names = {};
    C.assertEq(list.filter(function (s) { return s.kind === 'choice'; }).length, 29);
    C.assertEq(list.filter(function (s) { return s.kind === 'think'; }).length, 7);
    list.forEach(function (s) {
      if (ids[s.id]) throw new Error('id が重なる: ' + s.id);
      if (names[s.name]) throw new Error('名前が重なる: ' + s.name);
      ids[s.id] = names[s.name] = true;
    });
  });

  C.test('doutoku: どの場面も3択で、返事がある。えらぶ問題は望ましい答えが1つ', function () {
    D().SCENES.forEach(function (s) {
      if (s.choices.length !== 3) throw new Error('3択でない: ' + s.id);
      s.choices.forEach(function (c) { if (!c.text || !c.reply) throw new Error('文か返事がない: ' + s.id); });
      var goods = s.choices.filter(function (c) { return c.good === true; }).length;
      if (s.kind === 'choice' && goods !== 1) throw new Error('望ましい答えが1つでない: ' + s.id);
      if (s.kind === 'think') {
        if (s.choices.some(function (c) { return c.good !== null; })) throw new Error('かんがえる問題に正解がある: ' + s.id);
        if (!s.end) throw new Error('さいごの言葉がない: ' + s.id);
      }
      if (!s.pic || !s.pic.bg) throw new Error('絵がない: ' + s.id);
    });
  });

  C.test('doutoku: ふりがな なしで使う漢字は1年生の漢字だけ（2年生以上は {漢字|よみ}）', function () {
    var g1 = {};
    C.kanjiData.forEach(function (r) { if (r[1] === 1) g1[r[0]] = true; });
    D().SCENES.forEach(function (s) {
      allTexts(s).forEach(function (t) {
        var bare = String(t).replace(/\{[^|{}]+\|[^|{}]+\}/g, '');
        var m = bare.match(/[一-鿿]/g) || [];
        m.forEach(function (k) { if (!g1[k]) throw new Error('ふりがなが要る漢字「' + k + '」: ' + s.id + ' / ' + t); });
      });
    });
  });

  C.test('doutoku: 決めた言葉づかい（えまちゃん・パパや ママ・テレビ・ぼうはんブザー・おわかれ）', function () {
    var all = D().SCENES.map(function (s) { return allTexts(s).join(' '); }).join(' ');
    C.assertEq(all.indexOf('いもうと') < 0, true);
    C.assertEq(all.indexOf('ゲームを もっと') < 0, true);
    C.assertEq(all.indexOf('しんで') < 0, true);
    C.assertEq(D().get('shiranai').choices[0].reply.indexOf('ぼうはんブザー') >= 0, true);
    C.assertEq(D().get('neru').text.indexOf('テレビ') >= 0, true);
    C.assertEq(D().get('ema_omocha').text.indexOf('えまちゃん') >= 0, true);
    C.assertEq(D().get('t_owakare').text.indexOf('おわかれの ときが きたら') >= 0, true);
    C.assertEq(D().get('t_owakare').quiet, true);
    C.assertEq(D().get('dangomushi').name, 'ダンゴムシ');
    C.assertEq(D().get('t_yakusoku').end, 'パパや ママと はなして みてね。');
    // 「ともだちの いえ」の おうちの人は、ともだちの家の人なので そのまま
    C.assertEq(D().get('ojama').choices[0].reply.indexOf('おうちの 人') >= 0, true);
  });

  C.test('doutoku: ふりがなの記法 segments / yomi / plain', function () {
    C.assertEq(D().segments('ほかの {国|くに}から'), [{ t: 'ほかの ' }, { t: '国', y: 'くに' }, { t: 'から' }]);
    C.assertEq(D().yomi('ほかの {国|くに}から'), 'ほかの くにから');
    C.assertEq(D().plain('ほかの {国|くに}から'), 'ほかの 国から');
    C.assertEq(D().segments('ひらがな'), [{ t: 'ひらがな' }]);
  });

  C.test('doutoku: 声の文。えらぶ問題は「こんなとき どうする？」を足す', function () {
    C.assertEq(D().speakText(D().get('densha')), 'でんしゃに のって いるよ。 こんなとき どうする？');
    C.assertEq(D().speakText(D().get('t_kuni')).indexOf('{') < 0, true);
    C.assertEq(D().speakText(D().get('t_kuni')).indexOf('くにから') >= 0, true);
    C.assertEq(D().sentences('あいう。えお！ かき？'), ['あいう。', 'えお！', 'かき？']);
  });

  C.test('doutoku: choose の流れ（ほか→もう一度→望ましい）', function () {
    var s = D().get('densha'), a = D().newAttempt();
    var r1 = D().choose(a, s, 1);
    C.assertEq(r1.kind, 'retry');
    C.assertEq(D().replyText(s, r1).indexOf(D().RETRY) >= 0, true);
    C.assertEq(D().choose(a, s, 1).kind, 'ignore');        // 同じものは2回えらべない
    var r2 = D().choose(a, s, 0);
    C.assertEq(r2.kind, 'good'); C.assertEq(r2.firstTry, false);
    C.assertEq(D().choose(a, s, 2).kind, 'ignore');        // おわったあと
    C.assertEq(D().logEntry(s, a), { area: 'doutoku_b', itemId: 'でんしゃの なか', correct: false, level: 1 });
    var b = D().newAttempt();
    C.assertEq(D().choose(b, s, 0).firstTry, true);
    C.assertEq(D().logEntry(s, b).correct, true);
  });

  C.test('doutoku: かんがえる問題は、どれを選んでも受けとめて「考えた」記録', function () {
    var s = D().get('t_oni');
    [0, 1, 2].forEach(function (i) {
      var a = D().newAttempt(), r = D().choose(a, s, i);
      C.assertEq(r.kind, 'think');
      C.assertEq(D().replyText(s, r).indexOf('パパや ママと はなして みてね') >= 0, true);
      C.assertEq(D().logEntry(s, a), { area: 'doutoku_bk', itemId: 'いつも おに', correct: true, level: 1 });
    });
    var w = D().get('t_owakare'), r7 = D().choose(D().newAttempt(), w, 0);
    C.assertEq(D().replyText(w, r7).indexOf('いのちは ひとつ だけ') >= 0, true);
  });

  C.test('doutoku: pickRound は10問・重ならない・6問目と10問目が かんがえる問題', function () {
    for (var k = 0; k < 30; k++) {
      var list = D().pickRound({}, Math.random), seen = {};
      C.assertEq(list.length, 10);
      list.forEach(function (id, i) {
        if (seen[id]) throw new Error('重なる: ' + id);
        seen[id] = true;
        var kind = D().get(id).kind;
        C.assertEq([i, kind], [i, (i === 5 || i === 9) ? 'think' : 'choice']);
      });
    }
    var edge = D().pickRound({}, function () { return 0.9999999; });
    C.assertEq(edge.length, 10);
  });

  C.test('doutoku: pickRound は まだ出ていない場面 → 前にえらべなかった場面 の順', function () {
    var seen = {}, missed = {};
    D().SCENES.forEach(function (s) { seen[s.id] = 1; });
    delete seen.densha; delete seen.toshokan;            // まだ出ていない
    missed.omise = 3; missed.ike = 1;                     // 前にえらべなかった
    var list = D().pickRound({ seen: seen, missed: missed }, Math.random);
    C.assertEq(list.slice(0, 2).sort(), ['densha', 'toshokan']);
    C.assertEq(list.slice(2, 4), ['omise', 'ike']);
  });

  C.test('doutoku: progressFromLogs は場面の名前で数える', function () {
    var p = D().progressFromLogs([
      { area: 'doutoku_b', itemId: 'でんしゃの なか', correct: false },
      { area: 'doutoku_b', itemId: 'でんしゃの なか', correct: true },
      { area: 'doutoku_bk', itemId: 'いつも おに', correct: true },
      { area: 'doutoku', itemId: 'でんしゃの なか', correct: false },   // 知育の どうとく は数えない
      { area: 'doutoku_b', itemId: 'ない場面', correct: false }
    ]);
    C.assertEq(p.seen, { densha: 2, t_oni: 1 });
    C.assertEq(p.missed, { densha: 1 });
  });

  C.test('doutoku: arrange は もとの番号を持ち、3つとも出す', function () {
    var s = D().get('asa');
    var o = D().arrange(s, seq([0, 0.5, 0.9]));
    C.assertEq(o.map(function (c) { return c.idx; }).sort(), [0, 1, 2]);
    o.forEach(function (c) { C.assertEq(c.text, s.choices[c.idx].text); });
  });

  C.test('doutokuScreen: 絵はどの場面でも描ける（部品の名前が全部ある）', function () {
    var Sc = C.benkyo.doutokuScreen;
    D().SCENES.forEach(function (s) {
      if (!Sc._bg[s.pic.bg]) throw new Error('背景がない: ' + s.pic.bg);
      (s.pic.p || []).forEach(function (p) { if (!Sc._people[p[0]]) throw new Error('人がない: ' + p[0]); });
      (s.pic.o || []).forEach(function (p) { if (!Sc._props[p[0]]) throw new Error('小物がない: ' + p[0]); });
      var svg = Sc._picture(s.pic);
      if (svg.indexOf('<svg') !== 0 || svg.indexOf('NaN') >= 0 || svg.indexOf('undefined') >= 0) throw new Error('絵がおかしい: ' + s.id);
    });
  });
})();

(function () {
  'use strict';
  var C = window.Chiid;
  var S = function () { return C.benkyo.doutokuScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); }
  function logsOf(pid) {
    return C.storage.getLogs(pid).then(function (l) {
      return l.filter(function (e) { return e.area === 'doutoku_b' || e.area === 'doutoku_bk'; });
    });
  }
  function open() {
    return fresh().then(function () {
      var pid = C.storage.addProfile('たろう', 'benkyo');
      C.storage.setActive(pid);
      return S().show({ profileId: pid }).then(function () { return pid; });
    });
  }
  function posOf(good) {
    var cs = S()._state().choices;
    for (var i = 0; i < cs.length; i++) if (cs[i].good === good) return i;
    return -1;
  }
  // いまの問題を、1回目で答えておわらせる（かんがえる問題は どれでも）
  function answerGood() {
    var s = S()._state();
    S()._pick(s.kind === 'think' ? 0 : posOf(true));
  }
  function dt(name, fn) {
    C.test('doutokuScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  dt('ほかの答え→理由・もう一度えらべる→望ましい答えで記録 false が1件', function () {
    return open().then(function (pid) {
      var s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.kind, 'choice'); C.assertEq(s.choices.length, 3);
      S()._pick(posOf(false));
      s = S()._state();
      C.assertEq(s.result, 'retry'); C.assertEq(s.phase, 'question'); C.assertEq(s.solved, 0); C.assertEq(s.tried.length, 1);
      S()._pick(posOf(true));
      s = S()._state();
      C.assertEq(s.result, 'good'); C.assertEq(s.phase, 'feedback'); C.assertEq(s.solved, 1); C.assertEq(s.waiting, true);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 1); C.assertEq(logs[0].area, 'doutoku_b'); C.assertEq(logs[0].correct, false);
        C.assertEq(logs[0].itemId, C.doutoku.get(s.id).name);
      });
    });
  });

  dt('1回目で望ましい答え→記録 true。「つぎへ」で次の場面', function () {
    return open().then(function (pid) {
      var first = S()._state().id;
      answerGood();
      C.assertEq(S()._state().phase, 'feedback');
      S()._pick(0);                                  // 待ちのあいだは えらべない（何も起きない）
      C.assertEq(S()._state().solved, 1);
      S()._next();
      var s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.index, 1); C.assertEq(s.id !== first, true);
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, true); });
    });
  });

  dt('10問で区切り。5問ごとに星、かんがえる問題は doutoku_bk に true', function () {
    return open().then(function (pid) {
      for (var i = 0; i < 10; i++) {
        var s = S()._state();
        C.assertEq(s.index, i);
        C.assertEq(s.kind, (i === 5 || i === 9) ? 'think' : 'choice');
        answerGood();
        if (s.kind === 'think') C.assertEq(S()._state().result, 'think');
        C.assertEq(S()._state().waiting, true);       // かんがえる問題も「つぎへ」で進む
        if (i === 4) C.assertEq(S()._state().stars, 1);
        S()._next();
      }
      var e = S()._state();
      C.assertEq(e.phase, 'reward'); C.assertEq(e.solved, 10); C.assertEq(e.stars, 2);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 10);
        var th = logs.filter(function (l) { return l.area === 'doutoku_bk'; });
        C.assertEq(th.length, 2);
        th.forEach(function (l) { C.assertEq(l.correct, true); });
        S()._again();
        var s2 = S()._state();
        C.assertEq(s2.phase, 'question'); C.assertEq(s2.solved, 0); C.assertEq(s2.stars, 0);
        // 2回目は、まだ出ていない場面から出す
        s2.list.forEach(function (id) {
          if (e.list.indexOf(id) >= 0 && C.doutoku.get(id).kind === 'choice') throw new Error('1回目と同じ場面: ' + id);
        });
      });
    });
  });

  dt('利用時間を超えていたら、次へ進むときに止まる', function () {
    var orig = C.benkyo.checkRest;
    C.benkyo.checkRest = function () { return true; };
    return open().then(function () {
      answerGood();
      S()._next();
      C.assertEq(S()._state().phase, 'rest');
    }).then(function () { C.benkyo.checkRest = orig; }, function (e) { C.benkyo.checkRest = orig; throw e; });
  });
})();
