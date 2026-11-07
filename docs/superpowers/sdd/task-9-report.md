# Task 9 報告：親画面

## 作ったファイル
- shared/parent.js（`Chiid.parent.summarize` / `render`）
- tests/parent.test.js（5テスト）
- tests/parent-demo.html（目視確認用。ダミーのプロフィール2人とログ8件・利用3日。メモリ保存のみ）

## 仕様の解釈
- playDays = sec>0 の日数。totalMin = 合計秒を分に四捨五入。
- weak = 間違い（correct=false）の itemId を回数の多い順（同数は itemId 順）、最大5件。分野をまたいで itemId で集計。
- render: プロフィール切替／遊んだ日・時間／分野別正答率／苦手／1日の目安（制限なし・15・30・45・60分）／BGM・効果音ON/OFF（storage と sfx の両方に反映）／書き出し（Blob ダウンロード、通信なし）／リセット。
- リセット: 確認ダイアログ →「つぎへ（おとなゲート）」→ `Chiid.gate.open` → 通ったら `storage.resetAll()` → 再描画。
- render を呼ぶ前のおとなゲートは呼び出し側（ホーム画面）の責務。

## 確認結果
- http://localhost:8080/tests/index.html : PASS 36 / FAIL 0（他担当ぶんを含む全体）。
- parent-demo: 数字が summarize と一致（8件・正解4=50%、苦手 か2/あ1/け1、3日・27分）。
- リセット流れ（ダイアログ → ゲート → 全消去 → 空表示）を実行して確認。
- ボタンはすべて 64px 以上（実測）。外部通信・外部リンクなし。

## 未確認・懸念
- 書き出しのダウンロード動作（実ブラウザでのファイル保存）は未確認（コードのみ）。
- 実際の IndexedDB 保存（デモは _forceMemory 使用）。
- 縦向き・小画面での見た目は未確認（横長で目視のみ）。
- ゲートの問題は誤答時に作り直される仕様のため、確認ダイアログ後の再ゲートも同じ挙動。
- 分野名は `hiragana` のみ日本語名に変換、他は area 名をそのまま表示（小2アプリ追加時に AREA_NAMES へ追記）。
