# Task 6 報告：timer（利用時間）

## 作ったファイル
- shared/timer.js
- tests/timer.test.js（5テスト）

## 署名
- `Chiid.timer.start(profileId, now?)` / `stop()` / `remainingSec(profileId)`（制限なし=null）/ `isOver(profileId)` / `onOver(cb)`
- テスト用: `_tick()`, `_setTimers({setInterval, clearInterval}|null)`, `_setVisible(bool|null)`

## 動作
- 10秒ごとに tick。経過時間を `addPlaySeconds` に保存。1秒未満の端数は持ち越し。
- 0時をまたぐ区間は、日ごとに分けて保存（ローカル日付）。
- 画面が隠れている間は数えない（`visibilitychange`）。再表示時に基準時刻をリセット。
- `remainingSec` / `isOver` は、計測中なら未保存分を先に保存してから計算（10秒の遅れなし）。
- 超過時は止めずに `onOver` を1回だけ呼ぶ（問題の途中でお休みを出すかは画面側が決める = Review Focus 4）。
- `stop()` は端数を保存して終了。

## テスト（ブラウザ http://localhost:8080/tests/index.html）
- 60秒で isOver / onOver 1回、制限0でnull、23:59:50→00:00:10またぎ、隠れている間は不計、stop後は不計。
- 全体は PASS 15 / FAIL 8。失敗8件はすべて他担当の gate / adaptive（未実装）で、timer の失敗は0。

## 懸念
- 0時をまたぐ瞬間の、1秒未満の端数は捨てる（最大1秒の誤差）。
- テストは `storage._forceMemory(true)` を使い、終了時に false へ戻す。他のテストと状態を共有するので、並行実行はしない前提。
- start() 時点ですでに超過の場合、onOver は呼ばない（呼び出し側が isOver で確認する）。
- 実機（タブ切替・画面ロック）での確認はしていない。
