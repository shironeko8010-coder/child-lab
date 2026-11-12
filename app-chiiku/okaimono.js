/* おかいものゲーム。Chiid.okaimono
   品物と値段が出る → おさいふの硬貨をタップしてトレーに入れる → 「かう」でぴったりなら ごほうび → つぎ。
   園児が見る文字は、ひらがなと数字だけ。通信は行わない。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'okaimono';
  var MAX_LEVEL = 3;
  var ROUND_SIZE = 5;          // 5問ごとにごほうび画面
  var WAIT_CORRECT = 1800;     // 正解のあと、次へ進むまで（ms）
  var TRAY_MAX = 20;           // トレーに入る硬貨のまい数
  var COINS = [1, 5, 10, 50, 100, 500];
  // pic は Unicode 12（2019年）以前の絵文字だけ。word は「○○は」に使う（ひらがな）
  var ITEMS = [
    { id: 'ame', pic: '🍬', word: 'あめ', min: 10, max: 60 },
    { id: 'cookie', pic: '🍪', word: 'くっきー', min: 30, max: 120 },
    { id: 'ninjin', pic: '🥕', word: 'にんじん', min: 30, max: 80 },
    { id: 'juice', pic: '🧃', word: 'じゅーす', min: 80, max: 160 },
    { id: 'ringo', pic: '🍎', word: 'りんご', min: 80, max: 200 },
    { id: 'onigiri', pic: '🍙', word: 'おにぎり', min: 100, max: 180 },
    { id: 'banana', pic: '🍌', word: 'ばなな', min: 100, max: 250 },
    { id: 'donut', pic: '🍩', word: 'どーなつ', min: 100, max: 200 },
    { id: 'pan', pic: '🍞', word: 'ぱん', min: 100, max: 300 },
    { id: 'ice', pic: '🍦', word: 'あいす', min: 100, max: 350 },
    { id: 'gyunyu', pic: '🥛', word: 'ぎゅうにゅう', min: 150, max: 250 },
    { id: 'tamago', pic: '🥚', word: 'たまご', min: 200, max: 300 },
    { id: 'ichigo', pic: '🍓', word: 'いちご', min: 300, max: 600 },
    { id: 'cake', pic: '🍰', word: 'けーき', min: 300, max: 500 },
    { id: 'bento', pic: '🍱', word: 'おべんとう', min: 400, max: 700 },
    { id: 'suika', pic: '🍉', word: 'すいか', min: 500, max: 999 }
  ];
  // レベルごとの値段の範囲。レベル1は、どのけたも4以下（同じ硬貨を5まい以上数えなくてよいように）
  var RANGE = { 1: [10, 399], 2: [10, 499], 3: [100, 999] };

  function lv(level) { return Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1)); }
  function coinsFor(level) {
    var l = lv(level);
    if (l === 1) return [1, 10, 100];
    if (l === 2) return [1, 5, 10, 50, 100];
    return COINS.slice();
  }
  function pricesFor(item, level) {
    var l = lv(level), r = RANGE[l], out = [];
    var lo = Math.max(r[0], item.min), hi = Math.min(r[1], item.max);
    for (var p = lo; p <= hi; p++) {
      if (l === 1 && /[5-9]/.test(String(p))) continue;
      out.push(p);
    }
    return out;
  }
  function itemsFor(level) { return ITEMS.filter(function (it) { return pricesFor(it, level).length > 0; }); }

  function pickItem(opts, rng) {
    opts = opts || {};
    var list = itemsFor(opts.level);
    var ids = list.map(function (it) { return it.id; });
    if (ids.length > 1 && opts.lastId) ids = ids.filter(function (id) { return id !== opts.lastId; });
    var id = C.adaptive.pickWeighted(ids, opts.missCounts || {}, rng || Math.random);
    return list.filter(function (it) { return it.id === id; })[0] || list[0];
  }
  function makeQuestion(level, opts, rng) {
    rng = rng || Math.random;
    var l = lv(level);
    var item = pickItem({ level: l, missCounts: (opts || {}).missCounts, lastId: (opts || {}).lastId }, rng);
    var ps = pricesFor(item, l);
    return { item: item, price: ps[Math.floor(rng() * ps.length)], level: l };
  }
  // まい数が一番少ない分け方（大きい順）。日本の硬貨は、大きいほうから取れば一番少なくなる
  function splitCoins(amount, level) {
    var cs = coinsFor(level).slice().reverse(), out = [], rest = Math.max(0, Math.floor(amount));
    cs.forEach(function (c) { while (rest >= c) { out.push(c); rest -= c; } });
    return out;
  }
  function judge(price, total) { return total === price ? 'just' : (total < price ? 'short' : 'over'); }
  function speakText(q) { return q.item.word + 'は｜' + q.price + 'えん。｜おかねを いれてね'; }

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

  // 読み上げる文（tools/voice-lines.js も、この文を使って音声ファイルを作る）
  var TEXT = {
    just: 'ぴったり！ かえたね',
    short: 'すこし たりないよ',
    over: 'ちょっと おおいよ',
    hintShort: 'ひかっている おかねを いれてみよう',
    hintOver: 'トレーの おかねを タップすると もどせるよ'
  };
  // 画面に出す文（園児用は ひらがなだけ）。読み上げの文にカタカナがあるときだけ、ここで ひらがなにする
  var SHOWN = { hintOver: 'とれーの おかねを たっぷすると もどせるよ' };
  function shownText(key) { return SHOWN[key] || TEXT[key]; }
  function coinText(n) { return n + 'えん。'; }
  // トレーの硬貨で採点する。空のときは null（まちがいにしない）
  function judgeTray(price, tray) {
    if (!tray || !tray.length) return null;
    return judge(price, tray.reduce(function (a, b) { return a + b; }, 0));
  }

  /* ---------- 画面 ---------- */
  var st = null;   // { profileId, level, recent, missCounts, lastId, solved }

  function U() { return C.chiikuUi; }

  // 硬貨の絵（本物そっくりにはしない。色・穴・数字で見分ける）
  var COIN_LOOK = {
    1: { size: 64, fill: '#eef1f4', edge: '#9aa3ad', ink: '#3d4650', hole: false },
    5: { size: 70, fill: '#f2c75c', edge: '#a67c14', ink: '#5a3f00', hole: true },
    10: { size: 76, fill: '#d98a5f', edge: '#8c4a26', ink: '#4a2008', hole: false },
    50: { size: 80, fill: '#d5dade', edge: '#858e97', ink: '#2f363d', hole: true },
    100: { size: 86, fill: '#d5dade', edge: '#858e97', ink: '#2f363d', hole: false },
    500: { size: 94, fill: '#f2c75c', edge: '#a67c14', ink: '#5a3f00', hole: false }
  };
  function coinSvg(n) {
    var k = COIN_LOOK[n];
    var ty = k.hole ? 80 : 60, fs = n >= 100 ? 30 : 34;
    return '<svg viewBox="0 0 100 100" aria-hidden="true" width="' + k.size + '" height="' + k.size + '">' +
      '<circle cx="50" cy="50" r="46" fill="' + k.fill + '" stroke="' + k.edge + '" stroke-width="5"/>' +
      '<circle cx="50" cy="50" r="37" fill="none" stroke="' + k.edge + '" stroke-width="2" opacity=".5"/>' +
      (k.hole ? '<circle cx="50" cy="44" r="10" fill="#fff" stroke="' + k.edge + '" stroke-width="3"/>' : '') +
      '<text x="50" y="' + ty + '" text-anchor="middle" font-size="' + (k.hole ? 24 : fs) + '" font-weight="bold" fill="' + k.ink + '">' + n + '</text></svg>';
  }
  function coinButton(n, onTap) {
    var ui = U();
    var b = ui.button('ok-coin c' + n, onTap);
    b.setAttribute('aria-label', n + 'えん');
    b.setAttribute('data-coin', String(n));
    b.innerHTML = coinSvg(n);
    return b;
  }

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
    var q = makeQuestion(st.level, { missCounts: st.missCounts, lastId: st.lastId });
    st.lastId = q.item.id;
    q.missed = false; q.done = false; q.busy = false; q.tries = 0; q.hint = null;
    showQuestion(q);
  }

  function showQuestion(q) {
    var ui = U();
    var app = ui.newScreen('okaimono');
    var hasVoice = false;
    try { hasVoice = C.voice.isAvailable(); } catch (e) { hasVoice = false; }
    app.classList.toggle('no-voice', !hasVoice);
    app.appendChild(ui.topBar({ home: true }));

    var say = speakText(q);
    var tray = [];   // トレーの硬貨（入れた順）

    var body = ui.el('div', 'ok-body');
    // 左：品物と値段
    var shop = ui.el('div', 'ok-shop');
    shop.appendChild(ui.el('div', 'ok-pic', q.item.pic));
    shop.appendChild(ui.el('div', 'ok-word', q.item.word));
    var price = ui.el('div', 'ok-price');
    price.appendChild(ui.el('span', 'ok-price-n', String(q.price)));
    price.appendChild(ui.el('span', 'ok-yen', 'えん'));
    shop.appendChild(price);
    if (hasVoice) {
      var again = ui.button('icon-btn speak-btn', function () { ui.play('tap'); ui.speak(say); });
      again.setAttribute('aria-label', 'もういちど きく');
      again.appendChild(ui.svg(ui.ICO.speaker));
      shop.appendChild(again);
    }
    body.appendChild(shop);

    // 右：キャラ・ふきだし・トレー・合計
    var right = ui.el('div', 'ok-right');
    var talk = ui.el('div', 'ok-talk');
    var who = ui.el('div', 'q-chara');
    var ch = ui.chara('normal');
    who.appendChild(ch);
    var bub = ui.bubble('おかねを いれてね');
    bub.classList.add('q-text');
    talk.appendChild(who);
    talk.appendChild(bub);
    right.appendChild(talk);
    var trayBox = ui.el('div', 'ok-tray');
    trayBox.setAttribute('aria-label', 'トレー');
    right.appendChild(trayBox);
    var totalEl = ui.el('div', 'ok-total');
    right.appendChild(totalEl);
    body.appendChild(right);
    app.appendChild(body);

    // 下：おさいふ と かう
    var bottom = ui.el('div', 'ok-bottom');
    var wallet = ui.el('div', 'ok-wallet');
    wallet.setAttribute('aria-label', 'おさいふ');
    coinsFor(q.level).forEach(function (n) {
      wallet.appendChild(coinButton(n, function () { put(n); }));
    });
    bottom.appendChild(wallet);
    var buyBtn = ui.button('btn-big ok-buy', function () { buy(); });
    buyBtn.setAttribute('aria-label', 'かう');
    buyBtn.appendChild(ui.el('span', null, 'かう'));
    bottom.appendChild(buyBtn);
    app.appendChild(bottom);

    function total() { return tray.reduce(function (a, b) { return a + b; }, 0); }
    function render() {
      trayBox.innerHTML = '';
      tray.forEach(function (n, i) {
        trayBox.appendChild(coinButton(n, function () { takeBack(i); }));
      });
      if (!tray.length) trayBox.appendChild(ui.el('span', 'ok-tray-empty', 'ここに おかねを いれてね'));
      totalEl.textContent = '';
      totalEl.appendChild(ui.el('span', 'ok-total-label', 'いま '));
      totalEl.appendChild(ui.el('span', 'ok-total-n', String(total())));
      totalEl.appendChild(ui.el('span', 'ok-total-label', ' えん'));
      showHint();
    }
    // ヒント：足りないときは入れるとよい硬貨、多いときはトレーの硬貨を光らせる
    function showHint() {
      var t = total();
      var need = q.hint === 'short' && t < q.price ? splitCoins(q.price - t, q.level) : [];
      Array.prototype.forEach.call(wallet.children, function (b) {
        b.classList.toggle('ok-hint', need.indexOf(Number(b.getAttribute('data-coin'))) >= 0);
      });
      var back = q.hint === 'over' && t > q.price;
      Array.prototype.forEach.call(trayBox.querySelectorAll('.ok-coin'), function (b) { b.classList.toggle('ok-hint', back); });
    }
    function put(n) {
      if (q.done) return;
      if (tray.length >= TRAY_MAX) { ui.play('tap'); return; }
      tray.push(n);
      ui.play('tap');
      render();
      ui.speak(coinText(n));
    }
    function takeBack(i) {
      if (q.done) return;
      tray.splice(i, 1);
      ui.play('tap');
      render();
    }
    // 連打しても1回だけ採点する
    function buy() {
      if (q.done || q.busy) return;
      var j = judgeTray(q.price, tray);
      if (!j) { ui.play('tap'); return; }   // トレーが空：何もしない
      if (j === 'just') {
        q.done = true;
        q.hint = null;
        showHint();
        ui.play('correct');
        app.classList.add('settled');
        ch.parentNode.replaceChild(ui.chara('happy'), ch);
        bub.textContent = TEXT.just;
        var burst = ui.el('div', 'burst');
        for (var s = 0; s < 5; s++) burst.appendChild(ui.svg(ui.STAR, 'reward-star s' + s));
        buyBtn.appendChild(burst);
        finishQuestion(q);
        ui.speakThen(TEXT.just, WAIT_CORRECT, afterCorrect);
        return;
      }
      q.busy = true;
      q.missed = true;
      q.tries++;
      ui.play('oops');
      buyBtn.classList.remove('wiggle');
      void buyBtn.offsetWidth;
      buyBtn.classList.add('wiggle');
      var msg = TEXT[j];
      if (q.tries >= 2) {
        q.hint = j;
        showHint();
        var hk = j === 'short' ? 'hintShort' : 'hintOver';
        bub.textContent = shownText(j) + '。 ' + shownText(hk);
        ui.speak(msg + '｜' + TEXT[hk]);
      } else {
        bub.textContent = shownText(j);
        ui.speak(msg);
      }
      ui.later(function () { q.busy = false; }, 700);
    }

    render();
    ui.speak(say);
  }

  // 1問ぶんの記録（1回目の「かう」でぴったりなら true）・苦手・レベル
  function finishQuestion(q) {
    var correct = !q.missed;
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: q.item.id, correct: correct, level: q.level });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    if (!correct) st.missCounts[q.item.id] = (st.missCounts[q.item.id] || 0) + 1;
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

  C.okaimono = {
    AREA: AREA, MAX_LEVEL: MAX_LEVEL, ROUND_SIZE: ROUND_SIZE, TRAY_MAX: TRAY_MAX, COINS: COINS, ITEMS: ITEMS, TEXT: TEXT, shownText: shownText, coinText: coinText, judgeTray: judgeTray,
    coinsFor: coinsFor, pricesFor: pricesFor, itemsFor: itemsFor, pickItem: pickItem, makeQuestion: makeQuestion,
    splitCoins: splitCoins, judge: judge, speakText: speakText, progressFromLogs: progressFromLogs, start: start
  };
})();
