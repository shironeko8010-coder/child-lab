/* いろ・かたちゲーム「あかい まる は どれ？」。Chiid.iro
   声と文で聞く → SVGで描いた 色つきの形カードから えらぶ → ごほうび → つぎ。
   園児が見る文字は、ひらがなと数字だけ。カードに文字は出さない。通信は行わない。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。
   問題の id：いろ 'aka'、かたち 'maru'、くみあわせ 'aka-maru'。カードは { color, shape, id: 'aka-maru' }。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'iro';
  var MAX_LEVEL = 3;
  var ROUND_SIZE = 5;          // 5問ごとにごほうび画面
  var WAIT_CORRECT = 1500;     // 正解のあと、次へ進むまで（ms）

  // カラーユニバーサルデザイン推奨配色をもとにした4色（色の見え方が違う人にも見分けやすい）
  var COLORS = [
    { id: 'aka', name: 'あか', adj: 'あかい', hex: '#FF4B00' },
    { id: 'ao', name: 'あお', adj: 'あおい', hex: '#005AFF' },
    { id: 'kiiro', name: 'きいろ', adj: 'きいろい', hex: '#FFD400' },
    { id: 'midori', name: 'みどり', adj: 'みどりの', hex: '#03AF7A' }
  ];
  var SHAPES = [
    { id: 'maru', name: 'まる' },
    { id: 'sankaku', name: 'さんかく' },
    { id: 'shikaku', name: 'しかく' },
    { id: 'hoshi', name: 'ほし' }
  ];
  // 同じ問題の選択肢に いっしょに出さない色（いちばん見分けにくい組み合わせ）
  var CONFUSE = [['aka', 'midori']];

  // レベル1: いろ だけ／かたち だけ（ほかは そろえる・3たく）
  // レベル2: いろ だけ／かたち だけ（ほかは ばらばら・3たく）
  // レベル3: いろ＋かたち の くみあわせ（4たく）
  function levelConfig(level) {
    if (level <= 1) return { kinds: ['iro', 'katachi'], mix: false, choices: 3 };
    if (level === 2) return { kinds: ['iro', 'katachi'], mix: true, choices: 3 };
    return { kinds: ['both'], mix: true, choices: 4 };
  }

  function findBy(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function colorOf(id) { return findBy(COLORS, id); }
  function shapeOf(id) { return findBy(SHAPES, id); }
  function ids(list) { return list.map(function (x) { return x.id; }); }

  function conflicts(a, b) {
    return CONFUSE.some(function (p) { return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a); });
  }
  // すでに使っている色のどれとも まぎらわしくない色
  function okColor(c, used) {
    return used.every(function (u) { return !conflicts(c, u); });
  }

  function itemId(item) {
    if (item.kind === 'iro') return item.color;
    if (item.kind === 'katachi') return item.shape;
    return item.color + '-' + item.shape;
  }
  function parseId(id) {
    var p = String(id).split('-');
    if (p.length === 2) return { kind: 'both', color: p[0], shape: p[1] };
    if (colorOf(p[0])) return { kind: 'iro', color: p[0] };
    return { kind: 'katachi', shape: p[0] };
  }
  function cardOf(color, shape) { return { color: color, shape: shape, id: color + '-' + shape }; }

  // 問題文（画面と読み上げ）
  function question(item) { return name(item) + ' は どれ？'; }
  // 「あか」「まる」「あかい まる」
  function name(item) {
    if (item.kind === 'iro') return colorOf(item.color).name;
    if (item.kind === 'katachi') return shapeOf(item.shape).name;
    return colorOf(item.color).adj + ' ' + shapeOf(item.shape).name;
  }
  function cardName(card) { return colorOf(card.color).adj + ' ' + shapeOf(card.shape).name; }
  function isAnswer(item, card) {
    if (item.kind === 'iro') return card.color === item.color;
    if (item.kind === 'katachi') return card.shape === item.shape;
    return card.color === item.color && card.shape === item.shape;
  }

  function allIds(level) {
    var cfg = levelConfig(level), out = [];
    if (cfg.kinds.indexOf('iro') >= 0) out = out.concat(ids(COLORS));
    if (cfg.kinds.indexOf('katachi') >= 0) out = out.concat(ids(SHAPES));
    if (cfg.kinds.indexOf('both') >= 0) {
      COLORS.forEach(function (c) { SHAPES.forEach(function (s) { out.push(c.id + '-' + s.id); }); });
    }
    return out;
  }

  function pickItem(opts, rng) {
    opts = opts || {};
    var list = allIds(opts.level).filter(function (id) { return id !== opts.lastId; });
    return parseId(C.adaptive.pickWeighted(list, opts.missCounts || {}, rng || Math.random));
  }

  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(a, rng) { return a[Math.floor(rng() * a.length)]; }

  // 色を n こ。first を先頭に、まぎらわしい組み合わせを入れずに選ぶ
  function pickColors(first, n, rng) {
    var used = first ? [first] : [];
    shuffle(ids(COLORS), rng).forEach(function (c) {
      if (used.length < n && used.indexOf(c) < 0 && okColor(c, used)) used.push(c);
    });
    return used;
  }

  // こたえ item を含むカード（{ color, shape, id } の配列）。カードは重ならない
  function makeChoices(item, level, rng) {
    rng = rng || Math.random;
    var cfg = levelConfig(level);
    var n = cfg.choices, list = [];
    if (item.kind === 'iro') {
      var cs = pickColors(item.color, n, rng);
      var same = pick(ids(SHAPES), rng);
      cs.forEach(function (c) { list.push(cardOf(c, cfg.mix ? pick(ids(SHAPES), rng) : same)); });
    } else if (item.kind === 'katachi') {
      var ss = [item.shape].concat(shuffle(ids(SHAPES).filter(function (s) { return s !== item.shape; }), rng)).slice(0, n);
      var cols = cfg.mix ? pickColors(null, 4, rng) : [pick(ids(COLORS), rng)];
      ss.forEach(function (s) { list.push(cardOf(cfg.mix ? pick(cols, rng) : cols[0], s)); });
    } else {
      // こたえ／同じ色で ちがう形／同じ形で ちがう色／ちがう色で ちがう形
      var others = pickColors(item.color, 3, rng).slice(1);   // こたえの色と まぎらわしくない2色
      var s2 = pick(ids(SHAPES).filter(function (s) { return s !== item.shape; }), rng);
      var c2 = others[0];
      var c3 = others[others.length - 1];
      var s3 = pick(ids(SHAPES).filter(function (s) { return s !== item.shape && s !== s2; }), rng);
      list.push(cardOf(item.color, item.shape), cardOf(item.color, s2), cardOf(c2, item.shape), cardOf(c3, s3));
      list = list.slice(0, n);
    }
    return shuffle(list, rng);
  }

  function progressFromLogs(logs) {
    var res = { level: 1, recent: [], missCounts: {} };
    var mine = (logs || []).filter(function (e) { return e && e.area === AREA; });
    mine.forEach(function (e) {
      if (!e.correct) res.missCounts[e.itemId] = (res.missCounts[e.itemId] || 0) + 1;
    });
    if (mine.length) {
      var lv = Number(mine[mine.length - 1].level) || 1;
      res.level = Math.max(1, Math.min(MAX_LEVEL, lv));
      var run = [];
      for (var i = mine.length - 1; i >= 0 && Number(mine[i].level) === res.level; i--) run.unshift(!!mine[i].correct);
      res.recent = run.slice(-5);
      var nl = C.adaptive.nextLevel(res.recent, res.level, MAX_LEVEL);
      if (nl !== res.level) { res.level = nl; res.recent = []; }
    }
    return res;
  }

  // 色つきの形の SVG（文字列）。濃い ふちどりで、きいろも 白い背景に とけない
  function shapeSvg(card) {
    var fill = colorOf(card.color).hex;
    var a = ' class="ir-fig" fill="' + fill + '"';
    var body;
    if (card.shape === 'maru') body = '<circle' + a + ' cx="50" cy="50" r="40"/>';
    else if (card.shape === 'sankaku') body = '<polygon' + a + ' points="50,9 93,86 7,86"/>';
    else if (card.shape === 'shikaku') body = '<rect' + a + ' x="12" y="12" width="76" height="76" rx="6"/>';
    else {
      var pts = [];
      for (var k = 0; k < 10; k++) {
        var r = k % 2 ? 19 : 46, rad = (k * 36) * Math.PI / 180;
        pts.push((50 + r * Math.sin(rad)).toFixed(1) + ',' + (54 - r * Math.cos(rad)).toFixed(1));
      }
      body = '<polygon' + a + ' points="' + pts.join(' ') + '"/>';
    }
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
  }

  /* ---------- 画面 ---------- */
  var st = null;   // { profileId, level, recent, missCounts, lastId, solved }

  function U() { return C.chiikuUi; }

  function start(profileId) {
    st = { profileId: profileId, level: 1, recent: [], missCounts: {}, lastId: null, solved: 0 };
    return Promise.resolve()
      .then(function () { return C.storage.getLogs(profileId); })
      .then(function (logs) { return logs || []; }, function () { return []; })
      .then(function (logs) {
        var p = progressFromLogs(logs);
        st.level = p.level; st.recent = p.recent; st.missCounts = p.missCounts;
        nextQuestion();
      });
  }

  function nextQuestion() {
    var ui = U();
    var over = false;
    try { over = C.timer.isOver(st.profileId); } catch (e) { over = false; }
    if (over) { ui.showRest(); return; }
    var item = pickItem({ level: st.level, missCounts: st.missCounts, lastId: st.lastId });
    st.lastId = itemId(item);
    showQuestion({ item: item, id: st.lastId, level: st.level, missed: false, done: false, busy: false },
      makeChoices(item, st.level));
  }

  function showQuestion(q, choices) {
    var ui = U();
    var app = ui.newScreen('iro');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    app.classList.toggle('no-voice', !hasVoice);
    app.appendChild(ui.topBar({ home: true }));

    var text = question(q.item);
    var head = ui.el('div', 'q-head ir-head');
    var who = ui.el('div', 'q-chara');
    var ch = ui.chara('normal');
    who.appendChild(ch);
    var talk = ui.el('div', 'q-talk');
    var bub = ui.bubble(text);
    bub.classList.add('q-text');
    talk.appendChild(bub);
    if (hasVoice) {
      var again = ui.button('icon-btn speak-btn', function () { ui.play('tap'); ui.speak(text); });
      again.setAttribute('aria-label', 'もういちど きく');
      again.appendChild(ui.svg(ui.ICO.speaker));
      talk.appendChild(again);
    }
    head.appendChild(who);
    head.appendChild(talk);
    app.appendChild(head);

    var grid = ui.el('div', 'cards ir-cards n' + choices.length);
    choices.forEach(function (cd) {
      var card = ui.button('pick-card ir-card', function () { choose(cd, card); });
      card.setAttribute('aria-label', cardName(cd));
      var fig = ui.el('span', 'ir-shape');
      fig.innerHTML = shapeSvg(cd);
      card.appendChild(fig);
      grid.appendChild(card);
    });
    app.appendChild(grid);

    // 連打しても1回だけ採点する
    function choose(cd, card) {
      if (q.done || q.busy) return;
      if (isAnswer(q.item, cd)) {
        q.done = true;
        ui.play('correct');
        card.classList.add('right');
        grid.classList.add('settled');
        ch.parentNode.replaceChild(ui.chara('happy'), ch);
        bub.textContent = 'せいかい！';
        var burst = ui.el('div', 'burst');
        for (var s = 0; s < 5; s++) burst.appendChild(ui.svg(ui.STAR, 'reward-star s' + s));
        card.appendChild(burst);
        finishQuestion(q);
        ui.speakThen('せいかい！ ' + cardName(cd) + ' だね', WAIT_CORRECT, afterCorrect);   // 言い終わってから次へ
      } else {
        q.busy = true;
        q.missed = true;
        ui.play('oops');
        card.classList.remove('wiggle');
        void card.offsetWidth;
        card.classList.add('wiggle', 'tried');
        bub.textContent = 'おしい！ もういっかい えらんでみよう';
        ui.speak('おしい！ もういっかい、えらんでみよう');
        ui.later(function () { q.busy = false; }, 700);
      }
    }
    ui.speak(text);
  }

  // 1問ぶんの記録（1回で当たったら true）・苦手・レベル
  function finishQuestion(q) {
    var correct = !q.missed;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: q.id, correct: correct, level: q.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[q.id] = (st.missCounts[q.id] || 0) + 1;
    st.recent.push(correct);
    var nl = C.adaptive.nextLevel(st.recent, st.level, MAX_LEVEL);
    if (nl !== st.level) { st.level = nl; st.recent = []; }
    st.solved++;
  }

  function afterCorrect() {
    if (st.solved % ROUND_SIZE === 0) { showReward(); return; }
    nextQuestion();
  }

  function showReward() {
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
      nextQuestion();
    });
    next.setAttribute('aria-label', 'つぎへ');
    next.appendChild(ui.svg(ui.ICO.next));
    next.appendChild(ui.el('span', null, 'つぎへ'));
    info.appendChild(next);
    row.appendChild(info);
    body.appendChild(row);
    app.appendChild(body);
    ui.play('star');
    ui.speak('すごい！ ' + ROUND_SIZE + 'もん できたね');
  }

  C.iro = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, COLORS: COLORS, SHAPES: SHAPES, CONFUSE: CONFUSE,
    levelConfig: levelConfig, itemId: itemId, parseId: parseId, question: question, name: name,
    cardName: cardName, isAnswer: isAnswer, conflicts: conflicts, allIds: allIds, pickItem: pickItem,
    makeChoices: makeChoices, progressFromLogs: progressFromLogs, shapeSvg: shapeSvg, start: start
  };
})();
