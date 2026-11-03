/* ═══ GOALS ═════════════════════════════════════════════════════════
   Each goal has a why, steps (which give its progress) and exactly one
   next action. The next action feeds the Play card. */
function goalPct(g) {
  var s = g.steps || [];
  if (s.length) return Math.round(s.filter(function (x) { return x.done; }).length / s.length * 100);
  return g.pct || 0;
}
function goalsLive() { return Store.all('goals').filter(function (g) { return g.status !== 'done'; }).sort(function (a, b) { return (a.created || 0) - (b.created || 0); }); }

TITLES.goals = 'Goals';
VIEWS.goals = function () {
  var live = goalsLive(), done = Store.all('goals').filter(function (g) { return g.status === 'done'; });
  var week = addDays(today(), -7), touched = live.filter(function (g) { return g.touched && g.touched >= week; }).length;
  var avg = live.length ? Math.round(live.reduce(function (s, g) { return s + goalPct(g); }, 0) / live.length) : 0;
  var h = '<div class="stats4">' + [['Live', live.length], ['Next ready', live.filter(function (g) { return g.next; }).length], ['Touched this week', touched], ['Average', avg + '%']]
    .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
  if (!live.length) h += '<div class="empty">No live goals. A goal here is a direction plus one next action, never a plan.</div>';
  h += '<div class="goals">' + live.map(function (g) {
    var p = goalPct(g);
    return '<button class="goal" style="--c:' + esc(areaColor(g.area)) + '" data-act="open" data-v="goal" data-id="' + g.id + '">'
      + '<div class="gh"><span class="gic">' + esc(g.ic || '🎯') + '</span><span class="grow"><b>' + esc(g.n) + '</b>'
      + '<span class="s">' + (g.area ? areaDot(g.area) + esc(areaName(g.area)) : '') + (g.due ? (/^ongoing$/i.test(g.due) ? ' · ongoing' : ' · by ' + esc(g.due)) : '') + ' ' + exPill(g) + '</span></span><span class="gp">' + p + '%</span></div>'
      + '<div class="bar"><i style="width:' + p + '%"></i></div>'
      + '<div class="gnext"><span>Next</span>' + esc(g.next || 'No next action yet') + '</div></button>';
  }).join('') + '</div>';
  h += '<button class="btn soft block" data-act="newgoal">' + icon('plus', 'sm') + 'New goal</button>';
  if (done.length) h += '<details class="card"><summary class="muted" style="cursor:pointer">Finished · ' + done.length + '</summary><div class="list" style="margin-top:8px">'
    + done.map(function (g) { return '<button class="row" data-act="open" data-v="goal" data-id="' + g.id + '"><span class="ic">' + esc(g.ic || '🎯') + '</span><span class="grow t">' + esc(g.n) + '</span></button>'; }).join('') + '</div></details>';
  return h;
};

TITLES.goal = 'Goal';
VIEWS.goal = function (id) {
  var g = Store.get('goals', id); if (!g) return '<div class="empty">This goal was deleted.</div>';
  var p = goalPct(g), steps = g.steps || [];
  var task = g.taskId ? Store.get('tasks', g.taskId) : null;
  var h = '<div class="dhead"><div class="ic">' + esc(g.ic || '🎯') + '</div><div style="flex:1;min-width:0;display:grid;gap:6px">'
    + '<label class="sr" for="gn">Goal</label><input id="gn" class="input" style="font-size:19px;font-weight:500" data-gfield="n" value="' + esc(g.n) + '">'
    + '<div class="btnrow">' + exPill(g) + (g.status === 'done' ? '<span class="pill">Finished</span>' : '') + '</div></div></div>'
    + '<div><div class="bar big" style="--c:' + esc(areaColor(g.area)) + '"><i style="width:' + p + '%"></i></div><div class="small faint" style="margin-top:6px">' + p + '% · '
    + (steps.length ? steps.filter(function (s) { return s.done; }).length + ' of ' + steps.length + ' steps' : 'set progress by adding steps') + '</div></div>';
  h += '<div class="nextcard"><span class="lbl">Next action</span><div class="t">' + esc(g.next || 'Nothing set') + '</div>'
    + (task && !task.done ? '<p class="note small">It\'s on your task list for ' + esc(task.due ? shortDate(task.due) : 'whenever') + '.</p>' : '')
    + '<div class="btnrow">' + (g.next ? '<button class="btn accent" data-act="goalnextdone" data-id="' + id + '">Done, what\'s next?</button>'
      + (task && !task.done ? '' : '<button class="btn soft" data-act="goaltask" data-id="' + id + '">Put it on today</button>')
      : '<button class="btn accent" data-act="goalnextdone" data-id="' + id + '">Set the next action</button>') + '</div></div>';
  h += '<div class="field"><label for="gwhy">Why it matters</label><textarea id="gwhy" class="input" style="min-height:80px" data-gfield="why">' + esc(g.why || '') + '</textarea></div>';
  h += '<section class="steps"><div class="sechead"><h2>Steps</h2><span class="meta">' + steps.filter(function (s) { return s.done; }).length + '/' + steps.length + '</span></div><div class="list">'
    + steps.map(function (s, i) {
      return '<div class="row' + (s.done ? ' done' : '') + '"><button class="ck' + (s.done ? ' on' : '') + '" data-act="gstep" data-id="' + id + '" data-i="' + i + '" aria-label="Toggle step"><span></span></button>'
        + '<span class="grow t">' + esc(s.t) + '</span><button class="iconbtn" data-act="gdelstep" data-id="' + id + '" data-i="' + i + '" aria-label="Remove step">' + icon('x', 'sm') + '</button></div>';
    }).join('') + '</div><form class="addstep" data-form="gaddstep" data-id="' + id + '"><label class="sr" for="gnewstep">New step</label><input id="gnewstep" class="input" placeholder="Add a step" autocomplete="off"><button class="btn soft" type="submit">Add</button></form></section>';
  h += '<section><div class="sechead"><h2>Details</h2></div><div class="props">'
    + '<div class="prop"><span class="k">Area</span><span class="v">' + areasSorted().map(function (a) {
      return '<button class="chip' + (g.area === a.id ? ' on' : '') + '" data-act="goalarea" data-id="' + id + '" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</span></div>'
    + '<div class="prop"><span class="k">By when</span><span class="v"><label class="sr" for="gdue">By when</label><input id="gdue" class="input" style="max-width:200px;min-height:40px" data-gfield="due" value="' + esc(g.due || '') + '" placeholder="e.g. Dec, or ongoing"></span></div>'
    + '<div class="prop"><span class="k">Icon</span><span class="v"><label class="sr" for="gic">Icon</label><input id="gic" class="input" style="max-width:80px;min-height:40px;text-align:center" maxlength="4" data-gfield="ic" value="' + esc(g.ic || '') + '"></span></div>'
    + '</div></section>'
    + '<div class="btnrow">' + (g.status === 'done' ? '<button class="btn soft" data-act="goalstatus" data-id="' + id + '" data-s="live">Bring it back</button>'
      : '<button class="btn soft" data-act="goalstatus" data-id="' + id + '" data-s="done">Mark finished</button>')
    + '<button class="btn ghost" style="color:var(--bad)" data-act="delgoal" data-id="' + id + '">Delete</button></div>';
  return h;
};
VIEWS.goal.after = function (id) {
  $$('[data-gfield]').forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.gfield] = el.value; Store.patch('goals', id, f); });
  });
};
function touchGoal(id, f) { f.touched = today(); return Store.patch('goals', id, f); }
ACTS.gstep = function (d) {
  var g = Store.get('goals', d.id), s = (g.steps || []).slice(); s[+d.i] = Object.assign({}, s[+d.i], { done: !s[+d.i].done });
  touchGoal(d.id, { steps: s }); if (s[+d.i].done) logEvent(g.n + ': ' + s[+d.i].t, g.area);
};
ACTS.gdelstep = function (d) { var g = Store.get('goals', d.id), s = (g.steps || []).slice(); s.splice(+d.i, 1); Store.patch('goals', d.id, { steps: s }); };
ACTS.form_gaddstep = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return;
  var g = Store.get('goals', d.id); inp.value = '';
  touchGoal(d.id, { steps: (g.steps || []).concat([{ t: v, done: false }]) }); render(false, true);
  var n = $('#gnewstep'); if (n) n.focus();
};
ACTS.goalarea = function (d) { var g = Store.get('goals', d.id); Store.patch('goals', d.id, { area: g.area === d.a ? null : d.a }); };
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
/* Finishing a next action asks for the next one. Claude can suggest it. */
ACTS.goalnextdone = function (d) {
  var g = Store.get('goals', d.id), had = !!g.next;
  if (had) {
    logEvent(g.n + ': ' + g.next, g.area);
    var t = g.taskId ? Store.get('tasks', g.taskId) : null; if (t && !t.done) completeTask(t.id, true);
    touchGoal(d.id, { lastNext: g.next, next: '', taskId: null });
  }
  openSheet('<div class="shead"><h2>' + (had ? 'Nice. What\'s next?' : 'Next action') + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<p class="note">' + esc(g.n) + '. One concrete thing you could start in the next day, not a plan.</p>'
    + '<form class="addstep" data-form="goalnext" data-id="' + d.id + '"><label class="sr" for="gnext">Next action</label><input id="gnext" class="input" autocomplete="off" placeholder="e.g. Email the recruiter"><button class="btn accent" type="submit">Set</button></form>'
    + (AI.ready ? '<button class="btn ghost" data-act="goalsuggest" data-id="' + d.id + '">' + icon('sparkle', 'sm') + 'Suggest one with Claude</button>' : '')
    + '<div id="gsugg"></div>', function (s) { $('#gnext', s).focus(); });
};
ACTS.form_goalnext = function (d, f) {
  var v = $('input', f).value.trim(); if (!v) return;
  touchGoal(d.id, { next: v }); closeSheet(); toast('Next action set');
};
ACTS.goalsuggest = function (d, el) {
  var g = Store.get('goals', d.id); el.disabled = true; el.innerHTML = icon('sparkle', 'sm') + 'Thinking…';
  aiJson('Suggest three possible next actions for this personal goal. Each must be concrete, startable within a day, and take under an hour. '
    + 'Goal: "' + g.n + '". Why: "' + (g.why || '') + '". Steps (done marked): ' + JSON.stringify((g.steps || []).map(function (s) { return (s.done ? '[x] ' : '[ ] ') + s.t; }))
    + '. Last action finished: "' + (g.lastNext || 'none') + '". Reply with JSON only: {"options":["…","…","…"]}, each under 70 characters.')
    .then(function (r) {
      var opts = (r && r.options || []).filter(function (x) { return typeof x === 'string'; }).slice(0, 3);
      el.hidden = true;
      $('#gsugg').innerHTML = '<div class="list">' + opts.map(function (o) {
        return '<button class="row" data-act="goalpick" data-id="' + d.id + '" data-t="' + esc(o) + '"><span class="grow t">' + esc(o) + '</span></button>';
      }).join('') + '</div>';
    }).catch(function (e) { el.disabled = false; el.innerHTML = icon('sparkle', 'sm') + 'Suggest one with Claude'; toast(aiError(e)); });
};
ACTS.goalpick = function (d) { touchGoal(d.id, { next: d.t }); closeSheet(); toast('Next action set'); };
ACTS.newgoal = function () {
  var g = Store.put('goals', { n: 'New goal', ic: '🎯', why: '', steps: [], next: '', area: null, status: 'live', touched: today() });
  push('goal', g.id); setTimeout(function () { var e = $('#gn'); if (e) { e.focus(); e.select(); } }, 50);
};
