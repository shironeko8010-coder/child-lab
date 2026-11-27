/* トップ画面（top.js）のテスト。テストのページには汽車の画面が無いので、行き先と「画面が無いときは何もしない」を確かめる */
(function () {
  'use strict';
  var C = window.Chiid;

  C.test('top: 車両の行き先は ちいく・べんきょう の画面', function () {
    C.assertEq(C.top.TARGET.chiiku, 'app-chiiku/index.html');
    C.assertEq(C.top.TARGET.benkyo, 'app-benkyo/index.html');
  });

  C.test('top: アプリの名前は「はてなの きっぷ」、バージョンは 1.36', function () {
    C.assertEq(C.top.APP_NAME, 'はてなの きっぷ');
    C.assertEq(C.top.VERSION, '1.36');
  });

  C.test('top: 画面が無いときは start / go をよんでも 何もしない（音も鳴らさない）', function () {
    C.sfx._reset();
    C.top.start();
    C.top.go('chiiku', null);
    C.assertEq(C.top._state().started, false);
    C.assertEq(C.top._state().going, false);
    C.assertEq(C.sfx.isBgmPlaying(), false);
    C.sfx._reset();
  });
  // ホーム画面に出る名前（manifest.json）と、トップの看板・title が アプリの名前と そろっている
  C.test('top: manifest と トップの看板・title が アプリの名前と同じ', function () {
    if (!/^https?:$/.test(location.protocol)) return;
    return Promise.all([
      fetch('../manifest.json').then(function (r) { return r.json(); }),
      fetch('../index.html').then(function (r) { return r.text(); })
    ]).then(function (res) {
      var m = res[0], doc = new DOMParser().parseFromString(res[1], 'text/html');
      C.assertEq(m.name, C.top.APP_NAME);
      C.assertEq(m.short_name, C.top.APP_NAME);
      C.assertEq(doc.title, C.top.APP_NAME);
      var sign = doc.querySelector('.sign');
      C.assertEq(sign ? sign.textContent.replace(/\s/g, '') : '', C.top.APP_NAME.replace(/\s/g, ''));
    });
  });
})();
