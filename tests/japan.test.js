/* 勉強アプリ「日本の 地図」のテスト（データ・形・出題・判定・レベル・画面の流れ・記録） */
(function () {
  'use strict';
  var C = window.Chiid;
  var J = function () { return C.japan; };
  var D = function () { return C.japanData; };
  function seq(vals) { var n = 0; return function () { var v = vals[n % vals.length]; n++; return v; }; }
  function rnd(seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  C.test('japan: 定数', function () {
    C.assertEq(J().AREA, 'chizuJ'); C.assertEq(J().ROUND_SIZE, 10); C.assertEq(J().STAR_EVERY, 5); C.assertEq(J().MAX_LEVEL, 3);
  });

  C.test('japan: 47都道府県・8地方。地方の数が合う。Lv2 は15', function () {
    var P = D().PREFS;
    C.assertEq(P.length, 47);
    C.assertEq(D().REGIONS.length, 8);
    var n = {};
    P.forEach(function (p) { n[p.region] = (n[p.region] || 0) + 1; });
    C.assertEq(n, { hokkaido: 1, tohoku: 6, kanto: 7, chubu: 9, kinki: 7, chugoku: 5, shikoku: 4, kyushu: 8 });
    C.assertEq(P.filter(function (p) { return p.lv2; }).length, 15);
    var ids = {};
    P.forEach(function (p) { if (ids[p.id]) throw new Error('id が重なる: ' + p.id); ids[p.id] = true; });
  });

  C.test('japan: どの県にも 名前・県庁所在地（東京都いがい）・名物が1つ以上', function () {
    D().PREFS.forEach(function (p) {
      if (!p.name || !p.office) throw new Error('名前がない: ' + p.id);
      if (p.id === 'tokyo') { if (p.capital !== null) throw new Error('東京都は県庁の問題に出さない'); }
      else if (!/\{市\|し\}$/.test(p.capital)) throw new Error('県庁所在地が「市」で終わらない: ' + p.id);
      if (!p.products.length) throw new Error('名物がない: ' + p.id);
      p.products.forEach(function (pr) {
        if (!pr.q || !pr.fact || !pr.icon) throw new Error('名物の文か絵がない: ' + p.id);
        if (!C.benkyo.japanScreen._icons[pr.icon]) throw new Error('絵がない: ' + pr.icon);
        if (pr.fact.indexOf(p.name) !== 0) throw new Error('ひとことが県名で始まらない: ' + p.id);
        pr.notWith.forEach(function (id) { if (!J().pref(id)) throw new Error('notWith の県がない: ' + id); });
      });
    });
  });

  C.test('japan: 決めた ひとこと（おまけ）が7府県に入っている', function () {
    var want = { akita: '銀', chiba: 'ディズニーランド', fukui: '芝政', nagano: 'ママが', aichi: 'ここちゃん えまちゃん', mie: 'スペイン村', osaka: 'USJ' };
    var got = D().PREFS.filter(function (p) { return p.extra; }).map(function (p) { return p.id; }).sort();
    C.assertEq(got, Object.keys(want).sort());
    Object.keys(want).forEach(function (id) {
      if (J().plain(J().pref(id).extra).indexOf(want[id]) < 0) throw new Error('おまけの ことばが ちがう: ' + id);
    });
    C.assertEq(J().pref('osaka').extra.indexOf('{府|ふ}') >= 0, true);   // 大阪は「府」
  });

  // 画面に出る文を全部
  function allTexts() {
    var out = [J().RETRY, J().SHOW_BTN, J().SHOW_MAP];
    D().REGIONS.forEach(function (r) { out.push(r.name, r.fact); });
    D().PREFS.forEach(function (p) {
      out.push(p.name, p.office, p.capital || '', p.extra || '');
      p.products.forEach(function (pr) { out.push(pr.q, pr.fact); });
    });
    [1, 2, 3].forEach(function (lv) {
      J().kindsOf(lv).forEach(function (k) {
        J().poolIds(lv).forEach(function (id) {
          if (k === 'kencho' && !J().pref(id).capital) return;
          var q = J().makeQuestion(lv, k, id, rnd(3));
          out.push(q.ask, q.fact);
        });
      });
    });
    return out;
  }
  C.test('japan: ふりがな なしで使う漢字は1年生の漢字だけ。よみは ひらがな', function () {
    var g1 = {};
    C.kanjiData.forEach(function (r) { if (r[1] === 1) g1[r[0]] = true; });
    allTexts().forEach(function (t) {
      var bare = String(t).replace(/\{[^|{}]+\|[^|{}]+\}/g, '');
      (bare.match(/[一-鿿]/g) || []).forEach(function (k) { if (!g1[k]) throw new Error('ふりがなが要る漢字「' + k + '」: ' + t); });
      var re = /\{([^|{}]+)\|([^|{}]+)\}/g, m;
      while ((m = re.exec(t))) if (!/^[ぁ-ゖー]+$/.test(m[2])) throw new Error('よみが ひらがなでない: ' + t);
      if (/[{}|]/.test(String(t).replace(/\{[^|{}]+\|[^|{}]+\}/g, ''))) throw new Error('ふりがなの書き方が こわれている: ' + t);
    });
  });

  C.test('japan: 形はすべて作れる。点の名前・県境の名前が全部ある', function () {
    var g = J().geo();
    D().PREFS.forEach(function (p) {
      var s = g[p.id];
      if (!s || !s.rings.length) throw new Error('形がない: ' + p.id);
      s.rings.forEach(function (r) {
        if (r.length < 3) throw new Error('点が少ない: ' + p.id);
        if (Math.abs(J().area2(r)) < 4) throw new Error('面積がない: ' + p.id);
        r.forEach(function (pt) { if (!isFinite(pt[0]) || !isFinite(pt[1])) throw new Error('座標がおかしい: ' + p.id); });
      });
      if (!/^M[0-9. L-]+Z/.test(J().pathOf(p.id))) throw new Error('path がおかしい: ' + p.id);
    });
  });

  C.test('japan: 県境は ちょうど2つの県で使う（すき間や重なりを防ぐ）', function () {
    var used = {};
    D().PREFS.forEach(function (p) {
      p.rings.forEach(function (r) {
        r.forEach(function (e) {
          if (typeof e === 'string' && (e.charAt(0) === '>' || e.charAt(0) === '<')) {
            var nm = e.slice(1);
            if (!D().BORDERS[nm]) throw new Error('県境がない: ' + nm);
            used[nm] = (used[nm] || []).concat(p.id);
          }
        });
      });
    });
    Object.keys(D().BORDERS).forEach(function (nm) {
      if (!used[nm] || used[nm].length !== 2 || used[nm][0] === used[nm][1]) throw new Error('県境 ' + nm + ' の使われ方: ' + (used[nm] || []).join(','));
    });
  });

  C.test('japan: 県の重心は、その県の地方の枠の中。沖縄は枠の中', function () {
    var g = J().geo();
    D().PREFS.forEach(function (p) {
      var b = J().regionBox(p.region), c = g[p.id].center;
      if (c[0] < b[0] || c[0] > b[2] || c[1] < b[1] || c[1] > b[3]) throw new Error('地方の枠の外: ' + p.id);
    });
    var o = J().okinawaBox(), ob = g.okinawa.box;
    if (ob[0] < o[0] || ob[1] < o[1] || ob[2] > o[2] || ob[3] > o[3]) throw new Error('沖縄が枠からはみ出す');
  });

  C.test('japan: 地方を大きくしたとき、小さい県も押せる大きさ（地方の枠の幅の5%以上）', function () {
    var g = J().geo();
    ['tokyo', 'osaka', 'kagawa', 'kanagawa', 'saga', 'tottori'].forEach(function (id) {
      var p = J().pref(id), b = J().regionBox(p.region), s = g[id].box;
      var side = Math.min(s[2] - s[0], s[3] - s[1]);
      var full = Math.max(b[2] - b[0], b[3] - b[1]);
      if (side / full < 0.05) throw new Error('小さすぎる: ' + id + ' ' + (side / full).toFixed(3));
    });
  });

  C.test('japan: kindPlan は10問。レベル1は2種類、レベル2・3は4種類が まんべんなく', function () {
    var p1 = J().kindPlan(1, rnd(5)), p2 = J().kindPlan(3, rnd(7));
    C.assertEq(p1.length, 10); C.assertEq(p2.length, 10);
    function count(a, k) { return a.filter(function (x) { return x === k; }).length; }
    C.assertEq(count(p1, 'atete'), 5); C.assertEq(count(p1, 'touch'), 5);
    ['atete', 'meibutsu', 'kencho', 'touch'].forEach(function (k) { if (count(p2, k) < 2) throw new Error('少ない: ' + k); });
  });

  C.test('japan: makeQuestion の選択肢（数・重ならない・正解は1つ・notWith を入れない・東京都は県庁に出さない）', function () {
    var r = rnd(11);
    [1, 2, 3].forEach(function (lv) {
      J().kindsOf(lv).forEach(function (k) {
        J().poolIds(lv).forEach(function (id) {
          if (k === 'kencho' && !J().pref(id).capital) return;
          for (var t = 0; t < 3; t++) {
            var q = J().makeQuestion(lv, k, id, r);
            if (k === 'touch') { C.assertEq(q.choices.length, 0); continue; }
            C.assertEq(q.choices.length, lv >= 3 ? 4 : 3);
            var ids = q.choices.map(function (c) { return c.id; });
            if (ids.filter(function (x) { return x === id; }).length !== 1) throw new Error('正解が1つでない');
            ids.forEach(function (x, i) { if (ids.indexOf(x) !== i) throw new Error('重なる: ' + x); });
            var pool = J().poolIds(lv);
            ids.forEach(function (x) { if (pool.indexOf(x) < 0) throw new Error('範囲の外: ' + x + ' Lv' + lv); });
            if (k === 'kencho') ids.forEach(function (x) { if (x === 'tokyo') throw new Error('東京都が県庁の選択肢に'); });
            if (k === 'meibutsu') q.product.notWith.forEach(function (x) { if (ids.indexOf(x) >= 0) throw new Error('notWith が入った: ' + id + ' ' + x); });
            if (lv >= 3) {
              var rid = J().pref(id).region;
              var same = ids.filter(function (x) { return x !== id && J().pref(x).region === rid; }).length;
              if (rid !== 'hokkaido' && same < 1) throw new Error('同じ地方の県がない: ' + id);
            }
          }
        });
      });
    });
  });

  C.test('japan: 県庁所在地は 県名と同じ市も出す（東京都いがいの46）', function () {
    var n = J().poolIds(3).filter(function (id) { return !!J().pref(id).capital; }).length;
    C.assertEq(n, 46);
    var q = J().makeQuestion(3, 'kencho', 'aomori', rnd(2));
    C.assertEq(J().plain(q.ask), '青森県の 県庁が ある 市は？');
    C.assertEq(q.choices.some(function (c) { return J().plain(c.text) === '青森市'; }), true);
    C.assertEq(J().plain(J().makeQuestion(2, 'kencho', 'hokkaido', rnd(2)).ask), '北海道の 道庁が ある 市は？');
    C.assertEq(J().plain(J().makeQuestion(2, 'kencho', 'kyoto', rnd(2)).ask), '京都府の 府庁が ある 市は？');
  });

  C.test('japan: pickQuestion はレベルの範囲から。同じ回で同じ問題は出さない', function () {
    var r = rnd(13);
    [1, 2, 3].forEach(function (lv) {
      var used = {}, last = null, pool = J().poolIds(lv);
      for (var i = 0; i < 10; i++) {
        var k = J().kindsOf(lv)[i % J().kindsOf(lv).length];
        var q = J().pickQuestion({ level: lv, kind: k, missCounts: {}, used: used, lastTarget: last }, r);
        if (pool.indexOf(q.target) < 0) throw new Error('範囲の外: ' + q.target);
        if (used[q.itemId]) throw new Error('同じ問題: ' + q.itemId);
        if (q.target === last) throw new Error('続けて同じ所');
        C.assertEq(q.kind, k);
        used[q.itemId] = true; last = q.target;
      }
    });
  });

  C.test('japan: itemId は読める名前', function () {
    C.assertEq(J().itemIdOf(1, 'atete', 'kanto'), '関東地方・ばしょ');
    C.assertEq(J().itemIdOf(2, 'meibutsu', 'aomori'), '青森県・名ぶつ');
    C.assertEq(J().itemIdOf(3, 'kencho', 'hokkaido'), '北海道・けんちょう');
    C.assertEq(J().itemIdOf(3, 'touch', 'tokyo'), '東京都・タッチ');
  });

  C.test('japan: answer の流れ（まちがい→もう一度→2回で答えを見せる→正解は firstTry false）', function () {
    var q = J().makeQuestion(2, 'atete', 'aomori', rnd(4));
    var a = J().newAttempt();
    var wrong = q.choices.filter(function (c) { return c.id !== 'aomori'; }).map(function (c) { return c.id; });
    C.assertEq(J().answer(a, q, wrong[0]).kind, 'retry');
    C.assertEq(J().answer(a, q, wrong[0]).kind, 'ignore');   // 同じボタンは もう押せない
    C.assertEq(J().answer(a, q, wrong[1]).kind, 'show');
    C.assertEq(a.shown, true);
    C.assertEq(J().answer(a, q, 'aomori').kind, 'good');
    C.assertEq(a.firstTry, false);
    C.assertEq(J().logEntry(q, a), { area: 'chizuJ', itemId: '青森県・ばしょ', correct: false, level: 2 });
    var a2 = J().newAttempt();
    C.assertEq(J().answer(a2, q, 'aomori').firstTry, true);
    C.assertEq(J().answer(a2, q, 'aomori').kind, 'ignore');
  });

  C.test('japan: 地方のタッチは、押した県の地方で答える', function () {
    var q = J().makeQuestion(1, 'touch', 'kinki', rnd(4));
    var a = J().newAttempt();
    C.assertEq(J().answer(a, q, 'tokyo').kind, 'retry');
    C.assertEq(J().answer(a, q, 'osaka').kind, 'good');
    C.assertEq(a.firstTry, false);
  });

  C.test('japan: 声の文は すき間なし・ふりがななし。正解では おまけも読む', function () {
    var q = J().makeQuestion(3, 'meibutsu', 'aichi', rnd(4));
    C.assertEq(J().speakText(q), '自動車を日本一たくさん作っているのはどこ？');
    C.assertEq(J().replyText(q, { kind: 'good' }), '愛知県は自動車づくりが日本一！ ここちゃんえまちゃんが住んでいる県だね！');
    C.assertEq(J().replyText(q, { kind: 'retry' }), 'もういっかいやってみよう！');
  });

  C.test('japan: progressFromLogs はレベル・苦手・色ぬりを記録から出す', function () {
    var logs = [];
    for (var i = 0; i < 5; i++) logs.push({ area: 'chizuJ', itemId: '関東地方・ばしょ', correct: true, level: 1 });
    var p = J().progressFromLogs(logs);
    C.assertEq(p.level, 2);                // 5問中4問以上で上がる
    logs.push({ area: 'chizuJ', itemId: '青森県・名ぶつ', correct: true, level: 2 });
    logs.push({ area: 'chizuJ', itemId: '大阪府・タッチ', correct: false, level: 2 });
    logs.push({ area: 'kuku', itemId: '2x3', correct: false, level: 1 });
    p = J().progressFromLogs(logs);
    C.assertEq(p.level, 2);
    C.assertEq(p.colored, { aomori: true });
    C.assertEq(p.missCounts, { '大阪府・タッチ': 1 });
    C.assertEq(J().progressFromLogs([]).level, 1);
  });
})();

/* 画面の流れ（#app が無いので描画はしない） */
(function () {
  'use strict';
  var C = window.Chiid;
  var S = function () { return C.benkyo.japanScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); }
  function logsOf(pid) {
    return C.storage.getLogs(pid).then(function (l) { return l.filter(function (e) { return e.area === 'chizuJ'; }); });
  }
  function open(seedLogs) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('たろう', 'benkyo');
      C.storage.setActive(pid);
      var p = Promise.resolve();
      (seedLogs || []).forEach(function (e) {
        p = p.then(function () { return C.storage.logAnswer({ profileId: pid, area: e.area, itemId: e.itemId, correct: e.correct, level: e.level }); });
      });
      return p.then(function () { return S().show({ profileId: pid }); }).then(function () { return pid; });
    });
  }
  // いまの問題に正しく答える（タッチは地方→県の2だん）
  function answerGood() {
    var s = S()._state();
    if (s.kind !== 'touch') { S()._pick(s.target); return; }
    if (s.scope === 'region') { S()._tap(C.japan.prefsOf(s.target)[0].id); return; }
    S()._tap(s.target);                 // まだ大きくなっていなければ、地方が大きくなる
    if (S()._state().phase === 'question') S()._tap(s.target);
  }
  function wrongId() {
    var s = S()._state();
    if (s.kind !== 'touch') return s.choices.filter(function (c) { return c.id !== s.target && s.tried.indexOf(c.id) < 0; })[0].id;
    var rid = s.scope === 'region' ? s.target : C.japan.pref(s.target).region;
    return C.japanData.PREFS.filter(function (p) { return s.scope === 'region' ? p.region !== rid : (p.region === rid && p.id !== s.target); })[0].id;
  }
  function jt(name, fn) {
    C.test('japanScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  jt('はじめはレベル1（地方）。10問で区切り、5問ごとに星。記録は10件', function () {
    return open().then(function (pid) {
      for (var i = 0; i < 10; i++) {
        var s = S()._state();
        C.assertEq(s.phase, 'question');
        if (i === 0) { C.assertEq(s.level, 1); C.assertEq(s.scope, 'region'); }
        answerGood();
        C.assertEq(S()._state().result, 'good');
        C.assertEq(S()._state().waiting, true);
        if (i === 4) C.assertEq(S()._state().stars, 1);
        S()._next();
      }
      var e = S()._state();
      C.assertEq(e.phase, 'reward'); C.assertEq(e.solved, 10); C.assertEq(e.stars, 2);
      C.assertEq(e.level > 1, true);                      // 全部正解なので上がっている
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 10);
        logs.forEach(function (l) { C.assertEq(l.correct, true); });
        S()._again();
        var s2 = S()._state();
        C.assertEq(s2.phase, 'question'); C.assertEq(s2.solved, 0); C.assertEq(s2.stars, 0);
      });
    });
  });

  jt('まちがい2回で答えを見せる。正解すると記録 false・色がつく', function () {
    var seed = [];
    for (var i = 0; i < 3; i++) seed.push({ area: 'chizuJ', itemId: '青森県・ばしょ', correct: true, level: 3 });
    return open(seed).then(function (pid) {
      var s = S()._state();
      C.assertEq(s.level, 3); C.assertEq(s.scope, 'pref');
      S()._pick(wrongId());
      C.assertEq(S()._state().result, 'retry');
      C.assertEq(S()._state().phase, 'question');
      S()._pick(wrongId());
      C.assertEq(S()._state().result, 'show');
      C.assertEq(S()._state().shown, true);
      C.assertEq(S()._state().zoom, C.japan.pref(s.target).region);   // 答えの地方を大きくする
      answerGood();
      var e = S()._state();
      C.assertEq(e.result, 'good'); C.assertEq(e.phase, 'feedback');
      C.assertEq(e.colored.indexOf(s.target) >= 0, true);
      return logsOf(pid).then(function (logs) {
        var last = logs[logs.length - 1];
        C.assertEq(last.correct, false); C.assertEq(last.itemId, s.itemId); C.assertEq(last.level, 3);
      });
    });
  });

  jt('県のタッチは2だん：1回目は地方が大きくなるだけ、2回目で答える', function () {
    var seed = [];
    for (var i = 0; i < 3; i++) seed.push({ area: 'chizuJ', itemId: '青森県・ばしょ', correct: true, level: 2 });
    return open(seed).then(function () {
      // touch の問題まで進める
      for (var n = 0; n < 10 && S()._state().kind !== 'touch'; n++) { answerGood(); S()._next(); }
      var s = S()._state();
      C.assertEq(s.kind, 'touch'); C.assertEq(s.scope, 'pref');
      C.assertEq(s.zoom, null);
      var rid = C.japan.pref(s.target).region;
      S()._tap(s.target);
      C.assertEq(S()._state().zoom, rid); C.assertEq(S()._state().result, null);
      S()._zoom(null);
      C.assertEq(S()._state().zoom, null);
      S()._tap(s.target); S()._tap(s.target);
      C.assertEq(S()._state().result, 'good');
    });
  });

  jt('県あて・県庁の問題は、はじめから その地方を大きくする', function () {
    var seed = [];
    for (var i = 0; i < 3; i++) seed.push({ area: 'chizuJ', itemId: '青森県・ばしょ', correct: true, level: 2 });
    return open(seed).then(function () {
      for (var n = 0; n < 10; n++) {
        var s = S()._state();
        if (s.kind === 'atete' || s.kind === 'kencho') C.assertEq(s.zoom, C.japan.pref(s.target).region);
        else C.assertEq(s.zoom, null);
        answerGood(); S()._next();
      }
    });
  });

  jt('利用時間を超えていたら、次へ進むときに止まる', function () {
    var orig = C.benkyo.checkRest;
    C.benkyo.checkRest = function () { return true; };
    return open().then(function () {
      answerGood();
      S()._next();
      C.assertEq(S()._state().phase, 'rest');
    }).then(function () { C.benkyo.checkRest = orig; }, function (e) { C.benkyo.checkRest = orig; throw e; });
  });
})();
