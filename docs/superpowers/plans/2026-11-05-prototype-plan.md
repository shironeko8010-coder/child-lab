# 子ども向け学習アプリ 試作 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共通基盤（`shared/`）と、知育アプリ（5歳）のひらがなミニゲーム1つを、オフラインで動く形で完成させる。

**Architecture:** 素のJSを `window.Chiid` という1つの名前空間にぶら下げる。部品（storage, sfx, voice, gate, timer, adaptive, parent）は1ファイル1責務で、通常の `<script>` で読み込む。テストはブラウザで開く `tests/index.html`（自前の小さなテスト実行部。外部ライブラリなし）で行う。

**Tech Stack:** HTML/JS/CSS、localStorage、IndexedDB、Web Speech API、WebAudio、SVG、Service Worker。

**Spec:** `docs/design-spec.md`

## Global Constraints
- 通信なし。外部ライブラリ・CDN・外部フォント不使用。広告・課金・解析・外部リンクなし。
- 保存先は localStorage / IndexedDB のみ。プロフィールはニックネームのみ。
- ES Modules不使用（通常の `<script>`）。`index.html` をダブルクリックで開いても動く。
- 園児用画面の文字は、ひらがなのみ。間違い時は叱らず、励ます（例：「もういっかい やってみよう！」）。
- タブレット横向き優先。タップ領域は 64px 以上。
- 親画面・設定は、おとなゲートを通らないと開かない。
- ファイルは削除しない。gitコミットは、やまとさんに頼まれたときだけ（この計画にコミット手順は入れていない）。
- テスト実行はPythonが使えないため、ブラウザで `tests/index.html` を開いて行う。

## Review Focus
1. 日本語の読み上げ音声がない端末 → 画面の文字と効果音だけで、最後まで遊べる（`voice.speak` は例外を出さず、すぐ終わる）。
2. localStorage / IndexedDB が使えない（プライベートモード等）→ 保存せずに動き続け、エラーで止まらない。
3. なぞり中の手のひら接触（マルチタッチ）・画面の回転/サイズ変更 → 最初の1本の指だけ採用。サイズ変更時は描画を作り直す。
4. 日付またぎ（0時）・利用時間超過が問題の途中で起きる → 今の問題を終えてからお休みメッセージを出す。
5. おとなゲートで3回間違える → 30秒ロック。選択肢の連打（ダブルタップ）→ 1回だけ採点する。

## ファイル構成
| ファイル | 責務 |
|---|---|
| `tests/runner.js`, `tests/index.html` | テスト実行部と、全テストの読み込み |
| `shared/ui.css` | 共通の見た目（大ボタン、色、ごほうびアニメ） |
| `shared/storage.js` | 設定・プロフィール・学習ログ・利用秒数の保存、書き出し、リセット |
| `shared/sfx.js` | 効果音・BGM（合成）とON/OFF |
| `shared/voice.js` | 音声読み上げ |
| `shared/gate.js` | おとなゲート |
| `shared/timer.js` | 1日の利用時間の管理 |
| `shared/adaptive.js` | 難易度調整・苦手の重み付け出題 |
| `shared/parent.js` | 親画面 |
| `app-chiiku/data.js`, `trace.js`, `game.js`, `index.html`, `app.css` | ひらがなの教材、なぞり判定、ゲーム画面 |
| `sw.js`, `manifest.json` | オフライン対応 |

---

### Task 1: 土台（テスト実行部と共通CSS）
**Files:** Create `tests/runner.js`, `tests/index.html`, `shared/ui.css`, `shared/core.js`
**Interfaces:**
- Produces: `window.Chiid = {}`（`shared/core.js`）。`Chiid.test(name: string, fn: () => void | Promise<void>)`、`Chiid.assertEq(actual, expected)`（異なれば throw）。テスト結果は `#summary` に `PASS n / FAIL m` と表示し、失敗の詳細は `#failures` に出す。

- [ ] **Step 1:** `Chiid.test` を使うダミーテスト2つ（成功1・失敗1）で `tests/index.html` を作り、ブラウザで開く。
- [ ] **Step 2:** `runner.js` を実装する。Expected: `#summary` が `PASS 1 / FAIL 1`。
- [ ] **Step 3:** 失敗のダミーを消す。Expected: `PASS 1 / FAIL 0`。
- [ ] **Step 4:** `ui.css` を作る。色の変数、`.btn-big`（最小 64px、角丸、押下アニメ）、`.reward-star`（キラッと出るアニメ）、横向き優先のレイアウト。
- [ ] **検証:** ブラウザの画面サイズを 1280×800 と 800×1280 にして、ボタンが画面外にはみ出さない。

### Task 2: storage（保存）
**Files:** Create `shared/storage.js`; Test `tests/storage.test.js`
**Interfaces:**
- Produces（すべて `Chiid.storage.` 配下）:
  - `init(): Promise<void>`
  - `getSettings(): {dailyLimitMin: number, bgmOn: boolean, sfxOn: boolean}`（初期値 30 / true / true。`dailyLimitMin` が 0 なら制限なし）、`setSettings(patch)`
  - `addProfile(nickname: string, kind: 'chiiku'|'benkyo'): string`（id を返す）、`listProfiles()`, `setActive(id)`, `getActive(): Profile|null`
  - `logAnswer({profileId, area, itemId, correct, level}): Promise<void>`、`getLogs(profileId): Promise<LogEntry[]>`（各 `LogEntry` は `ts: number` つき）
  - `addPlaySeconds(profileId, dateStr 'YYYY-MM-DD', sec)`、`getPlaySeconds(profileId, dateStr): number`、`listPlayDays(profileId): {date, sec}[]`
  - `exportAll(): Promise<string>`（JSON文字列）、`resetAll(): Promise<void>`

- [ ] **Step 1:** 失敗するテストを書く。`addProfile('たろう','chiiku')` → `listProfiles().length===1`。`logAnswer` 2件 → `getLogs` が2件。`addPlaySeconds` を2回呼ぶと合算される。`resetAll` 後は全部空になる。`exportAll` の JSON に `ニックネーム` が含まれる。
- [ ] **Step 2:** 実行して失敗を確認する。
- [ ] **Step 3:** 実装する。設定・プロフィール・利用秒数は localStorage（キー接頭辞 `chiid.`）、ログは IndexedDB（DB名 `chiid`、store `logs`、index `profileId`）。**localStorage / IndexedDB が使えないときは、メモリ上の保存に切り替えて例外を出さない**（Review Focus 2）。
- [ ] **Step 4:** 追加テスト：保存不可を再現（`Chiid.storage._forceMemory(true)`）しても上の動作が通る。
- [ ] **Step 5:** 実行して全部通る（`FAIL 0`）。

### Task 3: sfx（効果音・BGM）
**Files:** Create `shared/sfx.js`; Test `tests/sfx.test.js`
**Interfaces:**
- Produces: `Chiid.sfx.play(name: 'tap'|'correct'|'oops'|'star'): void`、`startBgm(): void`、`stopBgm(): void`、`setSfxOn(b)`, `setBgmOn(b)`、`isSfxOn()`, `isBgmOn()`。`AudioContext` は最初のタップで作る（ブラウザの自動再生制限のため）。`oops` は低く叱る音にせず、やわらかい2音にする。

- [ ] **Step 1:** テスト：`setSfxOn(false)` 後は `play('correct')` が `AudioContext` を作らない（`Chiid.sfx._ctxCreated()===false`）。`setSfxOn(true)` で `play('tap')` を呼んでも例外が出ない。`startBgm` → `stopBgm` で `isBgmPlaying()===false`。
- [ ] **Step 2:** 失敗を確認 → 実装（OscillatorNode で合成。BGMは短いループ旋律）→ 通ることを確認。
- [ ] **検証（耳で確認＝やまとさんに依頼）:** 4つの音が不快でないこと。

### Task 4: voice（読み上げ）
**Files:** Create `shared/voice.js`; Test `tests/voice.test.js`
**Interfaces:**
- Produces: `Chiid.voice.speak(text: string): Promise<void>`（読み終わるか、最大6秒で resolve。**reject しない**）、`cancel(): void`、`isAvailable(): boolean`。`lang='ja-JP'`、`rate=0.85`。

- [ ] **Step 1:** テスト：`speechSynthesis` を無効化した状態（`Chiid.voice._disable()`）で `await speak('あ')` がすぐ resolve し、`isAvailable()===false`。
- [ ] **Step 2:** 失敗を確認 → 実装 → 通ることを確認。
- [ ] **検証（実機＝やまとさんに依頼）:** タブレットで日本語が読み上げられる。

### Task 5: gate（おとなゲート）
**Files:** Create `shared/gate.js`; Test `tests/gate.test.js`
**Interfaces:**
- Produces: `Chiid.gate.makeProblem(rng: () => number): {question: string, answer: number}`（`a×b+c`、a,b は 6〜9、c は 11〜19。例 `7×8+13`）、`Chiid.gate.open(onPass: () => void, onCancel?: () => void): void`（数字キーのモーダルを出す。3回間違えると30秒ロック）、`Chiid.gate._check(problem, input: string): boolean`。

- [ ] **Step 1:** テスト：`rng=()=>0` で `makeProblem` の答えが `6*6+11=47`。`_check(p,'47')` は true、`'46'` と `''` は false。3回連続の誤答のあと `Chiid.gate._isLocked()===true`。
- [ ] **Step 2:** 失敗を確認 → 実装 → 通ることを確認。
- [ ] **Step 3:** モーダルの見た目：数字ボタン 0〜9（64px以上）、「けす」「ひらく」。文言は漢字・ひらがな混じり可（大人向け）。

### Task 6: timer（利用時間）
**Files:** Create `shared/timer.js`; Test `tests/timer.test.js`
**Interfaces:**
- Consumes: `Chiid.storage.getSettings/addPlaySeconds/getPlaySeconds`
- Produces: `Chiid.timer.start(profileId, now?: () => Date)`、`stop()`、`remainingSec(profileId): number | null`（制限なしは null）、`isOver(profileId): boolean`、`onOver(cb)`。10秒ごとに `addPlaySeconds`。画面が隠れている間（`visibilitychange`）は数えない。日付は端末のローカル日付（0時で切り替え）。

- [ ] **Step 1:** テスト（時計を差し替える）：`dailyLimitMin=1` で 60 秒ぶん進めると `isOver===true`。`dailyLimitMin=0` で `remainingSec===null`。23:59:50 → 00:00:10 をまたぐと、秒数が別の日に記録される。
- [ ] **Step 2:** 失敗を確認 → 実装 → 通ることを確認。

### Task 7: adaptive（難易度）
**Files:** Create `shared/adaptive.js`; Test `tests/adaptive.test.js`
**Interfaces:**
- Produces: `Chiid.adaptive.nextLevel(recent: boolean[], level: number, maxLevel: number): number`（直近5問が対象。5問未満なら据え置き。4問以上正解で +1、2問以下で −1、その間は据え置き。1〜maxLevel の範囲）、`Chiid.adaptive.pickWeighted(ids: string[], missCounts: Record<string, number>, rng: () => number): string`（間違えた回数が多いほど出やすい。重み＝`1 + missCounts[id]`）。

- [ ] **Step 1:** テスト：`nextLevel([true,true,true,true,false],1,3)===2`、`nextLevel([false,false,true,false,false],2,3)===1`、`nextLevel([false,false,false,false,false],1,3)===1`、`nextLevel([true,true,true,true,true],3,3)===3`、`nextLevel([true,true],1,3)===1`。`pickWeighted(['a','b'],{a:0,b:3},()=>0.5)==='b'`（重み 1 と 4、合計5、0.5×5=2.5 は b の範囲）。
- [ ] **Step 2:** 失敗を確認 → 実装 → 通ることを確認。

### Task 8: ひらがな教材と、なぞり判定
**Files:** Create `app-chiiku/data.js`, `app-chiiku/trace.js`; Test `tests/trace.test.js`
**Interfaces:**
- Produces:
  - `Chiid.hira.ITEMS: {ch: string, word: string, pic: string, row: 1|2}[]`。10件：あ(あり🐜) い(いぬ🐶) う(うさぎ🐰) え(えび🦐) お(おに👹) か(かに🦀) き(きりん🦒) く(くま🐻) け(けーき🍰) こ(こあら🐨)。`row` は あ行=1、か行=2。
  - `Chiid.hira.levelConfig(level: 1|2|3): {pool: string[], choices: number}`（Lv1＝あ行5文字から3択、Lv2＝10文字から3択、Lv3＝10文字から4択）。
  - `Chiid.trace.score(target: Uint8Array, user: Uint8Array): {coverage: number, overshoot: number, pass: boolean}`。両者は同じ大きさの 0/1 マスク。`coverage`＝目標の画素のうち、なぞった線（太さ込み）に覆われた割合。`overshoot`＝なぞった画素のうち、目標の外にある割合。`pass = coverage >= 0.6 && overshoot <= 0.4`。
  - `Chiid.trace.rasterizeGlyph(ch: string, size: number): Uint8Array`（Canvas に文字を描いて 0/1 マスク化）。

- [ ] **Step 1:** テスト：目標＝4×4で全部1、ユーザー＝全部1 → coverage 1, overshoot 0, pass。ユーザー＝全部0 → pass false。ユーザー＝目標外だけ1 → overshoot 1, pass false。目標の半分だけなぞる → coverage 0.5, pass false。`ITEMS.length===10`、`levelConfig(3).choices===4`。
- [ ] **Step 2:** 失敗を確認 → 実装 → 通ることを確認。
- [ ] **検証（目で確認）:** `rasterizeGlyph('あ',200)` のマスクを画面に出すと、「あ」の形になっている。

### Task 9: 親画面
**Files:** Create `shared/parent.js`; Test `tests/parent.test.js`
**Interfaces:**
- Consumes: `Chiid.storage.*`, `Chiid.gate.open`
- Produces: `Chiid.parent.summarize(logs: LogEntry[], days: {date,sec}[]): {playDays: number, totalMin: number, byArea: Record<string,{total:number,correct:number,rate:number}>, weak: {itemId: string, misses: number}[]}`（`weak` は間違いの多い順に最大5件）、`Chiid.parent.render(container: HTMLElement): void`（プロフィール切替、遊んだ日・時間、分野別正答率、苦手、1日の目安の変更、BGM/効果音のON/OFF、書き出し、リセット）。リセットは確認ダイアログを経て、もう一度おとなゲートを通す。書き出しは `Blob` のダウンロード（通信なし）。

- [ ] **Step 1:** テスト：logs＝ひらがな 4件（正解3）→ `byArea.hiragana.rate===0.75`。同じ itemId を2回間違えると `weak[0].misses===2`。ログ0件でも例外が出ず `playDays===0`。
- [ ] **Step 2:** 失敗を確認 → `summarize` を実装 → 通ることを確認。
- [ ] **Step 3:** `render` を実装（画面）。**検証：** 画面を開き、数字が `summarize` と一致する。

### Task 10: ひらがなゲーム画面
**Files:** Create `app-chiiku/index.html`, `app-chiiku/game.js`, `app-chiiku/app.css`, `index.html`（ルート。アプリ選択の入口）
**Interfaces:**
- Consumes: Task 2〜9 の全部品。
- Produces: `Chiid.game.start(profileId: string): void`。流れは、読み上げ → 3〜4択（絵カード）→ なぞる → ごほうび。ログは `area:'hiragana'`、`itemId` はその文字。

- [ ] **Step 1:** 初回起動：プロフィールがなければ「ニックネーム」入力（ひらがなキーボードは端末任せ）。プロフィールをつくり、`setActive`。
- [ ] **Step 2:** ホーム画面：大きな「あそぶ」ボタン、右上に歯車（おとなゲートを通って親画面へ）、BGMのON/OFFボタン。
- [ ] **Step 3:** 1問の流れ：`pickWeighted` で文字を選ぶ → 読み上げ「『あ』は どれかな？」→ 選択肢をタップ。正解→`sfx.play('correct')`、星のアニメ → なぞり画面へ。不正解→`sfx.play('oops')`、「おしい！ もういっかい えらんでみよう」、選択肢は残す（何度でも選べる）。**選択肢の連打は1回だけ採点する**（Review Focus 5）。
- [ ] **Step 4:** なぞり画面：Canvas に薄い文字を描き、Pointer Events でなぞる。**最初の1本の指だけ採用**（`pointerId` で固定）。「できた！」ボタンで `trace.score`。合格→星＋「すごい！」。不合格→「もうちょっと！ いっしょにやってみよう」で、同じ文字をやり直せる。サイズ変更・回転で Canvas を作り直し、なぞりは消す（Review Focus 3）。
- [ ] **Step 5:** 1問終わるたびに `logAnswer`、`adaptive.nextLevel`（直近5問）でレベルを更新。`timer.isOver` が true なら、次の問題に進まず、お休みメッセージ「きょうは ここまで！ また あした あそぼうね」を出す（問題の途中では出さない。Review Focus 4）。
- [ ] **Step 6:** 音声が使えない端末（`voice.isAvailable()===false`）では、問題文を画面に大きく出す（Review Focus 1）。
- [ ] **検証:** ブラウザで、最初から最後まで通して遊べる。

### Task 11: オフライン対応
**Files:** Create `sw.js`, `manifest.json`, アイコン（SVG）、Modify 各 `index.html`
**Interfaces:**
- Produces: `sw.js` は、全ファイル一覧（`PRECACHE`）を最初に保存し、以降はキャッシュ優先で返す。`CACHE_NAME = 'chiid-v1'`（更新時は番号を上げる）。`manifest.json` は `display:'fullscreen'`、`orientation:'landscape'`、`lang:'ja'`。

- [ ] **Step 1:** `PRECACHE` に実在する全ファイルを入れる。**テスト：** `tests/index.html` に、`PRECACHE` の各URLが 200 で返ることを確かめるテストを足す。
- [ ] **Step 2:** `http://localhost` で開き、一度読み込む → ブラウザの開発者ツールで「オフライン」に切り替えて再読み込み → 表示される。
- [ ] **注意（未確認の制約）:** Service Worker は `localhost` か `https` でしか動かない。`index.html` を直接開く場合は、オフライン保存は働かない（アプリ自体は動く）。公開場所は、やまとさんと相談して決める。

### Task 12: QA（動かして確認し、直す）
**Files:** Create `docs/qa-report.md`
- [ ] **Step 1:** `tests/index.html` が `FAIL 0`。
- [ ] **Step 2:** 設計書 §6 のQAチェック7項目を、1つずつ実施する。「通信ゼロ」はブラウザのネットワーク一覧で確認する（`index.html` 読み込み後に、外部へのリクエストが0件）。
- [ ] **Step 3:** 子ども目線の確認：文字が読めるか、迷うボタンはないか、叱る言葉はないか。園児用画面に漢字が混ざっていないかを `app-chiiku/` 内の文字列で検索して確かめる。
- [ ] **Step 4:** 見つかった問題を直し、結果を `qa-report.md` に書く。確認できなかったこと（実機、耳での確認）を明記する。
- [ ] **Step 5:** やまとさん向けの実機確認リスト（手順、期待される結果つき）を、`qa-report.md` の末尾に書く。

---
## Self-Review メモ
- 設計書の範囲（土台5部品＋親画面＋ひらがな1ゲーム＋オフライン＋QA）に、Task 1〜12 が対応している。
- 型と名前：`logAnswer`→`getLogs`→`summarize` の `LogEntry`、`itemId`、`area:'hiragana'` は Task 2・9・10 で一致している。
- 設計書にない追加：なぞり合格の閾値（0.6 / 0.4）と、ゲートのロック（30秒）。試作で調整する。
