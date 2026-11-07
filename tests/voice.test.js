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

  C.test('voice: _pickVoice は localService=false を選ばない', function () {
    var r = C.voice._pickVoice([
      { name: 'Google 日本語', lang: 'ja-JP', localService: false },
      { name: 'English', lang: 'en-US', localService: true }
    ]);
    C.assertEq(r, null);
  });

  C.test('voice: _pickVoice は自然そうな名前を優先する', function () {
    var plain = { name: 'ja-JP-default', lang: 'ja-JP', localService: true };
    var nice = { name: 'Kyoko (Enhanced)', lang: 'ja_JP', localService: true };
    C.assertEq(C.voice._pickVoice([plain, nice]), nice);
    C.assertEq(C.voice._pickVoice([plain]), plain);
  });

  C.test('voice: _pickVoice は候補なし/空で null', function () {
    C.assertEq(C.voice._pickVoice([]), null);
    C.assertEq(C.voice._pickVoice(null), null);
  });

  C.test('voice: speak で duck(true)->終了で duck(false)、pitch1.1、声名を取得できる', function () {
    var V = C.voice;
    var calls = [];
    var orig = C.sfx.duck;
    C.sfx.duck = function (on) { calls.push(on); };
    var voiceObj = { name: 'Otoya', lang: 'ja-JP', localService: true };
    var spoken = [];
    V._setSynth({
      getVoices: function () { return [voiceObj]; },
      speak: function (u) { spoken.push(u); setTimeout(function () { u.onend(); }, 10); },
      cancel: function () {}
    }, function (t) { return { text: t }; });
    function restore() { C.sfx.duck = orig; V._enable(); }
    return V.speak('あ').then(function () {
      C.assertEq(calls[0], true);
      C.assertEq(calls[calls.length - 1], false);
      C.assertEq(spoken[0].pitch, 1.1);
      C.assertEq(spoken[0].voice, voiceObj);
      C.assertEq(V.currentVoiceName(), 'Otoya');
      restore();
    }, function (e) { restore(); throw e; });
  });
})();
