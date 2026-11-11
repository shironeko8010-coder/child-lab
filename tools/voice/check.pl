#!/usr/bin/perl
# 読みのまちがい調べ（開発用）。VOICEVOX の読み（made.tsv のカナ）を、アプリのふりがな・ひらがなの文と比べる。
#   使い方: perl tools/voice/check.pl   → tools/voice/check.tsv に、あやしい文を書き出す
# しらべ方
#   1) ふりがな：文に {漢字|よみ} の漢字が入っていたら、その よみ が VOICEVOX の読みに入っているか
#   2) ひらがなだけの文：VOICEVOX の読みと、文の読みが同じか（は→ワ、へ→エ、を→オ、のばす音のちがいは同じとみなす）
use strict; use warnings; use utf8;
use Encode qw(encode_utf8 decode_utf8);

my ($root) = ($0 =~ m{^(.*)/tools/voice/check\.pl$}); $root = '.' unless defined $root && length $root;
sub readtsv { my ($f) = @_; my @r; open my $h, '<:raw', $f or return @r;
  while (my $l = <$h>) { $l = decode_utf8($l); $l =~ s/\r?\n$//; next if $l eq '' || $l =~ /^#/; push @r, [split /\t/, $l, -1]; } close $h; @r }

sub kata { my $s = shift; $s =~ tr/ぁ-ゖ/ァ-ヶ/; $s }
# 比べやすくする：記号を取る・のばす音をそろえる・は/へ/を をそろえる
sub norm {
  my ($s, $long) = (kata(shift // ''), shift);
  $s =~ s/[^ァ-ヶー]//g;
  $s =~ tr/ヲヅヂ/オズジ/;
  $s =~ s/ハ/ワ/g; $s =~ s/ヘ/エ/g;
  if ($long) {   # 文の読み（ふりがな）の「おう」「えい」は、VOICEVOX では「オオ」「エエ」と書かれる
    1 while $s =~ s/([オコソトノホモヨロゴゾドボポョォ])ウ/$1オ/;
    1 while $s =~ s/([エケセテネヘメレゲゼデベペェ])イ/$1エ/;
  }
  $s =~ s/([アカサタナハマヤラワガザダバパャァ])ー/$1ア/g;
  $s =~ s/([オコソトノホモヨロゴゾドボポョォ])ー/$1オ/g;
  $s =~ s/([ウクスツヌフムユルグズブプュゥ])ー/$1ウ/g;
  $s =~ s/([イキシチニヒミリギジビピィ])ー/$1イ/g;
  $s =~ s/([エケセテネメレゲゼデベペェ])ー/$1エ/g;
  $s;
}

my %ruby;
for my $r (readtsv("$root/tools/voice/ruby.tsv")) {
  my ($k, $y) = @$r; next unless defined $y && $k =~ /\p{Han}/ && $y =~ /^[ぁ-ゖー]+$/;
  push @{$ruby{$k}}, norm($y, 1);
}
my @words = sort { length($b) <=> length($a) } keys %ruby;
my %line = map { $_->[0] => $_ } readtsv("$root/tools/voice/lines.tsv");

my @out; my ($n, $bad) = (0, 0);
for my $m (readtsv(($ENV{MADE} // "$root/tools/voice/made.tsv"))) {
  my ($key, $synth, $id, $kana) = @$m; next unless $line{$key};
  $n++;
  my $got = norm($kana);
  my @why;
  if ($synth !~ /^@/) {
    # 1) ふりがな
    my $rest = $synth;   # 読みの直し（yomi-fix）をしたあとの文で調べる
    for my $w (@words) {
      next unless index($rest, $w) >= 0;
      push @why, "「$w」の読み（" . join('/', @{$ruby{$w}}) . "）" unless grep { index($got, $_) >= 0 } @{$ruby{$w}};
      $rest =~ s/\Q$w\E/　/g;
    }
    # 2) ひらがな・カタカナだけの文
    if ($synth !~ /[\p{Han}0-9０-９]/) {
      my $want = norm($synth, 1);
      push @why, "ちがう読み（$want）" if $want ne $got;
    }
  }
  next unless @why;
  $bad++;
  push @out, join("\t", $key, $kana, join(' ', @why), $id, $line{$key}[2] // '');
}
open my $o, '>:raw', "$root/tools/voice/check.tsv" or die;
print $o encode_utf8("# 文\tVOICEVOX の読み\tあやしい所\t音声の id\tどこの文か\n" . join("\n", @out) . "\n");
close $o;
print encode_utf8("しらべた: $n 文 / あやしい: $bad 文 → tools/voice/check.tsv\n");
