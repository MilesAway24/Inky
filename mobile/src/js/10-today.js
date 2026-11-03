/* ═══ TODAY ═════════════════════════════════════════════════════════
   An overview first (from Miles's recording): the count, a Heads up card
   for what needs you, bills, the inbox, then the Play card, today's
   tasks, anything overdue, habits, life areas, the log, and what's done. */
TITLES.today = 'Today';
function partOfDay(h) { return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }
function headsUpDismissed() { try { return localStorage.getItem('mossos.headsup') === today(); } catch (e) { return false; } }
function habitRemindersNow() {
  var n = new Date(), now = n.getHours() * 60 + n.getMinutes(), t = today();
  return habitsDueToday().filter(function (h) { return h.remindAt && mins(h.remindAt) <= now && !habitDone(h, t); });
}
VIEWS.today = function () {
  var d = new Date(), t = today();
  var inbox = Store.all('inbox').sort(function (a, b) { return a.created - b.created; }), sl = slipped();
  var todays = tasksIn('today'), open = todays.filter(function (x) { return !x.done; }), done = todays.filter(function (x) { return x.done; });
  var h = '<div class="overview"><div class="dateline">' + DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() + ' · ' + partOfDay(d.getHours()) + '</div>'
    + '<div class="ovcount">' + open.length + ' task' + (open.length === 1 ? '' : 's') + ' today' + (sl.length ? ' · <span class="bad">' + sl.length + ' overdue</span>' : '') + '</div></div>';
  h += jumpTiles(['habits', 'goals', 'notes', 'projects', 'tools', 'calendar']);

  if (hasExamples()) h += '<div class="card flat"><p class="note">You\'re looking at example data so you can see how MossOS works. '
    + 'Items marked <span class="pill ex">example</span> go when you clear them.</p>'
    + '<div class="btnrow" style="margin-top:12px"><button class="btn sm soft" data-act="clearex">Clear examples</button></div></div>';

  // Heads up
  var rem = remindersNow(), hrem = habitRemindersNow();
  var finRows = typeof finHeadsUp === 'function' ? finHeadsUp() : [];
  if ((sl.length || rem.length || hrem.length || inbox.length || finRows.length) && !headsUpDismissed()) {
    h += '<section class="headsup"><div class="sechead" style="margin:0"><h2>Heads up</h2><button class="iconbtn" data-act="hudismiss" aria-label="Hide for today">' + icon('x', 'sm') + '</button></div>';
    if (sl.length) h += '<div class="hurow"><span>🔥</span><span class="grow"><b>' + sl.length + ' task' + (sl.length === 1 ? '' : 's') + ' overdue</b></span><button class="btn sm soft" data-act="reschedule">Sweep</button></div>';
    rem.forEach(function (x) { h += '<div class="hurow"><span>🔔</span><button class="grow" style="text-align:left" data-act="open" data-v="task" data-id="' + x.id + '"><b>' + esc(x.t) + '</b> <span class="muted">' + esc(untilText(x)) + '</span></button></div>'; });
    hrem.forEach(function (x) { h += '<div class="hurow"><span>' + esc(x.ic) + '</span><span class="grow"><b>' + esc(x.n) + '</b> <span class="muted">reminder · ' + esc(fmtTime(x.remindAt)) + '</span></span><button class="btn sm soft" data-act="habtoggle" data-id="' + x.id + '">' + (x.target ? 'Log' : 'Done') + '</button></div>'; });
    h += finRows.join('');
    if (inbox.length) h += '<div class="hurow"><span>📥</span><span class="grow"><b>' + inbox.length + ' to sort</b></span><button class="btn sm soft" data-act="tab" data-v="inbox">Sort</button></div>';
    h += '</section>';
  }

  if (typeof billsSection === 'function') h += billsSection();

  // Inbox, each with its own sort
  if (inbox.length) h += '<section><div class="sechead"><h2>Inbox</h2><span class="pill accent">' + inbox.length + ' to sort</span></div><div class="list">'
    + inbox.slice(0, 4).map(function (it) {
      return '<div class="row"><span class="grow"><div class="t">' + esc(it.text || '(photo)') + '</div><div class="s">unsorted · ' + esc(timeAgo(it.created)) + ' ' + exPill(it) + '</div></span>'
        + '<button class="btn sm soft" data-act="sortone" data-id="' + it.id + '">sort ›</button></div>';
    }).join('') + (inbox.length > 4 ? '<button class="row link" data-act="tab" data-v="inbox">All ' + inbox.length + ' in the inbox ›</button>' : '') + '</div></section>';

  // Play
  var q = playQueue();
  h += '<section><div class="sechead"><h2>Play</h2><span class="meta">one at a time · ' + q.length + ' left</span></div>';
  if (q.length) {
    var x = q[0];
    h += '<div class="play"><div class="k"><span>' + areaDot(x.area) + ' ' + esc(areaName(x.area) || 'No area')
      + (x.tag ? ' · ' + esc(x.tag) : '') + '</span><span>' + esc([x.time ? fmtTime(x.time) : '', x.est ? '~' + x.est : ''].filter(Boolean).join(' · ')) + '</span></div>'
      + '<div class="t"><span>' + esc(x.ic || '•') + '</span><span>' + esc(x.t) + '</span></div>'
      + '<div class="w">' + esc(x.why) + '</div>'
      + '<div class="acts"><button class="btn accent" data-act="playdo" data-k="' + x.kind + '" data-id="' + x.id + '">' + (x.kind === 'habit' ? 'Mark done' : 'Do it') + '</button>'
      + '<button class="btn soft" data-act="playskip" data-k="' + x.kind + '" data-id="' + x.id + '">Skip ›</button></div>'
      + '<button class="link" style="justify-self:start" data-act="open" data-v="' + x.kind + '" data-id="' + x.id + '">Open the ' + x.kind + '</button></div>';
  } else {
    h += '<div class="empty">Nothing waiting. Capture something, or enjoy the gap.</div>';
  }
  h += '</section>';

  // Today's tasks
  h += '<section><div class="sechead"><h2>Today</h2><button class="link" data-act="tab" data-v="tasks">All tasks</button></div>'
    + (open.length ? '<div class="tlist">' + open.map(taskRow).join('') + '</div>' : '<p class="note">Nothing else due today.</p>') + '</section>';

  // Overdue
  if (sl.length) h += '<section><div class="sechead"><h2 class="bad">Overdue</h2><button class="link" data-act="reschedule">Sweep →</button></div>'
    + '<div class="tlist">' + sl.slice(0, 5).map(taskRow).join('') + '</div></section>';

  // Habits due today
  var hd = habitsDueToday();
  if (hd.length) {
    var hdone = hd.filter(function (x) { return habitDone(x, t); }).length;
    h += '<section><div class="sechead"><h2>Habits today</h2><span class="meta">' + hdone + '/' + hd.length + '</span></div><div class="hchips">'
      + hd.map(habitChip).join('') + '</div></section>';
  }

  // Areas
  h += '<section><div class="sechead"><h2>Life areas</h2><button class="link" data-act="tab" data-v="areas">All</button></div><div class="areas">'
    + areasSorted().map(function (a) {
      return '<button class="acard" style="--c:' + esc(a.color) + '" data-act="open" data-v="area" data-id="' + a.id + '">'
        + '<span class="n"><span class="dot" style="background:' + esc(a.color) + '"></span><span>' + esc(a.short) + '</span></span>'
        + '<span class="st st-' + a.state.toLowerCase().replace(/\s/g, '') + '">' + esc(a.state) + '</span>'
        + '<span class="f">' + esc(a.focus || '') + '</span></button>';
    }).join('') + '</div></section>';

  // Rescheduled
  var rs2 = rescheduled().slice(0, 4);
  if (rs2.length) h += '<section><div class="sechead"><h2>Slipped, rescheduled</h2></div><div style="display:grid;gap:6px">'
    + rs2.map(slipRow).join('') + '</div></section>';

  // Log
  var log = Store.all('log').filter(function (l) { return l.day === t; }).sort(function (a, b) { return b.at - a.at; });
  h += '<section><div class="sechead"><h2>Today\'s log</h2><span class="meta">writes itself</span></div>'
    + (log.length ? '<div class="log">' + log.slice(0, 12).map(function (l) {
      return '<div class="logrow"><time>' + clock(l.at) + '</time>' + areaDot(l.area) + '<span>' + esc(l.text) + '</span></div>';
    }).join('') + '</div>' : '<div class="empty">Nothing yet. Finishing a task, marking a habit or capturing something adds a line here.</div>')
    + '</section>';

  // Completed
  if (done.length) h += '<details class="donegrp"><summary>✓ Completed · ' + done.length + '</summary><div class="tlist">' + done.map(taskRow).join('') + '</div></details>';
  return h;
};
VIEWS.today.after = function () { wireSwipes(); };
ACTS.hudismiss = function () { try { localStorage.setItem('mossos.headsup', today()); } catch (e) {} render(); };
/* "sort ›" on one inbox item: smart-sort just that one, in the capture sheet. */
ACTS.sortone = function (d) {
  var it = Store.get('inbox', d.id); if (!it) return;
  capState = { kind: 'smart', area: null, photo: null, sugg: null };
  openSheet('<div class="shead"><h2>Sorting…</h2></div>');
  smartSort([it]).then(function (sugg) { capState.sugg = sugg; capReview(); });
};

function slipRow(tk) {
  var now = tk.slip.now === 'drifted' ? 'Drifted' : tk.slip.now === 'whenever' ? 'Whenever' : shortDate(tk.slip.now);
  return '<button class="slip" data-act="open" data-v="task" data-id="' + tk.id + '">' + areaDot(tk.area)
    + '<span class="grow">' + esc(tk.t) + '</span><s>' + esc(shortDate(tk.slip.was)) + '</s><span class="faint">→</span><b>' + esc(now) + '</b></button>';
}

ACTS.clearex = function () { clearExamples(); toast('Examples cleared'); };
ACTS.toggle = function (d) {
  var undo = snapshot(d.id), rep = !!(Store.get('tasks', d.id) || {}).repeat, on = completeTask(d.id), n = Store.get('tasks', d.id);
  toast(on ? (rep ? 'Done. Next: ' + esc(shortDate(n.due)) : 'Done') : 'Marked not done', undo);
};
ACTS.playdo = function (d) {
  if (d.k === 'habit') return toggleToday(d.id);
  if (d.k === 'goal') return ACTS.goalnextdone({ id: d.id });
  var undo = snapshot(d.id);
  completeTask(d.id, true);
  toast('Done. Next one is up.', undo);
};
ACTS.playskip = function (d) {
  var k = today(); playSkips[k] = playSkips[k] || {}; playSkips[k][(d.k || 'task') + d.id] = 1; render();
};


/* One-tap tiles to the other sections, each with a live count. */
function sectionCount(k) {
  var t = today();
  if (k === 'habits') { var hd = habitsDueToday(); return hd.length ? hd.filter(function (x) { return mark(x, t) === 1; }).length + '/' + hd.length + ' today' : 'none due'; }
  if (k === 'goals') { var g = goalsLive(); return g.length + ' live'; }
  if (k === 'notes') { var n = Store.all('notes').length; return n + ' note' + (n === 1 ? '' : 's'); }
  if (k === 'projects') { var p = projectsAll('active').length; return p + ' active'; }
  if (k === 'tools') { var r = Store.all('ranks').reduce(function (a, l) { return a + rankPending(l).length; }, 0), c = Store.all('decks').reduce(function (a, dk) { return a + dueCards(dk).length; }, 0); return r ? r + ' to rank' : c ? c + ' cards due' : 'Rank, cards, gym'; }
  if (k === 'calendar') { var w = Store.all('tasks').filter(function (x) { return !x.done && x.due && x.due > t && dayDiff(t, x.due) <= 7; }).length; return w + ' this week'; }
  if (k === 'journal') { var e = entryFor(t); return e && (e.text || e.mood) ? 'written today' : 'not yet today'; }
  if (k === 'inbox') { return Store.all('inbox').length + ' to sort'; }
  if (k === 'tasks') { return tasksIn('today').filter(function (x) { return !x.done; }).length + ' today'; }
  if (k === 'areas') { return areasSorted().filter(function (a) { return a.state === 'Needs you'; }).length + ' need you'; }
  return '';
}
function jumpTiles(keys) {
  return '<nav class="jump" aria-label="Go to">' + keys.map(function (k) {
    return '<button class="jt2" data-act="tab" data-v="' + k + '">' + icon(SECTIONS[k][1], 'sm') + '<b>' + SECTIONS[k][0] + '</b><span>' + esc(sectionCount(k)) + '</span></button>';
  }).join('') + '</nav>';
}
