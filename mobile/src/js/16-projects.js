/* ═══ PROJECTS ══════════════════════════════════════════════════════
   From the Sep 18 build: each project says when it's done, holds exactly
   one next step and a "where I left off" note, and carries panels chosen
   by its kind. Panel data lives on the project document. */
var KINDS = {
  software: ['Software', ['checklist', 'log', 'links', 'docs']],
  build: ['Build', ['checklist', 'budget', 'log', 'links']],
  fitness: ['Fitness', ['checklist', 'log']],
  learning: ['Learning', ['checklist', 'links', 'docs']],
  admin: ['Admin', ['checklist', 'people', 'docs', 'log']],
  reno: ['Home', ['budget', 'people', 'checklist']],
  other: ['Other', ['checklist', 'log']]
};
var PANELS = {
  checklist: ['Checklist', '☑︎'], log: ['Log', '🗒'], links: ['Links', '🔗'], docs: ['Notes', '📝'],
  people: ['People', '👥'], budget: ['Budget', '💵']
};
function projectsAll(status) {
  return Store.all('projects').filter(function (p) { return !status || (p.status || 'active') === status; })
    .sort(function (a, b) { return (b.touchedAt || b.updated || 0) - (a.touchedAt || a.updated || 0); });
}
function projTasks(id) { return Store.all('tasks').filter(function (t) { return t.project === id; }); }
function touchProject(id, f) { f = f || {}; f.touched = today(); f.touchedAt = Date.now(); return Store.patch('projects', id, f); }
function pd(p, k, dflt) { return (p.data && p.data[k]) || dflt; }
function setPd(id, k, v) { var p = Store.get('projects', id), data = Object.assign({}, p.data || {}); data[k] = v; touchProject(id, { data: data }); }
function money(n) { return '$' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

TITLES.projects = 'Projects';
VIEWS.projects = function () {
  var act = projectsAll('active'), park = projectsAll('parked'), done = projectsAll('done');
  var card = function (p) {
    var open = projTasks(p.id).filter(function (t) { return !t.done; }).length;
    return '<button class="pcard" style="--c:' + esc(areaColor(p.area)) + '" data-act="open" data-v="project" data-id="' + p.id + '">'
      + '<div class="gh"><span class="gic">' + esc(p.ic || '📁') + '</span><span class="grow"><b>' + esc(p.t) + '</b>'
      + '<span class="s">' + (p.area ? areaDot(p.area) + esc(areaName(p.area)) + ' · ' : '') + esc((KINDS[p.kind] || KINDS.other)[0]) + ' · touched ' + esc(p.touched ? shortDate(p.touched).toLowerCase() : 'never') + ' ' + exPill(p) + '</span></span></div>'
      + '<div class="gnext"><span>Next</span>' + esc(p.next || 'No next step yet') + '</div>'
      + (open ? '<div class="small faint">' + open + ' open task' + (open === 1 ? '' : 's') + '</div>' : '') + '</button>';
  };
  var h = '';
  h += act.length ? '<section><div class="sechead"><h2>Active</h2><span class="meta">' + act.length + '</span></div><div class="goals">' + act.map(card).join('') + '</div></section>'
    : '<div class="empty">No active projects. A project here is anything with a finish line: a car, an application, a beta.</div>';
  if (park.length) h += '<section><div class="sechead"><h2>Parked</h2><span class="meta">' + park.length + '</span></div><div class="goals">' + park.map(card).join('') + '</div></section>';
  h += '<button class="btn soft block" data-act="newproject">' + icon('plus', 'sm') + 'New project</button>';
  if (done.length) h += '<details class="card"><summary class="muted" style="cursor:pointer">Finished · ' + done.length + '</summary><div class="list" style="margin-top:8px">'
    + done.map(function (p) { return '<button class="row" data-act="open" data-v="project" data-id="' + p.id + '"><span class="ic">' + esc(p.ic || '📁') + '</span><span class="grow t">' + esc(p.t) + '</span></button>'; }).join('') + '</div></details>';
  return h;
};

TITLES.project = function (id) { var p = Store.get('projects', id); return p ? p.t : 'Project'; };
var projOpen = {}; // panels the viewer expanded, per project
VIEWS.project = function (id) {
  var p = Store.get('projects', id); if (!p) return '<div class="empty">This project was deleted.</div>';
  var tasks = projTasks(id), open = tasks.filter(function (t) { return !t.done; });
  var nextTask = p.nextTask ? Store.get('tasks', p.nextTask) : null;
  var h = '<div class="dhead"><div class="ic">' + esc(p.ic || '📁') + '</div><div style="flex:1;min-width:0;display:grid;gap:6px">'
    + '<label class="sr" for="pt">Project name</label><input id="pt" class="input" style="font-size:19px;font-weight:500" data-pfield="t" value="' + esc(p.t) + '">'
    + '<div class="btnrow">' + exPill(p) + '<span class="pill">' + esc((KINDS[p.kind] || KINDS.other)[0]) + '</span>' + (p.status === 'parked' ? '<span class="pill">Parked</span>' : p.status === 'done' ? '<span class="pill">Finished</span>' : '') + '</div></div></div>';
  h += '<div class="field"><label for="pdone">Done when…</label><textarea id="pdone" class="input" style="min-height:60px" rows="2" data-pfield="done" placeholder="Done when it passes inspection and starts first time.">' + esc(p.done || '') + '</textarea></div>';
  h += '<div class="nextcard"><span class="lbl">Next</span><div class="t">' + esc(p.next || 'Nothing set') + '</div>'
    + (nextTask && !nextTask.done ? '<p class="note small">On your task list for ' + esc(nextTask.due ? shortDate(nextTask.due) : 'whenever') + '.</p>' : '')
    + '<div class="btnrow">' + (p.next ? '<button class="btn accent" data-act="projstart" data-id="' + id + '">' + (nextTask && !nextTask.done ? 'Start' : 'Start, put it on today') + '</button>'
      + '<button class="btn soft" data-act="projnextdone" data-id="' + id + '">Done, what\'s next?</button>'
      : '<button class="btn accent" data-act="projnextdone" data-id="' + id + '">Set the next step</button>') + '</div></div>';
  h += '<div class="field"><label for="pleft">Where I left off</label><textarea id="pleft" class="input" style="min-height:80px" data-pfield="left" placeholder="So future you can pick it straight back up.">' + esc(p.left || '') + '</textarea></div>';

  h += '<section><div class="sechead"><h2>Tasks</h2><span class="meta">' + open.length + ' open</span></div>'
    + (tasks.length ? '<div class="list">' + tasks.sort(function (a, b) { return (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'); }).slice(0, 20).map(taskRow).join('') + '</div>' : '')
    + '<form class="addstep" data-form="projtask" data-id="' + id + '"><label class="sr" for="ptask">New task</label><input id="ptask" class="input" placeholder="Add a task to this project" autocomplete="off"><button class="btn soft" type="submit">Add</button></form></section>';

  (p.panels || []).forEach(function (k) {
    var def = PANELS[k]; if (!def) return;
    var isOpen = projOpen[id + k] !== false;
    h += '<details class="panel"' + (isOpen ? ' open' : '') + ' data-panel="' + k + '"><summary><span>' + def[1] + '</span>' + def[0] + '<span class="meta">' + panelMeta(p, k) + '</span></summary><div class="pbody">' + panelBody(p, k) + '</div></details>';
  });
  h += '<details class="card"><summary class="muted" style="cursor:pointer">Panels, area and status</summary><div style="display:grid;gap:14px;margin-top:12px">'
    + '<div class="field"><span class="lbl">Panels</span><div class="chips">' + Object.keys(PANELS).map(function (k) {
      var on = (p.panels || []).indexOf(k) > -1;
      return '<button class="chip' + (on ? ' on' : '') + '" data-act="projpanel" data-id="' + id + '" data-k="' + k + '" aria-pressed="' + on + '">' + PANELS[k][0] + '</button>';
    }).join('') + '</div></div>'
    + '<div class="field"><span class="lbl">Area</span><div class="scrollx">' + areasSorted().map(function (a) {
      return '<button class="chip' + (p.area === a.id ? ' on' : '') + '" data-act="projarea" data-id="' + id + '" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</div></div>'
    + '<div class="field"><span class="lbl">Kind</span><div class="chips">' + Object.keys(KINDS).map(function (k) {
      return '<button class="chip' + (p.kind === k ? ' on' : '') + '" data-act="projkind" data-id="' + id + '" data-k="' + k + '">' + KINDS[k][0] + '</button>';
    }).join('') + '</div></div>'
    + '<div class="field" style="max-width:90px"><label for="pic">Icon</label><input id="pic" class="input" style="text-align:center" maxlength="4" data-pfield="ic" value="' + esc(p.ic || '') + '"></div>'
    + '<div class="btnrow">' + ['active', 'parked', 'done'].filter(function (s) { return (p.status || 'active') !== s; }).map(function (s) {
      return '<button class="btn soft" data-act="projstatus" data-id="' + id + '" data-s="' + s + '">' + { active: 'Make active', parked: 'Park it', done: 'Mark finished' }[s] + '</button>';
    }).join('') + '<button class="btn ghost" style="color:var(--bad)" data-act="delproject" data-id="' + id + '">Delete</button></div>'
    + '</div></details>';
  return h;
};
VIEWS.project.after = function (id) {
  $$('[data-pfield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.pfield] = el.value; touchProject(id, f); });
  });
  $$('details[data-panel]').forEach(function (el) {
    el.addEventListener('toggle', function () { projOpen[id + el.dataset.panel] = el.open; });
  });
  if (!projVisit || projVisit.id !== id) projVisit = { id: id, at: Date.now(), left: (Store.get('projects', id) || {}).left || '' };
};

/* ── panels ─────────────────────────────────────────────────────────── */
function panelMeta(p, k) {
  if (k === 'checklist') { var c = pd(p, 'checklist', []); return c.filter(function (x) { return x.done; }).length + '/' + c.length; }
  if (k === 'budget') { var b = pd(p, 'budget', []); return money(b.reduce(function (s, x) { return s + (+x.amt || 0); }, 0)); }
  if (k === 'docs') return Store.all('notes').filter(function (n) { return n.project === p.id; }).length || '';
  var a = pd(p, k, []); return a.length || '';
}
function panelBody(p, k) {
  var id = p.id, items = pd(p, k, []);
  var addForm = function (ph, fields) {
    return '<form class="addstep" data-form="paneladd" data-id="' + id + '" data-k="' + k + '">' + fields.map(function (f, i) {
      return '<label class="sr" for="pa' + k + i + '">' + esc(f[1]) + '</label><input id="pa' + k + i + '" class="input" name="' + f[0] + '" placeholder="' + esc(f[1]) + '" autocomplete="off"'
        + (f[2] ? ' inputmode="' + f[2] + '" style="max-width:110px"' : '') + '>';
    }).join('') + '<button class="btn soft" type="submit">Add</button></form>';
  };
  var del = function (i) { return '<button class="iconbtn" data-act="paneldel" data-id="' + id + '" data-k="' + k + '" data-i="' + i + '" aria-label="Remove">' + icon('x', 'sm') + '</button>'; };
  if (k === 'checklist') return '<div class="list">' + items.map(function (x, i) {
    return '<div class="row' + (x.done ? ' done' : '') + '"><button class="ck' + (x.done ? ' on' : '') + '" data-act="panelcheck" data-id="' + id + '" data-i="' + i + '" aria-label="Toggle"><span></span></button><span class="grow t">' + esc(x.t) + '</span>' + del(i) + '</div>';
  }).join('') + '</div>' + addForm('', [['t', 'Add an item']]);
  if (k === 'log') return addForm('', [['t', 'What happened?']]) + '<div class="log" style="margin-top:8px">' + items.slice().reverse().map(function (x) {
    return '<div class="logrow"><time>' + esc(shortDate(ymd(new Date(x.at)))) + '</time><span style="flex:1">' + esc(x.t) + '</span></div>';
  }).join('') + '</div>';
  if (k === 'links') return '<div class="list">' + items.map(function (x, i) {
    var safe = /^https?:\/\//i.test(x.url) ? x.url : 'https://' + x.url;
    return '<div class="row"><span class="grow"><a class="t" href="' + esc(safe) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(x.t || x.url) + '</a><div class="s">' + esc(x.url) + '</div></span>' + del(i) + '</div>';
  }).join('') + '</div>' + addForm('', [['t', 'Name'], ['url', 'https://…', 'url']]);
  if (k === 'people') return '<div class="list">' + items.map(function (x, i) {
    return '<div class="row"><span class="av" aria-hidden="true">' + esc((x.n || '?').charAt(0).toUpperCase()) + '</span><span class="grow"><div class="t">' + esc(x.n) + '</div><div class="s">' + esc(x.role || '') + '</div></span>' + del(i) + '</div>';
  }).join('') + '</div>' + addForm('', [['n', 'Name'], ['role', 'Role or note']]);
  if (k === 'budget') {
    var total = items.reduce(function (s, x) { return s + (+x.amt || 0); }, 0), paid = items.filter(function (x) { return x.paid; }).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    return '<div class="list">' + items.map(function (x, i) {
      return '<div class="row' + (x.paid ? ' done' : '') + '"><button class="ck' + (x.paid ? ' on' : '') + '" data-act="panelcheck" data-id="' + id + '" data-k="budget" data-i="' + i + '" aria-label="Paid"><span></span></button>'
        + '<span class="grow t">' + esc(x.t) + '</span><span class="amt">' + money(x.amt) + '</span>' + del(i) + '</div>';
    }).join('') + '</div><div class="kvrow"><span>Paid ' + money(paid) + '</span><b>Total ' + money(total) + '</b></div>' + addForm('', [['t', 'Item'], ['amt', 'Amount', 'decimal']]);
  }
  if (k === 'docs') {
    var ns = Store.all('notes').filter(function (n) { return n.project === id; });
    return '<div class="list">' + ns.map(function (n) {
      return '<button class="row" data-act="open" data-v="note" data-id="' + n.id + '"><span class="grow"><div class="t">' + esc(n.title || 'Untitled') + '</div><div class="s">' + esc(timeAgo(n.updated)) + '</div></span>' + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div><button class="btn soft block" data-act="projnote" data-id="' + id + '">' + icon('plus', 'sm') + 'New note in this project</button>';
  }
  return '';
}
ACTS.form_paneladd = function (d, f) {
  var vals = {}; $$('input', f).forEach(function (i) { vals[i.name] = i.value.trim(); });
  var main = vals.t || vals.n || vals.url; if (!main) return;
  var p = Store.get('projects', d.id), items = pd(p, d.k, []).slice();
  if (d.k === 'log') items.push({ t: vals.t, at: Date.now() });
  else if (d.k === 'links') items.push({ t: vals.t, url: vals.url || vals.t });
  else if (d.k === 'people') items.push({ n: vals.n, role: vals.role });
  else if (d.k === 'budget') items.push({ t: vals.t, amt: parseFloat(String(vals.amt).replace(/[^0-9.\-]/g, '')) || 0, paid: false });
  else items.push({ t: vals.t, done: false });
  setPd(d.id, d.k, items); render(false, true);
  var first = $('form[data-k="' + d.k + '"] input'); if (first) first.focus();
};
ACTS.panelcheck = function (d) {
  var k = d.k || 'checklist', p = Store.get('projects', d.id), items = pd(p, k, []).slice(), x = Object.assign({}, items[+d.i]);
  if (k === 'budget') x.paid = !x.paid; else x.done = !x.done;
  items[+d.i] = x; setPd(d.id, k, items);
};
ACTS.paneldel = function (d) { var p = Store.get('projects', d.id), items = pd(p, d.k, []).slice(); items.splice(+d.i, 1); setPd(d.id, d.k, items); };
ACTS.projnote = function (d) {
  var p = Store.get('projects', d.id);
  var n = Store.put('notes', { title: '', body: '', area: p.area || null, project: d.id }); push('note', n.id);
  setTimeout(function () { var e = $('#ntitle'); if (e) e.focus(); }, 50);
};

/* ── next step, tasks, settings ────────────────────────────────────── */
ACTS.form_projtask = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return;
  var p = Store.get('projects', d.id); inp.value = '';
  Store.put('tasks', { t: v, area: p.area || null, project: d.id, due: null, done: false, steps: [], note: '' });
  touchProject(d.id); render(false, true); var n = $('#ptask'); if (n) n.focus();
};
ACTS.projstart = function (d) {
  var p = Store.get('projects', d.id), t = p.nextTask ? Store.get('tasks', p.nextTask) : null;
  if (!t || t.done) {
    t = Store.put('tasks', { t: p.next, ic: p.ic || '', area: p.area || null, project: d.id, due: today(), done: false, steps: [], note: p.left ? 'Where I left off: ' + p.left : '' });
    touchProject(d.id, { nextTask: t.id });
  } else if (t.due !== today()) moveTask(t.id, 'today');
  logEvent('Started on ' + p.t + ': ' + p.next, p.area);
  toast('On today. ' + (p.left ? 'You left off: ' + esc(p.left.slice(0, 60)) : 'Ten minutes counts.'));
};
ACTS.projnextdone = function (d) {
  var p = Store.get('projects', d.id), had = !!p.next;
  if (had) {
    var t = p.nextTask ? Store.get('tasks', p.nextTask) : null;
    // Also tick off an open task on this project with the same name.
    if (!t) t = projTasks(d.id).filter(function (x) { return !x.done && x.t.trim().toLowerCase() === p.next.trim().toLowerCase(); })[0] || null;
    if (t && !t.done) completeTask(t.id, true);
    p = Store.get('projects', d.id);
    var log = pd(p, 'log', []).concat([{ t: 'Done: ' + p.next, at: Date.now() }]);
    var data = Object.assign({}, p.data || {}, { log: log });
    touchProject(d.id, { lastNext: p.next, next: '', nextTask: null, data: data });
    logEvent(p.t + ': ' + p.next, p.area);
  }
  openSheet('<div class="shead"><h2>' + (had ? 'Nice. What\'s next?' : 'Next step') + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<p class="note">' + esc(p.t) + '. One thing you could start next time you sit down with it.</p>'
    + '<form class="addstep" data-form="projnext" data-id="' + d.id + '"><label class="sr" for="pnext">Next step</label><input id="pnext" class="input" autocomplete="off"><button class="btn accent" type="submit">Set</button></form>',
    function (s) { $('#pnext', s).focus(); });
};
ACTS.form_projnext = function (d, f) { var v = $('input', f).value.trim(); if (!v) return; touchProject(d.id, { next: v }); closeSheet(); toast('Next step set'); };
ACTS.projpanel = function (d) {
  var p = Store.get('projects', d.id), ps = (p.panels || []).slice(), i = ps.indexOf(d.k);
  if (i > -1) ps.splice(i, 1); else ps.push(d.k);
  Store.patch('projects', d.id, { panels: ps });
};
ACTS.projarea = function (d) { var p = Store.get('projects', d.id); Store.patch('projects', d.id, { area: p.area === d.a ? null : d.a }); };
ACTS.projkind = function (d) { Store.patch('projects', d.id, { kind: d.k }); };
ACTS.projstatus = function (d) {
  var p = Store.get('projects', d.id); touchProject(d.id, { status: d.s });
  logEvent(p.t + (d.s === 'done' ? ' finished' : d.s === 'parked' ? ' parked' : ' back on'), p.area);
  if (d.s === 'done') toast('Finished. That counts.');
};
ACTS.delproject = function (d) {
  var p = Store.get('projects', d.id); Store.del('projects', d.id); projVisit = null; pop();
  toast('Project deleted', function () { Store.put('projects', p); });
};
ACTS.newproject = function () {
  openSheet('<div class="shead"><h2>New project</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<form data-form="newproject" style="display:grid;gap:14px"><div class="field"><label for="npt">Name</label><input id="npt" class="input" name="t" autocomplete="off" placeholder="e.g. The Capri"></div>'
    + '<div class="field"><span class="lbl">Kind (sets the starting panels)</span><div class="chips">' + Object.keys(KINDS).map(function (k, i) {
      return '<label class="chip"><input type="radio" name="kind" value="' + k + '"' + (i === 0 ? ' checked' : '') + ' class="sr">' + KINDS[k][0] + '</label>';
    }).join('') + '</div></div><button class="btn accent" type="submit">Create</button></form>',
    function (s) {
      $('#npt', s).focus();
      $$('input[name=kind]', s).forEach(function (r) { r.addEventListener('change', function () { $$('label.chip', s).forEach(function (l) { l.classList.toggle('on', $('input', l).checked); }); }); });
      $$('label.chip', s)[0].classList.add('on');
    });
};
ACTS.form_newproject = function (d, f) {
  var t = $('#npt', f).value.trim(); if (!t) { $('#npt', f).focus(); return; }
  var kind = ($('input[name=kind]:checked', f) || {}).value || 'other';
  var p = Store.put('projects', { t: t, ic: '📁', kind: kind, status: 'active', area: null, done: '', next: '', left: '', panels: KINDS[kind][1].slice(), data: {}, touched: today(), touchedAt: Date.now() });
  logEvent('New project: ' + t); closeSheet(); push('project', p.id);
};

/* Leaving a project you spent time in asks where you left off. */
var projVisit = null;
function maybeAskLeftOff() {
  var v = projVisit; projVisit = null;
  if (!v || Date.now() - v.at < 45000) return;
  var p = Store.get('projects', v.id); if (!p || p.left !== v.left) return; // they already wrote it
  openSheet('<div class="shead"><h2>Where did you leave off?</h2><button class="iconbtn" data-act="close" aria-label="Skip">' + icon('x') + '</button></div>'
    + '<p class="note">' + esc(p.t) + '. One line, so next time starts fast.</p>'
    + '<form class="addstep" data-form="leftoff" data-id="' + p.id + '"><label class="sr" for="lo">Where you left off</label><input id="lo" class="input" autocomplete="off" value="' + esc(p.left || '') + '"><button class="btn accent" type="submit">Save</button></form>',
    function (s) { var i = $('#lo', s); i.focus(); i.select(); });
}
ACTS.form_leftoff = function (d, f) { var v = $('input', f).value.trim(); touchProject(d.id, { left: v }); closeSheet(); toast('Saved for next time'); };
