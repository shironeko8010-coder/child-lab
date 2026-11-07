/* ひらがな教材（園児用：ひらがなのみ） */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var ITEMS = [
    { ch: 'あ', word: 'あり', pic: '🐜', row: 1 },
    { ch: 'い', word: 'いぬ', pic: '🐶', row: 1 },
    { ch: 'う', word: 'うさぎ', pic: '🐰', row: 1 },
    { ch: 'え', word: 'えび', pic: '🦐', row: 1 },
    { ch: 'お', word: 'おに', pic: '👹', row: 1 },
    { ch: 'か', word: 'かに', pic: '🦀', row: 2 },
    { ch: 'き', word: 'きりん', pic: '🦒', row: 2 },
    { ch: 'く', word: 'くま', pic: '🐻', row: 2 },
    { ch: 'け', word: 'けーき', pic: '🍰', row: 2 },
    { ch: 'こ', word: 'こあら', pic: '🐨', row: 2 }
  ];
  function levelConfig(level) {
    var all = ITEMS.map(function (it) { return it.ch; });
    var row1 = ITEMS.filter(function (it) { return it.row === 1; }).map(function (it) { return it.ch; });
    if (level <= 1) return { pool: row1, choices: 3 };
    if (level === 2) return { pool: all, choices: 3 };
    return { pool: all, choices: 4 };
  }
  C.hira = { ITEMS: ITEMS, levelConfig: levelConfig };
})();
