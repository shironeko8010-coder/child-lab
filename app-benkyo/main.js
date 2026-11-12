/* 勉強アプリ（小2）の画面の流れ。Chiid.benkyo
   プロフィール作成/選択 → トップ（教科カード）→ 教科 → ごほうび/お休み → おとなゲート → 親画面。
   作りは app-chiiku/game.js と同じ。読み込んだだけでは起動しない（index.html から Chiid.benkyo.start()）。
   通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var KIND = 'benkyo';
  var NAME_MAX = 10;

  // 教科の一覧。教科を足すときは、ここに1行と subjects/ に1ファイル
  var SUBJECTS = [
    { id: "kuku", name: "九九", yomi: "くく", sub: "だんの れんしゅう", enabled: true },
    { id: "kukuB", name: "九九", yomi: "くく", sub: "□を {答|こた}える", enabled: true, kuku: "blank" },
    { id: 'keisan', name: '計算', yomi: 'けいさん', sub: 'たし{算|ざん}・ひき{算|ざん}', enabled: true },
    { id: 'kanji', name: 'かん字', sub: '{読|よ}み・{書|か}き', enabled: true },
    { id: "doutoku", name: "{道|どう}とく", sub: "こんなとき どうする？", enabled: true },
    { id: 'chizuJ', name: '日本の {地図|ちず}', sub: '{県|けん}の {名前|なまえ}と 名ぶつ', enabled: true },
    { id: 'chizuW', name: 'せかいの {国|くに}', sub: '{国|こっ}きと ちず', enabled: true },
    { id: 'nagasa', name: '{長|なが}さ・かさ', sub: 'ものさし・ます', enabled: true },
    { id: 'hantai', name: 'はんたい ことば', sub: '大きい↔小さい', enabled: true },
    { id: 'zukan', name: 'ずかん', sub: 'よんで こたえよう', enabled: true },
    { id: 'eigo', name: 'えい{語|ご}', enabled: false }
  ];
  // 画面の文字は、2年生までに習う漢字を使う（1年生の漢字はそのまま、2年生の漢字は {漢字|よみ} でふりがな）
  function yomiOf(text) { return String(text || '').replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$2'); }

  var app = null;
  var token = 0;           // 画面ごとの番号。古い画面のタイマーやタップを無視する
  var cleanup = [];        // 画面を切り替えるときに外すもの
  var started = false;
  var st = { profileId: null, resting: false };

  /* ---------- 小道具 ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(markup, cls) {
    var w = el('span', cls || 'ico');
    w.innerHTML = markup;
    return w;
  }
  function button(cls, onTap) {
    var b = el('button', cls);
    b.type = 'button';
    var myToken = token;
    b.addEventListener('click', function (ev) {
      if (myToken !== token) return;   // 前の画面のボタン
      onTap(ev, b);
    });
    return b;
  }
  function later(fn, ms) {
    var myToken = token;
    var h = setTimeout(function () { if (myToken === token) fn(); }, ms);
    cleanup.push(function () { clearTimeout(h); });
  }
  // ふりがな付きの文字（<ruby>）
  function ruby(text, yomi) {
    var r = el('ruby');
    r.appendChild(document.createTextNode(text));
    r.appendChild(el('rt', null, yomi));
    return r;
  }
  // {漢字|よみ} の入った文を、ふりがな付きで node に入れる（2年生の漢字に使う）
  function fillR(node, text) {
    var re = /\{([^|{}]+)\|([^|{}]+)\}/g, last = 0, m;
    text = String(text == null ? '' : text);
    node.textContent = '';
    while ((m = re.exec(text))) {
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      node.appendChild(ruby(m[1], m[2]));
      last = re.lastIndex;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
    return node;
  }
  function elR(tag, cls, text) { return fillR(el(tag, cls), text); }
  function speak(text) {
    try { return C.voice.speak(text); } catch (e) { return Promise.resolve(); }
  }
  function play(name) { try { C.sfx.play(name); } catch (e) { /* 音なしでも続ける */ } }

  function newScreen(name) {
    token++;
    cleanup.forEach(function (f) { try { f(); } catch (e) {} });
    cleanup = [];
    try { C.voice.cancel(); } catch (e) {}
    app.innerHTML = '';
    app.className = 'app scr-' + name;
    try { window.scrollTo(0, 0); } catch (e) {}
    return app;
  }

  /* ---------- 絵（SVG） ---------- */
  // キャラクター「ぴよ」。mood: 'normal' | 'happy' | 'think' | 'sleep'
  function chara(mood) {
    var eyes;
    if (mood === 'happy') {
      eyes = '<path d="M38 50 q6 -8 12 0" class="c-line"/><path d="M70 50 q6 -8 12 0" class="c-line"/>';
    } else if (mood === 'sleep') {
      eyes = '<path d="M37 50 q7 6 14 0" class="c-line"/><path d="M69 50 q7 6 14 0" class="c-line"/>';
    } else {
      eyes = '<circle cx="44" cy="50" r="6" fill="#3a3a3a"/><circle cx="76" cy="50" r="6" fill="#3a3a3a"/>' +
             '<circle cx="46" cy="47" r="2" fill="#fff"/><circle cx="78" cy="47" r="2" fill="#fff"/>';
    }
    var mouth = mood === 'happy'
      ? '<path d="M52 64 L68 64 L60 76 Z" fill="#ff8a3d"/>'
      : '<path d="M53 62 L67 62 L60 71 Z" fill="#ff8a3d"/>';
    var zzz = mood === 'sleep'
      ? '<path d="M94 14 h10 l-10 11 h10" class="c-z"/><path d="M108 2 h7 l-7 8 h7" class="c-z small"/>' : '';
    return svg(
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
        '<ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(0,0,0,.08)"/>' +
        '<path d="M58 14 q-6 -12 4 -12 q-2 6 4 8" fill="#ffc21a"/>' +
        '<ellipse cx="60" cy="62" rx="44" ry="46" fill="#ffd84d"/>' +
        '<ellipse cx="60" cy="74" rx="28" ry="26" fill="#fff0b3"/>' +
        '<path d="M16 66 q-12 8 -4 20 q8 -2 10 -10 Z" fill="#ffc21a" class="c-wing-l"/>' +
        '<path d="M104 66 q12 8 4 20 q-8 -2 -10 -10 Z" fill="#ffc21a" class="c-wing-r"/>' +
        eyes +
        '<ellipse cx="32" cy="64" rx="7" ry="4.5" fill="#ff9fb0" opacity=".8"/>' +
        '<ellipse cx="88" cy="64" rx="7" ry="4.5" fill="#ff9fb0" opacity=".8"/>' +
        mouth +
        '<path d="M46 106 l-4 8 M50 106 l0 8 M70 106 l0 8 M74 106 l4 8" stroke="#ff8a3d" stroke-width="3" stroke-linecap="round"/>' +
        zzz +
      '</svg>', 'chara chara-' + (mood || 'normal'));
  }
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.3 7 1-5 4.9 1.2 6.9L12 17.6l-6.3 3.3 1.2-6.9-5-4.9 7-1z" fill="#ffd23f" stroke="#f0a800" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  var ICO = {
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3v11.3A3.5 3.5 0 1 0 11 17V8h7V3z"/></svg>',
    noteOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3v11.3A3.5 3.5 0 1 0 11 17V8h7V3z" opacity=".45"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3l9 8h-3v9h-4.5v-6h-3v6H6v-9H3z"/></svg>',
    entry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l12.5-7.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 4.5v15L15 12zM16 4.5h3v15h-3z"/></svg>'
  };
  // 教科カードの絵（文字は使わず、記号を線でかく）
  var SUBJECT_ICO = {
    kuku: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#e3eefa"/><path d="M14 14l20 20M34 14L14 34" stroke="#2f6fb0" stroke-width="5" stroke-linecap="round"/></svg>',
    kukuB: "<svg viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"42\" height=\"42\" rx=\"10\" fill=\"#e3eefa\"/><path d=\"M9 17l10 10M19 17L9 27\" stroke=\"#2f6fb0\" stroke-width=\"4\" stroke-linecap=\"round\"/><rect x=\"25\" y=\"14\" width=\"15\" height=\"15\" rx=\"3\" fill=\"#fff\" stroke=\"#2f6fb0\" stroke-width=\"3\" stroke-dasharray=\"4 3\"/><path d=\"M10 37h28\" stroke=\"#2f6fb0\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",
    keisan: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#e6f3ee"/><path d="M14 17h12M20 11v12M24 33h12" stroke="#3f8f74" stroke-width="4.5" stroke-linecap="round"/></svg>',
    kanji: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#f6ece4"/><rect x="11" y="11" width="26" height="26" rx="3" fill="#fff" stroke="#a0673d" stroke-width="3"/><path d="M24 13v22M13 24h22" stroke="#d2b49c" stroke-width="2" stroke-dasharray="3 3"/><path d="M17 19q7 1 14 -1M23 15q2 12 -6 18" stroke="#a0673d" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>',
    doutoku: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#fbeaf0"/><path d="M24 37C11 29 9 20 14 15c4-4 8-2 10 2 2-4 6-6 10-2 5 5 3 14-10 22z" fill="#ff8fb1" stroke="#d9587f" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    chizuJ: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#e4f2fb"/><path d="M34 8l4 3-2 5-5 1-1-4zM30 18l3 4-2 6-4 4-5 2-4 4-5 1-3-2 4-3 5-2 4-4 3-5zM12 38l3 1-1 3-3-1z" fill="#7cc28a" stroke="#3f8f5a" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    chizuW: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#e2f2f7"/><circle cx="24" cy="24" r="15" fill="#9ad4ea" stroke="#2f7fa0" stroke-width="3"/><path d="M15 17c4 0 5 3 9 3s3 5 0 6-2 6-6 6c-1-4-4-5-4-9z M28 13c3 0 6 2 7 5-3 1-4 4-7 3-1-3-3-5 0-8z M30 28c3-1 5 1 5 3-1 3-3 4-5 4-1-3-2-5 0-7z" fill="#6fbf73"/><path d="M9 24h30M24 9c-6 8-6 22 0 30M24 9c6 8 6 22 0 30" stroke="#2f7fa0" stroke-width="1.5" fill="none" opacity=".55"/></svg>',
    nagasa: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#fdf0d5"/><rect x="6" y="20" width="36" height="14" rx="2" fill="#f6c871" stroke="#a5701a" stroke-width="2"/><path d="M10 20v6M14 20v4M18 20v6M22 20v4M26 20v6M30 20v4M34 20v6M38 20v4" stroke="#6b4508" stroke-width="1.5"/><rect x="8" y="9" width="20" height="7" rx="2" fill="#f4a261"/><path d="M32 30h8v10h-8z" fill="#9fd3f2" stroke="#1d5f8c" stroke-width="1.5"/></svg>',
    hantai: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#e8f0fe"/><path d="M10 17h26" stroke="#e2483d" stroke-width="4" stroke-linecap="round"/><path d="M30 10l7 7-7 7" fill="none" stroke="#e2483d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 31H12" stroke="#2f7fd6" stroke-width="4" stroke-linecap="round"/><path d="M18 24l-7 7 7 7" fill="none" stroke="#2f7fd6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    zukan: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#e8f6ea"/><path d="M24 14 Q16 9 7 11 V37 Q16 35 24 40 Z" fill="#5cb85c"/><path d="M24 14 Q32 9 41 11 V37 Q32 35 24 40 Z" fill="#4cb8c4"/><path d="M24 14 V40" stroke="#fff" stroke-width="2"/><circle cx="15" cy="22" r="3" fill="#fff"/><path d="M29 20h8M29 25h8M29 30h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    eigo: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#efe9f6"/><path d="M11 36l8-24 8 24M14 28h10M31 12v24h6a6 6 0 0 0 0-12h-6" stroke="#6d55a3" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function bubble(text) {
    var b = el('div', 'bubble');
    b.textContent = text;
    return b;
  }

  /* ---------- 上の帯（いえ・おんがく・はぐるま） ---------- */
  function topBar(opts) {
    opts = opts || {};
    var bar = el('div', 'topbar');
    var left = el('div', 'tb-left');
    var right = el('div', 'tb-right');
    if (opts.entry) {
      var en = button('icon-btn', function () { play('tap'); location.href = '../index.html'; });
      en.setAttribute('aria-label', 'アプリを えらびなおす');
      en.appendChild(svg(ICO.entry));
      left.appendChild(en);
    }
    if (opts.home) {
      var h = button('icon-btn', function () { play('tap'); showHome(); });
      h.setAttribute('aria-label', 'トップに もどる');
      h.appendChild(svg(ICO.home));
      left.appendChild(h);
    }
    var bgm = button('icon-btn bgm-btn', function () { toggleBgm(bgm); });
    paintBgm(bgm);
    right.appendChild(bgm);
    if (opts.gear) {
      var g = button('icon-btn gear-btn', function () { openParent(); });
      g.setAttribute('aria-label', 'おとなの せってい');
      g.appendChild(svg(ICO.gear));
      right.appendChild(g);
    }
    bar.appendChild(left);
    bar.appendChild(right);
    return bar;
  }
  function paintBgm(b) {
    var on = C.storage.getSettings().bgmOn;
    b.innerHTML = '';
    b.appendChild(svg(on ? ICO.note : ICO.noteOff));
    b.classList.toggle('off', !on);
    b.setAttribute('aria-label', on ? 'おんがく あり' : 'おんがく なし');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function toggleBgm(b) {
    var v = !C.storage.getSettings().bgmOn;
    C.storage.setSettings({ bgmOn: v });
    C.sfx.setBgmOn(v);
    if (v && !st.resting) C.sfx.startBgm();
    paintBgm(b);
  }

  /* ---------- 音の開始（最初のタップで AudioContext を作る） ---------- */
  var audioReady = false;
  function unlockAudio() {
    if (audioReady) return;
    audioReady = true;
    var s = C.storage.getSettings();
    if (s.sfxOn) play('tap');          // ここで AudioContext ができる
    if (s.bgmOn && !st.resting) { try { C.sfx.startBgm(); } catch (e) {} }
  }
  function applySettings() {
    var s = C.storage.getSettings();
    try { C.sfx.setSfxOn(s.sfxOn); C.sfx.setBgmOn(s.bgmOn); } catch (e) {}
  }

  /* ---------- プロフィール ---------- */
  // 「いま使っているプロフィール」は知育アプリと共有。勉強（kind:'benkyo'）のものだけを使う
  function pickProfile() {
    var a = C.storage.getActive();
    if (a && a.kind === KIND) return a;
    // 前に使っていた勉強の子（知育アプリから戻ったとき、最初の子に戻らないように）
    var last = C.storage.lastOfKind ? C.storage.lastOfKind(KIND) : null;
    if (last) { C.storage.setActive(last.id); return last; }
    var list = C.storage.listProfiles();
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === KIND) { C.storage.setActive(list[i].id); return list[i]; }
    }
    return null;
  }

  function showProfileCreate() {
    newScreen('profile');
    st.profileId = null;
    try { C.timer.stop(); } catch (e) {}
    var box = el('div', 'profile-box card');
    box.appendChild(chara('normal'));
    box.appendChild(elR('h1', 'p-title', '{名前|なまえ}を {教|おし}えてね'));
    var form = el('form', 'p-form');
    var input = el('input', 'p-input');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'なまえ');
    input.placeholder = 'なまえ';
    var msg = el('p', 'p-msg', '');
    var ok = el('button', 'btn-big', 'はじめる');
    ok.type = 'submit';
    var done = false;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (done) return;
      // 日本語入力では maxLength を超えることがあるので、ここでも10文字に切る
      var name = (input.value || '').replace(/^\s+|\s+$/g, '').slice(0, NAME_MAX);
      if (!name) { fillR(msg, '{名前|なまえ}を 入れてね'); input.focus(); return; }
      done = true;
      play('tap');
      var id = C.storage.addProfile(name, KIND);
      C.storage.setActive(id);
      enterProfile({ id: id, nickname: name, kind: KIND });
    });
    form.appendChild(input);
    form.appendChild(ok);
    box.appendChild(form);
    box.appendChild(msg);
    app.appendChild(box);
  }

  function enterProfile(p) {
    st.profileId = p.id;
    try { C.timer.start(p.id); } catch (e) {}
    showHome();
  }

  /* ---------- トップ ---------- */
  function showHome() {
    if (!app) return;
    var p = pickProfile();
    if (!p) { showProfileCreate(); return; }
    if (p.id !== st.profileId) {          // 親画面で切り替えた等
      st.profileId = p.id;
      try { C.timer.start(p.id); } catch (e) {}
    }
    newScreen('home');
    st.resting = false;
    app.appendChild(topBar({ gear: true, entry: true }));
    var body = el('div', 'home-body');
    var left = el('div', 'home-chara');
    left.appendChild(chara('normal'));
    var right = el('div', 'home-main');
    right.appendChild(el('p', 'home-hello', 'こんにちは、' + p.nickname + '！'));
    right.appendChild(elR('h1', 'home-title', '{何|なに}を やる？'));
    var grid = el('div', 'subjects');
    SUBJECTS.forEach(function (s) {
      var card = button('subject-card' + (s.enabled ? '' : ' soon'), function () {
        if (!s.enabled || card.disabled) return;
        card.disabled = true;
        play('tap');
        if (audioReady && C.storage.getSettings().bgmOn) { try { C.sfx.startBgm(); } catch (e) {} }
        openSubject(s.id);
      });
      card.setAttribute('data-subject', s.id);
      if (!s.enabled) {
        card.disabled = true;
        card.setAttribute('aria-disabled', 'true');
        card.setAttribute('aria-label', (s.yomi || yomiOf(s.name)) + '（じゅんびちゅう）');
      } else {
        card.setAttribute('aria-label', s.yomi || yomiOf(s.name));
      }
      card.appendChild(svg(SUBJECT_ICO[s.id] || SUBJECT_ICO.kuku, 'sc-ico'));
      var nm = el('span', 'sc-name');
      if (s.yomi) nm.appendChild(ruby(s.name, s.yomi));
      else fillR(nm, s.name);
      card.appendChild(nm);
      if (s.sub) card.appendChild(elR("span", "sc-sub", s.sub));
      if (!s.enabled) card.appendChild(el('span', 'sc-soon', 'じゅんび中'));
      grid.appendChild(card);
    });
    right.appendChild(grid);
    body.appendChild(left);
    body.appendChild(right);
    app.appendChild(body);
  }

  /* ---------- 教科をひらく ---------- */
  function findSubject(id) {
    for (var i = 0; i < SUBJECTS.length; i++) if (SUBJECTS[i].id === id) return SUBJECTS[i];
    return null;
  }
  function openSubject(id) {
    if (!app) return;
    var s = findSubject(id);
    if (!s || !s.enabled) { showHome(); return; }
    if (checkRest()) return;
    var B = C.benkyo;
    if ((id === "kuku" || id === "kukuB") && B.kukuScreen && typeof B.kukuScreen.show === 'function') {
      try {
        var r = B.kukuScreen.show({ profileId: st.profileId, mode: s.kuku });
        if (r && r.catch) r.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    if (id === 'keisan' && B.keisanScreen && typeof B.keisanScreen.show === 'function') {
      try {
        var rk = B.keisanScreen.show({ profileId: st.profileId });
        if (rk && rk.catch) rk.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    if (id === 'kanji' && B.kanjiScreen && typeof B.kanjiScreen.show === 'function') {
      try {
        var rj = B.kanjiScreen.show({ profileId: st.profileId });
        if (rj && rj.catch) rj.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    if (id === 'doutoku' && B.doutokuScreen && typeof B.doutokuScreen.show === 'function') {
      try {
        var rd = B.doutokuScreen.show({ profileId: st.profileId });
        if (rd && rd.catch) rd.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    if (id === 'chizuJ' && B.japanScreen && typeof B.japanScreen.show === 'function') {
      try {
        var rjp = B.japanScreen.show({ profileId: st.profileId });
        if (rjp && rjp.catch) rjp.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    if (id === 'chizuW' && B.worldScreen && typeof B.worldScreen.show === 'function') {
      try {
        var rw = B.worldScreen.show({ profileId: st.profileId });
        if (rw && rw.catch) rw.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    if (id === 'nagasa' && B.nagasaScreen && typeof B.nagasaScreen.show === 'function') {
      try {
        var rn = B.nagasaScreen.show({ profileId: st.profileId });
        if (rn && rn.catch) rn.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    if (id === 'hantai' && B.hantaiScreen && typeof B.hantaiScreen.show === 'function') {
      try {
        var rh = B.hantaiScreen.show({ profileId: st.profileId });
        if (rh && rh.catch) rh.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    if (id === 'zukan' && B.zukanScreen && typeof B.zukanScreen.show === 'function') {
      try {
        var rz = B.zukanScreen.show({ profileId: st.profileId });
        if (rz && rz.catch) rz.catch(function () { showSoon(s); });
      } catch (e) { showSoon(s); }
      return;
    }
    showSoon(s);   // 画面がまだ無いとき（kuku-screen.js ができるまで）
  }
  function showSoon(s) {
    newScreen('soon');
    app.appendChild(topBar({ home: true }));
    var body = el('div', 'rest-body');
    body.appendChild(chara('think'));
    var msg = el('p', 'rest-msg');
    var t = el('span');
    if (s && s.yomi) t.appendChild(ruby(s.name, s.yomi));
    else fillR(t, s ? s.name : '');
    t.appendChild(document.createTextNode(' は じゅんび中 だよ'));
    msg.appendChild(t);
    msg.appendChild(elR('span', null, 'もう{少|すこ}し まってね'));
    body.appendChild(msg);
    var back = button('btn-big', function () { play('tap'); showHome(); });
    back.appendChild(svg(ICO.home));
    back.appendChild(el('span', null, 'トップへ'));
    body.appendChild(back);
    app.appendChild(body);
  }

  /* ---------- 利用時間 ---------- */
  // 教科画面が、問題と問題のあいだで呼ぶ。超えていたらお休み画面を出して true
  function checkRest() {
    var over = false;
    try { over = C.timer.isOver(st.profileId); } catch (e) { over = false; }
    if (!over) return false;
    if (app) showRest();
    return true;
  }
  function showRest() {
    newScreen('rest');
    st.resting = true;
    try { C.sfx.stopBgm(); } catch (e) {}
    app.appendChild(topBar({ home: true }));
    var body = el('div', 'rest-body');
    body.appendChild(chara('sleep'));
    var msg = el('p', 'rest-msg');
    msg.appendChild(el('span', null, 'きょうは たくさん がんばったね。'));
    msg.appendChild(el('span', null, 'お休みしよう'));
    body.appendChild(msg);
    app.appendChild(body);
    speak('きょうは たくさん がんばったね。 おやすみしよう');
  }

  /* ---------- おとなゲート → 親画面 ---------- */
  function openParent() {
    play('tap');
    C.gate.open(function () { showParent(); }, function () {});
  }
  function showParent() {
    newScreen('parent');
    var head = el('div', 'parent-head');
    var back = button('btn-big secondary', function () { leaveParent(); });
    back.textContent = '← もどる';
    head.appendChild(back);
    app.appendChild(head);
    var box = el('div', 'parent-box');
    app.appendChild(box);
    C.parent.render(box);
  }
  function leaveParent() {
    applySettings();
    var p = pickProfile();
    if (!p) { showProfileCreate(); return; }
    if (p.id !== st.profileId) { enterProfile(p); return; }
    showHome();
  }

  /* ---------- 起動 ---------- */
  function start() {
    if (started) return;
    app = document.getElementById('app');
    if (!app) return;
    started = true;
    ['pointerup', 'touchend', 'keydown'].forEach(function (t) {
      document.addEventListener(t, unlockAudio, true);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { try { C.sfx.stopBgm(); } catch (e) {} }
      else if (audioReady && !st.resting && C.storage.getSettings().bgmOn) { try { C.sfx.startBgm(); } catch (e) {} }
    });
    function after() {
      applySettings();
      var p = pickProfile();
      if (!p) showProfileCreate();
      else enterProfile(p);
    }
    Promise.resolve().then(function () { return C.storage.init(); }).then(after, after);
  }

  var B = (C.benkyo = C.benkyo || {});
  B.SUBJECTS = SUBJECTS;
  B.pickProfile = pickProfile;
  B.start = start;
  B.showHome = showHome;
  B.openSubject = openSubject;
  B.checkRest = checkRest;
  // 教科画面（kuku-screen.js など）が使う共通の部品
  B.ui = {
    el: el, svg: svg, button: button, later: later, ruby: ruby, fillR: fillR, elR: elR, bubble: bubble,
    newScreen: newScreen, chara: chara, topBar: topBar,
    play: play, speak: speak, ICO: ICO, STAR: STAR,
    profileId: function () { return st.profileId; },
    hasApp: function () { return !!app; }   // 起動前（テスト）は false：描画しない
  };
})();
