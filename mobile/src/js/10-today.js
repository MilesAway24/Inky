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
/* The big header: "Today", the date and part of day, calendar and search. */
HEADS.today = function () {
  var d = new Date();
  return '<div class="bighead"><h1>Today</h1><div class="sub">' + DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() + ' · ' + partOfDay(d.getHours()).replace(/^\w/, function (c) { return c.toUpperCase(); }) + '</div></div>'
    + '<div class="headbtns"><button class="roundbtn" data-act="tab" data-v="calendar" aria-label="Calendar">' + icon('calendar', 'sm') + '</button>'
    + '<button class="roundbtn" data-act="tab" data-v="search" aria-label="Search">' + icon('search', 'sm') + '</button></div>';
};
VIEWS.today = function () {
  var d = new Date(), t = today();
  var inbox = Store.all('inbox'), sl = slipped();
  var todays = tasksIn('today'), open = todays.filter(function (x) { return !x.done; }), done = todays.filter(function (x) { return x.done; });
  // Status pill
  var sh = shiftOverview().replace(/^ · /, '');
  var h = '<div class="statpill"><button data-act="tab" data-v="tasks"><span class="sico ok">' + icon('check', 'sm') + '</span>' + open.length + ' task' + (open.length === 1 ? '' : 's') + ' today</button>'
    + '<i></i><button data-act="' + (sl.length ? 'reschedule' : 'tab') + '" data-v="tasks" class="' + (sl.length ? 'bad' : 'muted') + '"><span class="sico ' + (sl.length ? 'warn' : 'none') + '">!</span>' + sl.length + ' overdue</button></div>';
  if (sh || d.getHours() >= 17) h += '<div class="subline">' + (sh ? '<span>' + icon('shift', 'sm') + ' ' + esc(sh.replace(/^\w/, function (c) { return c.toUpperCase(); })) + '</span>' : '')
    + (d.getHours() >= 17 ? '<button class="link" data-act="tab" data-v="plan">Plan tomorrow →</button>' : '') + '</div>';


  h += shiftCards();

  // Heads up: only when something needs you
  var rem = remindersNow(), hrem = habitRemindersNow();
  var finRows = (typeof finHeadsUp === 'function' ? finHeadsUp() : []).concat(typeof areaHeadsUp === 'function' ? areaHeadsUp() : []);
  if ((rem.length || hrem.length || inbox.length || finRows.length) && !headsUpDismissed()) {
    h += '<section class="headsup card"><div class="sechead" style="margin:0"><h2>Heads up</h2><button class="iconbtn" data-act="hudismiss" aria-label="Hide for today">' + icon('x', 'sm') + '</button></div>';
    rem.forEach(function (x) { h += '<div class="hurow"><span>🔔</span><button class="grow" style="text-align:left" data-act="open" data-v="task" data-id="' + x.id + '"><b>' + esc(x.t) + '</b> <span class="muted">' + esc(untilText(x)) + '</span></button></div>'; });
    hrem.forEach(function (x) { h += '<div class="hurow"><span>' + esc(x.ic) + '</span><span class="grow"><b>' + esc(x.n) + '</b> <span class="muted">reminder · ' + esc(fmtTime(x.remindAt)) + '</span></span><button class="btn sm soft" data-act="habtoggle" data-id="' + x.id + '">' + (x.target ? 'Log' : 'Done') + '</button></div>'; });
    h += finRows.join('');
    if (inbox.length) h += '<div class="hurow"><span>📥</span><span class="grow"><b>' + inbox.length + ' to sort</b> <span class="muted">from quick captures</span></span><button class="btn sm soft" data-act="tab" data-v="inbox">Sort</button></div>';
    h += '</section>';
  }

  // Quick access
  h += '<nav class="jump dtiles" aria-label="Quick access">' + ['journal', 'goals', 'notes', 'books'].map(function (k) {
    return '<button class="jt2" data-act="tab" data-v="' + k + '">' + icon(SECTIONS[k][1]) + '<b>' + SECTIONS[k][0] + '</b><span>' + esc(sectionCount(k)) + '</span></button>';
  }).join('') + '</nav>';

  // Habits today
  var hd = habitsDueToday();
  if (hd.length) {
    var hdone = hd.filter(function (x) { return habitDone(x, t); }).length;
    h += '<section class="card"><button class="cardhead" data-act="tab" data-v="habits"><h2>Habits today</h2><span class="meta">' + hdone + '/' + hd.length + esc(challengeTag()) + ' ' + icon('chev', 'sm') + '</span></button><div class="hchips">'
      + hd.map(habitChip).join('') + '</div></section>';
  }

  // Money
  if (typeof billsSection === 'function') h += billsSection();

  // Life areas
  h += '<section><button class="cardhead plain" data-act="tab" data-v="areas"><h2>Life areas</h2><span class="link">All ' + icon('chev', 'sm') + '</span></button><div class="areas">'
    + areasSorted().map(function (a) {
      return '<button class="acard" style="--c:' + esc(a.color) + '" data-act="open" data-v="area" data-id="' + a.id + '">'
        + '<span class="n"><span class="dot" style="background:' + esc(a.color) + '"></span><span>' + esc(a.short) + '</span></span>'
        + '<span class="st st-' + a.state.toLowerCase().replace(/\s/g, '') + '">' + esc(a.state) + '</span>'
        + '<span class="f">' + esc(a.focus || '') + '</span></button>';
    }).join('') + '</div></section>';

  // Play
  var q = playQueue();
  h += '<section><div class="cardhead plain"><h2>Play</h2><span class="meta">One at a time · ' + q.length + ' left</span></div>';
  if (q.length) {
    var x = q[0];
    h += '<div class="play2"><span class="pic">' + esc(x.ic || (x.kind === 'habit' ? '🔁' : x.kind === 'goal' ? '🎯' : '✅')) + '</span>'
      + '<button class="grow pbody" data-act="open" data-v="' + x.kind + '" data-id="' + x.id + '"><span class="pk">' + esc(x.kind === 'habit' ? 'Habit' : x.kind === 'goal' ? 'Goal' : (areaName(x.area) || 'Task'))
      + (x.time ? ' · ' + esc(fmtTime(x.time)) : '') + (x.est ? ' · ~' + esc(x.est) : '') + '</span><b>' + esc(x.t) + '</b><span class="pw">' + esc(x.why) + '</span></button>'
      + '<div class="pacts"><button class="pillbtn" data-act="playdo" data-k="' + x.kind + '" data-id="' + x.id + '">' + icon('check', 'sm') + (x.kind === 'habit' ? 'Mark done' : 'Do it') + '</button>'
      + '<button class="pillbtn ghost" data-act="playskip" data-k="' + x.kind + '" data-id="' + x.id + '">Skip</button></div></div>';
  } else h += '<div class="empty">Nothing waiting. Capture something, or enjoy the gap.</div>';
  h += '</section>';

  // Today's tasks, overdue, completed
  h += '<section><div class="cardhead plain"><h2>Today</h2><button class="link" data-act="tab" data-v="tasks">All tasks</button></div>'
    + (open.length ? '<div class="tlist">' + open.map(taskRow).join('') + '</div>' : '<p class="note">Nothing else due today.</p>') + '</section>';
  if (sl.length) h += '<section><div class="cardhead plain"><h2 class="bad">Overdue</h2><button class="link" data-act="reschedule">Sweep →</button></div>'
    + '<div class="tlist">' + sl.slice(0, 5).map(taskRow).join('') + '</div></section>';
  if (done.length) h += '<details class="donegrp"><summary>✓ Completed · ' + done.length + '</summary><div class="tlist">' + done.map(taskRow).join('') + '</div></details>';
  return h;
};
/* Today's log now lives on the Journal page. */
function todaysLogHtml() {
  var t = today(), log = Store.all('log').filter(function (l) { return l.day === t; }).sort(function (a, b) { return b.at - a.at; });
  return '<section><div class="sechead"><h2>Today\'s log</h2><span class="meta">writes itself</span></div>'
    + (log.length ? '<div class="log">' + log.slice(0, 20).map(function (l) {
      return '<div class="logrow"><time>' + clock(l.at) + '</time>' + areaDot(l.area) + '<span>' + esc(l.text) + '</span></div>';
    }).join('') + '</div>' : '<div class="empty">Nothing yet. Finishing a task, marking a habit or capturing something adds a line here.</div>') + '</section>';
}
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
  if (k === 'shifts') { var mo = mondayOf(t), sn = Store.all('shifts').filter(function (x) { return x.date >= mo && x.date <= addDays(mo, 6); }).length; return sn + ' this week'; }
  if (k === 'books') { var br = booksReading(); return br.length ? br.length + ' reading' : 'add a book'; }
  if (k === 'plan') { var tn = tasksOn(addDays(t, 1)).filter(function (x) { return !x.done; }).length; return tn + ' planned'; }
  if (k === 'areas') { return areasSorted().filter(function (a) { return a.state === 'Needs you'; }).length + ' need you'; }
  return '';
}
function jumpTiles(keys) {
  return '<nav class="jump" aria-label="Go to">' + keys.map(function (k) {
    return '<button class="jt2" data-act="tab" data-v="' + k + '">' + icon(SECTIONS[k][1], 'sm') + '<b>' + SECTIONS[k][0] + '</b><span>' + esc(sectionCount(k)) + '</span></button>';
  }).join('') + '</nav>';
}
