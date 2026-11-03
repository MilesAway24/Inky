/* ═══ STORE ═══════════════════════════════════════════════════════════
   One map per collection. Every change is applied locally first (so the
   page reacts at once), cached in localStorage, then written to the
   viewer's private db subtree: data/users/<id>/m/<collection>/<doc>.
   That subtree is the viewer's own, so the same person on iPhone and iPad
   sees one set of data. Without db (signed out, or a plain browser) the
   app keeps working from the device cache. */
var COLS = ['areas', 'tasks', 'inbox', 'notes', 'log', 'meta'];
var CACHE_KEY = 'mossos.mobile.v1';

var Store = (function () {
  // pend: writes applied locally but not yet handed to db (debounced). A
  // snapshot must not overwrite them; once handed over, db echoes them back.
  var S = {}, subs = [], db = null, base = null, queue = [], timers = {}, pend = {}, loaded = {}, status = 'local';
  COLS.forEach(function (c) { S[c] = {}; });

  function cacheLoad() {
    try {
      var raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (raw && raw.v === 1) COLS.forEach(function (c) { S[c] = raw.d[c] || {}; });
      return !!raw;
    } catch (e) { return false; }
  }
  var cacheT = null;
  function cacheSave() {
    clearTimeout(cacheT);
    cacheT = setTimeout(function () {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, d: S })); } catch (e) {}
    }, 200);
  }
  function emit() { subs.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }

  function remoteWrite(col, id) {
    pend[col + '/' + id] = true;
    if (!db) { queue.push([col, id]); return; }
    var key = col + '/' + id;
    if (timers[key]) clearTimeout(timers[key].t);
    var run = function () {
      delete timers[key]; delete pend[key];
      var ref = db.doc(base + '/' + col + '/' + id), v = S[col][id];
      var p = v ? ref.set(JSON.parse(JSON.stringify(v))) : ref.delete();
      p.catch(function (e) {
        if (e && e.code === 'unavailable') setTimeout(function () { remoteWrite(col, id); }, 800 + Math.random() * 800);
        else if (e && e.code === 'quota_exceeded') toast('Storage is full. Delete some old items to keep saving.');
        else console.warn('save failed', col, id, e);
      });
    };
    timers[key] = { t: setTimeout(run, 350), run: run };
  }
  /* Hand every waiting write to db now: the app is being hidden or closed. */
  function flush() {
    Object.keys(timers).forEach(function (k) { var x = timers[k]; clearTimeout(x.t); x.run(); });
    clearTimeout(cacheT);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, d: S })); } catch (e) {}
  }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

  return {
    flush: flush,
    init: function () { var had = cacheLoad(); emit(); return had; },
    status: function () { return status; },
    on: function (f) { subs.push(f); },
    all: function (col) { var m = S[col]; return Object.keys(m).map(function (k) { return m[k]; }); },
    get: function (col, id) { return S[col][id] || null; },
    put: function (col, obj, quiet) {
      if (!obj.id) obj.id = uid(col.charAt(0));
      obj.updated = Date.now();
      if (!obj.created) obj.created = obj.updated;
      S[col][obj.id] = obj;
      cacheSave(); remoteWrite(col, obj.id); if (!quiet) emit();
      return obj;
    },
    patch: function (col, id, fields) {
      var o = S[col][id]; if (!o) return null;
      Object.keys(fields).forEach(function (k) { o[k] = fields[k]; });
      return this.put(col, o);
    },
    del: function (col, id) { delete S[col][id]; cacheSave(); remoteWrite(col, id); emit(); },
    loaded: function (col) { return !!loaded[col]; },
    /* Connect to db. Called once at boot; resolves whether sync is live. */
    connect: function (onFirst) {
      if (!window.claude || !window.claude.use) { status = 'local'; emit(); return Promise.resolve(false); }
      status = 'connecting'; emit();
      return Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
        var d = r[0], user = r[1];
        if (!d || !user) { status = 'local'; emit(); return false; }
        return Promise.resolve(user.id ? user.id() : null).then(function (id) {
          if (!id) { status = 'local'; emit(); return false; }
          db = d; base = 'data/users/' + id + '/m';
          // Writes made before db arrived go out first, so the first snapshot includes them.
          var q = queue; queue = [];
          q.forEach(function (w) { remoteWrite(w[0], w[1]); });
          var waiting = COLS.length, slow = setTimeout(function () { if (status === 'connecting') { status = 'slow'; emit(); } }, 10000);
          COLS.forEach(function (col) {
            db.collection(base + '/' + col).onSnapshot(function (snap) {
              var fresh = {};
              snap.docs.forEach(function (doc) { var v = doc.data(); if (v) fresh[doc.id] = v; });
              // Local changes not yet handed to db win over what the snapshot says.
              Object.keys(pend).forEach(function (key) {
                var p = key.split('/'); if (p[0] !== col) return;
                if (S[col][p[1]]) fresh[p[1]] = S[col][p[1]]; else delete fresh[p[1]];
              });
              S[col] = fresh;
              if (!snap.metadata.fromCache && !loaded[col]) {
                loaded[col] = true;
                if (--waiting === 0) { clearTimeout(slow); status = 'synced'; if (onFirst) onFirst(); }
              }
              cacheSave(); emit();
            }, function (err) {
              status = err && err.code === 'revoked' ? 'local' : 'error'; emit();
            });
          });
          return true;
        });
      }).catch(function () { status = 'local'; emit(); return false; });
    },
    resetLocal: function () {
      COLS.forEach(function (c) { Object.keys(S[c]).forEach(function (id) { delete S[c][id]; remoteWrite(c, id); }); });
      cacheSave(); emit();
    }
  };
})();

/* Activity log: written automatically, read by Today. Keeps the last 300. */
function logEvent(text, area) {
  Store.put('log', { at: Date.now(), day: today(), text: text, area: area || null }, true);
  var all = Store.all('log').sort(function (a, b) { return b.at - a.at; });
  all.slice(300).forEach(function (o) { Store.del('log', o.id); });
}
