/* ぬりえ。Chiid.nurie
   線の絵を えらんで、「ぬる」（タッチした所を 色で うめる）・「ふで」（指で 描く）・「スタンプ」（飾りつけ）で 仕上げる。
   正解・不正解は ない。「できた！」で 作品を 端末の中に 保存し、「さくひん」で 見返せる（新しい 20まいまで）。
   園児が見る文字は、ひらがなだけ。通信は行わない。設計書：docs/superpowers/specs/2026-11-27-chiiku-nurie-design.md
   線の絵と スタンプは nurie-data.js（Chiid.nurieData）に 文字で 埋めこんである（index.html を 直接 開いても 点を 調べられるように）。
   画面の部品は game.js が Chiid.chiikuUi として渡す（読み込み順：game.js のあと）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA = 'nurie';
  var SIZE = 512;          // 絵の 大きさ（点の数）
  var MAX_WORKS = 20;
  var MAX_UNDO = 12;
  var BRUSH = 14;          // ふでの 太さ
  // スタンプの 大きさ（点の数）。はじめは ふつう
  var STAMP_SIZES = [{ id: 's', name: 'ちいさい', px: 64 }, { id: 'm', name: 'ふつう', px: 104 }, { id: 'l', name: 'おおきい', px: 168 }];
  var EDGE = 2;            // 「ぬる」で 線の下まで ぬる はば（白い すき間を のこさない）
  var PER_PAGE = 8;
  var LINE_LEVEL = 200;    // これより こい点は 線

  var PICS = [
    { id: 'inu', name: 'いぬ' }, { id: 'neko', name: 'ねこ' }, { id: 'usagi', name: 'うさぎ' }, { id: 'zou', name: 'ぞう' },
    { id: 'sakana', name: 'さかな' }, { id: 'kuruma', name: 'くるま' }, { id: 'kisha', name: 'きしゃ' }, { id: 'hikouki', name: 'ひこうき' },
    { id: 'keeki', name: 'けーき' }, { id: 'aisu', name: 'あいす' }, { id: 'ringo', name: 'りんご' }, { id: 'ichigo', name: 'いちご' },
    { id: 'ie', name: 'おうち' }, { id: 'yukidaruma', name: 'ゆきだるま' }, { id: 'hana', name: 'おはな' }, { id: 'roketto', name: 'ろけっと' }
  ];
  var STAMPS = [
    { id: 'hoshi', name: 'ほし' }, { id: 'heart', name: 'はーと' }, { id: 'hana', name: 'おはな' },
    { id: 'onpu', name: 'おんぷ' }, { id: 'ribon', name: 'りぼん' }, { id: 'niji', name: 'にじ' },
    { id: 'kira', name: 'きらきら' }, { id: 'kumo', name: 'くも' }, { id: 'taiyou', name: 'おひさま' }
  ];
  var COLORS = [
    { name: 'あか', hex: '#e2483d' }, { name: 'ももいろ', hex: '#f48fb1' }, { name: 'だいだい', hex: '#f28c28' }, { name: 'きいろ', hex: '#f9d531' },
    { name: 'きみどり', hex: '#a5d65a' }, { name: 'みどり', hex: '#3aa05a' }, { name: 'みずいろ', hex: '#7ccdf0' }, { name: 'あお', hex: '#2f6fd6' },
    { name: 'むらさき', hex: '#8e5bd0' }, { name: 'ちゃいろ', hex: '#9a6a42' }, { name: 'くろ', hex: '#3a3a3a' }, { name: 'しろ', hex: '#ffffff' }
  ];
  var TOOLS = [{ id: 'fill', name: 'ぬる' }, { id: 'brush', name: 'ふで' }, { id: 'stamp', name: 'すたんぷ' }];
  var TEXT = {
    choose: 'どれを ぬる？', start: 'すきな いろで ぬってね', done: 'すてきな えが できたね！',
    works: 'さくひん', empty: 'まだ ないよ。ぬりえを してみよう'
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

  /* ---------- 作品（端末の中だけ） ---------- */
  function worksKey(pid) { return 'chiid-nurie-' + pid; }
  function loadWorks(pid) {
    try { var a = JSON.parse(localStorage.getItem(worksKey(pid)) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  // 新しい作品を 先頭に。20まいを こえたら 古いものから 消す。いっぱいで 保存できないときも 古いものを 消して やりなおす
  function saveWork(pid, work) {
    var list = [work].concat(loadWorks(pid)).slice(0, MAX_WORKS);
    while (list.length) {
      try { localStorage.setItem(worksKey(pid), JSON.stringify(list)); return true; } catch (e) { list.pop(); }
    }
    return false;
  }

  /* ==================== 画面 ==================== */
  var st = null;
  function U() { return C.chiikuUi; }
  function hasApp() { return !!document.getElementById('app'); }
  function speak(t) { try { if (hasApp()) U().speak(t); } catch (e) {} }
  function play(n) { try { if (hasApp()) U().play(n); } catch (e) {} }
  function isOver() { try { return C.timer.isOver(st.profileId); } catch (e) { return false; } }
  function picName(id) { for (var i = 0; i < PICS.length; i++) if (PICS[i].id === id) return PICS[i].name; return ''; }

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
    app.appendChild(body);
    var pages = Math.ceil(PICS.length / PER_PAGE);
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
      prev.disabled = st.page === 0; next.disabled = st.page >= pages - 1;
    }
    function turn(d) { var np = Math.max(0, Math.min(pages - 1, st.page + d)); if (np === st.page) return; ui.play('tap'); st.page = np; draw(); }
    draw();
    ui.speak(TEXT.choose);
  }

  function pick(id) {
    if (!st || st.phase !== 'select') return;
    st.pic = id; st.phase = 'paint'; st.tool = 'fill'; st.color = COLORS[0].hex; st.stamp = STAMPS[0].id; st.stampSize = 'm'; st.undo = []; st.mask = null;
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
    var paint = document.createElement('canvas'), stamp = document.createElement('canvas');
    paint.width = paint.height = stamp.width = stamp.height = SIZE;
    paint.className = 'nu-layer nu-paint'; stamp.className = 'nu-layer nu-stampl';
    var line = document.createElement('img');
    line.className = 'nu-layer nu-line'; line.alt = ''; line.draggable = false;
    line.src = C.nurieData.pics[st.pic];
    stage.appendChild(paint); stage.appendChild(line); stage.appendChild(stamp);
    var pg = paint.getContext('2d'), sg = stamp.getContext('2d');
    pg.fillStyle = '#ffffff'; pg.fillRect(0, 0, SIZE, SIZE);
    body.appendChild(stage);

    // 道具の列：ぬる・ふで／いろ・すたんぷ（押すと えらぶ まどが 開く）／もどす・けす／できた
    // 絵を できるだけ 大きく するため、横向きでは 上の帯を 使わず、おうち・おんがくを 右の列の 上に 置く
    var side = ui.el('div', 'nu-side');
    var bar = ui.topBar({ home: true });   // おうち・おんがく（ぬりえの ボタンとは 離して 置く）
    bar.classList.add('nu-bar');
    body.appendChild(bar);
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
    var colorB = toolBtn('t-color', 'いろ', function () { ui.play('tap'); ui.speak('いろ'); openPop('color'); });
    var stampB = toolBtn('t-stamp', 'すたんぷ', function () { ui.play('tap'); ui.speak('すたんぷ'); openPop('stamp'); });
    function actBtn(cls, label, text, fn) {
      var b = ui.button('nu-act ' + cls, fn);
      b.setAttribute('aria-label', label); b.appendChild(ui.el('span', null, text));
      side.appendChild(b);
    }
    actBtn('a-undo', 'ひとつ もどす', 'もどす', function () { ui.play('tap'); undo(); });
    actBtn('a-clear', 'ぜんぶ けす', 'けす', function () { ui.play('tap'); clearAll(); });
    actBtn('a-done', 'できた', 'できた！', function () { done(); });
    body.appendChild(side);
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
        var sizes = ui.el('div', 'nu-pop-sizes');
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

    var stampImgs = {};
    STAMPS.forEach(function (s) { var im = new Image(); im.src = C.nurieData.stamps[s.id]; stampImgs[s.id] = im; });
    st.dom = { sid: sid, stage: stage, paint: paint, stamp: stamp, line: line, pg: pg, sg: sg, stampImgs: stampImgs };

    // 線の絵から「線か すき間か」を 調べる
    loadImage(C.nurieData.pics[st.pic]).then(function (im) {
      var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
      var g = cv.getContext('2d');
      g.drawImage(im, 0, 0, SIZE, SIZE);
      if (st && st.dom && st.dom.sid === sid) { st.mask = makeMask(g.getImageData(0, 0, SIZE, SIZE)); st.lineImg = im; }
    });

    // 道具の ボタンに いまの 道具・色・スタンプを 出す
    function paintSide() {
      fillB.classList.toggle('on', st.tool === 'fill');
      brushB.classList.toggle('on', st.tool === 'brush');
      stampB.classList.toggle('on', st.tool === 'stamp');
      colorB.style.setProperty('--sw', st.color);
      stampB.style.setProperty('--st', 'url("' + C.nurieData.stamps[st.stamp] + '")');
      stampB.dataset.size = st.stampSize;
    }
    paintSide();

    // 絵の上の 指
    var drawing = false, last = null;
    function at(ev) { var r = stage.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * SIZE, y: (ev.clientY - r.top) / r.height * SIZE }; }
    stage.addEventListener('pointerdown', function (ev) {
      if (!st || st.phase !== 'paint') return;
      ev.preventDefault();
      var p = at(ev);
      if (st.tool === 'fill') {
        if (!st.mask) return;
        var region = fillRegion(st.mask, SIZE, SIZE, p.x, p.y, EDGE);
        if (!region) return;
        pushUndo();
        var img = pg.getImageData(0, 0, SIZE, SIZE);
        paintRegion(img.data, region, st.color);
        pg.putImageData(img, 0, 0);
        play('tap');
      } else if (st.tool === 'brush') {
        pushUndo();
        drawing = true; last = p;
        try { stage.setPointerCapture(ev.pointerId); } catch (e) {}
        pg.fillStyle = st.color;
        pg.beginPath(); pg.arc(p.x, p.y, BRUSH / 2, 0, Math.PI * 2); pg.fill();
      } else {
        var im = stampImgs[st.stamp];
        if (!im || !im.complete) return;
        pushUndo();
        var sz = stampPx(st.stampSize);
        sg.drawImage(im, p.x - sz / 2, p.y - sz / 2, sz, sz);
        play('tap');
      }
    });
    stage.addEventListener('pointermove', function (ev) {
      if (!drawing) return;
      var p = at(ev);
      pg.strokeStyle = st.color; pg.lineWidth = BRUSH; pg.lineCap = 'round'; pg.lineJoin = 'round';
      pg.beginPath(); pg.moveTo(last.x, last.y); pg.lineTo(p.x, p.y); pg.stroke();
      last = p;
    });
    function up() { drawing = false; last = null; }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
  }

  function stampPx(id) { for (var i = 0; i < STAMP_SIZES.length; i++) if (STAMP_SIZES[i].id === id) return STAMP_SIZES[i].px; return STAMP_SIZES[1].px; }
  function setTool(id) { if (st && (id === 'fill' || id === 'brush' || id === 'stamp')) st.tool = id; }
  // 色を えらぶ。スタンプの ときは「ぬる」に もどす（色は ぬる・ふでで 使うため）
  function chooseColor(hex) {
    if (!st) return;
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].hex === hex) { st.color = hex; if (st.tool === 'stamp') st.tool = 'fill'; return; }
  }
  // スタンプを えらぶと スタンプの 道具に なる
  function chooseStamp(id) {
    if (!st) return;
    for (var i = 0; i < STAMPS.length; i++) if (STAMPS[i].id === id) { st.stamp = id; st.tool = 'stamp'; return; }
  }
  // ない 大きさは かえない
  function setStampSize(id) {
    if (!st) return;
    for (var i = 0; i < STAMP_SIZES.length; i++) if (STAMP_SIZES[i].id === id) { st.stampSize = id; return; }
  }

  function pushUndo() {
    var d = st.dom;
    if (!d) return;
    st.undo.push({ p: d.pg.getImageData(0, 0, SIZE, SIZE), s: d.sg.getImageData(0, 0, SIZE, SIZE) });
    if (st.undo.length > MAX_UNDO) st.undo.shift();
  }
  function undo() {
    var d = st.dom, u = st.undo.pop();
    if (!d || !u) return;
    d.pg.putImageData(u.p, 0, 0); d.sg.putImageData(u.s, 0, 0);
  }
  // 「ひとつ もどす」で もどせるので、確認は しない
  function clearAll() {
    var d = st.dom;
    if (!d) return;
    pushUndo();
    d.pg.fillStyle = '#ffffff'; d.pg.fillRect(0, 0, SIZE, SIZE);
    d.sg.clearRect(0, 0, SIZE, SIZE);
  }
  // 色・線・スタンプを 1まいに 重ねる
  function compose() {
    var d = st.dom;
    if (!d || !st.lineImg) return '';
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var g = cv.getContext('2d');
    g.drawImage(d.paint, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(st.lineImg, 0, 0, SIZE, SIZE);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(d.stamp, 0, 0);
    try { return cv.toDataURL('image/jpeg', 0.85); } catch (e) { return ''; }
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

  // さくひん
  function showWorks() {
    st.phase = 'works';
    if (!hasApp()) return;
    var ui = U();
    var app = ui.newScreen('nurie-works');
    var bar = ui.topBar({ home: true });
    app.appendChild(bar);
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
    var big = ui.el('div', 'nu-big');
    var bigImg = document.createElement('img'); bigImg.alt = '';
    big.appendChild(bigImg);
    big.addEventListener('click', function () { big.classList.remove('show'); });
    works.forEach(function (w) {
      var b = ui.button('nu-work', function () { ui.play('tap'); bigImg.src = w.img; big.classList.add('show'); ui.speak(picName(w.pic)); });
      b.setAttribute('aria-label', picName(w.pic));
      var im = document.createElement('img'); im.src = w.img; im.alt = ''; im.draggable = false;
      b.appendChild(im);
      gridEl.appendChild(b);
    });
    body.appendChild(gridEl);
    app.appendChild(body);
    app.appendChild(big);
    ui.speak(TEXT.works);
  }

  function state() { return st ? { phase: st.phase, pic: st.pic, tool: st.tool, color: st.color, stamp: st.stamp, stampSize: st.stampSize, undo: (st.undo || []).length } : null; }

  C.nurie = {
    AREA: AREA, SIZE: SIZE, MAX_WORKS: MAX_WORKS, MAX_UNDO: MAX_UNDO, PICS: PICS, STAMPS: STAMPS, STAMP_SIZES: STAMP_SIZES, COLORS: COLORS, TOOLS: TOOLS, TEXT: TEXT,
    makeMask: makeMask, fillRegion: fillRegion, paintRegion: paintRegion, loadImage: loadImage,
    worksKey: worksKey, loadWorks: loadWorks, saveWork: saveWork, start: start,
    // テスト用
    _state: state, _pick: pick, _done: done, _setStampSize: setStampSize, _setTool: setTool, _chooseColor: chooseColor, _chooseStamp: chooseStamp
  };
})();
