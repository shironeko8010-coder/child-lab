/* トップ画面（top.js）のテスト。テストのページには汽車の画面が無いので、行き先と「画面が無いときは何もしない」を確かめる */
(function () {
  'use strict';
  var C = window.Chiid;

  C.test('top: 車両の行き先は ちいく・べんきょう の画面', function () {
    C.assertEq(C.top.TARGET.chiiku, 'app-chiiku/index.html');
    C.assertEq(C.top.TARGET.benkyo, 'app-benkyo/index.html');
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
})();
