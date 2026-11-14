# ちいく「めいろ」とホーム2ページ化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 知育アプリに、指でひよこを引っぱって進む「めいろ」（レベル1〜5、毎回ちがう形）を足し、知育のホームを1ページ6まいの2ページにする。

**Architecture:** `app-chiiku/meiro.js` に `C.meiro` を作る。前半は画面なしでテストできる関数（めいろを作る・道を探す・置き場所・判定・レベル）、後半は画面（shiritori.js と同じ形で `C.chiikuUi` の部品を使う）。ホームの並びとページ計算は `game.js` に `C.chiikuHome` として出し、テストする。

**Tech Stack:** 素の HTML/JS/CSS（通常の `<script>`、ES Modules なし、ビルドなし）、SVG、WebAudio（`C.sfx`）、ずんだもん音声（`C.voice`）。テストは `tests/index.html`（`perl tools/serve.pl . 8765` で開き、`#summary` が `PASS n / FAIL 0`）。

**Spec:** `docs/superpowers/specs/2026-11-14-chiiku-meiro-design.md`（見本：`docs/maze-samples.html`。めいろ作り・解く手順は見本で225個確かめ済み）

## Global Constraints

- 通信なし。外部ライブラリ・CDN・外部フォント・外の画像は使わない。絵は SVG。
- 園児の画面の字は ひらがなだけ。叱らない。
- 字：主な字 18px 以上・補足 16px 以上。ボタン 56px 以上（高さ 340px 以下の横向きは 48px）。マスも同じ下限。
- スクロールなし：スマホ 667×375・740×360・812×375・375×667・360×740・390×844、タブレット 1280×800・1024×600。
- 記録：`area: 'meiro'`、`itemId: 'lv' + レベル`、`level`。「せいかい」＝ヒントが出る前にゴール。
- 読み上げ文は `speak('…')` の形で書く（`tools/voice-lines.js` が集める）。部品は「は」で始めない。
- ファイルを変えたら `sw.js` の `CACHE_NAME` を上げ、新しいファイルは PRECACHE に入れる（`pages.yml` は app-chiiku フォルダごと公開するので変更不要）。
- ファイルは削除しない。コミットは、やまとさんに頼まれたときだけ（このプランにコミットの手順は置かない）。
- PowerShell は使わない。Python は動かない（perl / Bash）。

## Review Focus

1. 小さい横向きスマホ（740×360）でレベル3〜5：`fit` がマス数を減らしても、ほし3つ・かぎ・とびらが置けて解けること（Task 1 にテストあり）。
2. 指をめいろの外まで動かしたとき・指を2本置いたとき：ひよこが飛んだり、引っぱりが切れたまま固まったりしない（Task 2 のテスト `meiro: 板の外へ指を出しても 止まるだけ`）。
3. ゴール直後に指を動かし続けたとき：2回ゴールしたり、記録が2回入ったりしない（Task 2 のテスト `meiro: ゴールは1回だけ記録する`）。
4. 遊びの途中でお休みの時間（1日の利用時間）を超えたとき：次のめいろへ進む前にお休み画面になる（Task 2 のテスト `meiro: 時間を超えていたら つぎのめいろの前に お休み`）。
5. 2ページ目で遊んで「おうち」で戻る → 2ページ目が出る。ホームを開き直すと1ページ目（Task 3 のテスト `home: 遊びのあるページを返す`）。

---

### Task 1: めいろの しくみ（画面なし）

**Files:**
- Create: `app-chiiku/meiro.js`（この Task では前半の関数だけ。`start` は Task 2）
- Create: `tests/meiro.test.js`
- Modify: `tests/index.html`（本体の一覧の `'shiritori'` のあとに `'meiro'`、テストの一覧の最後に `'meiro'`）

**Interfaces:**
- Produces（`C.meiro`）:
  - `AREA = 'meiro'`, `MAX_LEVEL = 5`, `ROUND = 3`, `MIN_CELL = 56`, `MIN_CELL_LOW = 48`
  - `LEVELS[lv] = { land:[w,h], port:[w,h], tab:[w,h], loops, stars, key }`（値は設計書4章：1 `[5,3]/[4,5]/[6,4]` loops .25；2 `[7,4]/[4,6]/[8,5]` .05；3・4 `[10,5]/[6,8]/[12,8]` .05；5 同じ大きさ .03。stars は 3・5 で3、key は 4・5）
  - `dims(level, kind) -> {w, h}`（kind: `'land'|'port'|'tab'|'tabPort'`。`'tabPort'` は tab の入れかえ）
  - `kindOf(viewW, viewH) -> kind`（短い辺 ≥700 で tab 系、向きで land/port・tab/tabPort）
  - `fit(level, kind, availW, availH, minCell) -> {w, h, cell}`
  - `make(level, w, h, rng) -> {w, h, cells, start, goal, stars, key, door}`（位置は `'x,y'`。cells[y][x] = `{n,e,s,w}`、1=道）
  - `canMove(maze, from, dir, state) -> 'x,y' | null`（dir: `'n'|'e'|'s'|'w'`、state: `{hasKey, starsLeft}`）
  - `path(maze, from, to, state) -> ['x,y', …] | null`（from を含む）
  - `nextTarget(maze, at, state) -> 'x,y'`（state に `got: {位置:1}` も入る）
  - `speakStart(level) -> 文`（設計書8章のはじめの文）
  - `progressFromLogs(logs) -> {level, recent}`（shiritori と同じ形。`C.adaptive.nextLevel(recent, level, 5)`）
  - `TEXT = { star:'ほし ゲット！', lidOpen:'ごはんの ふたが あいたよ！', findKey:'つぎは かぎを さがそう', doorOpen:'とびらが あいたよ！', doorOpenStars:'とびらが あいた！ ほしも あつめよう', goal:'ごはん だ！ やったね', hint:'ひかっている みちを すすんでね', touchChick:'ひよこを さわって うごかしてね' }`

- [ ] **Step 1: テストを書く** — `tests/meiro.test.js`（shiritori.test.js と同じ形）。乱数は `function seeded(n){ var s=n; return function(){ s=(s*1103515245+12345)%2147483648; return s/2147483648; }; }`。
  - `meiro: 定数と表`：`AREA==='meiro'`、`MAX_LEVEL===5`、`ROUND===3`、`dims(1,'land')` が `{w:5,h:3}`、`dims(3,'port')` が `{w:6,h:8}`、`dims(3,'tabPort')` が `{w:8,h:12}`。
  - `meiro: kindOf`：`kindOf(812,375)==='land'`、`(375,667)==='port'`、`(1280,800)==='tab'`、`(800,1280)==='tabPort'`。
  - `meiro: fit はマスの下限を守る`：8つの画面それぞれで `availW = viewW - 24`、`availH = viewH - 72 - 14`（たて向きは `- 134 - 14`）、minCell は 高さ≤340 で 48 そうでなければ 56。全レベルで `cell >= minCell`、`w >= 3 && h >= 3`、`w <= dims.w && h <= dims.h`。`fit(3,'land',788,289,56)` は `{w:10,h:5}`（812×375）。`fit(3,'land',716,274,56).h === 4`（740×360）。
  - `meiro: めいろは全部つながり、ゴールは行き止まり`：全レベル×（land/port/tab の表の大きさ と 740×360 の fit 後の大きさ）×乱数50個で、start から全マスへ行ける（ふた・とびらを無視した道で）、goal の道は1本、`start==='0,'+(h-1)`、`goal===(w-1)+',0'`。
  - `meiro: ほし・かぎ・とびらの置き方`：レベル3・5は stars 3つ（ちがう場所、start/goal/key/door と重ならない）、1・2・4は0。key/door はレベル4・5だけ。door はゴールに道でつながるただ1つのマス。key は door を通らずに start から行ける。
  - `meiro: canMove`：壁の方向は null。`hasKey:false` で door へは null、`true` なら進める。`starsLeft>0` で goal へは null。
  - `meiro: どのめいろも解ける`：上と同じ組み合わせで、`at=start`、state を更新しながら `p = path(maze, at, nextTarget(maze, at, state), state)` の `p[1]` へ1マスずつ進め（ほし・かぎのマスで拾う）、500手以内に goal に着く。
  - `meiro: speakStart`：1と2が `'ごはんまで つれていってね'`、3 `'ほしを 3つ ひろってから、ごはんへ いこう'`、4 `'かぎで とびらを あけて、ごはんへ いこう'`、5 `'ほし 3つと かぎを ひろって、ごはんへ いこう'`。
  - `meiro: progressFromLogs`：`[]` は level 1。level 1 で correct true が5つ並ぶと level 2。

- [ ] **Step 2: テストを開いて失敗を確かめる** — `http://localhost:8765/tests/index.html`。Expected：`meiro:` のテストが `C.meiro` がないため FAIL。

- [ ] **Step 3: `app-chiiku/meiro.js` の前半を書く** — 作り方は見本 `docs/maze-samples.html` の `makeMaze`・ゴールを行き止まりにする所・かぎ／ほしの置き方・`bfs`／`target` と同じ考え方（設計書5・6章）。`make` は作ったあと solve できるか確かめ、だめなら同じ rng で作り直す（最大20回）。`fit`：`cell = floor(min(availW/w, availH/h))`、`cell < minCell` の間、`availW/w < availH/h` なら w を、そうでなければ h を1減らす（どちらも3未満にしない）。

- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`meiro:` がすべて PASS。ほかのテストも PASS のまま（`voice:` の「すべて音声ファイルがある」は、この時点では文がまだないので変わらない）。

---

### Task 2: めいろの画面

**Files:**
- Modify: `app-chiiku/meiro.js`（後半：画面・指の動き・ヒント・1回分・ごほうび・記録）
- Modify: `app-chiiku/index.html`（`shiritori.js` のあとに `<script src="meiro.js"></script>`）
- Modify: `app-chiiku/app.css`（`.mr-*` の見た目。最後に足す）
- Modify: `shared/parent.js`（AREA_NAMES に `meiro: 'めいろ'`）
- Modify: `sw.js`（PRECACHE に `'app-chiiku/meiro.js'`、CACHE_NAME を上げる）
- Modify: `tools/voice-lines.js`（SOURCES の `'app-chiiku/shiritori.js'` のあとに `'app-chiiku/meiro.js'`）
- Test: `tests/meiro.test.js`

**Interfaces:**
- Consumes: Task 1 の `C.meiro` すべて。`C.chiikuUi`（`newScreen, topBar, chara, bubble, button, svg, el, play, speak, speakThen, later, showRest, STAR, ICO, screenId`）、`C.timer.isOver(pid)`、`C.storage.logAnswer/getLogs`。
- Produces: `C.meiro.start(profileId)`。テスト用 `C.meiro._state() -> {phase, level, round, at, got, hasKey, hinted, done, maze}`（phase: `'play'|'reward'|'rest'`）、`C.meiro._moveToward(cell)`（指が cell にあるのと同じ動き。最大4マス）、`C.meiro._idle(sec)`（sec 秒止まったのと同じ）、`C.meiro._next()`（ゴール後の待ちを飛ばす）。`#app` がないとき（テスト）は描かずに状態だけ動く（benkyo の screen と同じ考え方）。

- [ ] **Step 1: テストを書く**
  - `meiro: start でレベル1のめいろ`：記録なしで `start(pid)` → `_state().level===1`、`round===1`、`at===maze.start`。
  - `meiro: 壁の方へは進まない`：`_moveToward` で壁の向こうのマスを指しても `at` が変わらない。
  - `meiro: 板の外へ指を出しても 止まるだけ`：`_moveToward(null)` と `_moveToward('99,99')` で例外が出ず `at` が変わらない。
  - `meiro: ゴールは1回だけ記録する`：path どおりに `_moveToward` で goal へ → `done===true`。そのあと `_moveToward` を続けても、`logAnswer` の記録は1件（area 'meiro'、itemId 'lv1'、correct true、level 1）。
  - `meiro: ヒントが出たら まちがい`：`_idle(6)` → `hinted===true`。ゴールすると記録は correct false。`_idle(5)` では hinted false。
  - `meiro: 3つで ごほうび`：3回ゴール（`_next` をはさむ）→ 画面の状態が reward（`_state().phase==='reward'`）。
  - `meiro: 時間を超えていたら つぎのめいろの前に お休み`：`C.timer.isOver` を true にしてから `_next()` → `phase==='rest'`（テスト後に元へ戻す）。
  - `meiro: 親画面に「めいろ」の名前がある`：`shared/parent.js` の本文に `meiro: 'めいろ'`。

- [ ] **Step 2: テストを開いて失敗を確かめる** — Expected：上のテストが FAIL（`start` がない）。

- [ ] **Step 3: 画面を書く** — 見本 `docs/maze-samples.html` の見た目と動きにそろえる（上の帯は `ui.topBar({ home:true })` に ふきだし・集めるもの一覧を入れる。スマホたて向きは ふきだしを2行目）。指は pointer イベント＋`setPointerCapture`、板は `touch-action:none`。ひよこのマスかとなりで始まらなかったタッチを3回続けたら `speak(TEXT.touchChick)`。ほし・かぎ・ゴールで `ui.play('star'|'correct')` と TEXT の声。ゴールで `logAnswer`、`ui.later` で約1.5秒後に次（3つめは ごほうび。ごほうびは shiritori の `showReward` と同じ形で、「つぎへ」で新しい1回分）。次へ進む前に `C.timer.isOver` を見る。`resize`／`orientationchange` で kind が変わったら同じレベルで作り直す（round はそのまま、記録しない）。ヒントは1秒ごとの見張りで6秒、はじめて出たとき `speak(TEXT.hint)`。

- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`meiro:` すべて PASS、ほかも PASS（`voice:` の音声ファイルのテストは、めいろの文の分だけ FAIL ＝ Task 4 で直る）。

- [ ] **Step 5: 大きさを確かめる** — ブラウザの iframe でスマホ6サイズ・タブレット2サイズにして、レベル1・3・5で `document.documentElement.scrollHeight === 高さ`、マスが 56px（高さ340以下 48px）以上、上の帯の字が切れていない。

---

### Task 3: ホームの2ページと「めいろ」のカード

**Files:**
- Modify: `app-chiiku/game.js`（`showHome` と `playCard`。`HOME_ICO.meiro` を足す）
- Modify: `app-chiiku/app.css`（ホームの ◀▶ と ●○、1ページ3まい×2だん。最後に足す）
- Test: `tests/meiro.test.js`

**Interfaces:**
- Produces（`game.js` で）: `C.chiikuHome = { ORDER: ['hira','kazu','tokei','iro','machi','kai','sr','dou','meiro'], PER_PAGE: 6, pageCount() -> 2, pageOf(kind) -> 0|1, kinds(page) -> [kind…] }`。めいろのカードは `playCard('めいろ', 'meiro', function () { C.meiro.start(p.id); })`。

- [ ] **Step 1: テストを書く**
  - `home: 並びとページ`：`pageCount()===2`、`kinds(0)` が `['hira','kazu','tokei','iro','machi','kai']`、`kinds(1)` が `['sr','dou','meiro']`。
  - `home: 遊びのあるページを返す`：`pageOf('meiro')===1`、`pageOf('hira')===0`、知らない kind は 0。
  - `home: めいろのカードがある`：`game.js` の本文に `playCard('めいろ', 'meiro', function () { C.meiro.start(p.id); });`。

- [ ] **Step 2: テストを開いて失敗を確かめる** — Expected：`home:` が FAIL。

- [ ] **Step 3: ホームを書く** — いまのページは game.js の中の変数だけで覚える（保存しない）。遊びのカードを押したとき、そのページを覚え、ホームに戻ったらそのページを出す。アプリを開いたときは0ページ。◀▶ は `button`（56px以上、端のページでは disabled でうすく）、●○ はページ数ぶん。横のスワイプ（pointerdown から pointerup で横に40px以上、たてより横が大きい）でもめくる。めくったら `play('tap')`。カードの並べ方：たて・よことも `grid-template-columns: repeat(3, …)`。いまのホームの「最後の段をまんなかへ寄せる」指定（`app.css` のしりとりの所）は、2ページ目が3まい1だんなので いらなくなる（上書きで止める。消さない）。めいろの絵は「生けがきの めいろの中に ひよこ」のSVG、色は `.hc-meiro`（ほかと ちがう色）。

- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`home:` すべて PASS、ほかも PASS。

- [ ] **Step 5: 大きさを確かめる** — 8つの画面の大きさで、ホームの1ページ目・2ページ目ともスクロールなし、カード名の字 18px 以上、◀▶ 56px 以上（高さ340以下 48px）。

---

### Task 4: 声・設計書・しあげ

**Files:**
- Modify: `tools/voice/lines.tsv`・`tools/voice/made.tsv`・`shared/voice-clips.js`・`voice/z/*.ogg`（作るツールが書く）
- Modify: `docs/design-spec.md`（8章の表に `| 知育 | めいろ（指でひよこを引っぱって ごはんへ。ほし・かぎと とびら） | docs/superpowers/specs/2026-11-14-chiiku-meiro-design.md |`）

- [ ] **Step 1: 読み上げ文の一覧を作る** — `tools/voice/lines.tsv` を控えてから `http://localhost:8765/tools/voice-lines.html` を開く（Expected：「保存しました」）。差分は めいろの文（設計書8章の12文）だけで、今ある行は変わらない。
- [ ] **Step 2: 読みを確かめる** — やまとさんに VOICEVOX の起動をお願いする。`perl tools/voice/make.pl --preview` で、めいろの文の読み（特に「ゲット」「ふた」「とびら」）がおかしくないか見る。おかしければ `tools/voice/overrides.tsv` に足す。
- [ ] **Step 3: 音声ファイルを作る** — `perl tools/voice/make.pl`。Expected：「失敗: 0」。
- [ ] **Step 4: 全テスト** — `tests/index.html`。Expected：`PASS n / FAIL 0`（サーバーが不安定で「Failed to fetch」が出たら開き直す）。
- [ ] **Step 5: 全体の大きさの確認** — ちいく・べんきょうの全画面の最初の場面を、8つの画面の大きさで スクロールなしのまま（今までの確認と同じ方法）。
