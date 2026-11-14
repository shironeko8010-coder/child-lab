/* ずかんの テーマと 入れもの。Chiid.zukanData（ページは zukan-pages-1〜3.js が addRows で足す）
   設計書 docs/superpowers/specs/2026-11-12-benkyo-zukan-design.md の 7章。
   画面の字：1年生の漢字はそのまま、2年生の漢字は {漢字|よみ}、3年生以上は ひらがな。名前は カタカナ。
   pic は Unicode 12 以前の絵文字。絵文字がないページは art（zukan-art.js の SVG の名前）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var THEMES = [
    { id: 'doubutsu', name: 'どうぶつ', icon: '🦁' },
    { id: 'tori', name: '{鳥|とり}', icon: '🐦' },
    { id: 'mushi', name: 'むし', icon: '🦋' },
    { id: 'shokubutsu', name: 'しょくぶつ', icon: '🌻' },
    { id: 'mizu', name: '水の いきもの', icon: '🐟' },
    { id: 'kyoryu', name: 'きょうりゅう', icon: '🦕' },
    { id: 'uchu', name: 'うちゅうと 天気', icon: '🪐' },
    { id: 'karada', name: 'からだ', icon: '💪' },
    { id: 'norimono', name: 'のりもの', icon: '🚄' },
    { id: 'tabemono', name: 'たべもの', icon: '🍙' },
    { id: 'kisetsu', name: 'きせつと ぎょうじ', icon: '🎍' },
    { id: 'disney', name: 'ディズニーリゾート', icon: '🏰' }
  ];

  var PAGES = [];
  // 行 [id, テーマ, 名前, 絵文字, SVG名, 説明, まめちしき, 問題1, 問題2, 問題3] を ページにして足す（問題は [問い, 答え, [まちがい3つ]]）
  function addRows(rows) {
    rows.forEach(function (r) {
      PAGES.push({
        id: r[0], theme: r[1], name: r[2], pic: r[3], art: r[4], text: r[5], mame: r[6],
        qs: r.slice(7).map(function (q) { return { ask: q[0], a: q[1], wrong: q[2] }; })
      });
    });
  }

  C.zukanData = { THEMES: THEMES, PAGES: PAGES, addRows: addRows };
})();
