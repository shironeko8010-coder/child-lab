# べんきょう「長さ・かさ」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 勉強アプリに、ものさし・ますを読む／単位をかえる／単位をえらぶ「長さ・かさ」を足す。

**Architecture:** 出題・判定は `app-benkyo/subjects/nagasa.js`（`C.nagasa`、画面に触らない）。画面は `app-benkyo/nagasa-screen.js`（`B.nagasaScreen`）で、keisan-screen.js と同じ「状態を持ち、#app が無いテストでは描画しない」形。読み上げは「部品｜部品」方式の ずんだもん音声。

**Tech Stack:** 素の HTML/JS/CSS（`<script>`、ES Modules なし）、SVG、tests/runner.js、perl（tools/voice/make.pl）、VOICEVOX。

**Spec:** `docs/superpowers/specs/2026-11-12-benkyo-nagasa-design.md`

## Global Constraints
- 通信なし。外部ライブラリ・CDN・外部フォントなし。
- 画面の文字は2年生までの漢字。1年生の漢字はそのまま、2年生の漢字は `{漢字|よみ}`、3年生以上は ひらがな（例：「{長|なが}さ」「{答|こた}える」「水」「入る」「お{茶|ちゃ}」「こくばん」）。
- 単位の文字は画面では `cm mm m L dL mL`。読み上げは `センチ ミリ メートル リットル デシリットル ミリリットル`。
- 「は」で始まる読み上げ部品を作らない。
- AREA＝'nagasa'、MAX_LEVEL＝3、ROUND_SIZE＝10、STAR_EVERY＝5。
- 1回目のまちがい＝やり直し（入力を消す）、2回目のまちがい＝答えを見せて次へ。記録は1問1件、1回目でせいかいなら true。どれかの箱が空の「{答|こた}える」は数えない。
- 文言：やり直し `'もう{一回|いっかい} やってみよう！'`（声 `'もういっかい、やってみよう！'`）、せいかい `'正かい！'`（声 `'せいかい！'`）、答え（声）`'こたえは｜<部品>…｜だよ。｜つぎは できるよ！'`。
- ファイルを変えたら sw.js の CACHE_NAME を上げる。新しいファイルは PRECACHE に足す。
- コミットは最後に、やまとさんに確かめてから。最後の行 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。PowerShell は使わない。

## Review Focus
- 答えに 0 が入る問題（例：mm2cm で 120mm → 12cm 0mm、m2cm で 2m0cm）→ 0 の部品は読まず、箱には 0 を入れれば せいかい。`speakText`／`answerText`／`check` のテストで押さえる（Task 1）。
- 箱が2つで、片方だけ入れて「{答|こた}える」→ 数えない（Task 2 の画面テスト）。
- mL の答え（最大 3000）→ 4けたまで入る（Task 2 の画面テスト）。
- 単位をえらぶ問題で、レベル2に m・mL のボタン・ものが出ない（Task 1）。
- 答えを見せている間に数字や単位をタップ → 何も起きない、「{答|こた}える」なら早めに次へ（keisan と同じ）（Task 2）。

---

### Task 1: 出題・判定（`C.nagasa`）

**Files:**
- Create: `app-benkyo/subjects/nagasa.js`
- Create: `tests/nagasa.test.js`
- Modify: `tests/index.html`（本体の列の world-screen.js のあとに `'../app-benkyo/subjects/nagasa.js'`、テストの列に `'nagasa'`）

**Interfaces:**
- Produces（`C.nagasa`）:
  - 定数 `AREA, MAX_LEVEL, ROUND_SIZE, STAR_EVERY, MAX_DIGITS (=4)`、`UNIT_ITEMS`（spec 4章の12こ：`{ id, text, say, n, unit, kind: 'len'|'vol', min: 2|3 }`。text は画面用（ルビ付き）、say は `'<text の よみ>は'`）
  - `SAY = { cm:'センチ', mm:'ミリ', m:'メートル', L:'リットル', dL:'デシリットル', mL:'ミリリットル' }`
  - `kindsFor(level) -> string[]`：1＝`['readLen','readVol']`、2・3＝`['readLen','readVol','convert','unit']`
  - `idsFor(level) -> string[]`（id の形は下）
  - `makeQuestion(id) -> q`：`{ id, kind, boxes: string[]（箱ごとの単位）, answer: number[], choices: string[]|null, show: object }`
  - `pickQuestion(opts, rng) -> q`：`opts = { level, missCounts, lastId, kindCounts }`。kindCounts が一番少ない種類から（同じなら乱数）、その種類の id を `C.adaptive.pickWeighted` で。lastId は出さない
  - `check(q, input) -> boolean`：input は数の配列（unit は単位の文字1つ）
  - `isEmpty(q, input) -> boolean`
  - `newAttempt() -> { tries: 0 }`、`submit(attempt, q, input) -> { kind: 'empty'|'correct'|'retry'|'reveal' }`（keisan.js の submit と同じ考え方：2回目のまちがいで reveal）
  - `speakText(q) -> string`、`answerText(q) -> string`
  - `progressFromLogs(logs) -> { level, recent, missCounts }`（keisan.js と同じ考え方、area が nagasa だけ）

id の形と範囲（spec 3章）：
| id | レベル | 意味 | boxes | answer |
|---|---|---|---|---|
| `readLen:<mm>` | 1：mm が 10〜150 の10の倍数／2・3：11〜149 で10の倍数でない | テープの長さ | 1：`['cm']`／2・3：`['cm','mm']` | `[cm]`／`[cm, mm]` |
| `readVol:<dL>` | 1：1〜9／2・3：11〜39 で10の倍数でない | 水のかさ | 1：`['dL']`／2・3：`['L','dL']` | `[dL]`／`[L, dL]` |
| `convert:cm2mm:<mm>` | 2・3（10〜159） | XcmYmm → mm | `['mm']` | `[mm]` |
| `convert:mm2cm:<mm>` | 2・3（11〜159） | mm → □cm□mm | `['cm','mm']` | `[cm, mm]` |
| `convert:l2dl:<dL>` | 2・3（10〜39） | XLYdL → dL | `['dL']` | `[dL]` |
| `convert:dl2l:<dL>` | 2・3（11〜39） | dL → □L□dL | `['L','dL']` | `[L, dL]` |
| `convert:m2cm:<cm>` | 3（100〜399） | XmYcm → cm | `['cm']` | `[cm]` |
| `convert:cm2m:<cm>` | 3（101〜399） | cm → □m□cm | `['m','cm']` | `[m, cm]` |
| `convert:dl2ml:<dL>` | 3（1〜9） | XdL → mL | `['mL']` | `[dL*100]` |
| `convert:l2ml:<L>` | 3（1〜3） | XL → mL | `['mL']` | `[L*1000]` |
| `convert:ml2dl:<mL>` | 3（100〜900、100ずつ） | mL → dL | `['dL']` | `[mL/100]` |
| `unit:<itemId>` | item.min 以上 | 単位をえらぶ | `[]` | `[]`（正解は `item.unit`） |

- unit の choices：len は レベル2 `['cm','mm']`、3 `['m','cm','mm']`。vol は 2 `['L','dL']`、3 `['L','dL','mL']`。レベルは `pickQuestion` から渡す（`makeQuestion(id, level)` の第2引数、unit だけが使う）。
- 読み上げ（0 の部品は入れない。数と単位は `n + SAY[unit]`）：
  - readLen：`'テープの {長|なが}さは なんセンチ？'`（1）／`'テープの {長|なが}さは なんセンチ なんミリ？'`（2・3）
  - readVol：`'水の かさは なんデシリットル？'`／`'水の かさは なんリットル なんデシリットル？'`
  - convert：`<from の部品を ｜ でつなぐ>｜を <SAY[答えの最後の単位]>で いうと？`（例 `'3センチ｜5ミリ｜を ミリで いうと？'`、mm2cm は `'35ミリ｜を センチと ミリで いうと？'`、cm2m は `'を メートルと センチで いうと？'`、dl2l は `'を リットルと デシリットルで いうと？'`）
  - unit：`item.say + '｜' + item.n + '｜どの たんいかな？'`
  - answerText：`'こたえは｜' + <答えの部品（0 を除く）を ｜ でつなぐ> + '｜だよ。｜つぎは できるよ！'`（unit は `item.n + SAY[item.unit]`）

- [ ] **Step 1: テストを書く**（`tests/nagasa.test.js`。keisan.test.js と同じ書き方）
```js
C.test('nagasa: 定数と kindsFor', function () {
  C.assertEq([N.AREA, N.MAX_LEVEL, N.ROUND_SIZE, N.STAR_EVERY], ['nagasa', 3, 10, 5]);
  C.assertEq(N.kindsFor(1), ['readLen', 'readVol']);
  C.assertEq(N.kindsFor(2), ['readLen', 'readVol', 'convert', 'unit']);
  C.assertEq(N.UNIT_ITEMS.length, 12);
});
C.test('nagasa: idsFor の範囲（レベル1は cm ちょうど・dL だけ、レベル2に m・mL がない）', function () {
  var l1 = N.idsFor(1), l2 = N.idsFor(2), l3 = N.idsFor(3);
  C.assertEq(l1.indexOf('readLen:150') >= 0 && l1.indexOf('readLen:35') < 0 && l1.indexOf('readVol:9') >= 0, true);
  C.assertEq(l2.some(function (id) { return /m2cm|cm2m|ml|unit:(pool|kokuban|petto|spoon)/.test(id); }), false);
  C.assertEq(l3.indexOf('convert:l2ml:3') >= 0 && l3.indexOf('unit:pool') >= 0, true);
});
C.test('nagasa: makeQuestion の答え', function () {
  C.assertEq(N.makeQuestion('convert:cm2mm:35').answer, [35]);
  C.assertEq(N.makeQuestion('convert:mm2cm:159').answer, [15, 9]);
  C.assertEq(N.makeQuestion('convert:m2cm:120').answer, [120]);
  C.assertEq(N.makeQuestion('convert:cm2m:120').answer, [1, 20]);
  C.assertEq(N.makeQuestion('convert:l2ml:2').answer, [2000]);
  C.assertEq(N.makeQuestion('convert:ml2dl:300').answer, [3]);
  C.assertEq(N.makeQuestion('readLen:35').boxes, ['cm', 'mm']);
  C.assertEq(N.makeQuestion('readVol:13').answer, [1, 3]);
  C.assertEq(N.makeQuestion('unit:ari', 3).choices, ['m', 'cm', 'mm']);
  C.assertEq(N.makeQuestion('unit:cup', 2).choices, ['L', 'dL']);
});
C.test('nagasa: check（箱2つは両方合って せいかい、0 も入れる）', function () {
  var q = N.makeQuestion('convert:mm2cm:120');
  C.assertEq(N.check(q, [12, 0]), true); C.assertEq(N.check(q, [12, 1]), false); C.assertEq(N.check(q, [1, 20]), false);
  C.assertEq(N.check(N.makeQuestion('unit:ari', 2), 'mm'), true);
  C.assertEq(N.isEmpty(q, [12, '']), true);
});
C.test('nagasa: submit は2回目のまちがいで reveal', function () {
  var q = N.makeQuestion('convert:cm2mm:35'), a = N.newAttempt();
  C.assertEq(N.submit(a, q, ['']).kind, 'empty');
  C.assertEq(N.submit(a, q, [34]).kind, 'retry');
  C.assertEq(N.submit(a, q, [33]).kind, 'reveal');
  C.assertEq(N.submit(N.newAttempt(), q, [35]).kind, 'correct');
});
C.test('nagasa: speakText と answerText（0 は読まない、は で始まる部品がない）', function () {
  C.assertEq(N.speakText(N.makeQuestion('convert:cm2mm:35')), '3センチ｜5ミリ｜を ミリで いうと？');
  C.assertEq(N.speakText(N.makeQuestion('convert:cm2mm:30')), '3センチ｜を ミリで いうと？');
  C.assertEq(N.answerText(N.makeQuestion('convert:mm2cm:120')), 'こたえは｜12センチ｜だよ。｜つぎは できるよ！');
  C.assertEq(N.speakText(N.makeQuestion('unit:enpitsu', 2)), 'えんぴつの {長|なが}さは｜15｜どの たんいかな？');
  [1, 2, 3].forEach(function (lv) { N.idsFor(lv).forEach(function (id) {
    var q = N.makeQuestion(id, lv);
    (N.speakText(q) + '｜' + N.answerText(q)).split('｜').forEach(function (p) { if (/^\s*は/.test(p)) throw new Error(id + ': ' + p); });
  }); });
});
C.test('nagasa: pickQuestion は少ない種類から、同じ問題を続けない', function () {
  var q = N.pickQuestion({ level: 2, missCounts: {}, lastId: null, kindCounts: { readLen: 2, readVol: 2, convert: 0, unit: 2 } }, Math.random);
  C.assertEq(q.kind, 'convert');
  var last = null;
  for (var i = 0; i < 40; i++) { var p = N.pickQuestion({ level: 3, missCounts: {}, lastId: last, kindCounts: {} }, Math.random); if (p.id === last) throw new Error(p.id); last = p.id; }
});
C.test('nagasa: progressFromLogs', function () { /* keisan.test.js:101・109 と同じ形で、area 'nagasa'・MAX_LEVEL 3 */ });
```
- [ ] **Step 2: 失敗を確かめる** — `http://localhost:8765/tests/index.html` で nagasa のテストが FAIL（`C.nagasa` がない）。
- [ ] **Step 3: `app-benkyo/subjects/nagasa.js` を書く**（上の Interfaces どおり。冒頭コメントは world.js と同じ書き方）
- [ ] **Step 4: 通ることを確かめる** — `#summary` が `FAIL 0`。

---

### Task 2: 画面・教科カード・親画面・オフライン

**Files:**
- Create: `app-benkyo/nagasa-screen.js`
- Modify: `app-benkyo/main.js`（`SUBJECTS` の chizuW のあとに `{ id: 'nagasa', name: '{長|なが}さ・かさ', sub: 'ものさし・ます', enabled: true }`、アイコン `nagasa`（ものさしの SVG、ほかのアイコンと同じ 48×48 の形）、`id === 'nagasa'` で `B.nagasaScreen.show({ profileId })`（keisan と同じ書き方））
- Modify: `app-benkyo/index.html`（`subjects/nagasa.js` と `nagasa-screen.js` を world-screen.js のあとに）
- Modify: `app-benkyo/app.css`（`.ng-*`）
- Modify: `shared/parent.js:8`（`nagasa: 'ながさ・かさ'`）
- Modify: `sw.js`（PRECACHE に2ファイル、CACHE_NAME を上げる）
- Modify: `tests/index.html`（本体の列に `'../app-benkyo/nagasa-screen.js'`）
- Test: `tests/nagasa.test.js`

**Interfaces:**
- Consumes: Task 1 のすべて。`B.ui`（keisan-screen.js が使うもの：`hasApp, profileId, play, speak, later, el, button, fillR, chara, svg, STAR, newScreen` など）、`B.checkRest`、`C.storage.logAnswer`、`C.adaptive.nextLevel`。
- Produces: `B.nagasaScreen = { show(ctx), _press(key), _tap(boxIndex), _pick(unit), _flush(), _again(), _state() }`。`_state()` は `{ phase, id, kind, boxes, answer, input: [..], active, tries, message, solved, stars, level }`。

画面の決まり：
- 流れ・記録・星・ごほうび・お休みは keisan-screen.js と同じ（`WAIT_CORRECT 1300`、`WAIT_REVEAL 3000`、`KEYS` も同じ）。種類のかたよりは `st.kindCounts` を数えて `pickQuestion` に渡す（区切りごとに0から）。
- 箱：`q.boxes` の数だけ「□cm □mm」を並べる。数字は `st.active` の箱に入る（1箱 `MAX_DIGITS` まで）。箱をタップで active を切りかえ。「けす」は active の箱の1字を消す。retry で全部の箱を空にし active を0に。reveal で箱に答えを入れる。
- unit：箱と数字ボタンのかわりに `q.choices` の単位ボタン。正しくない単位で retry／reveal は数字と同じ流れ。
- 絵（SVG）：readLen＝0〜15cm のものさし（1cm ごとに数字、5mm に中線、1mm に短線）とテープ。readVol＝1Lます（目もり10）を `Math.floor(dL/10)` こ満タン＋最後のますに `dL%10`（レベル1は1つのますに dL）。convert＝式（例「3cm5mm ＝ □mm」）。unit＝`item.text` と `item.n` と □。reveal のとき、readLen はテープの右はし、readVol は水面に `.ng-glow`。
- 画面の文：はじめ `'{数字|すうじ}を おして {答|こた}えてね'`（unit は `'{正|ただ}しい たんいを えらんでね'`）。

- [ ] **Step 1: 画面テストを足す**（keisan.test.js:120〜212 と同じ書き方。`answer(ok)` は `_state().answer` を箱ごとに `_tap(i)` → 数字で入れる、unit は `_pick`）
  - `'最初はレベル1。正解で記録 true が1件'`：phase 'question'、level 1、kind が readLen か readVol、正解で logs 1件 true。
  - `'1回目まちがい→やり直し、2回目まちがい→答えを見せる（記録 false が1件）'`：retry で message `'もう{一回|いっかい} やってみよう！'`・input が全部空、reveal で input が answer。
  - `'箱が2つで片方だけ入れた「答える」は数えない'`：レベル2の記録を入れて開き、`readLen:35` が出るまで進めるのではなく、`_state().boxes.length === 2` の問題で片方だけ入れて ok → tries 0。
  - `'mL は4けたまで入る'`：数字を5つ押して input[0] の長さが4。
  - `'5問正解で星1、10問でごほうび（星2）、もういっかいで0から'`。
  - `'親画面に「ながさ・かさ」、SUBJECTS に nagasa がある'`。
- [ ] **Step 2: 失敗を確かめる** — 上のテストが FAIL。
- [ ] **Step 3: nagasa-screen.js・main.js・index.html・app.css・parent.js・sw.js を書く**
- [ ] **Step 4: 通ることを確かめる** — `FAIL 0`（precache のテストも）。
- [ ] **Step 5: ブラウザで確かめる**（`http://localhost:8765/app-benkyo/index.html`、1280×800 と 1024×600）
  - 教科カード「長さ・かさ」が出て、ほかのカードとはみ出さない。
  - レベル1・2・3（記録を入れて開く）で、ものさし・ます・式・単位ボタンが見える。目もりの位置が答えと合っている（例：readLen:35 でテストのはしが 3 と 4 のまん中）。
  - 2回まちがえると答えが光る。答えを見せている間の数字は効かない。

---

### Task 3: 読み上げ（ずんだもんの音声ファイル）

**Files:**
- Modify: `tools/voice-lines.js`（`benkyo()` に「長さ・かさ」）、`tools/voice-lines.html`（本体の列に `subjects/nagasa`・`nagasa-screen`）
- 生成: `voice/z/*.ogg`、`shared/voice-clips.js`、`tools/voice/*.tsv`
- Modify: `sw.js`（CACHE_NAME）、必要なら `tools/voice/yomi-fix.tsv`・`overrides.tsv`

- [ ] **Step 1: 文の作り方を足す** — `where = '長さ・かさ'`。レベル1〜3の `idsFor` すべてで `add(speakText(q))` と `add(answerText(q))`。`SOURCES` に `'app-benkyo/nagasa-screen.js'`、`RUBY_SOURCES` に `'app-benkyo/subjects/nagasa.js'`。
- [ ] **Step 2: 書き出す** — `http://localhost:8765/tools/voice-lines.html` で「保存しました」。
- [ ] **Step 3: 読みを先に調べる** — おかいもののときと同じ方法で、新しい文（`where` が「長さ・かさ」）だけ VOICEVOX のカナを出し、`センチ`・`デシリットル`・`ミリリットル`・「を 〇〇で いうと？」・`3000ミリリットル`・`1円玉`・`お茶` の読みを目で確かめる。おかしいものは `yomi-fix.tsv`／`overrides.tsv`。
- [ ] **Step 4: 音声を作る**（VOICEVOX 起動が必要。バックグラウンドで） — `perl tools/voice/make.pl > "$TMP/make-nagasa.log" 2>&1`。最後の行が `失敗: 0`。`perl tools/voice/check.pl` のあやしい文を確かめる。
- [ ] **Step 5: CACHE_NAME を上げてテスト** — `FAIL 0`（「すべて音声ファイルがある」を含む）。
- [ ] **Step 6: ブラウザで鳴るか** — 勉強アプリで `C.voice.speak(C.nagasa.speakText(C.nagasa.makeQuestion('convert:cm2mm:35')))` などが端末の声0回。

---

### Task 4: 設計書（正本）と仕上げ

**Files:**
- Modify: `docs/design-spec.md`（8章の表に「勉強｜長さ・かさ｜`docs/superpowers/specs/2026-11-12-benkyo-nagasa-design.md`」）

- [ ] **Step 1: design-spec.md に1行足す**
- [ ] **Step 2: 全部のテスト** — `FAIL 0`。
- [ ] **Step 3: 全体の見直し**（別の担当に頼む）と、指摘の直し。
- [ ] **Step 4: やまとさんへ報告**（試す例つき。例：レベル2の「3cm5mm ＝ □mm」に 35 → 「せいかい！」）し、コミットしてよいか聞く。
