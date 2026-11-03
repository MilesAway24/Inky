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
      + '<div class="kv"><span>Next</span><span>' + esc(next ? next.t + ' · ' + shortDate(next.due) : (a.next || '—')) + '</span></div>'
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

/* ═══ NOTES (basic; the full editor arrives in Phase 3) ══════════════ */
TITLES.notes = 'Notes';
VIEWS.notes = function () {
  var ns = Store.all('notes').sort(function (a, b) { return b.updated - a.updated; });
  return '<button class="btn soft block" data-act="newnote">' + icon('plus', 'sm') + 'New note</button>'
    + (ns.length ? '<div class="list">' + ns.map(function (n) {
      return '<button class="row" data-act="open" data-v="note" data-id="' + n.id + '"><span class="grow"><div class="t">' + esc(n.title || 'Untitled') + '</div>'
        + '<div class="s">' + (n.area ? areaDot(n.area) + esc(areaName(n.area)) + ' · ' : '') + (n.kind === 'idea' ? 'Idea · ' : '') + esc(timeAgo(n.updated)) + ' ' + exPill(n) + '</div></span>'
        + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div>' : '<div class="empty">No notes yet. Capture one, or sort your inbox.</div>');
};
TITLES.note = 'Note';
VIEWS.note = function (id) {
  var n = Store.get('notes', id); if (!n) return '<div class="empty">This note was deleted.</div>';
  return '<label class="sr" for="ntitle">Title</label><input id="ntitle" class="input" style="font-size:19px;font-weight:500" data-nfield="title" value="' + esc(n.title || '') + '" placeholder="Title">'
    + (n.photo ? '<img src="/_blob/' + esc(n.photo) + '" alt="Attached photo" style="max-width:100%;border-radius:14px">' : '')
    + '<label class="sr" for="nbody">Note</label><textarea id="nbody" class="input" style="min-height:45vh;font-size:16.5px;line-height:1.55" data-nfield="body" placeholder="Write…">' + esc(n.body || '') + '</textarea>'
    + '<div class="scrollx" role="group" aria-label="Area">' + areasSorted().map(function (a) {
      return '<button class="chip' + (n.area === a.id ? ' on' : '') + '" data-act="notearea" data-id="' + id + '" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</div>'
    + '<div class="btnrow"><button class="btn soft" data-act="notetotask" data-id="' + id + '">Make it a task</button>'
    + '<button class="btn ghost" style="color:var(--bad)" data-act="delnote" data-id="' + id + '">Delete</button></div>';
};
VIEWS.note.after = function (id) {
  $$('[data-nfield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.nfield] = el.value; Store.patch('notes', id, f); });
  });
};
ACTS.newnote = function () { var n = Store.put('notes', { title: '', body: '' }); push('note', n.id); setTimeout(function () { var e = $('#ntitle'); if (e) e.focus(); }, 50); };
ACTS.notearea = function (d) { var n = Store.get('notes', d.id); Store.patch('notes', d.id, { area: n.area === d.a ? null : d.a }); };
ACTS.delnote = function (d) { var n = Store.get('notes', d.id); Store.del('notes', d.id); pop(); toast('Note deleted', function () { Store.put('notes', n); }); };
ACTS.notetotask = function (d) {
  var n = Store.get('notes', d.id);
  var t = Store.put('tasks', { t: n.title || 'From a note', note: n.body || '', area: n.area || null, due: today(), done: false, steps: [] });
  logEvent('Turned a note into a task: ' + t.t, t.area); push('task', t.id);
};

/* ═══ MORE ═══════════════════════════════════════════════════════════ */
TITLES.more = 'More';
var SOON = { habits: 'Habits arrive in the next update: mark done, week strip, 30-day grid and streaks.',
  goals: 'Goals arrive in the next update: why, progress, and a next action that feeds the Play card.',
  journal: 'Journal arrives with Notes and Projects: mood plus an entry, prompted from today\'s log.',
  projects: 'Projects arrive with the Phase 3 update: Done when, Next, Where I left off, and panels.',
  calendar: 'Calendar arrives with the Phase 3 update: a month grid and a week view coloured by area.' };
VIEWS.more = function () {
  var inboxN = Store.all('inbox').length;
  return '<div class="menu">' + SIDE_MORE.map(function (m) {
    var soon = SOON[m[0]];
    return '<button class="row" data-act="tab" data-v="' + m[0] + '">' + icon(m[2]) + '<span class="grow t">' + m[1] + '</span>'
      + (m[0] === 'inbox' && inboxN ? '<span class="pill">' + inboxN + '</span>' : '') + (soon ? '<span class="soon">Soon</span>' : '') + icon('chev', 'sm chev') + '</button>';
  }).join('') + '</div>';
};
VIEWS.soon = function () {
  var c = current();
  return '<div class="empty">' + esc(SOON[c.view] || 'Coming soon.') + '</div>';
};
['habits', 'goals', 'journal', 'projects', 'calendar'].forEach(function (k) {
  TITLES[k] = k.charAt(0).toUpperCase() + k.slice(1); VIEWS[k] = VIEWS.soon;
});

TITLES.money = 'Money';
VIEWS.money = function () {
  return '<div class="card"><h2 style="margin-bottom:8px">Payday OS moves in here next</h2>'
    + '<p class="note">The Finance update brings your pay stub, daily allowance, debt ladder, savings, "Can I afford this?", Benji and live Monarch data into this tab, '
    + 'with your existing Payday OS data carried over. Until then, Payday OS keeps working as it is.</p>'
    + '<div class="btnrow" style="margin-top:14px"><a class="btn soft" href="https://claude.ai/artifact/QwpmDA1mcVAk9UvC9dgqyb" target="_blank" rel="noopener">Open Payday OS</a></div></div>';
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
    + '<section><div class="sechead"><h2>Theme</h2></div><div class="chips">' + [['', 'Match device'], ['dark', 'Dark'], ['light', 'Light']].map(function (o) {
      return '<button class="chip' + ((document.documentElement.dataset.theme || '') === o[0] ? ' on' : '') + '" data-act="theme" data-t="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div></section>'
    + '<section><div class="sechead"><h2>Data</h2></div><div class="btnrow">'
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
