/* sw.js の PRECACHE と、実アプリが読むファイルの一致を確かめる */
(function () {
  'use strict';
  var C = window.Chiid;
  var isHttp = /^https?:$/.test(location.protocol);
  var root = new URL('../', location.href);

  function norm(u) { return u.replace(/^\.\//, ''); }
  function loadPrecache() {
    return fetch('../sw.js').then(function (r) { return r.text(); }).then(function (t) {
      var m = /var PRECACHE = (\[[\s\S]*?\]);/.exec(t);
      if (!m) throw new Error('PRECACHE が見つからない');
      return (new Function('return ' + m[1]))();
    });
  }

  C.test('precache: PRECACHE の全URLが200で取れる', function () {
    if (!isHttp) return;
    return loadPrecache().then(function (list) {
      if (!list.length) throw new Error('PRECACHE が空');
      return Promise.all(list.map(function (u) {
        return fetch(new URL(u, root)).then(function (r) {
          if (r.status !== 200) throw new Error(u + ' -> ' + r.status);
        });
      }));
    });
  });

  C.test('precache: 実アプリが読む script/link が全部 PRECACHE に入っている', function () {
    if (!isHttp) return;
    return loadPrecache().then(function (list) {
      var set = {};
      list.forEach(function (u) { set[norm(u)] = true; });
      var pages = ['index.html', 'app-chiiku/index.html', 'app-benkyo/index.html'];
      return Promise.all(pages.map(function (p) {
        var pageUrl = new URL(p, root);
        return fetch(pageUrl).then(function (r) { return r.text(); }).then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var refs = [];
          doc.querySelectorAll('script[src]').forEach(function (e) { refs.push(e.getAttribute('src')); });
          doc.querySelectorAll('link[href]').forEach(function (e) { refs.push(e.getAttribute('href')); });
          var missing = [];
          refs.forEach(function (ref) {
            var abs = new URL(ref, pageUrl);
            if (abs.origin !== root.origin) { missing.push(ref + '(外部)'); return; }
            var rel = abs.pathname.slice(root.pathname.length);
            if (!set[rel]) missing.push(rel);
          });
          if (!set[norm(p)]) missing.push(p);
          if (missing.length) throw new Error(p + ' : ' + missing.join(', '));
        });
      }));
    });
  });

  // 公開（.github/workflows/pages.yml）は、決めたファイル・フォルダだけをコピーする。
  // PRECACHE にあるのに公開されないファイルがあると、実機では読めない（top.js で起きた）
  C.test('precache: PRECACHE のファイルは、すべて GitHub Pages に公開される', function () {
    if (!isHttp) return;
    return Promise.all([loadPrecache(), fetch('../.github/workflows/pages.yml').then(function (r) { return r.text(); })]).then(function (v) {
      var m = /cp -r ([^\n]*?) _site\//.exec(v[1]);
      if (!m) throw new Error('pages.yml に cp -r … _site/ が見つからない');
      var copied = m[1].trim().split(/\s+/);
      var missing = v[0].map(norm).filter(function (u) {
        if (u === '' || u === './') return false;
        if (/^voice\/z\//.test(u)) return false;      // 音声は別の行でコピーする
        var top = u.split('/')[0];
        return copied.indexOf(u) < 0 && copied.indexOf(top) < 0;
      });
      if (missing.length) throw new Error('公開されないファイル: ' + missing.join(', '));
    });
  });
})();
