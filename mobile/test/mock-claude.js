// A stand-in for the claude.ai viewer's window.claude, for local tests only.
// db: in-memory documents persisted in sessionStorage (survives reloads),
// with live collection snapshots. user: fixed id. sample: canned replies.
(function () {
  var KEY = '__mockdb';
  var docs = JSON.parse(sessionStorage.getItem(KEY) || '{}');
  var listeners = [];
  var save = function () { try { sessionStorage.setItem(KEY, JSON.stringify(docs)); } catch (e) { console.error('mock db save failed: ' + e.message); } };
  function snap(col) {
    var prefix = col + '/', out = [];
    Object.keys(docs).forEach(function (p) {
      if (p.indexOf(prefix) === 0 && p.slice(prefix.length).indexOf('/') < 0) {
        var d = docs[p];
        out.push({ id: p.slice(prefix.length), exists: true, data: function () { return JSON.parse(JSON.stringify(d)); }, metadata: { fromCache: false, hasPendingWrites: false } });
      }
    });
    return { docs: out, size: out.length, empty: !out.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: function () { return []; } };
  }
  function notify(path) {
    var col = path.slice(0, path.lastIndexOf('/'));
    listeners.forEach(function (l) { if (l.col === col) setTimeout(function () { l.fn(snap(col)); }, 5); });
  }
  window.__mock = { docs: docs, writes: 0, sampleCalls: [] };
  var db = {
    doc: function (path) {
      return {
        path: path,
        // __mockDrop: simulate the app being suspended before a write lands.
        set: function (v) { if (sessionStorage.getItem('__mockDrop')) return new Promise(function () {}); docs[path] = v; save(); window.__mock.writes++; notify(path); return Promise.resolve(); },
        delete: function () { delete docs[path]; save(); window.__mock.writes++; notify(path); return Promise.resolve(); },
        get: function () { return Promise.resolve({ exists: !!docs[path], data: function () { return docs[path]; } }); }
      };
    },
    collection: function (col) {
      return {
        onSnapshot: function (fn) { var l = { col: col, fn: fn }; listeners.push(l); setTimeout(function () { fn(snap(col)); }, 20); return function () { listeners.splice(listeners.indexOf(l), 1); }; }
      };
    }
  };
  var user = { id: function () { return Promise.resolve('u_test'); }, isOwner: function () { return Promise.resolve(true); } };
  function sample() { return Promise.resolve({ text: 'ok', truncated: false }); }
  sample.json = function (prompt) {
    window.__mock.sampleCalls.push(prompt);
    var m = /Items: (\[.*\])\n/.exec(prompt);
    if (m) {
      var items = JSON.parse(m[1]);
      return Promise.resolve({ items: items.map(function (it, i) {
        return { id: it.id, type: /idea/i.test(it.text) ? 'idea' : 'task', title: it.text.replace(/^Idea:\s*/i, ''), area: i % 2 ? 'inky' : 'hcpd',
          due: null, firstStep: 'Open the thing', icon: '📝' };
      }) });
    }
    if (/Suggest three possible next actions/.test(prompt)) return Promise.resolve({ options: ['Book the PAT practice slot', 'Run the 1.5 mile test once', 'Print the packet checklist'] });
    if (/Break this task/.test(prompt)) return Promise.resolve({ steps: ['Open the file', 'Find the timeout', 'Write the fix'] });
    return Promise.resolve({});
  };
  sample.limits = function () { return Promise.resolve({ maxPromptBytes: 100000 }); };
  var caps = { db: db, user: user, sample: sample, assets: null };
  window.claude = { use: function (n) { return new Promise(function (r) { setTimeout(function () { r(caps[n] || null); }, 30); }); } };
})();
