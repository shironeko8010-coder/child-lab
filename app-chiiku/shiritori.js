/* しりとり。Chiid.shiritori
   ひよこ（声は ずんだもん）と交代で、絵カードを選んで しりとりをつなげる。子どもが5回つなげたらゴール。
   園児が見る文字は、ひらがなだけ。通信は行わない。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'shiritori';
  var MAX_LEVEL = 3;
  var GOAL = 5;                // 子どもが5回つなげたらゴール

  // ことば（設計書 5章）。pic は Unicode 12（2019年）以前の絵文字だけ。
  // 決まり：のばす音・小さい字で終わらない／ひらがなで書く／はじまりの音1つにつき3個以上
  var WORDS = [
    { id: 'ame', word: 'あめ', pic: '🍬' }, { id: 'ari', word: 'あり', pic: '🐜' }, { id: 'ashi', word: 'あし', pic: '🦶' }, { id: 'akachan', word: 'あかちゃん', pic: '👶' },
    { id: 'ichigo', word: 'いちご', pic: '🍓' }, { id: 'isu', word: 'いす', pic: '🪑' }, { id: 'ika', word: 'いか', pic: '🦑' }, { id: 'iruka', word: 'いるか', pic: '🐬' },
    { id: 'ushi', word: 'うし', pic: '🐄' }, { id: 'umi', word: 'うみ', pic: '🌊' }, { id: 'uma', word: 'うま', pic: '🐎' },
    { id: 'onigiri', word: 'おにぎり', pic: '🍙' }, { id: 'oni', word: 'おに', pic: '👹' }, { id: 'omawarisan', word: 'おまわりさん', pic: '👮' },
    { id: 'kame', word: 'かめ', pic: '🐢' }, { id: 'kasa', word: 'かさ', pic: '☂️' }, { id: 'kani', word: 'かに', pic: '🦀' }, { id: 'kaban', word: 'かばん', pic: '👜' },
    { id: 'kitsune', word: 'きつね', pic: '🦊' }, { id: 'kinoko', word: 'きのこ', pic: '🍄' }, { id: 'kyuri', word: 'きゅうり', pic: '🥒' }, { id: 'kirin', word: 'きりん', pic: '🦒' },
    { id: 'kuma', word: 'くま', pic: '🐻' }, { id: 'kuri', word: 'くり', pic: '🌰' }, { id: 'kuruma', word: 'くるま', pic: '🚗' }, { id: 'kujira', word: 'くじら', pic: '🐳' },
    { id: 'koara', word: 'こあら', pic: '🐨' }, { id: 'kori', word: 'こおり', pic: '🧊' }, { id: 'koinobori', word: 'こいのぼり', pic: '🎏' },
    { id: 'gorira', word: 'ごりら', pic: '🦍' }, { id: 'gomibako', word: 'ごみばこ', pic: '🗑️' }, { id: 'gohan', word: 'ごはん', pic: '🍚' },
    { id: 'sakana', word: 'さかな', pic: '🐟' }, { id: 'sakura', word: 'さくら', pic: '🌸' }, { id: 'sai', word: 'さい', pic: '🦏' },
    { id: 'shika', word: 'しか', pic: '🦌' }, { id: 'shimauma', word: 'しまうま', pic: '🦓' }, { id: 'shiro', word: 'しろ', pic: '🏯' }, { id: 'shinkansen', word: 'しんかんせん', pic: '🚄' },
    { id: 'suika', word: 'すいか', pic: '🍉' }, { id: 'sushi', word: 'すし', pic: '🍣' }, { id: 'supun', word: 'すぷーん', pic: '🥄' },
    { id: 'sori', word: 'そり', pic: '🛷' }, { id: 'sokkusu', word: 'そっくす', pic: '🧦' }, { id: 'soroban', word: 'そろばん', pic: '🧮' },
    { id: 'tamago', word: 'たまご', pic: '🥚' }, { id: 'tako', word: 'たこ', pic: '🐙' }, { id: 'taiko', word: 'たいこ', pic: '🥁' },
    { id: 'tegami', word: 'てがみ', pic: '✉️' }, { id: 'tentomushi', word: 'てんとうむし', pic: '🐞' }, { id: 'tebukuro', word: 'てぶくろ', pic: '🧤' },
    { id: 'tori', word: 'とり', pic: '🐦' }, { id: 'tomato', word: 'とまと', pic: '🍅' }, { id: 'tora', word: 'とら', pic: '🐅' }, { id: 'tokei', word: 'とけい', pic: '⏰' },
    { id: 'nasu', word: 'なす', pic: '🍆' }, { id: 'nashi', word: 'なし', pic: '🍐' }, { id: 'naifu', word: 'ないふ', pic: '🔪' },
    { id: 'niwatori', word: 'にわとり', pic: '🐓' }, { id: 'niku', word: 'にく', pic: '🍖' }, { id: 'ninjin', word: 'にんじん', pic: '🥕' },
    { id: 'neko', word: 'ねこ', pic: '🐈' }, { id: 'nezumi', word: 'ねずみ', pic: '🐭' }, { id: 'nekutai', word: 'ねくたい', pic: '👔' },
    { id: 'hasami', word: 'はさみ', pic: '✂️' }, { id: 'hato', word: 'はと', pic: '🕊️' }, { id: 'hashi', word: 'はし', pic: '🥢' }, { id: 'hana', word: 'はな', pic: '🌷' },
    { id: 'banana', word: 'ばなな', pic: '🍌' }, { id: 'basu', word: 'ばす', pic: '🚌' }, { id: 'baiorin', word: 'ばいおりん', pic: '🎻' },
    { id: 'hiyoko', word: 'ひよこ', pic: '🐤' }, { id: 'hikoki', word: 'ひこうき', pic: '✈️' }, { id: 'himawari', word: 'ひまわり', pic: '🌻' },
    { id: 'fune', word: 'ふね', pic: '🚢' }, { id: 'fukuro', word: 'ふくろう', pic: '🦉' }, { id: 'fusen', word: 'ふうせん', pic: '🎈' },
    { id: 'hoshi', word: 'ほし', pic: '⭐' }, { id: 'hone', word: 'ほね', pic: '🦴' }, { id: 'hoki', word: 'ほうき', pic: '🧹' },
    { id: 'mato', word: 'まと', pic: '🎯' }, { id: 'maiku', word: 'まいく', pic: '🎤' }, { id: 'masuku', word: 'ますく', pic: '😷' },
    { id: 'mimi', word: 'みみ', pic: '👂' }, { id: 'mikazuki', word: 'みかづき', pic: '🌙' }, { id: 'mikan', word: 'みかん', pic: '🍊' },
    { id: 'megane', word: 'めがね', pic: '👓' }, { id: 'medamayaki', word: 'めだまやき', pic: '🍳' }, { id: 'meron', word: 'めろん', pic: '🍈' },
    { id: 'rakko', word: 'らっこ', pic: '🦦' }, { id: 'rajio', word: 'らじお', pic: '📻' }, { id: 'raion', word: 'らいおん', pic: '🦁' },
    { id: 'ringo', word: 'りんご', pic: '🍎' }, { id: 'risu', word: 'りす', pic: '🐿️' }, { id: 'ribon', word: 'りぼん', pic: '🎀' },
    { id: 'roketto', word: 'ろけっと', pic: '🚀' }, { id: 'rosoku', word: 'ろうそく', pic: '🕯️' }, { id: 'robotto', word: 'ろぼっと', pic: '🤖' }
  ];

  // 読み上げ文（設計書 8章）。｜は音声ファイルの部品の区切り。部品は「は」で始めない
  var TEXT = {
    start: 'しりとり、はじめるよ！｜さいしょは…',
    ask: 'つぎは どれかな？',
    reply: 'じゃあ ぼくは…',
    again: 'もういっかい！',
    n: 'んで おわると つづかないね。｜ほかのを えらぼう！',
    hint: 'ひかっている えを おしてね',
    giveup: 'うーん、おもいつかないや。｜きみの かち！',
    goal: 'すごい！ 5かい つながったね！'
  };

  // てんてん・まるだけちがう音のなかま
  var GROUPS = ['かが', 'きぎ', 'くぐ', 'けげ', 'こご', 'さざ', 'しじ', 'すず', 'せぜ', 'そぞ', 'ただ', 'ちぢ', 'つづ', 'てで', 'とど',
    'はばぱ', 'ひびぴ', 'ふぶぷ', 'へべぺ', 'ほぼぽ'];

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function firstKana(word) { return word.charAt(0); }
  function lastKana(word) { return word.charAt(word.length - 1); }
  function endsN(word) { return lastKana(word) === 'ん'; }
  function isStart(kana) { return WORDS.some(function (w) { return firstKana(w.word) === kana; }); }
  function similar(kana) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (GROUPS[i].indexOf(kana) < 0) continue;
      var others = GROUPS[i].split('').filter(function (k) { return k !== kana && isStart(k); });
      return others.length ? others[0] : null;
    }
    return null;
  }
  function linkKana() {
    var seen = {}, out = [];
    WORDS.forEach(function (w) {
      if (endsN(w.word)) return;
      var k = lastKana(w.word);
      if (!seen[k]) { seen[k] = 1; out.push(k); }
    });
    return out;
  }

  function plus(used, w) { var u = {}; for (var k in used) if (used[k]) u[k] = true; if (w) u[w.id] = true; return u; }
  function pick(arr, rng) { return arr[Math.floor((rng || Math.random)() * arr.length)]; }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rng || Math.random)() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // kana で始まり「ん」で終わらない、まだ出ていない ことば
  function goodsFor(kana, used) {
    return WORDS.filter(function (w) { return !used[w.id] && firstKana(w.word) === kana && !endsN(w.word); });
  }
  // ひよこが w に続けられるか（その先に子どもの正しいカードもあるか）
  function canReply(w, used) {
    var u = plus(used, w);
    return goodsFor(lastKana(w.word), u).some(function (r) { return goodsFor(lastKana(r.word), plus(u, r)).length > 0; });
  }

  // ひよこのことば：kana で始まり、その先に子どもの正しいカードがあるもの。なければ null
  // できれば、子どものカードの先も ひよこが続けられるものを選ぶ（途中で止まらないように）
  function pickReply(kana, used, rng) {
    used = used || {};
    var pool = goodsFor(kana, used).filter(function (r) { return goodsFor(lastKana(r.word), plus(used, r)).length > 0; });
    var better = pool.filter(function (r) {
      var u = plus(used, r);
      return goodsFor(lastKana(r.word), u).some(function (a) { return canReply(a, u); });
    });
    if (better.length) return pick(better, rng);
    return pool.length ? pick(pool, rng) : null;
  }

  // 最初のことば：子どもが続けられて、その先も ひよこが続けられるもの
  function pickStart(used, rng) {
    used = used || {};
    var pool = WORDS.filter(function (w) {
      if (used[w.id] || endsN(w.word)) return false;
      var u = plus(used, w);
      return goodsFor(lastKana(w.word), u).some(function (a) { return canReply(a, u); });
    });
    return pick(pool, rng);
  }

  // 子どもの番のカード。返り値 { answer, cards }。正しいカードがなければ null
  function makeChoices(kana, level, used, opts) {
    used = used || {};
    opts = opts || {};
    var rng = opts.rng || Math.random;
    level = lv(level);
    var goods = goodsFor(kana, used);
    if (!goods.length) return null;
    var preferred = goods.filter(function (w) { return canReply(w, used); });
    var pool = preferred.length ? preferred : goods;
    var answerId = C.adaptive.pickWeighted(pool.map(function (w) { return w.id; }), opts.missCounts || {}, rng);
    var answer = pool.filter(function (w) { return w.id === answerId; })[0] || pool[0];
    var n = level === 1 ? 3 : 4;
    var sim = similar(kana);
    var cards = [answer];
    var free = WORDS.filter(function (w) { return !used[w.id] && w !== answer; });
    if (level === 2 && sim) {
      var s = free.filter(function (w) { return firstKana(w.word) === sim; });
      if (s.length) cards.push(pick(s, rng));
    }
    if (level === 3) {
      var nw = free.filter(function (w) { return firstKana(w.word) === kana && endsN(w.word); });
      if (nw.length) cards.push(pick(nw, rng));
    }
    // のこりは、はじまりの音が まったくちがう ことば
    var rest = shuffle(free.filter(function (w) {
      var f = firstKana(w.word);
      return f !== kana && f !== sim && cards.indexOf(w) < 0;
    }), rng);
    while (cards.length < n && rest.length) cards.push(rest.shift());
    return { answer: answer, cards: shuffle(cards, rng) };
  }

  function judge(kana, w) {
    if (firstKana(w.word) !== kana) return 'wrong';
    if (endsN(w.word)) return 'n';
    return 'good';
  }
  function speakAsk(kana, level) { return lv(level) === 1 ? kana + 'から はじまる ものは どれかな？' : TEXT.ask; }
  function speakWrong(kana) { return kana + 'から はじまる ものだよ。｜' + TEXT.again; }

  // 記録から、今のレベル・直近の結果・ことばごとのまちがい数を読む（okaimono.js と同じ考え方）
  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    if (mine.length) {
      res.level = lv(mine[mine.length - 1].level);
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  /* ---------- 画面 ---------- */
  var WAIT_GOOD = 800;         // 正解のあと、ひよこの番までの間（ms）
  var SHOW_CHAIN = 4;          // 上の列に見せる ことばの数
  var st = null;               // { profileId, level, recent, missCounts }
  var g = null;                // 1回のしりとり { chain, used, turns, kana, answer, misses, missed, busy, say, dom }

  function U() { return C.chiikuUi; }
  function shown(text) { return text.replace(/｜/g, ' '); }   // 画面に出す文（部品の区切りをとる）

  function start(profileId) {
    st = { profileId: profileId, level: 1, recent: [], missCounts: {} };
    var ui = U();
    var sid = ui.screenId ? ui.screenId() : null;   // 記録を読むあいだに ホームへ戻ったら、始めない
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(profileId); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        var p = progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent; st.missCounts = p.missCounts;
        if (sid !== null && ui.screenId() !== sid) return;
        newGame();
      });
  }

  function newGame() {
    var ui = U();
    var over = false;
    try { over = C.timer.isOver(st.profileId); } catch (e) { over = false; }
    if (over) { ui.showRest(); return; }   // 利用時間を超えていたら、あいさつの前に お休み
    var app = ui.newScreen('shiritori');
    app.appendChild(ui.topBar({ home: true }));
    var wrap = ui.el('div', 'sr-wrap');
    var chainEl = ui.el('div', 'sr-chain');
    var talk = ui.el('div', 'q-head sr-talk');
    var who = ui.el('div', 'q-chara');
    var ch = ui.chara('normal');
    who.appendChild(ch);
    var bub = ui.bubble('');
    bub.classList.add('sr-bubble');
    var again = ui.button('icon-btn speak-btn', function () {
      if (!g || g.busy) return;   // 読み上げ・ひよこの番の あいだは押せない（声が途中で切れないように）
      ui.play('tap');
      if (g.say) ui.speak(g.say);
    });
    again.setAttribute('aria-label', 'もういちど きく');
    again.appendChild(ui.svg(ui.ICO.speaker));
    talk.appendChild(who); talk.appendChild(bub); talk.appendChild(again);
    var cardsEl = ui.el('div', 'sr-cards');
    wrap.appendChild(chainEl); wrap.appendChild(talk); wrap.appendChild(cardsEl);
    app.appendChild(wrap);

    var first = pickStart({});
    g = { chain: [first], used: {}, turns: 0, kana: null, answer: null, misses: 0, missed: false, busy: true, say: '',
      dom: { chain: chainEl, bub: bub, who: who, ch: ch, cards: cardsEl } };
    g.used[first.id] = true;
    renderChain(false);
    bub.textContent = 'しりとり、はじめるよ！';
    g.say = TEXT.start + '｜' + first.word + '。';
    ui.speakThen(g.say, 0, childTurn);
  }

  function setMood(mood) {
    var c = U().chara(mood);
    g.dom.who.replaceChild(c, g.dom.ch);
    g.dom.ch = c;
  }

  // 上の列：新しい4つを、矢印でつなぐ。最後の音を色で目立たせる
  function renderChain(pop) {
    var ui = U(), box = g.dom.chain;
    box.innerHTML = '';
    var list = g.chain.slice(-SHOW_CHAIN);
    list.forEach(function (w, i) {
      if (i > 0) box.appendChild(ui.el('span', 'sr-arrow', '→'));
      var link = ui.el('div', 'sr-link' + (pop && i === list.length - 1 ? ' sr-pop' : ''));
      link.appendChild(ui.el('span', 'sr-lpic', w.pic));
      var name = ui.el('span', 'sr-lword', w.word.slice(0, -1));
      name.appendChild(ui.el('span', 'sr-last', lastKana(w.word)));
      link.appendChild(name);
      box.appendChild(link);
    });
  }

  function childTurn() {
    var ui = U();
    var over = false;
    try { over = C.timer.isOver(st.profileId); } catch (e) { over = false; }
    if (over) { ui.showRest(); return; }
    var last = g.chain[g.chain.length - 1];
    g.kana = lastKana(last.word);
    var c = makeChoices(g.kana, st.level, g.used, { missCounts: st.missCounts });
    if (!c) { giveup(); return; }
    g.answer = c.answer; g.misses = 0; g.missed = false; g.level = st.level;
    setMood('normal');
    // ふきだし：レベル1・2は つなぐ音を大きく
    var bub = g.dom.bub;
    bub.innerHTML = '';
    if (g.level <= 2) {
      bub.appendChild(ui.el('span', 'sr-kana', g.kana));
      bub.appendChild(document.createTextNode('から はじまる ものは どれかな？'));
    } else {
      bub.textContent = TEXT.ask;
    }
    var box = g.dom.cards;
    box.innerHTML = '';
    box.className = 'sr-cards n' + c.cards.length;
    c.cards.forEach(function (w) {
      var b = ui.button('pick-card sr-card', function () { tap(b, w); });
      b.setAttribute('aria-label', w.word);
      b.appendChild(ui.el('span', 'sr-pic', w.pic));
      b.appendChild(ui.el('span', 'sr-name len' + Math.min(w.word.length, 6), w.word));
      b._word = w;
      box.appendChild(b);
    });
    g.say = speakAsk(g.kana, g.level);
    g.busy = false;
    ui.speak(g.say);
  }

  // カードを押す：ことばを読んでから判定する。判定中・ひよこの番は受けつけない
  function tap(btn, w) {
    var ui = U();
    if (!g || g.busy || btn.classList.contains('sr-tried')) return;
    g.busy = true;
    ui.play('tap');
    ui.speakThen(w.word + '。', 0, function () {
      var j = judge(g.kana, w);
      if (j === 'good') { good(btn, w); return; }
      ui.play('oops');
      btn.classList.add('sr-tried');
      btn.disabled = true;
      g.misses++; g.missed = true;
      var msg = j === 'n' ? TEXT.n : speakWrong(g.kana);
      if (g.misses >= 2) {
        Array.prototype.forEach.call(g.dom.cards.children, function (b) { if (b._word === g.answer) b.classList.add('sr-hint'); });
        msg += '｜' + TEXT.hint;
      }
      g.dom.bub.textContent = shown(msg);
      g.say = msg;
      ui.speak(msg);
      ui.later(function () { g.busy = false; }, 700);
    });
  }

  function good(btn, w) {
    var ui = U();
    ui.play('correct');
    btn.classList.add('sr-good');
    setMood('happy');
    finishTurn();
    g.chain.push(w);
    g.used[w.id] = true;
    g.turns++;
    renderChain(true);
    ui.later(hiyokoTurn, WAIT_GOOD);
  }

  // 子どもの番1回ぶんの記録（1回目で正しいカードなら true）・苦手・レベル
  function finishTurn() {
    var correct = !g.missed;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: g.answer.id, correct: correct, level: g.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[g.answer.id] = (st.missCounts[g.answer.id] || 0) + 1;
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
  }

  function hiyokoTurn() {
    var ui = U();
    if (g.turns >= GOAL) { showReward(TEXT.goal); return; }
    var last = g.chain[g.chain.length - 1];
    var r = pickReply(lastKana(last.word), g.used);
    if (!r) { giveup(); return; }
    g.chain.push(r);
    g.used[r.id] = true;
    setMood('normal');
    g.dom.cards.innerHTML = '';
    renderChain(true);
    g.dom.bub.textContent = 'じゃあ ぼくは… ' + r.word;
    g.say = TEXT.reply + '｜' + r.word + '。';
    ui.speakThen(g.say, 600, childTurn);
  }

  function giveup() {
    var ui = U();
    g.busy = true;
    g.dom.cards.innerHTML = '';
    g.dom.bub.textContent = shown(TEXT.giveup);
    ui.speakThen(TEXT.giveup, 500, function () { showReward(null); });
  }

  // ごほうび画面（okaimono.js と同じ形）。「つぎへ」で新しいしりとり
  function showReward(say) {
    var ui = U();
    var app = ui.newScreen('reward');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'reward-body');
    var stars = ui.el('div', 'stars');
    for (var i = 0; i < 3; i++) stars.appendChild(ui.svg(ui.STAR, 'reward-star s' + i));
    body.appendChild(stars);
    var row = ui.el('div', 'reward-row');
    row.appendChild(ui.chara('happy'));
    var info = ui.el('div', 'reward-info');
    info.appendChild(ui.el('p', 'reward-msg', 'すごい！'));
    var next = ui.button('btn-big btn-next', function () {
      if (next.disabled) return;
      next.disabled = true;
      ui.play('tap');
      newGame();
    });
    next.setAttribute('aria-label', 'つぎへ');
    next.appendChild(ui.svg(ui.ICO.next));
    next.appendChild(ui.el('span', null, 'つぎへ'));
    info.appendChild(next);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    if (say) ui.speak(say);
  }

  C.shiritori = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, GOAL: GOAL, WORDS: WORDS, TEXT: TEXT,
    firstKana: firstKana, lastKana: lastKana, endsN: endsN, similar: similar, linkKana: linkKana,
    pickStart: pickStart, pickReply: pickReply, makeChoices: makeChoices, judge: judge,
    speakAsk: speakAsk, speakWrong: speakWrong, progressFromLogs: progressFromLogs,
    start: start
  };
})();
