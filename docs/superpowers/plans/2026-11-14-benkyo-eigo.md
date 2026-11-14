# べんきょう「えい語」とトップ2ページ化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 勉強アプリに、英語の「きく」（英語を聞いて絵を選ぶ）と「よむ」（アルファベット）を足し、勉強のトップを1ページ6まいの2ページにする。

**Architecture:** 英語の声は新しい `shared/voice-en.js`（`C.voiceEn`、端末の通信しない英語の声）にまとめ、今の `voice.js` はさわらない。ことばは `subjects/eigo-data.js`、問題作りは `subjects/eigo.js`（`C.eigo`、画面なしでテスト）、画面は `eigo-screen.js`（`B.eigoScreen`、hantai-screen.js と同じ形）。トップの並びとページ計算は `main.js` に `B.home` として出す（知育の `C.chiikuHome` と同じ考え方）。

**Tech Stack:** 素の HTML/JS/CSS（通常の `<script>`、ES Modules なし）、SVG、Web Speech API（speechSynthesis。`localService` の声だけ）、WebAudio（`C.sfx`）、ずんだもん音声（`C.voice`）。テストは `tests/index.html`（`perl tools/serve.pl . 8765`、`#summary` が `PASS n / FAIL 0`）。

**Spec:** `docs/superpowers/specs/2026-11-14-benkyo-eigo-design.md`

## Global Constraints

- 通信なし。外部ライブラリ・CDN・外部フォント・外の画像は使わない。英語の声は `localService === true` の声だけ。
- 日本語の文：1年生の漢字はそのまま、2年生の漢字は `{漢字|よみ}`、3年生以上の漢字は使わない（ひらがな）。
- 叱らない。字：主な字 18px 以上・補足 16px 以上。ボタン 56px 以上（高さ340px以下の横向きは48px）。
- スクロールなし：スマホ 667×375・740×360・812×375・375×667・360×740・390×844、タブレット 1280×800・1024×600。
- 英語の声：速さ 0.8、en-US → en-GB → ほかの en、同じ中では default を先。読む前に `C.voice.cancel()`、読む間 `C.sfx.duck(true)`。
- 記録：きく `area:'eigoKiku'`・`itemId`＝ことばの id（`テーマ:英語`）・`level`。よむ `area:'eigoYomi'`・`itemId`＝`'L'+レベル+':'+答えの文字`・`level`。
- ファイルを変えたら `sw.js` の `CACHE_NAME` を上げ、新しいファイルは PRECACHE に入れる（`pages.yml` は app-benkyo・shared をフォルダごと公開するので変更不要）。
- ファイルは削除しない。コミットは、やまとさんに頼まれたときだけ（このプランにコミットの手順は置かない）。PowerShell は使わない。

## Review Focus

1. 英語の声の一覧が遅れて届く端末（最初は空、少しして届く）：最初「声がない」と判断したまま「きく」が押せなくならない（Task 1 のテスト `voiceEn: 声があとから届いても 使えるようになる`）。
2. 英語を読んでいる途中で次の問題・ホームへ移ったとき：前の英語が鳴りつづけたり、BGM が下がったままにならない（Task 1 のテスト `voiceEn: cancel で 読み上げを止め、BGM を もどす`）。
3. 正解の直後に別のカードを連打：記録が2回入らない・次の問題が2回進まない（Task 3 のテスト `eigoScreen: 正解のあとの連打は 記録1回`）。
4. 「ぜんぶ」で10問：同じことばが2回出ない（Task 2 のテスト `eigo: ぜんぶで10問 同じことばが出ない`）。
5. 2ページ目の教科から「トップに もどる」→ 2ページ目、トップを開き直すと1ページ目（Task 4 のテスト `home(benkyo): 教科のあるページ`）。

---

### Task 1: 英語の声の部品（`shared/voice-en.js`）

**Files:**
- Create: `shared/voice-en.js`、`tests/eigo.test.js`（この Task では `voiceEn:` のテストだけ）
- Modify: `tests/index.html`（本体の一覧で `'voice'` のあとに `'voice-en'`、テストの一覧の最後に `'eigo'`）

**Interfaces:**
- Produces: `C.voiceEn = { RATE: 0.8, MAX_MS: 5000, available() -> bool, voiceName() -> string, speak(text) -> Promise<void>（reject しない）, cancel(), _override(fakeSynth|null, opts) }（opts は テスト用の `{ maxMs }`）`。fakeSynth は `{ getVoices() -> [{name, lang, localService, default}], speak(utt), cancel(), onvoiceschanged }` の形（本物の speechSynthesis と同じ）。utterance は `{ text, voice, lang, rate, onend, onerror }` を持つ（本物は `SpeechSynthesisUtterance`、偽物のときは普通のオブジェクトでよい）。

- [ ] **Step 1: テストを書く**（`tests/eigo.test.js`。fake は `function fake(voices){ var f={ spoken:[], cancels:0, getVoices:function(){return voices;}, speak:function(u){ f.spoken.push(u); if(f.auto) setTimeout(function(){ u.onend && u.onend(); },10); }, cancel:function(){ f.cancels++; } }; return f; }`）
  - `voiceEn: 通信しない en-US を選ぶ`：声 `[{name:'J',lang:'ja-JP',localService:true},{name:'Net',lang:'en-US',localService:false},{name:'GB',lang:'en-GB',localService:true},{name:'US',lang:'en-US',localService:true}]` → `available()===true`、`voiceName()==='US'`。
  - `voiceEn: 英語の声がなければ 使えない`：ja と ネットの en だけ → `available()===false`、`speak('dog')` が解決し、`spoken.length===0`。
  - `voiceEn: speak は 速さ0.8・終われば解決`：`auto=true` で `speak('dog')` → 解決、`spoken[0].text==='dog'`、`rate===0.8`、`voice.name==='US'`。
  - `voiceEn: 終わらなくても 5秒で解決する`：`auto=false`、`MAX_MS` を `_override` 中は 50 にできる（`_override(fake, {maxMs:50})`）→ 解決する。
  - `voiceEn: 読む前に ずんだもんを止める`：`C.voice.cancel` を差しかえて数える → 1回以上。
  - `voiceEn: 声があとから届いても 使えるようになる`：最初 `[]` → `available()===false`。`voices.push(US)` して `fake.onvoiceschanged()` → `available()===true`。
  - `voiceEn: cancel で 読み上げを止め、BGM を もどす`：`C.sfx.duck` を差しかえて記録 → speak 中に `cancel()` → `fake.cancels>=1`、最後の duck が `false`。
  - 各テストの最後に `_override(null)`。

- [ ] **Step 2: テストを開いて失敗を確かめる** — Expected：`voiceEn:` が `C.voiceEn` なしで FAIL。

- [ ] **Step 3: `shared/voice-en.js` を書く** — 声の選び方は設計書6章（`eigo-koe-test.html` の `score` と同じ考え方）。`onvoiceschanged` で選び直す。speak：`cancel` 相当の後かたづけ → `C.voice.cancel()` → `C.sfx.duck(true)` → 読む → onend／onerror／`MAX_MS` のどれかで `duck(false)` して解決。

- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`voiceEn:` すべて PASS、ほかも PASS のまま。

---

### Task 2: ことばと問題作り（`eigo-data.js`・`eigo.js`）

**Files:**
- Create: `app-benkyo/subjects/eigo-data.js`、`app-benkyo/subjects/eigo.js`
- Modify: `tests/eigo.test.js`、`tests/index.html`（本体の一覧の `zukan-screen.js` のあとに `subjects/eigo-data.js`・`subjects/eigo.js`）

**Interfaces:**
- Produces:
  - `C.eigoData = { THEMES: [{id, name, pic}], WORDS: [{id:'animal:dog', theme:'animal', en:'dog', ja:'いぬ', pic:'🐶' | null, art:'color:red' | 'num:7' | 'shape:circle' | null}], LETTERS: 'abcdefghijklmnopqrstuvwxyz', CONFUSE: [['b','d','p','q'],['m','n'],['u','n'],['i','l','j'],['c','o','e']] }`（THEMES の順・名前・ことばは設計書5章の表のとおり。theme id：animal, color, number, food, fruit, body, greeting, family, school, vehicle, nature, shape。name は ひらがな。pic はテーマの代表の絵文字。いろ・かず・かたちのテーマの代表は 🎨・🔢・🔺）
  - `C.eigo = { KIKU_AREA:'eigoKiku', YOMI_AREA:'eigoYomi', KIKU_MAX:3, YOMI_MAX:4, ROUND_SIZE:10, STAR_EVERY:5, TEXT, wordsOf(themeId), firstLetter(word), makeKiku(level, themeId, rng, opts), makeYomi(level, rng, opts), check(q, choice), itemIdYomi(q), progressFromLogs(logs, area) }`
  - `makeKiku` → `{ answer: word, cards: [word…] }`（opts: `{ used: {id:1}, missCounts: {id:n} }`）
  - `makeYomi` → `{ kind:'upper'|'lower'|'match'|'first', level, prompt, say, answer, choices:[文字…], word }`（upper：prompt＝''、say＝大文字1字、choices＝大文字。lower：say＝小文字、choices＝小文字。match：prompt＝大文字、say＝null、choices＝小文字。first：word＝1語のことば、say＝word.en、answer＝firstLetter、choices＝小文字）
  - `check(q, choice)` は `choice === q.answer`（きくは word オブジェクトか id を比べる：`choice.id === q.answer.id`）
  - `TEXT = { start:'どっちで あそぶ？', theme:'テーマを えらんでね', kiku:'えい{語|ご}を きいて、{絵|え}を えらんでね', yomi12:'きこえた 文字を えらんでね', yomi3:'おなじ 文字の 小文字を えらんでね', yomi4:'さいしょの 文字を えらんでね', again:'もういっかい きいてみよう', again3:'もういっかい みてみよう', reveal:'ひかっている ものだよ', noVoice:'この たんまつでは えい{語|ご}の こえが でません' }`

- [ ] **Step 1: テストを書く**（`gradeOf`・`kanjiOk` は tests/hantai.test.js と同じ関数をこのファイルにも置く。乱数は `seeded(n)`）
  - `eigo: ことば`：WORDS 126こ、THEMES 12、テーマごとの数が 10,10,20,10,11,10,7,8,10,10,10,10（表の順）、`id` は全体で重ならず `theme + ':' + en`、`en` は `/^[a-z]+( [a-z]+)*$/`、絵（pic または art）が全体で重ならない、pic は ZWJ（U+200D）を含まない、`ja` は ひらがな（`/^[ぁ-ゖー ]+$/`）、pic と art のどちらか一方だけある。
  - `eigo: makeKiku のカード`：全テーマ＋'all' × レベル1〜3 × 乱数200 で、カード数（1→3、2・3→4）、答えがちょうど1まい、カードの id が重ならない、レベル1・2は全部が答えのテーマ。
  - `eigo: makeKiku レベル3は 同じ文字で始まることば`：答えが 'animal:bear' になる乱数で（`opts.force` を使わず、200回のうち答えが b で始まるもの）同じ文字で始まるカードが1まい以上。
  - `eigo: ぜんぶで10問 同じことばが出ない`：`used` を積み上げながら `makeKiku(2,'all',…)` を10回 → 答えの id がすべてちがう。
  - `eigo: makeYomi`：レベル1〜4 × 乱数200 で、choices 4つ・重ならない・答えちょうど1つ、1は大文字・2〜4は小文字、3は prompt が大文字で answer がその小文字、4は word.en にスペースがなく answer＝最初の文字。
  - `eigo: まぎらわしい文字`：レベル2・3で答えが 'b' のとき、choices に d・p・q のどれかが入る（200回のうち 'b' のものすべて）。
  - `eigo: check・itemIdYomi`：makeYomi(3) の q で `itemIdYomi(q)==='L3:'+q.answer`、`check(q,q.answer)===true`。
  - `eigo: progressFromLogs は きく・よむ 別々`：eigoKiku で level1 正解5つ → きく level2、よむは level1。
  - `eigo: TEXT の漢字`：TEXT のすべてで `kanjiOk`。

- [ ] **Step 2: テストを開いて失敗を確かめる** — Expected：`eigo:` が FAIL（`C.eigo` なし）。
- [ ] **Step 3: `eigo-data.js`・`eigo.js` を書く** — 答えは `C.adaptive.pickWeighted`（missCounts）で選び、`used` のものは除く（テーマのことばが全部 used なら used を無視）。レベル3の同じ文字は全ことばから、足りなければ同じテーマから。よむのまちがい文字：レベル2・3は答えの CONFUSE の組から1つ（あれば）、残りはランダム。
- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`eigo:` すべて PASS、ほかも PASS。

---

### Task 3: えい語の画面

**Files:**
- Create: `app-benkyo/eigo-screen.js`
- Modify: `app-benkyo/main.js`（SUBJECTS の eigo を `enabled: true`、`openSubject` に eigo）、`app-benkyo/index.html`（`../shared/voice-en.js` を voice.js のあと、eigo-data.js・eigo.js・eigo-screen.js を zukan-screen.js のあと）、`app-benkyo/app.css`（`.eg-*`。最後に足す）、`shared/parent.js`（`eigoKiku: 'えいご（きく）', eigoYomi: 'えいご（よむ）'`）、`sw.js`（PRECACHE に 4ファイル、CACHE_NAME を上げる）、`tools/voice-lines.js`・`tools/voice-lines.html`（「べんきょう えい語」の区切りで TEXT の noVoice 以外を add、読み込み一覧に新しいファイル）、`tests/eigo.test.js`、`tests/index.html`（本体の一覧に eigo-screen.js）
- 注意：`tests/benkyo.test.js` の「SUBJECTS 11件で、有効なのは …」は、えい語が有効になるので期待値を直す（えい語を足す）。

**Interfaces:**
- Consumes: Task 1 の `C.voiceEn`、Task 2 の `C.eigo`・`C.eigoData`、`B.ui`（hantai-screen.js が使うもの）。
- Produces: `B.eigoScreen = { show(ctx) -> Promise, _mode('kiku'|'yomi'), _theme(id), _choose(i), _next(), _flush(), _again(), _state() -> {phase:'mode'|'theme'|'question'|'reveal'|'reward'|'rest', mode, theme, level, q, tried, solved, stars, noVoice} }`。`#app` がないとき（テスト）は描かずに状態だけ動く（hantai と同じ）。

- [ ] **Step 1: テストを書く**（`C.voiceEn._override(fake(声あり), {maxMs:20})`、記録は `C.storage.logAnswer` を差しかえて数える。終わったら元に戻す）
  - `eigoScreen: えらぶ → きく → テーマ → 問題`：`show()` → phase 'mode'、`_mode('kiku')` → 'theme'、`_theme('animal')` → 'question'・`q.cards.length===3`（レベル1）。
  - `eigoScreen: 正解で記録 true`：`_choose(答えの番号)` → 記録1件 `{area:'eigoKiku', itemId:q.answer.id, correct:true, level:1}`。
  - `eigoScreen: 2回まちがえると 答えを光らせて 記録 false`：まちがい2回 → phase 'reveal'、記録 correct false。
  - `eigoScreen: 正解のあとの連打は 記録1回`：正解 → すぐ別の番号で `_choose` を3回 → 記録1件、solved 1。
  - `eigoScreen: 10問で ごほうび`：正解と `_next` を10回 → phase 'reward'、stars 2。
  - `eigoScreen: よむ レベル3は 声なしで 大文字を見せる`：よむの記録を level3 にして `_mode('yomi')` → `q.kind==='match'`。
  - `eigoScreen: 声がない端末`：`_override(fake([]))` → `show()` 後 `_state().noVoice===true`、`_mode('kiku')` では phase が 'mode' のまま、`_mode('yomi')` で `q.kind==='match'`、正解の記録は level 3。
  - `eigoScreen: 親画面に えいご の名前`：parent.js の本文に `eigoKiku: 'えいご（きく）'` と `eigoYomi: 'えいご（よむ）'`。
- [ ] **Step 2: テストを開いて失敗を確かめる** — Expected：`eigoScreen:` が FAIL。
- [ ] **Step 3: 画面を書く** — hantai-screen.js と同じ組み立て（`B.ui.newScreen`・`topBar`・`later`・`screenId` の確認）。テーマ画面は zukan のテーマ画面と同じ並べ方。1問目だけ日本語の説明 → 終わったら英語（`C.voice.speak(...).then(C.voiceEn.speak)` の形）、2問目からは英語だけ。カードの絵：pic は大きな絵文字、art は SVG（color：色の丸／num：数字／shape：形）。正解でつづり＋ひらがなの意味を出して英語をもう一度。画面を離れるとき（`newScreen` のたび）は `C.voiceEn.cancel()`。
- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`eigoScreen:` すべて PASS、ほかも PASS（音声ファイルのテストは えい語の文の分だけ FAIL ＝ Task 5 で直る）。
- [ ] **Step 5: 大きさを確かめる** — iframe で 8つの画面の大きさ × えらぶ・テーマ・きく（レベル1・3）・よむ（レベル1〜4）で スクロールなし、カード・ボタン 56px 以上（高さ340以下48px）、字 18px 以上。

---

### Task 4: べんきょうのトップの2ページ

**Files:**
- Modify: `app-benkyo/main.js`（`showHome` に ◀▶・●○・スワイプ、`B.home`）、`app-benkyo/app.css`（`.home-pager` など。最後に足す）
- Test: `tests/eigo.test.js`

**Interfaces:**
- Produces: `B.home = { PER_PAGE: 6, pageCount() -> 2, pageOf(id) -> 0|1, ids(page) -> [id…] }`（並びは SUBJECTS の順のうち enabled のもの）。

- [ ] **Step 1: テストを書く**
  - `home(benkyo): 並びとページ`：`pageCount()===2`、`ids(0)` が `kuku,kukuB,keisan,kanji,doutoku,chizuJ`、`ids(1)` が `chizuW,nagasa,hantai,zukan,eigo`。
  - `home(benkyo): 教科のあるページ`：`pageOf('eigo')===1`、`pageOf('kuku')===0`、知らない id は 0。
  - `home(benkyo): ページの場所は touch-action: pan-y`：app-benkyo/app.css の本文で `.home-pager {` の指定に `touch-action: pan-y`。
- [ ] **Step 2: テストを開いて失敗を確かめる** — Expected：`home(benkyo):` が FAIL。
- [ ] **Step 3: トップを書く** — 知育の game.js の showHome（◀▶・●○・スワイプ・めくった直後の click を のみこむ・ページは変数だけで覚える）と同じ動き。カードの並びは 3まい×2だん。よこ向きは ◀▶ を左右、たて向きは カードの下に ◀ ●○ ▶。前のトップ用の指定（5列・6列・3列など）は `.scr-home .home-pager` を付けて上書きする（消さない）。
- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`home(benkyo):` すべて PASS、ほかも PASS。
- [ ] **Step 5: 大きさと動きを確かめる** — 8つの画面の大きさで 1・2ページともスクロールなし、カードの名前 18px 以上、◀▶ 56px 以上。◀ は最初のページで押せない、スワイプで2ページ目、えい語から「トップに もどる」で2ページ目。

---

### Task 5: 声・設計書・しあげ

**Files:**
- Modify: `tools/voice/lines.tsv`・`tools/voice/made.tsv`・`shared/voice-clips.js`・`voice/z/*.ogg`（ツールが書く）、`docs/design-spec.md`（8章の表に `| 勉強 | えい語（きく：英語を聞いて絵を選ぶ／よむ：アルファベット。12テーマ126こ）。あわせて勉強のトップを2ページに | docs/superpowers/specs/2026-11-14-benkyo-eigo-design.md |`）

- [ ] **Step 1: 読み上げ文の一覧を作る** — `tools/voice/lines.tsv` を控えてから `tools/voice-lines.html` を開く（Expected：「保存しました」）。差分は えい語の日本語の文（TEXT の noVoice 以外）だけで、今ある行は変わらない。
- [ ] **Step 2: 読みを確かめる** — VOICEVOX が動いているか確かめ（止まっていれば やまとさんに起動をお願いする）、`perl tools/voice/make.pl --preview` で読みを見る（「えい語」「文字」「小文字」「テーマ」）。おかしければ `tools/voice/overrides.tsv`。
- [ ] **Step 3: 音声ファイルを作る** — `perl tools/voice/make.pl`。Expected：「失敗: 0」。
- [ ] **Step 4: 全テスト** — Expected：`PASS n / FAIL 0`（「Failed to fetch」が出たら開き直す）。
- [ ] **Step 5: 全体の大きさ** — べんきょうの全教科の最初の場面とトップ2ページを、8つの画面の大きさで スクロールなし。
