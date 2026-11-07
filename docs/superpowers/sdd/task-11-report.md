# Task 11 報告：オフライン対応

## 作成・変更
- 新規: sw.js, manifest.json, icons/icon.svg, tests/precache.test.js
- 変更: index.html, app-chiiku/index.html（manifest/iconリンク、SW登録。file:// や失敗時も例外で止まらない）、tests/index.html（precacheテストを追加）

## 仕様
- CACHE_NAME='chiid-v1'、PRECACHE=18ファイル（アプリ実行に必要な全ファイル。tests/docs/toolsは除外）
- install で addAll、activate で古いキャッシュ削除＋clients.claim、キャッシュ優先（ignoreSearch）、ナビゲーションは失敗時に index.html へ、同一オリジン外は 404 で遮断（外部fetchなし）
- manifest: fullscreen / landscape / ja / ひらがな名 / SVGアイコン(sizes any)。PNGなし

## 確認結果
- tests/index.html: PASS 38 / FAIL 0（新規2件含む：PRECACHE全URLが200、実アプリのscript/linkが全てPRECACHE内）
- ブラウザ内蔵ペインでは、任意のスクリプト(core.js等)でも ServiceWorker 登録が「fetching the script」エラーになり、ペインがSW自体を許さない環境と判断。sw.js固有の問題ではない。
- 代替確認: sw.js のハンドラを疑似 self で実行し、実際の Cache API で検証。install で18件全て保存、activate で古い 'chiid-old' を削除、?x=1付きURLがキャッシュから200、外部URLは404遮断。全て期待どおり。検証後にキャッシュは掃除済み。
- 未確認: 実際の SW 登録、サーバー停止またはオフラインでの再読み込み（実施できず）。ナビゲーション失敗時の index.html フォールバックは、サーバーが404を返すだけだったため（ネットワーク失敗ではない）検証できていない。
- サーバー(perl tools/serve.pl)は停止・変更していない。

## 懸念
- 実機/通常のChromeでのオフライン再読み込みは、やまとさんの確認が必要（localhostかhttpsでのみSW有効）。
- ファイルを変えたら CACHE_NAME の番号を上げ、PRECACHE に追加すること（precacheテストが漏れを検出）。
- 開発サーバーは1接続1リクエスト方式のため、addAll の並列取得で失敗する可能性がある（実機の本番配信では問題にならない見込みだが未確認）。
