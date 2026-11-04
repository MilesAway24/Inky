/* ═══ TASK RULES ═════════════════════════════════════════════════════
   A task has an optional day (due), time (HH:MM) and repeat. Nothing is
   ever "overdue": a past day that wasn't done is "slipped" and waits for
   the sweep. A repeating task, when done, rolls forward to its next day. */
function area(id) { return id ? Store.get('areas', id) : null; }
function areaColor(id) { var a = area(id); return a ? a.color : 'var(--faint)'; }
function areasSorted() { return Store.all('areas').sort(function (a, b) { return (a.order || 99) - (b.order || 99); }); }
function doneToday(t) { return t.done && t.doneAt && ymd(new Date(t.doneAt)) === today(); }

function bucket(t) {
  var d = today();
  if (t.done) return doneToday(t) ? 'today' : 'done';
  if (t.drifted) return 'drifted';
  if (!t.due) return 'whenever';
  var n = dayDiff(d, t.due);
  if (n < 0) return 'slipped';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n <= 7) return 'week';
  return 'later';
}
/* The Tasks list has three groups. */
function listGroup(t) {
  var b = bucket(t);
  if (b === 'tomorrow' || b === 'week' || b === 'later') return 'upcoming';
  if (b === 'whenever' || b === 'drifted') return 'someday';
  return b; // today | slipped | done
}
var GROUPS = [['today', 'Today'], ['upcoming', 'Upcoming'], ['someday', 'Someday']];
function byWhen(a, b) {
  if (!!a.done !== !!b.done) return a.done ? 1 : -1;
  return (a.due || '9').localeCompare(b.due || '9') || (a.time || '99').localeCompare(b.time || '99') || (a.created || 0) - (b.created || 0);
}
function tasksIn(b, areaFilter) {
  return Store.all('tasks').filter(function (t) { return bucket(t) === b && (!areaFilter || t.area === areaFilter); }).sort(byWhen);
}
function tasksInGroup(g, areaFilter) {
  return Store.all('tasks').filter(function (t) { return listGroup(t) === g && (!areaFilter || t.area === areaFilter); }).sort(byWhen);
}
function slipped() { return tasksIn('slipped'); }

/* ── repeats ─────────────────────────────────────────────────────────
   {every:'day'} | {every:'weekday'} | {every:'week', days:[Mon..Sun 0/1]}
   | {every:'month', dom:1..31} */
function daysInMonth(s) { var d = parseYmd(s); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function repeatsOn(rep, s) {
  var w = (parseYmd(s).getDay() + 6) % 7;
  if (rep.every === 'day') return true;
  if (rep.every === 'weekday') return w < 5;
  if (rep.every === 'week') return !!(rep.days && rep.days[w]);
  if (rep.every === 'month') { var dom = parseYmd(s).getDate(), want = Math.min(rep.dom || 1, daysInMonth(s)); return dom === want; }
  return false;
}
/* First matching day strictly after `after`. */
function nextOccurrence(rep, after) {
  var d = addDays(after, 1);
  for (var i = 0; i < 400; i++, d = addDays(d, 1)) if (repeatsOn(rep, d)) return d;
  return addDays(after, 1);
}
function repeatLabel(rep) {
  if (!rep) return '';
  if (rep.every === 'day') return 'daily';
  if (rep.every === 'weekday') return 'weekdays';
  if (rep.every === 'week') {
    var n = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter(function (x, i) { return rep.days && rep.days[i]; });
    return n.length === 7 ? 'daily' : 'every ' + n.join(', ');
  }
  if (rep.every === 'month') { var x = rep.dom || 1; return 'monthly on the ' + x + (x % 10 === 1 && x !== 11 ? 'st' : x % 10 === 2 && x !== 12 ? 'nd' : x % 10 === 3 && x !== 13 ? 'rd' : 'th'); }
  return '';
}
function fmtTime(hm) {
  if (!hm) return '';
  var p = hm.split(':'), h = +p[0], m = p[1];
  return (h % 12 || 12) + (m !== '00' ? ':' + m : '') + (h < 12 ? 'am' : 'pm');
}

/* ── reading typed task text ─────────────────────────────────────────
   "Pay rent every month on the 1st at 9am" → title "Pay rent", repeat
   monthly on the 1st, time 09:00, due the next 1st. Used by the Tasks
   add box and by smart capture's rule sorter. */
var DAYNAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
function parseTaskText(text) {
  var s = ' ' + String(text || '') + ' ', low, m, o = { due: null, time: null, repeat: null, area: null, project: null };
  var cut = function (re) { s = s.replace(re, ' '); };
  low = s.toLowerCase();
  // time: 9am, 9:30pm, at 9:30, at 17:00
  if ((m = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(s))) {
    var h = +m[1] % 12 + (m[3].toLowerCase() === 'pm' ? 12 : 0); o.time = String(h).padStart(2, '0') + ':' + (m[2] || '00'); cut(m[0]);
  } else if ((m = /\bat\s+(\d{1,2}):(\d{2})\b/i.exec(s)) || (m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(s))) {
    o.time = String(+m[1]).padStart(2, '0') + ':' + m[2]; cut(m[0]);
  }
  low = s.toLowerCase();
  // repeats
  if ((m = /\b(?:every|each)\s+month(?:\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?)?|\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(?:every|each)\s+month|\bmonthly(?:\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?)?/i.exec(s))) {
    o.repeat = { every: 'month', dom: +(m[1] || m[2] || m[3] || parseYmd(today()).getDate()) }; cut(m[0]);
  } else if ((m = /\b(?:every|each)\s+weekday\b|\bweekdays\b/i.exec(s))) {
    o.repeat = { every: 'weekday' }; cut(m[0]);
  } else if ((m = /\b(?:every|each)\s+((?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?(?:\s*(?:,|and|&)\s*(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?)*)\b/i.exec(s))) {
    var days = [0, 0, 0, 0, 0, 0, 0];
    m[1].toLowerCase().replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*/g, function (_, d) { days[['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(d)] = 1; });
    o.repeat = { every: 'week', days: days }; cut(m[0]);
  } else if ((m = /\b(?:every|each)\s+week\b|\bweekly\b/i.exec(s))) {
    var dd = [0, 0, 0, 0, 0, 0, 0]; dd[(parseYmd(today()).getDay() + 6) % 7] = 1; o.repeat = { every: 'week', days: dd }; cut(m[0]);
  } else if ((m = /\b(?:every|each)\s+(?:day|morning|night|evening)\b|\bdaily\b/i.exec(s))) {
    o.repeat = { every: 'day' }; cut(m[0]);
  }
  // a day
  low = s.toLowerCase();
  var t = today();
  if ((m = /\b(?:on\s+)?(today|tonight|tomorrow|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.exec(s))) {
    var w = m[1].toLowerCase();
    if (w === 'today' || w === 'tonight') o.due = t;
    else if (w === 'tomorrow') o.due = addDays(t, 1);
    else {
      var next = /^next\s+/.test(w), name = w.replace(/^next\s+/, ''), target = DOWL.map(function (x) { return x.toLowerCase(); }).indexOf(name);
      var n = (target - parseYmd(t).getDay() + 7) % 7 || 7; o.due = addDays(t, n + (next && n < 7 ? 7 : 0));
    }
    cut(m[0]);
  }
  if (o.repeat && !o.due) o.due = nextOccurrence(o.repeat, addDays(t, -1));
  // tidy the title
  var title = s.replace(/\s+(on|at|by)\s*$/i, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/^[\s,.;:-]+|[\s,;:-]+$/g, '').trim();
  o.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : String(text || '').trim();
  // area and project from the words
  var lowT = String(text || '').toLowerCase();
  areasSorted().forEach(function (a) { var key = a.name.split(/\W/)[0].toLowerCase(); if (!o.area && key.length > 2 && new RegExp('\\b' + key + '\\b').test(lowT)) o.area = a.id; });
  if (typeof projectsAll === 'function') projectsAll('active').forEach(function (p) { if (!o.project && overlap(p.t, text) >= 0.6) o.project = p.id; });
  if (o.project && !o.area) { var pr = Store.get('projects', o.project); if (pr) o.area = pr.area || null; }
  return o;
}
function words(s) { return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && ['the', 'and', 'for', 'with', 'did', 'done', 'just', 'finally', 'today'].indexOf(w) < 0; }); }
function overlap(a, b) { var wa = words(a), wb = words(b); if (!wa.length || !wb.length) return 0; var n = wa.filter(function (w) { return wb.indexOf(w) > -1; }).length; return n / Math.min(wa.length, wb.length); }

/* ── changing tasks ──────────────────────────────────────────────────
   Every change hands back an undo that restores the task exactly. */
function snapshot(id) { var t = Store.get('tasks', id); var copy = t ? JSON.parse(JSON.stringify(t)) : null; return function () { if (copy) Store.put('tasks', copy); }; }
function completeTask(id, on) {
  var t = Store.get('tasks', id); if (!t) return;
  var val = on == null ? !t.done : on;
  if (val && t.repeat) {
    // Roll forward instead of finishing.
    var from = t.due && t.due > today() ? t.due : today();
    Store.patch('tasks', id, { done: false, doneAt: null, due: nextOccurrence(t.repeat, from), drifted: false,
      doneDates: (t.doneDates || []).concat([today()]).slice(-60), lastDoneAt: Date.now(),
      steps: (t.steps || []).map(function (s) { return { t: s.t, done: false }; }) });
    logEvent('Done: ' + t.t, t.area);
    return true;
  }
  Store.patch('tasks', id, { done: val, doneAt: val ? Date.now() : null });
  if (val) logEvent('Done: ' + t.t, t.area);
  // A goal's next action, or a project's next step, done from the task list moves it on.
  var g = val && t.goal ? Store.get('goals', t.goal) : null;
  if (g && g.taskId === id) Store.patch('goals', g.id, { lastNext: g.next, next: '', taskId: null, touched: today(), sessions: (g.sessions || []).concat([today()]).slice(-400) });
  var pr = val && t.project ? Store.get('projects', t.project) : null;
  if (pr && pr.nextTask === id) {
    var data = Object.assign({}, pr.data || {}); data.log = (data.log || []).concat([{ t: 'Done: ' + pr.next, at: Date.now() }]);
    Store.patch('projects', pr.id, { lastNext: pr.next, next: '', nextTask: null, data: data, touched: today(), touchedAt: Date.now() });
  }
  return val;
}
function moveTask(id, dest) {
  var t = Store.get('tasks', id); if (!t) return;
  var d = today(), was = t.due, f = { drifted: false };
  if (dest === 'today') f.due = d;
  else if (dest === 'tomorrow') f.due = addDays(d, 1);
  else if (dest === 'nextweek') f.due = addDays(d, 7);
  else if (dest === 'next' && t.repeat) f.due = nextOccurrence(t.repeat, d);
  else if (dest === 'whenever') f.due = null;
  else if (dest === 'drifted') { f.due = null; f.drifted = true; }
  else if (/^\d{4}-\d\d-\d\d$/.test(dest)) f.due = dest;
  if (was && was < d) f.slip = { was: was, now: f.due || (f.drifted ? 'drifted' : 'whenever'), at: d };
  Store.patch('tasks', id, f);
  return f;
}
/* "Slipped, rescheduled": tasks moved off a past date in the last week. */
function rescheduled() {
  var d = today();
  return Store.all('tasks').filter(function (t) { return t.slip && !t.done && t.slip.at && dayDiff(t.slip.at, d) <= 7; })
    .sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
}

/* Play: one thing at a time. Today's timed tasks once they're within the
   hour, then today's other tasks, habits, goal next actions, then small
   "whenever" jobs. Skips go last until the end of the day. */
var playSkips = {};
function minsUntil(hm) { var n = new Date(), p = hm.split(':'); return (+p[0] * 60 + +p[1]) - (n.getHours() * 60 + n.getMinutes()); }
function playQueue() {
  var d = today(), seen = {}, q = [];
  function addTask(t, why) {
    if (!t || seen[t.id] || t.done) return; seen[t.id] = 1;
    q.push({ kind: 'task', id: t.id, ic: t.ic, t: t.t, area: t.area, why: why, est: t.est, time: t.time, tag: t.repeat ? '↻ ' + repeatLabel(t.repeat) : '' });
  }
  var todays = tasksIn('today');
  todays.filter(function (t) { return t.time && minsUntil(t.time) <= 60; }).forEach(function (t) {
    var m = minsUntil(t.time); addTask(t, m > 0 ? 'At ' + fmtTime(t.time) + ', in ' + m + ' min.' : 'It was for ' + fmtTime(t.time) + '.');
  });
  // On a shift day, big untimed jobs wait until the end; they suit an off day.
  var shiftDay = typeof isShiftDay === 'function' && isShiftDay(d), later = [];
  todays.forEach(function (t) {
    if (shiftDay && !t.time && isBigTask(t)) { later.push(t); return; }
    addTask(t, t.note ? t.note.split('\n')[0] : t.time ? 'At ' + fmtTime(t.time) + '.' : 'Due today.');
  });
  habitsDueToday().filter(function (h) { return !mark(h, d); }).forEach(function (h) {
    var s = streak(h);
    q.push({ kind: 'habit', id: h.id, ic: h.ic, t: h.n, area: h.area, why: h.cue || (s ? s + ' in a row. Keep it going.' : 'Today counts.'), est: '', tag: 'Habit' });
  });
  goalsLive().filter(function (g) { return g.next && !(g.taskId && seen[g.taskId]); }).slice(0, 2).forEach(function (g) {
    q.push({ kind: 'goal', id: g.id, ic: g.ic, t: g.next, area: g.area, why: 'Next action for ' + g.n + '.', est: '', tag: 'Goal' });
  });
  tasksIn('whenever').filter(function (t) { return /^\d+\s*min/.test(t.est || '') && parseInt(t.est, 10) <= 15; })
    .forEach(function (t) { addTask(t, 'Small. ' + t.est + ' and it is gone.'); });
  later.forEach(function (t) { var off = nextOffDay(d); addTask(t, 'Shift day. Better on ' + DOW[parseYmd(off).getDay()] + ' (off).'); });
  var skipped = playSkips[d] || {};
  return q.filter(function (x) { return !skipped[x.kind + x.id]; }).concat(q.filter(function (x) { return skipped[x.kind + x.id]; }));
}
