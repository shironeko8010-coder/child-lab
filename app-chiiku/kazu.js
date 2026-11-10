/* かずゲーム「いくつ かな？」。Chiid.kazu
   絵（りんご等）が1〜10こ出る → 数字のカードから、こたえを えらぶ → ごほうび → つぎ。
   園児が見る文字は、ひらがなと数字だけ。通信は行わない。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'kazu';
  var MAX_LEVEL = 3;
  var ROUND_SIZE = 5;          // 5問ごとにごほうび画面
  var WAIT_CORRECT = 1500;     // 正解のあと、次へ進むまで（ms）
  // 「○こ」の読み（数字のまま読ませると、10 を「テン」と読む端末があるため、かなで持つ）
  var KO_YOMI = ['', 'いっこ', 'にこ', 'さんこ', 'よんこ', 'ごこ', 'ろっこ', 'ななこ', 'はっこ', 'きゅうこ', 'じゅっこ'];
  // pic は Unicode 12（2019年）以前の絵文字だけ。word は「○○は いくつ かな？」に使う
  var PICS = [
    { pic: '🍎', word: 'りんご' }, { pic: '🐟', word: 'さかな' }, { pic: '⭐', word: 'ほし' },
    { pic: '🍓', word: 'いちご' }, { pic: '🐥', word: 'ひよこ' }, { pic: '🎈', word: 'ふうせん' },
    { pic: '🍪', word: 'くっきー' }
  ];

  // レベル1: 1〜3（3たく）／2: 1〜5（3たく）／3: 1〜10（4たく）
  function levelConfig(level) {
    if (level <= 1) return { max: 3, choices: 3 };
    if (level === 2) return { max: 5, choices: 3 };
    return { max: 10, choices: 4 };
  }

  function pickNumber(opts, rng) {
    opts = opts || {};
    var max = levelConfig(opts.level).max;
    var ids = [];
    for (var n = 1; n <= max; n++) if (n !== opts.lastN) ids.push(String(n));
    var id = C.adaptive.pickWeighted(ids, opts.missCounts || {}, rng || Math.random);
    return Number(id);
  }

  // こたえ n を含む選択肢（数字の配列）。ほかは 1〜max から、重ならないように選ぶ
  function makeChoices(n, level, rng) {
    rng = rng || Math.random;
    var cfg = levelConfig(level);
    var others = [];
    for (var k = 1; k <= cfg.max; k++) if (k !== n) others.push(k);
    for (var i = others.length - 1; i > 0; i--) {   // 混ぜる
      var j = Math.floor(rng() * (i + 1));
      var t = others[i]; others[i] = others[j]; others[j] = t;
    }
    var list = [n].concat(others.slice(0, cfg.choices - 1));
    for (var a = list.length - 1; a > 0; a--) {
      var b = Math.floor(rng() * (a + 1));
      var u = list[a]; list[a] = list[b]; list[b] = u;
    }
    return list;
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

  /* ---------- 画面 ---------- */
  var st = null;   // { profileId, level, recent, missCounts, lastN, solved, picIdx }

  function U() { return C.chiikuUi; }

  function start(profileId) {
    st = { profileId: profileId, level: 1, recent: [], missCounts: {}, lastN: null, solved: 0, picIdx: -1 };
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
    var n = pickNumber({ level: st.level, missCounts: st.missCounts, lastN: st.lastN });
    st.lastN = n;
    st.picIdx = (st.picIdx + 1 + Math.floor(Math.random() * (PICS.length - 1))) % PICS.length;   // 前と違う絵
    showQuestion({ n: n, level: st.level, pic: PICS[st.picIdx], missed: false, done: false, busy: false },
      makeChoices(n, st.level));
  }

  function showQuestion(q, choices) {
    var ui = U();
    var app = ui.newScreen('kazu');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    app.classList.toggle('no-voice', !hasVoice);
    app.appendChild(ui.topBar({ home: true }));

    var text = q.pic.word + 'は いくつ かな？';
    var head = ui.el('div', 'q-head kz-head');
    var who = ui.el('div', 'q-chara');
    var ch = ui.chara('normal');
    who.appendChild(ch);
    var field = ui.el('div', 'kz-field' + (q.n > 5 ? ' two-rows' : ''));
    field.setAttribute('aria-label', q.pic.word + 'の かず');
    for (var i = 0; i < q.n; i++) field.appendChild(ui.el('span', 'kz-pic', q.pic.pic));
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
    head.appendChild(field);
    head.appendChild(talk);
    app.appendChild(head);

    var grid = ui.el('div', 'cards kz-cards n' + choices.length);
    choices.forEach(function (num) {
      var card = ui.button('pick-card num-card', function () { choose(num, card); });
      card.setAttribute('aria-label', String(num));
      card.appendChild(ui.el('span', 'nc-num', String(num)));
      grid.appendChild(card);
    });
    app.appendChild(grid);

    // 連打しても1回だけ採点する
    function choose(num, card) {
      if (q.done || q.busy) return;
      if (num === q.n) {
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
        ui.speakThen('せいかい！ ' + KO_YOMI[q.n] + ' だね', WAIT_CORRECT, afterCorrect);   // 言い終わってから次へ
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
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: String(q.n), correct: correct, level: q.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[String(q.n)] = (st.missCounts[String(q.n)] || 0) + 1;
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

  C.kazu = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, PICS: PICS,
    levelConfig: levelConfig, pickNumber: pickNumber, makeChoices: makeChoices,
    KO_YOMI: KO_YOMI,
    progressFromLogs: progressFromLogs, start: start
  };
})();
