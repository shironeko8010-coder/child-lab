#!/bin/sh
# スタンプを ます目から 切り、絵の ある はんいを 調べて まん中に そろえる（開発用）。
#   sh stamp-center.sh シート.png 列 段 白を消す強さ 名前1 名前2 …（名前「-」は とばす）
#   → archive/proto-src/nurie/png/stamp/○○.png（128×128、まわりに 少し 余白、64色）
src=$1; cols=$2; rows=$3; sim=$4; shift 4
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$src")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$src")
cw=$((W/cols)); ch=$((H/rows)); c=$cw; [ $ch -lt $c ] && c=$ch
m=$((c*1/100)); s=$((c-2*m)); i=0
tmp=${TMPDIR:-/tmp}/stamp-center-$$.png
for name in "$@"; do
  x=$(( (i%cols)*cw + (cw-c)/2 + m )); y=$(( (i/cols)*ch + (ch-c)/2 + m ))
  keep=100; case "$name" in *@*) keep=${name#*@}; name=${name%@*};; esac   # 「にじ@80」＝ます目の 上 80% だけ 使う（下の ゴミを よける）
  if [ "$name" != "-" ]; then
    ffmpeg -loglevel error -y -i "$src" -vf "crop=$s:$((s*keep/100)):$x:$y,colorkey=0xffffff:$sim:0.05,format=rgba" "$tmp"
    # 絵の ある はんい（不透明な 点の 上下左右の はし）
    box=$(ffmpeg -loglevel error -i "$tmp" -vf "alphaextract,format=gray" -f rawvideo -pix_fmt gray - | perl -e '
      my $w = shift; local $/; my $d = <STDIN>; my $h = length($d) / $w;
      my (@rc, @cc);   # 行・列ごとの 不透明な 点の 数（小さな ゴミは 数えない）
      for my $yy (0..$h-1) { for my $xx (0..$w-1) { if (ord(substr($d, $yy*$w+$xx, 1)) > 40) { $rc[$yy]++; $cc[$xx]++; } } }
      my ($x0,$y0,$x1,$y1) = (0,0,$w-1,$h-1); my $n = 4;
      $y0++ while $y0 < $h-1 && ($rc[$y0]||0) < $n; $y1-- while $y1 > 0 && ($rc[$y1]||0) < $n;
      $x0++ while $x0 < $w-1 && ($cc[$x0]||0) < $n; $x1-- while $x1 > 0 && ($cc[$x1]||0) < $n;
      my $bw=$x1-$x0+1; my $bh=$y1-$y0+1; my $side=int(($bw>$bh?$bw:$bh)*1.10);
      print join(" ", $x0, $y0, $bw, $bh, $side);' $s)
    set -- $box "$@"; bx=$1; by=$2; bw=$3; bh=$4; side=$5; shift 5
    ffmpeg -loglevel error -y -i "$tmp" -vf "crop=$bw:$bh:$bx:$by,pad=$side:$side:(ow-iw)/2:(oh-ih)/2:color=0x00000000,scale=128:128,split[a][b];[a]palettegen=max_colors=64:reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128" "archive/proto-src/nurie/png/stamp/$name.png"
  fi
  i=$((i+1))
done
rm -f "$tmp"
# いまの スタンプ20こは、次の 4行で 作った（2026-11-28）。キャンディは 棒の 色が うすいので 白を消す強さを 弱くした
#   sh archive/proto-src/nurie/stamp-center.sh archive/proto-src/nurie/stamps.png 3 3 0.10 hoshi heart hana onpu ribon niji@78 kira kumo taiyou
#   sh archive/proto-src/nurie/stamp-center.sh archive/proto-src/nurie/stamps2.png 4 3 0.10 chou tentou ichigo daiya tsuki yuki fuusen kuroobaa - tsurii purezento -
#   sh archive/proto-src/nurie/stamp-center.sh archive/proto-src/nurie/stamps2.png 4 3 0.03 - - - - - - - - kyandi - - -
#   sh archive/proto-src/nurie/make-data.sh
