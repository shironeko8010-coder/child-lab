/* 読み上げ文の書き出し（開発用）。アプリ本体には含まれない。
   各教科のデータから、読み上げる文をすべて作り、文（。！？ のあと）・部品（｜）ごとに分けて、
   「見分け方（空白なし）<TAB>VOICEVOX に渡す文」の形で tools/voice/lines.tsv に保存する。 */
(function () {
  'use strict';
  var C = window.Chiid, B = C.benkyo;
  var V = C.voice;
  var map = {};      // 見分け方 → VOICEVOX に渡す文
  var from = {};     // 見分け方 → どこの文か（確認用）
  var yomiOf = {};   // 見分け方 → ふりがなを読みにした文（読みのまちがい調べ用）
  var where = '';

  function plain(s) { return String(s == null ? '' : s).replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$1'); }
  // speak(text) に渡る文を登録する。synth を渡すと、その文を VOICEVOX に読ませる（読みまちがい対策）
  function add(text, synth) {
    if (!text) return;
    var keys = V.pieces(text);
    var syn = synth ? V.pieces(synth).length === keys.length ? splitKeep(synth) : null : null;
    var raw = splitKeep(text);
    var yo = splitKeep(String(text).replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$2'));
    keys.forEach(function (k, i) {
      if (map[k] == null || (syn && syn[i])) map[k] = (syn && syn[i]) || raw[i] || k;
      if (!from[k]) from[k] = where;
      if (!yomiOf[k] && yo.length === keys.length) yomiOf[k] = yo[i];
    });
  }
  // V.pieces と同じ分け方で、空白は残す
  function splitKeep(text) {
    var out = [];
    String(text).split('｜').forEach(function (part) {
      String(part).replace(/([。！？])/g, '$1\n').split('\n').forEach(function (s) {
        var t = plain(s).replace(/^[\s　]+|[\s　]+$/g, '');
        if (t) out.push(t);
      });
    });
    return out;
  }
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }

  /* ---------- ちいく ---------- */
  function chiiku() {
    where = 'ちいく ひらがな';
    // 1文字は カタカナで読ませる（「は」「へ」を「ワ」「エ」と読まないように）
    function kata(ch) { return String.fromCharCode(ch.charCodeAt(0) + 0x60); }
    C.hira.ITEMS.forEach(function (it) {
      add(it.ch + '。 ' + it.ch + 'は、どれかな？', kata(it.ch) + '。 ' + kata(it.ch) + 'は、どれかな？');
      add('すごい！ ' + it.word + 'の、' + it.ch + '。', 'すごい！ ' + it.word + 'の、' + kata(it.ch) + '。');
    });
    add('すごい！ ');

    where = 'ちいく かず';
    C.kazu.PICS.forEach(function (p) { add(p.word + 'は いくつ かな？'); });
    C.kazu.KO_YOMI.slice(1).forEach(function (y) { add('せいかい！ ' + y + ' だね'); });

    where = 'ちいく とけい';
    add('なんじ かな？');
    range(1, 12).forEach(function (h) { [0, 30].forEach(function (m) { add('せいかい！ ' + C.tokei.yomi({ h: h, m: m }) + ' だね'); }); });

    where = 'ちいく いろ・かたち';
    range(1, C.iro.MAX_LEVEL).forEach(function (lv) {
      C.iro.allIds(lv).forEach(function (id) { add(C.iro.question(C.iro.parseId(id))); });
    });
    C.iro.COLORS.forEach(function (c) { C.iro.SHAPES.forEach(function (s) { add('せいかい！ ' + C.iro.cardName({ color: c.id, shape: s.id }) + ' だね'); }); });

    where = 'ちいく まちがいさがし';
    range(1, 3).forEach(function (n) { add(C.machigai.askText(n)); });
    ['ひとつ', 'ふたつ'].forEach(function (y) { add('みつけた！ あと ' + y); });

    where = 'ちいく ごほうび';
    add('すごい！ 5もん できたね');

    where = 'ちいく おかいもの';
    var O = C.okaimono;
    O.ITEMS.forEach(function (it) {
      var seen = {};
      [1, 2, 3].forEach(function (lv) {
        O.pricesFor(it, lv).forEach(function (p) {
          if (seen[p]) return;
          seen[p] = 1;
          add(O.speakText({ item: it, price: p }));
        });
      });
    });
    O.COINS.forEach(function (n) { add(O.coinText(n)); });
    Object.keys(O.TEXT).forEach(function (k) { add(O.TEXT[k]); });

    where = 'ちいく どうとく';
    var D = C.chiikuDoutoku;
    D.SCENES.concat(D.OPEN).forEach(function (sc) {
      add(sc.text);
      sc.choices.forEach(function (c) {
        add(c.text);
        add('それとも、' + c.text);
        add(D.replyFor(sc, c));
      });
    });
  }

  /* ---------- べんきょう ---------- */
  var KUKU_SAY = ['', 'いち', 'に', 'さん', 'し', 'ご', 'ろく', 'しち', 'はち', 'く'];
  function benkyo() {
    where = 'くく';
    C.kuku.ITEMS.forEach(function (it) {
      add(C.kuku.speakText(it, 'mul'), it.a + 'かける' + it.b + 'は？');
      add(C.kuku.speakText(C.kuku.question(it, 'blank'), 'blank'));
    });
    where = 'けいさん（部品）';
    range(0, 199).forEach(function (n) { add(n + 'たす｜' + n + 'は？'); add(n + 'ひく｜' + n + 'は？'); });
    where = 'こたえ（くく・けいさん）';
    range(0, 199).forEach(function (n) { add('こたえは ' + n + ' だよ。 つぎは できるよ！'); });
    add('せいかい！');
    add('もういっかい、やってみよう！');

    where = 'かん字';
    var K = C.kanji, MSG = B.kanjiScreen.MSG;
    K.ITEMS.forEach(function (it) {
      it.yomi.forEach(function (y, yi) {
        var q = K.makeQuestion(it.k, 'kaki', null, yi);
        add(K.speakText(q));
        add('こたえは ' + y.r + ' だよ。 つぎは できるよ！');   // よみの こたえ（かきは こたえを読まない）
      });
    });
    add(K.speakText({ kind: 'yomi' }));
    Object.keys(MSG).forEach(function (k) { add(MSG[k]); });

    where = '道とく';
    var DB = C.doutoku;
    DB.SCENES.forEach(function (sc) {
      DB.sentences(DB.speakText(sc)).forEach(function (s) { add(s); });
      sc.choices.forEach(function (c) {
        var kind = sc.kind === 'think' ? 'think' : (c.good ? 'good' : 'retry');
        DB.sentences(DB.replyText(sc, { kind: kind, reply: c.reply, end: sc.end })).forEach(function (s) { add(s); });
      });
    });

    where = '日本の 地図';
    var J = C.japan, JD = C.japanData;
    function addQ(q) {
      J.sentences(J.speakText(q)).forEach(function (s) { add(s); });
      ['correct', 'retry', 'show'].forEach(function (kind) { J.sentences(J.replyText(q, { kind: kind })).forEach(function (s) { add(s); }); });
    }
    JD.REGIONS.forEach(function (r) { ['atete', 'touch'].forEach(function (kind) { addQ(J.makeQuestion(1, kind, r.id)); }); });
    JD.PREFS.forEach(function (p) {
      ['atete', 'kencho', 'touch'].forEach(function (kind) { addQ(J.makeQuestion(2, kind, p.id, null, { productIndex: 0 })); });
      p.products.forEach(function (pr, i) { addQ(J.makeQuestion(2, 'meibutsu', p.id, null, { productIndex: i })); });
    });
    add('日本はかせにちかづいたね！');

    where = 'せかいの 国';
    var W = C.world, WD = C.worldData;
    function addW(q) {
      W.sentences(W.askSay(q)).forEach(function (s) { add(s); });
      ['correct', 'retry', 'reveal'].forEach(function (kind) { W.sentences(W.replySay(q, kind)).forEach(function (s) { add(s); }); });
    }
    WD.COUNTRIES.forEach(function (c) { ['flag', 'pick', 'map'].forEach(function (t) { addW({ type: t, id: c.id, answer: c.id, choices: [] }); }); });
    WD.CONTINENTS.forEach(function (k) { addW({ type: 'cont', id: k.id, answer: k.id, choices: [] }); });

    where = '長さ・かさ';
    var NG = C.nagasa;
    [1, 2, 3].forEach(function (lv) {
      NG.idsFor(lv).forEach(function (id) {
        var q = NG.makeQuestion(id, lv);
        add(NG.speakText(q));
        add(NG.answerText(q));
      });
    });

    where = 'ごほうび（べんきょう）';
    add('よく がんばったね！');
    add('よく かんがえたね！');
    range(0, 10).forEach(function (n) { add('ほしが ' + n + 'こ'); });
    add('きょうは たくさん がんばったね。 おやすみしよう');
  }

  /* ---------- ソースに直接書いてある文（speak('…') / speakThen('…', …)） ---------- */
  var SOURCES = ['app-chiiku/game.js', 'app-chiiku/kazu.js', 'app-chiiku/tokei.js', 'app-chiiku/iro.js', 'app-chiiku/machigai.js', 'app-chiiku/doutoku.js', 'app-chiiku/okaimono.js',
    'app-benkyo/main.js', 'app-benkyo/kuku-screen.js', 'app-benkyo/keisan-screen.js', 'app-benkyo/kanji-screen.js',
    'app-benkyo/doutoku-screen.js', 'app-benkyo/japan-screen.js', 'app-benkyo/world-screen.js', 'app-benkyo/nagasa-screen.js'];
  function literals() {
    return Promise.all(SOURCES.map(function (f) {
      return fetch('../' + f).then(function (r) { return r.text(); }).then(function (src) {
        where = f;
        var re = /speak(?:Then)?\(\s*(['"])((?:(?!\1)[^\\\n])*)\1\s*[,)]/g, m;
        while ((m = re.exec(src))) add(m[2]);
      });
    }));
  }

  /* ---------- ふりがなの一覧（読みのまちがい調べ用）：漢字<TAB>読み（ソースの {漢字|よみ} から） ---------- */
  var RUBY_SOURCES = SOURCES.concat(['app-benkyo/subjects/doutoku.js', 'app-benkyo/subjects/japan.js', 'app-benkyo/subjects/japan-data.js',
    'app-benkyo/subjects/world.js', 'app-benkyo/subjects/world-data.js', 'app-benkyo/subjects/nagasa.js']);
  function rubyList() {
    var seen = {}, rows = [];
    return Promise.all(RUBY_SOURCES.map(function (f) {
      return fetch('../' + f).then(function (r) { return r.text(); }).then(function (src) {
        var re = /\{([^|{}\n]+)\|([^|{}\n]+)\}/g, m;
        while ((m = re.exec(src))) { var k = m[1] + '\t' + m[2]; if (!seen[k]) { seen[k] = 1; rows.push(k); } }
      });
    })).then(function () { return rows.sort().join('\n') + '\n'; });
  }

  // 集める（テストからも使う）。見分け方の一覧を返す
  var collected = null;
  function collect() {
    if (!collected) collected = Promise.resolve().then(function () { chiiku(); benkyo(); return literals(); })
      .then(function () { return Object.keys(map).sort(); });
    return collected;
  }

  function run() {
    var out = document.getElementById('summary');
    collect().catch(function (e) { out.textContent = 'エラー: ' + e.message + '\n（' + where + '）'; throw e; }).then(function (keys) {
      var tsv = keys.map(function (k) { return k + '\t' + map[k] + '\t' + from[k] + '\t' + (yomiOf[k] || ''); }).join('\n') + '\n';
      var chars = keys.reduce(function (n, k) { return n + k.length; }, 0);
      window.ChiidVoiceLines.keys = keys;
      return rubyList().then(function (ruby) { return fetch('/__save/voice-ruby.tsv', { method: 'POST', body: ruby }); })
        .then(function () { return fetch('/__save/voice-lines.tsv', { method: 'POST', body: tsv }); }).then(function (r) { return r.ok ? '保存しました' : '保存できませんでした'; }, function () { return '保存できませんでした'; })
        .then(function (msg) { out.textContent = '文の数: ' + keys.length + '（文字数 ' + chars + '）\n' + msg; });
    });
  }

  window.ChiidVoiceLines = { run: run, collect: collect, add: add, map: map };
})();
