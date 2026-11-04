/* ═══ TASKS ═════════════════════════════════════════════════════════
   Three groups: Today, Upcoming, Someday. Add from the box at the top in
   plain words; swipe a row right to finish it or left to move it to
   tomorrow; tap a title to rename it in place. */
var taskFilter = null;
TITLES.tasks = 'Tasks';
VIEWS.tasks = function () {
  var open = Store.all('tasks').filter(function (t) { return !t.done; });
  var h = '<form class="addtask" data-form="quickadd"><label class="sr" for="qadd">Add a task</label>'
    + '<input id="qadd" class="input" placeholder="Add a task: &quot;gym 6pm every Mon, Thu&quot;" autocomplete="off" enterkeyhint="done">'
    + '<button class="btn accent" type="submit" aria-label="Add">' + icon('plus', 'sm') + '</button></form>';
  h += '<div class="scrollx" role="group" aria-label="Filter by area"><button class="chip' + (!taskFilter ? ' on' : '') + '" data-act="tfilter" data-id="">All · ' + open.length + '</button>'
    + areasSorted().map(function (a) {
      var n = open.filter(function (t) { return t.area === a.id; }).length;
      return '<button class="chip' + (taskFilter === a.id ? ' on' : '') + '" data-act="tfilter" data-id="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + (n ? ' · ' + n : '') + '</button>';
    }).join('') + '</div>';
  var sl = slipped().filter(function (t) { return !taskFilter || t.area === taskFilter; });
  if (sl.length) h += '<button class="sweepbar" data-act="reschedule">' + icon('broom') + '<span class="grow"><b style="font-weight:500">'
    + sl.length + ' slipped</b><span class="muted small"> · sweep them onto real days</span></span>' + icon('chev', 'sm chev') + '</button>';
  GROUPS.forEach(function (g) {
    var list = tasksInGroup(g[0], taskFilter), openN = list.filter(function (t) { return !t.done; }).length;
    h += '<section><div class="grouph">' + g[1] + ' <span class="c">' + openN + '</span><span class="ln"></span></div>'
      + (list.length ? '<div class="tlist">' + list.map(taskRow).join('') + '</div>'
        : '<p class="note small" style="padding:6px 2px">' + { today: 'Nothing due today.', upcoming: 'Nothing scheduled.', someday: 'Nothing parked here.' }[g[0]] + '</p>')
      + '</section>';
  });
  var wk = Date.now() - 7 * 864e5;
  var older = Store.all('tasks').filter(function (t) { return bucket(t) === 'done' && t.doneAt > wk && (!taskFilter || t.area === taskFilter); })
    .sort(function (a, b) { return b.doneAt - a.doneAt; });
  if (older.length) h += '<details class="donegrp"><summary>Done this week · ' + older.length + '</summary><div class="tlist">' + older.map(taskRow).join('') + '</div></details>';
  h += '<p class="note small">Swipe a task right to finish it, left to move it to tomorrow. Tap a name to rename it.</p>';
  return h;
};
VIEWS.tasks.after = function () { wireSwipes(); };
function whenText(t) {
  var g = listGroup(t), out = [];
  if (t.due && g !== 'today') out.push(shortDate(t.due));
  if (t.time) out.push(fmtTime(t.time));
  return out.join(' ');
}
function taskRow(t) {
  var meta = [];
  if (t.area) meta.push(areaDot(t.area) + esc(areaName(t.area)));
  var w = whenText(t); if (w) meta.push(esc(w));
  if (t.repeat) meta.push('↻ ' + esc(repeatLabel(t.repeat)));
  var st = t.steps || []; if (st.length) meta.push(st.filter(function (x) { return x.done; }).length + '/' + st.length);
  return '<div class="trow' + (t.done ? ' done' : '') + '" data-swipe="' + t.id + '">'
    + '<div class="swbg" aria-hidden="true"><span class="l">' + (t.repeat ? '↻ Done' : '✓ Done') + '</span><span class="r">Tomorrow →</span></div>'
    + '<div class="trin">'
    + '<button class="ck' + (t.done ? ' on' : '') + '" data-act="toggle" data-id="' + t.id + '" aria-label="' + (t.done ? 'Mark not done' : 'Mark done') + '"><span></span></button>'
    + '<div class="grow"><button class="tt" data-act="rename" data-id="' + t.id + '" aria-label="Rename ' + esc(t.t) + '">' + esc(t.ic ? t.ic + ' ' : '') + esc(t.t) + '</button>'
    + (meta.length || t.example ? '<div class="s">' + meta.join('<span class="faint">·</span>') + ' ' + exPill(t) + '</div>' : '') + '</div>'
    + '<button class="iconbtn" data-act="open" data-v="task" data-id="' + t.id + '" aria-label="Open ' + esc(t.t) + '">' + icon('chev', 'sm') + '</button>'
    + '</div></div>';
}
ACTS.tfilter = function (d) { taskFilter = d.id || null; render(); };
ACTS.form_quickadd = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return;
  var p = parseTaskText(v), ef = estFromText(p.title);
  var t = Store.put('tasks', { t: ef ? ef.rest || p.title : p.title, ic: '', area: p.area || taskFilter, project: p.project, due: p.due || today(), time: p.time, repeat: p.repeat, est: ef ? ef.est : '', done: false, steps: [], note: '' });
  inp.value = ''; logEvent('New task: ' + t.t, t.area);
  render(false, true); var n = $('#qadd'); if (n) n.focus();
  if (shiftHint(t, 'Added ' + esc(t.t))) return;
  toast('Added: ' + esc([t.t, shortDate(t.due), t.time ? fmtTime(t.time) : '', t.repeat ? '↻ ' + repeatLabel(t.repeat) : ''].filter(Boolean).join(' · ')), function () { Store.del('tasks', t.id); });
};
ACTS.newtask = function () {
  var t = Store.put('tasks', { t: 'New task', ic: '', area: taskFilter, due: today(), done: false, steps: [], note: '' });
  push('task', t.id);
  setTimeout(function () { var el = $('#ttitle'); if (el) { el.focus(); el.select(); } }, 50);
};
/* Rename in place: the title becomes a text field. */
ACTS.rename = function (d, el) {
  if (el.dataset.moved) { delete el.dataset.moved; return; }
  var t = Store.get('tasks', d.id); if (!t) return;
  var inp = document.createElement('input');
  inp.className = 'input ttedit'; inp.value = t.t; inp.setAttribute('aria-label', 'Task name'); inp.id = 'ren' + t.id;
  el.replaceWith(inp); inp.focus(); inp.select();
  var done = false;
  var finish = function (save) {
    if (done) return; done = true;
    var v = inp.value.trim();
    if (save && v && v !== t.t) { Store.patch('tasks', t.id, { t: v }); toast('Renamed'); }
    inp.blur(); render(false, true);
  };
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.stopPropagation(); finish(false); } });
  inp.addEventListener('blur', function () { finish(true); });
};
/* Swipe right: done. Swipe left: tomorrow. Vertical drags scroll as usual. */
function wireSwipes() {
  $$('[data-swipe]').forEach(function (row) {
    var inner = $('.trin', row), id = row.dataset.swipe, x0 = 0, y0 = 0, dx = 0, on = false, locked = null, pid = null;
    inner.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('input')) return;
      on = true; locked = null; dx = 0; x0 = e.clientX; y0 = e.clientY; pid = e.pointerId;
    });
    inner.addEventListener('pointermove', function (e) {
      if (!on || e.pointerId !== pid) return;
      var mx = e.clientX - x0, my = e.clientY - y0;
      if (locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
        locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
        if (locked === 'x') { try { inner.setPointerCapture(pid); } catch (er) {} row.classList.add('swiping'); }
      }
      if (locked !== 'x') return;
      dx = mx; inner.style.transform = 'translateX(' + dx + 'px)';
      row.classList.toggle('goR', dx > 70); row.classList.toggle('goL', dx < -70);
    });
    var end = function () {
      if (!on) return; on = false;
      row.classList.remove('swiping', 'goR', 'goL'); inner.style.transform = '';
      if (locked !== 'x') return;
      // a swipe isn't a tap: don't let the click that follows rename or open
      $$('[data-act]', inner).forEach(function (b) { b.dataset.moved = '1'; setTimeout(function () { delete b.dataset.moved; }, 400); });
      var t = Store.get('tasks', id); if (!t) return;
      var undo = snapshot(id), wasDone = !!t.done, rep = !!t.repeat;
      if (dx > 70) { completeTask(id, !wasDone); var n = Store.get('tasks', id); toast(wasDone ? 'Marked not done' : rep ? 'Done. Next: ' + esc(shortDate(n.due)) : 'Done', undo); }
      else if (dx < -70 && !wasDone) { moveTask(id, 'tomorrow'); toast('Moved to tomorrow', undo); }
    };
    inner.addEventListener('pointerup', end); inner.addEventListener('pointercancel', end);
  });
}
/* Clicks that end a swipe are swallowed (see data-moved above). */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-moved]'); if (el && el.dataset.act !== 'rename') { e.stopImmediatePropagation(); e.preventDefault(); delete el.dataset.moved; }
}, true);

/* ── task detail ───────────────────────────────────────────────────── */
TITLES.task = function (id) { var t = Store.get('tasks', id); return t ? (areaName(t.area) || 'Task') : 'Task'; };
VIEWS.task = function (id) {
  var t = Store.get('tasks', id);
  if (!t) return '<div class="empty">This task was deleted.</div>';
  var d = today(), steps = t.steps || [], rep = t.repeat || null;
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
    + '<div class="prop"><span class="k">When</span><span class="v"><button class="whenbtn" data-act="taskwhen" data-id="' + t.id + '">'
      + '<b>' + esc(t.due ? shortDate(t.due) : t.drifted ? 'Drifted' : 'Someday') + (t.time ? ' · ' + esc(fmtTime(t.time)) : '') + '</b>'
      + ((t.remind || []).length ? '<span class="faint small">🔔 ' + t.remind.map(remindLabel).join(', ') + ' before</span>' : '') + '<span class="link">Change</span></button></span></div>'
    + (t.due && t.time && !t.done ? '<div class="prop"><span class="k">Calendar</span><span class="v">' + calBtn(taskCal(t)) + '<span class="faint small calnote">Opens ics.agical.io, which makes the calendar file; the title and time pass through it.'
      + (t.repeat ? ' Adds the next date only; set Repeat in Calendar.' : '') + '</span></span></div>' : '')
    + '<div class="prop"><span class="k">Repeat</span><span class="v">' + [['', 'None'], ['day', 'Daily'], ['weekday', 'Weekdays'], ['week', 'Weekly'], ['month', 'Monthly']].map(function (r) {
      var on = (rep ? rep.every : '') === r[0];
      return '<button class="chip' + (on ? ' on' : '') + '" data-act="taskrep" data-id="' + t.id + '" data-r="' + r[0] + '" aria-pressed="' + on + '">' + r[1] + '</button>';
    }).join('') + '</span></div>'
    + (rep && rep.every === 'week' ? '<div class="prop"><span class="k">On</span><span class="v">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (n, i) {
      return '<button class="chip' + (rep.days && rep.days[i] ? ' on' : '') + '" data-act="taskrepday" data-id="' + t.id + '" data-i="' + i + '">' + n + '</button>';
    }).join('') + '</span></div>' : '')
    + (rep && rep.every === 'month' ? '<div class="prop"><span class="k">Day</span><span class="v"><label class="sr" for="tdom">Day of the month</label><input id="tdom" class="input" type="number" min="1" max="31" style="max-width:90px;min-height:40px" value="' + (rep.dom || 1) + '" data-act-change="taskdom" data-id="' + t.id + '"><span class="faint small">of each month</span></span></div>' : '')
    + (projectsAll('active').length || t.project ? '<div class="prop"><span class="k">Project</span><span class="v">' + projectsAll('active').concat(t.project && Store.get('projects', t.project) && Store.get('projects', t.project).status !== 'active' ? [Store.get('projects', t.project)] : []).map(function (p) {
      return '<button class="chip' + (t.project === p.id ? ' on' : '') + '" data-act="taskproj" data-id="' + t.id + '" data-p="' + p.id + '">' + esc(p.ic || '📁') + ' ' + esc(p.t) + '</button>';
    }).join('') + '</span></div>' : '')
    + '<div class="prop"><span class="k">Time</span><span class="v"><label class="sr" for="test">Time estimate</label><input id="test" class="input" style="max-width:160px;min-height:40px" data-field="est" value="' + esc(t.est || '') + '" placeholder="e.g. 20 min"></span></div>'
    + '<div class="prop"><span class="k">Icon</span><span class="v"><label class="sr" for="tic">Icon</label><input id="tic" class="input" style="max-width:80px;min-height:40px;text-align:center" data-field="ic" value="' + esc(t.ic || '') + '" maxlength="4"></span></div>'
    + '</div></section>';
  if (t.slip) h += '<p class="note">Slipped from ' + esc(shortDate(t.slip.was)) + ', moved to ' + esc(t.slip.now === 'drifted' ? 'Drifted' : t.slip.now === 'whenever' ? 'Someday' : shortDate(t.slip.now)) + '.' + (t.slip.remark ? ' <i>“' + esc(t.slip.remark) + '”</i>' : '') + '</p>';
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
ACTS.taskproj = function (d) { var t = Store.get('tasks', d.id), p = Store.get('projects', d.p); Store.patch('tasks', d.id, { project: t.project === d.p ? null : d.p, area: t.area || (p && p.area) || null }); };
ACTS.taskarea = function (d) { var t = Store.get('tasks', d.id); Store.patch('tasks', d.id, { area: t.area === d.a ? null : d.a }); };
ACTS.tasktime = function (d, el) { Store.patch('tasks', d.id, { time: el.value || null }); };
ACTS.tasktimeclear = function (d) { Store.patch('tasks', d.id, { time: null }); };
ACTS.taskwhen = function (d) {
  var t = Store.get('tasks', d.id);
  pickWhen({ due: t.due, time: t.time, remind: t.remind, id: t.id, title: 'When' }, function (r) {
    var undo = snapshot(d.id);
    if (r.due !== t.due) moveTask(d.id, r.due || 'whenever');
    Store.patch('tasks', d.id, { time: r.time, remind: r.remind });
    if (r.due !== t.due && shiftHint(Store.get('tasks', d.id))) return;
    toast(esc([r.due ? shortDate(r.due) : 'Someday', r.time ? fmtTime(r.time) : 'all day'].join(' · ')), undo);
  });
};
ACTS.taskrep = function (d) {
  var t = Store.get('tasks', d.id), r = d.r ? { every: d.r } : null, base = t.due || today();
  if (r && r.every === 'week') { r.days = [0, 0, 0, 0, 0, 0, 0]; r.days[(parseYmd(base).getDay() + 6) % 7] = 1; }
  if (r && r.every === 'month') r.dom = parseYmd(base).getDate();
  var f = { repeat: r };
  if (r && !repeatsOn(r, base)) f.due = nextOccurrence(r, addDays(today(), -1));
  if (r && !t.due) f.due = nextOccurrence(r, addDays(today(), -1));
  Store.patch('tasks', d.id, f);
  if (r) toast('Repeats ' + esc(repeatLabel(r)));
};
ACTS.taskrepday = function (d) {
  var t = Store.get('tasks', d.id), r = Object.assign({}, t.repeat), days = (r.days || [0, 0, 0, 0, 0, 0, 0]).slice();
  days[+d.i] = days[+d.i] ? 0 : 1; if (!days.some(Boolean)) { toast('Pick at least one day'); return; }
  r.days = days; var f = { repeat: r }; if (t.due && !repeatsOn(r, t.due)) f.due = nextOccurrence(r, addDays(today(), -1));
  Store.patch('tasks', d.id, f);
};
ACTS.taskdom = function (d, el) {
  var v = Math.max(1, Math.min(31, parseInt(el.value, 10) || 1)), t = Store.get('tasks', d.id), r = Object.assign({}, t.repeat, { dom: v });
  Store.patch('tasks', d.id, { repeat: r, due: nextOccurrence(r, addDays(today(), -1)) });
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
