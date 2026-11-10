/* かんじ（subjects/kanji-data.js・subjects/kanji.js・kana-pad.js・kanji-screen.js）のテスト */
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

  /* ---------- ひらがなキーボード（kana-pad.js） ---------- */
  var P = C.kanaPad;
  C.test('kanaPad: 行は10こ。や行は やゆよ、わ行は わをん', function () {
    C.assertEq(P.ROWS.length, 10);
    C.assertEq(P.ROWS.map(function (r) { return r.name; }).join(''), 'あ行か行さ行た行な行は行ま行や行ら行わ行');
    C.assertEq(P.rowById('ya').chars, 'やゆよ');
    C.assertEq(P.rowById('wa').chars, 'わをん');
    C.assertEq(P.rowById('xx'), null);
  });
  C.test('kanaPad: 「゛゜ ちいさい」の切り替え（押すたびに順に変わり、最初にもどる）', function () {
    C.assertEq([P.cycle('は'), P.cycle('ば'), P.cycle('ぱ')], ['ば', 'ぱ', 'は']);
    C.assertEq([P.cycle('つ'), P.cycle('っ'), P.cycle('づ')], ['っ', 'づ', 'つ']);
    C.assertEq([P.cycle('や'), P.cycle('ゃ')], ['ゃ', 'や']);
    C.assertEq([P.cycle('ゆ'), P.cycle('よ'), P.cycle('か'), P.cycle('が')], ['ゅ', 'ょ', 'が', 'か']);
    C.assertEq([P.cycle('し'), P.cycle('ち'), P.cycle('ふ'), P.cycle('あ'), P.cycle('わ')], ['じ', 'ぢ', 'ぶ', 'ぁ', 'ゎ']);
    C.assertEq([P.cycle('ん'), P.cycle('な'), P.cycle('ま'), P.cycle('を'), P.cycle('')], [null, null, null, null, null]);
  });
  C.test('kanaPad: 行を選ぶ→字を入れると行えらびに戻る。違う行を押せば切り替わる', function () {
    var m = new P.Model(3);
    C.assertEq(m.row, null);
    C.assertEq(m.selectRow('ka'), true);
    C.assertEq(m.row, 'ka');
    C.assertEq(m.selectRow('sa'), true);
    C.assertEq(m.row, 'sa');
    C.assertEq(m.selectRow('zz'), false);
    C.assertEq(m.row, 'sa');
    m.input('さ');
    C.assertEq([m.value, m.row], ['さ', null]);
  });
  C.test('kanaPad: 「きゅう」「じゅう」「がっこう」「ぱん」を入れられる（濁点・小さい字）', function () {
    function type(max, keys) {
      var m = new P.Model(max);
      keys.forEach(function (k) { if (k === '*') m.mod(); else m.input(k); });
      return m.value;
    }
    C.assertEq(type(3, ['き', 'ゆ', '*', 'う']), 'きゅう');
    C.assertEq(type(3, ['し', '*', 'ゆ', '*', 'う']), 'じゅう');
    C.assertEq(type(4, ['か', '*', 'つ', '*', 'こ', 'う']), 'がっこう');
    C.assertEq(type(2, ['は', '*', '*', 'ん']), 'ぱん');
    C.assertEq(type(2, ['は', '*', '*', '*']), 'は');          // 3回で もとにもどる
    C.assertEq(type(2, ['つ', '*', '*']), 'づ');
  });
  C.test('kanaPad: 字数の上限・けす・変えられない字・空で゛', function () {
    var m = new P.Model(2);
    C.assertEq(m.mod(), false);                  // 空のときは何も起きない
    C.assertEq(m.back(), false);
    C.assertEq(m.input('な'), true);
    C.assertEq(m.mod(), false);                  // な は変えられない
    C.assertEq(m.input('ま'), true);
    C.assertEq(m.isFull(), true);
    C.assertEq(m.input('あ'), false);            // 上限をこえて入らない
    C.assertEq(m.value, 'なま');
    C.assertEq(m.back(), true);
    C.assertEq(m.value, 'な');
    m.clear();
    C.assertEq([m.value, m.row], ['', null]);
    var u = new P.Model(0);                      // 0 は上限なし
    for (var i = 0; i < 8; i++) u.input('あ');
    C.assertEq(u.value.length, 8);
    m.setMax(1); m.input('か'); m.input('き');
    C.assertEq(m.value, 'か');
  });
  C.test('kanaPad: 描画（ボタンを押して入力・こたえる）', function () {
    var got = null;
    var pad = P.render({ max: 3, onSubmit: function (v) { got = v; } });
    var root = pad.el;
    C.assertEq(root.querySelectorAll('.kp-row').length, 10);
    C.assertEq(pad.slots.querySelectorAll('.kp-slot').length, 3);
    C.assertEq(root.querySelector('.kp-row small').textContent, 'あいうえお');
    function rowBtn(id) { return root.querySelector('.kp-row[data-row="' + id + '"]'); }
    function chars() { return Array.prototype.filter.call(root.querySelectorAll('.kp-char'), function (b) { return !b.hidden; }); }
    C.assertEq(chars().length, 0);
    rowBtn('ka').click();
    C.assertEq(chars().map(function (b) { return b.textContent; }).join(''), 'かきくけこ');
    rowBtn('ya').click();                        // 違う行に切り替え
    C.assertEq(chars().map(function (b) { return b.textContent; }).join(''), 'やゆよ');
    rowBtn('ka').click();
    chars()[1].click();                          // き
    C.assertEq(chars().length, 0);               // 行えらびに戻る
    rowBtn('ya').click();
    chars()[1].click();                          // ゆ
    root.querySelector('.kp-mod').click();       // ゅ
    rowBtn('a').click();
    chars()[2].click();                          // う
    C.assertEq(pad.model.value, 'きゅう');
    C.assertEq(pad.slots.textContent, 'きゅう');
    root.querySelector('.kp-del').click();
    C.assertEq(pad.model.value, 'きゅ');
    root.querySelector('.kp-ok').click();
    C.assertEq(got, 'きゅ');
    pad.showAnswer('きゅう', 'reveal');          // 見せているあいだは押せない
    rowBtn('ka').click();
    C.assertEq(chars().length, 0);
    C.assertEq(pad.slots.querySelector('.kp-slot').className.indexOf('reveal') >= 0, true);
    pad.reset(2);
    C.assertEq(pad.slots.querySelectorAll('.kp-slot').length, 2);
    C.assertEq(pad.model.value, '');
  });

  /* ---------- 問題づくり・出題 ---------- */
  C.test('kanji: 240字すべて・読みすべてで、よみ/かき の問題が作れる', function () {
    K.ITEMS.forEach(function (it) {
      ['yomi', 'kaki'].forEach(function (kind) {
        for (var yi = 0; yi < it.yomi.length; yi++) {
          var q = K.makeQuestion(it.k, kind, seeded(yi), yi);
          C.assertEq([q.k, q.kind, q.r, q.ans, q.area, q.id],
            [it.k, kind, it.yomi[yi].r, kind === 'yomi' ? it.yomi[yi].r : it.k, kind === 'yomi' ? 'kanjiYomi' : 'kanjiKaki', it.k + (kind === 'yomi' ? '（よみ）' : '（かき）')]);
        }
      });
    });
  });
  C.test('kanji: 読みはキーボードで入れられる字だけ（濁点・小さい字は ゛゜ で作れる）', function () {
    var base = {};
    P.ROWS.forEach(function (r) { r.chars.split('').forEach(function (ch) { base[ch] = true; }); });
    function reachable(ch) {
      if (base[ch]) return true;
      return Object.keys(base).some(function (b) {
        var x = b;
        for (var i = 0; i < 3; i++) { x = P.cycle(x); if (!x) return false; if (x === ch) return true; }
        return false;
      });
    }
    C.kanjiData.forEach(function (row) {
      row[2].forEach(function (y) {
        y[0].split('').forEach(function (ch) { if (!reachable(ch)) throw new Error('入れられない字: ' + row[0] + ' ' + y[0]); });
      });
    });
  });
  C.test('kanji: roundKinds は よみ5・かき5 をまぜる', function () {
    for (var s = 0; s < 20; s++) {
      var ks = K.roundKinds(seeded(s));
      C.assertEq(ks.length, 10);
      C.assertEq(ks.filter(function (k) { return k === 'yomi'; }).length, 5);
      C.assertEq(ks.filter(function (k) { return k === 'kaki'; }).length, 5);
    }
    [0, 0.9999999].forEach(function (r) { C.assertEq(K.roundKinds(function () { return r; }).length, 10); });
  });
  C.test('kanji: pickItem はレベルの範囲（いまのグループ＋それまで）だけ、直前の字は出さない。形は opts.kind', function () {
    for (var lv = 1; lv <= 12; lv++) {
      var allowed = [];
      for (var i = 0; i < lv; i++) allowed = allowed.concat(K.GROUPS[i]);
      for (var n = 0; n < 60; n++) {
        var kind = n % 2 ? 'kaki' : 'yomi';
        var q = K.pickItem({ level: lv, missCounts: {}, lastK: K.GROUPS[lv - 1][0], kind: kind }, Math.random);
        if (allowed.indexOf(q.k) < 0) throw new Error('レベル' + lv + ' の範囲外: ' + q.k);
        if (q.k === K.GROUPS[lv - 1][0]) throw new Error('直前の字が出た');
        C.assertEq(q.kind, kind);
      }
    }
  });
  C.test('kanji: pickItem は学年をえらぶと、その学年の字だけ', function () {
    [1, 2].forEach(function (g) {
      for (var n = 0; n < 100; n++) {
        var q = K.pickItem({ level: 1, grade: g, missCounts: {} }, Math.random);
        C.assertEq([q.k, q.grade], [q.k, g]);
      }
    });
  });
  C.test('kanji: pickItem は苦手な字を多めに出す（かきの苦手も数える）', function () {
    var miss = { '山（かき）': 30 };
    var hit = 0;
    for (var n = 0; n < 200; n++) if (K.pickItem({ level: 1, missCounts: miss }, Math.random).k === '山') hit++;
    if (hit < 60) throw new Error('苦手の山が少ない: ' + hit + '/200');
  });

  /* ---------- よみの採点 ---------- */
  C.test('kanji: judgeYomi（例の言葉での読みだけ正解。別の正しい読みは other、字数が足りないと short）', function () {
    var q = K.makeQuestion('生', 'yomi', seeded(1), 1);          // なま（□たまご）
    C.assertEq(q.ans, 'なま');
    C.assertEq(K.judgeYomi(q, 'なま'), 'correct');
    C.assertEq(K.judgeYomi(q, 'せい'), 'other');
    C.assertEq(K.judgeYomi(q, 'なか'), 'wrong');
    C.assertEq(K.judgeYomi(q, 'な'), 'short');
    C.assertEq(K.judgeYomi(q, ''), 'empty');
    C.assertEq(K.judgeYomi(q, null), 'empty');
    var q2 = K.makeQuestion('九', 'yomi', seeded(1), 0);
    C.assertEq(K.judgeYomi(q2, 'きゅう'), 'correct');
    C.assertEq(K.judgeYomi(q2, 'きゆう'), 'wrong');               // 小さい字にしないと ちがう
  });
  C.test('kanji: submitYomi は 空・short・other を数えず、1回目まちがい→retry、2回目→reveal', function () {
    var q = K.makeQuestion('生', 'yomi', seeded(1), 1);
    var a = K.newAttempt();
    C.assertEq(K.submitYomi(a, q, '').kind, 'empty');
    C.assertEq(K.submitYomi(a, q, 'な').kind, 'short');
    C.assertEq(K.submitYomi(a, q, 'せい').kind, 'other');
    C.assertEq(a.tries, 0);
    C.assertEq(K.submitYomi(a, q, 'なか').kind, 'retry');
    C.assertEq(a.tries, 1);
    C.assertEq(K.submitYomi(a, q, 'せい').kind, 'other');
    C.assertEq(K.submitYomi(a, q, 'なか').kind, 'reveal');
    var b = K.newAttempt();
    C.assertEq(K.submitYomi(b, q, 'なま').kind, 'correct');
  });
  C.test('kanji: 声の文', function () {
    var q = K.makeQuestion('花', 'kaki', seeded(1), 0);
    C.assertEq(K.speakText(q), 'はな。 はなが さく の、 はな を かこう');
    C.assertEq(K.speakText(K.makeQuestion('花', 'yomi', seeded(1), 0)), 'この かんじの よみかたは？');
  });
  C.test('kanji: progressFromLogs（よみ・かきの記録でレベル。学年えらび・3択の版はレベルに使わず、苦手には数える）', function () {
    var logs = [
      { area: 'kanji', itemId: '空（よみ）', correct: false, level: 9 },
      { area: 'kanjiYomi', itemId: '花（よみ）', correct: false, level: 3 },
      { area: 'kanjiKaki', itemId: '花（かき）', correct: true, level: 3 },
      { area: 'kanjiKaki', itemId: '春（かき）', correct: false, level: 3, grade: 2 },
      { area: 'kuku', itemId: '3×4', correct: false, level: 9 }
    ];
    var p = K.progressFromLogs(logs);
    C.assertEq(p.level, 3);
    C.assertEq(p.recent, [false, true]);
    C.assertEq(p.missCounts, { '空（よみ）': 1, '花（よみ）': 1, '春（かき）': 1 });
    C.assertEq(K.progressFromLogs([]).level, 1);
    C.assertEq(K.progressFromLogs([{ area: 'kanji', itemId: '空（よみ）', correct: true, level: 9 }]).level, 1);   // 3択の版のレベルは引き継がない
    var up = [];
    for (var i = 0; i < 5; i++) up.push({ area: 'kanjiYomi', itemId: '一（よみ）', correct: true, level: 12 });
    C.assertEq(K.progressFromLogs(up).level, 12);   // 12より上には行かない
  });

  /* ---------- 親画面：書けなかった字 ---------- */
  C.test('parent: かんじ（かき）で × の字を、多い順に kakiMiss に出す', function () {
    function L(id, ok, area) { return { profileId: 'x', area: area, itemId: id, correct: ok, level: 1, ts: 1 }; }
    var s = C.parent.summarize([
      L('生（かき）', false, 'kanjiKaki'), L('右（かき）', false, 'kanjiKaki'), L('生（かき）', false, 'kanjiKaki'),
      L('花（かき）', true, 'kanjiKaki'), L('生（よみ）', false, 'kanjiYomi')
    ], []);
    C.assertEq(s.hasKaki, true);
    C.assertEq(s.kakiMiss, [{ k: '生', misses: 2 }, { k: '右', misses: 1 }]);
    C.assertEq(s.byArea.kanjiYomi.total, 1);
    C.assertEq(s.byArea.kanjiKaki.total, 4);
    C.assertEq(C.parent.summarize([L('あ', false, 'hiragana')], []).hasKaki, false);
  });

  /* ---------- 画面（#app が無いので描画はせず、状態だけを動かす） ---------- */
  var S = function () { return C.benkyo.kanjiScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); }
  // いまの問題に答える（1問おわるまで）。ok=true：よみは正しい読み、かきは書いて「かけた」。false：よみは2回まちがい、かきは「もういっかい」
  function answer(ok) {
    S()._flush();
    var s = S()._state();
    if (s.kind === 'yomi') {
      if (ok) S()._answer(s.ans);
      else { S()._answer(wrongOf(s)); S()._answer(wrongOf(s)); }   // 2回まちがえて、こたえを見る
    } else {
      S()._draw();
      S()._done();
      S()._grade(!!ok);
      if (!ok) S()._done();      // なぞりの練習 →「つぎへ」
    }
  }
  function wrongOf(s) {
    // 読みと同じ字数で、どの正しい読みでもない言葉
    var w = '';
    for (var i = 0; i < s.ans.length; i++) w += 'ぬ';
    return K.hasReading(K.byKanji(s.k), w) ? w.replace(/ぬ$/, 'ね') : w;
  }
  function logsOf(pid) {
    return C.storage.getLogs(pid).then(function (l) { return l.filter(function (e) { return /^kanji/.test(e.area); }); });
  }
  function open(seed, rng) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('たろう', 'benkyo');
      C.storage.setActive(pid);
      (seed || []).forEach(function (e) { C.storage.logAnswer({ profileId: pid, area: e.area || 'kanjiYomi', itemId: e.itemId, correct: e.correct, level: e.level }); });
      return S().show({ profileId: pid, rng: rng }).then(function () { return pid; });
    });
  }
  // 最初の問題が kind になるまで開き直す（決まった乱数で）
  function openKind(kind) {
    var s = 0;
    function tryOne() {
      return open(null, seeded(++s)).then(function (pid) {
        if (S()._state().kind === kind || s > 40) return pid;
        return tryOne();
      });
    }
    return tryOne();
  }
  function kt(name, fn) {
    C.test('kanjiScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  kt('最初はレベル1（1グループ目の字）。10問の形は よみ5・かき5', function () {
    return open().then(function () {
      var s = S()._state();
      C.assertEq(s.phase, 'question');
      C.assertEq(s.level, 1);
      C.assertEq(K.GROUPS[0].indexOf(s.k) >= 0, true);
      C.assertEq(s.kinds.filter(function (k) { return k === 'yomi'; }).length, 5);
      C.assertEq(s.kind, s.kinds[0]);
      var seen = [];
      for (var i = 0; i < 10; i++) { S()._flush(); seen.push(S()._state().kind); answer(true); }
      C.assertEq(seen, s.kinds);
    });
  });
  kt('よみ：正解で記録 true が1件（area kanjiYomi）', function () {
    return openKind('yomi').then(function (pid) {
      var s = S()._state();
      S()._answer(s.ans);
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.message, 'せいかい！'); C.assertEq(s.solved, 1);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 1); C.assertEq(logs[0].area, 'kanjiYomi'); C.assertEq(logs[0].correct, true);
        C.assertEq(logs[0].itemId, s.id); C.assertEq(logs[0].level, 1);
      });
    });
  });
  kt('よみ：空・字数が足りない は数えない。1回目まちがい→はげまし、2回目→こたえ（記録 false が1件）', function () {
    return openKind('yomi').then(function (pid) {
      var id = S()._state().id;
      S()._answer('');
      var s = S()._state();
      C.assertEq([s.phase, s.tries, s.message], ['question', 0, 'ひらがなを えらんでね']);
      if (s.ans.length > 1) {
        S()._answer(s.ans.charAt(0));
        s = S()._state();
        C.assertEq([s.phase, s.tries, s.message], ['question', 0, 'ますを ぜんぶ うめてね']);
      }
      S()._answer(wrongOf(s));
      s = S()._state();
      C.assertEq([s.phase, s.tries, s.message, s.input], ['question', 1, 'もういっかい やってみよう！', '']);
      S()._answer(wrongOf(s));
      s = S()._state();
      C.assertEq(s.phase, 'feedback'); C.assertEq(s.id, id); C.assertEq(s.revealed, true);
      C.assertEq(s.message, 'こたえは 「' + s.ans + '」 だよ。つぎは できるよ！');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });
  kt('かき：書いて「できた」→見比べ→「かけた」で記録 true（area kanjiKaki）', function () {
    return openKind('kaki').then(function (pid) {
      var s = S()._state();
      C.assertEq(s.kind, 'kaki');
      S()._grade(true);                         // 見比べの前は押せない
      C.assertEq(S()._state().phase, 'question');
      S()._draw();
      C.assertEq(S()._state().ink, true);
      S()._clear();
      C.assertEq(S()._state().ink, false);
      S()._draw();
      S()._done();
      s = S()._state();
      C.assertEq([s.phase, s.message], ['check', 'よく みくらべてね。かけたかな？']);
      S()._grade(true);
      s = S()._state();
      C.assertEq([s.phase, s.graded, s.solved, s.message], ['feedback', true, 1, 'すごい！ よく かけたね！']);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 1); C.assertEq(logs[0].area, 'kanjiKaki'); C.assertEq(logs[0].correct, true); C.assertEq(logs[0].itemId, s.id);
      });
    });
  });
  kt('かき：「もういっかい」で記録 false、なぞりの練習→「つぎへ」で次の問題', function () {
    return openKind('kaki').then(function (pid) {
      var id = S()._state().id;
      S()._draw(); S()._done(); S()._grade(false);
      var s = S()._state();
      C.assertEq([s.phase, s.graded, s.solved, s.ink], ['practice', false, 1, false]);
      C.assertEq(s.message, 'おてほんを なぞって、もういちど かいてみよう');
      S()._draw();                              // 練習で書いても記録しない
      S()._done();                              // 「つぎへ」
      s = S()._state();
      C.assertEq(s.phase, 'question');
      C.assertEq(s.id !== id || s.solved === 1, true);
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });
  kt('かき：何も書かずに「できた」→お手本を見せて練習（記録 false）', function () {
    return openKind('kaki').then(function (pid) {
      S()._done();
      var s = S()._state();
      C.assertEq([s.phase, s.graded, s.solved], ['practice', false, 1]);
      C.assertEq(s.message, 'みて おぼえよう！ おてほんを なぞってみよう');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); C.assertEq(logs[0].area, 'kanjiKaki'); });
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
  kt('まちがい（よみ）・もういっかい（かき）を混ぜても、10問で区切る', function () {
    return open().then(function () {
      for (var i = 0; i < 10; i++) answer(i % 2 === 0);
      S()._flush();
      C.assertEq(S()._state().phase, 'reward');
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
  kt('よみで1回まちがえてから学年を切り替えると false が1件。まちがえる前なら記録しない', function () {
    return openKind('yomi').then(function (pid) {
      S()._selectGrade(1);
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 0);
        var s = S()._state();
        if (s.kind === 'yomi') S()._answer(wrongOf(s));
        var tried = S()._state().tries;
        S()._selectGrade(null);
        C.assertEq(S()._state().grade, null);
        return logsOf(pid).then(function (l2) { C.assertEq(l2.length, tried ? 1 : 0); });
      });
    });
  });
  kt('記録からレベルを組み立てて始める（レベル6で記録あり→レベル6、範囲内の字）', function () {
    return open([{ area: 'kanjiYomi', itemId: '春（よみ）', correct: true, level: 6 }, { area: 'kanjiKaki', itemId: '夏（かき）', correct: false, level: 6 }]).then(function () {
      var s = S()._state();
      C.assertEq(s.level, 6);
      var allowed = [];
      for (var i = 0; i < 6; i++) allowed = allowed.concat(K.GROUPS[i]);
      C.assertEq(allowed.indexOf(s.k) >= 0, true);
    });
  });
  C.test('benkyo: SUBJECTS の kanji は有効で、よみ・かき', function () {
    var s = C.benkyo.SUBJECTS.filter(function (x) { return x.id === 'kanji'; })[0];
    C.assertEq(s.enabled, true); C.assertEq(s.sub, 'よみ・かき');
  });
})();
