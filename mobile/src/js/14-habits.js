/* ═══ HABITS ════════════════════════════════════════════════════════
   marks: { 'YYYY-MM-DD': 1 (done) | 2 (skipped on purpose) }.
   A skip you meant keeps the streak; an unmarked past day breaks it.
   days: which weekdays it's due, Mon..Sun. */
var HAB_TPL = [
  ['💊', 'Meds', '#5FCF8E', 'Same time as coffee. The coffee is the cue.'],
  ['🚶', 'Morning walk', '#7AA2F7', 'Ten minutes counts. It is daylight, not exercise.'],
  ['📖', 'Read 20 pages', '#F0C889', 'Any book. Pages, not minutes.'],
  ['💧', 'Drink water', '#8FD3C7', 'A glass when you sit down.'],
  ['🧹', 'Tidy one thing', '#C39BD3', 'One thing. Not the room.'],
  ['🌙', 'Phone out of the bedroom', '#8FD3C7', 'The charger lives elsewhere.'],
  ['✍️', 'Write one line', '#F0C889', 'A sentence counts.'],
  ['🧘', 'Sit still for two minutes', '#C39BD3', 'Two. Not twenty.'],
  ['🏃', 'Run', '#F08A4B', 'Shoes on is the habit. The run follows.'],
  ['📚', 'Study 25 minutes', '#3CC4B4', 'One timer. Stop when it rings.']
];
var habView = 'week';
function wd(s) { return (parseYmd(s).getDay() + 6) % 7; } // Mon=0
function dueOn(h, s) { return !h.days || !!h.days[wd(s)]; }
function mark(h, s) { return (h.marks || {})[s] || 0; }
function habitsSorted() { return Store.all('habits').filter(function (h) { return !h.archived; }).sort(function (a, b) { return (a.order || a.created) - (b.order || b.created); }); }
function habitStart(h) { return h.since || ymd(new Date(h.created || Date.now())); }

function streak(h) {
  var d = today(), n = 0, start = habitStart(h);
  if (mark(h, d) !== 1) d = addDays(d, -1); // today isn't over yet
  for (var i = 0; i < 500 && d >= start; i++, d = addDays(d, -1)) {
    if (!dueOn(h, d)) continue;
    var m = mark(h, d);
    if (m === 1) n++; else if (m === 2) continue; else break;
  }
  return n;
}
function bestRun(h) {
  var best = 0, cur = 0, d = habitStart(h), end = today();
  if (dayDiff(d, end) > 730) d = addDays(end, -730);
  for (; d <= end; d = addDays(d, 1)) {
    if (!dueOn(h, d)) continue;
    var m = mark(h, d);
    if (m === 1) { cur++; if (cur > best) best = cur; } else if (m !== 2 && d !== end) cur = 0;
  }
  return best;
}
function pctOver(h, days) {
  var due = 0, hit = 0, start = habitStart(h);
  for (var i = 0; i < days; i++) {
    var d = addDays(today(), -i); if (d < start) break;
    if (!dueOn(h, d)) continue;
    if (i === 0 && !mark(h, d)) continue; // don't count today against you before it's over
    var m = mark(h, d); if (m === 2) continue;
    due++; if (m === 1) hit++;
  }
  return due ? Math.round(hit / due * 100) : 0;
}
function setMark(id, s, v) {
  var h = Store.get('habits', id); if (!h) return;
  var marks = Object.assign({}, h.marks || {});
  if (v) marks[s] = v; else delete marks[s];
  Store.patch('habits', id, { marks: marks });
  if (v === 1 && s === today()) logEvent(h.n + ' ✓', h.area);
}
function toggleToday(id) {
  var h = Store.get('habits', id), was = mark(h, today());
  setMark(id, today(), was === 1 ? 0 : 1);
  if (was !== 1) {
    var s = streak(Store.get('habits', id));
    toast(esc(h.n) + ' done' + (s > 1 ? ' · ' + s + ' in a row' : ''), function () { setMark(id, today(), was); });
  }
}
function habitsDueToday() { var t = today(); return habitsSorted().filter(function (h) { return dueOn(h, t); }); }

/* ── list ───────────────────────────────────────────────────────────── */
TITLES.habits = 'Habits';
VIEWS.habits = function () {
  var hs = habitsSorted(), t = today();
  if (!hs.length) return '<div class="empty">No habits yet. Start with one small thing you already half-do.</div>'
    + '<button class="btn accent" data-act="newhabit">' + icon('plus', 'sm') + 'New habit</button>';
  var due = habitsDueToday(), doneN = due.filter(function (h) { return mark(h, t) === 1; }).length;
  var monthKey = t.slice(0, 7), monthN = 0;
  hs.forEach(function (h) { Object.keys(h.marks || {}).forEach(function (k) { if (k.slice(0, 7) === monthKey && h.marks[k] === 1) monthN++; }); });
  var best = hs.reduce(function (m, h) { return Math.max(m, bestRun(h)); }, 0);
  var h = '<div class="stats4">' + [['Done today', doneN + '<small>/' + due.length + '</small>'], ['This month', monthN], ['Longest run', best], ['Habits', hs.length]]
    .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
  h += '<div class="seg" role="tablist">' + [['week', 'Week'], ['month', '30 days'], ['daily', 'Daily']].map(function (v) {
    return '<button role="tab" aria-selected="' + (habView === v[0]) + '" class="' + (habView === v[0] ? 'on' : '') + '" data-act="habview" data-v="' + v[0] + '">' + v[1] + '</button>';
  }).join('') + '</div>';
  h += '<div class="habs">' + hs.map(function (x) { return habitCard(x); }).join('') + '</div>';
  h += '<button class="btn soft block" data-act="newhabit">' + icon('plus', 'sm') + 'New habit</button>';
  return h;
};
function markBtn(h) {
  var t = today(), m = mark(h, t), due = dueOn(h, t);
  return '<button class="hmark' + (m === 1 ? ' on' : '') + '" style="--c:' + esc(h.color) + '" data-act="habtoggle" data-id="' + h.id + '" aria-pressed="' + (m === 1) + '">'
    + (m === 1 ? 'Done' : m === 2 ? 'Skipped' : due ? 'Mark done' : 'Not today') + '</button>';
}
function habitCard(h) {
  var t = today(), body = '';
  if (habView === 'week') {
    var mon = addDays(t, -wd(t));
    body = '<div class="hweek">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = addDays(mon, i), m = mark(h, d), fut = d > t, isT = d === t;
      var cls = m === 1 ? 'hit' : m === 2 ? 'skip' : !dueOn(h, d) ? 'off' : fut ? 'fut' : isT ? 'now' : 'miss';
      return '<span class="' + cls + '"><i></i><em>' + 'MTWTFSS'.charAt(i) + '</em></span>';
    }).join('') + '</div>';
  } else if (habView === 'month') {
    body = '<div class="hgrid">' + range(30).map(function (i) {
      var d = addDays(t, i - 29), m = mark(h, d);
      var cls = m === 1 ? 'hit' : m === 2 ? 'skip' : !dueOn(h, d) || d < habitStart(h) ? 'off' : d === t ? 'now' : 'miss';
      return '<i class="' + cls + '" title="' + esc(shortDate(d)) + '"></i>';
    }).join('') + '</div>';
  } else {
    body = '<div class="hspark">' + range(14).map(function (i) {
      var d = addDays(t, i - 13), m = mark(h, d);
      return '<i class="' + (m === 1 ? 'hit' : m === 2 ? 'skip' : dueOn(h, d) ? 'miss' : 'off') + '"></i>';
    }).join('') + '</div>';
  }
  var s = streak(h);
  return '<div class="hcard" style="--c:' + esc(h.color) + '">'
    + '<button class="hhead" data-act="open" data-v="habit" data-id="' + h.id + '"><span class="hic">' + esc(h.ic) + '</span>'
    + '<span class="grow"><b>' + esc(h.n) + '</b><span class="s">' + (s ? s + ' in a row · ' : '') + pctOver(h, 30) + '% this month ' + exPill(h) + '</span></span></button>'
    + body + markBtn(h) + '</div>';
}
function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
ACTS.habview = function (d) { habView = d.v; render(); };
ACTS.habtoggle = function (d) { toggleToday(d.id); };

/* ── detail ─────────────────────────────────────────────────────────── */
TITLES.habit = function (id) { var h = Store.get('habits', id); return h ? h.n : 'Habit'; };
VIEWS.habit = function (id) {
  var h = Store.get('habits', id); if (!h) return '<div class="empty">This habit was deleted.</div>';
  var t = today(), m = mark(h, t);
  var out = '<div class="hcard big" style="--c:' + esc(h.color) + '"><div class="hhead"><span class="hic">' + esc(h.ic) + '</span><span class="grow"><b>' + esc(h.n) + '</b>'
    + '<span class="s">' + esc(h.cue || '') + '</span></span></div>'
    + '<div class="stats4">' + [['Streak', streak(h)], ['Best', bestRun(h)], ['30 days', pctOver(h, 30) + '%'], ['Total', Object.keys(h.marks || {}).filter(function (k) { return h.marks[k] === 1; }).length]]
      .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>'
    + '<div class="hgrid">' + range(30).map(function (i) {
      var d = addDays(t, i - 29), mk = mark(h, d);
      return '<button class="' + (mk === 1 ? 'hit' : mk === 2 ? 'skip' : !dueOn(h, d) ? 'off' : d === t ? 'now' : 'miss') + '" data-act="habday" data-id="' + id + '" data-d="' + d + '" aria-label="' + esc(shortDate(d)) + ': ' + (mk === 1 ? 'done' : mk === 2 ? 'skipped' : 'not done') + '"></button>';
    }).join('') + '</div><p class="note small">Tap a day to fix it: done, skipped on purpose, or not done.</p>'
    + '<div class="btnrow">' + markBtn(h) + (m !== 1 ? '<button class="btn soft" data-act="habskip" data-id="' + id + '">' + (m === 2 ? 'Undo skip' : 'Skip today, on purpose') + '</button>' : '') + '</div></div>';
  out += '<section><div class="sechead"><h2>Edit</h2></div><div style="display:grid;gap:12px">'
    + '<div class="field"><label for="hn">Name</label><input id="hn" class="input" data-hfield="n" value="' + esc(h.n) + '"></div>'
    + '<div class="field"><label for="hcue">Cue: when and where it happens</label><input id="hcue" class="input" data-hfield="cue" value="' + esc(h.cue || '') + '"></div>'
    + '<div class="field"><span class="lbl">Days</span><div class="chips">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (n, i) {
      var on = !h.days || h.days[i];
      return '<button class="chip' + (on ? ' on' : '') + '" data-act="habdays" data-id="' + id + '" data-i="' + i + '" aria-pressed="' + !!on + '">' + n + '</button>';
    }).join('') + '</div></div>'
    + '<div class="field"><span class="lbl">Area</span><div class="scrollx">' + areasSorted().map(function (a) {
      return '<button class="chip' + (h.area === a.id ? ' on' : '') + '" data-act="habarea" data-id="' + id + '" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</div></div>'
    + '<div class="btnrow"><div class="field" style="flex:0 0 90px"><label for="hic">Icon</label><input id="hic" class="input" style="text-align:center" maxlength="4" data-hfield="ic" value="' + esc(h.ic) + '"></div>'
    + '<div class="field" style="flex:0 0 90px"><label for="hcol">Colour</label><input id="hcol" type="color" class="input" style="padding:4px" data-hfield="color" value="' + esc(h.color) + '"></div></div>'
    + '</div></section>'
    + '<button class="btn ghost" style="color:var(--bad);justify-self:start" data-act="delhabit" data-id="' + id + '">Delete habit</button>';
  return out;
};
VIEWS.habit.after = function (id) {
  $$('[data-hfield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.hfield] = el.value; Store.patch('habits', id, f); });
  });
};
ACTS.habday = function (d) {
  var h = Store.get('habits', d.id), cur = mark(h, d.d), next = cur === 0 ? 1 : cur === 1 ? 2 : 0;
  setMark(d.id, d.d, next);
};
ACTS.habskip = function (d) { var h = Store.get('habits', d.id); setMark(d.id, today(), mark(h, today()) === 2 ? 0 : 2); };
ACTS.habdays = function (d) {
  var h = Store.get('habits', d.id), days = (h.days || [1, 1, 1, 1, 1, 1, 1]).slice(); days[+d.i] = days[+d.i] ? 0 : 1;
  if (!days.some(Boolean)) { toast('A habit needs at least one day'); return; }
  Store.patch('habits', d.id, { days: days });
};
ACTS.habarea = function (d) { var h = Store.get('habits', d.id); Store.patch('habits', d.id, { area: h.area === d.a ? null : d.a }); };
ACTS.delhabit = function (d) { var h = Store.get('habits', d.id); Store.del('habits', d.id); pop(); toast('Habit deleted', function () { Store.put('habits', h); }); };

/* ── builder ───────────────────────────────────────────────────────── */
ACTS.newhabit = function () {
  openSheet('<div class="shead"><h2>New habit</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<p class="note">Pick one to start from, or write your own. Small beats ambitious.</p>'
    + '<div class="tplgrid">' + HAB_TPL.map(function (x, i) {
      return '<button class="tpl" data-act="habtpl" data-i="' + i + '"><span>' + x[0] + '</span><b>' + esc(x[1]) + '</b><small>' + esc(x[3]) + '</small></button>';
    }).join('') + '</div>'
    + '<form class="addstep" data-form="newhabit"><label class="sr" for="hnew">Your own habit</label><input id="hnew" class="input" placeholder="Your own…" autocomplete="off"><button class="btn accent" type="submit">Add</button></form>');
};
function addHabit(ic, n, color, cue) {
  var h = Store.put('habits', { ic: ic, n: n, color: color, cue: cue, days: [1, 1, 1, 1, 1, 1, 1], marks: {}, area: null, since: today() });
  logEvent('New habit: ' + n); closeSheet(); push('habit', h.id);
}
ACTS.habtpl = function (d) { var x = HAB_TPL[+d.i]; addHabit(x[0], x[1], x[2], x[3]); };
ACTS.form_newhabit = function (d, f) { var v = $('input', f).value.trim(); if (v) addHabit('✨', v, '#5FCF8E', ''); };
