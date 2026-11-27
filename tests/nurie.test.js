/* ぬりえ（知育）のテスト。設計書：docs/superpowers/specs/2026-11-27-chiiku-nurie-design.md */
(function () {
  'use strict';
  var C = window.Chiid;
  function N() { return C.nurie; }
  var PID = 'p-nurie-test';
  function withLogs(logs, fn) {
    var S = C.storage, og = S.getLogs, ol = S.logAnswer, saved = [];
    S.getLogs = function () { return Promise.resolve(logs); };
    S.logAnswer = function (e) { saved.push(e); return Promise.resolve(); };
    return Promise.resolve().then(function () { return fn(saved); }).then(function (v) { S.getLogs = og; S.logAnswer = ol; return v; }, function (e) { S.getLogs = og; S.logAnswer = ol; throw e; });
  }
  function clearWorks(pid) { try { localStorage.removeItem(N().worksKey(pid)); } catch (e) {} }
  // w×h の 線（1）／すき間（0）を 文字で 書く
  function grid(rows) { var m = []; rows.forEach(function (r) { for (var i = 0; i < r.length; i++) m.push(r[i] === '#' ? 1 : 0); }); return Uint8Array.from(m); }
  function count(region) { var n = 0; for (var i = 0; i < region.length; i++) n += region[i]; return n; }

  C.test('nurie: 絵16まい・スタンプ9こ・色12（名前は ひらがな、絵は nurieData に ある）', function () {
    var n = N(), D = C.nurieData;
    C.assertEq(n.PICS.length, 16); C.assertEq(n.STAMPS.length, 9); C.assertEq(n.COLORS.length, 12);
    var bad = [];
    n.PICS.forEach(function (p) { if (!/^[ぁ-ゖー]+$/.test(p.name)) bad.push(p.id + ' 名前'); if (!/^data:image\/png;base64,/.test(D.pics[p.id] || '')) bad.push(p.id + ' 絵'); });
    n.STAMPS.forEach(function (s) { if (!/^[ぁ-ゖー]+$/.test(s.name)) bad.push(s.id + ' 名前'); if (!/^data:image\/png;base64,/.test(D.stamps[s.id] || '')) bad.push(s.id + ' 絵'); });
    n.COLORS.forEach(function (c) { if (!/^[ぁ-ゖー]+$/.test(c.name)) bad.push(c.name); if (!/^#[0-9a-f]{6}$/.test(c.hex)) bad.push(c.hex); });
    if (bad.length) throw new Error(bad.slice(0, 5).join(' / '));
    C.assertEq(n.COLORS.map(function (c) { return c.name; }).indexOf('しろ') >= 0, true);
  });

  C.test('nurie: スタンプの 大きさは 3つ（ちいさい・ふつう・おおきい）、はじめは ふつう', function () {
    var n = N();
    C.assertEq(n.STAMP_SIZES.map(function (s) { return s.name; }), ['ちいさい', 'ふつう', 'おおきい']);
    var px = n.STAMP_SIZES.map(function (s) { return s.px; });
    C.assertEq(px[0] < px[1] && px[1] < px[2], true);
    C.assertEq(px[2] <= n.SIZE / 2, true);
    return withLogs([], function () {
      return n.start(PID).then(function () {
        n._pick('inu');
        C.assertEq(n._state().stampSize, 'm');
        n._setStampSize('l');
        C.assertEq(n._state().stampSize, 'l');
        n._setStampSize('x');                     // ない 大きさは かえない
        C.assertEq(n._state().stampSize, 'l');
      });
    });
  });

  C.test('nurie: スタンプを えらぶと スタンプの道具に、色を えらぶと（スタンプの ときは）ぬる道具に もどる', function () {
    var n = N();
    return withLogs([], function () {
      return n.start(PID).then(function () {
        n._pick('inu');
        C.assertEq(n._state().tool, 'fill');
        n._chooseStamp('niji');
        C.assertEq([n._state().tool, n._state().stamp], ['stamp', 'niji']);
        n._chooseColor('#2f6fd6');
        C.assertEq([n._state().tool, n._state().color], ['fill', '#2f6fd6']);
        n._setTool('brush');
        n._chooseColor('#e2483d');
        C.assertEq([n._state().tool, n._state().color], ['brush', '#e2483d']);   // ふでの ときは ふでの まま
        n._chooseStamp('nai');                                                   // ない スタンプは えらばない
        C.assertEq(n._state().stamp, 'niji');
      });
    });
  });

  C.test('nurie: makeMask は 白に近い点（200以上）だけ すき間、それより こい点は 線', function () {
    var img = { width: 4, height: 1, data: Uint8ClampedArray.from([0, 0, 0, 255, 85, 85, 85, 255, 170, 170, 170, 255, 255, 255, 255, 255]) };
    C.assertEq(Array.from(N().makeMask(img)), [1, 1, 1, 0]);
  });

  C.test('nurie: fillRegion は 線で かこまれた 所だけ（線の下も 少し）。線の上は 近い所、ぬれない所は null', function () {
    var n = N();
    var m = grid([
      '..........',
      '..........',
      '..######..',
      '..#....#..',
      '..#....#..',
      '..#....#..',
      '..######..',
      '..........',
      '..........',
      '..........']);
    var inner = n.fillRegion(m, 10, 10, 5, 4, 0);
    C.assertEq(count(inner), 12);                 // 中の 4×3
    C.assertEq(inner[3 * 10 + 3], 1); C.assertEq(inner[0], 0);
    var withEdge = n.fillRegion(m, 10, 10, 5, 4, 1);
    C.assertEq(withEdge[2 * 10 + 4], 1);          // 線の下も ぬる
    C.assertEq(withEdge[1 * 10 + 4], 0);          // 線の むこうは ぬらない
    var outer = n.fillRegion(m, 10, 10, 0, 0, 0);
    C.assertEq(outer[4 * 10 + 4], 0); C.assertEq(count(outer), 100 - 12 - 18);
    C.assertEq(n.fillRegion(m, 10, 10, 2, 2, 0) !== null, true);   // 線の上 → 近い所
    C.assertEq(n.fillRegion(Uint8Array.from([1, 1, 1, 1]), 2, 2, 0, 0, 0), null);
  });

  C.test('nurie: paintRegion は ぬる所だけ 色を かえる', function () {
    var rgba = new Uint8ClampedArray(3 * 4).fill(255);
    N().paintRegion(rgba, Uint8Array.from([0, 1, 0]), '#e2483d');
    C.assertEq(Array.from(rgba.slice(4, 8)), [226, 72, 61, 255]);
    C.assertEq(Array.from(rgba.slice(0, 4)), [255, 255, 255, 255]);
  });

  C.test('nurie: どの 線の絵も、ぬれる所が いくつも ある（線が つながって いる）', function () {
    var n = N();
    return Promise.all(n.PICS.map(function (p) {
      return n.loadImage(C.nurieData.pics[p.id]).then(function (img) {
        var cv = document.createElement('canvas'); cv.width = n.SIZE; cv.height = n.SIZE;
        var g = cv.getContext('2d'); g.drawImage(img, 0, 0, n.SIZE, n.SIZE);
        var mask = n.makeMask(g.getImageData(0, 0, n.SIZE, n.SIZE));
        var outer = n.fillRegion(mask, n.SIZE, n.SIZE, 2, 2, 0);
        var free = 0; for (var i = 0; i < mask.length; i++) if (!mask[i]) free++;
        // 外がわだけで ぬれる所の ほとんどを しめるなら、線に すき間が あって 中まで もれている
        if (count(outer) > free * 0.9) throw new Error(p.id + ' は 外から 中まで もれる');
      });
    }));
  });

  C.test('nurie: 作品は 新しい順に 20まいまで。プロフィールごとに 分かれる', function () {
    var n = N();
    clearWorks(PID); clearWorks(PID + '2');
    for (var i = 0; i < 22; i++) n.saveWork(PID, { pic: 'inu', at: i, img: 'data:image/jpeg;base64,AA' + i });
    var w = n.loadWorks(PID);
    C.assertEq(w.length, n.MAX_WORKS); C.assertEq(n.MAX_WORKS, 20);
    C.assertEq(w[0].at, 21); C.assertEq(w[19].at, 2);
    C.assertEq(n.loadWorks(PID + '2').length, 0);
    clearWorks(PID);
  });

  C.test('nurie: えらぶ → ぬる → できた で 作品が 1まい ふえ、記録は true', function () {
    var n = N();
    clearWorks(PID);
    return withLogs([], function (saved) {
      return n.start(PID).then(function () {
        C.assertEq(n._state().phase, 'select');
        n._pick('neko');
        C.assertEq(n._state().phase, 'paint'); C.assertEq(n._state().pic, 'neko');
        n._done();
        C.assertEq(n._state().phase, 'done');
        C.assertEq(n.loadWorks(PID).length, 1); C.assertEq(n.loadWorks(PID)[0].pic, 'neko');
        C.assertEq(JSON.stringify([saved[0].area, saved[0].itemId, saved[0].correct]), JSON.stringify(['nurie', 'neko', true]));
        clearWorks(PID);
      });
    });
  });

  C.test('nurie: ホーム・親画面・カードの色・PRECACHE', function () {
    C.assertEq(C.chiikuHome.ORDER.indexOf('nurie') >= 0, true);
    return fetch('../shared/parent.js').then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/nurie: 'ぬりえ'/.test(t), true);
      return fetch('../app-chiiku/app.css');
    }).then(function (r) { return r.text(); }).then(function (t) {
      C.assertEq(/\.hc-nurie \{ background:/.test(t), true);
      return fetch('../sw.js');
    }).then(function (r) { return r.text(); }).then(function (t) {
      ['app-chiiku/nurie.js', 'app-chiiku/nurie-data.js'].forEach(function (f) { if (t.indexOf("'" + f + "'") < 0) throw new Error(f + ' が PRECACHE にない'); });
    });
  });
})();
