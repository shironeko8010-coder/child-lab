/* 親画面：遊んだ日・時間、分野別の正答率、苦手、設定、書き出し、リセット。
   Chiid.parent.summarize(logs, days) / render(container)
   ※ 呼び出し側は、おとなゲートを通ってから render を呼ぶこと。通信は行わない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var AREA_NAMES = { hiragana: 'ひらがな', kuku: 'くく', kukuB: 'くく（□をこたえる）', kazu: 'かず', tokei: 'とけい', iro: 'いろ・かたち', machigai: 'まちがいさがし', keisan: 'けいさん', kanji: 'かんじ（えらぶ）', kanjiYomi: 'かんじ（よみ）', kanjiKaki: 'かんじ（かき）' };
  var LIMIT_CHOICES = [0, 15, 30, 45, 60];

  function summarize(logs, days) {
    logs = logs || [];
    days = days || [];
    var playDays = 0, totalSec = 0;
    days.forEach(function (d) {
      var s = Number(d && d.sec) || 0;
      if (s > 0) { playDays++; totalSec += s; }
    });
    var byArea = {};
    var misses = {};
    var kaki = {}, hasKaki = false;   // かんじの書き取り（自己採点）で「もういっかい」になった字
    logs.forEach(function (e) {
      if (!e) return;
      var a = e.area || 'unknown';
      if (!byArea[a]) byArea[a] = { total: 0, correct: 0, rate: 0 };
      byArea[a].total++;
      if (e.correct) byArea[a].correct++;
      else misses[e.itemId] = (misses[e.itemId] || 0) + 1;
      if (a === 'kanjiKaki') {
        hasKaki = true;
        if (!e.correct) { var k = String(e.itemId).split('（')[0]; kaki[k] = (kaki[k] || 0) + 1; }
      }
    });
    Object.keys(byArea).forEach(function (a) {
      byArea[a].rate = byArea[a].total ? byArea[a].correct / byArea[a].total : 0;
    });
    var weak = Object.keys(misses).map(function (id) { return { itemId: id, misses: misses[id] }; });
    weak.sort(function (x, y) { return y.misses - x.misses || (x.itemId < y.itemId ? -1 : x.itemId > y.itemId ? 1 : 0); });
    var kakiMiss = Object.keys(kaki).map(function (k) { return { k: k, misses: kaki[k] }; });
    kakiMiss.sort(function (x, y) { return y.misses - x.misses || (x.k < y.k ? -1 : x.k > y.k ? 1 : 0); });
    return { playDays: playDays, totalMin: Math.round(totalSec / 60), byArea: byArea, weak: weak.slice(0, 5),
             hasKaki: hasKaki, kakiMiss: kakiMiss.slice(0, 20) };
  }

  /* ---- 見た目 ---- */
  function injectStyle() {
    if (document.getElementById('chiid-parent-style')) return;
    var st = document.createElement('style');
    st.id = 'chiid-parent-style';
    st.textContent =
      '.parent-view{max-width:960px;margin:0 auto;padding:16px 24px;font-size:20px;display:flex;flex-direction:column;gap:16px;}' +
      '.parent-view h2{font-size:28px;margin:0;}' +
      '.parent-view h3{font-size:22px;margin:0 0 8px;}' +
      '.parent-view .p-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;}' +
      '.parent-view .p-btn{min-width:64px;min-height:64px;padding:8px 20px;border:0;border-radius:16px;background:var(--c-soft,#ffe3c2);color:var(--c-text,#3a3a3a);font-family:inherit;font-size:20px;font-weight:bold;cursor:pointer;box-shadow:0 4px 0 #e0b98a;}' +
      '.parent-view .p-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #e0b98a;}' +
      '.parent-view .p-btn.on{background:var(--c-primary,#ff8a3d);color:#fff;box-shadow:0 4px 0 var(--c-primary-dark,#e06f20);}' +
      '.parent-view .p-btn.danger{background:#e57373;color:#fff;box-shadow:0 4px 0 #b24b4b;}' +
      '.parent-view .p-stat{font-size:32px;font-weight:bold;}' +
      '.parent-view table{border-collapse:collapse;width:100%;}' +
      '.parent-view th,.parent-view td{text-align:left;padding:8px 12px;border-bottom:1px solid #eee;}' +
      '.parent-view .p-note{font-size:16px;color:#777;margin:0;}' +
      '.parent-view .p-item{white-space:nowrap;}' +
      '#chiid-parent-confirm{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;font-family:var(--font,sans-serif);}' +
      '#chiid-parent-confirm .c-box{background:#fff;color:#3a3a3a;border-radius:24px;padding:24px;max-width:560px;display:flex;flex-direction:column;gap:16px;}' +
      '#chiid-parent-confirm p{margin:0;font-size:20px;}';
    document.head.appendChild(st);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(label, cls, fn) {
    var b = el('button', 'p-btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function card(title) {
    var c = el('section', 'card');
    c.appendChild(el('h3', null, title));
    return c;
  }
  function limitLabel(m) { return m === 0 ? '制限なし' : m + '分'; }
  function pct(r) { return Math.round(r * 100) + '%'; }

  function confirmDialog(message, okLabel, onOk) {
    var old = document.getElementById('chiid-parent-confirm');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var root = el('div'); root.id = 'chiid-parent-confirm';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    var box = el('div', 'c-box');
    box.appendChild(el('p', null, message));
    var row = el('div', 'p-row');
    function close() { if (root.parentNode) root.parentNode.removeChild(root); }
    var cancel = button('やめる', '', close);
    var ok = button(okLabel, 'danger', function () { close(); onOk(); });
    // .p-btn は .parent-view 配下でしか効かないため、直接指定する
    [cancel, ok].forEach(function (b) {
      b.style.cssText = 'min-width:64px;min-height:64px;padding:8px 20px;border:0;border-radius:16px;font-family:inherit;font-size:20px;font-weight:bold;cursor:pointer;';
    });
    cancel.style.background = '#d8d8d8'; cancel.style.color = '#3a3a3a';
    ok.style.background = '#e57373'; ok.style.color = '#fff';
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(row);
    root.appendChild(box);
    document.body.appendChild(root);
  }

  function download(text, filename) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function render(container) {
    injectStyle();
    var S = C.storage;
    var profiles = S.listProfiles();
    var active = S.getActive();
    var pid = active ? active.id : (profiles[0] ? profiles[0].id : null);
    var settings = S.getSettings();

    var view = el('div', 'parent-view');
    view.appendChild(el('h2', null, 'おとなの方へ：学習のようす'));

    // プロフィール切替
    var cp = card('プロフィール');
    var rp = el('div', 'p-row');
    if (!profiles.length) rp.appendChild(el('p', 'p-note', 'まだプロフィールがありません。'));
    profiles.forEach(function (p) {
      var KIND_NAMES = { chiiku: "知育", benkyo: "勉強" };
      var label = p.nickname + (KIND_NAMES[p.kind] ? "（" + KIND_NAMES[p.kind] + "）" : "");
      rp.appendChild(button(label, p.id === pid ? 'on' : '', function () {
        S.setActive(p.id); render(container);
      }));
    });
    cp.appendChild(rp);
    view.appendChild(cp);

    // 集計（非同期でログを読む）
    var cs = card('遊んだ日と時間');
    var ca = card('分野ごとの正答率');
    var cw = card('にがてな もじ・もんだい');
    cs.appendChild(el('p', 'p-note', '読み込み中...'));
    view.appendChild(cs); view.appendChild(ca); view.appendChild(cw);

    function fill(sum) {
      cs.innerHTML = ''; cs.appendChild(el('h3', null, '遊んだ日と時間'));
      var r = el('div', 'p-row');
      r.appendChild(el('span', 'p-stat', '遊んだ日：' + sum.playDays + '日'));
      r.appendChild(el('span', 'p-stat', '合計：' + sum.totalMin + '分'));
      cs.appendChild(r);

      ca.innerHTML = ''; ca.appendChild(el('h3', null, '分野ごとの正答率'));
      var areas = Object.keys(sum.byArea);
      if (!areas.length) ca.appendChild(el('p', 'p-note', 'まだ記録がありません。'));
      else {
        var t = el('table');
        var hr = el('tr');
        ['分野', '回答数', '正解数', '正答率'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
        t.appendChild(hr);
        areas.forEach(function (a) {
          var s = sum.byArea[a], tr = el('tr');
          [AREA_NAMES[a] || a, String(s.total), String(s.correct), pct(s.rate)].forEach(function (v) { tr.appendChild(el('td', null, v)); });
          t.appendChild(tr);
        });
        ca.appendChild(t);
      }

      cw.innerHTML = ''; cw.appendChild(el('h3', null, 'にがてな もじ・もんだい'));
      if (!sum.weak.length) cw.appendChild(el('p', 'p-note', 'まちがいの記録はありません。'));
      else {
        var t2 = el('table');
        var h2 = el('tr');
        ['もじ・もんだい', 'まちがえた回数'].forEach(function (h) { h2.appendChild(el('th', null, h)); });
        t2.appendChild(h2);
        sum.weak.forEach(function (w) {
          var tr = el('tr');
          tr.appendChild(el('td', 'p-item', w.itemId));   // '3×4' のような式も1行で
          tr.appendChild(el('td', null, w.misses + '回'));
          t2.appendChild(tr);
        });
        cw.appendChild(t2);
      }
      // かんじの書き取り：書けなかった字（記録があるときだけ出す）
      if (sum.hasKaki) {
        var ck = card('かけなかった かんじ');
        if (!sum.kakiMiss.length) ck.appendChild(el('p', 'p-note', 'まだ ありません。'));
        else ck.appendChild(el('p', 'p-stat', sum.kakiMiss.map(function (w) { return w.k + ' ' + w.misses + 'かい'; }).join('・')));
        ck.appendChild(el('p', 'p-note', '書き取りで、お子さんが「もういっかい」を選んだ字（多い順・最大20字）'));
        if (cw.nextSibling) view.insertBefore(ck, cw.nextSibling); else view.appendChild(ck);
      }
    }

    if (pid === null) {
      fill(summarize([], []));
    } else {
      var days = S.listPlayDays(pid);
      Promise.resolve(S.getLogs(pid)).then(function (logs) { return logs; }, function () { return []; })
        .then(function (logs) { fill(summarize(logs, days)); });
    }

    // 設定
    var cset = card('設定');
    cset.appendChild(el('p', null, '1日の遊ぶ時間の目安'));
    var rl = el('div', 'p-row');
    LIMIT_CHOICES.forEach(function (m) {
      rl.appendChild(button(limitLabel(m), m === settings.dailyLimitMin ? 'on' : '', function () {
        S.setSettings({ dailyLimitMin: m }); render(container);
      }));
    });
    cset.appendChild(rl);
    var rs = el('div', 'p-row');
    rs.style.marginTop = '12px';
    rs.appendChild(button('BGM：' + (settings.bgmOn ? 'ON' : 'OFF'), settings.bgmOn ? 'on' : '', function () {
      var v = !S.getSettings().bgmOn;
      S.setSettings({ bgmOn: v });
      if (C.sfx && C.sfx.setBgmOn) C.sfx.setBgmOn(v);
      render(container);
    }));
    rs.appendChild(button('効果音：' + (settings.sfxOn ? 'ON' : 'OFF'), settings.sfxOn ? 'on' : '', function () {
      var v = !S.getSettings().sfxOn;
      S.setSettings({ sfxOn: v });
      if (C.sfx && C.sfx.setSfxOn) C.sfx.setSfxOn(v);
      render(container);
    }));
    cset.appendChild(rs);
    view.appendChild(cset);

    // データ
    var cd = card('データ');
    cd.appendChild(el('p', 'p-note', '書き出しは、この端末にファイルとして保存するだけで、通信はしません。'));
    var rd = el('div', 'p-row');
    var msg = el('p', 'p-note', '');
    rd.appendChild(button('データを書き出す', '', function () {
      S.exportAll().then(function (text) {
        download(text, 'chiid-export-' + today() + '.json');
        msg.textContent = '書き出しました。';
      }, function () { msg.textContent = '書き出せませんでした。'; });
    }));
    rd.appendChild(button('すべてリセット', 'danger', function () {
      confirmDialog('すべての記録（プロフィール・学習記録・設定）が消えます。元に戻せません。本当にリセットしますか？',
        'つぎへ（おとなゲート）', function () {
          C.gate.open(function () {
            // 利用時間の計測を止めてから消す（止めないと、消したプロフィールの利用秒数が10秒後に書き戻される）
            try { if (C.timer && C.timer.stop) C.timer.stop(); } catch (e) { /* 無視 */ }
            Promise.resolve(S.resetAll()).then(function () { render(container); });
          });
        });
    }));
    cd.appendChild(rd);
    cd.appendChild(msg);
    view.appendChild(cd);

    container.innerHTML = '';
    container.appendChild(view);
  }

  C.parent = { summarize: summarize, render: render };
})();
