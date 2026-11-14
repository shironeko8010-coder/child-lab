/* ずかん（subjects/zukan-data.js・zukan.js・zukan-art.js） */
(function () {
  'use strict';
  var C = window.Chiid;
  function D() { return C.zukanData; }
  function plain(t) { return String(t).replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$1'); }
  function gradeOf(ch) { var r = C.kanjiData.filter(function (k) { return k[0] === ch; })[0]; return r ? r[1] : 9; }
  function kanjiOk(t) {   // ルビの中の漢字は2年だけ、ルビの外の漢字は1年だけ
    var inside = (String(t).match(/\{([^|{}]+)\|/g) || []).join('');
    var outside = String(t).replace(/\{[^}]*\}/g, '');
    return (inside.match(/[一-龯]/g) || []).every(function (c) { return gradeOf(c) === 2; }) &&
           (outside.match(/[一-龯]/g) || []).every(function (c) { return gradeOf(c) === 1; });
  }
  function texts(p) {
    var out = [p.name, p.text, p.mame];
    p.qs.forEach(function (q) { out.push(q.ask, q.a); out = out.concat(q.wrong); });
    return out;
  }

  // 回ごとに書きかえる（1回目：9テーマ×12ページ。2回目・3回目で ふえる）
  var EXPECT = { themes: 9, perTheme: 12 };
  // はじめの108ページの id（記録をそのまま使うため、どの回でも 消さない）
  var OLD_IDS = 'lion kirin zou panda koara kangaru shimauma gorira tora usagi namakemono kaba penguin fukurou niwatori washi hato ahiru kujaku flamingo oumu hakuchou suzume hiyoko dangomushi semi kabutomushi tentoumushi chou ari mitsubachi batta kumo aomushi katatsumuri ka asagao himawari tulip sakura tanpopo saboten kinoko minitomato toumorokoshi ine momiji take zarigani medaka kame kujira iruka tako ika kani same fugu ebi rakko tirano burakio torikera sutego puterano ankiro supino raputoru futaba kaseki inseki kyoryu-tamago tsuki taiyou chikyu dosei nagareboshi hoshi niji kaminari yuki kumo-ten taifu tsuyu shinzou hone ha me mimi hana shita te ashi nou chi kushami shinkansen shoubousha kyukyusha patoka heri roketto fune hikouki densha basu jitensha torakuta'.split(' ');

  C.test('zukan-data: テーマとページの数（EXPECT）、id が重ならない、はじめの108ページが すべてある', function () {
    var d = D();
    C.assertEq(d.THEMES.length, EXPECT.themes);
    C.assertEq(d.THEMES.slice(0, 9).map(function (t) { return t.id; }), ['doubutsu', 'tori', 'mushi', 'shokubutsu', 'mizu', 'kyoryu', 'uchu', 'karada', 'norimono']);
    C.assertEq(d.PAGES.length, EXPECT.themes * EXPECT.perTheme);
    d.THEMES.forEach(function (t) { C.assertEq(d.PAGES.filter(function (p) { return p.theme === t.id; }).length, EXPECT.perTheme); });
    var ids = {};
    d.PAGES.forEach(function (p) { if (ids[p.id]) throw new Error(p.id); ids[p.id] = 1; });
    var miss = OLD_IDS.filter(function (id) { return !ids[id]; });
    if (miss.length) throw new Error('ない: ' + miss.join(' '));
  });

  C.test('zukan-data: どのページも 絵・説明・まめちしき（1〜2文）・問題3つ（答え1つ＋まちがい3つ、重ならない）', function () {
    D().PAGES.forEach(function (p) {
      var dots = (String(p.mame || '').match(/。/g) || []).length;
      if (!(p.pic || p.art) || !/。$/.test(p.text) || !/。$/.test(p.mame || '') || dots < 1 || dots > 2 || p.qs.length !== 3) throw new Error(p.id);
      p.qs.forEach(function (q) {
        var all = [q.a].concat(q.wrong).map(plain);
        if (q.wrong.length !== 3 || all.filter(function (x, i) { return all.indexOf(x) === i; }).length !== 4) throw new Error(p.id + ' ' + q.ask);
      });
    });
    C.assertEq(D().PAGES.filter(function (p) { return p.art; }).map(function (p) { return p.art; }).sort(),
      ['ankiro', 'asagao', 'dangomushi', 'futaba', 'kabutomushi', 'puterano', 'raputoru', 'semi', 'supino', 'sutego', 'torikera']);
  });

  C.test('zukan-data: 漢字は2年まで（ルビの中は2年の字だけ、外は1年の字だけ）', function () {
    var bad = [];
    D().THEMES.forEach(function (t) { if (!kanjiOk(t.name)) bad.push(t.name); });
    D().PAGES.forEach(function (p) { texts(p).forEach(function (t) { if (!kanjiOk(t)) bad.push(p.id + ': ' + t); }); });
    if (bad.length) throw new Error(bad.slice(0, 5).join(' / '));
  });

  C.test('zukan-data: 答えのことばは説明か まめちしきの中に出てくる（読めば答えられる）', function () {
    var bad = [];
    D().PAGES.forEach(function (p) {
      var body = plain(p.text + p.mame).replace(/\s/g, '');
      p.qs.forEach(function (q) {
        // いちばん長いことばの 頭の3字（短ければ全部）が説明にあればよい（「まきつける」と「まきつけて」のような形のちがいを許す）
        var words = plain(q.a).split(/[\s・]+/).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
        if (body.indexOf(words[0].slice(0, 3)) < 0) bad.push(p.id + ': ' + q.a);
      });
    });
    if (bad.length) throw new Error(bad.length + '件: ' + bad.slice(0, 6).join(' / '));
  });
  C.test('zukan-data: 3問目の答えは まめちしきの中に出てくる', function () {
    var bad = [];
    D().PAGES.forEach(function (p) {
      var body = plain(p.mame || '').replace(/\s/g, '');
      var words = plain(p.qs[2] ? p.qs[2].a : '?').split(/[\s・]+/).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
      if (body.indexOf(words[0].slice(0, 3)) < 0) bad.push(p.id);
    });
    if (bad.length) throw new Error(bad.length + '件: ' + bad.slice(0, 6).join(' / '));
  });
})();

/* ずかんの しくみ（subjects/zukan.js） */
(function () {
  'use strict';
  var C = window.Chiid;
  function Z() { return C.zukan; }

  C.test('zukan: cardsFromLogs と countFor', function () {
    var z = Z();
    var cards = z.cardsFromLogs([{ area: 'zukan', itemId: 'lion', correct: false }, { area: 'zukan', itemId: 'lion', correct: true },
      { area: 'zukan', itemId: 'kirin', correct: false }, { area: 'kanji', itemId: 'zou', correct: true }]);
    C.assertEq(cards, { lion: 'kira', kirin: 'card' });
    C.assertEq(z.countFor('doubutsu', cards), { got: 2, kira: 1, total: 12 });
  });

  C.test('zukan: pickPage は まだ → きらきらでない → どれでも の順、同じ回のページは出さない', function () {
    var z = Z(), ids = z.pagesOf('doubutsu').map(function (p) { return p.id; });
    var cards = {};
    ids.slice(0, 11).forEach(function (id) { cards[id] = 'kira'; });
    C.assertEq(z.pickPage('doubutsu', cards, [], Math.random).id, ids[11]);
    ids.forEach(function (id) { cards[id] = 'kira'; });
    cards[ids[3]] = 'card';
    C.assertEq(z.pickPage('doubutsu', cards, [], Math.random).id, ids[3]);
    ids.forEach(function (id) { cards[id] = 'kira'; });
    C.assertEq(z.pickPage('doubutsu', cards, ids.slice(0, 11), Math.random).id, ids[11]);
    C.assertEq(!!z.pickPage('doubutsu', cards, ids, Math.random), true);   // 残りがなくても止まらない
  });

  C.test('zukan: makeQuiz と check、answerText', function () {
    var z = Z(), page = z.pageById('lion'), quiz = z.makeQuiz(page, Math.random);
    C.assertEq(quiz.length, 3);
    quiz.forEach(function (it, i) {
      C.assertEq(it.ask, page.qs[i].ask);
      C.assertEq(it.choices.length, 4);
      C.assertEq(it.choices[it.answer], page.qs[i].a);
      C.assertEq(z.check(it, it.answer), true);
      C.assertEq(z.check(it, (it.answer + 1) % 4), false);
    });
    C.assertEq(z.answerText(quiz[0]), 'こたえは｜ネコ｜だよ。｜つぎは できるよ！');
    C.assertEq([z.AREA, z.PAGES_PER_ROUND], ['zukan', 3]);
  });

  C.test('zukan: 読み上げの部品は 助詞の「は」で始めない（「はね」「はっぱ」など ことばの頭の は は よい）', function () {
    var z = Z(), bad = [];
    var PART = /^は([\s、。？！]|$)/;
    C.zukanData.PAGES.forEach(function (p) {
      var quiz = z.makeQuiz(p, Math.random);
      [p.text, p.mame || ''].concat(quiz.map(function (it) { return it.ask; })).forEach(function (t) {
        t.split('｜').forEach(function (x) { if (PART.test(x)) bad.push(p.id + ': ' + x); });
      });
      quiz.forEach(function (it) {
        z.answerText(it).split('｜').forEach(function (x) { if (PART.test(x)) bad.push(p.id + ': ' + x); });
      });
    });
    if (bad.length) throw new Error(bad.slice(0, 5).join(' / '));
  });
})();

/* ずかんの絵（zukan-art.js） */
(function () {
  'use strict';
  var C = window.Chiid;
  C.test('zukan-art: ★のページの絵がすべてある', function () {
    C.zukanData.PAGES.filter(function (p) { return p.art; }).forEach(function (p) {
      var s = (C.zukanArt || {})[p.art];
      if (!s || !/^<svg viewBox="0 0 120 120"/.test(s) || !/<\/svg>$/.test(s)) throw new Error(p.art);
    });
  });
})();

/* ずかんの画面（zukan-screen.js）。#app が無いので描画はせず、状態だけを動かす */
(function () {
  'use strict';
  var C = window.Chiid;
  var S = function () { return C.benkyo.zukanScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); S()._twoSheets(null); }
  function logsOf(pid) { return C.storage.getLogs(pid).then(function (l) { return l.filter(function (e) { return e.area === 'zukan'; }); }); }
  function open(seed) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('はなこ', 'benkyo');
      C.storage.setActive(pid);
      S()._twoSheets(false);   // 画面の大きさで変わらないように、タブレットの1まいで動かす
      (seed || []).forEach(function (e) { C.storage.logAnswer({ profileId: pid, area: 'zukan', itemId: e.itemId, correct: e.correct, level: 1 }); });
      return S().show({ profileId: pid }).then(function () { return pid; });
    });
  }
  function wrongIndex(s, skip) { for (var i = 0; i < 4; i++) if (i !== s.answer && (skip || []).indexOf(i) < 0) return i; return -1; }
  function right() { S()._choose(S()._state().answer); S()._flush(); }
  function page(allRight) {   // 1ページぶん：よめた → 3問
    S()._ready();
    if (allRight) { right(); right(); right(); return; }
    var s = S()._state(), w1 = wrongIndex(s);
    S()._choose(w1); S()._choose(wrongIndex(s, [w1])); S()._next();
    right(); right();
  }
  function nt(name, fn) {
    C.test('zukanScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  nt('テーマ選び → ページ → よめた → 3問とも1回目で正解 → きらきらカード、記録1件 true', function () {
    return open().then(function (pid) {
      C.assertEq(S()._state().phase, 'themes');
      S()._theme('doubutsu');
      var s = S()._state();
      C.assertEq(s.phase, 'page'); C.assertEq(s.theme, 'doubutsu');
      S()._ready();
      C.assertEq(S()._state().phase, 'quiz'); C.assertEq(S()._state().qIndex, 0);
      right(); right();
      C.assertEq(S()._state().phase, 'quiz'); C.assertEq(S()._state().qIndex, 2);   // 3問目がある
      right();
      s = S()._state();
      C.assertEq(s.phase, 'card'); C.assertEq(s.got, 'kira');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, true); C.assertEq(logs[0].itemId, s.pageId); });
    });
  });
  nt('まちがえてもカード（ふつう）、記録1件 false。1回目のまちがいは うすく、2回目は答えを見せる', function () {
    return open().then(function (pid) {
      S()._theme('mushi'); S()._ready();
      var s = S()._state(), w1 = wrongIndex(s);
      S()._choose(w1); S()._choose(w1);
      C.assertEq(S()._state().tries, 1); C.assertEq(S()._state().tried, [w1]);
      S()._choose(wrongIndex(s, [w1]));
      C.assertEq(S()._state().phase, 'reveal'); C.assertEq(S()._state().revealed, true);
      S()._choose(s.answer);                               // 見せている間の選択肢は何もしない
      C.assertEq(S()._state().phase, 'reveal');
      S()._next(); S()._next();
      C.assertEq(S()._state().qIndex, 1);
      right(); right();
      s = S()._state();
      C.assertEq(s.phase, 'card'); C.assertEq(s.got, 'card');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });
  nt('カードの つぎへ の連打でもページは1つだけ進む', function () {
    return open().then(function () {
      S()._theme('tori'); page(true);
      var id = S()._state().pageId;
      S()._next(); S()._next();
      var s = S()._state();
      C.assertEq(s.phase, 'page'); C.assertEq(s.pagesDone, 1);
      if (s.pageId === id) throw new Error('同じページ');
    });
  });
  nt('3ページで ごほうび、もういっかいで同じテーマの次の回', function () {
    return open().then(function () {
      S()._theme('uchu');
      for (var i = 0; i < 3; i++) { page(i !== 1); S()._next(); }
      var s = S()._state();
      C.assertEq(s.phase, 'reward'); C.assertEq(s.pagesDone, 3);
      S()._again();
      s = S()._state();
      C.assertEq(s.phase, 'page'); C.assertEq(s.theme, 'uchu'); C.assertEq(s.pagesDone, 0);
    });
  });
  nt('回の途中で もどると テーマ選び。わたしのずかんへ行って戻っても 記録はふえない', function () {
    return open().then(function (pid) {
      S()._theme('karada'); S()._ready(); right();
      S()._back();
      C.assertEq(S()._state().phase, 'themes');
      S()._openBook();
      C.assertEq(S()._state().phase, 'book');
      S()._back();
      C.assertEq(S()._state().phase, 'themes');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 0); });
    });
  });
  nt('わたしのずかん：カードありのページだけ開ける', function () {
    return open([{ itemId: 'lion', correct: true }]).then(function () {
      S()._openBook();
      S()._bookTheme('doubutsu');
      S()._openCard('kirin');
      C.assertEq(S()._state().phase, 'book');
      S()._openCard('lion');
      var s = S()._state();
      C.assertEq(s.phase, 'bookPage'); C.assertEq(s.pageId, 'lion');
      S()._back();
      C.assertEq(S()._state().phase, 'book');
    });
  });
  nt('3問目を まちがえたら カード（きらきらに ならない）、記録1件 false', function () {
    return open().then(function (pid) {
      S()._theme('tori'); S()._ready(); right(); right();
      var s = S()._state();
      C.assertEq(s.qIndex, 2);
      S()._choose(wrongIndex(s)); S()._choose(s.answer); S()._flush();
      s = S()._state();
      C.assertEq(s.phase, 'card'); C.assertEq(s.got, 'card');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });
  nt('3問目の途中で やめたら 記録しない（もう一度 ひらくと テーマ選びから）', function () {
    return open().then(function (pid) {
      S()._theme('mizu'); S()._ready(); right(); right();
      C.assertEq(S()._state().qIndex, 2);
      return S().show({ profileId: pid }).then(function () {
        S()._twoSheets(false);
        C.assertEq(S()._state().phase, 'themes');
        return logsOf(pid);
      }).then(function (logs) { C.assertEq(logs.length, 0); });
    });
  });
  nt('ページには まめちしきがある', function () {
    return open().then(function () {
      S()._theme('doubutsu');
      var s = S()._state();
      C.assertEq(s.mame, C.zukan.pageById(s.pageId).mame);
      C.assertEq(!!s.mame, true);
    });
  });
  nt('スマホの大きさでは ページ → まめちしき → 問題', function () {
    return open().then(function () {
      S()._twoSheets(true);
      S()._theme('kyoryu');
      C.assertEq(S()._state().phase, 'page');
      S()._toMame();
      C.assertEq(S()._state().phase, 'mame');
      S()._toMame();                                     // 2回おしても かわらない
      C.assertEq(S()._state().phase, 'mame');
      S()._ready();
      C.assertEq(S()._state().phase, 'quiz'); C.assertEq(S()._state().qIndex, 0);
    });
  });
  nt('タブレットの大きさでは ページから すぐ問題（まめちしきの まいを通らない）', function () {
    return open().then(function () {
      S()._theme('uchu');
      S()._toMame();
      C.assertEq(S()._state().phase, 'page');
      S()._ready();
      C.assertEq(S()._state().phase, 'quiz');
    });
  });
  nt('スマホで1まい目の「よめた」は まめちしきへ（とばして問題へは行かない）', function () {
    return open().then(function () {
      S()._twoSheets(true);
      S()._theme('karada');
      S()._ready();
      C.assertEq(S()._state().phase, 'mame');
    });
  });
  nt('2まいの途中で1まいになっても 読めた！で問題へ', function () {
    return open().then(function () {
      S()._twoSheets(true);
      S()._theme('norimono'); S()._toMame();
      S()._twoSheets(false);
      S()._ready();
      C.assertEq(S()._state().phase, 'quiz');
    });
  });
  nt('わたしのずかんの ページにも まめちしき', function () {
    return open([{ itemId: 'lion', correct: true }]).then(function () {
      S()._openBook(); S()._bookTheme('doubutsu'); S()._openCard('lion');
      var s = S()._state();
      C.assertEq(s.phase, 'bookPage');
      C.assertEq(s.mame, C.zukan.pageById('lion').mame);
    });
  });
  C.test('zukan: 親画面に「ずかん」の名前がある', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) { C.assertEq(/zukan: 'ずかん'/.test(t), true); });
  });
})();

/* ずかん：仕上げのレビューで直した中身（正しいとも言える まちがいを入れない） */
(function () {
  'use strict';
  var C = window.Chiid;
  function q(id, n) { return C.zukanData.PAGES.filter(function (p) { return p.id === id; })[0].qs[n]; }
  C.test('zukan-data: 正しいとも言える選択肢を まちがいに入れない', function () {
    var no = [['te', 0, '10本'], ['chou', 1, '木の しる'], ['fugu', 1, 'こうら'], ['fugu', 1, 'つの'], ['tako', 1, '水だけ'], ['gorira', 0, 'ばしょ'], ['tentoumushi', 0, 'やさい'], ['kame', 2, '5年'], ['oumu', 2, '5年']];
    no.forEach(function (x) { if (q(x[0], x[1]).wrong.indexOf(x[2]) >= 0) throw new Error(x[0] + ' ' + x[2]); });
    C.assertEq(/やく/.test(q('taiyou', 2).ask), true);   // 「〜こ いじょう？」だと 小さい数も正しくなるので「やく 何こ？」
    var t = C.zukanData.PAGES.filter(function (p) { return p.id === 'tentoumushi'; })[0].text;
    C.assertEq(/ナナホシテントウ/.test(t), true);
  });
  C.test('zukan-data: 問いは「？」で終わる 文の形（「〜を？」のような 切れた問いに しない）', function () {
    C.zukanData.PAGES.forEach(function (p) {
      p.qs.forEach(function (it) { if (/(を|で|に|て)？$/.test(it.ask)) throw new Error(p.id + ': ' + it.ask); });
    });
  });
})();

/* ずかん：きらきらのページを もう一度やって まちがえたとき */
(function () {
  'use strict';
  var C = window.Chiid;
  var S = function () { return C.benkyo.zukanScreen; };
  C.test('zukanScreen: きらきらのページで まちがえても、きらきらのまま（got は keep、きらきらの文）', function () {
    C.storage._forceMemory(true);
    return C.storage.init().then(function () { return C.storage.resetAll(); }).then(function () {
      var pid = C.storage.addProfile('はなこ', 'benkyo');
      C.storage.setActive(pid);
      C.zukan.pagesOf('doubutsu').forEach(function (p) { C.storage.logAnswer({ profileId: pid, area: 'zukan', itemId: p.id, correct: true, level: 1 }); });
      return S().show({ profileId: pid, rng: function () { return 0; } });
    }).then(function () {
      S()._twoSheets(false);
      S()._theme('doubutsu'); S()._ready();
      var s = S()._state(), w = s.answer === 0 ? 1 : 0;
      S()._choose(w); S()._choose(s.answer); S()._flush();
      S()._choose(S()._state().answer); S()._flush();
      S()._choose(S()._state().answer); S()._flush();
      s = S()._state();
      C.assertEq(s.phase, 'card'); C.assertEq(s.got, 'keep');
      C.assertEq(C.zukan.TEXT.keep, 'きらきらカードは そのままだよ');
    }).then(function () { C.storage._forceMemory(false); S()._twoSheets(null); }, function (e) { C.storage._forceMemory(false); S()._twoSheets(null); throw e; });
  });
})();
