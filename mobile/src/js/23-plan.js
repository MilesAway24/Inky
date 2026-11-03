/* ═══ TOMORROW ══════════════════════════════════════════════════════
   One evening planning page: what's left from today, tomorrow's tasks,
   tomorrow's money, habits, the inbox, and one line about today. */
TITLES.plan = 'Tomorrow';
VIEWS.plan = function () {
  var t = today(), tm = addDays(t, 1), td = parseYmd(tm);
  var left = Store.all('tasks').filter(function (x) { return !x.done && x.due && x.due <= t; }).sort(byWhen);
  var tom = tasksOn(tm).filter(function (x) { return !x.done; });
  var h = '<div class="overview"><div class="dateline">Planning</div><div class="ovcount">' + DOWL[td.getDay()] + ', ' + MON[td.getMonth()] + ' ' + td.getDate() + '</div></div>';

  // 1. Left from today
  h += '<section><div class="sechead"><h2>Left from today</h2><span class="meta">' + left.length + '</span></div>';
  h += left.length ? '<div class="list">' + left.map(function (x) {
    return '<div class="planrow"><button class="grow t" data-act="open" data-v="task" data-id="' + x.id + '">' + areaDot(x.area) + ' ' + esc(x.t)
      + '<span class="s">' + (x.due < t ? 'from ' + esc(shortDate(x.due)) : 'today') + (x.time ? ' · ' + esc(fmtTime(x.time)) : '') + '</span></button>'
      + '<div class="chips">'
      + '<button class="chip" data-act="planmove" data-id="' + x.id + '" data-to="tomorrow">Tomorrow</button>'
      + '<button class="chip" data-act="taskwhen" data-id="' + x.id + '">Pick a day</button>'
      + '<button class="chip" data-act="planmove" data-id="' + x.id + '" data-to="whenever">Someday</button>'
      + '<button class="chip" data-act="toggle" data-id="' + x.id + '">Done</button></div></div>';
  }).join('') + '</div>' : '<p class="note">Nothing left over. Today is clear.</p>';
  h += '</section>';

  // 2. Tomorrow
  h += '<section><div class="sechead"><h2>Tomorrow</h2><span class="meta">' + tom.length + ' task' + (tom.length === 1 ? '' : 's') + '</span></div>'
    + (tom.length ? '<div class="list">' + tom.map(taskRow).join('') + '</div>' : '<p class="note">Nothing planned yet.</p>')
    + '<form class="addstep" data-form="planadd"><label class="sr" for="planadd">Add a task for tomorrow</label><input id="planadd" class="input" placeholder="Add for tomorrow, e.g. &quot;gym 6pm&quot;" autocomplete="off"><button class="btn soft" type="submit">Add</button></form></section>';

  // 3. Money tomorrow
  var fe = typeof finEventsFor === 'function' ? (finEventsFor(monthStart(tm))[td.getDate()] || []) : [];
  if (fe.length) h += '<section><div class="sechead"><h2>Money tomorrow</h2></div><div class="list">' + fe.map(function (e) {
    return '<div class="row billrow"><button class="grow brow" data-act="tab" data-v="money"><span class="dot fin ' + e.type + '"></span><span class="grow t">' + esc(e.title) + '</span><span class="amt' + (e.type === 'pay' ? ' good' : '') + '">' + (e.type === 'pay' ? '+' : '−') + esc(fmtMoney(e.amount)) + '</span></button>'
      + calIcon(billCal(e.title.replace(/ minimum$/, ''), e.amount, tm, e.type)) + '</div>';
  }).join('') + '</div></section>';

  // 4. Habits tomorrow
  var hs = habitsSorted().filter(function (x) { return dueOn(x, tm); });
  if (hs.length) h += '<section><div class="sechead"><h2>Habits tomorrow</h2><span class="meta">' + hs.length + '</span></div><div class="chips">' + hs.map(function (x) {
    return '<span class="chip">' + esc(x.ic) + ' ' + esc(x.n) + (x.remindAt ? ' <span class="faint">· ' + esc(fmtTime(x.remindAt)) + '</span>' : '') + '</span>';
  }).join('') + '</div></section>';

  // 5. Inbox
  var n = Store.all('inbox').length;
  if (n) h += '<div class="hurow card flat"><span>📥</span><span class="grow"><b>' + n + ' to sort</b> <span class="muted">from your quick captures</span></span><button class="btn sm soft" data-act="tab" data-v="inbox">Sort</button></div>';

  // 6. One line about today
  var e = entryFor(t);
  h += '<section><div class="sechead"><h2>One line about today</h2></div>'
    + (e && e.text ? '<p class="note small jt">' + esc(e.text) + '</p>' : '')
    + '<form class="addstep" data-form="planjournal"><label class="sr" for="planj">One line about today</label><input id="planj" class="input" placeholder="How did today go?" autocomplete="off"><button class="btn soft" type="submit">Save</button></form></section>';
  return h;
};
VIEWS.plan.after = function () { if (typeof wireSwipes === 'function') wireSwipes(); };
ACTS.planmove = function (d) {
  var undo = snapshot(d.id), tk = Store.get('tasks', d.id);
  moveTask(d.id, d.to);
  toast(esc(tk ? tk.t : 'Task') + (d.to === 'tomorrow' ? ' → tomorrow' : ' → someday'), undo);
};
ACTS.form_planadd = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return; inp.value = '';
  var pt = parseTaskText(v), tm = addDays(today(), 1);
  var due = pt.due || (pt.repeat ? nextOccurrence(pt.repeat, today()) : tm);
  Store.put('tasks', { t: pt.title || v, area: pt.area, project: pt.project, due: due, time: pt.time, repeat: pt.repeat, done: false, steps: [], note: '' });
  render(false, true); toast('Added for ' + shortDate(due).toLowerCase());
};
ACTS.form_planjournal = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return; inp.value = '';
  var e = entryFor(today());
  saveEntry(today(), { text: (e && e.text ? e.text + '\n' : '') + v });
  render(false, true); toast('Added to today\'s journal');
};
