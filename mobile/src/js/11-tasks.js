/* ═══ TASKS ═════════════════════════════════════════════════════════ */
var taskFilter = null;
TITLES.tasks = 'Tasks';
VIEWS.tasks = function () {
  var open = Store.all('tasks').filter(function (t) { return !t.done; });
  var h = '<div class="scrollx" role="group" aria-label="Filter by area"><button class="chip' + (!taskFilter ? ' on' : '') + '" data-act="tfilter" data-id="">All · ' + open.length + '</button>'
    + areasSorted().map(function (a) {
      var n = open.filter(function (t) { return t.area === a.id; }).length;
      return '<button class="chip' + (taskFilter === a.id ? ' on' : '') + '" data-act="tfilter" data-id="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + (n ? ' · ' + n : '') + '</button>';
    }).join('') + '</div>';
  var sl = slipped().filter(function (t) { return !taskFilter || t.area === taskFilter; });
  if (sl.length) h += '<button class="sweepbar" data-act="open" data-v="sweep">' + icon('broom') + '<span class="grow"><b style="font-weight:500">'
    + sl.length + ' slipped</b><span class="muted small"> · sweep them onto real days</span></span>' + icon('chev', 'sm chev') + '</button>';
  var any = false;
  BUCKETS.forEach(function (b) {
    var list = tasksIn(b[0], taskFilter);
    if (!list.length) return; any = true;
    h += '<section><div class="grouph">' + b[1] + ' <span class="c">' + list.filter(function (t) { return !t.done; }).length + '</span><span class="ln"></span></div>'
      + '<div class="list">' + list.map(taskRow).join('') + '</div></section>';
  });
  var wk = Date.now() - 7 * 864e5;
  var older = Store.all('tasks').filter(function (t) { return bucket(t) === 'done' && t.doneAt > wk && (!taskFilter || t.area === taskFilter); })
    .sort(function (a, b) { return b.doneAt - a.doneAt; });
  if (older.length) h += '<details class="donegrp"><summary>Done this week · ' + older.length + '</summary><div class="list">' + older.map(taskRow).join('') + '</div></details>';
  if (!any && !sl.length) h += '<div class="empty">No tasks' + (taskFilter ? ' in ' + esc(areaName(taskFilter)) : '') + '. Tap ＋ to capture one.</div>';
  h += '<button class="btn soft block" data-act="newtask">' + icon('plus', 'sm') + 'New task</button>';
  return h;
};
function taskRow(t) {
  var steps = t.steps || [], sd = steps.filter(function (s) { return s.done; }).length;
  var meta = [];
  if (t.area) meta.push(areaDot(t.area) + esc(areaName(t.area)));
  if (t.prio && t.prioDay === today()) meta.push('<span class="pill ' + t.prio.toLowerCase() + '">' + t.prio + '</span>');
  if (t.due && bucket(t) !== 'today') meta.push(esc(shortDate(t.due)));
  if (t.est) meta.push(esc(t.est));
  if (steps.length) meta.push(sd + '/' + steps.length + ' steps');
  return '<div class="row' + (t.done ? ' done' : '') + '">'
    + '<button class="ck' + (t.done ? ' on' : '') + '" data-act="toggle" data-id="' + t.id + '" aria-label="' + (t.done ? 'Mark not done' : 'Mark done') + '"><span></span></button>'
    + '<button class="grow" style="text-align:left" data-act="open" data-v="task" data-id="' + t.id + '"><div class="t">' + esc(t.ic ? t.ic + ' ' : '') + esc(t.t) + '</div>'
    + '<div class="s">' + meta.join('<span class="faint">·</span>') + ' ' + exPill(t) + '</div></button></div>';
}
ACTS.tfilter = function (d) { taskFilter = d.id || null; render(); };
ACTS.newtask = function () {
  var t = Store.put('tasks', { t: 'New task', ic: '', area: taskFilter, due: today(), done: false, steps: [], note: '' });
  push('task', t.id);
  setTimeout(function () { var el = $('#ttitle'); if (el) { el.focus(); el.select(); } }, 50);
};

/* ── task detail ───────────────────────────────────────────────────── */
TITLES.task = function (id) { var t = Store.get('tasks', id); return t ? (areaName(t.area) || 'Task') : 'Task'; };
VIEWS.task = function (id) {
  var t = Store.get('tasks', id);
  if (!t) return '<div class="empty">This task was deleted.</div>';
  var d = today(), isP = t.prio && t.prioDay === d, steps = t.steps || [];
  var whenChips = [['today', 'Today', t.due === d], ['tomorrow', 'Tomorrow', t.due === addDays(d, 1)], ['nextweek', 'Next week', t.due === addDays(d, 7)],
    ['whenever', 'Whenever', !t.due && !t.drifted], ['drifted', 'Drifted', !!t.drifted]];
  var h = '<div class="dhead"><div class="ic">' + esc(t.ic || '•') + '</div><div style="flex:1;min-width:0;display:grid;gap:6px">'
    + '<label class="sr" for="ttitle">Task name</label><input id="ttitle" class="input" style="font-size:19px;font-weight:500" value="' + esc(t.t) + '" data-field="t">'
    + '<div class="btnrow">' + exPill(t) + (t.done ? '<span class="pill">Done ' + esc(t.doneAt ? shortDate(ymd(new Date(t.doneAt))) : '') + '</span>' : '') + '</div></div></div>';

  h += '<div class="btnrow">'
    + (t.done ? '<button class="btn soft" data-act="toggle" data-id="' + t.id + '">Mark not done</button>'
      : '<button class="btn accent" data-act="startthis" data-id="' + t.id + '">Start this</button><button class="btn soft" data-act="toggle" data-id="' + t.id + '">Done</button>')
    + '</div>';

  // Notes before steps.
  h += '<section><div class="sechead"><h2>Notes</h2></div><label class="sr" for="tnote">Notes</label>'
    + '<textarea id="tnote" class="input" data-field="note" placeholder="What you know so far, where you left off…">' + esc(t.note || '') + '</textarea></section>';

  h += '<section class="steps"><div class="sechead"><h2>Steps</h2><span class="meta">' + steps.filter(function (s) { return s.done; }).length + '/' + steps.length + '</span></div>'
    + '<div class="list">' + steps.map(function (s, i) {
      return '<div class="row' + (s.done ? ' done' : '') + '"><button class="ck' + (s.done ? ' on' : '') + '" data-act="step" data-id="' + t.id + '" data-i="' + i + '" aria-label="Toggle step"><span></span></button>'
        + '<span class="grow t">' + esc(s.t) + '</span><button class="iconbtn" data-act="delstep" data-id="' + t.id + '" data-i="' + i + '" aria-label="Remove step">' + icon('x', 'sm') + '</button></div>';
    }).join('') + '</div>'
    + '<form class="addstep" data-form="addstep" data-id="' + t.id + '"><label class="sr" for="newstep">New step</label><input id="newstep" class="input" placeholder="Add a step" autocomplete="off">'
    + '<button class="btn soft" type="submit">Add</button></form>'
    + '<button class="btn ghost block" style="margin-top:10px" data-act="breakdown" data-id="' + t.id + '"' + (AI.ready ? '' : ' disabled title="Needs Claude: open MossOS in the Claude app"') + '>'
    + icon('sparkle', 'sm') + 'Break it down with Claude</button></section>';

  h += '<section><div class="sechead"><h2>Details</h2></div><div class="props">'
    + '<div class="prop"><span class="k">When</span><span class="v">' + whenChips.map(function (c) {
      return '<button class="chip' + (c[2] ? ' on' : '') + '" data-act="when" data-id="' + t.id + '" data-to="' + c[0] + '">' + c[1] + '</button>';
    }).join('') + '<label class="chip" style="position:relative">Pick a day<input type="date" data-act-change="whendate" data-id="' + t.id + '" style="position:absolute;inset:0;opacity:0" aria-label="Pick a day"></label>'
    + (t.due && whenChips.every(function (c) { return !c[2]; }) ? '<span class="pill">' + esc(shortDate(t.due)) + '</span>' : '') + '</span></div>'
    + '<div class="prop"><span class="k">Priority</span><span class="v">' + ['P1', 'P2'].map(function (l) {
      return '<button class="chip' + (isP && t.prio === l ? ' on' : '') + '" data-act="taskprio" data-id="' + t.id + '" data-l="' + l + '">' + l + ' today</button>';
    }).join('') + (isP ? '<button class="chip" data-act="taskprio" data-id="' + t.id + '" data-l="">None</button>' : '') + '</span></div>'
    + '<div class="prop"><span class="k">Area</span><span class="v">' + areasSorted().map(function (a) {
      return '<button class="chip' + (t.area === a.id ? ' on' : '') + '" data-act="taskarea" data-id="' + t.id + '" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</span></div>'
    + '<div class="prop"><span class="k">Time</span><span class="v"><label class="sr" for="test">Time estimate</label><input id="test" class="input" style="max-width:160px;min-height:40px" data-field="est" value="' + esc(t.est || '') + '" placeholder="e.g. 20 min"></span></div>'
    + '<div class="prop"><span class="k">Icon</span><span class="v"><label class="sr" for="tic">Icon</label><input id="tic" class="input" style="max-width:80px;min-height:40px;text-align:center" data-field="ic" value="' + esc(t.ic || '') + '" maxlength="4"></span></div>'
    + '</div></section>';
  if (t.slip) h += '<p class="note">Slipped from ' + esc(shortDate(t.slip.was)) + ', moved to ' + esc(t.slip.now === 'drifted' ? 'Drifted' : t.slip.now === 'whenever' ? 'Whenever' : shortDate(t.slip.now)) + '.</p>';
  h += '<button class="btn ghost" style="color:var(--bad);justify-self:start" data-act="deltask" data-id="' + t.id + '">Delete task</button>';
  return h;
};
VIEWS.task.after = function (id) {
  $$('[data-field]', $('#view')).forEach(function (el) {
    el.addEventListener('input', function () { var f = {}; f[el.dataset.field] = el.value; Store.patch('tasks', id, f); });
  });
};
document.addEventListener('change', function (e) {
  var el = e.target.closest('[data-act-change]'); if (!el) return;
  var f = ACTS[el.dataset.actChange]; if (f) f(el.dataset, el);
});
document.addEventListener('submit', function (e) {
  var f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault(); var a = ACTS['form_' + f.dataset.form]; if (a) a(f.dataset, f);
});
ACTS.form_addstep = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return;
  var t = Store.get('tasks', d.id); var steps = (t.steps || []).concat([{ t: v, done: false }]);
  inp.value = ''; Store.patch('tasks', d.id, { steps: steps }); render(false, true);
  var n = $('#newstep'); if (n) n.focus();
};
ACTS.step = function (d) {
  var t = Store.get('tasks', d.id), steps = (t.steps || []).slice(); steps[+d.i] = Object.assign({}, steps[+d.i], { done: !steps[+d.i].done });
  Store.patch('tasks', d.id, { steps: steps });
};
ACTS.delstep = function (d) { var t = Store.get('tasks', d.id), s = (t.steps || []).slice(); s.splice(+d.i, 1); Store.patch('tasks', d.id, { steps: s }); };
ACTS.when = function (d) { moveTask(d.id, d.to); toast('Moved to ' + { today: 'today', tomorrow: 'tomorrow', nextweek: 'next week', whenever: 'Whenever', drifted: 'Drifted' }[d.to]); };
ACTS.whendate = function (d, el) { if (el.value) { moveTask(d.id, el.value); toast('Moved to ' + shortDate(el.value)); } };
ACTS.taskarea = function (d) { var t = Store.get('tasks', d.id); Store.patch('tasks', d.id, { area: t.area === d.a ? null : d.a }); };
ACTS.taskprio = function (d) {
  if (!d.l) { Store.patch('tasks', d.id, { prio: null, prioDay: null }); return; }
  var t = Store.get('tasks', d.id);
  if (t.prio === d.l && t.prioDay === today()) return;
  if (prioCount(d.l) >= CAP[d.l]) { swapSheet(d.l); return; }
  setPrio(d.id, d.l); toast(d.l + ' set for today');
};
ACTS.startthis = function (d) {
  var t = Store.get('tasks', d.id);
  if (t.due !== today()) moveTask(d.id, 'today');
  logEvent('Started: ' + t.t, t.area);
  var first = (t.steps || []).filter(function (s) { return !s.done; })[0];
  toast(first ? 'First step: ' + esc(first.t) : 'Started. Ten minutes counts.');
};
ACTS.deltask = function (d) {
  var t = Store.get('tasks', d.id); Store.del('tasks', d.id); pop();
  toast('Task deleted', function () { Store.put('tasks', t); });
};
ACTS.breakdown = function (d, el) {
  var t = Store.get('tasks', d.id);
  el.disabled = true; el.innerHTML = icon('sparkle', 'sm') + 'Thinking…';
  aiJson('Break this task into 3 to 6 small, concrete steps. The first step must take under 5 minutes. '
    + 'Task: "' + t.t + '". Notes: "' + (t.note || 'none') + '". Steps already listed: ' + JSON.stringify((t.steps || []).map(function (s) { return s.t; })) + '. '
    + 'Do not repeat existing steps. Reply with JSON only: {"steps":["…","…"]}. Each step under 70 characters, plain words.')
    .then(function (r) {
      var add = (r && r.steps || []).filter(function (s) { return typeof s === 'string' && s.trim(); }).slice(0, 6)
        .map(function (s) { return { t: s.trim().slice(0, 120), done: false }; });
      var cur = Store.get('tasks', d.id); if (!cur) return;
      Store.patch('tasks', d.id, { steps: (cur.steps || []).concat(add) });
      toast(add.length + ' steps added');
    }).catch(function (e) { toast(aiError(e)); render(); });
};

/* ── sweep: give every slipped task a real day ─────────────────────── */
TITLES.sweep = 'Sweep';
VIEWS.sweep = function () {
  var list = slipped();
  var h = '<p class="note">These had a day that passed. Nothing here is overdue. Each one just needs a new day, or permission to drift.</p>';
  if (!list.length) return h + '<div class="empty">All swept. Every task has a real day.</div><button class="btn soft" data-act="back">Back</button>';
  var t = list[0];
  h += '<div class="sweepcard"><div class="small faint">' + list.length + ' left · was ' + esc(shortDate(t.due)) + '</div>'
    + '<div class="t">' + esc(t.ic ? t.ic + ' ' : '') + esc(t.t) + '</div>'
    + '<div class="small muted">' + areaDot(t.area) + ' ' + esc(areaName(t.area) || 'No area') + (t.est ? ' · ' + esc(t.est) : '') + '</div>'
    + '<div class="dest">' + [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['whenever', 'Whenever'], ['drifted', 'Drifted']].map(function (x) {
      return '<button class="btn ' + (x[0] === 'today' ? 'accent' : 'soft') + '" data-act="sweepto" data-id="' + t.id + '" data-to="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>'
    + '<button class="link" style="justify-self:start" data-act="sweepdone" data-id="' + t.id + '">It\'s actually done</button></div>';
  if (list.length > 1) h += '<button class="btn ghost" data-act="sweepall">Move all ' + list.length + ' to Whenever</button>';
  return h;
};
ACTS.sweepto = function (d) { moveTask(d.id, d.to); render(); };
ACTS.sweepdone = function (d) { completeTask(d.id, true); render(); };
ACTS.sweepall = function () { slipped().forEach(function (t) { moveTask(t.id, 'whenever'); }); logEvent('Swept slipped tasks to Whenever'); toast('All moved to Whenever'); };
