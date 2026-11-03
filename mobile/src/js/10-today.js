/* ═══ TODAY ═════════════════════════════════════════════════════════
   Money, then the Play card (one thing at a time), habits, life areas,
   and the day's log. */
TITLES.today = 'Today';
VIEWS.today = function () {
  var d = new Date(), t = today();
  var inboxN = Store.all('inbox').length, slipN = slipped().length;
  var h = '<div class="dateline">' + DOWL[d.getDay()] + ' · ' + d.getDate() + ' ' + MON[d.getMonth()] + '</div>';
  h += jumpTiles(['habits', 'goals', 'notes', 'projects', 'tools', 'calendar']);

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

  if (typeof moneyStrip === 'function') h += moneyStrip();

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

  // Habits due today
  var hd = habitsDueToday();
  if (hd.length) {
    var hdone = hd.filter(function (x) { return mark(x, t) === 1; }).length;
    h += '<section><div class="sechead"><h2>Habits today</h2><span class="meta">' + hdone + '/' + hd.length + '</span></div><div class="hchips">'
      + hd.map(function (x) {
        var m = mark(x, t);
        return '<button class="hchip' + (m === 1 ? ' on' : '') + (m === 2 ? ' skip' : '') + '" style="--c:' + esc(x.color) + '" data-act="habtoggle" data-id="' + x.id + '" aria-pressed="' + (m === 1) + '">'
          + '<span>' + esc(x.ic) + '</span>' + esc(x.n) + (m === 1 ? ' ✓' : '') + '</button>';
      }).join('') + '</div></section>';
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
  var rs = rescheduled().slice(0, 4);
  if (rs.length) h += '<section><div class="sechead"><h2>Slipped, rescheduled</h2><span class="meta">nothing overdue</span></div><div style="display:grid;gap:6px">'
    + rs.map(slipRow).join('') + '</div></section>';

  // Log
  var log = Store.all('log').filter(function (l) { return l.day === t; }).sort(function (a, b) { return b.at - a.at; });
  h += '<section><div class="sechead"><h2>Today\'s log</h2><span class="meta">writes itself</span></div>'
    + (log.length ? '<div class="log">' + log.slice(0, 12).map(function (l) {
      return '<div class="logrow"><time>' + clock(l.at) + '</time>' + areaDot(l.area) + '<span>' + esc(l.text) + '</span></div>';
    }).join('') + '</div>' : '<div class="empty">Nothing yet. Finishing a task, marking a habit or capturing something adds a line here.</div>')
    + '</section>';
  return h;
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
