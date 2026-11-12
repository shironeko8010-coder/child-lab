# ちいく「しりとり」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 知育アプリに、ひよこ（声は ずんだもん）と交代で絵カードをつなぐ「しりとり」を足す。

**Architecture:** `app-chiiku/shiritori.js` を okaimono.js と同じ形で作る（前半＝画面なしの関数、後半＝画面）。画面の部品は `C.chiikuUi`、記録は `C.storage.logAnswer`、出題の重みとレベルは `C.adaptive`。読み上げは「部品｜部品」方式で ずんだもんの音声ファイルを作る。

**Tech Stack:** 素の HTML/JS/CSS（`<script>` 読み込み、ES Modules なし）、絵文字、SVG、tests/runner.js、perl（tools/voice/make.pl）、VOICEVOX。

**Spec:** `docs/superpowers/specs/2026-11-12-chiiku-shiritori-design.md`

## Global Constraints
- 通信なし。外部ライブラリ・CDN・外部フォントなし。
- 園児が見る文字・聞く文は ひらがな だけ（数字の「5」は可。今のごほうびと同じ）。
- 叱らない。まちがえても最後は必ずつながる。
- ことばは spec 5章の98個（順番・絵文字もそのまま）。はじまりの音1つにつき3個以上。てんてんは そのままつなぐ。
- MAX_LEVEL＝3、GOAL＝5（子どもが5回つなげたらゴール）。カードはレベル1＝3まい、2・3＝4まい。2回まちがえたら正しいカードを光らせる。
- 記録は `area: 'shiritori'`、`itemId`＝子どもが選ぶべきだった ことばの id、せいかい＝1回目で正しいカード。
- 読み上げ文（spec 8章の文言そのまま）は Task 1 の `TEXT` に置く。部品は「は」で始めない。
- ファイルを変えたら `sw.js` の CACHE_NAME を上げる。新しいファイルは PRECACHE に足す。
- コミットは、やまとさんに確かめてから。メッセージの最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- PowerShell は使わない。perl / Bash だけ。

## Review Focus
- 同じ回で使い切って、子どもの正しいカードや ひよこの答えがなくなる → 例外を出さず、ひよこの「きみの かち！」でゴールにする（Task 1 の「使い切ったとき」テスト）。
- カードの連打・ひよこの番の間のタップ → 二重に記録しない、列に2回入らない（Task 2 のブラウザ確認）。
- まちがえて うすくなったカードをもう一度押す → 何も起きない（まちがい回数がふえない）（Task 2 のブラウザ確認）。
- 「ん」で終わるカードのない音でレベル3 → 4まいとも ふつうに並ぶ（Task 1 の makeChoices テスト）。
- 1日の利用時間を超えたとき → 子どもの番の前にお休み画面（okaimono.js と同じ `C.timer.isOver`）（Task 2）。

---

### Task 1: ことばと選び方の関数（画面なし）

**Files:**
- Create: `app-chiiku/shiritori.js`（この Task では関数と `C.shiritori` の書き出しだけ。`start` は Task 2）
- Create: `tests/shiritori.test.js`
- Modify: `tests/index.html:22`（本体の列の `'okaimono'` のあとに `'shiritori'`）、`:25`（テストの列の `'okaimono'` のあとに `'shiritori'`）

**Interfaces:**
- Produces（`C.shiritori`）:
  - `AREA = 'shiritori'`, `MAX_LEVEL = 3`, `GOAL = 5`
  - `WORDS`：`[{ id, word, pic }]`。id はローマ字（例 `ringo`, `gorira`）。spec 5章の表の順。
  - `TEXT`：`{ start: 'しりとり、はじめるよ！｜さいしょは…', ask: 'つぎは どれかな？', reply: 'じゃあ ぼくは…', again: 'もういっかい！', n: 'んで おわると つづかないね。｜ほかのを えらぼう！', hint: 'ひかっている えを おしてね', giveup: 'うーん、おもいつかないや。｜きみの かち！', goal: 'すごい！ 5かい つながったね！' }`
  - `firstKana(word) -> string`, `lastKana(word) -> string`, `endsN(word) -> boolean`
  - `similar(kana) -> string | null`：てんてん・まるだけちがう音のうち、`WORDS` のはじまりにあるもの（なければ null）
  - `linkKana() -> string[]`：「ん」で終わらない ことばの最後の音の一覧（重なりなし）。読み上げ文を作るのに使う
  - `pickStart(used, rng) -> wordObj`：「ん」で終わらず、`makeChoices` で正しいカードが作れるもの
  - `pickReply(kana, used, rng) -> wordObj | null`（spec 7章。`used` は `{ id: true }`）
  - `makeChoices(kana, level, used, opts) -> { answer, cards } | null`：`opts = { missCounts, rng }`。answer は spec 7章の決まりで、続けられるものを `C.adaptive.pickWeighted` で選ぶ（続けられるものがなければ、続けられなくてもよい正しいものから）。正しいものが1つもなければ null。cards は answer を1つだけ含み、残りは spec 4章のまちがいのカード。並びは混ぜる。
  - `judge(kana, wordObj) -> 'good' | 'wrong' | 'n'`
  - `speakAsk(kana, level) -> string`：レベル1＝`kana + 'から はじまる ものは どれかな？'`、2・3＝`TEXT.ask`
  - `speakWrong(kana) -> string`：`kana + 'から はじまる ものだよ。｜' + TEXT.again`
  - `progressFromLogs(logs) -> { level, recent, missCounts }`：okaimono.js の同名関数と同じ（area が shiritori のものだけ）

- [ ] **Step 1: テストを書く**（`tests/shiritori.test.js`、okaimono.test.js と同じ書き方。`var S = C.shiritori;` は各テストの中で読む）

```js
C.test('shiritori: 定数とことば', function () {
  C.assertEq(S.AREA, 'shiritori'); C.assertEq(S.MAX_LEVEL, 3); C.assertEq(S.GOAL, 5);
  C.assertEq(S.WORDS.length, 98);
  var ids = {}, count = {};
  S.WORDS.forEach(function (w) {
    if (ids[w.id] || !w.pic || !/^[ぁ-ゖー]+$/.test(w.word) || /[ーぁぃぅぇぉゃゅょっ]$/.test(w.word)) throw new Error(w.id);
    ids[w.id] = 1; count[S.firstKana(w.word)] = (count[S.firstKana(w.word)] || 0) + 1;
  });
  Object.keys(count).forEach(function (k) { if (count[k] < 3) throw new Error('3こ未満: ' + k); });
  C.assertEq(Object.keys(count).length, 30);
  C.assertEq(S.WORDS.filter(function (w) { return S.endsN(w.word); }).length, 15);
});
C.test('shiritori: どのことばも続けられる', function () {
  S.WORDS.forEach(function (w) {
    if (S.endsN(w.word)) return;
    var ok = S.WORDS.some(function (x) { return x !== w && !S.endsN(x.word) && S.firstKana(x.word) === S.lastKana(w.word); });
    if (!ok) throw new Error(w.word);
  });
});
C.test('shiritori: 音の関数', function () {
  C.assertEq(S.lastKana('たまご'), 'ご'); C.assertEq(S.firstKana('ごりら'), 'ご');
  C.assertEq(S.endsN('みかん'), true); C.assertEq(S.endsN('りんご'), false);
  C.assertEq(S.similar('ご'), 'こ'); C.assertEq(S.similar('こ'), 'ご'); C.assertEq(S.similar('あ'), null);
  C.assertEq(S.judge('ご', { word: 'ごりら' }), 'good'); C.assertEq(S.judge('ご', { word: 'こあら' }), 'wrong'); C.assertEq(S.judge('ご', { word: 'ごはん' }), 'n');
});
C.test('shiritori: makeChoices（まい数・正しいカード・出たことば）', function () {
  [1, 2, 3].forEach(function (lv) {
    for (var k = 0; k < 30; k++) {
      var used = { gorira: true };
      var c = S.makeChoices('ご', lv, used, { missCounts: {}, rng: Math.random });
      C.assertEq(c.cards.length, lv === 1 ? 3 : 4);
      var good = c.cards.filter(function (w) { return S.judge('ご', w) === 'good'; });
      C.assertEq(good.length, 1); C.assertEq(good[0], c.answer);
      if (c.cards.some(function (w) { return used[w.id]; })) throw new Error('used');
    }
  });
  var c2 = S.makeChoices('ご', 2, {}, { missCounts: {}, rng: Math.random });
  C.assertEq(c2.cards.some(function (w) { return S.firstKana(w.word) === 'こ'; }), true);
  var c3 = S.makeChoices('ご', 3, {}, { missCounts: {}, rng: Math.random });
  C.assertEq(c3.cards.some(function (w) { return w.id === 'gohan'; }), true);
  var c4 = S.makeChoices('こ', 3, {}, { missCounts: {}, rng: Math.random });   // 「こ」で始まる「ん」のことばはない
  C.assertEq(c4.cards.length, 4);
});
C.test('shiritori: pickReply', function () {
  for (var k = 0; k < 20; k++) {
    var r = S.pickReply('ら', {}, Math.random);
    if (['rakko', 'rajio'].indexOf(r.id) < 0) throw new Error(r.id);
  }
  C.assertEq(S.pickReply('ら', { rakko: true, rajio: true }, Math.random), null);
});
C.test('shiritori: 使い切ったときは null で、例外を出さない', function () {
  var used = {}; S.WORDS.forEach(function (w) { if (S.firstKana(w.word) === 'ご') used[w.id] = true; });
  C.assertEq(S.makeChoices('ご', 1, used, { missCounts: {}, rng: Math.random }), null);
});
C.test('shiritori: 100回やっても、ひよこが続けられなくなる前に5回つながる', function () {
  for (var g = 0; g < 100; g++) {
    var used = {}, cur = S.pickStart(used, Math.random); used[cur.id] = true;
    for (var t = 0; t < S.GOAL; t++) {
      var c = S.makeChoices(S.lastKana(cur.word), 3, used, { missCounts: {}, rng: Math.random });
      if (!c) throw new Error('こどもの番 ' + g + '/' + t); used[c.answer.id] = true;
      if (t === S.GOAL - 1) break;
      cur = S.pickReply(S.lastKana(c.answer.word), used, Math.random);
      if (!cur) throw new Error('ひよこの番 ' + g + '/' + t); used[cur.id] = true;
    }
  }
});
C.test('shiritori: 読み上げ文', function () {
  C.assertEq(S.speakAsk('ご', 1), 'ごから はじまる ものは どれかな？');
  C.assertEq(S.speakAsk('ご', 2), 'つぎは どれかな？');
  C.assertEq(S.speakWrong('ご'), 'ごから はじまる ものだよ。｜もういっかい！');
  Object.keys(S.TEXT).forEach(function (k) { S.TEXT[k].split('｜').forEach(function (p) { if (/^は/.test(p)) throw new Error(k); }); });
  C.assertEq(S.linkKana().indexOf('ん'), -1);
});
C.test('shiritori: progressFromLogs', function () { /* okaimono.test.js の progressFromLogs と同じ形で、area: 'shiritori' だけ数える */ });
```

- [ ] **Step 2: 失敗を確かめる** — `perl tools/serve.pl . 8765` が動いている状態で `http://localhost:8765/tests/index.html` を開く。shiritori のテストが FAIL（`C.shiritori` がない）。
- [ ] **Step 3: `app-chiiku/shiritori.js` の関数を書く**（上の Interfaces どおり。冒頭コメントは okaimono.js と同じ書き方。乱数は引数の `rng`、なければ `Math.random`）
- [ ] **Step 4: 通ることを確かめる** — `#summary` が `FAIL 0`（サーバーが重くて読みこみに失敗したら、もう一度開く）。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**

---

### Task 2: 画面・ホームのカード・親画面・オフライン

**Files:**
- Modify: `app-chiiku/shiritori.js`（`start(profileId)` と画面）
- Modify: `app-chiiku/index.html:32`（`<script src="shiritori.js"></script>` を okaimono.js のあとに）
- Modify: `app-chiiku/game.js`（`HOME_ICO` に `sr`、`playCard('しりとり', 'sr', function () { C.shiritori.start(p.id); });` を おかいもの のあとに）
- Modify: `app-chiiku/app.css`（`.sr-*` の見た目、`.hc-sr` の色、たて向きの最後の段）
- Modify: `shared/parent.js:8`（`AREA_NAMES` に `shiritori: 'しりとり'`）
- Modify: `sw.js`（PRECACHE に `'app-chiiku/shiritori.js'`、CACHE_NAME を上げる）
- Test: `tests/shiritori.test.js`

**Interfaces:**
- Consumes: Task 1 の関数すべて。`C.chiikuUi`（`newScreen, topBar, el, svg, button, later, bubble, chara, play, speak, speakThen, showRest, ICO, STAR`）、`C.storage.logAnswer`、`C.adaptive.nextLevel`、`C.timer.isOver`。
- Produces: `C.shiritori.start(profileId)`。

画面の決まり（spec 2・3・6章）：
- `start` は okaimono.js と同じ（記録からレベルを読む）→ `newGame()`：`used = {}`、`chain = [pickStart]`、`TEXT.start + '｜' + word + '。'` を読んでから子どもの番。
- 子どもの番 `childTurn()`：最初に `C.timer.isOver` を見る。`makeChoices(lastKana(最後のことば), level, used, ...)`。null なら `giveup()`。
- 上の列：`chain` の新しい4つを、絵文字＋ことば（最後の音を `<span class="sr-last">` で色づけ）の小さいカードで、矢印（→）でつなぐ。
- まんなか：`ui.chara` と `ui.bubble`。レベル1・2は「`<span class="sr-kana">ご</span>`から はじまる ものは どれかな？」、レベル3は `TEXT.ask`。読み上げは `speakAsk(kana, level)`（ひよこのことばのあとに続けて読む）。もういちど きくボタンは okaimono.js と同じ。
- 下：カード（絵文字を大きく＋ことば）。押すと `ui.speak(word + '。')` のあと `judge`：
  - good：`ui.play('correct')`、カードを列に足す、記録（1回目で正しかったか）、`nextLevel`。`ui.later` で約0.8秒あけて ひよこの番。
  - wrong：`speakWrong(kana)`、カードに `.sr-tried`（うすく・押せない）、まちがい回数＋1。
  - n：`TEXT.n`、`.sr-tried`、まちがい回数＋1。
  - まちがい2回目で、正しいカードに `.sr-hint`（光る）と `TEXT.hint`。
- 判定中・ひよこの番の間は、カードを押しても何もしない（`busy` フラグ）。記録は子どもの番1回につき1回だけ。
- ひよこの番 `hiyokoTurn()`：子どもの番が `GOAL` 回なら `goal()`。`pickReply` が null なら `giveup()`。ことばのカードを列に足し（`.sr-pop` で短い動き）、`TEXT.reply + '｜' + word + '。'` を読んでから子どもの番。
- `goal()`：okaimono.js の `showReward` と同じ画面で、読み上げは `TEXT.goal`。「つぎへ」で `newGame()`。`giveup()` は `TEXT.giveup` を読んでから `goal()` と同じ画面（読み上げは giveup の文だけ）。
- ホームのカード：色 `.hc-sr { background: #d9822b; }`。絵は64×64の SVG で、左下と右上に2つの丸（白っぽい黄色と うすい水色）を、太い矢印でつなぐ。
- たて向き（`@media (orientation: portrait)`）：8まいを3まいずつ並べると最後の段が2まいになる。`.home-cards` を `repeat(6, minmax(0, 1fr))` にし、カードは `grid-column: span 2`。最後の段が1まいなら `grid-column: 3 / span 2`、2まいなら1まい目を `grid-column: 2 / span 2`（今の `.home-card:last-child:nth-child(3n+1) { grid-column: 2; }` は置きかえる）。

- [ ] **Step 1: テストを足す**

```js
C.test('shiritori: 知育のホームに「しりとり」のカードがある', function () {
  return fetch('../app-chiiku/game.js').then(function (r) { return r.text(); }).then(function (t) {
    C.assertEq(/playCard\('しりとり', 'sr', function \(\) \{ C\.shiritori\.start\(p\.id\); \}\);/.test(t), true);
  });
});
C.test('shiritori: 親画面に「しりとり」の名前がある', function () { /* okaimono.test.js の同じテストを 'shiritori' → 'しりとり' で写す */ });
```
（PRECACHE の一致は、今の `precache.test.js` が確かめる）

- [ ] **Step 2: 失敗を確かめる** — 上の2つと precache のテストが FAIL。
- [ ] **Step 3: 画面・カード・CSS・parent.js・sw.js を書く**（上の決まりどおり）
- [ ] **Step 4: テストが通ることを確かめる** — `FAIL 0`。
- [ ] **Step 5: ブラウザで動きを確かめる**（`http://localhost:8765/app-chiiku/index.html`、横 1280×800・1024×600・812×375、たて 800×1280・375×812）
  - ホームのカード8まいがはみ出さない。たて向きで最後の2まいが まんなか。
  - レベル1：3まい。正しいカード → 列に入り、ひよこが答え、次の問題。ちがうカード → うすくなり、もう一度押しても何も起きない。2回まちがえると正しいカードが光る。
  - 5回つなげるとごほうび画面、「つぎへ」で新しいしりとり。
  - 連打・ひよこの番の間のタップで、記録が1件ずつ（`C.storage.getLogs` で確かめる）。
- [ ] **Step 6: コミットしてよいか、やまとさんに聞く**

---

### Task 3: 読み上げ（ずんだもんの音声ファイル）

**Files:**
- Modify: `tools/voice-lines.js`（`chiiku()` の おかいもの のあとに「ちいく しりとり」、`SOURCES` に `'app-chiiku/shiritori.js'`）
- 生成: `voice/z/*.ogg`、`shared/voice-clips.js`、`tools/voice/lines.tsv`・`ruby.tsv`・`made.tsv`
- Modify: `sw.js`（CACHE_NAME を上げる）
- Modify（必要なら）: `tools/voice/yomi-fix.tsv`・`overrides.tsv`

**Interfaces:**
- Consumes: `C.shiritori.WORDS`・`TEXT`・`linkKana`・`speakAsk`・`speakWrong`。

- [ ] **Step 1: 文の作り方を足す** — `where = 'ちいく しりとり'`。`WORDS` それぞれ `add(word + '。')`。`linkKana()` それぞれ `add(speakAsk(k, 1))` と `add(speakWrong(k))`。`TEXT` の文をすべて `add`（start・reply は `｜` のあとに ことばが続く形なので、`TEXT.start + '｜' + WORDS[0].word + '。'` のように1つ足せば部品がそろう）。
- [ ] **Step 2: 書き出す** — `http://localhost:8765/tools/voice-lines.html` を開き、「保存しました」と文の数が出る（失敗したら、もう一度開く）。
- [ ] **Step 3: 読みを先に調べる** — `perl tools/voice/make.pl --preview` のあと `MADE=tools/voice/preview.tsv perl tools/voice/check.pl`。`grep 'から' tools/voice/preview.tsv` で「◯から」の1音の読み、`grep -E 'こおり|ひこうき|とけい|ろうそく|ふくろう|みかづき' tools/voice/preview.tsv` で のばす読みを目で確かめる。おかしいものは `yomi-fix.tsv`、1文だけなら `overrides.tsv`。
- [ ] **Step 4: 音声を作る**（VOICEVOX 起動が必要。約170文） — `perl tools/voice/make.pl`。最後の行が `失敗: 0`。
- [ ] **Step 5: sw.js の CACHE_NAME を上げ、テストを流す** — `FAIL 0`（「すべて音声ファイルがある」を含む）。
- [ ] **Step 6: ブラウザで鳴るか確かめる** — 知育アプリで `C.voice.hasClip('りんご。')`・`C.voice.hasClip(C.shiritori.speakAsk('ご', 1))` が true。
- [ ] **Step 7: コミットしてよいか、やまとさんに聞く**

---

### Task 4: 設計書（正本）の更新と仕上げの確認

**Files:**
- Modify: `docs/design-spec.md`（8章の表に しりとりの spec ファイル。正本を変えることを、やまとさんに先に知らせる）

- [ ] **Step 1: design-spec.md に「しりとり」を足す**（おかいもの と同じ形で1行）
- [ ] **Step 2: 全部のテストを流す** — `FAIL 0`。
- [ ] **Step 3: 仕上げのレビュー**（okaimono と同じく、最も強いモデルのレビューを1回）。Critical・Important は直してテストを流す。
- [ ] **Step 4: やまとさんへの報告** — 実機（Androidタブレット）で確かめてほしいことを、試す例つきで書く（例：「りんご」→「ご」の絵を選ぶ →「ごりら」が列に入り、ひよこが「じゃあ ぼくは… らっこ。」）。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**
