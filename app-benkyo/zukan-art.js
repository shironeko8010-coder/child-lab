/* ずかんの絵（絵文字がない22ページ）。Chiid.zukanArt
   120×120 の SVG。形と色だけの かんたんな絵（本物そっくりにはしない）。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  function svg(body) { return '<svg viewBox="0 0 120 120" aria-hidden="true">' + body + '</svg>'; }
  var EYE = '#2b2b2b';

  C.zukanArt = {
    // ダンゴムシ：灰色の だ円に よこすじ、小さな 足
    dangomushi: svg(
      '<ellipse cx="62" cy="64" rx="44" ry="30" fill="#7d8590"/>' +
      '<path d="M30 46q32-12 64 0M24 58q38-12 76 0M24 72q38 12 76 0M30 84q32 12 64 0" stroke="#5b626b" stroke-width="4" fill="none"/>' +
      '<ellipse cx="22" cy="64" rx="10" ry="12" fill="#646b74"/><circle cx="18" cy="60" r="2.5" fill="' + EYE + '"/>' +
      '<path d="M14 54l-8-8M14 70l-8 6" stroke="#4a5058" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M40 94v8M54 96v8M68 96v8M82 94v8" stroke="#4a5058" stroke-width="3" stroke-linecap="round"/>'),
    // セミ：茶色の からだに すきとおった はね
    semi: svg(
      '<path d="M60 30 L20 92 Q40 100 58 70Z" fill="#cfe9f5" stroke="#7fa7b8" stroke-width="2" opacity=".9"/>' +
      '<path d="M60 30 L100 92 Q80 100 62 70Z" fill="#cfe9f5" stroke="#7fa7b8" stroke-width="2" opacity=".9"/>' +
      '<ellipse cx="60" cy="62" rx="14" ry="34" fill="#6b4a2b"/>' +
      '<ellipse cx="60" cy="30" rx="16" ry="10" fill="#5a3d22"/>' +
      '<circle cx="47" cy="28" r="4" fill="#3a2a1a"/><circle cx="73" cy="28" r="4" fill="#3a2a1a"/>' +
      '<path d="M50 70h20M50 80h20M51 90h18" stroke="#4e341d" stroke-width="2"/>'),
    // カブトムシ：こげ茶の からだに 大きな つの
    kabutomushi: svg(
      '<ellipse cx="60" cy="78" rx="30" ry="32" fill="#4a2a16"/>' +
      '<path d="M60 48 L60 110" stroke="#2e1a0d" stroke-width="3"/>' +
      '<ellipse cx="60" cy="44" rx="20" ry="13" fill="#3a2010"/>' +
      '<path d="M60 36 Q58 18 50 8 Q66 12 66 22 Q70 14 78 14 Q70 22 64 34" fill="#3a2010"/>' +
      '<path d="M32 66l-14-6M30 84l-16 2M34 100l-12 8M88 66l14-6M90 84l16 2M86 100l12 8" stroke="#2e1a0d" stroke-width="4" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="72" rx="6" ry="14" fill="#6b3f22" opacity=".6"/>'),
    // アサガオ：むらさきの らっぱ形の花と つる
    asagao: svg(
      '<path d="M18 110 Q40 90 34 70 Q28 52 44 44" stroke="#3f8f3a" stroke-width="4" fill="none"/>' +
      '<path d="M30 92 q-14 -2 -16 -14 q12 0 16 14z" fill="#5cb85c"/>' +
      '<circle cx="74" cy="48" r="34" fill="#8a5cd6"/>' +
      '<circle cx="74" cy="48" r="22" fill="#b18ae8"/>' +
      '<circle cx="74" cy="48" r="9" fill="#fff6d8"/>' +
      '<path d="M74 14v68M40 48h68M50 24l48 48M98 24l-48 48" stroke="#7446c2" stroke-width="2" opacity=".5"/>'),
    // トリケラトプス：つの3本と えりかざり
    torikera: svg(
      '<path d="M44 34 Q60 4 82 22 Q92 40 80 54Z" fill="#c9a24a"/>' +
      '<ellipse cx="58" cy="80" rx="40" ry="22" fill="#8fb36a"/>' +
      '<ellipse cx="34" cy="60" rx="22" ry="17" fill="#8fb36a"/>' +
      '<path d="M22 54 L4 44 L20 62Z" fill="#f2ead8"/><path d="M36 46 L30 22 L44 44Z" fill="#f2ead8"/><path d="M48 48 L50 24 L58 46Z" fill="#f2ead8"/>' +
      '<circle cx="30" cy="58" r="3" fill="' + EYE + '"/>' +
      '<path d="M32 96v14M50 100v12M72 100v12M90 94v14" stroke="#6f9150" stroke-width="8" stroke-linecap="round"/>'),
    // ステゴサウルス：せなかの いたと しっぽの とげ
    sutego: svg(
      '<path d="M30 66 L38 44 L46 64Z M44 62 L54 34 L64 60Z M60 60 L72 32 L80 60Z M76 62 L86 40 L92 64Z" fill="#e07a4f"/>' +
      '<ellipse cx="60" cy="76" rx="38" ry="18" fill="#6aa8a0"/>' +
      '<path d="M96 74 Q110 70 116 60" stroke="#6aa8a0" stroke-width="10" stroke-linecap="round" fill="none"/>' +
      '<path d="M112 62l6-10M114 66l8-4" stroke="#f2ead8" stroke-width="4" stroke-linecap="round"/>' +
      '<ellipse cx="18" cy="80" rx="12" ry="8" fill="#6aa8a0"/><circle cx="14" cy="78" r="2.5" fill="' + EYE + '"/>' +
      '<path d="M36 90v16M54 92v14M72 92v14M88 90v16" stroke="#548a83" stroke-width="8" stroke-linecap="round"/>'),
    // プテラノドン：つばさを ひろげた形
    puterano: svg(
      '<path d="M60 54 L4 40 L30 62 L4 76 Z" fill="#b5836a"/>' +
      '<path d="M60 54 L116 40 L90 62 L116 76 Z" fill="#b5836a"/>' +
      '<ellipse cx="60" cy="62" rx="10" ry="20" fill="#9a6a52"/>' +
      '<path d="M54 46 L36 30 L58 40Z" fill="#9a6a52"/><path d="M60 40 L84 34 L62 48Z" fill="#c99a82"/>' +
      '<circle cx="58" cy="42" r="2.5" fill="' + EYE + '"/>' +
      '<path d="M0 100 Q30 92 60 100 T120 100" stroke="#9fd3f2" stroke-width="4" fill="none"/>'),
    // アンキロサウルス：よろいと しっぽの こぶ
    ankiro: svg(
      '<ellipse cx="56" cy="72" rx="40" ry="22" fill="#9c8a5a"/>' +
      '<path d="M22 64 Q56 34 90 64" fill="#8a7848"/>' +
      '<circle cx="36" cy="56" r="4" fill="#c9b98a"/><circle cx="50" cy="50" r="4" fill="#c9b98a"/><circle cx="64" cy="50" r="4" fill="#c9b98a"/><circle cx="78" cy="56" r="4" fill="#c9b98a"/>' +
      '<path d="M94 74 Q106 74 108 66" stroke="#9c8a5a" stroke-width="8" fill="none" stroke-linecap="round"/>' +
      '<circle cx="110" cy="62" r="9" fill="#7a6a3e"/>' +
      '<ellipse cx="14" cy="76" rx="10" ry="8" fill="#9c8a5a"/><circle cx="11" cy="74" r="2.5" fill="' + EYE + '"/>' +
      '<path d="M32 90v14M50 92v12M66 92v12M82 90v14" stroke="#7d6e46" stroke-width="8" stroke-linecap="round"/>'),
    // スピノサウルス：せなかの ほ
    supino: svg(
      '<path d="M34 60 Q58 6 86 60Z" fill="#e3a14a"/>' +
      '<path d="M40 58 L46 30M52 56 L56 22M64 56 L66 22M76 58 L76 32" stroke="#c07d2a" stroke-width="2"/>' +
      '<ellipse cx="60" cy="68" rx="34" ry="14" fill="#7a9a6a"/>' +
      '<path d="M26 64 Q10 60 4 66 Q12 74 30 72" fill="#7a9a6a"/><circle cx="14" cy="64" r="2.5" fill="' + EYE + '"/>' +
      '<path d="M92 70 Q108 74 118 66" stroke="#7a9a6a" stroke-width="8" stroke-linecap="round" fill="none"/>' +
      '<path d="M50 80 L46 106M72 80 L76 106" stroke="#5f7d52" stroke-width="9" stroke-linecap="round"/>'),
    // ヴェロキラプトル：はねのある 小さな 二本足
    raputoru: svg(
      '<ellipse cx="60" cy="58" rx="26" ry="16" fill="#8a6fe0"/>' +
      '<path d="M36 50 Q24 34 12 36 Q14 46 30 54Z" fill="#8a6fe0"/><circle cx="20" cy="40" r="2.5" fill="' + EYE + '"/>' +
      '<path d="M84 56 Q104 54 118 46" stroke="#8a6fe0" stroke-width="7" stroke-linecap="round" fill="none"/>' +
      '<path d="M60 44 L66 30 L70 44M70 46 L78 34 L80 48" fill="#c9b8f5"/>' +
      '<path d="M52 72 L46 96 L36 100M70 72 L76 96 L86 100" stroke="#6a52c2" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '<path d="M44 92 l-4 -8M78 92 l4 -8" stroke="#f2ead8" stroke-width="3" stroke-linecap="round"/>'),
    // フタバスズキリュウ：首の長い ひれのある 海の生きもの
    futaba: svg(
      '<rect x="0" y="0" width="120" height="120" rx="16" fill="#d6ecf8"/>' +
      '<ellipse cx="68" cy="80" rx="30" ry="14" fill="#4f7fb0"/>' +
      '<path d="M44 76 Q30 40 20 26" stroke="#4f7fb0" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="18" cy="24" rx="9" ry="6" fill="#4f7fb0"/><circle cx="15" cy="22" r="2" fill="' + EYE + '"/>' +
      '<path d="M54 90 L40 104M84 90 L98 104M56 70 L44 60M84 70 L96 60" stroke="#3d6894" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M98 80 L116 84" stroke="#4f7fb0" stroke-width="6" stroke-linecap="round"/>'),
    /* ---------- 2回目で 足した 絵 ---------- */
    // ツバメ：こん色の せなか、白い おなか、ふたまたの しっぽ
    tsubame: svg(
      '<path d="M58 62 L8 34 Q30 58 50 70Z" fill="#1f2f5a"/>' +
      '<path d="M66 62 L112 40 Q94 62 72 72Z" fill="#1f2f5a"/>' +
      '<ellipse cx="62" cy="68" rx="22" ry="13" fill="#24366a"/>' +
      '<ellipse cx="64" cy="74" rx="16" ry="7" fill="#fff"/>' +
      '<circle cx="42" cy="62" r="10" fill="#24366a"/><path d="M36 66 q4 6 10 2" fill="#c8402e"/>' +
      '<path d="M32 60 l-8 2 l8 2Z" fill="#3a3a3a"/><circle cx="40" cy="59" r="2.2" fill="#fff"/>' +
      '<path d="M82 72 L106 94 M82 74 L96 100" stroke="#1f2f5a" stroke-width="5" stroke-linecap="round"/>'),
    // キツツキ：木の みきに つかまって つつく。赤い 頭
    kitsutsuki: svg(
      '<rect x="82" y="0" width="26" height="120" fill="#9b6b3d"/><path d="M90 20v18M98 60v20M88 92v16" stroke="#7a522c" stroke-width="3"/>' +
      '<ellipse cx="62" cy="66" rx="16" ry="28" fill="#2d2d2d"/>' +
      '<path d="M52 56 q10 -4 18 4 M52 70 q10 -4 18 4" stroke="#fff" stroke-width="4" fill="none"/>' +
      '<circle cx="64" cy="34" r="13" fill="#f2f2f2"/><path d="M54 28 q10 -14 22 -2 Q66 26 54 28Z" fill="#d23a2a"/>' +
      '<path d="M76 34 L90 36 L76 39Z" fill="#555"/><circle cx="68" cy="32" r="2.4" fill="' + EYE + '"/>' +
      '<path d="M60 92 L56 112" stroke="#2d2d2d" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M72 84 L84 88M70 76 L84 78" stroke="#666" stroke-width="4" stroke-linecap="round"/>'),
    // ダチョウ：大きな からだ、長い 首と 足
    dachou: svg(
      '<ellipse cx="58" cy="58" rx="30" ry="20" fill="#3b3b3b"/>' +
      '<path d="M30 54 q-14 4 -18 16 q12 -2 20 -6Z" fill="#f4f4f4"/><path d="M84 52 q14 2 20 12 q-12 0 -20 -4Z" fill="#f4f4f4"/>' +
      '<path d="M72 46 Q78 26 76 12" stroke="#e8b9a0" stroke-width="7" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="78" cy="12" rx="8" ry="6" fill="#e8b9a0"/><path d="M85 12 l9 2 l-9 2Z" fill="#c9906e"/><circle cx="79" cy="10" r="2" fill="' + EYE + '"/>' +
      '<path d="M50 74 L46 112 M64 74 L70 112" stroke="#e8b9a0" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M40 112h12M66 112h12" stroke="#c9906e" stroke-width="5" stroke-linecap="round"/>'),
    // カラス：まっ黒な からだ、太い くちばし
    karasu: svg(
      '<ellipse cx="60" cy="66" rx="30" ry="20" fill="#1c1c22"/>' +
      '<path d="M84 60 L114 74 L86 78Z" fill="#26262e"/>' +
      '<circle cx="36" cy="50" r="15" fill="#1c1c22"/>' +
      '<path d="M22 46 L4 52 L22 56Z" fill="#33333b"/><circle cx="34" cy="46" r="3" fill="#fff"/><circle cx="34" cy="46" r="1.5" fill="#000"/>' +
      '<path d="M44 62 q16 -10 34 0" stroke="#3b3b48" stroke-width="3" fill="none"/>' +
      '<path d="M54 84 L50 104 M66 84 L70 104" stroke="#3a3a3a" stroke-width="4" stroke-linecap="round"/>'),
    // トンボ：ほそ長い からだと 4まいの はね、大きな 目
    tonbo: svg(
      '<ellipse cx="38" cy="40" rx="30" ry="9" transform="rotate(-12 38 40)" fill="#dff2fb" stroke="#8cbcd4" stroke-width="2"/>' +
      '<ellipse cx="82" cy="40" rx="30" ry="9" transform="rotate(12 82 40)" fill="#dff2fb" stroke="#8cbcd4" stroke-width="2"/>' +
      '<ellipse cx="40" cy="56" rx="26" ry="8" transform="rotate(10 40 56)" fill="#dff2fb" stroke="#8cbcd4" stroke-width="2"/>' +
      '<ellipse cx="80" cy="56" rx="26" ry="8" transform="rotate(-10 80 56)" fill="#dff2fb" stroke="#8cbcd4" stroke-width="2"/>' +
      '<rect x="56" y="40" width="8" height="74" rx="4" fill="#d9532c"/>' +
      '<circle cx="52" cy="30" r="8" fill="#3c8a4a"/><circle cx="68" cy="30" r="8" fill="#3c8a4a"/>' +
      '<path d="M57 60h6M57 72h6M57 84h6M57 96h6" stroke="#a83a1c" stroke-width="2"/>'),
    // ホタル：黒い からだに 赤い むね、黄色く 光る おしり
    hotaru: svg(
      '<rect x="0" y="0" width="120" height="120" rx="16" fill="#1d2a4a"/>' +
      '<circle cx="60" cy="88" r="26" fill="#f6f08a" opacity=".35"/>' +
      '<ellipse cx="60" cy="60" rx="14" ry="30" fill="#2b2b2b"/>' +
      '<ellipse cx="60" cy="34" rx="12" ry="8" fill="#d8443a"/><circle cx="60" cy="26" r="6" fill="#2b2b2b"/>' +
      '<ellipse cx="60" cy="82" rx="11" ry="10" fill="#fff36b"/>' +
      '<path d="M54 22 L44 10 M66 22 L76 10" stroke="#555" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="24" cy="30" r="2" fill="#fff36b"/><circle cx="96" cy="46" r="2" fill="#fff36b"/><circle cx="30" cy="96" r="2" fill="#fff36b"/>'),
    // クワガタ：茶色の からだに はさみのような 大きな あご
    kuwagata: svg(
      '<ellipse cx="60" cy="80" rx="26" ry="30" fill="#5a3a1e"/>' +
      '<path d="M60 52 L60 110" stroke="#3b2512" stroke-width="3"/>' +
      '<rect x="44" y="38" width="32" height="18" rx="8" fill="#4a2f17"/>' +
      '<path d="M48 40 Q30 26 38 8 Q42 24 54 34Z" fill="#4a2f17"/><path d="M72 40 Q90 26 82 8 Q78 24 66 34Z" fill="#4a2f17"/>' +
      '<path d="M40 20 l6 4M80 20 l-6 4" stroke="#3b2512" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M36 70l-14-6M34 86l-16 2M38 102l-12 8M84 70l14-6M86 86l16 2M82 102l12 8" stroke="#3b2512" stroke-width="4" stroke-linecap="round"/>'),
    // パキケファロサウルス：ドームのように もりあがった 頭
    pakike: svg(
      '<ellipse cx="62" cy="72" rx="30" ry="18" fill="#b8874f"/>' +
      '<path d="M90 70 Q108 74 118 66" stroke="#b8874f" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<path d="M40 64 Q30 52 26 44" stroke="#b8874f" stroke-width="12" stroke-linecap="round" fill="none"/>' +
      '<path d="M8 46 Q8 22 28 20 Q44 20 42 42 Q30 50 8 46Z" fill="#8f6236"/>' +
      '<circle cx="14" cy="42" r="2.4" fill="' + EYE + '"/><path d="M14 30 q8 -6 18 -2" stroke="#d9b07a" stroke-width="2" fill="none"/>' +
      '<path d="M52 86 L48 108 M72 86 L76 108" stroke="#9b6e3f" stroke-width="8" stroke-linecap="round"/>'),
    // イグアノドン：草を食べる大きな きょうりゅう。とがった 親ゆび
    iguano: svg(
      '<ellipse cx="60" cy="64" rx="32" ry="20" fill="#6f9a52"/>' +
      '<path d="M90 64 Q110 70 118 88" stroke="#6f9a52" stroke-width="10" stroke-linecap="round" fill="none"/>' +
      '<path d="M34 54 Q26 40 22 32" stroke="#6f9a52" stroke-width="12" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="18" cy="28" rx="14" ry="9" fill="#6f9a52"/><circle cx="16" cy="25" r="2.2" fill="' + EYE + '"/>' +
      '<path d="M40 72 L34 86" stroke="#5a8042" stroke-width="6" stroke-linecap="round"/><path d="M32 86 L26 78 L36 84Z" fill="#e8e0c8"/>' +
      '<path d="M54 80 L50 108 M74 80 L78 108" stroke="#5a8042" stroke-width="9" stroke-linecap="round"/>'),
    // モササウルス：海を およぐ 大きな はちゅうるい
    mosasa: svg(
      '<rect x="0" y="0" width="120" height="120" rx="16" fill="#cfe8f6"/>' +
      '<path d="M10 60 Q40 40 86 54 Q104 58 114 48 Q110 66 90 68 Q50 80 10 60Z" fill="#3f6f8f"/>' +
      '<path d="M10 60 Q20 66 34 64" stroke="#fff" stroke-width="2" fill="none"/>' +
      '<path d="M12 58 l4 -3 l2 4 l4 -3 l2 4 l4 -3" stroke="#fff" stroke-width="1.5" fill="none"/>' +
      '<circle cx="22" cy="54" r="2.4" fill="' + EYE + '"/>' +
      '<path d="M44 66 L34 84 L52 72Z M70 66 L64 84 L80 70Z" fill="#335d79"/>'),
    /* ---------- 3回目で 足した 絵 ---------- */
    // だいず：みどりの さやと、黄色っぽい まめ
    daizu: svg(
      '<path d="M16 70 Q30 30 70 28 Q100 28 108 44 Q96 40 80 46 Q52 54 34 84Z" fill="#7fb24a"/>' +
      '<path d="M22 72 Q40 40 72 36" stroke="#5f8f33" stroke-width="3" fill="none"/>' +
      '<circle cx="44" cy="54" r="9" fill="#a6d16a"/><circle cx="64" cy="44" r="9" fill="#a6d16a"/>' +
      '<ellipse cx="40" cy="96" rx="13" ry="11" fill="#e9cf86"/><ellipse cx="66" cy="100" rx="13" ry="11" fill="#e9cf86"/><ellipse cx="90" cy="92" rx="13" ry="11" fill="#e9cf86"/>' +
      '<path d="M40 90 v6M66 94 v6M90 86 v6" stroke="#b89a4e" stroke-width="2.5" stroke-linecap="round"/>')
  };
})();
