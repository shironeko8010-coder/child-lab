/* えい語（勉強）のテスト */
(function () {
  'use strict';
  var C = window.Chiid;

  /* ---------- 英語の声（shared/voice-en.js） ---------- */
  var US = { name: 'US', lang: 'en-US', localService: true, default: false };
  var GB = { name: 'GB', lang: 'en-GB', localService: true, default: false };
  var NET = { name: 'Net', lang: 'en-US', localService: false, default: true };
  var JA = { name: 'J', lang: 'ja-JP', localService: true, default: true };
  function fake(voices) {
    var f = { spoken: [], cancels: 0, auto: false,
      getVoices: function () { return voices; },
      speak: function (u) { f.spoken.push(u); if (f.auto) setTimeout(function () { if (u.onend) u.onend(); }, 10); },
      cancel: function () { f.cancels++; } };
    return f;
  }
  function done() { C.voiceEn._override(null); }

  C.test('voiceEn: 通信しない en-US を選ぶ', function () {
    var V = C.voiceEn;
    V._override(fake([JA, NET, GB, US]));
    try {
      C.assertEq(V.available(), true);
      C.assertEq(V.voiceName(), 'US');
    } finally { done(); }
  });

  C.test('voiceEn: 英語の声がなければ 使えない', function () {
    var V = C.voiceEn, f = fake([JA, NET]);
    V._override(f);
    C.assertEq(V.available(), false);
    return V.speak('dog').then(function () { C.assertEq(f.spoken.length, 0); done(); }, function (e) { done(); throw e; });
  });

  C.test('voiceEn: speak は 速さ0.8・終われば解決', function () {
    var V = C.voiceEn, f = fake([US]); f.auto = true;
    V._override(f);
    return V.speak('dog').then(function () {
      C.assertEq(f.spoken[0].text, 'dog'); C.assertEq(f.spoken[0].rate, 0.8); C.assertEq(f.spoken[0].voice.name, 'US');
      done();
    }, function (e) { done(); throw e; });
  });

  C.test('voiceEn: 終わらなくても 決めた時間で解決する', function () {
    var V = C.voiceEn, f = fake([US]);
    V._override(f, { maxMs: 50 });
    var t0 = Date.now();
    return V.speak('dog').then(function () { C.assertEq(Date.now() - t0 < 2000, true); done(); }, function (e) { done(); throw e; });
  });

  C.test('voiceEn: 読む前に ずんだもんを止める', function () {
    var V = C.voiceEn, f = fake([US]), orig = C.voice.cancel, n = 0; f.auto = true;
    C.voice.cancel = function () { n++; };
    V._override(f);
    return V.speak('cat').then(function () { C.voice.cancel = orig; done(); C.assertEq(n >= 1, true); },
      function (e) { C.voice.cancel = orig; done(); throw e; });
  });

  C.test('voiceEn: 声があとから届いても 使えるようになる', function () {
    var V = C.voiceEn, list = [], f = fake(list);
    V._override(f);
    try {
      C.assertEq(V.available(), false);
      list.push(US);
      if (f.onvoiceschanged) f.onvoiceschanged();
      C.assertEq(V.available(), true);
    } finally { done(); }
  });

  C.test('voiceEn: cancel で 読み上げを止め、BGM を もどす', function () {
    var V = C.voiceEn, f = fake([US]), orig = C.sfx.duck, ducks = [];
    C.sfx.duck = function (on) { ducks.push(on); };
    V._override(f);
    try {
      V.speak('dog');
      V.cancel();
      C.assertEq(f.cancels >= 1, true);
      C.assertEq(ducks[ducks.length - 1], false);
    } finally { C.sfx.duck = orig; done(); }
  });

  /* ---------- ことばと問題（eigo-data.js・eigo.js） ---------- */
  function seeded(n) { var s = n; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function gradeOf(ch) { var r = C.kanjiData.filter(function (k) { return k[0] === ch; })[0]; return r ? r[1] : 9; }
  function kanjiOk(t) {   // ルビの中の漢字は2年だけ、ルビの外の漢字は1年だけ
    var inside = (t.match(/\{([^|{}]+)\|/g) || []).join(''), outside = t.replace(/\{[^|{}]+\|[^|{}]+\}/g, '');
    return (inside.match(/[一-龯]/g) || []).every(function (c) { return gradeOf(c) === 2; }) &&
           (outside.match(/[一-龯]/g) || []).every(function (c) { return gradeOf(c) === 1; });
  }
  function E() { return C.eigo; }
  function D() { return C.eigoData; }
  var THEME_IDS = ['animal', 'color', 'number', 'food', 'fruit', 'body', 'greeting', 'family', 'school', 'vehicle', 'nature', 'shape'];

  C.test('eigo: ことば', function () {
    var d = D();
    C.assertEq(d.WORDS.length, 126);
    C.assertEq(d.THEMES.map(function (t) { return t.id; }).join(','), THEME_IDS.join(','));
    C.assertEq(THEME_IDS.map(function (id) { return d.WORDS.filter(function (w) { return w.theme === id; }).length; }).join(','), '10,10,20,10,11,10,7,8,10,10,10,10');
    var ids = {}, pics = {};
    d.WORDS.forEach(function (w) {
      if (ids[w.id]) throw new Error('id 重なり ' + w.id);
      ids[w.id] = 1;
      if (w.id !== w.theme + ':' + w.en) throw new Error('id の形 ' + w.id);
      if (!/^[a-z]+( [a-z]+)*$/.test(w.en)) throw new Error('英語 ' + w.en);
      if (!/^[ぁ-ゖー ]+$/.test(w.ja)) throw new Error('意味 ' + w.id);
      if (!!w.pic === !!w.art) throw new Error('絵は pic か art の一方 ' + w.id);
      var p = w.pic || w.art;
      if (pics[p]) throw new Error('絵が重なる ' + w.id + ' / ' + pics[p]);
      pics[p] = w.id;
      if (w.pic && w.pic.indexOf('‍') >= 0) throw new Error('ZWJ ' + w.id);
    });
  });

  C.test('eigo: makeKiku のカード', function () {
    var e = E();
    THEME_IDS.concat(['all']).forEach(function (th) {
      [1, 2, 3].forEach(function (lv) {
        for (var n = 0; n < 200; n++) {
          var q = e.makeKiku(lv, th, seeded(n + lv * 1000), {});
          if (q.kind !== 'word') { if (th !== 'all') throw new Error(th + ' で ABC が出た'); continue; }
          var want = lv === 1 ? 3 : 4;
          if (q.cards.length !== want) throw new Error(th + ' lv' + lv + ' 枚数');
          if (q.cards.filter(function (c) { return c.id === q.answer.id; }).length !== 1) throw new Error('答えが1まいでない');
          var u = {}; q.cards.forEach(function (c) { if (u[c.id]) throw new Error('重なり'); u[c.id] = 1; });
          if (th !== 'all' && q.answer.theme !== th) throw new Error('テーマちがい');
          if (lv < 3 && q.cards.some(function (c) { return c.theme !== q.answer.theme; })) throw new Error('lv' + lv + ' ほかのテーマ');
        }
      });
    });
  });

  C.test('eigo: makeKiku レベル3は 同じ文字で始まることば', function () {
    var e = E(), checked = 0;
    for (var n = 0; n < 200; n++) {
      var q = e.makeKiku(3, 'animal', seeded(n * 13), {});
      if (q.answer.en !== 'bear' && q.answer.en !== 'bird') continue;
      checked++;
      var same = q.cards.filter(function (c) { return c.id !== q.answer.id && c.en.charAt(0) === 'b'; }).length;
      if (same < 1) throw new Error('b で始まるカードがない #' + n);
    }
    C.assertEq(checked > 0, true);
  });

  C.test('eigo: ぜんぶで10問 同じ問題が出ない', function () {
    var e = E(), used = {}, rng = seeded(7);
    for (var i = 0; i < 10; i++) {
      var q = e.makeKiku(2, 'all', rng, { used: used }), id = e.itemIdOf(q);
      if (used[id]) throw new Error('2回目 ' + id);
      used[id] = 1;
    }
  });

  C.test('eigo: きく の ABC', function () {
    var e = E();
    [1, 2, 3].forEach(function (lv) {
      for (var n = 0; n < 200; n++) {
        var q = e.makeKiku(lv, 'abc', seeded(n + lv * 777), {});
        if (q.choices.length !== 4) throw new Error('lv' + lv + ' 4つでない');
        var u = {}; q.choices.forEach(function (c) { if (u[c]) throw new Error('重なり'); u[c] = 1; });
        if (q.choices.filter(function (c) { return c === q.answer; }).length !== 1) throw new Error('答え');
        q.choices.forEach(function (c) { if (lv === 1 ? !/^[A-Z]$/.test(c) : !/^[a-z]$/.test(c)) throw new Error('lv' + lv + ' 文字の形 ' + c); });
        if (lv === 1 && (q.kind !== 'upper' || q.say !== q.answer)) throw new Error('lv1');
        if (lv === 2 && (q.kind !== 'lower' || q.say !== q.answer.toUpperCase())) throw new Error('lv2');   // 文字の名前は 大文字で読ませる
        if (lv === 3 && (q.kind !== 'first' || / /.test(q.word.en) || q.answer !== q.word.en.charAt(0) || q.say !== q.word.en)) throw new Error('lv3');
      }
    });
  });

  C.test('eigo: ABC の まぎらわしい文字', function () {
    var e = E(), checked = 0;
    [2, 3].forEach(function (lv) {
      for (var n = 0; n < 400; n++) {
        var q = e.makeKiku(lv, 'abc', seeded(n * 31 + lv), {});
        if (q.answer !== 'b') continue;
        checked++;
        if (!q.choices.some(function (c) { return c === 'd' || c === 'p' || c === 'q'; })) throw new Error('lv' + lv + ' #' + n);
      }
    });
    C.assertEq(checked > 0, true);
  });

  C.test('eigo: ぜんぶに ABC も ことばも まざる', function () {
    var e = E(), abc = 0, word = 0;
    for (var n = 0; n < 300; n++) { var q = e.makeKiku(2, 'all', seeded(n * 7 + 3), {}); if (q.kind === 'word') word++; else abc++; }
    C.assertEq(abc > 10 && word > abc, true);
  });

  C.test('eigo: よむ は つづりを読んで 絵を選ぶ', function () {
    var e = E();
    THEME_IDS.concat(['all']).forEach(function (th) {
      [1, 2, 3].forEach(function (lv) {
        for (var n = 0; n < 100; n++) {
          var q = e.makeYomi(lv, th, seeded(n + lv * 500), {});
          if (q.kind !== 'read') throw new Error('kind');
          if (q.cards.length !== (lv === 1 ? 3 : 4)) throw new Error(th + ' lv' + lv + ' 枚数');
          if (q.cards.filter(function (c) { return c.id === q.answer.id; }).length !== 1) throw new Error('答え');
          if (th !== 'all' && q.answer.theme !== th) throw new Error('テーマちがい');
          if (lv === 1 && (q.answer.en.length > 4 || / /.test(q.answer.en)) && e.wordsOf(th).some(function (w) { return w.en.length <= 4 && !/ /.test(w.en); })) throw new Error('lv1 は短いことば ' + q.answer.en);
        }
      });
    });
  });

  C.test('eigo: check・itemIdOf', function () {
    var e = E(), a = e.makeKiku(2, 'abc', seeded(5), {});
    C.assertEq(e.itemIdOf(a), 'abc:lower:' + a.answer);
    C.assertEq(e.check(a, a.answer), true);
    C.assertEq(e.check(a, a.choices.filter(function (c) { return c !== a.answer; })[0]), false);
    var k = e.makeKiku(1, 'animal', seeded(5), {});
    C.assertEq(e.check(k, k.answer), true); C.assertEq(e.itemIdOf(k), k.answer.id);
    var y = e.makeYomi(1, 'food', seeded(5), {});
    C.assertEq(e.check(y, y.answer), true); C.assertEq(e.itemIdOf(y), y.answer.id);
  });

  C.test('eigo: progressFromLogs は きく・よむ 別々', function () {
    var e = E(), logs = [];
    for (var i = 0; i < 5; i++) logs.push({ area: 'eigoKiku', itemId: 'animal:dog', correct: true, level: 1 });
    C.assertEq(e.progressFromLogs(logs, 'eigoKiku').level, 2);
    C.assertEq(e.progressFromLogs(logs, 'eigoYomi').level, 1);
  });

  C.test('eigo: TEXT の漢字', function () {
    var e = E();
    Object.keys(e.TEXT).forEach(function (k) { if (!kanjiOk(e.TEXT[k])) throw new Error(k + ': ' + e.TEXT[k]); });
  });

  /* ---------- えい語の画面（テストのページには #app が無いので、状態だけ動く） ---------- */
  function S() { return C.benkyo.eigoScreen; }
  function withEnv(logs, voices, fn) {   // 記録の読み書きと 英語の声を、テストの中だけ差しかえる
    var st = C.storage, og = st.getLogs, ol = st.logAnswer, saved = [], f = fake(voices); f.auto = true;
    st.getLogs = function () { return Promise.resolve(logs || []); };
    st.logAnswer = function (o) { saved.push(o); return Promise.resolve(); };
    C.voiceEn._override(f, { maxMs: 20 });
    function back() { st.getLogs = og; st.logAnswer = ol; C.voiceEn._override(null); }
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { back(); return v; }, function (e) { back(); throw e; });
  }
  function rightIndex(q) { return q.cards ? q.cards.map(function (c) { return c.id; }).indexOf(q.answer.id) : q.choices.indexOf(q.answer); }
  function wrongIndex(q, n) { var len = q.cards ? q.cards.length : q.choices.length, out = []; for (var i = 0; i < len; i++) if (i !== rightIndex(q)) out.push(i); return out[n || 0]; }

  C.test('eigoScreen: えらぶ → きく → テーマ → 問題', function () {
    return withEnv([], [US], function () {
      return S().show({ profileId: 'p' }).then(function () {
        C.assertEq(S()._state().phase, 'mode');
        S()._mode('kiku'); C.assertEq(S()._state().phase, 'theme');
        S()._theme('animal');
        var s = S()._state();
        C.assertEq(s.phase, 'question'); C.assertEq(s.q.cards.length, 3); C.assertEq(s.q.answer.theme, 'animal');
      });
    });
  });

  C.test('eigoScreen: 正解で記録 true', function () {
    return withEnv([], [US], function (saved) {
      return S().show({ profileId: 'p' }).then(function () {
        S()._mode('kiku'); S()._theme('animal');
        var q = S()._state().q;
        S()._choose(rightIndex(q));
        C.assertEq(saved.length, 1);
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct, saved[0].level]), JSON.stringify(['eigoKiku', q.answer.id, true, 1]));
      });
    });
  });

  C.test('eigoScreen: 2回まちがえると 答えを光らせて 記録 false', function () {
    return withEnv([], [US], function (saved) {
      return S().show({ profileId: 'p' }).then(function () {
        S()._mode('kiku'); S()._theme('animal');
        var q = S()._state().q;
        S()._choose(wrongIndex(q, 0)); C.assertEq(S()._state().phase, 'question');
        S()._choose(wrongIndex(q, 1));
        C.assertEq(S()._state().phase, 'reveal');
        C.assertEq(saved.length, 1); C.assertEq(saved[0].correct, false);
      });
    });
  });

  C.test('eigoScreen: 正解のあとの連打は 記録1回', function () {
    return withEnv([], [US], function (saved) {
      return S().show({ profileId: 'p' }).then(function () {
        S()._mode('kiku'); S()._theme('food');
        var q = S()._state().q;
        S()._choose(rightIndex(q)); S()._choose(wrongIndex(q, 0)); S()._choose(wrongIndex(q, 1)); S()._choose(rightIndex(q));
        C.assertEq(saved.length, 1); C.assertEq(S()._state().solved, 1);
      });
    });
  });

  C.test('eigoScreen: 10問で ごほうび', function () {
    return withEnv([], [US], function (saved) {
      return S().show({ profileId: 'p' }).then(function () {
        S()._mode('kiku'); S()._theme('all');
        for (var i = 0; i < 10; i++) { S()._choose(rightIndex(S()._state().q)); S()._next(); }
        C.assertEq(S()._state().phase, 'reward'); C.assertEq(S()._state().stars, 2); C.assertEq(saved.length, 10);
      });
    });
  });

  C.test('eigoScreen: よむ は テーマを選び、つづりを見て 絵を選ぶ', function () {
    return withEnv([], [US], function (saved) {
      return S().show({ profileId: 'p' }).then(function () {
        S()._mode('yomi'); C.assertEq(S()._state().phase, 'theme');
        S()._theme('animal');
        var q = S()._state().q;
        C.assertEq(q.kind, 'read'); C.assertEq(q.answer.theme, 'animal'); C.assertEq(q.cards.length, 3);
        S()._choose(rightIndex(q));
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct]), JSON.stringify(['eigoYomi', q.answer.id, true]));
      });
    });
  });

  C.test('eigoScreen: きく の ABC テーマ', function () {
    return withEnv([], [US], function (saved) {
      return S().show({ profileId: 'p' }).then(function () {
        S()._mode('kiku'); S()._theme('abc');
        var q = S()._state().q;
        C.assertEq(q.kind, 'upper');
        S()._choose(rightIndex(q));
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId]), JSON.stringify(['eigoKiku', 'abc:upper:' + q.answer]));
      });
    });
  });

  C.test('eigoScreen: よむ に ABC のテーマは ない', function () {
    return withEnv([], [US], function () {
      return S().show({ profileId: 'p' }).then(function () {
        S()._mode('yomi'); S()._theme('abc');
        C.assertEq(S()._state().phase, 'theme');
      });
    });
  });

  C.test('eigoScreen: 声がない端末', function () {
    return withEnv([{ area: 'eigoYomi', itemId: 'food:egg', correct: false, level: 2 }], [], function (saved) {
      return S().show({ profileId: 'p' }).then(function () {
        C.assertEq(S()._state().noVoice, true);
        S()._mode('kiku'); C.assertEq(S()._state().phase, 'mode');
        S()._mode('yomi'); S()._theme('all');
        var q = S()._state().q;
        C.assertEq(q.kind, 'read'); C.assertEq(q.cards.length, 4);   // よむ は声を使わないので、レベル2のまま遊べる
        S()._choose(rightIndex(q));
        C.assertEq(saved[0].area, 'eigoYomi'); C.assertEq(saved[0].level, 2);
      });
    });
  });

  C.test('eigoScreen: 親画面に えいご の名前', function () {
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(t.indexOf("eigoKiku: 'えいご（きく）'") >= 0 && t.indexOf("eigoYomi: 'えいご（よむ）'") >= 0, true);
    });
  });

  /* ---------- べんきょうのトップ（2ページ） ---------- */
  C.test('home(benkyo): 並びとページ', function () {
    var H = C.benkyo.home;
    C.assertEq(H.PER_PAGE, 6); C.assertEq(H.pageCount(), 2);
    C.assertEq(H.ids(0).join(','), 'kuku,kukuB,keisan,kanji,doutoku,chizuJ');
    C.assertEq(H.ids(1).join(','), 'chizuW,nagasa,hantai,zukan,eigo');
  });

  C.test('home(benkyo): 教科のあるページ', function () {
    var H = C.benkyo.home;
    C.assertEq(H.pageOf('eigo'), 1); C.assertEq(H.pageOf('kuku'), 0); C.assertEq(H.pageOf('nanika'), 0);
  });

  C.test('home(benkyo): ページの場所は touch-action: pan-y', function () {
    return fetch('../app-benkyo/app.css').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/\.home-pager \{[^}]*touch-action: pan-y/.test(t), true);
    });
  });

  /* ---------- 最後のチェックで見つかった点 ---------- */
  C.test('eigoScreen: 前の問題の英語は、画面や問題が変わったら 読まない', function () {
    var jaDone = [], en = [];
    S()._speakers({ ja: function () { return new Promise(function (r) { jaDone.push(r); }); }, en: function (t) { en.push(t); } });
    return withEnv([], [US], function () {
      return S().show({ profileId: 'p' }).then(function () {
        S()._mode('kiku'); S()._theme('animal');
        var q1 = S()._state().q;
        S()._choose(wrongIndex(q1, 0)); S()._choose(wrongIndex(q1, 1));   // 「ひかっている ものだよ」→ 英語（日本語の終わり待ち）
        S()._next();                                                       // 日本語が終わる前に つぎの問題へ
        var q2 = S()._state().q;
        jaDone.forEach(function (r) { r(); });                             // 前の日本語が あとから終わる
        return new Promise(function (r) { setTimeout(r, 30); }).then(function () {
          C.assertEq(en.indexOf(q1.answer.en) < 0 || q1.answer.en === q2.answer.en, true);
        });
      });
    }).then(function () { S()._speakers(null); }, function (e) { S()._speakers(null); throw e; });
  });

  C.test('eigoScreen: 英語の声があとから届いたら「きく」が使える', function () {
    var st = C.storage, og = st.getLogs, list = [], f = fake(list);
    st.getLogs = function () { return Promise.resolve([]); };
    C.voiceEn._override(f, { maxMs: 20 });
    function back() { st.getLogs = og; C.voiceEn._override(null); }
    return S().show({ profileId: 'p' }).then(function () {
      C.assertEq(S()._state().noVoice, true);
      list.push(US);
      if (f.onvoiceschanged) f.onvoiceschanged();
      C.assertEq(S()._state().noVoice, false);
      S()._mode('kiku');
      C.assertEq(S()._state().phase, 'theme');
      back();
    }, function (e) { back(); throw e; });
  });
})();
