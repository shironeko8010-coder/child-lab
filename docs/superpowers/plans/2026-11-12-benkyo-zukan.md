# べんきょう「ずかん」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 勉強アプリに、図鑑のページを読んで2問答え、カードを集める「ずかん」（9テーマ×12ページ）を足す。

**Architecture:** 中身（`zukan-data.js`）・しくみ（`zukan.js`、画面に触らない）・絵（`zukan-art.js`、★11ページの SVG）・画面（`zukan-screen.js`）の4ファイル。画面は nagasa-screen.js / hantai-screen.js と同じ形（#app が無いテストでは状態だけ動かす）。カードは学習記録から作る（別の保存場所は作らない）。

**Tech Stack:** 素の HTML/JS/CSS（`<script>` 読み込み）、絵文字、SVG、tests/runner.js、perl（tools/voice/make.pl）、VOICEVOX。

**Spec:** `docs/superpowers/specs/2026-11-12-benkyo-zukan-design.md`

## Global Constraints
- 通信なし。外部ライブラリ・CDN・外部フォントなし。
- 画面の字：1年生の漢字はそのまま、2年生の漢字は `{漢字|よみ}`（ルビの中は2年の字だけ）、3年生以上は ひらがな。いきもの・のりものの名前は カタカナ。
- ページは spec 7章の108ページ（説明・問題・答え・まちがいの文言そのまま。漢字のテストに合わせた表記の直しだけ可）。テーマの順も7章の順。
- 記録：1ページ1件、`area: 'zukan'`、`itemId`＝ページの id、`correct`＝2問とも1回目で正解。カードあり＝記録が1件以上、きらきら＝`correct: true` が1件以上。
- 1回＝3ページ。2回目のまちがいで答えを見せ「つぎへ」。叱らない。
- 読み上げ文：`'こたえは｜<答え>｜だよ。｜つぎは できるよ！'`、`'カードを ゲット！'`、`'きらきらカード ゲット！'`、せいかい・やり直しは hantai-screen.js と同じ。部品は「は」で始めない（答えのことばそのものは、読みを確かめて可）。
- 「わたしのずかん」はテーマ選びの画面からだけ開く。
- 教科カード11まい。横向きは 6まい×2段。
- ファイルを変えたら `sw.js` の CACHE_NAME を上げ、新しいファイルは PRECACHE に足す。
- コミットは、やまとさんに確かめてから。メッセージの最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- PowerShell は使わない。perl / Bash だけ。

## Review Focus
- 1つのテーマのカードを全部 きらきらにしたあと、そのテーマを選ぶ → 止まらずに どれかのページが出る（Task 2 の pickPage テスト）。
- 3ページの途中でホームや「わたしのずかん」に行って戻る → 記録が二重にならない、前のページの続きが勝手に始まらない（Task 4 の画面テスト）。
- 問題の「つぎへ」・カードの「つぎへ」の連打 → ページが2つ飛ばない（Task 4 の画面テスト）。
- 説明の読み上げ中に「よめた！」を押す → 読み上げを止めて問題へ（Task 4 のブラウザ確認）。
- 読み上げの見分け方が、ほかの教科の文と同じになる短いことば（「秋」「月」など）→ ほかの教科の読みを変えない（Task 5 の差分確認）。

---

### Task 1: ページの中身（データ）

**Files:**
- Create: `app-benkyo/subjects/zukan-data.js`
- Create: `tests/zukan.test.js`
- Modify: `tests/index.html`（本体の列の hantai-screen.js のあとに `zukan-data.js`・`zukan.js`・`zukan-art.js`・`zukan-screen.js`。テストの列の `'hantai'` のあとに `'zukan'`）

**Interfaces:**
- Produces（`C.zukanData`）:
  - `THEMES`：`[{ id, name, icon }]`。9件、spec 7章の順。id＝`doubutsu, tori, mushi, shokubutsu, mizu, kyoryu, uchu, karada, norimono`。name＝`どうぶつ, とり, むし, しょくぶつ, 水の いきもの, きょうりゅう, うちゅうと 天気, からだ, のりもの`。icon＝`🦁 🐦 🦋 🌻 🐟 🦕 🪐 💪 🚄`。
  - `PAGES`：`[{ id, theme, name, pic, art, text, qs: [{ ask, a, wrong: [3] }, { … }] }]`。108件。id はローマ字（例 `lion`、`dangomushi`）で重ならない。`pic` は絵文字（★のページは `null`）、`art` は ★のページだけ SVG の名前（`dangomushi, semi, kabutomushi, asagao, torikera, sutego, puterano, ankiro, supino, raputoru, futaba`）。`text` は説明（spec のまま、文の終わりは「。」）。

- [ ] **Step 1: テストを書く**（`tests/zukan.test.js`。漢字の調べ方は tests/hantai.test.js の `kanjiOk` と同じ関数を写す）

```js
C.test('zukan-data: 9テーマ×12ページ、id が重ならない', function () {
  var D = C.zukanData;
  C.assertEq(D.THEMES.map(function (t) { return t.id; }), ['doubutsu', 'tori', 'mushi', 'shokubutsu', 'mizu', 'kyoryu', 'uchu', 'karada', 'norimono']);
  C.assertEq(D.PAGES.length, 108);
  D.THEMES.forEach(function (t) { C.assertEq(D.PAGES.filter(function (p) { return p.theme === t.id; }).length, 12); });
  var ids = {}; D.PAGES.forEach(function (p) { if (ids[p.id]) throw new Error(p.id); ids[p.id] = 1; });
});
C.test('zukan-data: どのページも 絵・説明・問題2つ（答え1つ＋まちがい3つ、重ならない）', function () {
  C.zukanData.PAGES.forEach(function (p) {
    if (!(p.pic || p.art) || !/。$/.test(p.text) || p.qs.length !== 2) throw new Error(p.id);
    p.qs.forEach(function (q) {
      var all = [q.a].concat(q.wrong);
      if (q.wrong.length !== 3 || all.filter(function (x, i) { return all.indexOf(x) === i; }).length !== 4) throw new Error(p.id + ' ' + q.ask);
    });
  });
  C.assertEq(C.zukanData.PAGES.filter(function (p) { return p.art; }).map(function (p) { return p.art; }).sort(),
    ['ankiro', 'asagao', 'dangomushi', 'futaba', 'kabutomushi', 'puterano', 'raputoru', 'semi', 'supino', 'sutego', 'torikera']);
});
C.test('zukan-data: 漢字は2年まで（ルビの中は2年の字だけ、外は1年の字だけ）', function () { /* name・text・ask・a・wrong すべてを kanjiOk で調べる */ });
C.test('zukan-data: 答えのことばは説明の中に出てくる（読めば答えられる）', function () {
  // 答えの文字列（ルビをとったもの）から、空白で分けたことばのうち いちばん長いものが、説明（ルビをとったもの）に入っている
});
```

- [ ] **Step 2: 失敗を確かめる** — tests/index.html で zukan-data のテストが FAIL。
- [ ] **Step 3: `zukan-data.js` を書く**（spec 7章を写す。漢字のテストに合わない表記は、決まりどおりに直す：2年の字は `{字|よみ}`、1年の字はルビなし、3年以上は ひらがな。直した所は ledger に書く）
- [ ] **Step 4: 通ることを確かめる** — `FAIL 0`。「答えのことばが説明の中」のテストで落ちるページは、spec 11章のとおり ことばの一部で確かめるよう、テストの きまりを調整するか、説明の言い回しを答えに合わせる（どちらにしたかを ledger に書く）。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**

---

### Task 2: しくみ（ページの選び方・問題・カード）

**Files:**
- Create: `app-benkyo/subjects/zukan.js`
- Test: `tests/zukan.test.js`

**Interfaces:**
- Consumes: `C.zukanData`
- Produces（`C.zukan`）:
  - `AREA = 'zukan'`, `PAGES_PER_ROUND = 3`
  - `TEXT = { card: 'カードを ゲット！', kira: 'きらきらカード ゲット！', ready: 'よめた！' }`
  - `pagesOf(themeId) -> page[]`、`pageById(id) -> page`
  - `cardsFromLogs(logs) -> { [pageId]: 'card' | 'kira' }`
  - `countFor(themeId, cards) -> { got, kira, total }`
  - `pickPage(themeId, cards, usedIds, rng) -> page`：まだのページ → きらきらでないページ → どれでも の順。`usedIds`（同じ回で出たページ）は出さない。どれも残らないときは `usedIds` を無視して選ぶ。
  - `makeQuiz(page, rng) -> [{ ask, choices: [4], answer }, { … }]`（選択肢はまぜる）
  - `check(item, index) -> boolean`
  - `answerText(item) -> 'こたえは｜' + item.choices[item.answer] + '｜だよ。｜つぎは できるよ！'`

- [ ] **Step 1: テストを足す**

```js
C.test('zukan: cardsFromLogs と countFor', function () {
  var Z = C.zukan;
  var cards = Z.cardsFromLogs([{ area: 'zukan', itemId: 'lion', correct: false }, { area: 'zukan', itemId: 'lion', correct: true },
    { area: 'zukan', itemId: 'kirin', correct: false }, { area: 'kanji', itemId: 'lion', correct: true }]);
  C.assertEq(cards, { lion: 'kira', kirin: 'card' });
  C.assertEq(Z.countFor('doubutsu', cards), { got: 2, kira: 1, total: 12 });
});
C.test('zukan: pickPage は まだ → きらきらでない → どれでも の順、同じ回のページは出さない', function () {
  var Z = C.zukan, ids = Z.pagesOf('doubutsu').map(function (p) { return p.id; });
  var cards = {}; ids.slice(0, 11).forEach(function (id) { cards[id] = 'kira'; });
  C.assertEq(Z.pickPage('doubutsu', cards, [], Math.random).id, ids[11]);          // まだは1つだけ
  ids.forEach(function (id) { cards[id] = 'kira'; }); cards[ids[3]] = 'card';
  C.assertEq(Z.pickPage('doubutsu', cards, [], Math.random).id, ids[3]);           // きらきらでないページ
  ids.forEach(function (id) { cards[id] = 'kira'; });
  var p = Z.pickPage('doubutsu', cards, ids.slice(0, 11), Math.random);
  C.assertEq(p.id, ids[11]);                                                        // ぜんぶきらきら：同じ回のページは出さない
  C.assertEq(!!Z.pickPage('doubutsu', cards, ids, Math.random), true);              // 残りがなくても止まらない
});
C.test('zukan: makeQuiz と check、answerText', function () {
  var Z = C.zukan, page = Z.pageById('lion'), quiz = Z.makeQuiz(page, Math.random);
  C.assertEq(quiz.length, 2);
  quiz.forEach(function (it, i) {
    C.assertEq(it.ask, page.qs[i].ask); C.assertEq(it.choices.length, 4);
    C.assertEq(it.choices[it.answer], page.qs[i].a);
    C.assertEq(Z.check(it, it.answer), true); C.assertEq(Z.check(it, (it.answer + 1) % 4), false);
  });
  C.assertEq(Z.answerText(quiz[0]), 'こたえは｜ネコ｜だよ。｜つぎは できるよ！');
});
C.test('zukan: 読み上げの部品は「は」で始めない（答えのことばそのものは よい）', function () { /* 全ページの text・ask・answerText を ｜で分けて調べる */ });
```

- [ ] **Step 2: 失敗を確かめる** — `C.zukan` がない。
- [ ] **Step 3: `zukan.js` を書く**（Interfaces どおり。`pickPage` の「どれでも」は `C.adaptive` を使わず一様に選ぶ）
- [ ] **Step 4: 通ることを確かめる** — `FAIL 0`。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**

---

### Task 3: ★11ページの絵（SVG）

**Files:**
- Create: `app-benkyo/zukan-art.js`
- Test: `tests/zukan.test.js`

**Interfaces:**
- Produces: `C.zukanArt = { <art名>: '<svg viewBox="0 0 120 120" …>…</svg>' }`（11件。Task 1 の art 名と同じ）

絵の決まり：120×120、形と色だけ（線は太め、目は黒丸）。ダンゴムシ（灰色の だ円に横すじ・まるまった形）、セミ（茶色の からだに すきとおった はね）、カブトムシ（こげ茶の からだに 大きな つの）、アサガオ（むらさきの らっぱ形の花と つる）、恐竜6つ（トリケラトプス＝つの3本と えりかざり、ステゴサウルス＝せなかの いた、プテラノドン＝つばさを広げた形、アンキロサウルス＝よろいと しっぽの こぶ、スピノサウルス＝せなかの ほ、ヴェロキラプトル＝はねのある 小さな 二本足）、フタバスズキリュウ（首の長い ひれのある 海の生きもの、水色の背景）。

- [ ] **Step 1: テストを足す**

```js
C.test('zukan-art: ★のページの絵がすべてある', function () {
  C.zukanData.PAGES.filter(function (p) { return p.art; }).forEach(function (p) {
    var s = C.zukanArt[p.art];
    if (!s || !/^<svg viewBox="0 0 120 120"/.test(s) || !/<\/svg>$/.test(s)) throw new Error(p.art);
  });
});
```
- [ ] **Step 2: 失敗を確かめる**
- [ ] **Step 3: `zukan-art.js` を書く**（上の絵の決まりどおり）
- [ ] **Step 4: 通ることを確かめる**。さらにブラウザで11まいを並べて見て（一時的な確認ページ `docs/zukan-art-check.html` を作ってよい）、何の絵か分かる形になっているか確かめる。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**

---

### Task 4: 画面・教科カード・親画面・オフライン

**Files:**
- Create: `app-benkyo/zukan-screen.js`
- Modify: `app-benkyo/main.js`（`SUBJECTS` の hantai のあとに `{ id: 'zukan', name: 'ずかん', sub: 'よんで こたえよう', enabled: true }`、`ICONS.zukan`（ひらいた本、48×48）、hantai と同じ分かれ道で `B.zukanScreen.show`）
- Modify: `app-benkyo/index.html`（4ファイルを hantai-screen.js のあとに）
- Modify: `app-benkyo/app.css`（`.zk-*`、教科カードの横向き 6まい×2段）
- Modify: `shared/parent.js:8`（`zukan: 'ずかん'`）
- Modify: `sw.js`（PRECACHE に4ファイル、CACHE_NAME を上げる）
- Modify: `tests/benkyo.test.js`（SUBJECTS 11件、有効に zukan）
- Test: `tests/zukan.test.js`

**Interfaces:**
- Consumes: `C.zukan`・`C.zukanData`・`C.zukanArt`、`B.ui`、`B.checkRest`、`C.storage.logAnswer`・`getLogs`。
- Produces: `C.benkyo.zukanScreen = { show(ctx) -> Promise, _theme(id), _ready(), _choose(i), _next(), _flush(), _openBook(), _bookTheme(id), _openCard(pageId), _back(), _again(), _state() }`
  - `_state()` → `{ phase, theme, pageId, qIndex, answer, tried, tries, revealed, got, pagesDone, message }`
  - phase：`'loading' | 'themes' | 'page' | 'quiz' | 'feedback' | 'reveal' | 'card' | 'reward' | 'book' | 'bookPage' | 'rest'`

画面の決まり（spec 2〜5章）：
- `show` → 記録を読み `cards` を作る → `'themes'`。テーマ選び：9テーマを 3×3（アイコン・名前・「got/12」・きらきら数）。下に「わたしのずかん」ボタン。
- テーマを押す → 回を始める（`pagesDone = 0`、`usedIds = []`）→ `pickPage` → `'page'`：絵（絵文字は大きく、art は SVG）・名前・説明。説明を読み上げる。「よめた！」→ 読み上げを止めて `'quiz'`（qIndex 0）。
- 問題：hantai-screen.js と同じ（1回目まちがい＝うすく、2回目＝光って `'reveal'`＋「つぎへ」、正解＝`'feedback'`→待ってから次）。
- 2問目が終わる → 記録1件（2問とも1回目で正解か）→ `cards` を更新 → `'card'`：カード（きらきらは金色のふち）と `TEXT.card`／`TEXT.kira` の読み上げ、「つぎへ」。
- `'card'` の「つぎへ」→ `pagesDone` が3なら `'reward'`、ちがえば お休みの確かめ（`B.checkRest`）→ 次のページ。
- `'reward'`：「もう{一回|いっかい}」（同じテーマで次の回）、「おわる」（テーマ選びへ）。
- わたしのずかん（`'book'`）：テーマのタブ9つ、12まい（横 6×2、たて 3×4）。カードあり＝絵と名前（きらきらは金のふち）、なし＝「？」。カードを押す → `'bookPage'`（絵・説明・読み上げ、「もどる」）。「もどる」で テーマ選びへ。
- 回の途中で画面を離れたら、その回は捨てる（記録はページを終えたときだけ）。`'card'` の「つぎへ」・問題の「つぎへ」は1回だけ効く。

- [ ] **Step 1: テストを足す**（nagasa.test.js・hantai.test.js の画面テストと同じ `fresh / open / logsOf / nt`）

```js
nt('テーマ選び → ページ → よめた → 2問とも1回目で正解 → きらきらカード、記録1件 true', function () { /* _theme('doubutsu') → phase 'page' → _ready() → 'quiz' → _choose(answer); _flush(); _choose(answer); _flush() → phase 'card', got 'kira' → logs 1件 correct true */ });
nt('まちがえてもカード（ふつう）、記録1件 false', function () { /* 1問目で2回まちがい → reveal → _next() → 2問目正解 → 'card', got 'card' */ });
nt('つぎへ の連打でもページは1つだけ進む', function () { /* 'card' で _next(); _next(); → pagesDone 1、phase 'page'、pageId が1回だけ変わる */ });
nt('3ページで ごほうび、もういっかいで同じテーマの次の回', function () { /* 3ページ終える → 'reward' → _again() → 'page'、theme 同じ、pagesDone 0 */ });
nt('回の途中で わたしのずかんへ行って戻ると、テーマ選びから。記録はふえない', function () { /* 'quiz' の途中で _back()（テーマ選びへ）→ _openBook() → 'book' → _back() → 'themes'、logs 0件 */ });
nt('わたしのずかん：カードありのページだけ開ける', function () { /* 記録 lion を入れて open → _openBook() → _openCard('lion') → 'bookPage'、_openCard('kirin') は phase 'book' のまま */ });
C.test('zukan: 親画面に「ずかん」の名前がある', function () { /* parent.js に zukan: 'ずかん' */ });
```
（`tests/benkyo.test.js` の SUBJECTS テストを11件・zukan 入りに）

- [ ] **Step 2: 失敗を確かめる**
- [ ] **Step 3: 画面・カード・CSS・parent.js・sw.js を書く**（上の決まりどおり）
- [ ] **Step 4: テストが通ることを確かめる** — `FAIL 0`。
- [ ] **Step 5: ブラウザで確かめる**（横 1280×800・1024×600・812×375、たて 800×1280・375×812）
  - 教科カード11まい：横向き 6×2 で はみ出さない。
  - テーマ選び 3×3、ページ（いちばん長い説明）、問題、カード、わたしのずかん（12まい）が はみ出さない。
  - 説明の読み上げ中に「よめた！」→ 読み上げが止まって問題へ。
- [ ] **Step 6: コミットしてよいか、やまとさんに聞く**

---

### Task 5: 読み上げ（ずんだもんの音声ファイル）

**Files:**
- Modify: `tools/voice-lines.js`（`where = 'ずかん'`、SOURCES・RUBY_SOURCES に4ファイル）、`tools/voice-lines.html`（4ファイルを読み込む）
- 生成: `voice/z/*.ogg`、`shared/voice-clips.js`、`tools/voice/lines.tsv`・`ruby.tsv`・`made.tsv`
- Modify（必要なら）: `tools/voice/overrides.tsv`、`tools/voice/yomi-fix.tsv`

- [ ] **Step 1: 文の作り方を足す** — 全ページで `add(page.text)`、各問題で `add(q.ask)` と `add('こたえは｜' + q.a + '｜だよ。｜つぎは できるよ！')`。`add(TEXT.card)`、`add(TEXT.kira)`。
- [ ] **Step 2: 書き出す**（voice-lines.html で「保存しました」）。書き出す前の lines.tsv を `$TMP` に写しておく。
- [ ] **Step 3: ほかの教科の読みを変えていないか見る** — 前の lines.tsv との差分で、消えた・変わった行が 0。
- [ ] **Step 4: 読みを先に調べる** — 「ずかん」の行の「読ませる文」を VOICEVOX の audio_query で一覧にし（しりとり・はんたいと同じ方法）、カタカナの名前、数（1964年、119番、21日、200こ）、「は（歯）」、1字のことば（月・雪・雲・目・耳・手・足）を目で確かめる。おかしいものは overrides.tsv。
- [ ] **Step 5: 音声を作る**（約650文・約30分。10分を超えるので、`timeout` を付けずにバックグラウンドで） — 最後の行が `失敗: 0`。
- [ ] **Step 6: テストを流す** — `FAIL 0`（「すべて音声ファイルがある」を含む）。勉強アプリで、全ページの text・ask・answerText と TEXT が `C.voice.hasClip` で true。
- [ ] **Step 7: コミットしてよいか、やまとさんに聞く**

---

### Task 6: 設計書（正本）の更新と仕上げの確認

**Files:**
- Modify: `docs/design-spec.md`（8章の表に ずかん の spec ファイル）

- [ ] **Step 1: design-spec.md に「ずかん」を足す**（はんたい ことば と同じ形で1行）
- [ ] **Step 2: 全部のテストを流す** — `FAIL 0`。
- [ ] **Step 3: 仕上げのレビュー**（最も強いモデルのレビューを1回。中身の事実のまちがい・まぎらわしい選択肢も見てもらう）。Critical・Important は直してテストを流す。
- [ ] **Step 4: やまとさんへの報告** — 実機で確かめてほしいことを、試す例つきで書く（例：「どうぶつ」→ ライオンのページ →「よめた！」→「ネコ」「メス」で きらきらカード）。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**
