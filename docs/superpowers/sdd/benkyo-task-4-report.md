# Task 4 報告：入口・オフライン・公開設定

## 変更ファイル
- index.html（「べんきょう」を有効リンク app-benkyo/index.html に。soon／じゅんびちゅうを外した。CSSの .soon 系は未使用になったが残してある）
- sw.js（PRECACHE に app-benkyo の5ファイルを追加、CACHE_NAME を chiid-v7）
- .github/workflows/pages.yml（cp に app-benkyo を追加。tests/ docs/ tools/ は含めていない）
- tests/precache.test.js（検査対象ページに app-benkyo/index.html を追加）

## 確認結果
- tests/index.html: PASS 79 / FAIL 0（検査の件数は同じ。対象ページが1つ増えた）
- ルート→べんきょう→ニックネーム→九九の問題画面まで到達（714x321で確認）。
- ルートのカード2枚と九九画面は、1280x800 と 714x321 でスクロール／はみ出しなし（要素位置を数値で確認）。
- sw登録パス '../sw.js' は app-chiiku と同じ。app-benkyo/ から見て /sw.js（ルート）になりスコープも正しい。
- コンソールの「unknown error when fetching the script」は、ルート画面（既存の sw.js）でも出る。単一スレッドの開発用サーバー（tools/serve.pl）が、同時に来る sw.js の取得で詰まるためと推測。勉強アプリ固有の本物の不具合ではないと判断（原因の断定はしていない）。

## 未確認
- 赤→緑の順：先にテストだけ変えて失敗を確認する手順は踏まず、テストと実装を続けて入れた。
- Service Worker の実登録・オフライン動作・GitHub Actions の実行は未確認（内蔵ブラウザでは不可）。
- 実機（Androidタブレット／スマホ）は未確認。

## 懸念
- ルートindex.html の .app-card.soon / .soon-label のCSSは不要になった（無害なので残した）。
- 既に知育アプリを入れている端末は、SW更新（v7）で新ファイルが入る。ネットワーク優先なので反映は早いはず（未確認）。
