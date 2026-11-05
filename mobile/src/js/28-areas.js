/* ═══ LIFE AREA HUBS ════════════════════════════════════════════════
   Each area is a hub: its tasks, goals, projects, habits, notes and
   journal mentions, a "how it's going" line, and a weekly check-in.
   Notes and journal link to an area by choice, by @mention (@HCPD), or by
   a suggestion from Claude that you accept. */
function areaByWord(w) {
  w = String(w || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!w) return null;
  return areasSorted().filter(function (a) {
    var n = a.name.toLowerCase().replace(/[^a-z0-9]/g, ''), s = (a.short || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return w === s || w === n || w === a.id || (n.indexOf(w) === 0 && w.length >= 3);
  })[0] || null;
}
/* "@HCPD", "@Gym", "@Work" in any text → area ids. */
function areaMentions(text) {
  var out = [], re = /(^|[\s(])@([A-Za-z][\w-]{1,24})/g, m;
  while ((m = re.exec(String(text || '')))) { var a = areaByWord(m[2]); if (a && out.indexOf(a.id) < 0) out.push(a.id); }
  return out;
}
function noteAreas(n) { var o = n.area ? [n.area] : []; areaMentions((n.title || '') + ' ' + (n.body || '')).forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }
function journalAreas(j) { var o = (j.areas || []).slice(); areaMentions(j.text).forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }
function snippet(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > (n || 90) ? s.slice(0, n || 90) + '…' : s; }

/* ── the hub ─────────────────────────────────────────────────────── */
VIEWS.area = function (id) {
  var a = area(id); if (!a) return '<div class="empty">This area was removed.</div>';
  var open = Store.all('tasks').filter(function (t) { return t.area === id && !t.done; }).sort(byWhen);
  var goals = goalsLive().filter(function (g) { return g.area === id; });
  var projs = projectsAll('active').filter(function (p) { return p.area === id; });
  var habs = habitsSorted().filter(function (h) { return h.area === id; });
  var notes = Store.all('notes').filter(function (n) { return noteAreas(n).indexOf(id) > -1; }).sort(function (x, y) { return (y.updated || 0) - (x.updated || 0); });
  var jour = Store.all('journal').filter(function (j) { return journalAreas(j).indexOf(id) > -1; }).sort(function (x, y) { return y.day.localeCompare(x.day); });
  var cis = (a.checkins || []).slice().reverse();
  var h = '<section class="card areahead" style="--c:' + esc(a.color) + '"><div class="chips">' + AREA_STATES.map(function (s) {
      return '<button class="chip' + (a.state === s ? ' on' : '') + '" data-act="areastate" data-id="' + id + '" data-s="' + s + '">' + s + '</button>';
    }).join('') + '</div>'
    + '<div class="field"><label for="afocus">Current focus</label><input id="afocus" class="input" data-afield="focus" value="' + esc(a.focus || '') + '"></div>'
    + '<div class="field"><label for="ahow">How it\'s going</label><input id="ahow" class="input" data-afield="how" placeholder="One honest line" value="' + esc(a.how || '') + '"></div>'
    + '<div class="statrow small muted"><span>' + open.length + ' open</span><span>' + goals.length + ' goal' + (goals.length === 1 ? '' : 's') + '</span><span>' + notes.length + ' note' + (notes.length === 1 ? '' : 's') + '</span><span>' + jour.length + ' journal</span></div></section>';
  // Tasks
  h += '<section><div class="sechead"><h2>Tasks</h2><span class="meta">' + open.length + ' open</span></div>'
    + (open.length ? '<div class="tlist">' + open.slice(0, 8).map(taskRow).join('') + '</div>' : '<p class="note">Nothing open in ' + esc(a.short) + '.</p>')
    + '<form class="addstep" data-form="areaadd" data-id="' + id + '"><label class="sr" for="aadd">Add a task in ' + esc(a.short) + '</label><input id="aadd" class="input" placeholder="Add a task in ' + esc(a.short) + '" autocomplete="off"><button class="btn soft" type="submit">Add</button></form></section>';
  if (goals.length) h += '<section><div class="sechead"><h2>Goals</h2></div><div class="list">' + goals.map(function (g) {
    return '<button class="row" data-act="open" data-v="goal" data-id="' + g.id + '"><span class="ic">' + esc(g.ic || '🎯') + '</span><span class="grow"><div class="t">' + esc(g.n) + '</div>' + (g.next ? '<div class="s">Next: ' + esc(g.next) + '</div>' : '') + '</span>' + icon('chev', 'sm chev') + '</button>';
  }).join('') + '</div></section>';
  if (projs.length) h += '<section><div class="sechead"><h2>Projects</h2></div><div class="list">' + projs.map(function (p) {
    return '<button class="row" data-act="open" data-v="project" data-id="' + p.id + '"><span class="ic">' + esc(p.ic || '📁') + '</span><span class="grow"><div class="t">' + esc(p.t) + '</div>' + (p.next ? '<div class="s">Next: ' + esc(p.next) + '</div>' : '') + '</span>' + icon('chev', 'sm chev') + '</button>';
  }).join('') + '</div></section>';
  if (habs.length) h += '<section><div class="sechead"><h2>Habits</h2></div><div class="hchips">' + habs.map(habitChip).join('') + '</div></section>';
  h += '<section><div class="sechead"><h2>Notes</h2><span class="meta">' + notes.length + '</span></div>'
    + (notes.length ? '<div class="list">' + notes.slice(0, 6).map(function (n) {
      return '<button class="row" data-act="open" data-v="note" data-id="' + n.id + '"><span class="grow"><div class="t">' + esc(n.title || 'Untitled') + '</div><div class="s">' + esc(snippet(n.body, 80)) + '</div></span>' + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div>' : '<p class="note small">Notes land here when you pick ' + esc(a.short) + ' on them, write @' + esc(a.short) + ', or accept Claude\'s suggestion.</p>') + '</section>';
  h += '<section><div class="sechead"><h2>Journal</h2><span class="meta">' + jour.length + '</span></div>'
    + (jour.length ? '<div class="list">' + jour.slice(0, 6).map(function (j) {
      return '<button class="row" data-act="open" data-v="entry" data-id="' + j.id + '"><span class="jd"><b>' + esc(shortDate(j.day)) + '</b></span><span class="grow t">' + esc(snippet(j.text, 110)) + '</span></button>';
    }).join('') + '</div>' : '<p class="note small">Journal entries show here when you tag them ' + esc(a.short) + ' or mention @' + esc(a.short) + '.</p>') + '</section>';
  h += '<section><div class="sechead"><h2>Check-ins</h2><button class="link" data-act="checkin">Check in now</button></div>'
    + (cis.length ? '<div class="list">' + cis.slice(0, 8).map(function (c) {
      return '<div class="row"><span class="jd"><b>' + esc(shortDate(c.wk)) + '</b></span><span class="grow"><span class="st st-' + c.state.toLowerCase().replace(/\s/g, '') + '">' + esc(c.state) + '</span>' + (c.line ? '<div class="s">' + esc(c.line) + '</div>' : '') + '</span></div>';
    }).join('') + '</div>' : '<p class="note small">Once a week, rate each area and write one line. The history builds up here.</p>') + '</section>';
  h += '<details class="card"><summary class="muted" style="cursor:pointer">Name and colour</summary><div style="display:grid;gap:12px;margin-top:12px">'
    + '<div class="field"><label for="aname">Name</label><input id="aname" class="input" data-afield="name" value="' + esc(a.name) + '"></div>'
    + '<div class="field"><label for="ashort">Short name</label><input id="ashort" class="input" data-afield="short" value="' + esc(a.short) + '" maxlength="12"></div>'
    + '<div class="field"><label for="acolor">Colour</label><input id="acolor" type="color" class="input" style="max-width:90px;padding:4px" data-afield="color" value="' + esc(a.color) + '"></div>'
    + '</div></details>';
  return h;
};
VIEWS.area.after = function (id) {
  $$('[data-afield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.afield] = el.value; Store.patch('areas', id, f); });
  });
  if (typeof wireSwipes === 'function') wireSwipes();
};
ACTS.form_areaadd = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return; inp.value = '';
  var pt = parseTaskText(v);
  Store.put('tasks', { t: pt.title || v, area: d.id, project: pt.project, due: pt.due || null, time: pt.time, repeat: pt.repeat, done: false, steps: [], note: '' });
  render(false, true); toast('Added to ' + esc(areaName(d.id)));
};

/* ── weekly check-in ─────────────────────────────────────────────── */
function checkinDue() {
  var m = Store.get('meta', 'checkin'), last = m && m.last, t = today();
  if (!areasSorted().length) return false;
  if (!last) return true;
  if (dayDiff(last, t) >= 7) return true;
  return parseYmd(t).getDay() === 0 && last < addDays(t, -6);
}
function areaHeadsUp() {
  return checkinDue() ? ['<div class="hurow"><span>🧭</span><span class="grow"><b>Weekly area check-in</b> <span class="muted">one tap per area</span></span><button class="btn sm soft" data-act="checkin">Start</button></div>'] : [];
}
var ciDraft = null;
ACTS.checkin = function () {
  ciDraft = {}; areasSorted().forEach(function (a) { ciDraft[a.id] = { state: a.state, line: '' }; });
  ciPaint();
};
function ciPaint() {
  var h = '<div class="shead"><h2>Weekly check-in</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<p class="note small">How is each area going? One tap, one line if you want.</p>'
    + areasSorted().map(function (a) {
      var dft = ciDraft[a.id];
      return '<div class="cirow" style="--c:' + esc(a.color) + '"><b>' + esc(a.name) + '</b><div class="chips">' + ['On track', 'Needs you', 'Paused'].map(function (s) {
        return '<button type="button" class="chip' + (dft.state === s ? ' on' : '') + '" data-act="cistate" data-id="' + a.id + '" data-s="' + s + '">' + s + '</button>';
      }).join('') + '</div><label class="sr" for="ci-' + a.id + '">One line about ' + esc(a.name) + '</label><input id="ci-' + a.id + '" class="input ciline" data-id="' + a.id + '" placeholder="One line (optional)" value="' + esc(dft.line) + '" autocomplete="off"></div>';
    }).join('')
    + '<button class="btn accent block" data-act="cisave">Save check-in</button>';
  if ($('#sheetbg').hidden) openSheet(h); else $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div>' + h;
}
function ciKeep() { $$('#sheet .ciline').forEach(function (el) { if (ciDraft[el.dataset.id]) ciDraft[el.dataset.id].line = el.value; }); }
ACTS.cistate = function (d) { ciKeep(); ciDraft[d.id].state = d.s; ciPaint(); };
ACTS.cisave = function () {
  ciKeep(); var t = today(), n = 0;
  Object.keys(ciDraft).forEach(function (id) {
    var a = area(id); if (!a) return;
    var c = (a.checkins || []).concat([{ wk: t, state: ciDraft[id].state, line: ciDraft[id].line.trim().slice(0, 200) }]).slice(-52);
    Store.patch('areas', id, { state: ciDraft[id].state, checkins: c }); n++;
  });
  var m = Store.get('meta', 'checkin'); if (m) Store.patch('meta', 'checkin', { last: t }); else Store.put('meta', { id: 'checkin', last: t });
  logEvent('Weekly area check-in: ' + n + ' areas'); ciDraft = null; closeSheet(); toast('Check-in saved');
};

/* ── journal ↔ areas ─────────────────────────────────────────────── */
function areaChipsFor(kind, id, chosen) {
  return '<div class="scrollx areapick" role="group" aria-label="Life area">' + areasSorted().map(function (a) {
    var on = chosen.indexOf(a.id) > -1;
    return '<button class="chip' + (on ? ' on' : '') + '" data-act="arealink" data-k="' + kind + '" data-id="' + id + '" data-a="' + a.id + '" aria-pressed="' + on + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
  }).join('') + '</div>';
}
ACTS.arealink = function (d) {
  if (d.k === 'entry') {
    var j = Store.get('journal', d.id);
    if (!j && d.id === 'j' + today()) { saveEntry(today(), { areas: [d.a] }); delete spotted[d.k + ':' + d.id]; return; }
    if (!j) return;
    var ar = (j.areas || []).slice(), i = ar.indexOf(d.a);
    if (i > -1) ar.splice(i, 1); else ar.push(d.a);
    Store.patch('journal', d.id, { areas: ar });
  } else if (d.k === 'note') {
    var n = Store.get('notes', d.id); if (!n) return;
    Store.patch('notes', d.id, { area: n.area === d.a ? null : d.a });
  }
  delete spotted[d.k + ':' + d.id];
};

/* ── Claude spots areas ──────────────────────────────────────────────
   After you stop typing in a note or journal entry that has no area,
   Claude reads it and may suggest one. Nothing is linked until you tap. */
var spotted = {}, spotT = null, spotSeen = {};
function spotChip(kind, id) { return '<div class="spotslot" id="spot-' + kind + '-' + id + '">' + spotChipInner(kind, id) + '</div>'; }
function spotChipInner(kind, id) {
  var a = spotted[kind + ':' + id] && area(spotted[kind + ':' + id]); if (!a) return '';
  return '<div class="spotchip" style="--c:' + esc(a.color) + '">' + icon('sparkle', 'sm') + '<span class="grow">Looks like <b>' + esc(a.name) + '</b></span>'
    + '<button class="btn sm soft" data-act="arealink" data-k="' + kind + '" data-id="' + id + '" data-a="' + a.id + '">Link</button>'
    + '<button class="iconbtn" data-act="spotno" data-k="' + kind + '" data-id="' + id + '" aria-label="Not this area">' + icon('x', 'sm') + '</button></div>';
}
ACTS.spotno = function (d) { spotSeen[d.k + ':' + d.id] = 'no'; delete spotted[d.k + ':' + d.id]; render(); };
function spotFor(kind, id) {
  if (!AI.ready || spotSeen[kind + ':' + id] === 'no') return;
  var rec = kind === 'entry' ? Store.get('journal', id) : Store.get('notes', id); if (!rec) return;
  var has = kind === 'entry' ? journalAreas(rec).length : noteAreas(rec).length; if (has) return;
  var text = kind === 'entry' ? rec.text : (rec.title || '') + '\n' + (rec.body || '');
  if (!text || text.trim().length < 12 || spotSeen[kind + ':' + id] === text) return;
  spotSeen[kind + ':' + id] = text;
  aiJson('Which of these life areas is this ' + (kind === 'entry' ? 'journal entry' : 'note') + ' mostly about? Life areas (JSON): '
    + JSON.stringify(areasSorted().map(function (a) { return { id: a.id, name: a.name, focus: a.focus || '' }; }))
    + '\nText: ' + JSON.stringify(text.slice(0, 1500))
    + '\nReply with JSON only: {"area": "<id or null>", "confidence": 0.0-1.0}. Use null if it is not clearly about one area.')
    .then(function (r) {
      if (!r || !r.area || !area(r.area) || !(+r.confidence >= 0.6)) return;
      spotted[kind + ':' + id] = r.area;
      // Show it in place: the page doesn't repaint while you're typing.
      var slot = document.getElementById('spot-' + kind + '-' + id); if (slot) slot.innerHTML = spotChipInner(kind, id);
    }).catch(function () {});
}
document.addEventListener('input', function (e) {
  var el = e.target, c = current(); if (!el || !el.id) return;
  var kind = null, id = null;
  if ((el.id === 'nbody' || el.id === 'ntitle' || el.id === 'nedit') && c.view === 'note') { kind = 'note'; id = c.arg; }
  else if (el.id === 'etext' && c.view === 'entry') { kind = 'entry'; id = c.arg; }
  else if (el.id === 'jtext' && c.view === 'journal') { kind = 'entry'; id = 'j' + today(); }
  if (!kind) return;
  clearTimeout(spotT); spotT = setTimeout(function () { spotFor(kind, id); }, 2500);
}, true);
