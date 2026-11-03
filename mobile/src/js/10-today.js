/* ═══ TODAY ═════════════════════════════════════════════════════════
   Order from the Status design: priorities, then the Play card, then
   life areas, then the day's log. */
TITLES.today = 'Today';
VIEWS.today = function () {
  var d = new Date(), t = today();
  var ps = prios(), p1 = ps.filter(function (x) { return x.prio === 'P1'; }), p2 = ps.filter(function (x) { return x.prio === 'P2'; });
  var doneN = ps.filter(function (x) { return x.done; }).length;
  var inboxN = Store.all('inbox').length, slipN = slipped().length;
  var h = '<div class="dateline">' + DOWL[d.getDay()] + ' · ' + d.getDate() + ' ' + MON[d.getMonth()] + '</div>';

  if (hasExamples()) h += '<div class="card flat"><p class="note">You\'re looking at example data so you can see how MossOS works. '
    + 'Items marked <span class="pill ex">example</span> go when you clear them.</p>'
    + '<div class="btnrow" style="margin-top:12px"><button class="btn sm soft" data-act="clearex">Clear examples</button></div></div>';

  if (inboxN || slipN) {
    h += '<div style="display:grid;gap:8px">';
    if (inboxN) h += '<button class="inboxbar" data-act="tab" data-v="inbox">' + icon('inbox') + '<span class="grow"><b>' + inboxN + ' captured</b>'
      + '<span class="muted small"> · waiting to be sorted</span></span>' + icon('chev', 'sm chev') + '</button>';
    if (slipN) h += '<button class="sweepbar" data-act="open" data-v="sweep">' + icon('broom') + '<span class="grow"><b style="font-weight:500">'
      + slipN + ' slipped</b><span class="muted small"> · give each a new day</span></span>' + icon('chev', 'sm chev') + '</button>';
    h += '</div>';
  }

  // Priorities
  h += '<section><div class="sechead"><h2>Priorities</h2><span class="meta">' + doneN + '/' + ps.length + ' done</span></div><div class="prios">';
  h += p1.length ? p1.map(prioRow).join('') : '<button class="slot" data-act="pickprio" data-l="P1">+ Choose your P1</button>';
  h += p2.map(prioRow).join('');
  for (var i = p2.length; i < CAP.P2; i++) h += '<button class="slot" data-act="pickprio" data-l="P2">+ Add a P2</button>';
  h += '</div></section>';

  // Play
  var q = playQueue();
  h += '<section><div class="sechead"><h2>Play</h2><span class="meta">one at a time · ' + q.length + ' left</span></div>';
  if (q.length) {
    var x = q[0], tk = x.task;
    h += '<div class="play"><div class="k"><span>' + areaDot(tk.area) + ' ' + esc(areaName(tk.area) || 'No area')
      + (tk.prio && tk.prioDay === t ? ' · ' + tk.prio : '') + '</span><span>' + esc(tk.est ? '~' + tk.est : '') + '</span></div>'
      + '<div class="t"><span>' + esc(tk.ic || '•') + '</span><span>' + esc(tk.t) + '</span></div>'
      + '<div class="w">' + esc(x.why) + '</div>'
      + '<div class="acts"><button class="btn accent" data-act="playdo" data-id="' + tk.id + '">Do it</button>'
      + '<button class="btn soft" data-act="playskip" data-id="' + tk.id + '">Skip ›</button></div>'
      + '<button class="link" style="justify-self:start" data-act="open" data-v="task" data-id="' + tk.id + '">Open the task</button></div>';
  } else {
    h += '<div class="empty">Nothing waiting. Capture something, or enjoy the gap.</div>';
  }
  h += '</section>';

  // Areas
  h += '<section><div class="sechead"><h2>Life areas</h2><button class="link" data-act="tab" data-v="areas">All</button></div><div class="areas">'
    + areasSorted().map(function (a) {
      return '<button class="acard" style="--c:' + esc(a.color) + '" data-act="open" data-v="area" data-id="' + a.id + '">'
        + '<span class="n"><span class="dot" style="background:' + esc(a.color) + '"></span><span>' + esc(a.short) + '</span></span>'
        + '<span class="st st-' + a.state.toLowerCase().replace(/\s/g, '') + '">' + esc(a.state) + '</span>'
        + '<span class="f">' + esc(a.focus || '') + '</span></button>';
    }).join('') + '</div></section>';

  // Rescheduled
  var rs = rescheduled().slice(0, 4);
  if (rs.length) h += '<section><div class="sechead"><h2>Slipped, rescheduled</h2><span class="meta">nothing overdue</span></div><div style="display:grid;gap:6px">'
    + rs.map(slipRow).join('') + '</div></section>';

  // Log
  var log = Store.all('log').filter(function (l) { return l.day === t; }).sort(function (a, b) { return b.at - a.at; });
  h += '<section><div class="sechead"><h2>Today\'s log</h2><span class="meta">writes itself</span></div>'
    + (log.length ? '<div class="log">' + log.slice(0, 12).map(function (l) {
      return '<div class="logrow"><time>' + clock(l.at) + '</time>' + areaDot(l.area) + '<span>' + esc(l.text) + '</span></div>';
    }).join('') + '</div>' : '<div class="empty">Nothing yet. Finishing a task, setting a priority or capturing something adds a line here.</div>')
    + '</section>';
  return h;
};

function prioRow(tk) {
  return '<div class="prio ' + (tk.prio === 'P1' ? 'p1' : '') + (tk.done ? ' done' : '') + '">'
    + '<span class="pill ' + tk.prio.toLowerCase() + '">' + tk.prio + '</span>'
    + '<button class="grow" style="text-align:left" data-act="open" data-v="task" data-id="' + tk.id + '"><div class="t">' + esc(tk.t) + '</div>'
    + '<div class="s">' + areaDot(tk.area) + esc(areaName(tk.area) || 'No area') + (tk.est ? ' · ' + esc(tk.est) : '') + ' ' + exPill(tk) + '</div></button>'
    + '<button class="ck' + (tk.done ? ' on' : '') + '" data-act="toggle" data-id="' + tk.id + '" aria-label="' + (tk.done ? 'Mark not done' : 'Mark done') + '"><span></span></button></div>';
}
function slipRow(tk) {
  var now = tk.slip.now === 'drifted' ? 'Drifted' : tk.slip.now === 'whenever' ? 'Whenever' : shortDate(tk.slip.now);
  return '<button class="slip" data-act="open" data-v="task" data-id="' + tk.id + '">' + areaDot(tk.area)
    + '<span class="grow">' + esc(tk.t) + '</span><s>' + esc(shortDate(tk.slip.was)) + '</s><span class="faint">→</span><b>' + esc(now) + '</b></button>';
}

ACTS.clearex = function () { clearExamples(); toast('Examples cleared'); };
ACTS.toggle = function (d) {
  var on = completeTask(d.id);
  toast(on ? 'Done' : 'Marked not done', function () { completeTask(d.id, !on); });
};
ACTS.playdo = function (d) {
  completeTask(d.id, true);
  toast('Done. Next one is up.', function () { completeTask(d.id, false); });
};
ACTS.playskip = function (d) {
  var k = today(); playSkips[k] = playSkips[k] || {}; playSkips[k][d.id] = 1; render();
};

/* Pick a priority: choose from today's and this week's tasks, or swap. */
ACTS.pickprio = function (d) {
  var level = d.l, full = prioCount(level) >= CAP[level];
  if (full) return swapSheet(level);
  var cands = candidates();
  var pool = ['today', 'slipped', 'tomorrow', 'week', 'whenever'].reduce(function (a, b) { return a.concat(tasksIn(b)); }, [])
    .filter(function (t) { return !t.done && !(t.prio && t.prioDay === today()) && cands.indexOf(t) < 0; });
  var row = function (t, why) {
    return '<button class="row" data-act="setprio" data-id="' + t.id + '" data-l="' + level + '"><span class="ic">' + esc(t.ic || '•') + '</span>'
      + '<span class="grow"><div class="t">' + esc(t.t) + '</div><div class="s">' + areaDot(t.area) + esc(areaName(t.area) || 'No area')
      + ' · ' + esc(why || (t.due ? shortDate(t.due) : 'Whenever')) + '</div></span></button>';
  };
  openSheet('<div class="shead"><h2>Choose a ' + level + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<p class="note">' + (level === 'P1' ? 'The one thing that makes today count.' : 'Two more that matter. That\'s the whole list.') + '</p>'
    + (cands.length ? '<div class="lbl">Swapped out yesterday</div><div class="list">' + cands.map(function (t) { return row(t, 'from yesterday'); }).join('') + '</div>' : '')
    + '<div class="list">' + pool.slice(0, 30).map(function (t) { return row(t); }).join('') + '</div>'
    + (pool.length ? '' : '<div class="empty">No open tasks yet. Capture one first.</div>'));
};
ACTS.setprio = function (d) { setPrio(d.id, d.l); closeSheet(); toast(d.l + ' set'); };
function swapSheet(level) {
  var cur = prios().filter(function (t) { return t.prio === level; });
  openSheet('<div class="shead"><h2>Cap reached</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<p class="note">Today holds 1 P1 and 2 P2. Swap one out to add something new. It moves to tomorrow\'s candidates.</p>'
    + '<div class="list">' + cur.map(function (t) {
      return '<button class="row" data-act="swap" data-id="' + t.id + '" data-l="' + level + '"><span class="pill ' + level.toLowerCase() + '">' + level + '</span>'
        + '<span class="grow"><div class="t">' + esc(t.t) + '</div><div class="s">Swap out to tomorrow</div></span></button>';
    }).join('') + '</div>');
}
ACTS.swap = function (d) { swapOut(d.id); closeSheet(); ACTS.pickprio({ l: d.l }); };
