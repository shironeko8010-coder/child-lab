(function () {
  'use strict';
  var C = window.Chiid;

  // 偽の時計：t.ms を進めて使う。タイマー（setInterval）は何もしない偽物に差し替える。
  function setup(limitMin, startDate) {
    var S = C.storage;
    S._forceMemory(true);
    return S.init().then(function () { return S.resetAll(); }).then(function () {
      var id = S.addProfile('たろう', 'chiiku');
      S.setSettings({ dailyLimitMin: limitMin });
      var t = { ms: startDate.getTime() };
      var clock = { t: t, now: function () { return new Date(t.ms); } };
      C.timer.stop();
      C.timer._setTimers({ setInterval: function () { return 1; }, clearInterval: function () {} });
      C.timer._setVisible(true);
      return { id: id, clock: clock, S: S };
    });
  }
  function done() { C.timer.stop(); C.timer._setTimers(null); C.timer._setVisible(null); C.storage._forceMemory(false); }

  C.test('timer: dailyLimitMin=1 で60秒進めると isOver===true、onOver が1回呼ばれる', function () {
    return setup(1, new Date(2026, 0, 5, 10, 0, 0)).then(function (c) {
      var called = 0;
      C.timer.onOver(function () { called++; });
      C.timer.start(c.id, c.clock.now);
      C.assertEq(C.timer.isOver(c.id), false);
      c.clock.t.ms += 30000; C.timer._tick();
      C.assertEq(C.timer.remainingSec(c.id), 30);
      C.assertEq(C.timer.isOver(c.id), false);
      c.clock.t.ms += 30000; C.timer._tick();
      C.assertEq(C.timer.isOver(c.id), true);
      C.assertEq(C.timer.remainingSec(c.id), 0);
      c.clock.t.ms += 10000; C.timer._tick();
      C.assertEq(called, 1);
      C.assertEq(c.S.getPlaySeconds(c.id, '2026-01-05'), 70);
      done();
    });
  });

  C.test('timer: dailyLimitMin=0 は remainingSec===null、isOver===false', function () {
    return setup(0, new Date(2026, 0, 5, 10, 0, 0)).then(function (c) {
      C.timer.start(c.id, c.clock.now);
      c.clock.t.ms += 3600000; C.timer._tick();
      C.assertEq(C.timer.remainingSec(c.id), null);
      C.assertEq(C.timer.isOver(c.id), false);
      done();
    });
  });

  C.test('timer: 23:59:50 → 00:00:10 をまたぐと別の日に記録される', function () {
    return setup(30, new Date(2026, 0, 5, 23, 59, 50)).then(function (c) {
      C.timer.start(c.id, c.clock.now);
      c.clock.t.ms += 20000; C.timer._tick();
      C.assertEq(c.S.getPlaySeconds(c.id, '2026-01-05'), 10);
      C.assertEq(c.S.getPlaySeconds(c.id, '2026-01-06'), 10);
      done();
    });
  });

  C.test('timer: 画面が隠れている間は数えない', function () {
    return setup(30, new Date(2026, 0, 5, 10, 0, 0)).then(function (c) {
      C.timer.start(c.id, c.clock.now);
      c.clock.t.ms += 10000; C.timer._tick();
      C.timer._setVisible(false);
      c.clock.t.ms += 600000; C.timer._tick();   // 隠れている10分
      C.timer._setVisible(true);
      c.clock.t.ms += 5000; C.timer._tick();
      C.assertEq(c.S.getPlaySeconds(c.id, '2026-01-05'), 15);
      done();
    });
  });

  C.test('timer: stop 後は数えない／別の日の合計は独立', function () {
    return setup(30, new Date(2026, 0, 5, 10, 0, 0)).then(function (c) {
      C.timer.start(c.id, c.clock.now);
      c.clock.t.ms += 8000;
      C.timer.stop();                              // stop 時に端数を書き込む
      C.assertEq(c.S.getPlaySeconds(c.id, '2026-01-05'), 8);
      c.clock.t.ms += 60000; C.timer._tick();
      C.assertEq(c.S.getPlaySeconds(c.id, '2026-01-05'), 8);
      C.assertEq(C.timer.remainingSec(c.id), 30 * 60 - 8);
      done();
    });
  });
})();
