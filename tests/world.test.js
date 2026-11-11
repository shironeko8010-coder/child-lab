/* 勉強アプリ「せかいの 国」のテスト（データ・国旗・地図・出題・判定・画面の流れ・記録） */
(function () {
  'use strict';
  var C = window.Chiid;
  var Wd = function () { return C.worldData; };
  var Wq = function () { return C.world; };
  // 決まった順に 0〜1 を返す乱数（くり返し）
  function lcg(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  var COMPLEX = ['br', 'eg', 'mn', 'sa', 'es', 'ke', 'mx', 'ar'];

  C.test('world: 定数', function () {
    C.assertEq(Wq().AREA, 'chizuW'); C.assertEq(Wq().MAX_LEVEL, 3);
    C.assertEq(Wq().ROUND_SIZE, 10); C.assertEq(Wq().STAR_EVERY, 5);
  });

  C.test('world: 国は36。レベル1=10・レベル2=20・レベル3=36。id は重ならない', function () {
    var list = Wd().COUNTRIES, ids = {};
    C.assertEq(list.length, 36);
    list.forEach(function (c) { if (ids[c.id]) throw new Error('id が重なる: ' + c.id); ids[c.id] = true; });
    C.assertEq(Wq().poolIds(1).length, 10);
    C.assertEq(Wq().poolIds(2).length, 20);
    C.assertEq(Wq().poolIds(3).length, 36);
    C.assertEq(Wq().poolIds(1).slice().sort(), ['au', 'ca', 'cn', 'de', 'fr', 'gb', 'it', 'jp', 'kr', 'us']);
  });

  C.test('world: どの国にも 国旗・地図の形・大陸・地域・ひとこと説明がある', function () {
    var conts = {}, regions = Wd().REGIONS;
    Wd().CONTINENTS.forEach(function (k) { conts[k.id] = true; });
    Wd().COUNTRIES.forEach(function (c) {
      if (!Wd().FLAGS[c.id]) throw new Error('国旗がない: ' + c.id);
      if (!Wd().SHAPE[c.id] || !Wd().SHAPE[c.id].length) throw new Error('形がない: ' + c.id);
      if (!conts[c.cont]) throw new Error('大陸がおかしい: ' + c.id);
      if (!regions[c.region]) throw new Error('地域がおかしい: ' + c.id);
      if (!c.fact || c.fact.indexOf(Wq().plain(c.name)) < 0 && c.fact.indexOf(c.name) < 0) throw new Error('説明に国名がない: ' + c.id);
      Wd().SHAPE[c.id].forEach(function (p) { if (p.length < 6 || p.length % 2) throw new Error('形の点がおかしい: ' + c.id); });
      var b = c.bbox;
      if (!(b.x2 > b.x1 && b.y2 > b.y1)) throw new Error('外枠がおかしい: ' + c.id);
    });
  });

  C.test('world: 大陸は六大陸（ユーラシア・アフリカ・北アメリカ・南アメリカ・オーストラリア・南極）', function () {
    C.assertEq(Wd().CONTINENTS.map(function (k) { return k.id; }), ['eurasia', 'africa', 'namerica', 'samerica', 'australia', 'antarctica']);
    Wd().CONTINENTS.forEach(function (k) { if (!k.name || !k.say || !k.fact) throw new Error('大陸の文がない: ' + k.id); });
  });

  C.test('world: 模様の細かい国旗は8つ（かんたんに描く）', function () {
    var cx = Wd().COUNTRIES.filter(function (c) { return c.complex; }).map(function (c) { return c.id; }).sort();
    C.assertEq(cx, COMPLEX.slice().sort());
    // レベル1の国には入っていない
    Wq().poolIds(1).forEach(function (id) { if (Wq().byId(id).complex) throw new Error('レベル1に細かい国旗: ' + id); });
  });

  C.test('world: 国旗は正式な比率（縦:横）で描く', function () {
    var R = { jp: 1.5, cn: 1.5, kr: 1.5, us: 1.9, ca: 2, gb: 2, fr: 1.5, de: 5 / 3, it: 1.5, au: 2, ru: 1.5, in: 1.5, th: 1.5, vn: 1.5, id: 1.5, ch: 1,
      nl: 1.5, br: 10 / 7, eg: 1.5, za: 1.5, nz: 2, ph: 2, mn: 2, tr: 1.5, sa: 1.5, es: 1.5, gr: 1.5, se: 1.6, no: 22 / 16, fi: 18 / 11, ke: 1.5, ng: 2,
      mx: 7 / 4, ar: 1.6, pe: 1.5, cl: 1.5 };
    Object.keys(R).forEach(function (id) {
      var r = Wd().flagRatio(id);
      if (Math.abs(r - R[id]) > 0.001) throw new Error('比率がちがう: ' + id + ' ' + r);
    });
  });

  C.test('world: 国旗の SVG は id が重ならない（同じ画面に何枚出しても こわれない）', function () {
    var a = Wd().flagSvg('gb') + Wd().flagSvg('au') + Wd().flagSvg('nz') + Wd().flagSvg('gb');
    var ids = (a.match(/id="[^"]+"/g) || []);
    var seen = {};
    ids.forEach(function (x) { if (seen[x]) throw new Error('id が重なる: ' + x); seen[x] = true; });
    C.assertEq(ids.length > 0, true);
    Wd().COUNTRIES.forEach(function (c) {
      var s = Wd().flagSvg(c.id);
      if (!/^<svg [^>]*viewBox="[^"]+"/.test(s) || !/<\/svg>$/.test(s)) throw new Error('SVG でない: ' + c.id);
      // 外の画像・リンクを使わない
      if (/https?:|xlink:href="(?!#)|<image/.test(s)) throw new Error('外のものを使っている: ' + c.id);
    });
  });

  C.test('world: 地図に36か国と六大陸がある。外のものを使わない', function () {
    var div = document.createElement('div');
    div.innerHTML = Wd().mapSvg();
    C.assertEq(div.querySelectorAll('.wm-c').length, 36);
    C.assertEq(div.querySelectorAll('.wm-cont').length, 6);
    C.assertEq(div.querySelectorAll('.wm-ring').length, 1);
    if (/https?:|<image/.test(div.innerHTML)) throw new Error('外のものを使っている');
    Object.keys(Wd().REGIONS).forEach(function (r) {
      var vb = Wd().viewBoxOf(r);
      if (!(vb[2] > 0 && vb[3] > 0)) throw new Error('範囲がおかしい: ' + r);
    });
    // どの国も、自分の地域の範囲に だいたい入っている
    Wd().COUNTRIES.forEach(function (c) {
      var vb = Wd().viewBoxOf(c.region), b = c.bbox;
      var cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
      if (cx < vb[0] || cx > vb[0] + vb[2] || cy < vb[1] || cy > vb[1] + vb[3]) throw new Error('地域の外: ' + c.id);
    });
  });

  // 表記：2年生までの漢字は漢字。ふりがな無しは1年生の字だけ。ふりがなの字も2年生まで（漢字の国名だけは別）
  C.test('world: 文字の表記（ふりがな無しは1年生の字、ふりがなの字は2年生まで、国名は別）', function () {
    var g1 = {}, g12 = {};
    C.kanjiData.forEach(function (r) { if (r[1] === 1) g1[r[0]] = true; if (r[1] <= 2) g12[r[0]] = true; });
    var NAME_OK = { '中国': true, '韓国': true };
    var texts = [];
    Wd().COUNTRIES.forEach(function (c) { texts.push(c.name, c.fact); });
    Wd().CONTINENTS.forEach(function (k) { texts.push(k.name, k.fact); });
    Wq().TYPES.forEach(function (t) { texts.push(Wq().askText({ type: t, id: 'fr', answer: 'fr' })); });
    texts.push(Wq().RETRY, C.benkyo.SUBJECTS.filter(function (s) { return s.id === 'chizuW'; })[0].name, C.benkyo.SUBJECTS.filter(function (s) { return s.id === 'chizuW'; })[0].sub);
    texts.forEach(function (t) {
      var re = /\{([^|{}]+)\|([^|{}]+)\}/g, m;
      while ((m = re.exec(t))) {
        if (NAME_OK[m[1]]) continue;
        m[1].split('').forEach(function (k) { if (!g12[k]) throw new Error('2年生までにない字「' + k + '」: ' + t); });
      }
      var bare = t.replace(/\{[^|{}]+\|[^|{}]+\}/g, '');
      (bare.match(/[一-鿿]/g) || []).forEach(function (k) { if (!g1[k]) throw new Error('ふりがなが要る字「' + k + '」: ' + t); });
    });
  });

  C.test('world: 声の文は すき間なし・{} なし。「大陸」「南極」は漢字で読ませる', function () {
    var q;
    Wd().COUNTRIES.forEach(function (c) {
      q = { type: 'map', id: c.id, answer: c.id };
      [Wq().askSay(q), Wq().replySay(q, 'correct'), Wq().replySay(q, 'reveal'), Wq().factSay(q)].forEach(function (s) {
        if (/[{}|]/.test(s)) throw new Error('{} が残る: ' + s);
      });
      if (/ /.test(Wq().factSay(q))) throw new Error('すき間がある: ' + Wq().factSay(q));
    });
    q = { type: 'cont', id: 'antarctica', answer: 'antarctica' };
    C.assertEq(Wq().factSay(q).indexOf('南極大陸') >= 0, true);
    C.assertEq(Wq().sayName('cont', 'namerica'), '北アメリカ大陸');
    C.assertEq(Wq().askSay({ type: 'flag', id: 'fr' }), 'この国旗は、どこの国？');
    C.assertEq(Wq().askSay({ type: 'pick', id: 'cn' }), '中国の国旗は、どれ？');
  });

  C.test('world: 記録の名前（itemId）', function () {
    C.assertEq(Wq().itemIdOf('flag', 'fr'), 'フランス（こっき）');
    C.assertEq(Wq().itemIdOf('pick', 'cn'), '中国（こっき）');
    C.assertEq(Wq().itemIdOf('map', 'za'), '南アフリカ（ちず）');
    C.assertEq(Wq().itemIdOf('cont', 'africa'), 'アフリカ大りく');
  });

  C.test('world: レベル1は 国旗あて・国旗えらび・地図で国 の3択。答えは選択肢に1つ', function () {
    var rng = lcg(7), types = {};
    for (var i = 0; i < 300; i++) {
      var q = Wq().makeQuestion({ level: 1 }, rng);
      types[q.type] = true;
      C.assertEq(q.choices.length, 3);
      if (q.choices.filter(function (c) { return c === q.answer; }).length !== 1) throw new Error('答えが選択肢に1つでない');
      var u = {}; q.choices.forEach(function (c) { if (u[c]) throw new Error('選択肢が重なる'); u[c] = true; });
      q.choices.forEach(function (c) { if (Wq().poolIds(1).indexOf(c) < 0) throw new Error('レベル1でない国: ' + c); });
    }
    C.assertEq(Object.keys(types).sort(), ['flag', 'map', 'pick']);
  });

  C.test('world: レベル2は4択で大陸も出る。細かい国旗（ブラジル・エジプト）は国旗の問題に出ない', function () {
    var rng = lcg(11), types = {}, mapIds = {};
    for (var i = 0; i < 600; i++) {
      var q = Wq().makeQuestion({ level: 2 }, rng);
      types[q.type] = true;
      C.assertEq(q.choices.length, 4);
      if (q.type === 'flag' || q.type === 'pick') {
        q.choices.forEach(function (c) { if (Wq().byId(c).complex) throw new Error('レベル2の国旗問題に細かい国旗: ' + c); });
      }
      if (q.type === 'map') mapIds[q.id] = true;
      if (q.type === 'cont') { if (!Wq().contById(q.id)) throw new Error('大陸でない: ' + q.id); }
    }
    C.assertEq(Object.keys(types).sort(), ['cont', 'flag', 'map', 'pick']);
    C.assertEq(!!mapIds.br && !!mapIds.eg, true);   // 地図の問題には出る
  });

  C.test('world: レベル3では 細かい国旗も国旗の問題に出る', function () {
    var rng = lcg(5), seen = {};
    for (var i = 0; i < 1500; i++) {
      var q = Wq().makeQuestion({ level: 3 }, rng);
      if (q.type === 'flag') seen[q.id] = true;
    }
    COMPLEX.forEach(function (id) { if (!seen[id]) throw new Error('レベル3で出ない: ' + id); });
  });

  C.test('world: 同じ回で出た組み合わせ（used）と直前の国は さける', function () {
    var rng = lcg(3), used = {}, last = null;
    for (var i = 0; i < 10; i++) {
      var q = Wq().makeQuestion({ level: 1, used: used, lastId: last }, rng);
      if (used[q.key]) throw new Error('同じ問題が2回: ' + q.key);
      if (q.type !== 'cont' && q.id === last) throw new Error('直前と同じ国: ' + q.id);
      used[q.key] = true;
      if (q.type !== 'cont') last = q.id;
    }
    // 国旗あてと国旗えらびは同じ鍵（同じ国旗を1回に2回出さない）
    C.assertEq(Wq().keyOf('flag', 'fr'), Wq().keyOf('pick', 'fr'));
  });

  C.test('world: 判定。まちがい1回→retry、2回→reveal、同じボタン・選択肢にないものは ignore', function () {
    var q = { type: 'flag', id: 'fr', answer: 'fr', choices: ['de', 'fr', 'it'] };
    var a = Wq().newAttempt();
    C.assertEq(Wq().choose(a, q, 'de').kind, 'retry');
    C.assertEq(Wq().choose(a, q, 'de').kind, 'ignore');
    C.assertEq(Wq().choose(a, q, 'jp').kind, 'ignore');
    C.assertEq(Wq().choose(a, q, 'it').kind, 'reveal');
    var b = Wq().newAttempt();
    C.assertEq(Wq().choose(b, q, 'fr').kind, 'correct');
    C.assertEq(b.tries, 0);
    C.assertEq(Wq().replyText(q, 'reveal').indexOf('フランスだよ') >= 0, true);
    C.assertEq(Wq().replyText(q, 'correct').indexOf('エッフェル') >= 0, true);
  });

  C.test('world: 記録からレベルを組み立てる（直近5問で4問正解→上、2問以下→下）', function () {
    function logs(level, arr) { return arr.map(function (c) { return { area: 'chizuW', itemId: 'x', correct: c, level: level }; }); }
    C.assertEq(Wq().progressFromLogs([]).level, 1);
    C.assertEq(Wq().progressFromLogs(logs(1, [true, true, true, true, false])).level, 2);
    C.assertEq(Wq().progressFromLogs(logs(2, [true, false, false, true, false])).level, 1);
    C.assertEq(Wq().progressFromLogs(logs(3, [true, true, true, true, true])).level, 3);
    var p = Wq().progressFromLogs(logs(2, [false, true]).concat([{ area: 'kuku', itemId: 'y', correct: false, level: 1 }]));
    C.assertEq(p.level, 2); C.assertEq(p.missCounts, { x: 1 });
  });

  C.test('world: 苦手（まちがえた回数）が多い国が出やすい', function () {
    var rng = lcg(9), n = 0, miss = {};
    Wq().poolIds(1).forEach(function (id) { miss[Wq().itemIdOf('map', id)] = id === 'kr' ? 30 : 0; });
    for (var i = 0; i < 400; i++) {
      var q = Wq().makeQuestion({ level: 1, missCounts: miss }, rng);
      if (q.type === 'map' && q.id === 'kr') n++;
    }
    C.assertEq(n > 40, true);
  });

  /* ---------- 画面の流れ ---------- */
  var S = function () { return C.benkyo.worldScreen; };
  function fresh() { C.storage._forceMemory(true); return C.storage.init().then(function () { return C.storage.resetAll(); }); }
  function done() { C.storage._forceMemory(false); }
  function logsOf(pid) {
    return C.storage.getLogs(pid).then(function (l) { return l.filter(function (e) { return e.area === 'chizuW'; }); });
  }
  function open(seed) {
    return fresh().then(function () {
      var pid = C.storage.addProfile('はなこ', 'benkyo');
      C.storage.setActive(pid);
      return S().show({ profileId: pid, rng: lcg(seed || 1) }).then(function () { return pid; });
    });
  }
  function wrongOf(s) { return s.choices.filter(function (c) { return c !== s.answer; }); }
  function ws(name, fn) {
    C.test('worldScreen: ' + name, function () {
      return Promise.resolve().then(fn).then(function () { done(); }, function (e) { done(); throw e; });
    });
  }

  ws('開くと レベル1の問題（3択）', function () {
    return open().then(function () {
      var s = S()._state();
      C.assertEq(s.phase, 'question'); C.assertEq(s.level, 1); C.assertEq(s.choices.length, 3);
      C.assertEq(s.solved, 0); C.assertEq(s.waiting, false);
    });
  });

  ws('1回目で正解→記録 true・待ち。待ちのあいだは えらべない。「つぎへ」で次の問題', function () {
    return open(2).then(function (pid) {
      var s = S()._state();
      S()._pick(s.answer);
      s = S()._state();
      C.assertEq(s.result, 'correct'); C.assertEq(s.phase, 'feedback'); C.assertEq(s.solved, 1); C.assertEq(s.waiting, true);
      S()._pick(s.choices[0]);
      C.assertEq(S()._state().solved, 1);
      S()._next();
      C.assertEq(S()._state().phase, 'question');
      return logsOf(pid).then(function (logs) {
        C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, true); C.assertEq(logs[0].itemId, s.itemId); C.assertEq(logs[0].level, 1);
      });
    });
  });

  ws('まちがい→もういっかい（うすくなる）→正解で 記録 false が1件', function () {
    return open(3).then(function (pid) {
      var s = S()._state();
      S()._pick(wrongOf(s)[0]);
      s = S()._state();
      C.assertEq(s.result, 'retry'); C.assertEq(s.phase, 'question'); C.assertEq(s.tried.length, 1); C.assertEq(s.solved, 0);
      S()._pick(s.answer);
      s = S()._state();
      C.assertEq(s.result, 'correct'); C.assertEq(s.phase, 'feedback');
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });

  ws('2回まちがえると こたえを見せて 記録 false', function () {
    return open(4).then(function (pid) {
      var s = S()._state(), w = wrongOf(s);
      S()._pick(w[0]); S()._pick(w[1]);
      s = S()._state();
      C.assertEq(s.result, 'reveal'); C.assertEq(s.phase, 'feedback'); C.assertEq(s.solved, 1); C.assertEq(s.waiting, true);
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 1); C.assertEq(logs[0].correct, false); });
    });
  });

  ws('10問で ごほうび。5問ごとに星。同じ問題は くり返さない。もう一回で はじめから', function () {
    return open(5).then(function (pid) {
      var keys = {};
      for (var i = 0; i < 10; i++) {
        var s = S()._state();
        C.assertEq(s.phase, 'question');
        var k = (s.type === 'pick' ? 'flag' : s.type) + ':' + s.id;
        if (keys[k]) throw new Error('同じ問題: ' + k);
        keys[k] = true;
        S()._pick(s.answer);
        C.assertEq(S()._state().stars, Math.floor((i + 1) / 5));
        S()._next();
      }
      C.assertEq(S()._state().phase, 'reward');
      C.assertEq(S()._state().stars, 2);
      S()._again();
      C.assertEq(S()._state().phase, 'question'); C.assertEq(S()._state().solved, 0);
      return logsOf(pid).then(function (logs) { C.assertEq(logs.length, 10); });
    });
  });

  ws('ぜんぶ正解すると レベル2（4択）に上がる', function () {
    return open(6).then(function () {
      for (var i = 0; i < 5; i++) { S()._pick(S()._state().answer); S()._next(); }
      var s = S()._state();
      C.assertEq(s.level, 2); C.assertEq(s.choices.length, 4);
    });
  });

  C.test('world: 親画面の教科名に chizuW がある', function () {
    var div = document.createElement('div');
    C.storage._forceMemory(true);
    return C.storage.init().then(function () { return C.storage.resetAll(); }).then(function () {
      var pid = C.storage.addProfile('はなこ', 'benkyo');
      C.storage.setActive(pid);
      return C.storage.logAnswer({ profileId: pid, area: 'chizuW', itemId: 'フランス（こっき）', correct: true, level: 1 });
    }).then(function () {
      C.parent.render(div);   // 集計はあとから入る
      return new Promise(function (resolve, reject) {
        var n = 0;
        (function look() {
          if (div.textContent.indexOf('せかいの くに') >= 0) { resolve(); return; }
          if (++n > 60) { reject(new Error('教科名が出ない')); return; }
          setTimeout(look, 50);
        })();
      });
    }).then(function () { C.storage._forceMemory(false); }, function (e) { C.storage._forceMemory(false); throw e; });
  });
})();
