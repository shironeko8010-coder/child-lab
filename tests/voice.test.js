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
  C.test("voice.numToKana: 数字を ひらがなの読みにする", function () {
    var V = C.voice;
    C.assertEq(V.numToKana(10), "じゅう");
    C.assertEq(V.numToKana(1), "いち");
    C.assertEq(V.numToKana(12), "じゅうに");
    C.assertEq(V.numToKana(81), "はちじゅういち");
    C.assertEq(V.numToKana(100), "ひゃく");
    C.assertEq(V.numToKana(198), "ひゃくきゅうじゅうはち");
    C.assertEq(V.numToKana(300), "さんびゃく");
    C.assertEq(V.numToKana(3000), "さんぜん");
    C.assertEq(V.kanaNumbers("こたえは 12 だよ"), "こたえは じゅうに だよ");
    C.assertEq(V.kanaNumbers("すごい！ 5もん"), "すごい！ ごもん");
  });
  C.test("kazu: 「○こ」の読みは かなで、10 は じゅっこ", function () {
    C.assertEq(C.kazu.KO_YOMI[10], "じゅっこ");
    C.assertEq(C.kazu.KO_YOMI.slice(1).every(function (s) { return /^[ぁ-ゖ]+$/.test(s); }), true);
  });

  /* ---------- 音声ファイル（ずんだもん） ---------- */
  function fakeTts(spoken) {
    return {
      speak: function (u) { spoken.push(u.text); setTimeout(function () { if (u.onend) u.onend(); }, 5); },
      cancel: function () {}
    };
  }
  function withClips(clips, okIds, fn) {
    var V = C.voice, played = [], spoken = [];
    V._setSynth(fakeTts(spoken), function (text) { return { text: text }; });
    V._setClips(clips, function (id) { played.push(id); return Promise.resolve(okIds.indexOf(id) >= 0); });
    return Promise.resolve().then(function () { return fn(V, played, spoken); })
      .then(function () { V._enable(); }, function (e) { V._enable(); throw e; });
  }

  C.test('voice.keyOf: ふりがなの記号を取り、空白をつめる', function () {
    C.assertEq(C.voice.keyOf('パパや ママと {話|はな}して みてね。'), 'パパやママと話してみてね。');
    C.assertEq(C.voice.pieces('23たす｜45は？'), ['23たす', '45は？']);
    C.assertEq(C.voice.pieces('すごい！ りんごの、り。'), ['すごい！', 'りんごの、り。']);
  });

  C.test('voice: 音声ファイルがある文は、ファイルを鳴らす（端末の声は使わない）', function () {
    return withClips({ 'せいかい！': 'a1' }, ['a1'], function (V, played, spoken) {
      C.assertEq(V.isAvailable(), true);
      C.assertEq(V.hasClip('せいかい！'), true);
      return V.speak('せいかい！').then(function () {
        C.assertEq(played, ['a1']);
        C.assertEq(spoken, []);
      });
    });
  });

  C.test('voice: 部品（｜）と文の区切りごとに、続けて鳴らす', function () {
    return withClips({ '23たす': 'p1', '45は？': 'p2', 'すごい！': 's1', 'りんごの、り。': 's2' }, ['p1', 'p2', 's1', 's2'], function (V, played) {
      return V.speak('23たす｜45は？').then(function () {
        C.assertEq(played, ['p1', 'p2']);
        return V.speak('すごい！ りんごの、り。');
      }).then(function () { C.assertEq(played, ['p1', 'p2', 's1', 's2']); });
    });
  });

  C.test('voice: 部品が1つでも足りなければ、端末の声で全体を読む（｜は読まない）', function () {
    return withClips({ '23たす': 'p1' }, ['p1'], function (V, played, spoken) {
      return V.speak('23たす｜46は？').then(function () {
        C.assertEq(played, []);
        C.assertEq(spoken, [C.voice.kanaNumbers('23たす 46は？')]);
      });
    });
  });

  C.test('voice: 音声ファイルが鳴らせなければ、端末の声で読む', function () {
    return withClips({ 'おしい！': 'x1' }, [], function (V, played, spoken) {
      return V.speak('おしい！').then(function () {
        C.assertEq(played, ['x1']);
        C.assertEq(spoken, ['おしい！']);
      });
    });
  });

  C.test('voice: 名前入りの文など、音声ファイルにない文は端末の声', function () {
    return withClips({ 'せいかい！': 'a1' }, ['a1'], function (V, played, spoken) {
      return V.speak('こんにちは、たろう！').then(function () {
        C.assertEq(played, []);
        C.assertEq(spoken, ['こんにちは、たろう！']);
      });
    });
  });

  C.test('voice: 本物の対応表の音声ファイルは、すべて置いてある', function () {
    var g = self.CHIID_VOICE;
    if (!g || !g.clips) return;   // まだ作っていないとき
    var ids = {}, list = [];
    Object.keys(g.clips).forEach(function (k) { if (!ids[g.clips[k]]) { ids[g.clips[k]] = 1; list.push(g.clips[k]); } });
    // 全部を確かめると重いので、先頭・まん中・最後と、ばらばらに 30件
    var pick = [list[0], list[list.length - 1], list[Math.floor(list.length / 2)]];
    for (var i = 0; i < 27 && list.length; i++) pick.push(list[(i * 7919) % list.length]);
    return Promise.all(pick.map(function (id) {
      return fetch('../' + g.dir + id + g.ext, { method: 'HEAD' }).then(function (r) {
        if (!r.ok) throw new Error('音声ファイルがない: ' + id);
      });
    }));
  });

  C.test('parent: 「このアプリについて」に 音声のクレジット（VOICEVOX:ずんだもん）がある', function () {
    var div = document.createElement('div');
    C.storage._forceMemory(true);
    return C.storage.init().then(function () { C.parent.render(div); C.assertEq(div.textContent.indexOf('音声：VOICEVOX:ずんだもん') >= 0, true); })
      .then(function () { C.storage._forceMemory(false); }, function (e) { C.storage._forceMemory(false); throw e; });
  });

  C.test('voice: アプリが読み上げる文は、すべて音声ファイルがある（tools/voice-lines.js で集めた文）', function () {
    var g = self.CHIID_VOICE;
    if (!g || !g.clips || !window.ChiidVoiceLines) return;
    return window.ChiidVoiceLines.collect().then(function (keys) {
      var miss = keys.filter(function (k) { return !Object.prototype.hasOwnProperty.call(g.clips, k); });
      if (miss.length) throw new Error('音声ファイルがない文 ' + miss.length + '件: ' + miss.slice(0, 5).join(' / '));
    });
  });
})();
