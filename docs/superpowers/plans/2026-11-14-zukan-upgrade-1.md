# ずかん グレードアップ 1回目（今の108ページを深くする） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 今の108ページに「まめちしき（1〜2文）」と「3問目（まめちしきを読めば答えられる問題）」を足し、スマホでは説明とまめちしきを2まいに分けて見せる。

**Architecture:** ページのデータを `zukan-data.js`（THEMES と入れもの）と `zukan-pages-1/2/3.js`（テーマのまとまりごとのページ）に分ける。行の形に まめちしき と3問目を足す。画面（`zukan-screen.js`）は 問題の数を `qs` の数に合わせ、スマホの大きさでは ページ → まめちしき → 問題 の順にする。中身は確認ページでやまとさんに見てもらってから声を作る。

**Tech Stack:** 素の HTML/JS/CSS（通常の `<script>`）。テストは `tests/index.html`（`perl tools/serve.pl . 8765`、`#summary` が `PASS n / FAIL 0`）。声は `tools/voice-lines.html` → `perl tools/voice/make.pl`（VOICEVOX）。

**Spec:** `docs/superpowers/specs/2026-11-14-benkyo-zukan-upgrade-design.md`（前の設計書 `docs/superpowers/specs/2026-11-12-benkyo-zukan-design.md`）

## Global Constraints

- 日本語の文：1年生の漢字はそのまま、2年生の漢字は `{漢字|よみ}`、3年生以上の漢字は使わない。
- まめちしき：1〜2文。説明とは べつの事実。3問目の答えは まめちしきの中に出てくる。
- 今の決まり：答えのことばは説明かまめちしきの中に出てくる／正しいとも言える選択肢をまちがいに入れない／問いは「？」で終わる文／読み上げの部品は助詞の「は」で始めない。
- 今の108ページの id・説明・1〜2問目は変えない（記録をそのまま使うため）。
- スマホの大きさ＝よこ向きで高さ520px以下、たて向きで幅520px以下。スクロールなし（スマホ 667×375・740×360・812×375・375×667・360×740・390×844、タブレット 1280×800・1024×600）。字 18px（補足16px）以上、ボタン 56px（高さ340px以下は48px）以上。
- 通信なし。ファイルは削除しない。コミットは頼まれたときだけ。PowerShell は使わない。ファイルを変えたら `sw.js` の CACHE_NAME を上げ、新しいファイルは PRECACHE に入れる。

## Review Focus

1. スマホで まめちしきのまいを出しているときに 画面の向きを変えた／タブレットの大きさになった：問題に進めなくならない（Task 2 のテスト `zukanScreen: 2まいの途中で1まいになっても 読めた！で問題へ`）。
2. 3問目の途中で ホームへ戻る→また ずかん：前のページの続きにならず、記録も入らない（Task 2 のテスト `zukanScreen: 3問目の途中で やめたら 記録しない`）。
3. わたしのずかん（book）で カードを開いたとき：まめちしきも読める（Task 2 のテスト `zukanScreen: わたしのずかんの ページにも まめちしき`）。
4. いちばん長い説明＋まめちしきのページ：タブレット1まい・スマホ2まいの どちらでもスクロールが出ない（Task 2 の Step 5）。
5. きらきらは3問とも1回目で正解のときだけ（2問目までの考えのまま きらきらにならない）（Task 2 のテスト `zukanScreen: 3問目を まちがえたら カード`）。

---

### Task 1: ページのデータを分けて、まめちしきと3問目を書く

**Files:**
- Modify: `app-benkyo/subjects/zukan-data.js`（THEMES と `C.zukanData = { THEMES, PAGES: [], addRows(rows) }` だけにする）
- Create: `app-benkyo/subjects/zukan-pages-1.js`（どうぶつ・鳥・むし・しょくぶつ）、`zukan-pages-2.js`（水の いきもの・きょうりゅう・うちゅうと 天気・からだ）、`zukan-pages-3.js`（のりもの。2・3回目で足す）
- Modify: `app-benkyo/index.html`・`tests/index.html`・`tools/voice-lines.html`（zukan-data.js のあとに pages-1〜3）、`sw.js`（PRECACHE に3ファイル、CACHE_NAME を上げる）
- Test: `tests/zukan.test.js`

**Interfaces:**
- Produces: 行の形 `[id, テーマ, 名前, 絵文字, SVG名, 説明, まめちしき, 問題1, 問題2, 問題3]`（問題は `[問い, 答え, [まちがい3つ]]`）。ページ `{ id, theme, name, pic, art, text, mame, qs: [{ask, a, wrong}×3] }`。`C.zukanData.addRows(rows)` は行をページにして PAGES に足す。

- [ ] **Step 1: テストを直す（先に）** — `tests/zukan.test.js`：
  - 先頭に `var EXPECT = { themes: 9, perTheme: 12 };`（回ごとに書きかえる）と、今の108ページの id の一覧 `OLD_IDS`（いまの PAGES から作った一覧をテストに書きこむ）。
  - `zukan-data: 9テーマ×12ページ…` を EXPECT で数える形にし、`OLD_IDS` がすべてあることも確かめる。
  - `zukan-data: どのページも…` に まめちしき（文字列・1〜2文＝「。」が1〜2こ）と 問題3つ を足す。
  - 新しく `zukan-data: 3問目の答えは まめちしきの中に出てくる`。今の「答えのことばは説明の中に出てくる」は 説明＋まめちしき の中で確かめる。
  - 漢字・「は」で始めない・正しいとも言える選択肢・「？」で終わる の各テストを まめちしきと3問目にも当てる（対象の文を集める所に足す）。
- [ ] **Step 2: テストを開いて失敗を確かめる** — Expected：まめちしき・3問目のテストが FAIL。
- [ ] **Step 3: データを分ける** — 今の ROWS を、行はそのままで3つのファイルに移す（id・説明・1〜2問目は1文字も変えない）。まめちしきと3問目を、108ページすべてに書く（Global Constraints の決まりどおり。事実は正確に。数・年は確かなものだけ）。
- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`zukan-data:` すべて PASS。ほかも PASS（`voice:` の音声ファイルのテストは 新しい文の分だけ FAIL ＝ Task 4 で直る）。

---

### Task 2: 画面（まめちしき・スマホの2まい・3問）

**Files:**
- Modify: `app-benkyo/subjects/zukan.js`（`makeQuiz` は `page.qs` の数だけ。すでにそうなら変えない）、`app-benkyo/zukan-screen.js`、`app-benkyo/app.css`（`.zk-mame` など。最後に足す）
- Test: `tests/zukan.test.js`

**Interfaces:**
- Consumes: Task 1 のページ（`mame`、`qs` 3つ）。
- Produces: 画面の phase に `'mame'`（スマホの2まい目）。テスト用 `B.zukanScreen._twoSheets(true|false|null)`（スマホの大きさかどうかを決め打ちする。null で もどす）、`_toMame()`（1まい目の「つぎへ」）。

- [ ] **Step 1: テストを書く／直す**
  - 今の画面テスト（2問を答えて カード）を 3問に直す（3問目まで答えてから カード・記録）。
  - `zukanScreen: 3問で1ページおわり、記録1件`：3問とも1回目で正解 → 記録1件 correct true。
  - `zukanScreen: 3問目を まちがえたら カード`：1・2問目正解、3問目で1回まちがえて正解 → 記録 correct false。
  - `zukanScreen: スマホの大きさでは ページ → まめちしき → 問題`：`_twoSheets(true)` → `_theme` → phase 'page' → `_toMame()` → 'mame' → `_ready()` → 'quiz'。`_twoSheets(false)` では 'page' から `_ready()` で 'quiz'（'mame' を通らない）、`_toMame()` は何もしない。
  - `zukanScreen: 2まいの途中で1まいになっても 読めた！で問題へ`：'mame' のとき `_twoSheets(false)` → `_ready()` で 'quiz'。
  - `zukanScreen: 3問目の途中で やめたら 記録しない`：2問答えて ほかの画面を開く（`show` をもう一度）→ 記録0件。
  - `zukanScreen: わたしのずかんの ページにも まめちしき`：`_openBook` → `_openCard(id)` → `_state()` に `mame` があり、画面の状態で読める（`_state().mame === ページの mame`）。
- [ ] **Step 2: テストを開いて失敗を確かめる** — Expected：上のテストが FAIL。
- [ ] **Step 3: 画面を書く** — 問題の数は `st.quiz.length`（今の `qIndex === 0` の決め打ちをやめる）。まめちしき：タブレットは説明の下に「まめちしき」の見出しつきで、読み上げは説明→まめちしき。スマホの大きさ（`matchMedia('(orientation: landscape) and (max-height: 520px), (orientation: portrait) and (max-width: 520px)')`、`_twoSheets` で上書き可）は 1まい目に「つぎへ」、2まい目に まめちしき＋「{読|よ}めた！」、読み上げは そのまいの文。問題の画面の「1もんめ」の所に 3つの点（いまの問題を光らせる）を足す。わたしのずかんのページにも まめちしき。
- [ ] **Step 4: テストを開いて通るのを確かめる** — Expected：`zukanScreen:` すべて PASS、ほかも PASS（音声ファイルのテストを除く）。
- [ ] **Step 5: 大きさを確かめる** — iframe で 8つの画面の大きさ × いちばん長い（説明＋まめちしきの文字数が多い）ページ・問題3問・わたしのずかんのページ で スクロールなし、字・ボタンの下限。

---

### Task 3: 確認ページ（ここで止まって、やまとさんに見てもらう）

**Files:**
- Create: `docs/zukan-check.html`（108ページの 名前・絵・説明・まめちしき・3問目（問い・答え・まちがい）を テーマごとに一覧。ふりがなは `{漢字|よみ}` を ルビで見せる。データは `app-benkyo/subjects/zukan-data.js`・`zukan-pages-*.js` を読みこんで出す）

- [ ] **Step 1: 確認ページを作り、ブラウザで108ページ分が出ることを確かめる。**
- [ ] **Step 2: やまとさんに 確認ページを送って（SendUserFile）、見てもらう。ここで止まる。** 直しの指示があれば Task 1 のデータを直し、テストを通してから もう一度見てもらう。「OK」が出るまで Task 4 に進まない。

---

### Task 4: 声・しあげ

**Files:**
- Modify: `tools/voice-lines.js`（ずかんの区切りで まめちしきと3問目も add。今の add の所に `p.mame` と `p.qs[2]` を足す）、`tools/voice/lines.tsv`・`made.tsv`・`shared/voice-clips.js`・`voice/z/*.ogg`（ツールが書く）
- Modify: `docs/superpowers/specs/2026-11-12-benkyo-zukan-design.md`（冒頭に「グレードアップの設計書：…upgrade-design.md」の1行）

- [ ] **Step 1: 読み上げ文の一覧を作る** — `lines.tsv` を控えてから `tools/voice-lines.html`（「保存しました」）。差分は まめちしき・3問目の文だけ（今ある行の変更 0）。
- [ ] **Step 2: 読みを確かめる** — VOICEVOX（止まっていれば やまとさんに起動をお願いする）で `perl tools/voice/make.pl --preview`。数・単位・カタカナ語の読みを見て、おかしければ `tools/voice/overrides.tsv`／`yomi-fix.tsv`。
- [ ] **Step 3: 音声ファイルを作る** — `perl tools/voice/make.pl`。Expected：「失敗: 0」。
- [ ] **Step 4: 全テスト** — Expected：`PASS n / FAIL 0`。
- [ ] **Step 5: 全体の大きさ** — べんきょうの全教科の最初の場面とトップを 8つの画面の大きさで（前からある 1024×600 の どうとく は除く）。
