# べんきょう「はんたい ことば」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 勉強アプリに、反対の意味のことば・文を4つから選ぶ「はんたい ことば」を足す。

**Architecture:** 「長さ・かさ」と同じ2ファイル構成。`app-benkyo/subjects/hantai.js`（`C.hantai`：ことば・出題・判定・読み上げ文。画面に触らない）と `app-benkyo/hantai-screen.js`（`C.benkyo.hantaiScreen`：画面・記録・星・ごほうび。#app が無いテストでは状態だけ動かす）。読み上げは ずんだもんの音声ファイルを「よみ」から作る。

**Tech Stack:** 素の HTML/JS/CSS（`<script>` 読み込み）、SVG、tests/runner.js、perl（tools/voice/make.pl）、VOICEVOX。

**Spec:** `docs/superpowers/specs/2026-11-12-benkyo-hantai-design.md`

## Global Constraints
- 通信なし。外部ライブラリ・CDN・外部フォントなし。
- 画面の字：1年生の漢字はそのまま、2年生の漢字は `{漢字|よみ}`、3年生以上は ひらがな（spec 3章の表の書き方そのまま）。
- ことば：レベル1は27組、レベル2は37組、レベル3は37文（spec 3章の表の順・なかま・まちがいの選択肢そのまま）。レベル1・2では、どのことばも1回だけ出る。
- AREA＝'hantai'、MAX_LEVEL＝3、ROUND_SIZE＝10、STAR_EVERY＝5。itemId は `w:<組のid>:a`（a を見せて b を答える）／`w:<組のid>:b`／`s:<文のid>`。
- 読み上げ文（spec 6章）：`'「<t>」の はんたいは？'`、`'<文>｜どれが はんたいの 文かな？'`、`'こたえは｜<答え>｜だよ。｜つぎは できるよ！'`。部品は「は」で始めない。せいかい・やり直しの文は nagasa-screen.js と同じ（`'正かい！'`、`'もう{一回|いっかい} やってみよう！'`）。
- 叱らない。2回目のまちがいで答えを見せ、「つぎへ」で次へ。
- ファイルを変えたら `sw.js` の CACHE_NAME を上げ、新しいファイルは PRECACHE に足す。
- コミットは、やまとさんに確かめてから。メッセージの最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- PowerShell は使わない。perl / Bash だけ。

## Review Focus
- 読み上げの見分け方（ふりがなを取った字）が、ほかの教科の文と同じになる短いことば（「上」「下」「中」「男」など）→ ほかの教科の読みを変えてしまわない（Task 3 で lines.tsv の差分を見る）。
- 答えを見せたあとの選択肢のタップ・「つぎへ」の連打 → 記録は1問1件、問題が2つ飛ばない（Task 2 の画面テスト）。
- まちがえて うすくなったボタンをもう一度押す → まちがい回数がふえない（Task 2 の画面テスト）。
- レベル3の文が長いとき（「{兄|あに}は {足|あし}が はやい。」など）、スマホ横向き（812×375）で選択肢がはみ出さない（Task 2 のブラウザ確認）。
- 1日の利用時間を超えたとき → 次の問題の前にお休み画面（nagasa-screen.js と同じ）（Task 2）。

---

### Task 1: ことばと出題の関数（画面なし）

**Files:**
- Create: `app-benkyo/subjects/hantai.js`
- Create: `tests/hantai.test.js`
- Modify: `tests/index.html`（本体の列で `'subjects/nagasa', 'nagasa-screen'` のあとに `'subjects/hantai', 'hantai-screen'`。テストの列の `'nagasa'` のあとに `'hantai'`）

**Interfaces:**
- Produces（`C.hantai`）:
  - `AREA = 'hantai'`, `MAX_LEVEL = 3`, `ROUND_SIZE = 10`, `STAR_EVERY = 5`
  - `PAIRS`：`[{ id, level, group, a: { t, y }, b: { t, y } }]`。id はローマ字（例 `ookii`＝大きい↔小さい）。`t` は画面の字（ふりがな記法つき）、`y` は全部ひらがなの よみ。group は spec のなかま名（'大きさ' など）。
  - `SENTENCES`：`[{ id, pre, word: { t, y }, post, ans: { t, y }, wrong: [{ t, y }, { t, y }, { t, y }] }]`。pre・post は よみ も同じ字（ひらがな・カタカナ・1年の漢字のみ）のときは文字列、2年の漢字を含むときは `{ t, y }`。id は spec の表の id。
  - `idsFor(level) -> string[]`
  - `makeQuestion(id, rng) -> { id, level, kind: 'word' | 'sentence', ask: { t, y }, choices: [{ t, y }×4], answer: number }`：sentence の ask・choices は文まるごと（pre＋ことば＋post）。word のまちがいは、同じ group の ほかの組のことば（a・b どちらでも）から選び、足りなければ同じレベルのほかの組から。
  - `pickQuestion(opts, rng) -> question`：`opts = { level, missCounts, lastId }`。`C.adaptive.pickWeighted` で選び、`lastId` と同じものは出さない。
  - `check(q, index) -> boolean`
  - `speakText(q)`・`answerText(q) -> string`（画面の字の形）。`speakYomi(q)`・`answerYomi(q) -> string`（同じ形で、t の代わりに y を使ったもの。音声を作るときの「読ませる文」）
  - `progressFromLogs(logs) -> { level, recent, missCounts }`：nagasa.js の同名関数と同じ考え方。

- [ ] **Step 1: テストを書く**（`tests/hantai.test.js`、nagasa.test.js と同じ書き方）

```js
function plain(t) { return t.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '$1'); }
function gradeOf(ch) { var r = C.kanjiData.filter(function (k) { return k[0] === ch; })[0]; return r ? r[1] : 9; }
function kanjiOk(t) {   // ルビの中の漢字は2年まで、ルビの外の漢字は1年だけ
  var inside = (t.match(/\{([^|{}]+)\|/g) || []).join('');
  var outside = t.replace(/\{[^}]*\}/g, '');
  return (inside.match(/[一-龯]/g) || []).every(function (c) { return gradeOf(c) <= 2; }) &&
         (outside.match(/[一-龯]/g) || []).every(function (c) { return gradeOf(c) === 1; });
}
C.test('hantai: 定数とことばの数', function () {
  C.assertEq([H.AREA, H.MAX_LEVEL, H.ROUND_SIZE, H.STAR_EVERY], ['hantai', 3, 10, 5]);
  C.assertEq(H.PAIRS.filter(function (p) { return p.level === 1; }).length, 27);
  C.assertEq(H.PAIRS.filter(function (p) { return p.level === 2; }).length, 37);
  C.assertEq(H.SENTENCES.length, 37);
  C.assertEq([1, 2, 3].map(function (lv) { return H.idsFor(lv).length; }), [54, 74, 37]);
});
C.test('hantai: id が重ならず、ことばは1回だけ、よみは ひらがな、漢字は2年まで', function () {
  var ids = {}, words = {};
  H.PAIRS.forEach(function (p) {
    if (ids[p.id]) throw new Error('id ' + p.id); ids[p.id] = 1;
    [p.a, p.b].forEach(function (w) {
      var k = plain(w.t);
      if (words[k]) throw new Error('2回: ' + k); words[k] = 1;
      if (!/^[ぁ-ゖー]+$/.test(w.y) || !kanjiOk(w.t)) throw new Error(w.t);
    });
  });
  H.SENTENCES.forEach(function (s) {
    if (ids['s' + s.id]) throw new Error('id ' + s.id); ids['s' + s.id] = 1;
    C.assertEq(s.wrong.length, 3);
    if (s.wrong.some(function (w) { return plain(w.t) === plain(s.ans.t); })) throw new Error(s.id);
    [s.word, s.ans].concat(s.wrong).forEach(function (w) { if (!kanjiOk(w.t)) throw new Error(s.id + ' ' + w.t); });
  });
});
C.test('hantai: makeQuestion（ことば）', function () {
  H.idsFor(1).concat(H.idsFor(2)).forEach(function (id) {
    var q = H.makeQuestion(id, Math.random);
    C.assertEq(q.kind, 'word'); C.assertEq(q.choices.length, 4);
    var ts = q.choices.map(function (c) { return c.t; });
    if (ts.indexOf(q.ask.t) >= 0) throw new Error('問題のことばが選択肢に ' + id);
    if (ts.filter(function (t, i) { return ts.indexOf(t) === i; }).length !== 4) throw new Error('同じ選択肢 ' + id);
    C.assertEq(H.check(q, q.answer), true);
    C.assertEq(H.check(q, (q.answer + 1) % 4), false);
  });
  var big = H.makeQuestion('w:ookii:a', Math.random);   // 大きい → 小さい。まちがいは 大きさ のなかまだけ
  var size = H.PAIRS.filter(function (p) { return p.group === '大きさ'; }).reduce(function (a, p) { return a.concat([p.a.t, p.b.t]); }, []);
  C.assertEq(big.ask.t, '大きい'); C.assertEq(big.choices[big.answer].t, '小さい');
  big.choices.forEach(function (c) { if (size.indexOf(c.t) < 0) throw new Error(c.t); });
  var rev = H.makeQuestion('w:ookii:b', Math.random);
  C.assertEq(rev.ask.t, '小さい'); C.assertEq(rev.choices[rev.answer].t, '大きい');
});
C.test('hantai: makeQuestion（文）', function () {
  var q = H.makeQuestion('s:biru', Math.random);
  C.assertEq(q.kind, 'sentence'); C.assertEq(q.level, 3);
  C.assertEq(q.ask.t, 'この ビルは {高|たか}い。');
  C.assertEq(q.choices[q.answer].t, 'この ビルは ひくい。');
  C.assertEq(q.choices.some(function (c) { return c.t === 'この ビルは やすい。'; }), true);
  C.assertEq(q.choices[q.answer].y, 'この ビルは ひくい。');
});
C.test('hantai: pickQuestion は同じ問題を続けない', function () {
  var last = null;
  for (var k = 0; k < 60; k++) {
    var q = H.pickQuestion({ level: 1 + (k % 3), missCounts: {}, lastId: last }, Math.random);
    if (q.id === last || H.idsFor(q.level).indexOf(q.id) < 0) throw new Error(q.id);
    last = q.id;
  }
});
C.test('hantai: 読み上げ文', function () {
  var w = H.makeQuestion('w:ookii:a', Math.random), s = H.makeQuestion('s:biru', Math.random);
  C.assertEq(H.speakText(w), '「大きい」の はんたいは？');
  C.assertEq(H.speakYomi(w), '「おおきい」の はんたいは？');
  C.assertEq(H.speakText(s), 'この ビルは {高|たか}い。｜どれが はんたいの 文かな？');
  C.assertEq(H.answerText(w), 'こたえは｜小さい｜だよ。｜つぎは できるよ！');
  C.assertEq(H.answerYomi(s), 'こたえは｜この ビルは ひくい。｜だよ。｜つぎは できるよ！');
  [1, 2, 3].forEach(function (lv) {
    H.idsFor(lv).forEach(function (id) {
      var q = H.makeQuestion(id, Math.random);
      [H.speakText(q), H.answerText(q)].forEach(function (t) { t.split('｜').forEach(function (p) { if (/^は/.test(p)) throw new Error(id); }); });
      C.assertEq(H.speakYomi(q).split('｜').length, H.speakText(q).split('｜').length);
    });
  });
});
C.test('hantai: progressFromLogs', function () { /* nagasa.test.js の progressFromLogs と同じ形で、area: 'hantai' だけ数える */ });
```

- [ ] **Step 2: 失敗を確かめる** — `http://localhost:8765/tests/index.html` で hantai のテストが FAIL（`C.hantai` がない）。
- [ ] **Step 3: `app-benkyo/subjects/hantai.js` を書く**（Interfaces どおり。冒頭コメントは nagasa.js と同じ書き方。ことばは spec 3章の表どおり。`pre`/`post` を文字列にするか `{t,y}` にするかは、2年の漢字が入るか どうかで決める。よみ が カタカナのところ（ビル など）は y でもカタカナのまま）
- [ ] **Step 4: 通ることを確かめる** — `#summary` が `FAIL 0`。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**

---

### Task 2: 画面・教科カード・親画面・オフライン

**Files:**
- Create: `app-benkyo/hantai-screen.js`
- Modify: `app-benkyo/main.js`（`SUBJECTS` の `nagasa` のあとに `{ id: 'hantai', name: 'はんたい ことば', sub: '大きい↔小さい', enabled: true }`、`ICONS` に `hantai`（左右の矢印 ⇄。nagasa と同じ 48×48 の形）、`nagasa` と同じ分かれ道で `B.hantaiScreen.show`）
- Modify: `app-benkyo/index.html`（nagasa-screen.js のあとに `subjects/hantai.js`、`hantai-screen.js`）
- Modify: `app-benkyo/app.css`（`.ht-*` の見た目。ホーム10まい）
- Modify: `shared/parent.js:8`（`hantai: 'はんたい ことば'`）
- Modify: `sw.js`（PRECACHE に2ファイル、CACHE_NAME を上げる）
- Modify: `tests/benkyo.test.js:13-17`（SUBJECTS は10件、有効なものに hantai を足す）
- Test: `tests/hantai.test.js`

**Interfaces:**
- Consumes: Task 1 の `C.hantai` すべて。`B.ui`（nagasa-screen.js が使うものと同じ）、`C.storage.logAnswer`、`C.adaptive.nextLevel`、`C.timer.isOver`。
- Produces: `C.benkyo.hantaiScreen = { show(ctx) -> Promise, _choose(index), _next(), _flush(), _again(), _state() }`。`_state()` は `{ phase, id, kind, level, answer, tried: [番号…], tries, revealed, message, solved, stars }`。

画面の決まり（spec 4・5章）：
- 流れ・記録・星・ごほうび・お休み画面は nagasa-screen.js と同じ（`show → nextQuestion → 答え → STAR_EVERY ごとに星 → ROUND_SIZE でごほうび`）。`phase` は `'loading' | 'question' | 'feedback' | 'reveal' | 'reward' | 'rest'`。
- 上：レベル1・2は「「<ことば>」の はんたいは？」の ことばを大きく。レベル3は文を大きく（ことばの部分を `<b>`）。もういちど きくボタン。
- 下：選択肢4つ（`.ht-choice`）。レベル1・2は 2×2、レベル3は横長を縦に4つ。押したら：
  - 正しい → `'正かい！'`、効果音、記録、`WAIT_CORRECT` のあと次の問題。
  - ちがう（1回目）→ そのボタンに `.tried`（うすく・押しても何もしない）、`'もう{一回|いっかい} やってみよう！'`。
  - ちがう（2回目）→ 正しいボタンに `.right`（光る）、`answerText` を読む、`phase: 'reveal'`、「つぎへ」ボタンを出す。reveal の間の選択肢は何もしない。「つぎへ」は1回だけ効く。
- 記録は1問に1回（1回目で正しければ true）。

- [ ] **Step 1: テストを足す**（`tests/hantai.test.js` の後ろに、nagasa.test.js の「長さ・かさの画面」と同じ形の `fresh / open / logsOf / nt` を作る）

```js
nt('正解で記録 true が1件', function () { /* open → _choose(_state().answer) → phase 'feedback'、message '正かい！'、logs 1件 true */ });
nt('1回目まちがい→うすく、同じボタンをもう一度押しても tries は1のまま', function () { /* _choose(ちがう番号) ×2 → tries 1、tried にその番号 */ });
nt('2回目まちがい→答えを見せる。選択肢・つぎへの連打でも記録は1件、問題は1つだけ進む', function () {
  /* ちがう番号2つ → phase 'reveal', revealed true → _choose(answer) は何もしない → _next(); _next(); → solved 1、id が1回だけ変わる、logs 1件 false */
});
nt('10問でごほうび、5問ごとに星', function () { /* nagasa.test.js の同名テストと同じ形 */ });
C.test('hantai: 親画面に「はんたい ことば」の名前がある', function () { /* parent.js に hantai: 'はんたい ことば' */ });
```
（`tests/benkyo.test.js` の SUBJECTS テストは、10件・hantai 入りに書きかえる）

- [ ] **Step 2: 失敗を確かめる** — 上のテストと benkyo・precache のテストが FAIL。
- [ ] **Step 3: 画面・カード・CSS・parent.js・sw.js を書く**（上の決まりどおり）
- [ ] **Step 4: テストが通ることを確かめる** — `FAIL 0`。
- [ ] **Step 5: ブラウザで確かめる**（`http://localhost:8765/app-benkyo/index.html`、横 1280×800・1024×600・812×375、たて 800×1280・375×812）
  - ホームの教科カード10まいがはみ出さない。
  - レベル1・2・3（記録を足してレベルを上げる）の問題が出て、文の選択肢がはみ出さない。
  - 2回まちがえると正しいボタンが光り、「つぎへ」で次へ。
- [ ] **Step 6: コミットしてよいか、やまとさんに聞く**

---

### Task 3: 読み上げ（ずんだもんの音声ファイル）

**Files:**
- Modify: `tools/voice-lines.js`（`'長さ・かさ'` のあとに `where = 'はんたい ことば'`。SOURCES・RUBY_SOURCES に2ファイル）、`tools/voice-lines.html`（2ファイルを読み込む）
- 生成: `voice/z/*.ogg`、`shared/voice-clips.js`、`tools/voice/lines.tsv`・`ruby.tsv`・`made.tsv`
- Modify（必要なら）: `tools/voice/overrides.tsv`

**Interfaces:**
- Consumes: `C.hantai.idsFor`・`makeQuestion`・`speakText`・`speakYomi`・`answerText`・`answerYomi`。

- [ ] **Step 1: 文の作り方を足す** — レベル1〜3の すべての id で `q = makeQuestion(id)`、`add(speakText(q), speakYomi(q))`、`add(answerText(q), answerYomi(q))`。さらに word 問題では、選択肢にならない側もすべて答えになるので、`PAIRS` の a・b それぞれについて `add('こたえは｜' + w.t + '｜だよ。｜つぎは できるよ！', 'こたえは｜' + w.y + '｜だよ。｜つぎは できるよ！')`。
- [ ] **Step 2: 書き出す** — `http://localhost:8765/tools/voice-lines.html` で「保存しました」。
- [ ] **Step 3: ほかの教科の読みを変えていないか見る** — `git diff tools/voice/lines.tsv | grep '^-' | grep -v '^---'` が 0 行（消えた行・書きかわった行がない）。あれば、その見分け方は既にほかの教科で使っている文なので、hantai 側の add で synth を渡さないようにする（ルールを ledger に書く）。
- [ ] **Step 4: 読みを先に調べる** — 新しい行だけを VOICEVOX の audio_query で調べる（しりとりのときと同じ方法：lines.tsv から `はんたい ことば` の行の「読ませる文」を取り出し、kana を一覧にする）。1字のことば（上・下・右・左・中・外・南・北・東・西・男・女・兄・弟・姉・妹・父・母・朝・夜・夏・冬・春・秋）と「入る」「出る」「出す」「午前」「午後」を目で確かめる。おかしいものは overrides.tsv。
- [ ] **Step 5: 音声を作る**（VOICEVOX 起動が必要。約330文） — `perl tools/voice/make.pl`。最後の行が `失敗: 0`。
- [ ] **Step 6: テストを流す** — `FAIL 0`（「すべて音声ファイルがある」を含む）。勉強アプリで、すべての id の `speakText`・`answerText` が `C.voice.hasClip` で true。
- [ ] **Step 7: コミットしてよいか、やまとさんに聞く**

---

### Task 4: 設計書（正本）の更新と仕上げの確認

**Files:**
- Modify: `docs/design-spec.md`（8章の表に はんたい ことば の spec ファイル。正本を変えることを、やまとさんに先に知らせる）

- [ ] **Step 1: design-spec.md に「はんたい ことば」を足す**（長さ・かさ と同じ形で1行）
- [ ] **Step 2: 全部のテストを流す** — `FAIL 0`。
- [ ] **Step 3: 仕上げのレビュー**（最も強いモデルのレビューを1回）。Critical・Important は直してテストを流す。
- [ ] **Step 4: やまとさんへの報告** — 実機で確かめてほしいことを、試す例つきで書く（例：「「大きい」の はんたいは？」→「小さい」で「正かい！」。レベル3「この ビルは 高い。」→「この ビルは ひくい。」）。
- [ ] **Step 5: コミットしてよいか、やまとさんに聞く**
