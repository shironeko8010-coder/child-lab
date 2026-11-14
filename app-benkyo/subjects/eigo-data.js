/* えい語のことば。Chiid.eigoData
   12テーマ・126こ（設計書5章）。絵は絵文字（Unicode 12 以前、ZWJ を使わない1文字）か、SVG で描くもの（art）。
   art の形：'color:<色>'（色の丸）・'num:<数>'（大きな数字）・'shape:<形>'（形）。すべてのことばで 絵は重ならない。
   ja は日本語の意味（ひらがな）。正解のあと つづりの下に小さく出す。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var THEMES = [
    { id: 'animal', name: 'どうぶつ', pic: '🐾' },
    { id: 'color', name: 'いろ', pic: '🎨' },
    { id: 'number', name: 'かず', pic: '🔢' },
    { id: 'food', name: 'たべもの', pic: '🍙' },
    { id: 'fruit', name: 'くだもの・やさい', pic: '🧺' },
    { id: 'body', name: 'からだ', pic: '🧍' },
    { id: 'greeting', name: 'あいさつ', pic: '💬' },
    { id: 'family', name: 'かぞく', pic: '🏠' },
    { id: 'school', name: 'がっこうの もの', pic: '🖊️' },
    { id: 'vehicle', name: 'のりもの', pic: '🛣️' },
    { id: 'nature', name: 'てんき・しぜん', pic: '🌤️' },
    { id: 'shape', name: 'かたち・うごき', pic: '🔺' }
  ];

  // [英語, 意味, 絵文字] または [英語, 意味, null, art]
  var LIST = {
    animal: [['dog', 'いぬ', '🐶'], ['cat', 'ねこ', '🐱'], ['rabbit', 'うさぎ', '🐰'], ['lion', 'らいおん', '🦁'], ['elephant', 'ぞう', '🐘'],
      ['monkey', 'さる', '🐵'], ['bear', 'くま', '🐻'], ['pig', 'ぶた', '🐷'], ['bird', 'とり', '🐦'], ['fish', 'さかな', '🐟']],
    color: [['red', 'あか'], ['blue', 'あお'], ['yellow', 'きいろ'], ['green', 'みどり'], ['pink', 'ぴんく'],
      ['orange', 'おれんじ'], ['purple', 'むらさき'], ['brown', 'ちゃいろ'], ['black', 'くろ'], ['white', 'しろ']],
    number: [['one', 'いち'], ['two', 'に'], ['three', 'さん'], ['four', 'よん'], ['five', 'ご'], ['six', 'ろく'], ['seven', 'なな'],
      ['eight', 'はち'], ['nine', 'きゅう'], ['ten', 'じゅう'], ['eleven', 'じゅういち'], ['twelve', 'じゅうに'], ['thirteen', 'じゅうさん'],
      ['fourteen', 'じゅうよん'], ['fifteen', 'じゅうご'], ['sixteen', 'じゅうろく'], ['seventeen', 'じゅうなな'], ['eighteen', 'じゅうはち'],
      ['nineteen', 'じゅうきゅう'], ['twenty', 'にじゅう']],
    food: [['rice', 'ごはん', '🍚'], ['bread', 'ぱん', '🍞'], ['egg', 'たまご', '🥚'], ['milk', 'ぎゅうにゅう', '🥛'], ['cake', 'けーき', '🍰'],
      ['pizza', 'ぴざ', '🍕'], ['ice cream', 'あいすくりーむ', '🍦'], ['juice', 'じゅーす', '🧃'], ['cookie', 'くっきー', '🍪'], ['sandwich', 'さんどいっち', '🥪']],
    fruit: [['apple', 'りんご', '🍎'], ['banana', 'ばなな', '🍌'], ['grapes', 'ぶどう', '🍇'], ['strawberry', 'いちご', '🍓'], ['lemon', 'れもん', '🍋'],
      ['peach', 'もも', '🍑'], ['melon', 'めろん', '🍈'], ['carrot', 'にんじん', '🥕'], ['tomato', 'とまと', '🍅'], ['potato', 'じゃがいも', '🥔'],
      ['corn', 'とうもろこし', '🌽']],
    body: [['eye', 'め', '👁️'], ['ear', 'みみ', '👂'], ['nose', 'はな', '👃'], ['mouth', 'くち', '👄'], ['hand', 'て', '✋'],
      ['foot', 'あし', '🦶'], ['leg', 'あし', '🦵'], ['arm', 'うで', '💪'], ['tooth', 'は', '🦷'], ['face', 'かお', '🙂']],
    greeting: [['hello', 'こんにちは', '🙋'], ['good morning', 'おはよう', '🌅'], ['good night', 'おやすみ', '😴'], ['thank you', 'ありがとう', '🙏'],
      ['sorry', 'ごめんなさい', '🙇'], ['goodbye', 'さようなら', '👋'], ['happy birthday', 'おたんじょうび おめでとう', '🎂']],
    family: [['mother', 'おかあさん', '👩'], ['father', 'おとうさん', '👨'], ['baby', 'あかちゃん', '👶'], ['grandmother', 'おばあちゃん', '👵'],
      ['grandfather', 'おじいちゃん', '👴'], ['brother', 'おにいさん', '👦'], ['sister', 'おねえさん', '👧'], ['family', 'かぞく', '👪']],
    school: [['pencil', 'えんぴつ', '✏️'], ['book', 'ほん', '📖'], ['bag', 'かばん', '🎒'], ['clock', 'とけい', '⏰'], ['scissors', 'はさみ', '✂️'],
      ['notebook', 'のーと', '📓'], ['ruler', 'じょうぎ', '📏'], ['crayon', 'くれよん', '🖍️'], ['chair', 'いす', '🪑'], ['school', 'がっこう', '🏫']],
    vehicle: [['car', 'くるま', '🚗'], ['bus', 'ばす', '🚌'], ['train', 'でんしゃ', '🚃'], ['bike', 'じてんしゃ', '🚲'], ['airplane', 'ひこうき', '✈️'],
      ['ship', 'ふね', '🚢'], ['taxi', 'たくしー', '🚕'], ['truck', 'とらっく', '🚚'], ['rocket', 'ろけっと', '🚀'], ['helicopter', 'へりこぷたー', '🚁']],
    nature: [['sun', 'たいよう', '☀️'], ['rain', 'あめ', '☔'], ['snow', 'ゆき', '⛄'], ['cloud', 'くも', '☁️'], ['rainbow', 'にじ', '🌈'],
      ['tree', 'き', '🌳'], ['flower', 'はな', '🌸'], ['mountain', 'やま', '⛰️'], ['sea', 'うみ', '🌊'], ['moon', 'つき', '🌙']],
    shape: [['circle', 'まる'], ['triangle', 'さんかく'], ['square', 'しかく'], ['star', 'ほし'], ['heart', 'はーと'],
      ['run', 'はしる', '🏃'], ['swim', 'およぐ', '🏊'], ['dance', 'おどる', '💃'], ['sing', 'うたう', '🎤'], ['sleep', 'ねる', '🛌']]
  };

  var WORDS = [];
  THEMES.forEach(function (t) {
    LIST[t.id].forEach(function (r, i) {
      var art = null;
      if (!r[2]) art = t.id === 'color' ? 'color:' + r[0] : t.id === 'number' ? 'num:' + (i + 1) : 'shape:' + r[0];
      WORDS.push({ id: t.id + ':' + r[0], theme: t.id, en: r[0], ja: r[1], pic: r[2] || null, art: art });
    });
  });

  C.eigoData = {
    THEMES: THEMES,
    WORDS: WORDS,
    LETTERS: 'abcdefghijklmnopqrstuvwxyz',
    // まぎらわしい文字の組（よむ レベル2・3で1つ入れる）
    CONFUSE: [['b', 'd', 'p', 'q'], ['m', 'n'], ['u', 'n'], ['i', 'l', 'j'], ['c', 'o', 'e']]
  };
})();
