(function () {
  'use strict';
  var C = window.Chiid;

  C.test('voice: 読み上げ機能を無効化しても、speakはすぐresolveし、isAvailableはfalse', function () {
    var V = C.voice;
    V._disable();
    C.assertEq(V.isAvailable(), false);
    var t0 = Date.now();
    return V.speak('あ').then(function () {
      C.assertEq(Date.now() - t0 < 500, true);
      V.cancel(); // 例外を出さない
      return V.speak(''); // 空文字でも例外なし
    }).then(function () {
      V._enable();
    }, function (e) {
      V._enable();
      throw e;
    });
  });

  C.test('voice: 読み上げ機能がある場合、日本語・rate0.85で話し、終了でresolveする', function () {
    var V = C.voice;
    var spoken = [];
    var fake = {
      speak: function (u) { spoken.push(u); setTimeout(function () { if (u.onend) u.onend(); }, 10); },
      cancel: function () {}
    };
    V._setSynth(fake, function (text) { return { text: text }; });
    C.assertEq(V.isAvailable(), true);
    return V.speak('あ').then(function () {
      C.assertEq(spoken.length, 1);
      C.assertEq(spoken[0].lang, 'ja-JP');
      C.assertEq(spoken[0].rate, 0.85);
      C.assertEq(spoken[0].text, 'あ');
      V._enable();
    }, function (e) { V._enable(); throw e; });
  });

  C.test('voice: speak中に例外が出てもrejectせずresolveする', function () {
    var V = C.voice;
    V._setSynth({
      speak: function () { throw new Error('boom'); },
      cancel: function () { throw new Error('boom'); }
    }, function (text) { return { text: text }; });
    return V.speak('い').then(function () {
      V.cancel();
      V._enable();
    }, function (e) { V._enable(); throw e; });
  });
})();
