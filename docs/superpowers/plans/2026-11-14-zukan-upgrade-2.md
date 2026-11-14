# ずかん グレードアップ 2回目（今の9テーマに4ページずつ） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 今の9テーマに4ページずつ（36ページ）足し、1テーマ16ページにする。

**Architecture:** 1回目で分けた `zukan-pages-1〜3.js` の行に足すだけ（画面のしくみは変えない）。絵文字がないページは `zukan-art.js` に SVG を足す。16まいになる「わたしのずかん」のカード一覧が スクロールなしで入るかを確かめ、入らなければ並べ方を変える。

**Tech Stack:** 素の HTML/JS/CSS。テスト `tests/index.html`。声 `tools/voice-lines.html` → `perl tools/voice/make.pl`。

**Spec:** `docs/superpowers/specs/2026-11-14-benkyo-zukan-upgrade-design.md`（3章・5章・7章の2回目）

## Global Constraints
- 1回目と同じ（漢字・まめちしき1〜2文・3問目の答えは まめちしきの中・正しいとも言える選択肢を入れない・「？」で終わる・「は」で始めない・スクロールなし・字18px/ボタン56px）。
- 絵：絵文字（Unicode 12 以前、ZWJ なし）。ないときだけ SVG。同じテーマの中で 同じ絵を2回使わない。
- 今の108ページの id・中身は変えない。

## 新しいページ（36）
| テーマ | ページ（絵） |
|---|---|
| どうぶつ | クマ🐻・ハリネズミ🦔・ラクダ🐪・コウモリ🦇 |
| 鳥 | ツバメ・キツツキ・ダチョウ・カラス（4つとも SVG） |
| むし | トンボ・ホタル・クワガタ（SVG）・サソリ🦂 |
| しょくぶつ | バラ🌹・クローバー🍀・ヤシ🌴・クリ🌰 |
| 水の いきもの | カエル🐸・クマノミ🐠・まき貝🐚・ワニ🐊 |
| きょうりゅう | パキケファロサウルス・イグアノドン・モササウルス（SVG）・きょうりゅうの じだい🌋 |
| うちゅうと 天気 | たつまき🌪️・きり🌫️・天の川🌌・こおり🧊 |
| からだ | きんにく💪・すいみん💤・あせ💦・ばいきん🦠 |
| のりもの | きかん車🚂・ちかてつ🚇・トラック🚛・ヨット⛵ |

## Review Focus
1. わたしのずかん（16まい）：8つの画面の大きさで スクロールなし（Task 3）。
2. テーマ選びの「n/16」の数：今までの記録（108ページ）で 正しく数える（今のテスト `cardsFromLogs と countFor` の total を 16 に）。
3. 新しい SVG の名前が zukan-art.js にすべてある（`zukan-art: ★のページの絵がすべてある`）。

---

### Task 1: テストを先に直す
- [ ] `tests/zukan.test.js`：`EXPECT = { themes: 9, perTheme: 16 }`。art の一覧に 10この SVG 名を足す。`countFor` の total を 16。同じテーマで 同じ絵文字を2回使わない テストを足す。
- [ ] テストを開いて FAIL を確かめる。

### Task 2: 36ページと絵を書く
- [ ] 行を `zukan-pages-1〜3.js` に足す。SVG を `zukan-art.js` に足す。`sw.js` の CACHE_NAME を上げる。
- [ ] テスト：`zukan-data:`・`zukan-art:` が PASS（声のテストは Task 5 まで FAIL）。

### Task 3: わたしのずかんの大きさ
- [ ] iframe で 8つの大きさ × わたしのずかん（16まい）・いちばん長い新しいページ。入らなければ `.zk-grid` の列を変える。

### Task 4: 確認ページ（ここで止まる）
- [ ] `docs/zukan-check.html` を「この回のページだけ」出す形にする（1回目の108ページの id は出さない）。やまとさんに送って OK をもらう。

### Task 5: 声・しあげ（OK のあと）
- [ ] 読み上げ文の一覧 → 読みの確認と直し → 音声ファイル → 全テスト → 設計書の行（design-spec.md の「9テーマ×12ページ」→16）。
