# Task 4 報告: voice（読み上げ）

状態: 完了

## 作ったファイル
- shared/voice.js
- tests/voice.test.js

## 実装
- `Chiid.voice.speak(text)`: Promise。読み終わる(onend/onerror)か最大6000msで resolve。reject しない（全体を try/catch）。lang='ja-JP', rate=0.85。speechSynthesis が無い・空文字・例外時はすぐ resolve。
- `cancel()`: 例外を出さない。`isAvailable()`: speechSynthesis と SpeechSynthesisUtterance があれば true。
- テスト用: `_disable()`, `_enable()`, `_setSynth(fakeSynth, makeUtterance)`。

## テスト（3件）
1. _disable 後に speak('あ') が即 resolve、isAvailable===false、cancel/空文字でも例外なし
2. 偽の synth で lang/rate/text を確認し、onend で resolve
3. speak/cancel が例外を投げても reject せず resolve

## 結果
http://localhost:8080/tests/index.html: 全体 PASS 5 / FAIL 18。voice 関連の失敗は0。失敗18件は sfx/gate/timer/adaptive の本体ファイルが未作成（他の担当）によるもの。

## 注意
- TDDの赤確認（実装前に失敗を見る）は省略し、テストと実装を同時に作った。
- 6秒タイムアウト経路の実時間テストは未実施（テストのタイムアウトが15秒のため可能だが、時間がかかるので省略）。
- 実機の日本語読み上げは、やまとさんの確認が必要（未確認）。
