# 勉強アプリ Task 1 報告：九九ロジック Chiid.kuku

状態: DONE（コミットなし）

## 変更ファイル
- 新規 `app-benkyo/subjects/kuku.js`（Chiid.kuku。DOMに触らない）
- 新規 `tests/kuku.test.js`（13件）
- 変更 `tests/index.html`（本体に `../app-benkyo/subjects/kuku.js`、テストに `kuku` を追加）

## 赤→緑
- 赤: 実装前に `PASS 51 / FAIL 13`。原因は `Chiid.kuku` が未定義（Cannot read properties of undefined）。
- 途中: 実装直後 `PASS 63 / FAIL 1`（judge の `'012'` が correct になった）。
- 緑: 修正後 `PASS 64 / FAIL 0`（既存51＋新規13）。確認はローカルサーバー（localhost:8111）＋内蔵ブラウザの `#summary`。

## 判断したこと
- `judge`: 計画に「`'09'`→正解」「`'012'`→不正解（3桁以上）」の両方があるため、先頭0を削る方式ではなく「入力が3文字以上なら wrong、2文字以下は数値比較」にした。数字以外が混じる場合は wrong。
- `pickItem`: プールが2件以上のとき `lastId` を除外し、`Chiid.adaptive.pickWeighted` で苦手重み付け。1の段・9の段だけ（9件）でも尽きない。
- `poolIds`: `onlyDan` があればその段、なければ `a <= min(level+1, 9)`（レベル1＝1・2の段18件、レベル8以上＝81件）。
- `progressFromLogs`: `app-chiiku/game.js` の `loadProgress` と同じ手順（同レベル連続の直近最大5、最後の1問でレベルが変わるなら新レベル＋recent空）。レベルは1〜8に丸める。
- 「同じレベルが続いた分」のテストは、期待値を具体値 `[true,false,true,false,true]` で固定。

## 未確認・懸念
- 画面（Task 2以降）は未着手。`docs/design-spec.md` は変更していない。
- 確認用サーバーは止めた（`taskkill` で PID 終了、以後の接続は失敗＝停止を確認）。
