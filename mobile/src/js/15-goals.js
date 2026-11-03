/* ═══ GOALS ═════════════════════════════════════════════════════════
   Rebuilt from Miles's demo. A goal shows one next action and nothing
   else actionable. It never turns red, never reports a percentage
   behind, and going quiet produces no event. The bars record what
   happened (sessions), not a target being missed. */
var GOAL_RULES = 'A goal shows one next action and nothing else actionable. It never turns red, never reports a percentage behind, and going quiet for three weeks produces no event at all. The bar is a record of what happened, not a target you are missing.';
var GOAL_COLORS = ['#B48EF7', '#7AA2F7', '#5FCF8E', '#E8A33D', '#F27BA8', '#3CC4B4', '#F08A4B', '#E2B64B'];
function goalsLive() { return Store.all('goals').filter(function (g) { return g.status !== 'done'; }).sort(function (a, b) { return (a.created || 0) - (b.created || 0); }); }
function goalColor(g) { return g.color || areaColor(g.area) || '#5FCF8E'; }
/* A session: a next action done, a step ticked, or a linked task finished. */
function addSession(id) {
  var g = Store.get('goals', id); if (!g) return;
  Store.patch('goals', id, { sessions: (g.sessions || []).concat([today()]).slice(-400), touched: today() });
}
function weekCounts(g) {
  var t = today(), mon = addDays(t, -wd(t));
  return range(7).map(function (i) {
    var start = addDays(mon, (i - 6) * 7), end = addDays(start, 6);
    return { start: start, n: (g.sessions || []).filter(function (d) { return d >= start && d <= end; }).length };
  });
}
function goalWhen(g) { return g.due ? (/^ongoing$/i.test(g.due) ? 'ongoing' : 'by ' + g.due) : 'ongoing'; }

TITLES.goals = 'Goals';
VIEWS.goals = function () {
  var live = goalsLive(), done = Store.all('goals').filter(function (g) { return g.status === 'done'; });
  var wk = addDays(today(), -7), touched = live.filter(function (g) { return g.touched && g.touched >= wk; }).length;
  var h = '<p class="note">' + (live.length ? (live.length === 1 ? 'One live.' : numWord(live.length) + ' live.') + ' ' : '') + 'Each one owns a colour, and each one has exactly one next action, never a plan.</p>';
  h += '<div class="stats3">' + [['Live', live.length], ['Next actions ready', live.filter(function (g) { return g.next; }).length], ['Touched this week', touched]]
    .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
  if (!live.length) h += '<div class="empty">No live goals. A goal here is a direction plus one next action.</div>';
  h += '<div class="goals">' + live.map(function (g) {
    return '<button class="goal2" style="--c:' + esc(goalColor(g)) + '" data-act="open" data-v="goal" data-id="' + g.id + '">'
      + '<div class="gcov"><span class="gi">' + esc(g.ic || '🎯') + '</span>' + (g.area ? '<span class="pill">' + esc(areaName(g.area)) + '</span>' : '') + '</div>'
      + '<div class="gb"><b>' + esc(g.n) + ' ' + exPill(g) + '</b>'
      + (g.why ? '<span class="gw">' + esc(g.why) + '</span>' : '')
      + '<span class="gnext"><span>Next</span>' + esc(g.next || 'Nothing set yet') + '</span></div></button>';
  }).join('') + '</div>';
  h += '<button class="btn soft block" data-act="newgoal">' + icon('plus', 'sm') + 'New goal</button>';
  h += '<details class="card"><summary class="muted" style="cursor:pointer">How goals behave here</summary><p class="note" style="margin-top:8px">' + esc(GOAL_RULES) + '</p></details>';
  if (done.length) h += '<details class="card"><summary class="muted" style="cursor:pointer">Finished · ' + done.length + '</summary><div class="list" style="margin-top:8px">'
    + done.map(function (g) { return '<button class="row" data-act="open" data-v="goal" data-id="' + g.id + '"><span class="ic">' + esc(g.ic || '🎯') + '</span><span class="grow t">' + esc(g.n) + '</span></button>'; }).join('') + '</div></details>';
  return h;
};
function numWord(n) { return ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][n] || String(n); }

TITLES.goal = 'Goal';
VIEWS.goal = function (id) {
  var g = Store.get('goals', id); if (!g) return '<div class="empty">This goal was deleted.</div>';
  var steps = g.steps || [], task = g.taskId ? Store.get('tasks', g.taskId) : null, wk = weekCounts(g);
  var total = wk.reduce(function (s, w) { return s + w.n; }, 0), max = Math.max(1, wk.reduce(function (m, w) { return Math.max(m, w.n); }, 0));
  var h = '<div class="gcov big" style="--c:' + esc(goalColor(g)) + '"><span class="gi">' + esc(g.ic || '🎯') + '</span></div>'
    + '<div style="display:grid;gap:4px"><label class="sr" for="gn">Goal</label><input id="gn" class="input titlein" data-gfield="n" value="' + esc(g.n) + '">'
    + '<div class="small muted">' + (g.area ? areaDot(g.area) + ' ' + esc(areaName(g.area)) + ' · ' : '') + esc(goalWhen(g)) + ' ' + exPill(g) + (g.status === 'done' ? ' <span class="pill">Finished</span>' : '') + '</div></div>';
  h += '<div class="nextcard" style="--c:' + esc(goalColor(g)) + '"><span class="lbl">The one next action</span><div class="t">' + esc(g.next || 'Nothing set') + '</div>'
    + (task && !task.done ? '<p class="note small">On your task list for ' + esc(task.due ? shortDate(task.due) : 'Someday') + '.</p>' : '')
    + '<div class="btnrow">' + (g.next ? '<button class="btn accent" data-act="goalnextdone" data-id="' + id + '">Done</button>'
      + '<button class="btn soft" data-act="goalelse" data-id="' + id + '">Something else</button>'
      : '<button class="btn accent" data-act="goalelse" data-id="' + id + '">Set the next action</button>') + '</div>'
    + (g.next && !(task && !task.done) ? '<button class="link" style="justify-self:start" data-act="goaltask" data-id="' + id + '">Put it on today</button>' : '') + '</div>';
  h += '<section><div class="sechead"><h2>Last seven weeks</h2></div><div class="weeks" role="img" aria-label="' + total + ' sessions across seven weeks">'
    + wk.map(function (w, i) {
      return '<div class="wk1"><i style="height:' + Math.max(6, Math.round(w.n / max * 100)) + '%"></i><span>' + (i === 6 ? 'now' : shortWeek(w.start)) + '</span><b>' + (w.n || '') + '</b></div>';
    }).join('') + '</div><p class="note small">' + total + ' session' + (total === 1 ? '' : 's') + ' across seven weeks. No week is marked as a failure.</p></section>';
  h += '<section class="steps"><div class="sechead"><h2>Steps</h2></div><div class="list">'
    + steps.map(function (s, i) {
      return '<div class="row' + (s.done ? ' done' : '') + '"><button class="ck' + (s.done ? ' on' : '') + '" data-act="gstep" data-id="' + id + '" data-i="' + i + '" aria-label="Toggle step"><span></span></button>'
        + '<span class="grow t">' + esc(s.t) + '</span><button class="iconbtn" data-act="gdelstep" data-id="' + id + '" data-i="' + i + '" aria-label="Remove step">' + icon('x', 'sm') + '</button></div>';
    }).join('') + '</div><form class="addstep" data-form="gaddstep" data-id="' + id + '"><label class="sr" for="gnewstep">New step</label><input id="gnewstep" class="input" placeholder="Add a step" autocomplete="off"><button class="btn soft" type="submit">Add</button></form></section>';
  h += '<div class="field"><label for="gwhy">Why this matters</label><textarea id="gwhy" class="input" style="min-height:80px" data-gfield="why">' + esc(g.why || '') + '</textarea></div>';
  h += '<details class="card"><summary class="muted" style="cursor:pointer">Edit</summary><div class="props" style="margin-top:8px">'
    + '<div class="prop"><span class="k">Colour</span><span class="v">' + GOAL_COLORS.map(function (c) {
      return '<button class="swatch' + (goalColor(g) === c ? ' on' : '') + '" style="background:' + c + '" data-act="goalcolor" data-id="' + id + '" data-c="' + c + '" aria-label="Colour ' + c + '"></button>';
    }).join('') + '</span></div>'
    + '<div class="prop"><span class="k">Area</span><span class="v">' + areasSorted().map(function (a) {
      return '<button class="chip' + (g.area === a.id ? ' on' : '') + '" data-act="goalarea" data-id="' + id + '" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</span></div>'
    + '<div class="prop"><span class="k">By when</span><span class="v"><label class="sr" for="gdue">By when</label><input id="gdue" class="input" style="max-width:200px;min-height:40px" data-gfield="due" value="' + esc(g.due || '') + '" placeholder="Dec, or ongoing"></span></div>'
    + '<div class="prop"><span class="k">Icon</span><span class="v"><label class="sr" for="gic">Icon</label><input id="gic" class="input" style="max-width:80px;min-height:40px;text-align:center" maxlength="4" data-gfield="ic" value="' + esc(g.ic || '') + '"></span></div>'
    + '</div></details>'
    + '<div class="btnrow">' + (g.status === 'done' ? '<button class="btn soft" data-act="goalstatus" data-id="' + id + '" data-s="live">Bring it back</button>'
      : '<button class="btn soft" data-act="goalstatus" data-id="' + id + '" data-s="done">Mark finished</button>')
    + '<button class="btn ghost" style="color:var(--bad)" data-act="delgoal" data-id="' + id + '">Delete</button></div>';
  return h;
};
function shortWeek(s) { var d = parseYmd(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
VIEWS.goal.after = function (id) {
  $$('[data-gfield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.gfield] = el.value; Store.patch('goals', id, f); });
  });
};
function touchGoal(id, f) { f.touched = today(); return Store.patch('goals', id, f); }
ACTS.gstep = function (d) {
  var g = Store.get('goals', d.id), s = (g.steps || []).slice(); s[+d.i] = Object.assign({}, s[+d.i], { done: !s[+d.i].done });
  touchGoal(d.id, { steps: s });
  if (s[+d.i].done) { addSession(d.id); logEvent(g.n + ': ' + s[+d.i].t, g.area); }
};
ACTS.gdelstep = function (d) { var g = Store.get('goals', d.id), s = (g.steps || []).slice(); s.splice(+d.i, 1); Store.patch('goals', d.id, { steps: s }); };
ACTS.form_gaddstep = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return;
  var g = Store.get('goals', d.id); inp.value = '';
  touchGoal(d.id, { steps: (g.steps || []).concat([{ t: v, done: false }]) }); render(false, true);
  var n = $('#gnewstep'); if (n) n.focus();
};
ACTS.goalarea = function (d) { var g = Store.get('goals', d.id); Store.patch('goals', d.id, { area: g.area === d.a ? null : d.a }); };
ACTS.goalcolor = function (d) { Store.patch('goals', d.id, { color: d.c }); };
ACTS.goalstatus = function (d) {
  var g = Store.get('goals', d.id); touchGoal(d.id, { status: d.s });
  if (d.s === 'done') { logEvent('Finished a goal: ' + g.n, g.area); toast('Finished. That counts.'); }
};
ACTS.delgoal = function (d) { var g = Store.get('goals', d.id); Store.del('goals', d.id); pop(); toast('Goal deleted', function () { Store.put('goals', g); }); };
ACTS.goaltask = function (d) {
  var g = Store.get('goals', d.id);
  var t = Store.put('tasks', { t: g.next, ic: g.ic || '', area: g.area || null, due: today(), done: false, steps: [], note: 'Next action for: ' + g.n, goal: g.id });
  touchGoal(d.id, { taskId: t.id }); logEvent('Next action on today: ' + g.next, g.area); toast('On today\'s list');
};
/* Done: a session is recorded, then you name the next action. */
ACTS.goalnextdone = function (d) {
  var g = Store.get('goals', d.id);
  if (g.next) {
    logEvent(g.n + ': ' + g.next, g.area);
    var t = g.taskId ? Store.get('tasks', g.taskId) : null;
    // Ticking the linked task records the session and clears the action.
    if (t && !t.done) completeTask(t.id, true);
    else { touchGoal(d.id, { lastNext: g.next, next: '', taskId: null }); addSession(d.id); }
  }
  nextSheet(d.id, 'What\'s next?', 'One concrete thing you could start in the next day. Not a plan.');
};
/* Something else: swap the next action for another, no penalty. */
ACTS.goalelse = function (d) {
  var g = Store.get('goals', d.id);
  nextSheet(d.id, g.next ? 'Something else' : 'Next action', g.next ? 'Swap it for something you\'d rather do. Nothing is logged as missed.' : 'One concrete thing you could start in the next day.');
};
function nextSheet(id, title, sub) {
  var g = Store.get('goals', id), open = (g.steps || []).filter(function (s) { return !s.done && s.t !== g.next; });
  openSheet('<div class="shead"><h2>' + esc(title) + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<p class="note">' + esc(g.n) + '. ' + esc(sub) + '</p>'
    + (open.length ? '<div class="lbl">From your steps</div><div class="list">' + open.map(function (s) {
      return '<button class="row" data-act="goalpick" data-id="' + id + '" data-t="' + esc(s.t) + '"><span class="grow t">' + esc(s.t) + '</span>' + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div>' : '')
    + '<form class="addstep" data-form="goalnext" data-id="' + id + '"><label class="sr" for="gnext">Next action</label><input id="gnext" class="input" autocomplete="off" placeholder="Or type one"><button class="btn accent" type="submit">Set</button></form>',
    function (s) { if (!open.length) $('#gnext', s).focus(); });
}
ACTS.form_goalnext = function (d, f) {
  var v = $('input', f).value.trim(); if (!v) return;
  touchGoal(d.id, { next: v, taskId: null }); closeSheet(); toast('Next action set');
};
ACTS.goalpick = function (d) { touchGoal(d.id, { next: d.t, taskId: null }); closeSheet(); toast('Next action set'); };
ACTS.newgoal = function () {
  var used = Store.all('goals').map(goalColor), c = GOAL_COLORS.filter(function (x) { return used.indexOf(x) < 0; })[0] || GOAL_COLORS[0];
  var g = Store.put('goals', { n: 'New goal', ic: '🎯', why: '', steps: [], next: '', area: null, color: c, status: 'live', sessions: [], touched: today() });
  push('goal', g.id); setTimeout(function () { var e = $('#gn'); if (e) { e.focus(); e.select(); } }, 50);
};
