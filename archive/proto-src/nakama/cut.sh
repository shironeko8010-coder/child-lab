#!/bin/sh
# 使い方: sh cut.sh シート.png 名前1 … 名前9（左上から右へ）。3×3に切り（となりの絵が入らないよう 3% 内側）、256×256 の jpg にする
src=$1; shift
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$src")
c=$((W/3)); m=$((c*3/100)); s=$((c-2*m)); i=0
for name in "$@"; do
  x=$(( (i%3)*c )); y=$(( (i/3)*c ))
  ffmpeg -loglevel error -y -i "$src" -vf "crop=$s:$s:$((x+m)):$((y+m)),scale=256:256" -q:v 3 "app-chiiku/img/nakama/$name.jpg"
  i=$((i+1))
done
