/* ぬりえ。Chiid.nurie
   線の絵を えらんで、「ぬる」（タッチした所を 色で うめる）・「ふで」（指で 描く）・「スタンプ」（飾りつけ）・「けす」で 仕上げる。
   2本指で 拡大・移動できる。正解・不正解は ない。「できた！」で 作品を 端末の中に 保存し、「さくひん」で 見返す・消す（新しい 20まいまで）。
   園児が見る文字は、ひらがなと数字だけ。通信は行わない。設計書：docs/superpowers/specs/2026-11-27-chiiku-nurie-design.md
   線の絵と スタンプは nurie-data.js（Chiid.nurieData）に 文字で 埋めこんである（index.html を 直接 開いても 点を 調べられるように）。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'nurie';
  var SIZE = 512;          // 絵の 大きさ（点の数）
  // 紙は 絵の まわりに PAD ずつ 余白を もつ（CANVAS×CANVAS）。たて向きは 上下、横向きは 左右の 余白が 見える（スタンプを 押す 場所）
  var PAD = 64;
  var CANVAS = SIZE + PAD * 2;
  var MAX_WORKS = 20;
  var MAX_UNDO = 12;
  var BRUSH = 14;          // ふでの 太さ
  // スタンプの 大きさ（点の数）。はじめは ふつう
  var STAMP_SIZES = [{ id: 's', name: 'ちいさい', px: 64 }, { id: 'm', name: 'ふつう', px: 104 }, { id: 'l', name: 'おおきい', px: 168 }];
  var STAMP_HIT = 0.45;    // スタンプの 当たり（大きさの 何わり の 半径）
  var EDGE = 2;            // 「ぬる」で 線の下まで ぬる はば（白い すき間を のこさない）
  var PER_PAGE = 8;
  var LINE_LEVEL = 200;    // これより こい点は 線
  var MAX_ZOOM = 4;
  var TAP_MOVE = 12;       // これより 動いたら タッチでは ない（2本指の 操作と まちがえない）
  var HOLD_MS = 1000;      // 「けす」の 長押しで ぜんぶ けす までの 時間

  // さいしょの 16まいは かんたんな 絵、あとの 16まいは こまかく ぬれる 絵
  var PICS = [
    { id: 'inu', name: 'いぬ' }, { id: 'neko', name: 'ねこ' }, { id: 'usagi', name: 'うさぎ' }, { id: 'zou', name: 'ぞう' },
    { id: 'sakana', name: 'さかな' }, { id: 'kuruma', name: 'くるま' }, { id: 'kisha', name: 'きしゃ' }, { id: 'hikouki', name: 'ひこうき' },
    { id: 'keeki', name: 'けーき' }, { id: 'aisu', name: 'あいす' }, { id: 'ringo', name: 'りんご' }, { id: 'ichigo', name: 'いちご' },
    { id: 'ie', name: 'おうち' }, { id: 'yukidaruma', name: 'ゆきだるま' }, { id: 'hana', name: 'おはな' }, { id: 'roketto', name: 'ろけっと' },
    { id: 'oshiro', name: 'おしろ' }, { id: 'kyouryuu', name: 'きょうりゅう' }, { id: 'fukurou', name: 'ふくろう' }, { id: 'kujira', name: 'くじら' },
    { id: 'chouchou', name: 'ちょうちょ' }, { id: 'kame', name: 'かめ' }, { id: 'robotto', name: 'ろぼっと' }, { id: 'shoubousha', name: 'しょうぼうしゃ' },
    { id: 'kanransha', name: 'かんらんしゃ' }, { id: 'hokakebune', name: 'ふね' }, { id: 'pengin', name: 'ぺんぎん' }, { id: 'panda', name: 'ぱんだ' },
    { id: 'raion', name: 'らいおん' }, { id: 'yunikoon', name: 'ゆにこーん' }, { id: 'hanakago', name: 'はなかご' }, { id: 'okashi', name: 'おかしのいえ' }
  ];
  var STAMPS = [
    { id: 'hoshi', name: 'ほし' }, { id: 'heart', name: 'はーと' }, { id: 'hana', name: 'おはな' }, { id: 'onpu', name: 'おんぷ' },
    { id: 'ribon', name: 'りぼん' }, { id: 'niji', name: 'にじ' }, { id: 'kira', name: 'きらきら' }, { id: 'kumo', name: 'くも' },
    { id: 'taiyou', name: 'おひさま' }, { id: 'chou', name: 'ちょうちょ' }, { id: 'tentou', name: 'てんとうむし' }, { id: 'ichigo', name: 'いちご' },
    { id: 'daiya', name: 'だいや' }, { id: 'tsuki', name: 'つき' }, { id: 'yuki', name: 'ゆきのけっしょう' }, { id: 'fuusen', name: 'ふうせん' },
    { id: 'kuroobaa', name: 'くろーばー' }, { id: 'kyandi', name: 'きゃんでぃ' }, { id: 'tsurii', name: 'くりすますつりー' }, { id: 'purezento', name: 'ぷれぜんと' }
  ];
  // 20色。まどに 5れつ×4だんで ならぶ じゅん
  var COLORS = [
    { name: 'あか', hex: '#e2483d' }, { name: 'ももいろ', hex: '#f48fb1' }, { name: 'さくらいろ', hex: '#f9c9d6' }, { name: 'だいだい', hex: '#f28c28' }, { name: 'うすだいだい', hex: '#f8d2a9' },
    { name: 'きいろ', hex: '#f9d531' }, { name: 'れもんいろ', hex: '#fff27a' }, { name: 'きみどり', hex: '#a5d65a' }, { name: 'みどり', hex: '#3aa05a' }, { name: 'ふかみどり', hex: '#1f6b3a' },
    { name: 'そらいろ', hex: '#a9dcf7' }, { name: 'みずいろ', hex: '#7ccdf0' }, { name: 'あお', hex: '#2f6fd6' }, { name: 'こんいろ', hex: '#23376e' }, { name: 'むらさき', hex: '#8e5bd0' },
    { name: 'ちゃいろ', hex: '#9a6a42' }, { name: 'おうどいろ', hex: '#c99a3b' }, { name: 'はいいろ', hex: '#9e9e9e' }, { name: 'くろ', hex: '#3a3a3a' }, { name: 'しろ', hex: '#ffffff' }
  ];
  var TOOLS = [{ id: 'fill', name: 'ぬる' }, { id: 'brush', name: 'ふで' }, { id: 'stamp', name: 'すたんぷ' }, { id: 'erase', name: 'けす' }];
  var TEXT = {
    choose: 'どれを ぬる？', start: 'すきな いろで ぬってね', done: 'すてきな えが できたね！',
    works: 'さくひん', empty: 'まだ ないよ。ぬりえを してみよう', color: 'いろ', size: 'おおきさ',
    cleared: 'ぜんぶ けしたよ', askDelete: 'けしても いい？', zoomReset: 'もとに もどす', askDone: 'これで できあがり？'
  };

  /* ---------- 計算（画面に さわらない） ---------- */
  // 線の 点は 1、ぬれる すき間は 0
  function makeMask(img) {
    var d = img.data, n = img.width * img.height, m = new Uint8Array(n);
    for (var i = 0; i < n; i++) m[i] = d[i * 4] < LINE_LEVEL ? 1 : 0;
    return m;
  }
  // (x, y) から 線で かこまれた ところ（1 の 点）。線の上なら 近い すき間から。edge：線の下まで ぬる はば
  function fillRegion(mask, w, h, x, y, edge) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    var start = y * w + x;
    if (mask[start]) {
      start = -1;
      for (var r = 1; r <= 12 && start < 0; r++) {
        for (var dy = -r; dy <= r && start < 0; dy++) for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if (!mask[yy * w + xx]) { start = yy * w + xx; break; }
        }
      }
      if (start < 0) return null;
    }
    var region = new Uint8Array(w * h), stack = [start], list = [];
    region[start] = 1;
    while (stack.length) {
      var p = stack.pop(), px = p % w;
      list.push(p);
      if (px > 0 && !region[p - 1] && !mask[p - 1]) { region[p - 1] = 1; stack.push(p - 1); }
      if (px < w - 1 && !region[p + 1] && !mask[p + 1]) { region[p + 1] = 1; stack.push(p + 1); }
      if (p >= w && !region[p - w] && !mask[p - w]) { region[p - w] = 1; stack.push(p - w); }
      if (p + w < w * h && !region[p + w] && !mask[p + w]) { region[p + w] = 1; stack.push(p + w); }
    }
    // 線の下へ edge 点ぶん ひろげる（線の むこうがわへは 行かない）
    var front = list;
    for (var k = 0; k < (edge || 0); k++) {
      var nextFront = [];
      for (var j = 0; j < front.length; j++) {
        var q = front[j], qx = q % w;
        var nb = [qx > 0 ? q - 1 : -1, qx < w - 1 ? q + 1 : -1, q - w, q + w];
        for (var t = 0; t < 4; t++) {
          var v = nb[t];
          if (v < 0 || v >= w * h || region[v] || !mask[v]) continue;
          region[v] = 1; nextFront.push(v);
        }
      }
      front = nextFront;
    }
    return region;
  }
  function hexRgb(hex) { var v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function paintRegion(rgba, region, hex) {
    var c = hexRgb(hex);
    for (var i = 0; i < region.length; i++) {
      if (!region[i]) continue;
      rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255;
    }
  }
  function loadImage(src) {
    return new Promise(function (ok, ng) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = ng; im.src = src; });
  }
  function pageCount() { return Math.ceil(PICS.length / PER_PAGE); }
  // 矢印で ページを かえる。さいごの つぎは さいしょ、さいしょの まえは さいご
  function turnPage(page, d, pages) { return (((page + d) % pages) + pages) % pages; }
  // (x, y) に ある スタンプの 番号（かさなって いたら 上＝あとから 押した もの）。なければ -1
  function hitStamp(list, x, y) {
    for (var i = list.length - 1; i >= 0; i--) {
      var s = list[i];
      if (Math.hypot(x - s.x, y - s.y) <= s.px * STAMP_HIT) return i;
    }
    return -1;
  }
  // 拡大の ようす { scale, x, y }（x・y は 画面の 点で ずらす量）。1〜4ばい、紙の そとが 見えない ように おさえる。
  // w・h：見える 大きさ。len：紙（正方形）の 大きさ。紙は まん中に 置き、はみ出す ぶん（余白）は かくれる
  function clampView(v, w, h, len) {
    var s = Math.max(1, Math.min(MAX_ZOOM, v.scale || 1));
    if (s === 1) return { scale: 1, x: 0, y: 0 };
    function axis(val, view) { var base = (view - len) / 2; return Math.max(view - len * s - base, Math.min(-base, val)); }
    return { scale: s, x: axis(v.x, w), y: axis(v.y, h) };
  }
  // 拡大して いない ときに 見えている 紙の 範囲（紙 CANVAS の 中の 位置と 大きさ）。作品は ここだけを 保存する
  function visibleRect(w, h, len) {
    function axis(view) {
      var size = Math.min(CANVAS, Math.round(view / len * CANVAS));
      return { at: Math.round((CANVAS - size) / 2), size: size };
    }
    var ax = axis(w), ay = axis(h);
    return { x: ax.at, y: ay.at, w: ax.size, h: ay.size };
  }
  function dateText(ts) { var d = new Date(ts); return (d.getMonth() + 1) + 'がつ' + d.getDate() + 'にち'; }

  /* ---------- 作品（端末の中だけ） ---------- */
  function worksKey(pid) { return 'chiid-nurie-' + pid; }
  function loadWorks(pid) {
    try { var a = JSON.parse(localStorage.getItem(worksKey(pid)) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function storeWorks(pid, list) {
    while (true) {
      try { localStorage.setItem(worksKey(pid), JSON.stringify(list)); return true; } catch (e) { if (!list.length) return false; list.pop(); }
    }
  }
  // 新しい作品を 先頭に。20まいを こえたら 古いものから 消す。いっぱいで 保存できないときも 古いものを 消して やりなおす
  function saveWork(pid, work) { return storeWorks(pid, [work].concat(loadWorks(pid)).slice(0, MAX_WORKS)); }
  // 作品を 1まい 消す（at：作った 時刻で 見分ける）
  function deleteWork(pid, at) { return storeWorks(pid, loadWorks(pid).filter(function (w) { return !w || w.at !== at; })); }

  /* ==================== 画面 ==================== */
  var st = null;
  function U() { return C.chiikuUi; }
  function hasApp() { return !!document.getElementById('app'); }
  function speak(t) { try { if (hasApp()) U().speak(t); } catch (e) {} }
  function play(n) { try { if (hasApp()) U().play(n); } catch (e) {} }
  function isOver() { try { return C.timer.isOver(st.profileId); } catch (e) { return false; } }
  function picName(id) { for (var i = 0; i < PICS.length; i++) if (PICS[i].id === id) return PICS[i].name; return ''; }
  function stampById(id) { for (var i = 0; i < STAMPS.length; i++) if (STAMPS[i].id === id) return STAMPS[i]; return null; }

  function start(profileId) {
    st = { profileId: profileId, phase: 'select', page: 0, pic: null };
    showSelect();
    return Promise.resolve();
  }

  // えらぶ 画面
  function showSelect() {
    st.phase = 'select';
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('nurie-select');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'nu-sel-body');
    var head = ui.el('div', 'nu-sel-head');
    head.appendChild(ui.el('p', 'nu-sel-title', TEXT.choose));
    var wb = ui.button('btn-big secondary nu-works-btn', function () { ui.play('tap'); showWorks(); });
    wb.setAttribute('aria-label', TEXT.works);
    wb.appendChild(ui.el('span', null, TEXT.works));
    head.appendChild(wb);
    body.appendChild(head);
    var row = ui.el('div', 'nu-sel-row');
    var prev = ui.button('icon-btn nu-prev', function () { turn(-1); });
    prev.setAttribute('aria-label', 'まえ');
    prev.appendChild(ui.svg(ui.ICO.next));
    var gridEl = ui.el('div', 'nu-grid');
    var next = ui.button('icon-btn nu-next', function () { turn(1); });
    next.setAttribute('aria-label', 'つぎ');
    next.appendChild(ui.svg(ui.ICO.next));
    row.appendChild(prev); row.appendChild(gridEl); row.appendChild(next);
    body.appendChild(row);
    var dots = ui.el('div', 'nu-dots');
    body.appendChild(dots);
    app.appendChild(body);
    var pages = pageCount();
    function draw() {
      gridEl.innerHTML = '';
      PICS.slice(st.page * PER_PAGE, (st.page + 1) * PER_PAGE).forEach(function (p) {
        var b = ui.button('nu-pic', function () { ui.play('tap'); pick(p.id); });
        b.setAttribute('aria-label', p.name);
        var im = document.createElement('img');
        im.src = C.nurieData.pics[p.id]; im.alt = ''; im.draggable = false;
        b.appendChild(im);
        gridEl.appendChild(b);
      });
      dots.innerHTML = '';
      for (var i = 0; i < pages; i++) dots.appendChild(ui.el('span', 'nu-dot' + (i === st.page ? ' on' : '')));
    }
    function turn(d) { ui.play('tap'); st.page = turnPage(st.page, d, pages); draw(); }
    draw();
    ui.speak(TEXT.choose);
  }

  function pick(id) {
    if (!st || st.phase !== 'select') return;
    st.pic = id; st.phase = 'paint'; st.tool = 'fill'; st.color = COLORS[0].hex; st.stamp = STAMPS[0].id; st.stampSize = 'm';
    st.undo = []; st.mask = null; st.stamps = []; st.view = { scale: 1, x: 0, y: 0 }; st.confirming = false;
    renderPaint();
    speak(TEXT.start);
  }

  // ぬる 画面
  function renderPaint() {
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('nurie');
    var sid = ui.screenId ? ui.screenId() : null;
    var body = ui.el('div', 'nu-body');
    var stage = ui.el('div', 'nu-stage');
    var zoomer = ui.el('div', 'nu-zoomer');   // 拡大は この中を 大きくする
    var paint = document.createElement('canvas'), stamp = document.createElement('canvas');
    paint.width = paint.height = stamp.width = stamp.height = CANVAS;
    paint.className = 'nu-layer nu-paint'; stamp.className = 'nu-layer nu-stampl';
    var line = document.createElement('img');
    line.className = 'nu-layer nu-line'; line.alt = ''; line.draggable = false;
    line.src = C.nurieData.pics[st.pic];
    zoomer.appendChild(paint); zoomer.appendChild(line); zoomer.appendChild(stamp);
    stage.appendChild(zoomer);
    var zoomReset = ui.button('nu-zoom-reset', function () { ui.play('tap'); setView({ scale: 1, x: 0, y: 0 }); });
    zoomReset.setAttribute('aria-label', TEXT.zoomReset);
    zoomReset.appendChild(ui.el('span', 'nu-zoom-ico'));
    zoomReset.appendChild(ui.el('span', null, TEXT.zoomReset));
    stage.appendChild(zoomReset);
    var pg = paint.getContext('2d'), sg = stamp.getContext('2d');
    pg.fillStyle = '#ffffff'; pg.fillRect(0, 0, CANVAS, CANVAS);
    body.appendChild(stage);

    // おうち・おんがく（ぬりえの ボタンとは 離して 置く）
    var bar = ui.topBar({ home: true });
    bar.classList.add('nu-bar');
    // 右の列（横向き）：上に おうち・おんがく、下に 道具。たて向きでは この まとまりを ほどいて 上と 下に 分ける
    var right = ui.el('div', 'nu-right');
    right.appendChild(bar);
    body.appendChild(right);
    // 道具：ぬる・ふで／いろ・すたんぷ（押すと えらぶ まどが 開く）／けす（長押しで ぜんぶ）・もどす／できた（少し 離す）
    var side = ui.el('div', 'nu-side');
    function toolBtn(cls, label, fn) {
      var b = ui.button('nu-tool ' + cls, fn);
      b.setAttribute('aria-label', label);
      b.appendChild(ui.el('span', 'nu-tool-ico'));
      b.appendChild(ui.el('span', 'nu-tool-name', label));
      side.appendChild(b);
      return b;
    }
    var fillB = toolBtn('t-fill', 'ぬる', function () { ui.play('tap'); setTool('fill'); ui.speak('ぬる'); paintSide(); });
    var brushB = toolBtn('t-brush', 'ふで', function () { ui.play('tap'); setTool('brush'); ui.speak('ふで'); paintSide(); });
    var colorB = toolBtn('t-color', TEXT.color, function () { ui.play('tap'); ui.speak(TEXT.color); openPop('color'); });
    var stampB = toolBtn('t-stamp', 'すたんぷ', function () { ui.play('tap'); ui.speak('すたんぷ'); openPop('stamp'); });
    // けす：タッチで えらぶ、長押し（1びょう）で ぜんぶ けす
    var eraseB = toolBtn('t-erase', 'けす', function () {});
    eraseB.classList.add('hold');
    var holdTimer = null, held = false;
    function holdCancel() { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } eraseB.classList.remove('holding'); }
    eraseB.addEventListener('pointerdown', function () {
      held = false; holdCancel();
      eraseB.classList.add('holding');
      holdTimer = setTimeout(function () {
        holdTimer = null; held = true; eraseB.classList.remove('holding');
        if (!st || st.phase !== 'paint') return;
        clearAll(); ui.play('tap'); ui.speak(TEXT.cleared);
      }, HOLD_MS);
    });
    eraseB.addEventListener('pointerup', function () {
      var wasHolding = !!holdTimer;
      holdCancel();
      if (wasHolding && !held) { ui.play('tap'); setTool('erase'); ui.speak('けす'); paintSide(); }
    });
    eraseB.addEventListener('pointerleave', holdCancel);
    eraseB.addEventListener('pointercancel', holdCancel);
    var undoB = ui.button('nu-act a-undo', function () { ui.play('tap'); undo(); });
    undoB.setAttribute('aria-label', 'ひとつ もどす'); undoB.appendChild(ui.el('span', null, 'もどす'));
    side.appendChild(undoB);
    var doneB = ui.button('nu-act a-done', function () { ui.play('tap'); askDone(); });
    doneB.setAttribute('aria-label', 'できた'); doneB.appendChild(ui.el('span', null, 'できた！'));
    side.appendChild(doneB);
    right.appendChild(side);
    app.appendChild(body);

    // えらぶ まど（色・スタンプ）。まわりを さわると とじる
    var pop = ui.el('div', 'nu-pop');
    var panel = ui.el('div', 'nu-pop-panel');
    pop.appendChild(panel);
    pop.addEventListener('click', function (ev) { if (ev.target === pop) closePop(); });
    app.appendChild(pop);
    function closePop() { pop.classList.remove('show'); panel.innerHTML = ''; }
    function openPop(kind) {
      panel.innerHTML = '';
      panel.className = 'nu-pop-panel ' + kind;
      if (kind === 'color') {
        COLORS.forEach(function (c) {
          var b = ui.button('nu-sw col' + (c.hex === st.color ? ' on' : '') + (c.hex === '#ffffff' ? ' white' : ''), function () {
            ui.play('tap'); chooseColor(c.hex); ui.speak(c.name); closePop(); paintSide();
          });
          b.setAttribute('aria-label', c.name);
          b.style.setProperty('--sw', c.hex);
          panel.appendChild(b);
        });
      } else {
        setTool('stamp'); paintSide();
        var grid = ui.el('div', 'nu-pop-stamps');
        STAMPS.forEach(function (s) {
          var b = ui.button('nu-sw st' + (s.id === st.stamp ? ' on' : ''), function () {
            ui.play('tap'); chooseStamp(s.id); ui.speak(s.name); closePop(); paintSide();
          });
          b.setAttribute('aria-label', s.name);
          var im = document.createElement('img'); im.src = C.nurieData.stamps[s.id]; im.alt = ''; im.draggable = false;
          b.appendChild(im);
          grid.appendChild(b);
        });
        // 大きさは 水色の わくで 分ける
        var sizes = ui.el('div', 'nu-pop-sizes');
        sizes.appendChild(ui.el('span', 'nu-pop-sizes-title', TEXT.size));
        var szBtns = STAMP_SIZES.map(function (z) {
          var b = ui.button('nu-sw sz sz-' + z.id + (z.id === st.stampSize ? ' on' : ''), function () {
            ui.play('tap'); setStampSize(z.id); ui.speak(z.name);
            szBtns.forEach(function (x, i) { x.classList.toggle('on', STAMP_SIZES[i].id === st.stampSize); });
            paintSide();
          });
          b.setAttribute('aria-label', z.name);
          b.appendChild(ui.el('span', 'nu-sz-dot'));
          sizes.appendChild(b);
          return b;
        });
        panel.appendChild(grid);
        panel.appendChild(sizes);
      }
      pop.classList.add('show');
    }

    // 「これで できあがり？」（はい：保存して できた画面へ／まだ：ぬる画面に もどる）
    var ask = ui.el('div', 'nu-pop nu-done-ask');
    var askBox = ui.el('div', 'nu-pop-panel nu-ask-box');
    askBox.appendChild(ui.el('p', 'nu-ask-msg', TEXT.askDone));
    var askBtns = ui.el('div', 'nu-ask-btns');
    var yesB = ui.button('btn-big nu-yes-done', function () { ui.play('tap'); confirmDone(); });
    yesB.setAttribute('aria-label', 'はい'); yesB.appendChild(ui.el('span', null, 'はい'));
    var notB = ui.button('btn-big secondary', function () { ui.play('tap'); cancelDone(); });
    notB.setAttribute('aria-label', 'まだ'); notB.appendChild(ui.el('span', null, 'まだ'));
    askBtns.appendChild(yesB); askBtns.appendChild(notB);
    askBox.appendChild(askBtns);
    ask.appendChild(askBox);
    ask.addEventListener('click', function (ev) { if (ev.target === ask) { ui.play('tap'); cancelDone(); } });
    app.appendChild(ask);

    var stampImgs = {};
    STAMPS.forEach(function (s) { var im = new Image(); im.src = C.nurieData.stamps[s.id]; stampImgs[s.id] = im; });
    st.dom = { sid: sid, stage: stage, zoomer: zoomer, zoomReset: zoomReset, paint: paint, stamp: stamp, line: line, pg: pg, sg: sg, stampImgs: stampImgs, ask: ask };

    // 線の絵から「線か すき間か」を 調べる
    loadImage(C.nurieData.pics[st.pic]).then(function (im) {
      var cv = document.createElement('canvas'); cv.width = cv.height = CANVAS;
      var g = cv.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, CANVAS, CANVAS); g.drawImage(im, PAD, PAD, SIZE, SIZE);
      if (st && st.dom && st.dom.sid === sid) { st.mask = makeMask(g.getImageData(0, 0, CANVAS, CANVAS)); st.lineImg = im; }
    });

    // 道具の ボタンに いまの 道具・色・スタンプを 出す
    function paintSide() {
      fillB.classList.toggle('on', st.tool === 'fill');
      brushB.classList.toggle('on', st.tool === 'brush');
      stampB.classList.toggle('on', st.tool === 'stamp');
      eraseB.classList.toggle('on', st.tool === 'erase');
      colorB.style.setProperty('--sw', st.color);
      stampB.style.setProperty('--st', 'url("' + C.nurieData.stamps[st.stamp] + '")');
    }
    paintSide();

    // 拡大の ようすを 画面に
    // 紙の 置き方：見える 大きさ（stage）の 短いほうを 絵（512）に 合わせ、紙（640）を まん中に 置く。
    // たて向きは 上下、横向きは 左右の 余白が 見え、反対の 向きの 余白は かくれる
    var lay = { w: 1, h: 1, len: 1, bx: 0, by: 0 };
    function layout() {
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var len = Math.min(r.width, r.height) * CANVAS / SIZE;
      lay = { w: r.width, h: r.height, len: len, bx: (r.width - len) / 2, by: (r.height - len) / 2 };
      if (st.dom) st.dom.lay = lay;   // 作品を 保存する とき、見えていた 範囲を 知るため
      zoomer.style.width = zoomer.style.height = len + 'px';
      zoomer.style.left = lay.bx + 'px'; zoomer.style.top = lay.by + 'px';
      setView(st.view || { scale: 1, x: 0, y: 0 });
    }
    function setView(v) {
      st.view = clampView(v, lay.w, lay.h, lay.len);
      zoomer.style.transform = 'translate(' + st.view.x + 'px,' + st.view.y + 'px) scale(' + st.view.scale + ')';
      zoomReset.classList.toggle('show', st.view.scale > 1.01);
    }
    layout();
    if (window.ResizeObserver) new ResizeObserver(function () { if (st && st.dom && st.dom.sid === sid) layout(); }).observe(stage);
    else window.addEventListener('resize', function () { if (st && st.dom && st.dom.sid === sid) layout(); });

    // 絵の上の 指。1本指：道具を つかう（ぬる・けす・スタンプは 指を はなしたとき）。2本指：拡大・移動
    var ptrs = {}, g = null;
    function count() { return Object.keys(ptrs).length; }
    function at(cx, cy) { var r = zoomer.getBoundingClientRect(); return { x: (cx - r.left) / r.width * CANVAS, y: (cy - r.top) / r.height * CANVAS }; }
    function two() { var k = Object.keys(ptrs); return [ptrs[k[0]], ptrs[k[1]]]; }
    stage.addEventListener('pointerdown', function (ev) {
      if (!st || st.phase !== 'paint' || ev.target === zoomReset || zoomReset.contains(ev.target)) return;
      ev.preventDefault();
      try { stage.setPointerCapture(ev.pointerId); } catch (e) {}
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      if (count() === 1) {
        g = { mode: 'one', sx: ev.clientX, sy: ev.clientY, moved: false, drawing: false, last: null };
        if (st.tool === 'brush') {
          pushUndo();
          g.drawing = true; g.last = at(ev.clientX, ev.clientY);
          pg.fillStyle = st.color;
          pg.beginPath(); pg.arc(g.last.x, g.last.y, BRUSH / 2, 0, Math.PI * 2); pg.fill();
        }
      } else if (count() === 2) {
        // 2本目の 指：ふでの 線は 取り消して、拡大に かえる
        if (g && g.drawing) undo();
        var pr = two(), r = stage.getBoundingClientRect();
        g = { mode: 'pinch', d0: Math.hypot(pr[0].x - pr[1].x, pr[0].y - pr[1].y) || 1,
          mx: (pr[0].x + pr[1].x) / 2 - r.left, my: (pr[0].y + pr[1].y) / 2 - r.top, v0: { scale: st.view.scale, x: st.view.x, y: st.view.y } };
      }
    });
    stage.addEventListener('pointermove', function (ev) {
      if (!ptrs[ev.pointerId] || !g) return;
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      if (g.mode === 'pinch' && count() >= 2) {
        var pr = two(), r = stage.getBoundingClientRect();
        var d = Math.hypot(pr[0].x - pr[1].x, pr[0].y - pr[1].y) || 1;
        var mx = (pr[0].x + pr[1].x) / 2 - r.left, my = (pr[0].y + pr[1].y) / 2 - r.top;
        var s = g.v0.scale * d / g.d0;
        // 指の まん中に ある 紙の 点（拡大前の 大きさで）が、動いた 指の まん中に くるように
        var cx = (g.mx - lay.bx - g.v0.x) / g.v0.scale, cy = (g.my - lay.by - g.v0.y) / g.v0.scale;
        var sc = Math.max(1, Math.min(MAX_ZOOM, s));
        setView({ scale: s, x: mx - lay.bx - cx * sc, y: my - lay.by - cy * sc });
        return;
      }
      if (g.mode !== 'one') return;
      if (Math.hypot(ev.clientX - g.sx, ev.clientY - g.sy) > TAP_MOVE) g.moved = true;
      if (g.drawing) {
        var p = at(ev.clientX, ev.clientY);
        pg.strokeStyle = st.color; pg.lineWidth = BRUSH; pg.lineCap = 'round'; pg.lineJoin = 'round';
        pg.beginPath(); pg.moveTo(g.last.x, g.last.y); pg.lineTo(p.x, p.y); pg.stroke();
        g.last = p;
      }
    });
    function up(ev) {
      if (!ptrs[ev.pointerId]) return;
      delete ptrs[ev.pointerId];
      if (!g) return;
      if (g.mode === 'one' && count() === 0) {
        if (!g.moved && ev.type === 'pointerup') useTool(at(g.sx, g.sy));
        g = null;
      } else if (g.mode === 'pinch' && count() === 0) {
        g = null;   // 2本指の あとは、指が ぜんぶ はなれるまで ぬらない
      }
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);

    // ぬる・けす・スタンプ（タッチ）
    function useTool(p) {
      if (!st || st.phase !== 'paint') return;
      if (st.tool === 'fill' || st.tool === 'erase') {
        if (st.tool === 'erase') {
          var i = hitStamp(st.stamps, p.x, p.y);
          if (i >= 0) { pushUndo(); st.stamps.splice(i, 1); redrawStamps(); play('tap'); return; }
        }
        if (!st.mask) return;
        var region = fillRegion(st.mask, CANVAS, CANVAS, p.x, p.y, EDGE);
        if (!region) return;
        pushUndo();
        var img = pg.getImageData(0, 0, CANVAS, CANVAS);
        paintRegion(img.data, region, st.tool === 'erase' ? '#ffffff' : st.color);
        pg.putImageData(img, 0, 0);
        play('tap');
      } else if (st.tool === 'stamp') {
        var im = stampImgs[st.stamp];
        if (!im || !im.complete) return;
        pushUndo();
        st.stamps.push({ id: st.stamp, x: p.x, y: p.y, px: stampPx(st.stampSize) });
        redrawStamps();
        play('tap');
      }
    }
  }

  // おぼえている スタンプを スタンプ用の 絵に 描きなおす
  function redrawStamps() {
    var d = st.dom;
    if (!d) return;
    d.sg.clearRect(0, 0, CANVAS, CANVAS);
    st.stamps.forEach(function (s) {
      var im = d.stampImgs[s.id];
      if (im && im.complete) d.sg.drawImage(im, s.x - s.px / 2, s.y - s.px / 2, s.px, s.px);
    });
  }
  function stampPx(id) { for (var i = 0; i < STAMP_SIZES.length; i++) if (STAMP_SIZES[i].id === id) return STAMP_SIZES[i].px; return STAMP_SIZES[1].px; }
  function setTool(id) { if (st && (id === 'fill' || id === 'brush' || id === 'stamp' || id === 'erase')) st.tool = id; }
  // 色を えらぶ。スタンプ・けすの ときは「ぬる」に もどす（色は ぬる・ふでで 使うため）
  function chooseColor(hex) {
    if (!st) return;
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].hex === hex) { st.color = hex; if (st.tool === 'stamp' || st.tool === 'erase') st.tool = 'fill'; return; }
  }
  // スタンプを えらぶと スタンプの 道具に なる
  function chooseStamp(id) { if (st && stampById(id)) { st.stamp = id; st.tool = 'stamp'; } }
  // ない 大きさは かえない
  function setStampSize(id) {
    if (!st) return;
    for (var i = 0; i < STAMP_SIZES.length; i++) if (STAMP_SIZES[i].id === id) { st.stampSize = id; return; }
  }

  function pushUndo() {
    var d = st.dom;
    if (!d) return;
    st.undo.push({ p: d.pg.getImageData(0, 0, CANVAS, CANVAS), s: st.stamps.slice() });
    if (st.undo.length > MAX_UNDO) st.undo.shift();
  }
  function undo() {
    var d = st.dom, u = st.undo.pop();
    if (!d || !u) return;
    d.pg.putImageData(u.p, 0, 0); st.stamps = u.s; redrawStamps();
  }
  // 「ひとつ もどす」で もどせるので、確認は しない
  function clearAll() {
    var d = st.dom;
    if (!d) return;
    pushUndo();
    d.pg.fillStyle = '#ffffff'; d.pg.fillRect(0, 0, CANVAS, CANVAS);
    st.stamps = []; redrawStamps();
  }
  // 色・線・スタンプを 1まいに 重ねる
  function compose() {
    var d = st.dom;
    if (!d || !st.lineImg) return '';
    var cv = document.createElement('canvas'); cv.width = cv.height = CANVAS;
    var g = cv.getContext('2d');
    g.drawImage(d.paint, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(st.lineImg, PAD, PAD, SIZE, SIZE);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(d.stamp, 0, 0);
    // 見えていた 範囲だけを 切りだす（たて向きなら たて長、横向きなら 横長）
    var lay = d.lay, out = cv;
    if (lay && lay.len) {
      var v = visibleRect(lay.w, lay.h, lay.len);
      out = document.createElement('canvas'); out.width = v.w; out.height = v.h;
      out.getContext('2d').drawImage(cv, v.x, v.y, v.w, v.h, 0, 0, v.w, v.h);
    }
    try { return out.toDataURL('image/jpeg', 0.85); } catch (e) { return ''; }
  }

  // 「できた！」：まず 聞く（まちがえて 押しても すぐに 終わらない）
  function askDone() {
    if (!st || st.phase !== 'paint') return;
    st.confirming = true;
    if (st.dom && st.dom.ask) st.dom.ask.classList.add('show');
    speak(TEXT.askDone);
  }
  function cancelDone() {
    if (!st) return;
    st.confirming = false;
    if (st.dom && st.dom.ask) st.dom.ask.classList.remove('show');
  }
  function confirmDone() {
    if (!st || !st.confirming) return;
    st.confirming = false;
    done();
  }

  function done() {
    if (!st || st.phase !== 'paint') return;
    var img = compose();
    saveWork(st.profileId, { pic: st.pic, at: Date.now(), img: img });
    try {
      var p = C.storage.logAnswer({ profileId: st.profileId, area: AREA, itemId: st.pic, correct: true, level: 1 });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 保存できなくても続ける */ }
    st.phase = 'done';
    if (!hasApp()) return;
    var ui = U();
    ui.play('star');
    var app = ui.newScreen('nurie-done');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'nu-done-body');
    var pic = ui.el('div', 'nu-done-pic');
    if (img) { var im = document.createElement('img'); im.src = img; im.alt = ''; pic.appendChild(im); }
    var burst = ui.el('div', 'burst');
    for (var k = 0; k < 5; k++) burst.appendChild(ui.svg(ui.STAR, 'reward-star s' + k));
    pic.appendChild(burst);
    body.appendChild(pic);
    var info = ui.el('div', 'nu-done-info');
    info.appendChild(ui.chara('happy'));
    info.appendChild(ui.el('p', 'nu-done-msg', 'すてき！'));
    var nx = ui.button('btn-big btn-next', function () {
      if (nx.disabled) return;
      nx.disabled = true; ui.play('tap');
      if (isOver()) { st.phase = 'rest'; ui.showRest(); return; }
      showSelect();
    });
    nx.setAttribute('aria-label', 'つぎの え'); nx.appendChild(ui.svg(ui.ICO.next)); nx.appendChild(ui.el('span', null, 'つぎの え'));
    var wb = ui.button('btn-big secondary', function () { ui.play('tap'); showWorks(); });
    wb.setAttribute('aria-label', TEXT.works); wb.appendChild(ui.el('span', null, TEXT.works));
    info.appendChild(nx); info.appendChild(wb);
    body.appendChild(info);
    app.appendChild(body);
    ui.speak(TEXT.done);
  }

  // さくひん：作成日つきで ならべる。タッチで 大きく 見て、「けす」→「けしても いい？」で 消せる
  function showWorks() {
    st.phase = 'works';
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('nurie-works');
    app.appendChild(ui.topBar({ home: true }));
    var body = ui.el('div', 'nu-works-body');
    var head = ui.el('div', 'nu-sel-head');
    head.appendChild(ui.el('p', 'nu-sel-title', TEXT.works));
    var back = ui.button('btn-big secondary', function () { ui.play('tap'); showSelect(); });
    back.setAttribute('aria-label', 'ぬりえに もどる'); back.appendChild(ui.el('span', null, 'ぬりえ'));
    head.appendChild(back);
    body.appendChild(head);
    var works = loadWorks(st.profileId).filter(function (w) { return w && w.img; });
    if (!works.length) {
      body.appendChild(ui.el('p', 'nu-empty', TEXT.empty));
      app.appendChild(body);
      ui.speak(TEXT.empty);
      return;
    }
    var gridEl = ui.el('div', 'nu-works');
    // 大きく 見る まど
    var big = ui.el('div', 'nu-big');
    var bigBox = ui.el('div', 'nu-big-box');
    var bigImg = document.createElement('img'); bigImg.alt = '';
    var bigDate = ui.el('p', 'nu-big-date');
    var bigBtns = ui.el('div', 'nu-big-btns');
    var cur = null;
    var delB = ui.button('btn-big secondary nu-del', function () { ui.play('tap'); askDel.classList.add('show'); ui.speak(TEXT.askDelete); });
    delB.setAttribute('aria-label', 'けす'); delB.appendChild(ui.el('span', null, 'けす'));
    var closeB = ui.button('btn-big', function () { ui.play('tap'); big.classList.remove('show'); });
    closeB.setAttribute('aria-label', 'とじる'); closeB.appendChild(ui.el('span', null, 'とじる'));
    bigBtns.appendChild(delB); bigBtns.appendChild(closeB);
    // 「けしても いい？」
    var askDel = ui.el('div', 'nu-ask');
    askDel.appendChild(ui.el('p', 'nu-ask-msg', TEXT.askDelete));
    var askBtns = ui.el('div', 'nu-ask-btns');
    var yes = ui.button('btn-big nu-yes', function () {
      ui.play('tap');
      if (cur) deleteWork(st.profileId, cur.at);
      showWorks();
    });
    yes.setAttribute('aria-label', 'はい'); yes.appendChild(ui.el('span', null, 'はい'));
    var no = ui.button('btn-big secondary', function () { ui.play('tap'); askDel.classList.remove('show'); });
    no.setAttribute('aria-label', 'いいえ'); no.appendChild(ui.el('span', null, 'いいえ'));
    askBtns.appendChild(yes); askBtns.appendChild(no);
    askDel.appendChild(askBtns);
    bigBox.appendChild(bigImg); bigBox.appendChild(bigDate); bigBox.appendChild(bigBtns); bigBox.appendChild(askDel);
    big.appendChild(bigBox);
    big.addEventListener('click', function (ev) { if (ev.target === big) big.classList.remove('show'); });
    works.forEach(function (w) {
      var b = ui.button('nu-work', function () {
        ui.play('tap'); cur = w; bigImg.src = w.img; bigDate.textContent = w.at ? dateText(w.at) : '';
        askDel.classList.remove('show'); big.classList.add('show'); ui.speak(picName(w.pic));
      });
      b.setAttribute('aria-label', picName(w.pic));
      var im = document.createElement('img'); im.src = w.img; im.alt = ''; im.draggable = false;
      b.appendChild(im);
      if (w.at) b.appendChild(ui.el('span', 'nu-work-date', dateText(w.at)));
      gridEl.appendChild(b);
    });
    body.appendChild(gridEl);
    app.appendChild(body);
    app.appendChild(big);
    ui.speak(TEXT.works);
  }

  function state() {
    return st ? { phase: st.phase, confirming: !!st.confirming, pic: st.pic, tool: st.tool, color: st.color, stamp: st.stamp, stampSize: st.stampSize, undo: (st.undo || []).length, stamps: (st.stamps || []).slice(), view: st.view } : null;
  }

  C.nurie = {
    AREA: AREA, SIZE: SIZE, PAD: PAD, CANVAS: CANVAS, MAX_WORKS: MAX_WORKS, MAX_UNDO: MAX_UNDO, MAX_ZOOM: MAX_ZOOM, PICS: PICS, STAMPS: STAMPS, STAMP_SIZES: STAMP_SIZES,
    COLORS: COLORS, TOOLS: TOOLS, TEXT: TEXT,
    makeMask: makeMask, fillRegion: fillRegion, paintRegion: paintRegion, loadImage: loadImage,
    pageCount: pageCount, turnPage: turnPage, hitStamp: hitStamp, clampView: clampView, visibleRect: visibleRect, dateText: dateText,
    worksKey: worksKey, loadWorks: loadWorks, saveWork: saveWork, deleteWork: deleteWork, start: start,
    // テスト用
    _state: state, _pick: pick, _done: done, _setStampSize: setStampSize, _setTool: setTool, _chooseColor: chooseColor, _chooseStamp: chooseStamp,
    _askDone: askDone, _cancelDone: cancelDone, _confirmDone: confirmDone
  };
})();
