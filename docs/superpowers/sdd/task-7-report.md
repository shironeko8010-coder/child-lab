# Task 7 報告（adaptive: 難易度と苦手の重み付け出題）

## 状態
完了（実装・テストとも）。

## 作ったファイル
- `shared/adaptive.js`
- `tests/adaptive.test.js`
- `docs/superpowers/sdd/task-7-report.md`（この報告）

## テスト結果
- 実装前: adaptive の2テストが失敗（`Chiid.adaptive` が未定義）を確認。
- 実装後: `http://localhost:8080/tests/index.html` で `PASS 23 / FAIL 0`（他の担当のテストを含む合計）。

## 懸念
- `pickWeighted` は ids が空のとき `null` を返す（計画に記載なし。呼び出し側で空を避けること）。
- 直近5問は配列の末尾5件を使う（配列は古い順と想定）。
- 実機（タブレット）での動作は未確認。
