/* ═══ TASK RULES ═════════════════════════════════════════════════════ */
var CAP = { P1: 1, P2: 2 };

function area(id) { return id ? Store.get('areas', id) : null; }
function areaColor(id) { var a = area(id); return a ? a.color : 'var(--faint)'; }
function areasSorted() { return Store.all('areas').sort(function (a, b) { return (a.order || 99) - (b.order || 99); }); }
function doneToday(t) { return t.done && t.doneAt && ymd(new Date(t.doneAt)) === today(); }

/* Which list a task belongs in today. Nothing is ever "overdue": a past
   due date that wasn't done is "slipped" and waits for the sweep. */
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
var BUCKETS = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['later', 'Later'], ['whenever', 'Whenever'], ['drifted', 'Drifted']];

function tasksIn(b, areaFilter) {
  return Store.all('tasks').filter(function (t) {
    return bucket(t) === b && (!areaFilter || t.area === areaFilter);
  }).sort(function (a, b2) {
    if (!!a.done !== !!b2.done) return a.done ? 1 : -1;
    return (a.due || '9').localeCompare(b2.due || '9') || (a.created || 0) - (b2.created || 0);
  });
}
function slipped() { return tasksIn('slipped'); }

/* Priorities: at most 1 P1 and 2 P2 per day. */
function prios() {
  var d = today();
  return Store.all('tasks').filter(function (t) { return t.prio && t.prioDay === d; })
    .sort(function (a, b) { return a.prio.localeCompare(b.prio) || (a.prioAt || 0) - (b.prioAt || 0); });
}
function prioCount(level) { return prios().filter(function (t) { return t.prio === level; }).length; }
function candidates() {
  var d = today();
  return Store.all('tasks').filter(function (t) { return !t.done && t.cand === d && !(t.prio && t.prioDay === d); });
}
function setPrio(id, level) {
  var t = Store.get('tasks', id); if (!t) return;
  Store.patch('tasks', id, { prio: level, prioDay: level ? today() : null, prioAt: Date.now(), cand: null,
    due: level ? today() : t.due, drifted: level ? false : t.drifted });
  if (level) logEvent('Set ' + level + ': ' + t.t, t.area);
}
function swapOut(id) {
  var t = Store.get('tasks', id); if (!t) return;
  Store.patch('tasks', id, { prio: null, prioDay: null, cand: addDays(today(), 1) });
}

function completeTask(id, on) {
  var t = Store.get('tasks', id); if (!t) return;
  var val = on == null ? !t.done : on;
  Store.patch('tasks', id, { done: val, doneAt: val ? Date.now() : null });
  if (val) logEvent('Done: ' + t.t, t.area);
  return val;
}
function moveTask(id, dest) {
  var t = Store.get('tasks', id); if (!t) return;
  var d = today(), was = t.due, f = { drifted: false };
  if (dest === 'today') f.due = d;
  else if (dest === 'tomorrow') f.due = addDays(d, 1);
  else if (dest === 'nextweek') f.due = addDays(d, 7);
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

/* Play: one thing at a time. Priorities first, then the rest of today,
   then small "whenever" jobs. Skips last until the end of the day. */
var playSkips = {};
function playQueue() {
  var d = today(), seen = {}, q = [];
  function add(t, why) { if (!t || seen[t.id] || t.done) return; seen[t.id] = 1; q.push({ task: t, why: why }); }
  prios().forEach(function (t) { add(t, t.prio === 'P1' ? 'Your one P1 today.' : 'One of your two P2s today.'); });
  tasksIn('today').forEach(function (t) { add(t, t.note ? t.note.split('\n')[0] : 'Due today.'); });
  tasksIn('whenever').filter(function (t) { return /^\d+\s*min/.test(t.est || '') && parseInt(t.est, 10) <= 15; })
    .forEach(function (t) { add(t, 'Small. ' + t.est + ' and it is gone.'); });
  var skipped = playSkips[d] || {};
  return q.filter(function (x) { return !skipped[x.task.id]; }).concat(q.filter(function (x) { return skipped[x.task.id]; }));
}
