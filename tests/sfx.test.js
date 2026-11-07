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
})();
