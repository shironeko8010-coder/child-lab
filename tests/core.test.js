/* shared/core.js のテスト */
(function () {
  'use strict';
  var C = window.Chiid;

  C.test('core: --vh は 見えている高さ（innerHeight）の 1%', function () {
    window.dispatchEvent(new Event('resize'));   // 開いてから窓の高さが変わっていても、いまの高さで比べる
    var v = document.documentElement.style.getPropertyValue('--vh');
    C.assertEq(v, (window.innerHeight / 100) + 'px');
  });
})();
