#!/bin/sh
# ぬりえの絵を切り分ける（開発用）。
#   切ったあと make-data.sh で app-chiiku/nurie-data.js に埋めこむ。
#   線の絵: sh cut.sh line シート.png 名前1 … 名前4（2×2、左上から右へ）→ archive/proto-src/nurie/png/○○.png（512×512、白黒）
#   スタンプ: sh cut.sh stamp シート.png 名前1 … 名前9（3×3）→ archive/proto-src/nurie/png/stamp/○○.png（128×128、白を透明に・64色）
mode=$1; src=$2; shift 2
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$src")
if [ "$mode" = line ]; then n=2; else n=3; fi
c=$((W/n)); m=$((c*2/100)); s=$((c-2*m)); i=0
for name in "$@"; do
  x=$(( (i%n)*c + m )); y=$(( (i/n)*c + m ))
  if [ "$mode" = line ]; then
    ffmpeg -loglevel error -y -i "$src" -vf "crop=$s:$s:$x:$y,scale=512:512,format=gray,lutyuv=y='if(gt(val,200),255,if(gt(val,140),170,if(gt(val,70),85,0)))'" "archive/proto-src/nurie/png/$name.png"
  else
    ffmpeg -loglevel error -y -i "$src" -vf "crop=$s:$s:$x:$y,colorkey=0xffffff:0.10:0.08,scale=128:128,split[a][b];[a]palettegen=max_colors=64:reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128" "archive/proto-src/nurie/png/stamp/$name.png"
  fi
  i=$((i+1))
done
