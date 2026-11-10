/* とけいゲーム「なんじ かな？」。Chiid.tokei
   アナログ時計（SVG）を見る → 「3じ」「3じはん」などのカードから えらぶ → ごほうび → つぎ。
   園児が見る文字は、ひらがなと数字だけ。通信は行わない。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。
   時刻は { h: 1〜12, m: 0 か 30 }、記録の itemId は '3:00' '3:30' の形。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'tokei';
  var MAX_LEVEL = 3;
  var ROUND_SIZE = 5;          // 5問ごとにごほうび画面
  var WAIT_CORRECT = 1500;     // 正解のあと、次へ進むまで（ms）
  // 読み上げ用（「4じ」を「よじ」、「9じ」を「くじ」と読ませる）
  var HOUR_YOMI = ['', 'いち', 'に', 'さん', 'よ', 'ご', 'ろく', 'しち', 'はち', 'く', 'じゅう', 'じゅういち', 'じゅうに'];

  // レベル1: ちょうど（3たく）／2: ちょうど と はん（3たく）／3: ちょうど と はん（4たく、まぎらわしい選択肢）
  // 5分きざみを足すときは、ここに minutes: [0,5,10,...] のレベルを足す
  function levelConfig(level) {
    if (level <= 1) return { minutes: [0], choices: 3 };
    if (level === 2) return { minutes: [0, 30], choices: 3 };
    return { minutes: [0, 30], choices: 4 };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toId(t) { return t.h + ':' + pad2(t.m); }
  function parseId(id) {
    var p = String(id).split(':');
    return { h: Number(p[0]), m: Number(p[1]) };
  }
  function label(t) { return t.h + 'じ' + (t.m === 30 ? 'はん' : ''); }
  function yomi(t) { return HOUR_YOMI[t.h] + 'じ' + (t.m === 30 ? 'はん' : ''); }
  // 12時の向きを0度とし、時計回りの角度
  function handAngles(t) {
    return { hour: (t.h % 12) * 30 + t.m * 0.5, minute: t.m * 6 };
  }
  function hourAdd(h, d) { return ((h - 1 + d) % 12 + 12) % 12 + 1; }

  function allIds(level) {
    var mins = levelConfig(level).minutes, ids = [];
    for (var h = 1; h <= 12; h++) mins.forEach(function (m) { ids.push(toId({ h: h, m: m })); });
    return ids;
  }

  function pickTime(opts, rng) {
    opts = opts || {};
    var ids = allIds(opts.level).filter(function (id) { return id !== opts.lastId; });
    return parseId(C.adaptive.pickWeighted(ids, opts.missCounts || {}, rng || Math.random));
  }

  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // こたえ t を含む選択肢（id の配列）。まぎらわしいものを先に入れ、残りはレベルの時刻から重ならないように選ぶ
  function makeChoices(t, level, rng) {
    rng = rng || Math.random;
    var cfg = levelConfig(level);
    var ans = toId(t);
    var pool = allIds(level);
    var prefer = [];
    if (level >= 2) prefer.push(toId({ h: t.h, m: t.m === 30 ? 0 : 30 }));   // 同じ「じ」の ちょうど／はん
    if (level >= 3 && t.m === 30) {   // はんの とき、みじかい はりの となり
      prefer.unshift(toId({ h: hourAdd(t.h, -1), m: 30 }), toId({ h: hourAdd(t.h, 1), m: 30 }));
    } else if (level >= 3) {
      prefer.push(toId({ h: hourAdd(t.h, -1), m: 30 }));
    }
    var list = [ans];
    prefer.forEach(function (id) {
      if (list.length < cfg.choices && list.indexOf(id) < 0 && pool.indexOf(id) >= 0) list.push(id);
    });
    shuffle(pool.filter(function (id) { return list.indexOf(id) < 0; }), rng).forEach(function (id) {
      if (list.length < cfg.choices) list.push(id);
    });
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

  // アナログ時計の SVG（文字列）。みじかい はり＝太い赤、ながい はり＝細い青
  function clockSvg(t) {
    var a = handAngles(t);
    function pt(deg, r) {
      var rad = deg * Math.PI / 180;
      return { x: (100 + r * Math.sin(rad)).toFixed(1), y: (100 - r * Math.cos(rad)).toFixed(1) };
    }
    var s = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    s += '<circle class="tk-face" cx="100" cy="100" r="94"/>';
    for (var k = 0; k < 60; k++) {
      var big = k % 5 === 0, p1 = pt(k * 6, 90), p2 = pt(k * 6, big ? 82 : 86);
      s += '<line class="' + (big ? 'tk-tick5' : 'tk-tick') + '" x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '"/>';
    }
    for (var n = 1; n <= 12; n++) {
      var q = pt(n * 30, 70);
      s += '<text class="tk-num" x="' + q.x + '" y="' + q.y + '" text-anchor="middle" dominant-baseline="central">' + n + '</text>';
    }
    var hm = pt(a.minute, 53), hh = pt(a.hour, 37);   // 数字（半径70）に かからない ながさ
    s += '<line class="tk-min" x1="100" y1="100" x2="' + hm.x + '" y2="' + hm.y + '"/>';
    s += '<line class="tk-hour" x1="100" y1="100" x2="' + hh.x + '" y2="' + hh.y + '"/>';
    s += '<circle class="tk-pin" cx="100" cy="100" r="7"/>';
    return s + '</svg>';
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
    var t = pickTime({ level: st.level, missCounts: st.missCounts, lastId: st.lastId });
    st.lastId = toId(t);
    showQuestion({ t: t, id: st.lastId, level: st.level, missed: false, done: false, busy: false },
      makeChoices(t, st.level));
  }

  function showQuestion(q, choices) {
    var ui = U();
    var app = ui.newScreen('tokei');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    app.classList.toggle('no-voice', !hasVoice);
    app.appendChild(ui.topBar({ home: true }));

    var text = 'なんじ かな？';
    var wrap = ui.el('div', 'tk-wrap');
    var clock = ui.el('div', 'tk-clock');
    clock.setAttribute('role', 'img');
    clock.setAttribute('aria-label', 'とけい');
    clock.innerHTML = clockSvg(q.t);

    var side = ui.el('div', 'tk-side');
    var head = ui.el('div', 'q-head tk-head');
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
    side.appendChild(head);

    var grid = ui.el('div', 'cards tk-cards n' + choices.length);
    choices.forEach(function (id) {
      var tt = parseId(id);
      var card = ui.button('pick-card tk-card', function () { choose(id, card); });
      card.setAttribute('aria-label', label(tt));
      var lab = ui.el('span', 'tk-label');
      lab.appendChild(ui.el('b', null, String(tt.h)));
      lab.appendChild(ui.el('span', null, tt.m === 30 ? 'じはん' : 'じ'));
      card.appendChild(lab);
      grid.appendChild(card);
    });
    side.appendChild(grid);
    wrap.appendChild(clock);
    wrap.appendChild(side);
    app.appendChild(wrap);

    // 連打しても1回だけ採点する
    function choose(id, card) {
      if (q.done || q.busy) return;
      if (id === q.id) {
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
        ui.speakThen('せいかい！ ' + yomi(q.t) + ' だね', WAIT_CORRECT, afterCorrect);   // 言い終わってから次へ
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

  C.tokei = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE,
    levelConfig: levelConfig, toId: toId, parseId: parseId, label: label, yomi: yomi,
    handAngles: handAngles, allIds: allIds, pickTime: pickTime, makeChoices: makeChoices,
    progressFromLogs: progressFromLogs, clockSvg: clockSvg, start: start
  };
})();
