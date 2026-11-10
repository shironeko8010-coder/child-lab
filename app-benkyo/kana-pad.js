/* ひらがなキーボード（2段階式）。Chiid.kanaPad
   1段目：行ボタン10こ（あ行〜わ行）。行を押すと、その下に字が大きく出る。字を押すと答えの枠に入り、行えらびに戻る。
   「゛゜ ちいさい」で直前の字を変える（は→ば→ぱ→は、つ→っ→づ→つ、や→ゃ→や など）。「けす」で1字消す。
   ロジック（Model）と描画（render）を分けている。ほかの教科でも使えるよう、答えの字数・「こたえる」の処理は外から渡す。
   通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var ROWS = [
    { id: 'a', name: 'あ行', chars: 'あいうえお' },
    { id: 'ka', name: 'か行', chars: 'かきくけこ' },
    { id: 'sa', name: 'さ行', chars: 'さしすせそ' },
    { id: 'ta', name: 'た行', chars: 'たちつてと' },
    { id: 'na', name: 'な行', chars: 'なにぬねの' },
    { id: 'ha', name: 'は行', chars: 'はひふへほ' },
    { id: 'ma', name: 'ま行', chars: 'まみむめも' },
    { id: 'ya', name: 'や行', chars: 'やゆよ' },
    { id: 'ra', name: 'ら行', chars: 'らりるれろ' },
    { id: 'wa', name: 'わ行', chars: 'わをん' }
  ];

  // 「゛゜ ちいさい」で順に変わる字のならび（最後の次は最初にもどる）
  var CYCLES = [
    'かが', 'きぎ', 'くぐ', 'けげ', 'こご',
    'さざ', 'しじ', 'すず', 'せぜ', 'そぞ',
    'ただ', 'ちぢ', 'つっづ', 'てで', 'とど',
    'はばぱ', 'ひびぴ', 'ふぶぷ', 'へべぺ', 'ほぼぽ',
    'あぁ', 'いぃ', 'うぅ', 'えぇ', 'おぉ',
    'やゃ', 'ゆゅ', 'よょ', 'わゎ'
  ];
  var NEXT = {};
  CYCLES.forEach(function (c) {
    for (var i = 0; i < c.length; i++) NEXT[c.charAt(i)] = c.charAt((i + 1) % c.length);
  });

  // ch の次の字（変えられない字は null）
  function cycle(ch) { return NEXT[ch] || null; }
  function rowById(id) {
    for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === id) return ROWS[i];
    return null;
  }

  /* ---------- ロジック ---------- */
  // max: 入る字数の上限（0 なら上限なし）
  function Model(max) {
    this.value = '';
    this.max = Math.max(0, Number(max) || 0);
    this.row = null;          // 開いている行の id（null なら行えらび）
  }
  Model.prototype.isFull = function () { return this.max > 0 && this.value.length >= this.max; };
  Model.prototype.selectRow = function (id) {
    if (!rowById(id)) return false;
    this.row = id;
    return true;
  };
  Model.prototype.closeRow = function () { this.row = null; };
  // 字を入れる。開いている行の字でなくても入れられる（テスト・ほかの使い方のため）
  Model.prototype.input = function (ch) {
    ch = String(ch == null ? '' : ch);
    if (ch.length !== 1 || this.isFull()) { this.row = null; return false; }
    this.value += ch;
    this.row = null;           // 入れたら行えらびに戻る
    return true;
  };
  // 直前の字を「゛゜ ちいさい」で変える
  Model.prototype.mod = function () {
    if (!this.value) return false;
    var last = this.value.charAt(this.value.length - 1);
    var nx = cycle(last);
    if (!nx) return false;
    this.value = this.value.slice(0, -1) + nx;
    return true;
  };
  Model.prototype.back = function () {
    this.row = null;
    if (!this.value) return false;
    this.value = this.value.slice(0, -1);
    return true;
  };
  Model.prototype.clear = function () { this.value = ''; this.row = null; };
  Model.prototype.setMax = function (n) {
    this.max = Math.max(0, Number(n) || 0);
    if (this.max && this.value.length > this.max) this.value = this.value.slice(0, this.max);
  };

  /* ---------- 描画 ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(cls, fn) {
    var b = el('button', cls);
    b.type = 'button';
    b.addEventListener('click', function (ev) { fn(ev, b); });
    return b;
  }

  // opts: { max, onSubmit(value), onChange(value), onTap(kind), canTap() }
  // 返り値: { el: キーボード, slots: 答えの枠, model, setMax(n), reset(), showAnswer(s, cls), paint() }
  function render(opts) {
    opts = opts || {};
    var model = new Model(opts.max);
    var locked = false;
    var shown = null;          // 答えを見せているとき { s, cls }
    var root = el('div', 'kp');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'ひらがなキーボード');
    var slots = el('div', 'kp-slots');
    slots.setAttribute('aria-live', 'polite');

    function can() { return !locked && (typeof opts.canTap !== 'function' || opts.canTap()); }
    function tap(kind) { if (typeof opts.onTap === 'function') opts.onTap(kind); }
    function changed() { paint(); if (typeof opts.onChange === 'function') opts.onChange(model.value); }

    var rowsBox = el('div', 'kp-rows');
    var rowBtns = [];
    ROWS.forEach(function (r) {
      var b = btn('kp-row', function () {
        if (!can()) return;
        tap('row');
        model.selectRow(r.id);
        paint();
      });
      b.appendChild(el('b', null, r.name));
      b.appendChild(el('small', null, r.chars));
      b.setAttribute('aria-label', r.name + '（' + r.chars + '）');
      b.setAttribute('data-row', r.id);
      rowBtns.push({ id: r.id, el: b });
      rowsBox.appendChild(b);
    });
    root.appendChild(rowsBox);

    var charsBox = el('div', 'kp-chars');
    var hint = el('div', 'kp-hint', 'ぎょうを えらんでね');
    charsBox.appendChild(hint);
    var charBtns = [];
    for (var i = 0; i < 5; i++) {
      (function (idx) {
        var b = btn('kp-char', function () {
          if (!can()) return;
          var r = rowById(model.row);
          var ch = r && r.chars.charAt(idx);
          if (!ch) return;
          tap('char');
          model.input(ch);
          changed();
        });
        charBtns.push(b);
        charsBox.appendChild(b);
      })(i);
    }
    root.appendChild(charsBox);

    var acts = el('div', 'kp-acts');
    var modBtn = btn('kp-act kp-mod', function () {
      if (!can()) return;
      tap('mod');
      if (model.mod()) changed();
    });
    var mk = el('b', 'kp-mark');   // ゛゜ は字だと小さく出るので、絵でかく
    mk.innerHTML = '<svg viewBox="0 0 48 24" aria-hidden="true"><path d="M7 4l5 10M17 2l5 10" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/><circle cx="36" cy="10" r="7" stroke="currentColor" stroke-width="4.5" fill="none"/></svg>';
    modBtn.appendChild(mk);
    modBtn.appendChild(el('small', null, 'ちいさい'));
    modBtn.setAttribute('aria-label', 'てんてん・まる・ちいさい じ');
    var delBtn = btn('kp-act kp-del', function () {
      if (!can()) return;
      tap('del');
      model.back();
      changed();
    });
    delBtn.appendChild(el('b', null, 'けす'));
    delBtn.setAttribute('aria-label', '1もじ けす');
    var okBtn = btn('kp-act kp-ok', function () {
      if (!can()) return;
      model.closeRow();
      paint();
      if (typeof opts.onSubmit === 'function') opts.onSubmit(model.value);
    });
    okBtn.appendChild(el('b', null, 'こたえる'));
    acts.appendChild(modBtn);
    acts.appendChild(delBtn);
    acts.appendChild(okBtn);
    root.appendChild(acts);

    function paintSlots() {
      var n = model.max || Math.max(1, model.value.length);
      var s = shown ? shown.s : model.value;
      if (slots.children.length !== n) {
        slots.innerHTML = '';
        for (var j = 0; j < n; j++) slots.appendChild(el('span', 'kp-slot'));
      }
      for (var k = 0; k < n; k++) {
        var box = slots.children[k];
        box.textContent = s.charAt(k) || '';
        box.className = 'kp-slot' + (s.charAt(k) ? ' filled' : '') +
          (!shown && k === model.value.length && !model.isFull() ? ' next' : '') +
          (shown && shown.cls ? ' ' + shown.cls : '');
      }
      slots.setAttribute('aria-label', 'こたえ ' + (s || 'なし'));
    }
    function paint() {
      var r = rowById(model.row);
      rowBtns.forEach(function (d) {
        var on = d.id === model.row;
        d.el.classList.toggle('on', on);
        d.el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      charsBox.classList.toggle('open', !!r);
      for (var c = 0; c < charBtns.length; c++) {
        var ch = r ? r.chars.charAt(c) : '';
        charBtns[c].textContent = ch;
        charBtns[c].hidden = !ch;
        charBtns[c].setAttribute('aria-label', ch);
      }
      hint.hidden = !!r;
      modBtn.disabled = false;
      root.classList.toggle('locked', locked);
      paintSlots();
    }

    var ctrl = {
      el: root, slots: slots, model: model,
      setMax: function (n) { model.setMax(n); paint(); },
      reset: function (n) { model.clear(); if (n != null) model.setMax(n); shown = null; locked = false; paint(); },
      // 答えを枠に見せる（cls: 'right' / 'reveal'）。見せているあいだは押せない
      showAnswer: function (s, cls) { shown = { s: String(s), cls: cls || '' }; locked = true; paint(); },
      lock: function (on) { locked = !!on; paint(); },
      paint: paint
    };
    paint();
    return ctrl;
  }

  C.kanaPad = { ROWS: ROWS, cycle: cycle, rowById: rowById, Model: Model, render: render };
})();
