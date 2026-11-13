/* shared/core.js のテスト */
(function () {
  'use strict';
  var C = window.Chiid;

  C.test('core: --vh は 見えている高さ（innerHeight）の 1%', function () {
    var v = document.documentElement.style.getPropertyValue('--vh');
    C.assertEq(v, (window.innerHeight / 100) + 'px');
  });
})();
