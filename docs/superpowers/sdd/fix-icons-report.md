# fix-icons 報告

状態: 完了（実機のインストール表示は未確認）

## 原因の見立て
manifest.json のアイコンが SVG のみ。Chrome(Android) のインストール判定は 192x192 と 512x512 の PNG を求めるため、「ホーム画面に追加」(ショートカット)だけになる恐れ。

## 変更
- icons/icon-192.png, icons/icon-512.png（icon.svg を canvas に描画して作成。実PNG確認済み: 192x192 / 512x512 RGBA）
- icons/icon-maskable-512.png（背景 #fff4e0 を全面に敷き、絵を 80% に縮小して中央配置。安全領域内）
- manifest.json: 上記3つ追加(any x2 / maskable)、SVGは残す。id "./"、start_url "./"、scope "./"、display "standalone" + display_override ["fullscreen","standalone"]（fullscreen単独だとインストール判定に影響する可能性があるため。fullscreen対応環境では従来どおり全画面）。theme_color / background_color は既存のまま。
- sw.js: CACHE_NAME を chiid-v3 に、PRECACHE に3つのPNGを追加。

## 作り方
Pythonが無いため、内蔵ブラウザで SVG→canvas→toDataURL(PNG) を生成し、一時の受信用perl（スクラッチ領域、使用後に停止）でファイル保存。

## 確認結果
- PNG先頭バイト 89 50 4E 47、file コマンドで寸法確認
- maskable版を画面表示して見た目確認（黄色いひよこが中央に余白付きで表示）
- manifest.json は JSON として読め、4つのアイコンURLすべて 200（content-type も正しい）
- tests/index.html: PASS 45 / FAIL 0（新しいポート8091で実行）

## できていない・懸念
- ポート8080のテストページは「実行中...」のまま止まった（保存領域が固まる既知の症状と思われる）。同じファイルを新ポート8091で動かして PASS 45 / FAIL 0 を確認。8080は現在も起動中。
- 内蔵ブラウザでは Service Worker 登録とインストール判定は確認できない。実機(Android Chrome、HTTPS配信のGitHub Pages)で「アプリをインストール」が出るかは未確認。
- 既にホーム画面に追加済みの端末は、一度削除して開き直す必要がある場合あり。キャッシュは chiid-v3 に更新される。
- start_url を ./index.html から ./ に変更（PRECACHE に './' あり）。
