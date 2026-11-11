#!/usr/bin/perl
# 読み上げの音声ファイルを作る（開発用。アプリ本体には含まれない）。
#   使い方: perl tools/voice/make.pl            … まだない音声だけ作る
#           perl tools/voice/make.pl --limit 20 … 試しに20文だけ
# 前もって: VOICEVOX を起動しておく（http://127.0.0.1:50021）。ffmpeg を入れておく。
# 入力:  tools/voice/lines.tsv     （tools/voice-lines.html が書き出す。見分け方<TAB>読ませる文<TAB>どこの文か）
#        tools/voice/overrides.tsv （1文ごとの読みの直し。見分け方<TAB>読ませる文。@で始まると AquesTalk 風のカナ表記）
#        tools/voice/yomi-fix.tsv  （ことばの読みの直し。ことば<TAB>読み。すべての文に効く）
#   --preview … 音声は作らず、VOICEVOX の読みだけを tools/voice/preview.tsv に書く（check.pl で調べる用）
# 出力:  voice/z/<id>.ogg、shared/voice-clips.js、tools/voice/made.tsv（作った記録と、VOICEVOX の読み）
use strict; use warnings; use utf8;
use Encode qw(encode_utf8 decode_utf8);
use Digest::MD5 qw(md5_hex);
use LWP::UserAgent; use URI; use JSON::PP;
use File::Path qw(make_path); use File::Copy qw(move);

my $SPEAKER = 3;          # ずんだもん ノーマル
my $SPEED = 1.0;
my $ENGINE = 'http://127.0.0.1:50021';
my ($root) = ($0 =~ m{^(.*)/tools/voice/make\.pl$}); $root = '.' unless defined $root && length $root;
my $limit = 0; for (my $i = 0; $i < @ARGV; $i++) { $limit = $ARGV[$i + 1] if $ARGV[$i] eq '--limit'; }
my $preview = grep { $_ eq '--preview' } @ARGV; my @prev;

my $ffmpeg = $ENV{FFMPEG} || '';
unless ($ffmpeg) {
  my @c = glob(($ENV{LOCALAPPDATA} // '') =~ s{\\}{/}gr . '/Microsoft/WinGet/Packages/Gyan.FFmpeg*/*/bin/ffmpeg.exe');
  $ffmpeg = $c[0] // 'ffmpeg';
}
my $ua = LWP::UserAgent->new(timeout => 120);
my $json = JSON::PP->new->utf8->canonical;

sub readtsv { my ($f) = @_; my @r; open my $h, '<:raw', $f or return @r;
  while (my $l = <$h>) { $l = decode_utf8($l); $l =~ s/\r?\n$//; next if $l eq '' || $l =~ /^#/; push @r, [split /\t/, $l, -1]; } close $h; @r }
sub idof { substr(md5_hex(encode_utf8($_[0])), 0, 10) }
sub post { my ($path, %q) = @_; my $body = delete $q{_body};
  my $u = URI->new("$ENGINE$path"); $u->query_form(map { $_ => encode_utf8($q{$_}) } keys %q);
  my $res = $ua->post($u, ($body ? ('Content-Type' => 'application/json', Content => $body) : ()));
  die "VOICEVOX: $path " . $res->status_line . "\n" unless $res->is_success; $res->content }

my $r = $ua->get("$ENGINE/version"); die "VOICEVOX が起動していません（$ENGINE）\n" unless $r->is_success;

my @lines = readtsv("$root/tools/voice/lines.tsv"); die "lines.tsv がありません\n" unless @lines;
my %over = map { $_->[0] => $_->[1] } readtsv("$root/tools/voice/overrides.tsv");
my @fix = sort { length($b->[0]) <=> length($a->[0]) } grep { defined $_->[1] && length $_->[0] } readtsv("$root/tools/voice/yomi-fix.tsv");
my %made = map { $_->[0] => { synth => $_->[1], id => $_->[2], kana => $_->[3] } } readtsv("$root/tools/voice/made.tsv");
make_path("$root/voice/z");
my $tmp = ($ENV{TMP} // '/tmp') =~ s{\\}{/}gr . "/chiid-voice.wav";

my ($n, $skip, $fail) = (0, 0, 0);
my %want;
for my $row (@lines) {
  my ($key, $synth) = @$row; $synth = $over{$key} // $synth // $key;
  unless ($synth =~ /^@/) {
    $synth =~ s/[ 　]+//g;   # 空白は「間」になるので、つめる
    for my $f (@fix) { my ($from, $to) = @$f; $synth =~ s/\Q$from\E/$to/g; }   # ことばの読みの直し
  }
  my $id = idof($key); $want{$key} = $id;
  if ($preview) {
    my $k = $synth =~ /^@(.*)$/ ? $1 : eval { JSON::PP->new->utf8->decode(post('/audio_query', speaker => $SPEAKER, text => $synth))->{kana} } // '';
    push @prev, join("\t", $key, $synth, 'preview', $k); next;
  }
  my $out = "$root/voice/z/$id.ogg";
  if (-f $out && $made{$key} && $made{$key}{synth} eq $synth) { $skip++; next; }
  last if $limit && $n >= $limit;
  my ($q, $kana);
  eval {
    if ($synth =~ /^@(.*)$/) {
      $kana = $1;
      my $ap = post('/accent_phrases', speaker => $SPEAKER, text => $kana, is_kana => 'true');
      my $base = $json->decode(post('/audio_query', speaker => $SPEAKER, text => 'あ'));
      $base->{accent_phrases} = $json->decode($ap);
      $q = $base;
    } else {
      $q = $json->decode(post('/audio_query', speaker => $SPEAKER, text => $synth));
      $kana = $q->{kana};
    }
    $q->{speedScale} = $SPEED; $q->{prePhonemeLength} = 0.05; $q->{postPhonemeLength} = 0.12;
    my $wav = post('/synthesis', speaker => $SPEAKER, _body => $json->encode($q));
    open my $w, '>:raw', $tmp or die "tmp"; print $w $wav; close $w;
    my $rc = system($ffmpeg, '-y', '-loglevel', 'error', '-i', $tmp, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '24000', '-ac', '1', '-c:a', 'libopus', '-b:a', '24k', $out);
    die "ffmpeg ($rc)\n" if $rc != 0;
    1;
  } or do { $fail++; print STDERR encode_utf8("失敗: $key: $@"); next; };
  $made{$key} = { synth => $synth, id => $id, kana => $kana // '' };
  $n++;
  print encode_utf8("$n: $key\n") if $n % 50 == 0;
  write_made() if $n % 100 == 0;
}
if ($preview) {
  open my $pv, '>:raw', "$root/tools/voice/preview.tsv" or die; print $pv encode_utf8(join("\n", @prev) . "\n"); close $pv;
  print encode_utf8("読みだけ調べた: " . scalar(@prev) . "文 → tools/voice/preview.tsv\n"); exit 0;
}
write_made();

# 使わなくなった音声は、消さずに voice/_old/ へ移す
my %live = map { $_ => 1 } values %want;
make_path("$root/voice/_old");
my $moved = 0;
for my $f (glob("$root/voice/z/*.ogg")) { my ($id) = $f =~ m{/([0-9a-f]+)\.ogg$}; next if !$id || $live{$id}; move($f, "$root/voice/_old/$id.ogg"); $moved++; }

# 対応表を書き出す（ファイルがある文だけ）
my @keys = sort grep { -f "$root/voice/z/$want{$_}.ogg" } keys %want;
open my $js, '>:raw', "$root/shared/voice-clips.js" or die;
print $js encode_utf8("/* 読み上げの音声ファイルの対応表（tools/voice/make.pl が作る。手で直さない）。音声：VOICEVOX:ずんだもん */\n"
  . "self.CHIID_VOICE = { dir: 'voice/z/', ext: '.ogg', clips: {\n"
  . join(",\n", map { '  ' . JSON::PP->new->allow_nonref->encode($_) . ': "' . $want{$_} . '"' } @keys) . "\n} };\n");
close $js;
print encode_utf8("作った: $n / そのまま: $skip / 失敗: $fail / 古いのを移した: $moved / 対応表: " . scalar(@keys) . "文\n");

sub write_made {
  open my $m, '>:raw', "$root/tools/voice/made.tsv" or die;
  for my $k (sort keys %made) { my $e = $made{$k}; print $m encode_utf8(join("\t", $k, $e->{synth}, $e->{id}, $e->{kana} // '') . "\n"); }
  close $m;
}
