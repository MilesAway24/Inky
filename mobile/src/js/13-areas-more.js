/* ═══ LIFE AREAS ═══════════════════════════════════════════════════ */
TITLES.areas = 'Life areas';
VIEWS.areas = function () {
  return '<div class="agrid">' + areasSorted().map(function (a) {
    var open = Store.all('tasks').filter(function (t) { return t.area === a.id && !t.done; });
    var next = open.filter(function (t) { return t.due; }).sort(function (x, y) { return x.due.localeCompare(y.due); })[0];
    return '<button class="abig" style="--c:' + esc(a.color) + '" data-act="open" data-v="area" data-id="' + a.id + '">'
      + '<div class="h"><b><span class="dot" style="background:' + esc(a.color) + '"></span>' + esc(a.name) + '</b>'
      + '<span class="st st-' + a.state.toLowerCase().replace(/\s/g, '') + '">' + esc(a.state) + '</span></div>'
      + '<div>' + esc(a.focus || 'No focus set') + '</div>'
      + '<div class="kv"><span>Next</span><span>' + esc((a.id === 'money' && typeof finNextBill === 'function' && finNextBill()) || (next ? next.t + ' · ' + shortDate(next.due) : (a.next || '—'))) + '</span></div>'
      + '<div class="kv"><span>Open</span><span>' + (open.length ? open.length + ' task' + (open.length === 1 ? '' : 's') : esc(a.open || 'Nothing open')) + '</span></div></button>';
  }).join('') + '</div>';
};
TITLES.area = function (id) { var a = area(id); return a ? a.name : 'Area'; };
VIEWS.area = function (id) {
  var a = area(id); if (!a) return '<div class="empty">This area was removed.</div>';
  var open = Store.all('tasks').filter(function (t) { return t.area === id && !t.done; })
    .sort(function (x, y) { return (x.due || '9').localeCompare(y.due || '9'); });
  return '<section><div class="lbl" style="margin-bottom:8px">State</div><div class="chips">' + AREA_STATES.map(function (s) {
    return '<button class="chip' + (a.state === s ? ' on' : '') + '" data-act="areastate" data-id="' + id + '" data-s="' + s + '">' + s + '</button>';
  }).join('') + '</div></section>'
    + '<div class="field"><label for="afocus">Current focus</label><input id="afocus" class="input" data-afield="focus" value="' + esc(a.focus || '') + '"></div>'
    + '<div class="field"><label for="aopen">Open items or follow-ups</label><input id="aopen" class="input" data-afield="open" value="' + esc(a.open || '') + '"></div>'
    + '<section><div class="sechead"><h2>Open tasks</h2><span class="meta">' + open.length + '</span></div>'
    + (open.length ? '<div class="list">' + open.map(taskRow).join('') + '</div>' : '<div class="empty">Nothing open in ' + esc(a.short) + '.</div>') + '</section>'
    + '<details class="card"><summary class="muted" style="cursor:pointer">Name and colour</summary><div style="display:grid;gap:12px;margin-top:12px">'
    + '<div class="field"><label for="aname">Name</label><input id="aname" class="input" data-afield="name" value="' + esc(a.name) + '"></div>'
    + '<div class="field"><label for="ashort">Short name</label><input id="ashort" class="input" data-afield="short" value="' + esc(a.short) + '" maxlength="12"></div>'
    + '<div class="field"><label for="acolor">Colour</label><input id="acolor" type="color" class="input" style="max-width:90px;padding:4px" data-afield="color" value="' + esc(a.color) + '"></div>'
    + '</div></details>';
};
VIEWS.area.after = function (id) {
  $$('[data-afield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.afield] = el.value; Store.patch('areas', id, f); });
  });
};
ACTS.areastate = function (d) { Store.patch('areas', d.id, { state: d.s }); logEvent(areaName(d.id) + ' is ' + d.s.toLowerCase(), d.id); };

/* ═══ NOTES ═══════════════════════════════════════════════════════════
   Plain text (it's what dictation and the iOS keyboard handle best), with
   search, a filter by kind or area, pins, and links to a project. */
var noteQ = '', noteF = 'all';
TITLES.notes = 'Notes';
VIEWS.notes = function () {
  var q = noteQ.trim().toLowerCase();
  var ns = Store.all('notes').filter(function (n) {
    if (noteF === 'idea' && n.kind !== 'idea') return false;
    if (noteF === 'note' && n.kind === 'idea') return false;
    if (noteF.indexOf('a:') === 0 && n.area !== noteF.slice(2)) return false;
    return !q || ((n.title || '') + ' ' + (n.body || '')).toLowerCase().indexOf(q) > -1;
  }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || b.updated - a.updated; });
  var all = Store.all('notes');
  var f = [['all', 'All · ' + all.length], ['note', 'Notes'], ['idea', 'Ideas · ' + all.filter(function (n) { return n.kind === 'idea'; }).length]];
  return '<div class="search"><label class="sr" for="nq">Search notes</label><input id="nq" class="input" type="search" placeholder="Search notes" value="' + esc(noteQ) + '" autocomplete="off"></div>'
    + '<div class="scrollx" role="group" aria-label="Filter">' + f.map(function (x) {
      return '<button class="chip' + (noteF === x[0] ? ' on' : '') + '" data-act="notef" data-f="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + areasSorted().map(function (a) {
      return '<button class="chip' + (noteF === 'a:' + a.id ? ' on' : '') + '" data-act="notef" data-f="a:' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</div>'
    + '<button class="btn soft block" data-act="newnote">' + icon('plus', 'sm') + 'New note</button>'
    + '<div id="notelist">' + noteList(ns, q) + '</div>';
};
function noteList(ns, q) {
  if (!ns.length) return '<div class="empty">' + (q ? 'No notes match "' + esc(q) + '".' : 'No notes here yet. Capture one, or sort your inbox.') + '</div>';
  return '<div class="list">' + ns.map(function (n) {
    var pr = n.project ? Store.get('projects', n.project) : null;
    var snip = (n.body || '').replace(/\s+/g, ' ').slice(0, 90);
    return '<button class="row" data-act="open" data-v="note" data-id="' + n.id + '"><span class="grow"><div class="t">' + (n.pinned ? '📌 ' : '') + esc(n.title || 'Untitled') + '</div>'
      + (snip && snip !== n.title ? '<div class="s" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(snip) + '</div>' : '')
      + '<div class="s">' + (n.area ? areaDot(n.area) + esc(areaName(n.area)) + ' · ' : '') + (pr ? esc(pr.t) + ' · ' : '') + (n.kind === 'idea' ? 'Idea · ' : '') + esc(timeAgo(n.updated)) + ' ' + exPill(n) + '</div></span>'
      + icon('chev', 'sm chev') + '</button>';
  }).join('') + '</div>';
}
VIEWS.notes.after = function () {
  var q = $('#nq'); if (!q) return;
  q.addEventListener('input', function () {
    noteQ = q.value; var html = VIEWS.notes(); var tmp = document.createElement('div'); tmp.innerHTML = html;
    $('#notelist').innerHTML = $('#notelist', tmp).innerHTML;
  });
};
ACTS.notef = function (d) { noteF = d.f; render(); };
TITLES.note = 'Note';
VIEWS.note = function (id) {
  var n = Store.get('notes', id); if (!n) return '<div class="empty">This note was deleted.</div>';
  return '<label class="sr" for="ntitle">Title</label><input id="ntitle" class="input" style="font-size:19px;font-weight:500" data-nfield="title" value="' + esc(n.title || '') + '" placeholder="Title">'
    + (n.photo ? '<img src="/_blob/' + esc(n.photo) + '" alt="Attached photo" style="max-width:100%;border-radius:14px">' : '')
    + '<label class="sr" for="nbody">Note</label><textarea id="nbody" class="input" style="min-height:45vh;font-size:16.5px;line-height:1.55" data-nfield="body" placeholder="Write…">' + esc(n.body || '') + '</textarea>'
    + '<div class="scrollx" role="group" aria-label="Area">' + areasSorted().map(function (a) {
      return '<button class="chip' + (n.area === a.id ? ' on' : '') + '" data-act="notearea" data-id="' + id + '" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</div>'
    + (projectsAll('active').length ? '<div class="scrollx" role="group" aria-label="Project">' + projectsAll('active').map(function (p) {
      return '<button class="chip' + (n.project === p.id ? ' on' : '') + '" data-act="noteproj" data-id="' + id + '" data-p="' + p.id + '">' + esc(p.ic || '📁') + ' ' + esc(p.t) + '</button>';
    }).join('') + '</div>' : '')
    + '<div class="btnrow"><button class="btn soft" data-act="notepin" data-id="' + id + '">' + (n.pinned ? 'Unpin' : 'Pin to top') + '</button>'
    + '<button class="btn soft" data-act="notekind" data-id="' + id + '">' + (n.kind === 'idea' ? 'Make it a note' : 'Mark as idea') + '</button></div>'
    + '<div class="btnrow"><button class="btn soft" data-act="notetotask" data-id="' + id + '">Make it a task</button>'
    + '<button class="btn ghost" style="color:var(--bad)" data-act="delnote" data-id="' + id + '">Delete</button></div>';
};
VIEWS.note.after = function (id) {
  $$('[data-nfield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.nfield] = el.value; Store.patch('notes', id, f); });
  });
};
ACTS.newnote = function () { var n = Store.put('notes', { title: '', body: '' }); push('note', n.id); setTimeout(function () { var e = $('#ntitle'); if (e) e.focus(); }, 50); };
ACTS.noteproj = function (d) { var n = Store.get('notes', d.id); Store.patch('notes', d.id, { project: n.project === d.p ? null : d.p }); };
ACTS.notepin = function (d) { var n = Store.get('notes', d.id); Store.patch('notes', d.id, { pinned: !n.pinned }); };
ACTS.notekind = function (d) { var n = Store.get('notes', d.id); Store.patch('notes', d.id, { kind: n.kind === 'idea' ? 'note' : 'idea' }); };
ACTS.notearea = function (d) { var n = Store.get('notes', d.id); Store.patch('notes', d.id, { area: n.area === d.a ? null : d.a }); };
ACTS.delnote = function (d) { var n = Store.get('notes', d.id); Store.del('notes', d.id); pop(); toast('Note deleted', function () { Store.put('notes', n); }); };
ACTS.notetotask = function (d) {
  var n = Store.get('notes', d.id);
  var t = Store.put('tasks', { t: n.title || 'From a note', note: n.body || '', area: n.area || null, project: n.project || null, due: today(), done: false, steps: [] });
  logEvent('Turned a note into a task: ' + t.t, t.area); push('task', t.id);
};

/* ═══ MORE ═══════════════════════════════════════════════════════════ */
TITLES.more = 'More';
var SOON = {};
VIEWS.more = function () {
  return jumpTiles(['plan', 'habits', 'goals', 'notes', 'projects', 'calendar', 'journal', 'tools', 'inbox', 'areas'])
    + '<div class="menu">' + ['money', 'settings'].map(function (k) {
      return '<button class="row" data-act="tab" data-v="' + k + '">' + icon(SECTIONS[k][1]) + '<span class="grow t">' + SECTIONS[k][0] + '</span>' + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div>';
};
VIEWS.soon = function () {
  var c = current();
  return '<div class="empty">' + esc(SOON[c.view] || 'Coming soon.') + '</div>';
};

/* ═══ SETTINGS ═══════════════════════════════════════════════════════ */
TITLES.settings = 'Settings';
VIEWS.settings = function () {
  var s = Store.status();
  var syncText = { synced: 'Synced. Your data follows you between iPhone and iPad.', connecting: 'Connecting to sync…',
    slow: 'Sync is taking a while. Changes are kept on this device and go up when it connects.', error: 'Sync stopped. Reload MossOS to reconnect; nothing on this device is lost.',
    local: 'Saved on this device only. Open MossOS in the Claude app, signed in, to sync between devices.' }[s] || '';
  return '<section><div class="sechead"><h2>Sync</h2>' + syncBadge() + '</div><p class="note">' + esc(syncText) + '</p></section>'
    + '<section><div class="sechead"><h2>Claude</h2></div><p class="note">' + (AI.ready ? 'Available. Sorting and "Break it down" use Claude.' : 'Not available in this view. Sorting and "Break it down" need MossOS open in the Claude app.') + '</p></section>'
    + '<section><div class="sechead"><h2>Opens to</h2></div><p class="note small" style="margin-bottom:10px">What you see when you open MossOS after being away 10 minutes or more.</p><div class="chips">'
    + [['capture', 'Quick capture'], ['today', 'Today']].map(function (o) {
      return '<button class="chip' + (openPref() === o[0] ? ' on' : '') + '" data-act="setopen" data-v="' + o[0] + '" aria-pressed="' + (openPref() === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div></section>'
    + '<section><div class="sechead"><h2>Bottom bar</h2></div><p class="note small" style="margin-bottom:10px">Pick the three sections that sit around Capture. Everything else is one tap away under More.</p>'
    + tabPrefs().map(function (cur, slot) {
      return '<div class="field" style="margin-bottom:10px"><label for="tab' + slot + '">' + ['First tab', 'Second tab', 'After Capture'][slot] + '</label><select id="tab' + slot + '" class="input sel" data-act-change="settab" data-slot="' + slot + '">'
        + Object.keys(SECTIONS).filter(function (k) { return k !== 'settings'; }).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + SECTIONS[k][0] + '</option>'; }).join('') + '</select></div>';
    }).join('') + '</section>'
    + '<section><div class="sechead"><h2>Theme</h2></div><div class="chips">' + [['', 'Match device'], ['dark', 'Dark'], ['light', 'Light']].map(function (o) {
      return '<button class="chip' + ((document.documentElement.dataset.theme || '') === o[0] ? ' on' : '') + '" data-act="theme" data-t="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div></section>'
    + '<section><div class="sechead"><h2>Data</h2></div><div class="btnrow">'
    + '<button class="btn soft" data-act="finimport">Import from Payday OS</button>'
    + (hasExamples() ? '<button class="btn soft" data-act="clearex">Clear examples</button>' : '')
    + '<button class="btn ghost" data-act="resetall">Erase everything</button></div></section>';
};
ACTS.theme = function (d) {
  if (d.t) document.documentElement.dataset.theme = d.t; else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('mossos.theme', d.t); } catch (e) {}
  render();
};
var resetAsked = 0;
ACTS.resetall = function () {
  if (Date.now() - resetAsked > 6000) { resetAsked = Date.now(); toast('Tap "Erase everything" again to delete all your MossOS data on every device'); return; }
  resetAsked = 0; Store.resetLocal(); toast('Everything erased'); go('today');
};

function openPref() { var p = Store.get('meta', 'prefs'); return p && p.open === 'today' ? 'today' : 'capture'; }
ACTS.setopen = function (d) {
  var p = Store.get('meta', 'prefs');
  if (p) Store.patch('meta', 'prefs', { open: d.v }); else Store.put('meta', { id: 'prefs', open: d.v });
  toast(d.v === 'today' ? 'MossOS opens to Today' : 'MossOS opens to Quick capture');
};
ACTS.settab = function (d, el) {
  var t = tabPrefs().slice(), i = +d.slot, other = t.indexOf(el.value);
  if (other > -1 && other !== i) t[other] = t[i]; // swap rather than show a section twice
  t[i] = el.value;
  var p = Store.get('meta', 'prefs');
  if (p) Store.patch('meta', 'prefs', { tabs: t }); else Store.put('meta', { id: 'prefs', tabs: t });
  toast('Bottom bar updated');
};
