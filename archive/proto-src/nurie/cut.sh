#!/bin/sh
# ぬりえの絵を切り分ける（開発用）。切ったあと make-data.sh で app-chiiku/nurie-data.js に埋めこむ。
#   sh cut.sh line|stamp 列 段 シート.png 名前1 名前2 …（左上から右へ。名前を「-」にすると とばす）
#   line  → archive/proto-src/nurie/png/○○.png（512×512、4だんかいの 灰色）
#   stamp → archive/proto-src/nurie/png/stamp/○○.png（128×128、白を透明に・64色）
#   ます目の 中の 正方形を、となりが 入らないよう 2% 内がわで 切る
mode=$1; cols=$2; rows=$3; src=$4; shift 4
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$src")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$src")
cw=$((W/cols)); ch=$((H/rows)); c=$cw; [ $ch -lt $c ] && c=$ch
m=$((c*2/100)); s=$((c-2*m)); i=0
for name in "$@"; do
  x=$(( (i%cols)*cw + (cw-c)/2 + m )); y=$(( (i/cols)*ch + (ch-c)/2 + m ))
  if [ "$name" != "-" ]; then
    if [ "$mode" = line ]; then
      ffmpeg -loglevel error -y -i "$src" -vf "crop=$s:$s:$x:$y,scale=512:512,format=gray,lutyuv=y='if(gt(val,200),255,if(gt(val,140),170,if(gt(val,70),85,0)))'" "archive/proto-src/nurie/png/$name.png"
    else
      ffmpeg -loglevel error -y -i "$src" -vf "crop=$s:$s:$x:$y,colorkey=0xffffff:0.10:0.08,scale=128:128,split[a][b];[a]palettegen=max_colors=64:reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128" "archive/proto-src/nurie/png/stamp/$name.png"
    fi
  fi
  i=$((i+1))
done
# ぞうは 鼻が 切れないよう、手で 範囲を 決めて 切った：crop=830:830:700:17（pairUZ.png）
