# Task 1・2 報告

状態: DONE_WITH_CONCERNS

## 作ったファイル
- tests/runner.js（Chiid.test / assertEq / runTests。Promise対応、1テスト15秒タイムアウト、結果を #summary と #failures に出す）
- tests/index.html（runner → core → 本体 → app-chiiku → テストの順に script を列挙。async=false で順序保証、全部の load/error 後に runTests。無いファイルは404でも無視）
- shared/core.js（window.Chiid = window.Chiid || {}）
- shared/ui.css（色変数、.btn-big 最小64px、.reward-star、横向き優先 .screen）
- shared/storage.js（計画のインターフェース通り。localStorage=chiid.* / IndexedDB chiid・logs・index profileId。使えない時はメモリ。_forceMemory 付き）
- tests/storage.test.js（通常とメモリのみの2シナリオ。初期値・setSettings・プロフィール・ログ2件・秒数合算・exportに「たろう」・resetAll後に空）

## 確認
- TDD: ダミーテストで `PASS 2 / FAIL 1`（失敗の詳細表示も確認、非同期テストも通過）→ ダミー除去。storage.js 無しで `PASS 0 / FAIL 2` → 実装後 `PASS 2 / FAIL 0`（http://localhost:8080/tests/index.html をブラウザ内蔵ツールで確認）。
- ui.css: 1280x800 と 800x1280 で .btn-big(高さ67px)が画面内、横スクロールなし。

## 懸念
- 確認用サーバー tools/serve.pl は、ブラウザの keep-alive 接続で詰まり、ページが「実行中...」のままになった。tools/serve.pl は変更せず、Connection: close 版の複製をスクラッチパッド(…/scratchpad/serve2.pl)で8080に起動して確認した。元のserve.plは落ちたままなので、今後も同じ現象が出うる（serve.pl の修正を推奨）。
- ダミーテスト(tests/dummy.test.js)は自作の一時ファイルで、確認後に消した（読み込み一覧にも無い）。
- 実ブラウザの「保存不可」（プライベートモード）は未確認。_forceMemory による再現のみ。
- ログの getLogs は IndexedDB とメモリ分をマージして ts 順。
