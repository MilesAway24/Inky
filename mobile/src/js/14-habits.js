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
/* ── amounts ─────────────────────────────────────────────────────────
   A habit with a target ("3 L", "10 pages") keeps amounts per day; it
   counts as done (mark 1) once the day's amount reaches the target. */
function habitDone(h, d) { return mark(h, d) === 1; }
function amountOn(h, d) { return +((h.amounts || {})[d] || 0); }
function fmtAmt(n) { return String(Math.round(n * 100) / 100); }
function logAmount(id, d, add) {
  var h = Store.get('habits', id); if (!h || !h.target) return;
  var amounts = Object.assign({}, h.amounts || {}), marks = Object.assign({}, h.marks || {});
  var v = Math.max(0, Math.round((amountOn(h, d) + add) * 100) / 100), was = marks[d] === 1;
  if (v) amounts[d] = v; else delete amounts[d];
  if (v >= h.target) marks[d] = 1; else if (marks[d] === 1) delete marks[d];
  Store.patch('habits', id, { amounts: amounts, marks: marks });
  if (!was && v >= h.target && d === today()) logEvent(h.n + ' ✓ ' + fmtAmt(v) + ' ' + (h.unit || ''), h.area);
}
function amountUndo(id) { var h = Store.get('habits', id), a = JSON.stringify(h.amounts || {}), m = JSON.stringify(h.marks || {}); return function () { Store.patch('habits', id, { amounts: JSON.parse(a), marks: JSON.parse(m) }); }; }
function toggleToday(id) {
  var h = Store.get('habits', id), t = today(), was = mark(h, t);
  if (h.target) {
    var undo = amountUndo(id);
    if (was === 1) { logAmount(id, t, -amountOn(h, t)); toast(esc(h.n) + ' cleared for today', undo); return; }
    logAmount(id, t, h.target - amountOn(h, t));
    var s1 = streak(Store.get('habits', id));
    toast(esc(h.n) + ' · ' + fmtAmt(h.target) + ' ' + esc(h.unit || '') + (s1 > 1 ? ' · ' + s1 + ' in a row' : ''), undo);
    return;
  }
  setMark(id, t, was === 1 ? 0 : 1);
  if (was !== 1) {
    var s = streak(Store.get('habits', id));
    toast(esc(h.n) + ' done' + (s > 1 ? ' · ' + s + ' in a row' : ''), function () { setMark(id, t, was); });
  }
}
/* A ring that fills towards the day's target. */
function ring(h, d, size) {
  var p = h.target ? Math.min(1, amountOn(h, d) / h.target) : (habitDone(h, d) ? 1 : 0), r = size / 2 - 3, c = 2 * Math.PI * r;
  return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--line2)" stroke-width="3"/>'
    + '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--c)" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
}
function amtText(h, d) { return fmtAmt(amountOn(h, d)) + ' / ' + fmtAmt(h.target) + ' ' + (h.unit || ''); }
function habitChip(x) {
  var t = today(), m = mark(x, t), part = x.target && !m && amountOn(x, t) > 0;
  return '<button class="hchip' + (m === 1 ? ' on' : '') + (m === 2 ? ' skip' : '') + (part ? ' part' : '') + '" style="--c:' + esc(x.color) + '" data-act="habtoggle" data-hold="' + x.id + '" data-id="' + x.id + '" aria-pressed="' + (m === 1) + '">'
    + (x.target ? ring(x, t, 22) : '<span>' + esc(x.ic) + '</span>') + esc(x.n) + (x.target ? ' <span class="amt2">' + esc(amtText(x, t)) + '</span>' : '') + (m === 1 ? ' ✓' : '') + '</button>';
}
/* Log part of a target: press and hold a habit, or tap "Log some". */
ACTS.habsome = function (d) {
  var h = Store.get('habits', d.id); if (!h || !h.target) return;
  var t = today(), q = [0.25, 0.5].map(function (f) { return Math.round(h.target * f * 100) / 100; });
  openSheet('<div class="shead"><h2>' + esc(h.ic) + ' ' + esc(h.n) + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<div class="amtnow" style="--c:' + esc(h.color) + '">' + ring(h, t, 64) + '<div><b>' + esc(amtText(h, t)) + '</b><div class="small muted">today</div></div></div>'
    + '<div class="sweep3">' + q.map(function (v) { return '<button class="btn soft" data-act="habadd" data-id="' + h.id + '" data-v="' + v + '">+' + fmtAmt(v) + ' ' + esc(h.unit || '') + '</button>'; }).join('')
    + '<button class="btn accent" data-act="habadd" data-id="' + h.id + '" data-v="' + Math.max(0, h.target - amountOn(h, t)) + '">Fill it</button></div>'
    + '<form class="addstep" data-form="habamt" data-id="' + h.id + '"><label class="sr" for="hamt">Amount</label><input id="hamt" class="input" inputmode="decimal" placeholder="Amount in ' + esc(h.unit || 'units') + '"><button class="btn soft" type="submit">Log</button></form>'
    + (amountOn(h, t) ? '<button class="link" data-act="habadd" data-id="' + h.id + '" data-v="' + (-amountOn(h, t)) + '">Clear today</button>' : ''));
};
ACTS.habadd = function (d) { var undo = amountUndo(d.id); logAmount(d.id, today(), +d.v); closeSheet(); var h = Store.get('habits', d.id); toast(esc(h.n) + ' · ' + esc(amtText(h, today())), undo); };
ACTS.form_habamt = function (d, f) { var v = parseFloat($('input', f).value); if (!v) return; ACTS.habadd({ id: d.id, v: v }); };
/* Press and hold any [data-hold] habit button to log part of it. */
(function () {
  var timer = null, held = null;
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('[data-hold]'); if (!b) return;
    var h = Store.get('habits', b.dataset.hold); if (!h || !h.target) return;
    timer = setTimeout(function () { held = b; ACTS.habsome({ id: b.dataset.hold }); }, 480);
  }, true);
  ['pointerup', 'pointercancel', 'pointermove'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (ev === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return; clearTimeout(timer); }, true);
  });
  document.addEventListener('click', function (e) {
    if (held && e.target.closest('[data-hold]') === held) { e.stopImmediatePropagation(); e.preventDefault(); held = null; }
  }, true);
  document.addEventListener('contextmenu', function (e) { if (e.target.closest('[data-hold]')) e.preventDefault(); });
})();
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
  var main = '<button class="hmark' + (m === 1 ? ' on' : '') + '" style="--c:' + esc(h.color) + '" data-act="habtoggle" data-hold="' + h.id + '" data-id="' + h.id + '" aria-pressed="' + (m === 1) + '">'
    + (h.target ? (m === 1 ? 'Done · ' + esc(amtText(h, t)) : amountOn(h, t) ? esc(amtText(h, t)) + ' · fill it' : 'Log ' + fmtAmt(h.target) + ' ' + esc(h.unit || ''))
      : (m === 1 ? 'Done' : m === 2 ? 'Skipped' : due ? 'Mark done' : 'Not today')) + '</button>';
  return h.target ? '<div class="btnrow">' + main + '<button class="btn soft sm" data-act="habsome" data-id="' + h.id + '">Log some</button></div>' : main;
}
function habitCard(h) {
  var t = today(), body = '';
  if (habView === 'week') {
    var mon = addDays(t, -wd(t));
    body = '<div class="hweek">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = addDays(mon, i), m = mark(h, d), fut = d > t, isT = d === t;
      var cls = m === 1 ? 'hit' : m === 2 ? 'skip' : amountOn(h, d) > 0 ? 'part' : !dueOn(h, d) ? 'off' : fut ? 'fut' : isT ? 'now' : 'miss';
      return '<span class="' + cls + '"><i></i><em>' + 'MTWTFSS'.charAt(i) + '</em></span>';
    }).join('') + '</div>';
  } else if (habView === 'month') {
    body = '<div class="hgrid">' + range(30).map(function (i) {
      var d = addDays(t, i - 29), m = mark(h, d);
      var cls = m === 1 ? 'hit' : m === 2 ? 'skip' : amountOn(h, d) > 0 ? 'part' : !dueOn(h, d) || d < habitStart(h) ? 'off' : d === t ? 'now' : 'miss';
      return '<i class="' + cls + '" title="' + esc(shortDate(d)) + '"></i>';
    }).join('') + '</div>';
  } else {
    body = '<div class="hspark">' + range(14).map(function (i) {
      var d = addDays(t, i - 13), m = mark(h, d);
      return '<i class="' + (m === 1 ? 'hit' : m === 2 ? 'skip' : amountOn(h, d) > 0 ? 'part' : dueOn(h, d) ? 'miss' : 'off') + '"></i>';
    }).join('') + '</div>';
  }
  var s = streak(h);
  return '<div class="hcard" style="--c:' + esc(h.color) + '">'
    + '<button class="hhead" data-act="open" data-v="habit" data-id="' + h.id + '"><span class="hic">' + esc(h.ic) + '</span>'
    + '<span class="grow"><b>' + esc(h.n) + '</b><span class="s">' + (h.target ? esc(amtText(h, t)) + ' today · ' : '') + (s ? s + ' in a row · ' : '') + pctOver(h, 30) + '% this month' + (h.remindAt ? ' · 🔔 ' + esc(fmtTime(h.remindAt)) : '') + ' ' + exPill(h) + '</span></span>' + (h.target ? ring(h, t, 34) : '') + '</button>'
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
    + '<div class="field"><span class="lbl">Amount goal (optional): log part of it, a ring fills toward it</span><div class="btnrow">'
    + '<label class="sr" for="htarget">Target</label><input id="htarget" class="input" inputmode="decimal" style="flex:1" placeholder="Target, e.g. 3" data-hnum="target" value="' + esc(h.target || '') + '">'
    + '<label class="sr" for="hunit">Unit</label><input id="hunit" class="input" style="flex:1" placeholder="Unit, e.g. L, pages" data-hfield="unit" value="' + esc(h.unit || '') + '"></div></div>'
    + '<div class="field"><span class="lbl">Daily reminder (shown in Heads up on Today)</span><div class="chips">' + ['', '07:00', '09:00', '12:00', '18:00', '21:00'].map(function (r) {
      return '<button class="chip' + ((h.remindAt || '') === r ? ' on' : '') + '" data-act="habremind" data-id="' + id + '" data-t="' + r + '">' + (r ? esc(fmtTime(r)) : 'None') + '</button>';
    }).join('') + '<label class="chip" style="position:relative">Other<input type="time" data-act-change="habremindt" data-id="' + id + '" style="position:absolute;inset:0;opacity:0" aria-label="Other reminder time"></label></div>'
      + (h.remindAt ? '<div class="calrow">' + calBtn({ title: (h.ic ? h.ic + ' ' : '') + h.n, date: habitNextDay(h), time: h.remindAt, minutes: 15, notes: h.cue || '', alarmMin: 0 }, 'Add reminder to Calendar')
        + '<span class="faint small calnote">Adds the next one. In Calendar, set Repeat to Every Day.</span></div>' : '') + '</div>'
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
  $$('[data-hnum]').forEach(function (el) {
    el.addEventListener('input', function () { var v = parseFloat(el.value), f = {}; f[el.dataset.hnum] = v > 0 ? v : null; Store.patch('habits', id, f); });
  });
  $$('[data-hfield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.hfield] = el.value; Store.patch('habits', id, f); });
  });
};
function habitNextDay(h) {
  var n = new Date(), now = n.getHours() * 60 + n.getMinutes(), d = today();
  if (h.remindAt && mins(h.remindAt) <= now) d = addDays(d, 1);
  for (var i = 0; i < 7 && !dueOn(h, d); i++) d = addDays(d, 1);
  return d;
}
ACTS.habremind = function (d) { Store.patch('habits', d.id, { remindAt: d.t || null }); };
ACTS.habremindt = function (d, el) { if (el.value) Store.patch('habits', d.id, { remindAt: el.value }); };
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
