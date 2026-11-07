# 音声修正 報告

## 変更
- shared/sfx.js: 音の通り道を「効果音バス / BGMバス → DynamicsCompressor → 出力」に変更（音割れ防止）。BGM音量 0.05 → 0.18（約3.6倍）。効果音はバスで1.2倍。`Chiid.sfx.duck(on)` 追加（ONでBGMバスを50%へ、OFFで戻す。setTargetAtTimeで滑らかに）。テスト用 `_bgmGainTarget()` `_isDucked()`。`_reset` でduck解除。
- shared/voice.js: `_pickVoice(voices)`（localService===true かつ ja-JP/ja のみ。Enhanced/Premium/Neural/Natural/Kyoko/Otoya/O-Ren/Haruka 等を優先。無ければ null）。speak で選んだ声を `u.voice` に設定、`pitch=1.1`、rate=0.85 維持。voiceschanged で選び直し。`currentVoiceName()` 追加。speak 開始で `Chiid.sfx.duck(true)`、終了/エラー/6秒タイムアウトで `duck(false)`（sfx 未ロードでも例外なし）。
- tests/sfx.test.js, tests/voice.test.js: duck状態、_pickVoice（localService=false除外/優先/null）、speakのduck呼び出し・pitch・声名のテスト追加。

## テスト
PASS 45 / FAIL 0（localhost:8093。8080は他作業の影響でサーバが落ちていたため別ポートで実行）。

## 懸念（実機で耳確認）
- BGMの大きさ（0.18）と読み上げとのバランス。大きすぎ/小さすぎなら sfx.js の BGM_VOL を調整。
- ducking の戻り方、声が実際に自然になったか（端末に localService の日本語声が1つだけだと変化なし）。`Chiid.voice.currentVoiceName()` で選ばれた声名を確認可。
- 名前判定に google も含めたが、localService=false の声は対象外なので通信する声は選ばれない。
- 実際の音（AudioContext）はブラウザ自動テストでは耳確認していない。
