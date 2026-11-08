# 勉強アプリ Task 2 報告（アプリの土台）

状態: DONE_WITH_CONCERNS（懸念は末尾。コミットはしていない）

## 変更ファイル
| ファイル | 内容 |
|---|---|
| `app-benkyo/index.html`（新規） | 入口。ui.css→app.css、共有スクリプト（core, storage, sfx, voice, gate, timer, adaptive, parent）→`subjects/kuku.js`→`kuku-screen.js`→`main.js`。起動は index.html 内で `Chiid.benkyo.start()`。manifest・SW登録は知育と同じ |
| `app-benkyo/main.js`（新規） | `Chiid.benkyo`：`SUBJECTS`／`pickProfile`／`start`／`showHome`／`openSubject`／`checkRest`。ほかに Task 3 用の部品 `Chiid.benkyo.ui`（el, svg, button, later, ruby, bubble, newScreen, chara, topBar, play, speak, ICO, STAR, profileId()） |
| `app-benkyo/app.css`（新規） | 落ち着いた青系の配色（`:root` の色変数を上書き）。トップの教科カード、プロフィール、お休み/じゅんびちゅう、親画面。短い横向き（≤520px／≤340px）と縦向きの規則は知育の app.css を踏襲 |
| `app-chiiku/game.js` | `pickProfile`：アクティブが `kind==='chiiku'` のときだけそれを使う（それ以外は最初の chiiku を探す、従来どおり）。`Chiid.chiikuPickProfile = pickProfile` を公開 |
| `shared/parent.js` | `AREA_NAMES` に `kuku: 'くく'`。苦手表の項目セルに `p-item`（`white-space:nowrap`）を付け、`3×4` が折り返さないように |
| `tests/benkyo.test.js`（新規） | 5件（SUBJECTS、benkyo.pickProfile×2、chiikuPickProfile、checkRest） |
| `tests/index.html` | `../app-chiiku/game.js`、`../app-benkyo/main.js`、`benkyo.test.js` を追加 |

## 赤→緑
- 赤: テスト追加後 `PASS 64 / FAIL 5`（`Chiid.benkyo` 未定義、`C.chiikuPickProfile is not a function`）。
- 緑: 実装後 `PASS 69 / FAIL 0`（既存64件＋新規5件）。CSS・アイコン修正後も再実行して `PASS 69 / FAIL 0`。

## 画面確認（http://localhost:8112/、ブラウザペイン）
- 1280×800: プロフィール作成→トップ（教科カード4枚、九九のみ枠付きで押せる、他3枚は「じゅんびちゅう」）→九九を押す→「九九（くく） は じゅんびちゅう だよ」（kuku-screen.js が無いため・404でも落ちない）→トップへ→はぐるま→おとなゲート（数字キーで解答）→親画面。分野「くく」、苦手「3×4」「7×8」が1行で表示。横スクロールなし。
- 714×321: トップ（カード下端 298px／高さ 322px、横スクロールなし）、ゲート（箱 30〜292px）、親画面（苦手の行の高さ47px＝1行）、じゅんびちゅう画面、お休み画面（利用時間を超過させて `checkRest()` が true を返し、お休み画面に切り替わることを確認）、プロフィール作成（入力・ボタン横並びで収まる）→作成→トップ。
- 375×812（縦）: トップのカードが2×2で収まる。
- 知育アプリ: アクティブが勉強のプロフィールの状態で開くと、知育のプロフィール作成画面になることを確認（Review Focus の項目）。
- 確認後、テスト用データはリセット、サーバーは停止、表示サイズは元に戻した。

## 判断したこと
- `SUBJECTS` の九九は `name:'九九', yomi:'くく'`（カードは `<ruby>` でふりがな）。ほかは `けいさん`／`かんじ`／`えいご`。無効カードは `disabled`＋`aria-disabled`。
- `benkyo.pickProfile` は、見つけた benkyo を `setActive` する（知育の pickProfile と同じ動き。親画面がそのお子さんを表示するため）。chiiku しか無いときはアクティブを変えない（テストで固定）。
- `openSubject('kuku')` は `Chiid.benkyo.kukuScreen.show({profileId})` があればそれを呼び、無い（または例外）ときは「じゅんびちゅう」画面。開く前に `checkRest()` を確認。
- `checkRest()` は `#app` が無い（テスト）ときは画面を出さずに真偽だけ返す。
- お休みの文言は設計書どおり「きょうは たくさん がんばったね。おやすみしよう」（読み上げあり）。
- トップの見出しは「なにを やる？」（「勉」は小3の漢字なので避けた）。
- 名前は `maxLength=10` に加え、送信時にも10文字で切る（日本語入力で超える場合の対策）。
- `main.js` を `tests/index.html` で読み込むため、知育の `game.js` も読み込む（`#app` が無いので起動しない）。

## 懸念・未確認
- 実機（Androidタブレット・スマホ）は未確認。音（BGM・効果音）と読み上げは、画面確認では未確認。
- 親画面のボタンの影色（`p-btn.on` の `#e06f20` など）は parent.js 内の固定色のため、勉強アプリでは青いボタンにオレンジの影が出る（見た目だけ。共有部品の変更を最小にするため触っていない）。
- `kuku-screen.js` が無い間は、`app-benkyo/index.html` を開くたびにそのファイルが 404 になる（動作に影響なし。Task 3 で解消）。
- `sw.js` の PRECACHE に勉強アプリは未追加（Task 4 の範囲）。
