#!/bin/sh
# ぬりえの絵（線の絵・スタンプ）を、app-chiiku/nurie-data.js に文字（data URL）として埋めこむ（開発用）。
# index.html を直接開いても「タッチでぬる」が使えるように（ふつうの画像ファイルは、点を調べられないため）。
# 使い方: chiid-lab フォルダで sh archive/proto-src/nurie/make-data.sh
D=archive/proto-src/nurie/png
out=app-chiiku/nurie-data.js
{
  echo "/* ぬりえの絵（自動で作るファイル。手で直さない）。元：archive/proto-src/nurie/make-data.sh */"
  echo "(function () {"
  echo "  'use strict';"
  echo "  var C = (window.Chiid = window.Chiid || {});"
  echo "  C.nurieData = { pics: {"
  for f in $D/*.png; do n=$(basename $f .png); printf "    %s: 'data:image/png;base64,%s',\n" "$n" "$(base64 -w0 $f)"; done
  echo "  }, stamps: {"
  for f in $D/stamp/*.png; do n=$(basename $f .png); printf "    %s: 'data:image/png;base64,%s',\n" "$n" "$(base64 -w0 $f)"; done
  echo "  } };"
  echo "})();"
} > $out
ls -la $out
