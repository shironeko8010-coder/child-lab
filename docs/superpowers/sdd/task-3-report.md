# Task 3 報告: sfx

## 作ったファイル
- shared/sfx.js
- tests/sfx.test.js（5件）

## 内容
- API: play(tap|correct|oops|star), startBgm, stopBgm, setSfxOn, setBgmOn, isSfxOn, isBgmOn, isBgmPlaying
- テスト用: _ctxCreated, _disable, _reset
- AudioContext は最初の play / startBgm（＝タップ内）で遅延生成。OFF中は作らない。suspended なら resume。
- oops は 440Hz -> 392Hz のやわらかい2音。BGMは16拍の短い旋律を setInterval でループ。
- 全体を try/catch で囲み、AudioContext 不可でも例外を出さない（Review Focus 1の趣旨）。

## TDD
- 先に実装なしで実行: sfx 5件すべて失敗（Chiid.sfx 未定義）を確認。
- 実装後: http://localhost:8080/tests/index.html で sfx の失敗なし（全体 PASS 15 / FAIL 8、残り8件は他担当のgate/timer/adaptive未実装分）。

## 懸念
- 耳での確認（4音が不快でないか）は未実施。やまとさんに依頼が必要。
- headless では実際に音が出るかは未確認（例外が出ないことのみ確認）。
- startBgm は初回に getCtx を呼ぶため、ユーザー操作の中で呼ぶ必要がある。
