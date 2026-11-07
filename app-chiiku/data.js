/* ひらがな教材（園児用：ひらがなのみ）。基本46字。
   word は、先頭の字が ch になる言葉。例外は「を」「ん」の2字だけ
   （「を」「ん」で始まる言葉がないため、言葉の途中・最後に ch が入る）。
   pic は Unicode 12（2019年）以前の絵文字だけを使う（古い端末で□にならないように）。
   row は 行（あ行=1 … わ行=10）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var ITEMS = [
    // あ行
    { ch: 'あ', word: 'あり', pic: '🐜', row: 1 },
    { ch: 'い', word: 'いぬ', pic: '🐶', row: 1 },
    { ch: 'う', word: 'うさぎ', pic: '🐰', row: 1 },
    { ch: 'え', word: 'えび', pic: '🦐', row: 1 },
    { ch: 'お', word: 'おに', pic: '👹', row: 1 },
    // か行
    { ch: 'か', word: 'かに', pic: '🦀', row: 2 },
    { ch: 'き', word: 'きりん', pic: '🦒', row: 2 },
    { ch: 'く', word: 'くま', pic: '🐻', row: 2 },
    { ch: 'け', word: 'けーき', pic: '🍰', row: 2 },
    { ch: 'こ', word: 'こあら', pic: '🐨', row: 2 },
    // さ行
    { ch: 'さ', word: 'さる', pic: '🐒', row: 3 },
    { ch: 'し', word: 'しまうま', pic: '🦓', row: 3 },
    { ch: 'す', word: 'すいか', pic: '🍉', row: 3 },
    { ch: 'せ', word: 'せっけん', pic: '🧼', row: 3 },
    { ch: 'そ', word: 'そり', pic: '🛷', row: 3 },
    // た行
    { ch: 'た', word: 'たこ', pic: '🐙', row: 4 },
    { ch: 'ち', word: 'ちょうちょ', pic: '🦋', row: 4 },
    { ch: 'つ', word: 'つき', pic: '🌙', row: 4 },
    { ch: 'て', word: 'てれび', pic: '📺', row: 4 },
    { ch: 'と', word: 'とまと', pic: '🍅', row: 4 },
    // な行
    { ch: 'な', word: 'なす', pic: '🍆', row: 5 },
    { ch: 'に', word: 'にんじん', pic: '🥕', row: 5 },
    { ch: 'ぬ', word: 'ぬいぐるみ', pic: '🧸', row: 5 },
    { ch: 'ね', word: 'ねこ', pic: '🐱', row: 5 },
    { ch: 'の', word: 'のーと', pic: '📒', row: 5 },
    // は行
    { ch: 'は', word: 'はな', pic: '🌷', row: 6 },
    { ch: 'ひ', word: 'ひよこ', pic: '🐤', row: 6 },
    { ch: 'ふ', word: 'ふうせん', pic: '🎈', row: 6 },
    { ch: 'へ', word: 'へび', pic: '🐍', row: 6 },
    { ch: 'ほ', word: 'ほし', pic: '⭐', row: 6 },
    // ま行
    { ch: 'ま', word: 'まいく', pic: '🎤', row: 7 },
    { ch: 'み', word: 'みみ', pic: '👂', row: 7 },
    { ch: 'む', word: 'むし', pic: '🐛', row: 7 },
    { ch: 'め', word: 'めがね', pic: '👓', row: 7 },
    { ch: 'も', word: 'もも', pic: '🍑', row: 7 },
    // や行
    { ch: 'や', word: 'やま', pic: '🗻', row: 8 },
    { ch: 'ゆ', word: 'ゆきだるま', pic: '⛄', row: 8 },
    { ch: 'よ', word: 'よっと', pic: '⛵', row: 8 },
    // ら行
    { ch: 'ら', word: 'らいおん', pic: '🦁', row: 9 },
    { ch: 'り', word: 'りんご', pic: '🍎', row: 9 },
    { ch: 'る', word: 'るーぺ', pic: '🔍', row: 9 },
    { ch: 'れ', word: 'れもん', pic: '🍋', row: 9 },
    { ch: 'ろ', word: 'ろけっと', pic: '🚀', row: 9 },
    // わ行（「を」「ん」は 言葉の途中・最後に入る 例外）
    { ch: 'わ', word: 'わに', pic: '🐊', row: 10 },
    { ch: 'を', word: 'えをかく', pic: '🎨', row: 10 },
    { ch: 'ん', word: 'みかん', pic: '🍊', row: 10 }
  ];
  function chs(maxRow) {
    return ITEMS.filter(function (it) { return it.row <= maxRow; }).map(function (it) { return it.ch; });
  }
  function levelConfig(level) {
    if (level <= 1) return { pool: chs(2), choices: 3 };   // あ〜こ 10字
    if (level === 2) return { pool: chs(5), choices: 3 };  // あ〜の 25字
    return { pool: chs(10), choices: 4 };                 // 46字
  }
  C.hira = { ITEMS: ITEMS, levelConfig: levelConfig };
})();
