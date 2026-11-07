# Task 8 報告（ひらがな教材と、なぞり判定）
作成: app-chiiku/data.js, app-chiiku/trace.js, tests/trace.test.js
- 署名・値は計画どおり。levelConfig: Lv1=あ行5文字/3択、Lv2=10文字/3択、Lv3=10文字/4択。
- score は目標が空の場合 pass=false（0除算回避）。サイズ違いのマスクは短い方に合わせる。
- rasterizeGlyph: bold 80% sans-serif で中央描画、alpha>128 を1。Canvas非対応時は全0を返す。
- テスト8件追加（score5、ITEMS/levelConfig、word=ひらがなのみ、rasterize画素数）。
- 結果: http://localhost:8080/tests/index.html で PASS 36 / FAIL 0（全体）。
- 目視: rasterizeGlyph('あ',200) を画像化し「あ」の形を確認済み。
- 注意: テストと実装を同時に書いたため、赤（失敗）確認の手順は厳密には省略。
