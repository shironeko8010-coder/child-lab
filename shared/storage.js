/* 保存：設定・プロフィール・利用秒数は localStorage、学習ログは IndexedDB。
   使えないとき（プライベートモード等）は、メモリ上の保存に切り替えて、例外を出さない。 */
(function () {
  'use strict';
  var C = (window.Chiid = window.Chiid || {});

  var PREFIX = 'chiid.';
  var DB_NAME = 'chiid';
  var STORE = 'logs';
  var DEFAULTS = { dailyLimitMin: 30, bgmOn: true, sfxOn: true };

  var forceMemory = false;
  var state = freshState();   // 同期データのメモリ上の写し
  var memLogs = [];           // メモリ上のログ（IndexedDB 不可時）
  var db = null;              // IndexedDB 接続（開けたときだけ）
  var initPromise = null;

  function freshState() {
    return { settings: {}, profiles: [], active: null, play: {} };
  }

  function lsGet(key) {
    try { return window.localStorage.getItem(PREFIX + key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    if (forceMemory) return;
    try { window.localStorage.setItem(PREFIX + key, val); } catch (e) { /* 保存できなくても続ける */ }
  }
  function lsClearAll() {
    try {
      var keys = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k);
      }
      keys.forEach(function (k) { window.localStorage.removeItem(k); });
    } catch (e) { /* 無視 */ }
  }
  function parse(s, fallback) {
    if (s === null || s === undefined) return fallback;
    try { var v = JSON.parse(s); return v === null ? fallback : v; } catch (e) { return fallback; }
  }

  function loadFromLs() {
    state.settings = parse(lsGet('settings'), {});
    state.profiles = parse(lsGet('profiles'), []);
    state.active = parse(lsGet('active'), null);
    state.play = parse(lsGet('play'), {});
  }
  function persist() {
    lsSet('settings', JSON.stringify(state.settings));
    lsSet('profiles', JSON.stringify(state.profiles));
    lsSet('active', JSON.stringify(state.active));
    lsSet('play', JSON.stringify(state.play));
  }

  function useIdb() { return !forceMemory && db !== null; }

  function openDb() {
    return new Promise(function (resolve) {
      var done = false;
      function finish(d) { if (!done) { done = true; resolve(d); } }
      try {
        if (!window.indexedDB) { finish(null); return; }
        var req = window.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          var d = req.result;
          if (!d.objectStoreNames.contains(STORE)) {
            var os = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            os.createIndex('profileId', 'profileId', { unique: false });
          }
        };
        req.onsuccess = function () { finish(req.result); };
        req.onerror = function () { finish(null); };
        req.onblocked = function () { finish(null); };
        setTimeout(function () { finish(null); }, 3000); // 固まったらメモリへ
      } catch (e) { finish(null); }
    });
  }

  function idbRequest(mode, fn) {
    return new Promise(function (resolve, reject) {
      try {
        var tx = db.transaction(STORE, mode);
        var result;
        fn(tx.objectStore(STORE), function (r) { result = r; });
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('abort')); };
      } catch (e) { reject(e); }
    });
  }

  function newId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var storage = {
    init: function () {
      if (initPromise) return initPromise;
      loadFromLs();
      initPromise = openDb().then(function (d) { db = d; });
      return initPromise;
    },

    getSettings: function () {
      var s = {};
      Object.keys(DEFAULTS).forEach(function (k) {
        s[k] = state.settings[k] === undefined ? DEFAULTS[k] : state.settings[k];
      });
      return s;
    },
    setSettings: function (patch) {
      Object.keys(DEFAULTS).forEach(function (k) {
        if (patch && patch[k] !== undefined) state.settings[k] = patch[k];
      });
      persist();
    },

    addProfile: function (nickname, kind) {
      var id = newId();
      state.profiles.push({ id: id, nickname: String(nickname), kind: kind });
      persist();
      return id;
    },
    listProfiles: function () {
      return state.profiles.map(function (p) { return { id: p.id, nickname: p.nickname, kind: p.kind }; });
    },
    setActive: function (id) { state.active = id; persist(); },
    getActive: function () {
      for (var i = 0; i < state.profiles.length; i++) {
        if (state.profiles[i].id === state.active) return state.profiles[i];
      }
      return null;
    },

    logAnswer: function (o) {
      var entry = {
        profileId: o.profileId, area: o.area, itemId: o.itemId,
        correct: !!o.correct, level: o.level, ts: Date.now()
      };
      if (o.dan != null) entry.dan = o.dan;   // 九九の「○のだんだけ」の練習（レベル計算に使わない印）
      if (useIdb()) {
        return idbRequest('readwrite', function (os) { os.add(entry); }).catch(function () {
          memLogs.push(entry); // 書けなければメモリへ
        });
      }
      memLogs.push(entry);
      return Promise.resolve();
    },
    getLogs: function (profileId) {
      var fromMem = memLogs.filter(function (e) { return e.profileId === profileId; });
      if (!useIdb()) return Promise.resolve(fromMem);
      return idbRequest('readonly', function (os, set) {
        var r = os.index('profileId').getAll(profileId);
        r.onsuccess = function () { set(r.result); };
      }).then(function (rows) {
        return (rows || []).concat(fromMem).map(function (e) {
          var o = { profileId: e.profileId, area: e.area, itemId: e.itemId,
                   correct: e.correct, level: e.level, ts: e.ts };
          if (e.dan != null) o.dan = e.dan;
          return o;
        }).sort(function (a, b) { return a.ts - b.ts; });
      }, function () { return fromMem; });
    },

    addPlaySeconds: function (profileId, dateStr, sec) {
      if (!state.play[profileId]) state.play[profileId] = {};
      state.play[profileId][dateStr] = (state.play[profileId][dateStr] || 0) + sec;
      persist();
    },
    getPlaySeconds: function (profileId, dateStr) {
      return (state.play[profileId] && state.play[profileId][dateStr]) || 0;
    },
    listPlayDays: function (profileId) {
      var m = state.play[profileId] || {};
      return Object.keys(m).sort().map(function (d) { return { date: d, sec: m[d] }; });
    },

    exportAll: function () {
      var profiles = storage.listProfiles();
      return Promise.all(profiles.map(function (p) { return storage.getLogs(p.id); })).then(function (all) {
        var logs = {};
        profiles.forEach(function (p, i) { logs[p.id] = all[i]; });
        var play = {};
        profiles.forEach(function (p) { play[p.id] = storage.listPlayDays(p.id); });
        return JSON.stringify({
          exportedAt: new Date().toISOString(),
          settings: storage.getSettings(),
          profiles: profiles,
          active: state.active,
          playDays: play,
          logs: logs
        }, null, 2);
      });
    },
    resetAll: function () {
      state = freshState();
      memLogs = [];
      lsClearAll();
      if (useIdb()) {
        return idbRequest('readwrite', function (os) { os.clear(); }).catch(function () { /* 無視 */ });
      }
      return Promise.resolve();
    },

    // テスト用：保存不可（プライベートモード等）の再現
    _forceMemory: function (b) { forceMemory = !!b; }
  };

  C.storage = storage;
})();
