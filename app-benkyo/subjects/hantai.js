/* はんたい ことば（小2）。Chiid.hantai
   ことばの組・文と、問題を作る・判定する・読み上げの文を作る関数。画面には触らない（画面は hantai-screen.js）。
   画面の字：1年生の漢字はそのまま、2年生の漢字は {漢字|よみ}、3年生以上は ひらがな。
   読み上げの音声は「よみ」（ひらがな）から作る（「上」を「じょう」と読まないように）。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'hantai';
  var MAX_LEVEL = 3;
  var ROUND_SIZE = 10;
  var STAR_EVERY = 5;

  // 1年生の漢字（ふりがななし）の よみ。長いものから置きかえる
  var KYOMI = {
    '大きい': 'おおきい', '小さい': 'ちいさい', '白い': 'しろい', '早い': 'はやい', '入る': 'はいる', '出る': 'でる',
    '入れる': 'いれる', '出す': 'だす', '立つ': 'たつ', '上げる': 'あげる', '下げる': 'さげる',
    '上': 'うえ', '下': 'した', '右': 'みぎ', '左': 'ひだり', '中': 'なか', '男': 'おとこ', '女': 'おんな',
    '本': 'ほん', '山': 'やま', '音': 'おと', '石': 'いし', '気': 'き', '空': 'そら', '足': 'あし', '見る': 'みる'
  };
  var KYOMI_KEYS = Object.keys(KYOMI).sort(function (a, b) { return b.length - a.length; });
  function yomi(t) {
    var s = String(t).replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$2');
    if (KYOMI[s]) return KYOMI[s];
    KYOMI_KEYS.forEach(function (k) { s = s.split(k).join(KYOMI[k]); });
    return s;
  }
  function w(t) { return { t: t, y: yomi(t) }; }

  // レベル1・2の組（設計書 3章）。[id, なかま, a, b]
  var PAIR_ROWS = [
    // レベル1 ようす
    [1, 'ookii', '大きさ', '大きい', '小さい'], [1, 'nagai', '大きさ', '{長|なが}い', 'みじかい'], [1, 'takai', '大きさ', '{高|たか}い', 'ひくい'],
    [1, 'futoi', '大きさ', '{太|ふと}い', '{細|ほそ}い'], [1, 'hiroi', '大きさ', '{広|ひろ}い', 'せまい'], [1, 'fukai', '大きさ', 'ふかい', 'あさい'],
    [1, 'omoi', '大きさ', 'おもい', 'かるい'],
    [1, 'akarui', '見た目', '{明|あか}るい', 'くらい'], [1, 'kuroi', '見た目', '{黒|くろ}い', '白い'], [1, 'atarashii', '見た目', '{新|あたら}しい', '{古|ふる}い'],
    [1, 'kirei', '見た目', 'きれい', 'きたない'], [1, 'koi', '見た目', 'こい', 'うすい'],
    [1, 'ureshii', '気もち', 'うれしい', 'かなしい'], [1, 'suki', '気もち', 'すき', 'きらい'], [1, 'omoshiroi', '気もち', 'おもしろい', 'つまらない'],
    [1, 'tokui', '気もち', 'とくい', 'にがて'], [1, 'yoi', '気もち', 'よい', 'わるい'],
    [1, 'tsuyoi', 'そのほか', '{強|つよ}い', '{弱|よわ}い'], [1, 'ooi', 'そのほか', '{多|おお}い', '{少|すく}ない'], [1, 'tooi', 'そのほか', '{遠|とお}い', '{近|ちか}い'],
    [1, 'hayai', 'そのほか', '早い', 'おそい'], [1, 'katai', 'そのほか', 'かたい', 'やわらかい'], [1, 'atatakai', 'そのほか', 'あたたかい', 'すずしい'],
    [1, 'nigiyaka', 'そのほか', 'にぎやか', 'しずか'], [1, 'kantan', 'そのほか', 'かんたん', 'むずかしい'], [1, 'kitsui', 'そのほか', 'きつい', 'ゆるい'],
    [1, 'isogashii', 'そのほか', 'いそがしい', 'ひま'],
    // レベル2 うごき・ばしょ・とき
    [2, 'akeru', 'うごき', 'あける', 'しめる'], [2, 'hiraku', 'うごき', 'ひらく', 'とじる'], [2, 'hairu', 'うごき', '入る', '出る'],
    [2, 'ireru', 'うごき', '入れる', '出す'], [2, 'katsu', 'うごき', 'かつ', 'まける'], [2, 'iku', 'うごき', '{行|い}く', '{来|く}る'],
    [2, 'uru', 'うごき', '{売|う}る', '{買|か}う'], [2, 'tatsu', 'うごき', '立つ', 'すわる'], [2, 'okiru', 'うごき', 'おきる', 'ねる'],
    [2, 'hajimaru', 'うごき', 'はじまる', 'おわる'], [2, 'fueru', 'うごき', 'ふえる', 'へる'], [2, 'noboru', 'うごき', 'のぼる', 'おりる'],
    [2, 'tasu', 'うごき', 'たす', 'ひく'], [2, 'ageru', 'うごき', '上げる', '下げる'], [2, 'tsukeru', 'うごき', 'つける', 'けす'],
    [2, 'kasu', 'うごき', 'かす', 'かりる'], [2, 'susumu', 'うごき', 'すすむ', 'もどる'], [2, 'oshieru', 'うごき', '{教|おし}える', 'ならう'],
    [2, 'hirou', 'うごき', 'ひろう', 'すてる'], [2, 'warau', 'うごき', 'わらう', 'なく'],
    [2, 'ue', 'ばしょ', '上', '下'], [2, 'migi', 'ばしょ', '右', '左'], [2, 'mae', 'ばしょ', '{前|まえ}', '{後|うし}ろ'],
    [2, 'minami', 'ばしょ', '{南|みなみ}', '{北|きた}'], [2, 'higashi', 'ばしょ', '{東|ひがし}', '{西|にし}'], [2, 'naka', 'ばしょ', '中', '{外|そと}'],
    [2, 'omote', 'ばしょ', 'おもて', 'うら'], [2, 'tate', 'ばしょ', 'たて', 'よこ'],
    [2, 'asa', 'とき', '{朝|あさ}', '{夜|よる}'], [2, 'natsu', 'とき', '{夏|なつ}', '{冬|ふゆ}'], [2, 'haru', 'とき', '{春|はる}', '{秋|あき}'],
    [2, 'kinou', 'とき', 'きのう', 'あした'], [2, 'gozen', 'とき', '{午前|ごぜん}', '{午後|ごご}'],
    [2, 'ani', 'ひと', '{兄|あに}', '{弟|おとうと}'], [2, 'ane', 'ひと', '{姉|あね}', '{妹|いもうと}'], [2, 'chichi', 'ひと', '{父|ちち}', '{母|はは}'],
    [2, 'otoko', 'ひと', '男', '女']
  ];
  var PAIRS = PAIR_ROWS.map(function (r) { return { id: r[1], level: r[0], group: r[2], a: w(r[3]), b: w(r[4]) }; });

  // レベル3の文（設計書 3章）。[id, 前, ことば, 後, 答え, [まちがい3つ]]
  var SENT_ROWS = [
    ['biru', 'この ビルは ', '{高|たか}い', '。', 'ひくい', ['やすい', '大きい', '{新|あたら}しい']],
    ['ringo', 'この りんごは ', '{高|たか}い', '。', 'やすい', ['ひくい', '小さい', 'おいしい']],
    ['ocha', 'お{茶|ちゃ}が ', 'あつい', '。', 'つめたい', ['さむい', 'うすい', 'あまい']],
    ['heya', 'へやが ', 'あつい', '。', 'さむい', ['つめたい', 'うすい', '{広|ひろ}い']],
    ['hon', 'この 本は ', 'あつい', '。', 'うすい', ['さむい', 'つめたい', '{古|ふる}い']],
    ['terebi', 'テレビを ', 'つける', '。', 'けす', ['しめる', '見る', '{買|か}う']],
    ['kutsu', 'くつを ', 'はく', '。', 'ぬぐ', ['きる', '{買|か}う', 'あらう']],
    ['fuku', 'ふくを ', 'きる', '。', 'ぬぐ', ['はく', '{買|か}う', 'あらう']],
    ['kare', 'この カレーは ', 'あまい', '。', 'からい', ['すっぱい', 'おいしい', 'つめたい']],
    ['kohi', 'この コーヒーは ', 'にがい', '。', 'あまい', ['からい', 'あつい', 'こい']],
    ['kaze', '{風|かぜ}が ', '{強|つよ}い', '。', '{弱|よわ}い', ['つめたい', 'はやい', 'さむい']],
    ['michi', '{道|みち}が ', '{広|ひろ}い', '。', 'せまい', ['{長|なが}い', 'あさい', '{近|ちか}い']],
    ['ike', '{池|いけ}が ', 'ふかい', '。', 'あさい', ['せまい', 'ひくい', 'うすい']],
    ['sora', '空が ', '{明|あか}るい', '。', 'くらい', ['ひくい', 'せまい', 'つめたい']],
    ['doa', 'ドアを ', 'あける', '。', 'しめる', ['けす', 'おす', 'ぬぐ']],
    ['iro', '{色|いろ}が ', 'こい', '。', 'うすい', ['{細|ほそ}い', 'かるい', 'せまい']],
    ['kaban', 'この かばんは ', 'おもい', '。', 'かるい', ['やすい', '小さい', '{弱|よわ}い']],
    ['ashi', '{兄|あに}は 足が ', 'はやい', '。', 'おそい', ['みじかい', '{細|ほそ}い', '{弱|よわ}い']],
    ['boru', 'ボールを ', '{強|つよ}く', ' ける。', '{弱|よわ}く', ['はやく', '{遠|とお}く', 'ひくく']],
    ['kaidan', 'かいだんを ', 'のぼる', '。', 'おりる', ['{歩|ある}く', '{走|はし}る', 'あらう']],
    ['kami', 'かみが ', '{長|なが}い', '。', 'みじかい', ['ひくい', '{細|ほそ}い', 'かるい']],
    ['yama', 'この 山は ', '{高|たか}い', '。', 'ひくい', ['やすい', '{古|ふる}い', '大きい']],
    ['omocha', 'この おもちゃは ', '{高|たか}い', '。', 'やすい', ['ひくい', '小さい', '{新|あたら}しい']],
    ['koe', '{声|こえ}が ', '大きい', '。', '小さい', ['ひくい', '{遠|とお}い', 'おそい']],
    ['oto', '音が ', '{高|たか}い', '。', 'ひくい', ['やすい', '小さい', 'おそい']],
    ['mado', 'まどを ', 'しめる', '。', 'あける', ['けす', 'ひく', 'はく']],
    ['denki', '{電|でん}気を ', 'けす', '。', 'つける', ['あける', 'おす', 'ぬぐ']],
    ['kasu', '本を ', 'かす', '。', 'かりる', ['{買|か}う', '{読|よ}む', 'あける']],
    ['gomi', 'ごみを ', 'すてる', '。', 'ひろう', ['もやす', 'はこぶ', 'あらう']],
    ['shiai', 'しあいに ', 'かつ', '。', 'まける', ['出る', 'おわる', 'はじまる']],
    ['kazu', 'りんごが ', '{多|おお}い', '。', '{少|すく}ない', ['小さい', 'かるい', 'やすい']],
    ['yoru', '{夜|よる}は ', 'くらい', '。', '{明|あか}るい', ['白い', '{広|ひろ}い', 'あつい']],
    ['heya2', 'へやが ', 'きれい', '。', 'きたない', ['くらい', 'せまい', 'しずか']],
    ['koen', '{公園|こうえん}が ', 'にぎやか', '。', 'しずか', ['くらい', '{広|ひろ}い', 'きれい']],
    ['shukudai', 'しゅくだいが ', 'かんたん', '。', 'むずかしい', ['{多|おお}い', '{長|なが}い', 'おもい']],
    ['kutsu2', 'くつが ', 'きつい', '。', 'ゆるい', ['かるい', '{古|ふる}い', '{黒|くろ}い']],
    ['ishi', '石が ', 'かたい', '。', 'やわらかい', ['かるい', '小さい', 'つめたい']]
  ];
  var SENTENCES = SENT_ROWS.map(function (r) {
    return { id: r[0], pre: r[1], word: w(r[2]), post: r[3], ans: w(r[4]), wrong: r[5].map(w) };
  });

  function lvOf(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rng || Math.random)() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function wordsOf(list) { return list.reduce(function (acc, o) { return acc.concat([o.a, o.b]); }, []); }

  // まちがいの選択肢に出さないことば（もう1つの反対と言えるもの）。問題のことば → 出さないことば
  var AVOID = {
    '{兄|あに}': ['{姉|あね}'], '{姉|あね}': ['{兄|あに}'], '{弟|おとうと}': ['{妹|いもうと}'], '{妹|いもうと}': ['{弟|おとうと}'],
    'あける': ['とじる'], 'とじる': ['あける'], 'ひらく': ['しめる'], 'しめる': ['ひらく'],
    '{行|い}く': ['もどる'], 'もどる': ['{行|い}く'], 'せまい': ['大きい'], '大きい': ['せまい']
  };

  function pairById(id) { return PAIRS.filter(function (p) { return p.id === id; })[0]; }
  function sentById(id) { return SENTENCES.filter(function (s) { return s.id === id; })[0]; }

  function idsFor(level) {
    var l = lvOf(level);
    if (l === 3) return SENTENCES.map(function (s) { return 's:' + s.id; });
    var out = [];
    PAIRS.forEach(function (p) { if (p.level === l) { out.push('w:' + p.id + ':a'); out.push('w:' + p.id + ':b'); } });
    return out;
  }

  // 文まるごとの { t, y }
  function whole(s, x) { return { t: s.pre + x.t + s.post, y: yomi(s.pre) + x.y + yomi(s.post) }; }

  function makeQuestion(id, rng) {
    rng = rng || Math.random;
    var parts = String(id).split(':');
    var choices, answerObj, q;
    if (parts[0] === 's') {
      var s = sentById(parts[1]);
      answerObj = whole(s, s.ans);
      choices = shuffle([answerObj].concat(s.wrong.map(function (x) { return whole(s, x); })), rng);
      q = { id: id, level: 3, kind: 'sentence', ask: whole(s, s.word) };
    } else {
      var p = pairById(parts[1]);
      var ask = parts[2] === 'b' ? p.b : p.a;
      answerObj = parts[2] === 'b' ? p.a : p.b;
      // まちがいは、同じなかまの ほかの組のことばから。足りなければ同じレベルのほかの組から。
      // ただし、もう1つの反対と言えることば（AVOID）は入れない
      var avoid = AVOID[ask.t] || [];
      var others = PAIRS.filter(function (o) { return o.level === p.level && o !== p; });
      var ok = function (x) { return avoid.indexOf(x.t) < 0; };
      var same = shuffle(wordsOf(others.filter(function (o) { return o.group === p.group; })).filter(ok), rng);
      var rest = shuffle(wordsOf(others.filter(function (o) { return o.group !== p.group; })).filter(ok), rng);
      var wrong = same.concat(rest).slice(0, 3);
      choices = shuffle([answerObj].concat(wrong), rng);
      q = { id: id, level: p.level, kind: 'word', ask: ask };
    }
    q.choices = choices;
    q.answer = choices.indexOf(answerObj);
    return q;
  }

  function pickQuestion(opts, rng) {
    opts = opts || {};
    rng = rng || Math.random;
    var ids = idsFor(opts.level).filter(function (id) { return id !== opts.lastId; });
    var id = C.adaptive.pickWeighted(ids, opts.missCounts || {}, rng) || ids[0];
    return makeQuestion(id, rng);
  }

  function check(q, index) { return !!q && Number(index) === q.answer; }

  var ASK_S = '｜どれが はんたいの 文かな？';
  var ASK_S_Y = '｜どれが はんたいの ぶんかな？';
  function speakText(q) { return q.kind === 'sentence' ? q.ask.t + ASK_S : '「' + q.ask.t + '」の はんたいは？'; }
  function speakYomi(q) { return q.kind === 'sentence' ? q.ask.y + ASK_S_Y : '「' + q.ask.y + '」の はんたいは？'; }
  function answerText(q) { return 'こたえは｜' + q.choices[q.answer].t + '｜だよ。｜つぎは できるよ！'; }
  function answerYomi(q) { return 'こたえは｜' + q.choices[q.answer].y + '｜だよ。｜つぎは できるよ！'; }

  // 記録から、今のレベル・直近の結果・問題ごとのまちがい数を読む（nagasa.js と同じ）
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    if (mine.length) {
      res.level = lvOf(mine[mine.length - 1].level);
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  C.hantai = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, STAR_EVERY: STAR_EVERY,
    PAIRS: PAIRS, SENTENCES: SENTENCES, yomi: yomi,
    idsFor: idsFor, makeQuestion: makeQuestion, pickQuestion: pickQuestion, check: check,
    speakText: speakText, speakYomi: speakYomi, answerText: answerText, answerYomi: answerYomi,
    progressFromLogs: progressFromLogs
  };
})();
