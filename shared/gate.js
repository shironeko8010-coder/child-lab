/* おとなゲート：計算問題を解けた人だけ親画面に進める。
 * Chiid.gate.makeProblem(rng) / open(onPass, onCancel) / _check / _attempt / _isLocked / _reset */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var MAX_MISS = 3;
  var LOCK_MS = 30000;

  var misses = 0;
  var lockedUntil = 0;
  var cur = null; // 開いているモーダルの状態 {problem, input, done, ...}

  function pick(rng, lo, hi) {
    var n = Math.floor(rng() * (hi - lo + 1)) + lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function makeProblem(rng) {
    rng = rng || Math.random;
    var a = pick(rng, 6, 9), b = pick(rng, 6, 9), c = pick(rng, 11, 19);
    return { question: a + '×' + b + '+' + c, answer: a * b + c };
  }

  function check(problem, input) {
    if (!problem || typeof input !== 'string' || input === '') return false;
    return String(problem.answer) === input;
  }

  function isLocked() {
    if (lockedUntil && Date.now() >= lockedUntil) { lockedUntil = 0; misses = 0; }
    return lockedUntil > Date.now();
  }

  // 採点して状態を更新する（ロック中は常に false）
  function attempt(problem, input) {
    if (isLocked()) return false;
    if (check(problem, input)) { misses = 0; return true; }
    misses++;
    if (misses >= MAX_MISS) { lockedUntil = Date.now() + LOCK_MS; }
    return false;
  }

  function reset() { misses = 0; lockedUntil = 0; }

  /* ---- 見た目 ---- */
  function injectStyle() {
    if (document.getElementById('chiid-gate-style')) return;
    var st = document.createElement('style');
    st.id = 'chiid-gate-style';
    st.textContent =
      '#chiid-gate{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;font-family:var(--font,sans-serif);}' +
      '#chiid-gate .g-box{background:#fff;color:#3a3a3a;border-radius:24px;padding:16px 24px;max-width:96vw;max-height:96vh;overflow:auto;display:flex;flex-direction:row;flex-wrap:wrap;gap:20px;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.3);}' +
      '#chiid-gate .g-info{display:flex;flex-direction:column;gap:10px;align-items:center;min-width:240px;}' +
      '#chiid-gate .g-title{font-size:20px;font-weight:bold;margin:0;}' +
      '#chiid-gate .g-q{font-size:40px;font-weight:bold;margin:0;}' +
      '#chiid-gate .g-in{min-width:200px;min-height:64px;line-height:64px;padding:0 16px;border:3px solid #ff8a3d;border-radius:16px;text-align:center;font-size:40px;font-weight:bold;background:#fff8e7;}' +
      '#chiid-gate .g-msg{min-height:28px;margin:0;font-size:18px;color:#b00020;text-align:center;}' +
      '#chiid-gate .g-pad{display:grid;grid-template-columns:repeat(3,72px);gap:10px;}' +
      '#chiid-gate .g-key{min-width:64px;min-height:64px;width:72px;height:72px;padding:0;border:0;border-radius:16px;background:#ffe3c2;color:#3a3a3a;font-family:inherit;font-size:32px;font-weight:bold;cursor:pointer;box-shadow:0 4px 0 #e0b98a;}' +
      '#chiid-gate .g-key:active{transform:translateY(3px);box-shadow:0 1px 0 #e0b98a;}' +
      '#chiid-gate .g-key.g-del{background:#d8d8d8;box-shadow:0 4px 0 #a8a8a8;font-size:20px;}' +
      '#chiid-gate .g-key.g-ok{background:#ff8a3d;color:#fff;box-shadow:0 4px 0 #e06f20;font-size:20px;}' +
      '#chiid-gate .g-key:disabled{opacity:.5;}' +
      '#chiid-gate .g-cancel{min-height:64px;min-width:64px;padding:0 24px;border:0;border-radius:16px;background:#4cb8c4;color:#fff;font-family:inherit;font-size:20px;font-weight:bold;cursor:pointer;}';
    document.head.appendChild(st);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function close() {
    if (cur && cur.timer) clearInterval(cur.timer);
    if (cur && cur.root && cur.root.parentNode) cur.root.parentNode.removeChild(cur.root);
    cur = null;
  }

  function refresh() {
    if (!cur) return;
    cur.inEl.textContent = cur.input === '' ? '　' : cur.input;
    var locked = isLocked();
    for (var i = 0; i < cur.keys.length; i++) cur.keys[i].disabled = locked;
    if (locked) {
      var sec = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
      cur.msg.textContent = '3回まちがえました。あと ' + sec + ' 秒おまちください。';
    } else if (cur.note) {
      cur.msg.textContent = cur.note;
    } else {
      cur.msg.textContent = '';
    }
  }

  // 「ひらく」：1回だけ採点する（連打対策）
  function submit(input) {
    if (!cur || cur.done) return;
    if (isLocked()) { refresh(); return; }
    // 空のまま押した（「ひらく」の連打で2回目が空になる場合を含む）は、誤答に数えない
    if (typeof input !== 'string' || input === '') {
      cur.note = 'こたえを入力してから「ひらく」を押してください。';
      refresh();
      return;
    }
    var pass = attempt(cur.problem, input);
    if (pass) {
      cur.done = true;
      var cb = cur.onPass;
      close();
      if (typeof cb === 'function') cb();
      return;
    }
    cur.input = '';
    if (isLocked()) {
      cur.note = '';
    } else {
      cur.note = 'ちがいます。もういちど こたえてください。';
      cur.problem = makeProblem(Math.random); // 問題を変える
      cur.qEl.textContent = cur.problem.question + ' = ?';
    }
    refresh();
  }

  function cancel() {
    if (!cur || cur.done) return;
    cur.done = true;
    var cb = cur.onCancel;
    close();
    if (typeof cb === 'function') cb();
  }

  function open(onPass, onCancel) {
    if (cur) close();
    injectStyle();
    var root = el('div'); root.id = 'chiid-gate';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    var box = el('div', 'g-box');
    var info = el('div', 'g-info');
    info.appendChild(el('p', 'g-title', 'おとなの方へ：計算の答えを入力してください'));
    var qEl = el('p', 'g-q');
    var inEl = el('div', 'g-in');
    var msg = el('p', 'g-msg');
    msg.setAttribute('aria-live', 'polite');
    var cancelBtn = el('button', 'g-cancel', 'もどる');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', cancel);
    info.appendChild(qEl); info.appendChild(inEl); info.appendChild(msg); info.appendChild(cancelBtn);

    var pad = el('div', 'g-pad');
    var keys = [];
    function addKey(label, cls, fn) {
      var b = el('button', 'g-key' + (cls ? ' ' + cls : ''), label);
      b.type = 'button';
      b.addEventListener('click', fn);
      pad.appendChild(b);
      keys.push(b);
      return b;
    }
    function digit(d) {
      return function () {
        if (!cur || cur.done || isLocked()) return;
        if (cur.input.length < 4) { cur.input += d; cur.note = ''; refresh(); }
      };
    }
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (d) { addKey(String(d), '', digit(String(d))); });
    addKey('けす', 'g-del', function () {
      if (!cur || cur.done) return;
      cur.input = cur.input.slice(0, -1); refresh();
    });
    addKey('0', '', digit('0'));
    addKey('ひらく', 'g-ok', function () { if (cur) submit(cur.input); });

    box.appendChild(info); box.appendChild(pad); root.appendChild(box);
    document.body.appendChild(root);

    var problem = makeProblem(Math.random);
    cur = { root: root, qEl: qEl, inEl: inEl, msg: msg, keys: keys, problem: problem,
            input: '', note: '', done: false, onPass: onPass, onCancel: onCancel, timer: null };
    qEl.textContent = problem.question + ' = ?';
    cur.timer = setInterval(refresh, 500); // ロック残り秒の更新・解除
    refresh();
  }

  C.gate = {
    makeProblem: makeProblem,
    open: open,
    _check: check,
    _attempt: attempt,
    _isLocked: isLocked,
    _reset: function () { reset(); if (cur) close(); },
    _current: function () { return cur ? cur.problem : null; },
    _submit: function (input) { submit(input); }
  };
})();
