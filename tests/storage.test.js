(function () {
  'use strict';
  var C = window.Chiid;

  function scenario(label, forceMemory) {
    C.test('storage(' + label + '): プロフィール・ログ・秒数・書き出し・リセット', function () {
      var S = C.storage;
      S._forceMemory(forceMemory);
      return S.init().then(function () {
        return S.resetAll();
      }).then(function () {
        // 初期値
        C.assertEq(S.getSettings(), { dailyLimitMin: 30, bgmOn: true, sfxOn: true });
        S.setSettings({ dailyLimitMin: 0, bgmOn: false });
        C.assertEq(S.getSettings(), { dailyLimitMin: 0, bgmOn: false, sfxOn: true });
        // プロフィール
        C.assertEq(S.getActive(), null);
        var id = S.addProfile('たろう', 'chiiku');
        C.assertEq(typeof id, 'string');
        C.assertEq(S.listProfiles().length, 1);
        S.setActive(id);
        C.assertEq(S.getActive().nickname, 'たろう');
        C.assertEq(S.getActive().kind, 'chiiku');
        // ログ
        return S.logAnswer({ profileId: id, area: 'hiragana', itemId: 'あ', correct: true, level: 1 })
          .then(function () {
            return S.logAnswer({ profileId: id, area: 'hiragana', itemId: 'い', correct: false, level: 1 });
          }).then(function () {
            return S.getLogs(id);
          }).then(function (logs) {
            C.assertEq(logs.length, 2);
            C.assertEq(typeof logs[0].ts, 'number');
            C.assertEq(logs[0].itemId, 'あ');
            return S.getLogs('other');
          }).then(function (logs) {
            C.assertEq(logs.length, 0);
            // 利用秒数
            S.addPlaySeconds(id, '2026-11-05', 10);
            S.addPlaySeconds(id, '2026-11-05', 15);
            S.addPlaySeconds(id, '2026-11-06', 5);
            C.assertEq(S.getPlaySeconds(id, '2026-11-05'), 25);
            C.assertEq(S.getPlaySeconds(id, '2026-01-01'), 0);
            C.assertEq(S.listPlayDays(id).length, 2);
            return S.exportAll();
          }).then(function (json) {
            C.assertEq(json.indexOf('たろう') >= 0, true);
            C.assertEq(typeof JSON.parse(json), 'object');
            return S.resetAll();
          }).then(function () {
            C.assertEq(S.listProfiles().length, 0);
            C.assertEq(S.getActive(), null);
            C.assertEq(S.getPlaySeconds(id, '2026-11-05'), 0);
            C.assertEq(S.listPlayDays(id).length, 0);
            C.assertEq(S.getSettings(), { dailyLimitMin: 30, bgmOn: true, sfxOn: true });
            return S.getLogs(id);
          }).then(function (logs) {
            C.assertEq(logs.length, 0);
          });
      }).then(function () { S._forceMemory(false); }, function (e) { S._forceMemory(false); throw e; });
    });
  }

  scenario('通常', false);
  scenario('メモリのみ', true);
})();
