# ちいく「おかいもの」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 知育アプリに、硬貨をトレーに入れて値段どおりに払う「おかいもの」を足す。

**Architecture:** `app-chiiku/okaimono.js` を kazu.js と同じ形で作る（前半＝画面なしの計算関数、後半＝画面）。画面の部品は `C.chiikuUi`、記録は `C.storage.logAnswer`、出題の重みとレベルは `C.adaptive`。読み上げは「部品｜部品」方式で ずんだもんの音声ファイルを作る。

**Tech Stack:** 素の HTML/JS/CSS（`<script>` 読み込み、ES Modules なし）、SVG、tests/runner.js、perl（tools/voice/make.pl）、VOICEVOX。

**Spec:** `docs/superpowers/specs/2026-11-12-chiiku-okaimono-design.md`

## Global Constraints
- 通信なし。外部ライブラリ・CDN・外部フォントなし。
- 園児が見る文字・聞く文は ひらがな と 数字 だけ（品物のよみ、例：「くっきー」「じゅーす」）。
- 叱らない。まちがえても直せる。
- 硬貨は `[1,5,10,50,100,500]`。レベル1＝[1,10,100]、2＝[1,5,10,50,100]、3＝6種類。MAX_LEVEL＝3、ROUND_SIZE＝5。
- 値段：レベル1＝10〜399 でどのけたも4以下、レベル2＝10〜499、レベル3＝100〜999。どれも品物の幅の中。
- トレーは20まいまで。
- 記録は `area: 'okaimono'`、`itemId`＝品物の id、せいかい＝1回目の「かう」でぴったり。
- 読み上げ文（spec 7章の文言そのまま）：`'<よみ>は｜<N>えん。｜おかねを いれてね'`、`'<N>えん。'`、`'ぴったり！ かえたね'`、`'すこし たりないよ'`、`'ちょっと おおいよ'`、`'ひかっている おかねを いれてみよう'`、`'トレーの おかねを タップすると もどせるよ'`。
- ファイルを変えたら `sw.js` の CACHE_NAME を上げる。新しいファイルは PRECACHE に足す。
- コミットは、やまとさんに確かめてから。メッセージの最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- PowerShell は使わない。perl / Bash だけ。

## Review Focus
- 品物の幅とレベルの決まりが重ならない組み合わせ（例：レベル1 の すいか）→ その品物は出ない。`itemsFor` のテストで押さえる（Task 1）。
- 「かう」を何度も続けて押す・正解直後に硬貨をタップ → 二重に記録しない、次の問題に進むまで操作を受けつけない（Task 2 のブラウザ確認）。
- トレーが20まいのときに硬貨をタップ → 入らず、こわれない（Task 2 のブラウザ確認）。
- 値段を「1えん。」「5えん。」など硬貨の名前と同じ部品で読む → どちらも音声ファイルがある（Task 3 の「すべて音声ファイルがある」テスト）。
- 1日の利用時間を超えたとき → 次の問題の前にお休み画面（kazu.js と同じ `C.timer.isOver`）（Task 2）。

---

### Task 1: 計算の関数（画面なし）

**Files:**
- Create: `app-chiiku/okaimono.js`（この Task では計算部分と `C.okaimono` の書き出しだけ。`start` は Task 2）
- Create: `tests/okaimono.test.js`
- Modify: `tests/index.html`（本体の列に `'okaimono'`（app-chiiku、`doutoku` のあと）、テストの列に `'okaimono'`）

**Interfaces:**
- Produces（`C.okaimono`）:
  - `AREA = 'okaimono'`, `COINS = [1,5,10,50,100,500]`, `MAX_LEVEL = 3`, `ROUND_SIZE = 5`
  - `ITEMS`：`[{ id, pic, word, min, max }]`（spec 4章の16品、順番もそのまま）
  - `coinsFor(level) -> number[]`（小さい順）
  - `pricesFor(item, level) -> number[]`（小さい順）
  - `itemsFor(level) -> item[]`（`pricesFor` が空でないもの）
  - `pickItem(opts, rng) -> item`：`opts = { level, missCounts, lastId }`。`C.adaptive.pickWeighted` で選び、`lastId` と同じものは出さない（候補が1つだけのときは除く）
  - `makeQuestion(level, opts, rng) -> { item, price, level }`：price は `pricesFor` から一様に選ぶ
  - `splitCoins(amount, level) -> number[]`（大きい順。そのレベルの硬貨で、まい数が一番少ない分け方。大きい硬貨から順に取れば最少になる）
  - `judge(price, total) -> 'just' | 'short' | 'over'`
  - `speakText(q) -> string`：`q.item.word + 'は｜' + q.price + 'えん。｜おかねを いれてね'`
  - `progressFromLogs(logs) -> { level, recent, missCounts }`：kazu.js の同名関数と同じ考え方（area が okaimono のものだけ、itemId ごとのまちがい数）

- [ ] **Step 1: テストを書く**（`tests/okaimono.test.js`、kazu.test.js と同じ書き方）

```js
C.test('okaimono: 定数', function () {
  C.assertEq(O.AREA, 'okaimono'); C.assertEq(O.MAX_LEVEL, 3); C.assertEq(O.ROUND_SIZE, 5);
  C.assertEq(O.COINS, [1, 5, 10, 50, 100, 500]);
  C.assertEq(O.ITEMS.length, 16);
  O.ITEMS.forEach(function (it) { if (!it.pic || !/^[ぁ-ゖー]+$/.test(it.word) || !(it.min < it.max)) throw new Error(it.id); });
});
C.test('okaimono: coinsFor', function () {
  C.assertEq(O.coinsFor(1), [1, 10, 100]);
  C.assertEq(O.coinsFor(2), [1, 5, 10, 50, 100]);
  C.assertEq(O.coinsFor(3), [1, 5, 10, 50, 100, 500]);
});
C.test('okaimono: pricesFor はレベルの決まりと品物の幅を守る', function () {
  O.ITEMS.forEach(function (it) {
    O.pricesFor(it, 1).forEach(function (p) {
      if (p < 10 || p > 399 || /[5-9]/.test(String(p)) || p < it.min || p > it.max) throw new Error('lv1 ' + it.id + ' ' + p);
    });
    O.pricesFor(it, 2).forEach(function (p) { if (p < 10 || p > 499 || p < it.min || p > it.max) throw new Error('lv2 ' + it.id + ' ' + p); });
    O.pricesFor(it, 3).forEach(function (p) { if (p < 100 || p > 999 || p < it.min || p > it.max) throw new Error('lv3 ' + it.id + ' ' + p); });
  });
});
C.test('okaimono: itemsFor はどのレベルでも1つ以上で、すいかはレベル3だけ', function () {
  [1, 2, 3].forEach(function (lv) { C.assertEq(O.itemsFor(lv).length > 0, true); });
  function has(lv) { return O.itemsFor(lv).some(function (it) { return it.id === 'suika'; }); }
  C.assertEq([has(1), has(2), has(3)], [false, false, true]);
});
C.test('okaimono: makeQuestion と pickItem（同じ品物を続けない）', function () {
  var last = null;
  for (var k = 0; k < 60; k++) {
    var q = O.makeQuestion(1, { missCounts: {}, lastId: last }, Math.random);
    if (q.item.id === last || O.pricesFor(q.item, 1).indexOf(q.price) < 0) throw new Error(q.item.id + ' ' + q.price);
    last = q.item.id;
  }
});
C.test('okaimono: splitCoins', function () {
  C.assertEq(O.splitCoins(15, 2), [10, 5]);
  C.assertEq(O.splitCoins(15, 1), [10, 1, 1, 1, 1, 1]);
  C.assertEq(O.splitCoins(880, 3), [500, 100, 100, 100, 50, 10, 10, 10]);
  C.assertEq(O.splitCoins(0, 3), []);
});
C.test('okaimono: judge', function () {
  C.assertEq(O.judge(120, 120), 'just'); C.assertEq(O.judge(120, 110), 'short'); C.assertEq(O.judge(120, 130), 'over');
});
C.test('okaimono: speakText', function () {
  C.assertEq(O.speakText({ item: { word: 'おにぎり' }, price: 120 }), 'おにぎりは｜120えん。｜おかねを いれてね');
});
C.test('okaimono: progressFromLogs', function () { /* kazu.test.js の progressFromLogs と同じ形で、area: 'okaimono' だけ数えることを確かめる */ });
```
（`progressFromLogs` のテストは、`tests/kazu.test.js:49` のテストを area と itemId を置きかえて写す）

- [ ] **Step 2: 失敗を確かめる** — `perl tools/serve.pl . 8765` を動かし、`http://localhost:8765/tests/index.html` を開く。okaimono のテストが FAIL（`C.okaimono` がない）。
- [ ] **Step 3: `app-chiiku/okaimono.js` の計算部分を書く**（上の Interfaces どおり。冒頭コメントは kazu.js と同じ書き方）
- [ ] **Step 4: 通ることを確かめる** — `#summary` が `FAIL 0`。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**

---

### Task 2: 画面・ホームのボタン・親画面・オフライン

**Files:**
- Modify: `app-chiiku/okaimono.js`（`start(profileId)` と画面）
- Modify: `app-chiiku/index.html`（`<script src="okaimono.js"></script>` を doutoku.js のあとに）
- Modify: `app-chiiku/game.js:333`（`playBtn("おかいもの", function () { C.okaimono.start(p.id); });` を どうとく の前に）
- Modify: `app-chiiku/app.css`（`.ok-*` の見た目）
- Modify: `shared/parent.js:8`（`AREA_NAMES` に `okaimono: 'おかいもの'`）
- Modify: `sw.js`（PRECACHE に `'app-chiiku/okaimono.js'`、CACHE_NAME を上げる）
- Test: `tests/okaimono.test.js`

**Interfaces:**
- Consumes: Task 1 の関数すべて。`C.chiikuUi`（`newScreen, topBar, el, svg, button, bubble, chara, play, speak, speakThen, showRest, ICO, STAR`）、`C.storage.logAnswer`、`C.adaptive.nextLevel`、`C.timer.isOver`。
- Produces: `C.okaimono.start(profileId)`。

画面の決まり（spec 2・5・6章）：
- 流れは kazu.js の `start → nextQuestion → showQuestion → 答え → ROUND_SIZE ごとのごほうび` と同じ。`nextQuestion` の最初に `C.timer.isOver` を見る。
- 左：品物の絵（大きな絵文字）・よみ・値段（`120えん`）。右：トレー（硬貨を並べる）と `いま <合計> えん`。下：おさいふ（`coinsFor(level)` の硬貨を小さい順）と「かう」ボタン。もういちど きくボタンは kazu.js と同じ。
- 硬貨は SVG の円。色：1円＝明るい銀、5円・500円＝金色、10円＝銅色、50円・100円＝銀色。5円・50円は真ん中に穴。数字を中に書く。大きさは 1円＜5円＜10円＜50円＜100円＜500円 で、1円でも直径 64px 以上。
- おさいふの硬貨をタップ → トレーに1まい足す、`ui.speak(n + 'えん。')`。20まいなら足さずに `ui.play('tap')` だけ。トレーの硬貨をタップ → おさいふに戻す。
- 「かう」：`judge`。just → ごほうびの演出と `'ぴったり！ かえたね'`、記録、次の問題（kazu.js の WAIT_CORRECT と同じ待ち）。short / over → それぞれの文を読み、まちがい回数を数える。2回目から spec 5章のヒント（short：`splitCoins(price - total, level)` に入っている種類のおさいふの硬貨に `.ok-hint` クラス、over：トレーの硬貨に `.ok-hint`）。
- 記録は1問に1回だけ（1回目の「かう」の結果）。正解のあと次の問題が出るまで、硬貨と「かう」は受けつけない。

- [ ] **Step 1: テストを足す**

```js
C.test('okaimono: 親画面に「おかいもの」の名前がある', function () { /* tests/tokei.test.js:111 と同じ形で 'okaimono' → 'おかいもの' */ });
```
（PRECACHE の一致は、今の `precache.test.js` が index.html の script と sw.js を比べるので、それで確かめる）

- [ ] **Step 2: 失敗を確かめる** — tests/index.html で、上のテストと precache のテストが FAIL。
- [ ] **Step 3: 画面・ボタン・CSS・parent.js・sw.js を書く**（上の決まりどおり）
- [ ] **Step 4: テストが通ることを確かめる** — `FAIL 0`。
- [ ] **Step 5: ブラウザで動きを確かめる**（`http://localhost:8765/app-chiiku/index.html`、横 1280×800 と 1024×600）
  - ホームのボタン7個がはみ出さない。
  - レベル1：硬貨3種類。入れる・戻すで合計が変わる。ぴったりで「かう」→ 次の問題。足りない・多いで文が出て、2回目にヒントが光る。
  - 20まいで21まい目が入らない。「かう」の連打・正解直後のタップで、記録が1件だけ（`C.storage.getLogs` で確かめる）。
- [ ] **Step 6: コミットしてよいか、やまとさんに聞く**

---

### Task 3: 読み上げ（ずんだもんの音声ファイル）

**Files:**
- Modify: `tools/voice-lines.js`（`chiiku()` に「ちいく おかいもの」を足す）
- 生成: `voice/z/*.ogg`、`shared/voice-clips.js`、`tools/voice/lines.tsv`・`ruby.tsv`・`made.tsv`
- Modify: `sw.js`（CACHE_NAME を上げる）
- Modify（必要なら）: `tools/voice/yomi-fix.tsv`・`overrides.tsv`

**Interfaces:**
- Consumes: `C.okaimono.ITEMS`、`C.okaimono.speakText`、`C.okaimono.pricesFor`、`C.okaimono.COINS`。

- [ ] **Step 1: 文の作り方を足す** — `where = 'ちいく おかいもの'`。どのレベルの値段も入るように、`ITEMS` × `[1,2,3]` × `pricesFor` のすべてで `add(speakText({ item, price }))`。硬貨は `COINS` それぞれ `add(n + 'えん。')`。spec 7章の かう・ヒントの5文を `add`。`SOURCES` に `'app-chiiku/okaimono.js'` を足す。
- [ ] **Step 2: 書き出す** — `http://localhost:8765/tools/voice-lines.html` を開き、「保存しました」と文の数が出る。
- [ ] **Step 3: 読みを先に調べる** — `perl tools/voice/make.pl --preview` のあと `MADE=tools/voice/preview.tsv perl tools/voice/check.pl`。`check.tsv` で「えん」の数の読みと品物のよみを見る。さらに `grep 'えん。' tools/voice/preview.tsv | head -30` で 100・300・600・800 などの読み（ヒャク／サンビャク／ロッピャク／ハッピャク）を目で確かめる。おかしい言葉は `yomi-fix.tsv`、1文だけなら `overrides.tsv`。
- [ ] **Step 4: 音声を作る**（VOICEVOX 起動が必要。約1,000文・約40分なので、バックグラウンドで） — `perl tools/voice/make.pl > "$TMP/make.log" 2>&1`。最後の行が `失敗: 0`。
- [ ] **Step 5: sw.js の CACHE_NAME を上げ、テストを流す** — tests/index.html が `FAIL 0`（「すべて音声ファイルがある」を含む）。
- [ ] **Step 6: ブラウザで鳴るか確かめる** — 知育アプリで `C.voice.hasClip('おにぎりは｜120えん。｜おかねを いれてね')` が true、`speak` で端末の声が0回。
- [ ] **Step 7: コミットしてよいか、やまとさんに聞く**

---

### Task 4: 設計書（正本）の更新と仕上げの確認

**Files:**
- Modify: `docs/design-spec.md`（知育の教科一覧に「おかいもの」。正本を変えることを、やまとさんに先に知らせる）

- [ ] **Step 1: design-spec.md に「おかいもの」を足す**（知育の教科の表に1行。詳しくは spec ファイルを指す）
- [ ] **Step 2: 全部のテストを流す** — `FAIL 0`。
- [ ] **Step 3: やまとさんへの報告** — 実機（Androidタブレット）で確かめてほしいことを、試す例つきで書く（例：レベル1で「おにぎり 120えん」→ 100円玉1まい・10円玉2まいで「かう」→「ぴったり！ かえたね」）。
- [ ] **Step 4: コミットしてよいか、やまとさんに聞く**
