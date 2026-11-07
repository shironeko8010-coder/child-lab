# SDD ledger — plan: docs/superpowers/plans/2026-11-05-prototype-plan.md

## Setup rulings
- Ruling: gitリポジトリではなく、やまとさんの規則でコミットは頼まれたときだけ → コミット手順は省略。レビューは差分ではなく、対象ファイルを直接読む方式にする。 — 手順書(skill)の差分パッケージが使えないため — 差分が見えにくい(コスト小)。
- Ruling: テストは tests/index.html をブラウザで開き `#summary` を読む。Node/Pythonなし。 — 環境制約 — file:// が開けない場合は別手段を再検討。
- Ruling: 実装担当は並列にしない(同じ shared/ を触るため)。

## Plan scan table
(下に追記)
- 確認用サーバー: `perl tools/serve.pl . 8080`（Bash経由で起動済み、http://localhost:8080/）。ブラウザ内蔵はfile://だとJSが動かないため必須。再起動が要る場合は同コマンド。
- Ruling: Task 1 で tests/index.html に全テストファイル(storage,sfx,voice,gate,timer,adaptive,trace,parent)の<script>を先に列挙する。→ Task 3〜7はファイルが重ならないので並列実装してよい。
- Plan scan: タスク間の共有ファイルは tests/index.html のみ(Task1が一括で作る)。Task2/6/9 は storage の同じ関数名(getSettings, addPlaySeconds, getPlaySeconds, listPlayDays, getLogs)を共有 → 名前一致を確認済み。Task9 が summarize に渡す days は listPlayDays の戻り値と同形。矛盾なし。
- Task 1: complete (実装報告 task-1-2-report.md、PASS 2/FAIL 0。レビューは最終まとめて実施)
- Task 2: complete (同上。懸念: 実ブラウザの保存不可は未確認)
- serve.pl を Connection: close 版に修正し再起動済み(1接続1リクエスト)。
- Task 4: complete (voice、3テスト合格。赤確認は省略と申告。6秒タイムアウトは実時間テストなし)
- Task 3: complete (sfx、5テスト合格。耳での音確認は未実施=やまとさんに依頼。play/startBgmは最初のタップ内で呼ぶ必要あり)
- Task 6: complete (timer、5テスト合格。start時に既に超過ならonOverは呼ばない→ゲーム側でisOverを確認する。実機のタブ切替/画面ロックは未確認)
- Task 7: complete (adaptive、全体 PASS 23/FAIL 0。pickWeightedは空配列でnull。recentは古い順)
- Task 5: complete (gate、6テスト合格。ロック状態はメモリのみ=再読込で解除。30秒経過の自動解除は未目視)。Tasks 1-7 全体 PASS 23/FAIL 0。
- Task 8: complete (data/trace、全体 PASS 36/FAIL 0。赤確認は省略と申告)
- Task 9: complete (parent、5テスト合格、全体 PASS 36/FAIL 0。render前のゲートは呼び出し側=Task10の責務。AREA_NAMESはhiraganaのみ)
- Task 10: 実装完了と報告(game.js等。1280x800/800x1280で通し確認と申告。私は未検証→Task12のQAで検証)。serve.pl に timeout(5) 追加(担当による)。
- Task 11: 実装完了(sw.js PRECACHE18件、manifest、icons。tests PASS 38/FAIL 0)。実SW登録とオフライン再読込は内蔵ブラウザで不可→実機/通常Chromeで要確認。
- Task 12: complete (QA。テスト PASS 39/FAIL 0 を私も確認。ゲート連打/リセット後の書き戻し/キャッシュ名v2を修正。残課題A〜H は docs/qa-report.md)
