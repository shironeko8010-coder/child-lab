/* sfx のテスト */
(function () {
  'use strict';
  var C = window.Chiid;

  C.test('sfx: OFFのとき play は AudioContext を作らない', function () {
    C.sfx._reset();
    C.sfx.setSfxOn(false);
    C.sfx.play('correct');
    C.assertEq(C.sfx._ctxCreated(), false);
    C.assertEq(C.sfx.isSfxOn(), false);
  });

  C.test('sfx: ONで4種の音を呼んでも例外が出ない', function () {
    C.sfx._reset();
    C.sfx.setSfxOn(true);
    ['tap', 'correct', 'oops', 'star'].forEach(function (n) { C.sfx.play(n); });
    C.sfx.play('unknown-name'); // 未知の名前も無視して続行
    C.assertEq(C.sfx.isSfxOn(), true);
  });

  C.test('sfx: startBgm -> stopBgm で isBgmPlaying は false', function () {
    C.sfx._reset();
    C.sfx.setBgmOn(true);
    C.sfx.startBgm();
    C.sfx.stopBgm();
    C.assertEq(C.sfx.isBgmPlaying(), false);
  });

  C.test('sfx: BGMがOFFなら startBgm しても鳴らない', function () {
    C.sfx._reset();
    C.sfx.setBgmOn(false);
    C.sfx.startBgm();
    C.assertEq(C.sfx.isBgmPlaying(), false);
    C.assertEq(C.sfx.isBgmOn(), false);
  });

  C.test('sfx: AudioContext が使えなくても例外を出さない', function () {
    C.sfx._reset();
    C.sfx._disable();
    C.sfx.setSfxOn(true);
    C.sfx.play('tap');
    C.sfx.setBgmOn(true);
    C.sfx.startBgm();
    C.sfx.stopBgm();
    C.assertEq(C.sfx._ctxCreated(), false);
    C.sfx._reset();
  });

  C.test('sfx: duck(true)でBGMゲインの目標が約半分、duck(false)で元に戻る', function () {
    C.sfx._reset();
    C.assertEq(C.sfx._bgmGainTarget(), 1);
    C.sfx.duck(true);
    C.assertEq(C.sfx._bgmGainTarget(), 0.5);
    C.assertEq(C.sfx._isDucked(), true);
    C.sfx.duck(false);
    C.assertEq(C.sfx._bgmGainTarget(), 1);
    C.sfx._reset();
  });

  C.test('sfx: BGMは3曲（ぽかぽか・わくわく・ふわふわ）を この順で流す', function () {
    C.assertEq(C.sfx._songNames().join(','), 'poka,waku,fuwa');
    C.sfx._reset();
    C.assertEq(C.sfx._songIdx(), 0);
  });

  C.test('sfx: どの曲も、拍がそろっていて 時間の順に並び、20秒より長い', function () {
    [0, 1, 2].forEach(function (i) {
      var s = C.sfx._buildSong(i);
      if (!(s.len > 20)) throw new Error(i + ': len ' + s.len);
      for (var k = 1; k < s.ev.length; k++) if (s.ev[k][0] < s.ev[k - 1][0]) throw new Error(i + ': 順番');
      s.ev.forEach(function (e) {
        if (!(e[0] >= 0 && e[0] < s.len)) throw new Error(i + ': 時刻 ' + e[0]);
        if (e[1] !== 'shaker' && !(e[2] > 50 && e[2] < 4000)) throw new Error(i + ': 音の高さ ' + e[2]);
      });
    });
  });

  C.test('sfx: BGM鳴動中にduckしても例外が出ず、_resetでduck解除', function () {
    C.sfx._reset();
    C.sfx.setBgmOn(true);
    C.sfx.startBgm();
    C.sfx.duck(true);
    C.sfx.duck(false);
    C.sfx.duck(true);
    C.sfx._reset();
    C.assertEq(C.sfx._isDucked(), false);
  });

  C.test('sfx: トップの曲（はじまりの うた）は拍がそろい、時間の順に並び、20秒より長い', function () {
    var s = C.sfx._buildTopSong();
    if (!(s.len > 20)) throw new Error('len ' + s.len);
    for (var k = 1; k < s.ev.length; k++) if (s.ev[k][0] < s.ev[k - 1][0]) throw new Error('順番');
    var chug = 0;
    s.ev.forEach(function (e) {
      if (!(e[0] >= 0 && e[0] < s.len)) throw new Error('時刻 ' + e[0]);
      if (e[1] === 'chug') { chug++; return; }
      if (!(e[2] > 50 && e[2] < 4000)) throw new Error('音の高さ ' + e[2]);
    });
    if (!chug) throw new Error('がたん ごとん が無い');
  });

  C.test('sfx: startTopBgm でトップの曲だけ、startBgm で ふだんの3曲に もどる', function () {
    C.sfx._reset();
    C.sfx.setBgmOn(true);
    C.sfx.startTopBgm();
    C.assertEq(C.sfx._listNames().join(','), 'hajimari');
    C.sfx.startBgm();
    C.assertEq(C.sfx._listNames().join(','), 'poka,waku,fuwa');
    C.assertEq(C.sfx.isBgmPlaying(), true);
    C.sfx._reset();
    C.assertEq(C.sfx._listNames().join(','), 'poka,waku,fuwa');
  });

  C.test('sfx: BGMがOFFなら startTopBgm でも鳴らさない', function () {
    C.sfx._reset();
    C.sfx.setBgmOn(false);
    C.sfx.startTopBgm();
    C.assertEq(C.sfx.isBgmPlaying(), false);
    C.sfx._reset();
  });

  C.test('sfx: 汽笛（whistle）を鳴らしても例外が出ない', function () {
    C.sfx._reset();
    C.sfx.play('whistle');
    C.sfx._reset();
  });

  /* トップ画面（ホーム）の専用の曲（MP3）と、英語の声のときの さげかた */
  C.test('sfx: setHomeTrack のあと startBgm で ホームの曲（MP3）、null に もどすと ふだんの曲', function () {
    C.sfx._reset();
    C.sfx.setBgmOn(true);
    C.sfx.setHomeTrack('../shared/bgm/home-chiiku.mp3');
    C.sfx.startBgm();
    C.assertEq(C.sfx._bgmKind(), 'home');
    C.assertEq(/home-chiiku\.mp3$/.test(C.sfx._homeSrc()), true);
    C.assertEq(C.sfx.isBgmPlaying(), true);
    C.sfx.setHomeTrack(null);          // ホームを はなれた（ほかの画面）
    C.assertEq(C.sfx._bgmKind(), 'songs');
    C.assertEq(C.sfx.isBgmPlaying(), true);
    C.sfx.stopBgm();
    C.assertEq(C.sfx._bgmKind(), '');
    C.sfx._reset();
  });
  C.test('sfx: BGMがOFFなら ホームの曲も鳴らさない', function () {
    C.sfx._reset();
    C.sfx.setBgmOn(false);
    C.sfx.setHomeTrack('../shared/bgm/home-benkyo.mp3');
    C.sfx.startBgm();
    C.assertEq(C.sfx._bgmKind(), '');
    C.assertEq(C.sfx.isBgmPlaying(), false);
    C.sfx._reset();
  });
  C.test('sfx: ホームの曲を流しているときに 曲を かえると 切りかわる', function () {
    C.sfx._reset();
    C.sfx.setBgmOn(true);
    C.sfx.setHomeTrack('../shared/bgm/home-chiiku.mp3'); C.sfx.startBgm();
    C.sfx.setHomeTrack('../shared/bgm/home-benkyo.mp3');
    C.assertEq(/home-benkyo\.mp3$/.test(C.sfx._homeSrc()), true);
    C.assertEq(C.sfx._bgmKind(), 'home');
    C.sfx._reset();
  });
  C.test('sfx: 英語の声のときは BGM を もっと下げる（duck(true, true)）', function () {
    C.sfx._reset();
    C.sfx.duck(true, true);
    C.assertEq(C.sfx._bgmGainTarget(), 0.15);
    C.sfx.duck(false);
    C.assertEq(C.sfx._bgmGainTarget(), 1);
    C.sfx._reset();
  });
  C.test('voiceEn: 英語を読むあいだは BGM を 強く下げる', function () {
    var seen = [], orig = C.sfx.duck;
    C.sfx.duck = function (on, strong) { seen.push([!!on, !!strong]); };
    var fake = { getVoices: function () { return [{ name: 'English', lang: 'en-US', localService: true }]; }, speak: function (u) { setTimeout(function () { u.onend && u.onend(); }, 5); }, cancel: function () {} };
    C.voiceEn._override(fake, { maxMs: 200 });
    return C.voiceEn.speak('apple').then(function () {
      C.sfx.duck = orig; C.voiceEn._override(null);
      C.assertEq(JSON.stringify(seen[0]), JSON.stringify([true, true]));
      C.assertEq(seen[seen.length - 1][0], false);
    }, function (e) { C.sfx.duck = orig; C.voiceEn._override(null); throw e; });
  });
  C.test('sfx: ホームの曲のファイルが 2つある（ちいく・べんきょう）', function () {
    return Promise.all(['../shared/bgm/home-chiiku.mp3', '../shared/bgm/home-benkyo.mp3'].map(function (u) {
      return fetch(u, { method: 'HEAD' }).then(function (r) { C.assertEq(r.ok, true); });
    }));
  });
})();
