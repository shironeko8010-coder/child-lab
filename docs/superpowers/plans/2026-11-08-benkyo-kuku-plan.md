# 勉強アプリ（土台＋九九） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 小2向けの勉強アプリ `app-benkyo/` の土台と、教科「九九」を作る。

**Architecture:** 知育アプリ（`app-chiiku/game.js`）と同じ作り。通常の `<script>` で `window.Chiid` に載せる。教科の出題・判定は画面と分けた純粋なロジック（`Chiid.kuku`）にして、ブラウザ内テストで検証する。画面（`main.js`）はロジックを呼ぶだけ。共有部品（`shared/`）をそのまま使う。

**Tech Stack:** 素のHTML/JS/CSS、WebAudio、Web Speech API、localStorage/IndexedDB。外部ライブラリなし。テストは `tests/index.html`（`Chiid.test` / `Chiid.assertEq`、結果は `#summary`）。確認用サーバーは `perl tools/serve.pl . <空きポート>`（Bashで起動。8080は使わない）。

**Spec:** `docs/superpowers/specs/2026-11-08-benkyo-kuku-design.md`（正本は `docs/design-spec.md`）

## Global Constraints
- 通信なし。外部ライブラリ・CDN・外部フォント不使用。ES Modules不使用（`index.html` 直開きでも動く）。
- 記録は端末内のみ。おとなゲート（`Chiid.gate.open(onPass, onCancel)`）を通らないと親画面・設定に入れない。
- 間違えても叱らない（「もういっかい やってみよう！」）。2回間違えたら正解をそっと見せる。空入力は間違いに数えない。
- 画面の文言は、ひらがな中心＋小2で習う漢字のみ。習っていない漢字にはふりがな（`<ruby>`）。
- タブレット横向き優先。スマホ横向き（714×321）・縦向き（375×812）でも見切れない。最小タップ領域は横向き高さ≤340で48px、それ以外56px以上。
- 動作確認していないことは「未確認」と書く。**PowerShell／powershell.exe は実行しない。ファイルは削除しない（移動かアーカイブ）。gitコミットは、やまとさんの許可があるときだけ（各タスクは、コミットせず報告で止まる）。**
- 既存の51件のテストを壊さない。`docs/design-spec.md` は変更しない。

## Review Focus
- 答えが空のまま「こたえる」→ 間違いに数えず、何も進まない。
- 数字を3桁以上入れようとする → 2桁で止まる（九九の答えは最大81）。
- 「09」のように先頭が0の入力（9）→ 正解として扱う。
- 5歳側の知育アプリを開いたとき、勉強アプリのプロフィールが「いま使っているプロフィール」でも、知育のプロフィール作成/選択に入れる。
- 9の段まで開いたあとの自動進行 → レベルが8を超えない。1の段・9の段だけ選んでも出題が尽きない。

## File Structure
| ファイル | 責務 |
|---|---|
| `app-benkyo/subjects/kuku.js` | 九九のロジック（`Chiid.kuku`）。DOMに触らない |
| `app-benkyo/main.js` | 画面の流れ（プロフィール→トップ→教科→ごほうび/お休み/親画面）。教科の一覧 `Chiid.benkyo.SUBJECTS` を持つ |
| `app-benkyo/kuku-screen.js` | 九九の問題画面・数字ボタン・ごほうび画面の描画 |
| `app-benkyo/app.css`, `app-benkyo/index.html` | 見た目と入口 |
| `tests/kuku.test.js`, `tests/benkyo.test.js` | 上記のテスト |

---

### Task 1: 九九ロジック `Chiid.kuku`

**Files:**
- Create: `app-benkyo/subjects/kuku.js`
- Create: `tests/kuku.test.js`
- Modify: `tests/index.html`（本体の読み込みに `../app-benkyo/subjects/kuku.js`、テストに `kuku` を追加）

**Interfaces:**
- Consumes: `Chiid.adaptive.nextLevel(recent:boolean[], level, maxLevel)`, `Chiid.adaptive.pickWeighted(ids, missCounts, rng)`。
- Produces（`window.Chiid.kuku`）:
  - `AREA = 'kuku'`, `MAX_LEVEL = 8`, `ROUND_SIZE = 10`, `STAR_EVERY = 5`
  - `ITEMS: {id:string, a:number, b:number, ans:number}[]`（81件。`id` は `'3×4'` 形式、`a` が「だん」）
  - `poolIds(level:number, onlyDan:number|null): string[]`
  - `pickItem(opts:{level, onlyDan, missCounts, lastId}, rng): item`
  - `judge(item, input:string): 'empty'|'correct'|'wrong'`
  - `newAttempt(): {tries:number}` / `submit(attempt, item, input): {kind:'empty'|'correct'|'retry'|'reveal'}`
  - `speakText(item): string`
  - `progressFromLogs(logs): {level, recent:boolean[], missCounts:object}`

- [ ] **Step 1: Write the failing tests（`tests/kuku.test.js`）**
  - `ITEMS.length === 81`、`ITEMS` に `'3×4'` があり `ans === 12`、全件 `a*b === ans`。
  - `poolIds(1, null)` は a が1か2の18件、`poolIds(8, null)` は81件、`poolIds(9, null)` も81件（レベル上限で頭打ち）、`poolIds(1, 7)` は a=7 の9件。
  - `pickItem` は `lastId` と同じ式を返さない（プールが2件以上のとき）。`onlyDan=9` のとき全て a=9。
  - `judge(item12,'12')==='correct'`、`'13'`→`'wrong'`、`''`→`'empty'`、`'012'`→`'wrong'`（3桁以上）、`'09'` は ans=9 の式で `'correct'`。
  - `submit` の流れ：1回目の誤答→`retry`、2回目の誤答→`reveal`、正解→`correct`、空→`empty`（tries を増やさない）。
  - `speakText(3×4)` は `'さん かける よん は？'`。読みは 1いち 2に 3さん 4よん 5ご 6ろく 7なな 8はち 9きゅう。
  - `progressFromLogs`：area が `kuku` のログだけを使い、`missCounts`（誤答の itemId ごとの回数）、最後のレベル、そのレベルで連続した直近の正誤（最大5）を返す。ログが空なら `{level:1, recent:[], missCounts:{}}`。最後の1問でレベルが変わる場合の扱いは、`app-chiiku/game.js` の `loadProgress`（約238〜262行）と同じ。
- [ ] **Step 2: Run** `tests/index.html` を開き、`#summary` が FAIL で、`Chiid.kuku` 未定義が原因と確認。
- [ ] **Step 3: Implement** 上記のインターフェースを `kuku.js` に。`poolIds`：`onlyDan` があればその段、なければ `a <= min(level+1, 9)`。判定は、数字だけを受け付け、先頭の0を無視して数値比較、3桁以上は `wrong`。
- [ ] **Step 4: Run** 全体が `FAIL 0`（既存51件＋新規）であること。
- [ ] **Step 5: Report** 変更ファイルとテスト結果を報告（コミットしない）。

---

### Task 2: アプリの土台（プロフィール・トップ・お休み・親画面）

**Files:**
- Create: `app-benkyo/index.html`, `app-benkyo/app.css`, `app-benkyo/main.js`
- Modify: `app-chiiku/game.js`（`pickProfile`：`getActive()` が `kind !== 'chiiku'` なら無視して、知育のプロフィールを探す。既存の挙動は変えない）
- Modify: `shared/parent.js`（`AREA_NAMES` に `kuku: 'くく'`）
- Test: `tests/benkyo.test.js`、`tests/index.html`（`../app-benkyo/main.js` を読み込めるようにする。`main.js` は、起動処理を `Chiid.benkyo.start()` に分け、`DOMContentLoaded` では `index.html` 側から呼ぶ）

**Interfaces:**
- Consumes: `Chiid.storage`（`addProfile(name,'benkyo')`, `listProfiles`, `setActive`, `getActive`, `getSettings`, `logAnswer`, `getLogs`）、`Chiid.timer`（`start(id)`, `stop()`, `isOver(id)`）、`Chiid.gate.open`、`Chiid.parent.render(container)`、`Chiid.sfx`、`Chiid.voice`。
- Produces（`Chiid.benkyo`）:
  - `SUBJECTS: {id:string, name:string, enabled:boolean}[]`（`kuku` のみ有効。`keisan`「けいさん」、`kanji`「かんじ」、`eigo`「えいご」は `enabled:false`）
  - `pickProfile(): {id,nickname,kind}|null`（`getActive()` が `benkyo` ならそれ、なければ最初の `benkyo`、なければ null）
  - `start(): void` / `showHome(): void` / `openSubject(id): void`

- [ ] **Step 1: Write the failing tests（`tests/benkyo.test.js`）**
  - `SUBJECTS` は4件、有効なのは `kuku` だけ。
  - `pickProfile`：`chiiku` のプロフィールだけがあり、それがアクティブでも `null`。`benkyo` があれば（アクティブでなくても）それを返す。
  - 知育側：アクティブが `benkyo` のとき、`Chiid` 経由で `pickProfile` を呼べるよう `Chiid.chiikuPickProfile` として公開し、`kind==='chiiku'` のプロフィールを返す（または無ければ null）。テストはメモリ保存（`Chiid.storage._forceMemory(true)`）で行う。
- [ ] **Step 2: Run** FAIL を確認。
- [ ] **Step 3: Implement**
  - `index.html`: `shared/ui.css`、`app.css`、共有スクリプト（core, storage, sfx, voice, gate, timer, adaptive, parent）、`subjects/kuku.js`、`kuku-screen.js`、`main.js` の順。`manifest`・SW登録は `app-chiiku/index.html` に合わせる。
  - `main.js`: 画面の流れは `app-chiiku/game.js` の `showProfileCreate`/`enterProfile`/`showHome`/`showRest`/おとなゲート→`showParent` と同じ作り（ヘルパー `el`, `button`, 画面切替 `newScreen`、ぴよ `chara` は、必要な分だけ複製してよい）。プロフィール作成は `kind:'benkyo'`、名前は10文字まで。トップは教科カード（有効のみ押せる。無効は「じゅんびちゅう」）と、おとなゲート経由の親画面ボタン。問題と問題のあいだで `timer.isOver` を確認する仕組みは、教科画面側（Task 3）が `Chiid.benkyo.checkRest(): boolean`（超過ならお休み画面を出して `true`）を呼ぶ形にする。
  - `app.css`: 小2向けの落ち着いた配色（知育より彩度を下げる）。タップ領域・文字は大きいまま。スマホ横向き対応は `app-chiiku/app.css` の短い横向きの規則を踏襲。
- [ ] **Step 4: Run** 全体 `FAIL 0`。ブラウザで `app-benkyo/index.html` を開き、プロフィール作成→トップ→親画面（ゲート経由）が動くことを確認。
- [ ] **Step 5: Report**（コミットしない）。

---

### Task 3: 九九の画面（`kuku-screen.js`）

**Files:**
- Create: `app-benkyo/kuku-screen.js`
- Modify: `app-benkyo/main.js`（`openSubject('kuku')` から `Chiid.benkyo.kukuScreen.show(ctx)` を呼ぶ）、`app-benkyo/app.css`
- Test: `tests/benkyo.test.js`（追記）

**Interfaces:**
- Consumes: Task 1 の `Chiid.kuku.*`、Task 2 の `Chiid.benkyo.checkRest`, `Chiid.benkyo.showHome`、`Chiid.storage.logAnswer({profileId, area:'kuku', itemId, correct, level})`、`Chiid.adaptive.nextLevel`。
- Produces: `Chiid.benkyo.kukuScreen.show(ctx:{profileId:string}): Promise<void>`（記録を読み込み、1回の区切り（10問）を始める）。ほかに、テスト用の `Chiid.benkyo.kukuScreen._press(key:string)`（`'0'〜'9'`, `'del'`, `'ok'`）と `_state()`（現在の式・入力・段選択・解いた数・星の数）。

- [ ] **Step 1: Write the failing tests**（`_press` を使い、ブラウザ内で）
  - 初期状態で式が表示され、`'1','2','ok'` で正誤が決まる。
  - 1回目の誤答で入力が空に戻り同じ式のまま、2回目の誤答で正解が表示され、次の式に進む。誤答は `logAnswer` で `correct:false` が1回ずつ（reveal まで計2件ではなく、問題あたり1件の「最終結果」を記録するかどうかを決めて固定する：**1問につき1件。1回目で正解なら `true`、そうでなければ `false`**）。
  - 空のまま `'ok'` では何も進まず、記録も増えない。
  - 数字は2桁で止まる。`'del'` で1桁戻る。
  - 5問目の正解で星が1つ増え、10問で区切り（ごほうび画面）になる。
  - 「○のだんだけ」を選ぶと、以降の式がその段だけになり、「じどう」で戻る。
  - 直近5問で4問正解するとレベルが上がる（`nextLevel`）。上限は8。
- [ ] **Step 2: Run** FAIL を確認。
- [ ] **Step 3: Implement**
  - 画面: 上に戻るボタンと段選択（「じどう」「1〜9のだん」の横並び。選択は画面内のみで保存しない）、中央に「3 × 4 = ?」と入力欄、下に数字ボタン（0〜9、けす、こたえる）。声ボタンで `speakText` を読み上げ。正解で `sfx.play('correct')`＋ぴよ、誤答は `'oops'`（やさしい音）。2回目の誤答の文言は「こたえは 12 だよ。つぎは できるよ！」。
  - ごほうび画面: 星の数、「もういっかい」「おわる」。`Chiid.benkyo.checkRest()` は、問題と問題のあいだで毎回呼ぶ。
  - 数字ボタンの配置は `shared/gate.js` のパッドを参考にする（1〜9、けす、0、こたえる）。
- [ ] **Step 4: Run** 全体 `FAIL 0`。ブラウザで、通しで1区切りを実際にタップして確認。
- [ ] **Step 5: Report**（コミットしない）。

---

### Task 4: 入口・オフライン・公開設定

**Files:**
- Modify: `index.html`（ルート。「べんきょう」を `<a class="app-card" href="app-benkyo/index.html">` にし、`soon` と「じゅんびちゅう」を外す）
- Modify: `sw.js`（`PRECACHE` に `app-benkyo/index.html`, `app-benkyo/app.css`, `app-benkyo/main.js`, `app-benkyo/kuku-screen.js`, `app-benkyo/subjects/kuku.js` を追加。`CACHE_NAME` を `'chiid-v7'`）
- Modify: `.github/workflows/pages.yml`（`cp -r` に `app-benkyo` を追加）
- Test: `tests/precache.test.js`（既存。勉強アプリのファイルが実アプリの読み込みと一致することを確認。`app-benkyo/index.html` の `<script>`/`<link>` に出るファイルが全て `PRECACHE` に入っている、という検査を追加）

- [ ] **Step 1: Write the failing test**（precache に追記）
- [ ] **Step 2: Run** FAIL を確認。
- [ ] **Step 3: Implement** 上記の変更。`tests/`、`docs/`、`tools/` は公開物に入れないこと。
- [ ] **Step 4: Run** 全体 `FAIL 0`。`tests/parent-demo.html` が公開物に入らないことを `pages.yml` で確認。
- [ ] **Step 5: Report**（コミットしない）。

---

### Task 5: QA（通し確認）

**Files:** 修正が必要なものだけ。報告は `docs/qa-report-benkyo.md`（新規）。

- [ ] **Step 1:** 1280×800、714×321、640×290、375×812 で、プロフィール作成→トップ→九九（段選択含む）→ごほうび→お休み画面→親画面（ゲート）を通し、見切れ・はみ出しを、要素の位置を数値で確認。最小タップ領域も計測。
- [ ] **Step 2:** 知育アプリと勉強アプリを交互に開いて、プロフィールが混ざらないこと、親画面の切替で両方の記録が見えることを確認。
- [ ] **Step 3:** Review Focus の5項目が、実際の画面でも期待どおりか確認。
- [ ] **Step 4:** `tests/index.html` の全件 `FAIL 0` を確認。サーバーを停止。
- [ ] **Step 5:** 見つけた問題は直して再確認。直せないものは、`docs/qa-report-benkyo.md` に、未確認・残課題として書き、報告。実機（Androidスマホ／タブレット）確認用のチェックリスト（入力して試す例と期待結果つき）を同ファイルに添える。

---

## Self-Review
- **Spec coverage:** 土台（Task2）、九九の出題・判定・段・自動進行（Task1,3）、叱らない・2回目で正解を見せる（Task1,3）、ごほうび・区切り（Task3）、利用時間・お休み（Task2,3）、記録・親画面（Task2,3）、入口・SW・公開（Task4）、確認（Task5）。
- **変更点:** 設計書の「プロフィール共通」は、実装前の確認で、`kind` を分ける形に直した（設計書も更新済み）。
- **Type consistency:** `Chiid.kuku.*` の名前は Task1 の Interfaces が正。Task3 は `_press`/`_state` を自作するため、Task3 内で完結。
- **Proportion:** 設計書より長いのは、タスクごとのテストの具体値を書いたため。コード本体は書いていない。
