#!/usr/bin/perl
# 開発確認用の静的ファイルサーバー（localhostのみ・外部通信なし）。アプリ本体には含まれない。
use strict; use warnings;
use HTTP::Daemon; use HTTP::Status; use HTTP::Response;
my $root = shift || '.'; my $port = shift || 8080;
my %mime = (html=>'text/html; charset=utf-8', js=>'text/javascript; charset=utf-8', css=>'text/css; charset=utf-8',
  json=>'application/json; charset=utf-8', svg=>'image/svg+xml', ogg=>'audio/ogg', mp3=>'audio/mpeg', tsv=>'text/tab-separated-values; charset=utf-8', png=>'image/png', txt=>'text/plain; charset=utf-8', webmanifest=>'application/manifest+json');
my $d = HTTP::Daemon->new(LocalAddr=>'127.0.0.1', LocalPort=>$port, ReuseAddr=>1) or die "cannot listen: $!";
print "serving $root on http://localhost:$port/\n"; $| = 1;
while (my $c = $d->accept) {
  $c->timeout(5);  # 何も送ってこない接続（ブラウザの先行接続など）で固まらないように
  while (my $r = $c->get_request) {
    my $p = $r->uri->path; $p =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge; $p .= 'index.html' if $p =~ m{/$};
    if ($p =~ /\.\./) { $c->send_error(RC_FORBIDDEN); next; }
    # 読み上げ文の書き出し（tools/voice-lines.html から）。決まった1つのファイルにだけ書く
    if ($r->method eq 'POST' && $p =~ m{^/__save/voice-(lines|ruby)\.tsv$}) {
      mkdir "$root/tools/voice"; open my $wh, '>:raw', "$root/tools/voice/$1.tsv" or do { $c->send_error(RC_FORBIDDEN); next; };
      print $wh $r->content; close $wh;
      my $ok = HTTP::Response->new(200); $ok->header('Connection' => 'close'); $ok->content('saved'); $c->send_response($ok); last;
    }
    my $f = "$root$p";
    if (-f $f) {
      open my $fh, '<:raw', $f or do { $c->send_error(RC_FORBIDDEN); next; };
      local $/; my $body = <$fh>; close $fh;
      my ($ext) = $f =~ /\.([^.\/]+)$/; $ext = lc($ext // '');
      my $res = HTTP::Response->new(200); $res->header('Content-Type' => $mime{$ext} // 'application/octet-stream', 'Cache-Control' => 'no-store');
      $res->header('Connection' => 'close');
      $res->content($body); $c->send_response($res);
    } else { $c->send_error(RC_NOT_FOUND); }
    last;  # 1接続1リクエスト（単一スレッドで詰まらないように）
  }
  $c->close;
}
