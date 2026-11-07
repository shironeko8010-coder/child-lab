/* 小さなテスト実行部（外部ライブラリなし）。Chiid.test / Chiid.assertEq / Chiid.runTests */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});
  var queue = [];

  C.test = function (name, fn) { queue.push({ name: name, fn: fn }); };

  C.assertEq = function (actual, expected) {
    var a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e || (a === undefined && actual !== expected)) {
      throw new Error('期待 ' + e + ' / 実際 ' + a);
    }
  };

  function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('タイムアウト(' + ms + 'ms)')); }, ms);
      p.then(function (v) { clearTimeout(t); resolve(v); },
             function (e) { clearTimeout(t); reject(e); });
    });
  }

  C.runTests = function () {
    var pass = 0, fail = 0, failures = [];
    var chain = Promise.resolve();
    queue.forEach(function (t) {
      chain = chain.then(function () {
        return withTimeout(Promise.resolve().then(t.fn), 15000).then(function () {
          pass++;
        }, function (e) {
          fail++;
          failures.push(t.name + ' : ' + (e && e.message ? e.message : e));
        });
      });
    });
    return chain.then(function () {
      var s = document.getElementById('summary');
      var f = document.getElementById('failures');
      if (s) s.textContent = 'PASS ' + pass + ' / FAIL ' + fail;
      if (f) f.textContent = failures.join('\n');
      return { pass: pass, fail: fail, failures: failures };
    });
  };
})();
