/* ═══ CHALLENGES ════════════════════════════════════════════════════
   Built on habits. A day counts when every chosen habit is done (a habit
   that isn't due that day doesn't count against it). Strict: a missed day
   ends the run, and you start again when you're ready. Grace: one missed
   day in any 7 is forgiven. Nothing turns red; old runs stay as history.
   { name, habits:[ids], days, start, mode:'strict'|'grace', runs:[{start, ended, reached}] } */
function chHabits(c) { return (c.habits || []).map(function (id) { return Store.get('habits', id); }).filter(function (h) { return h && !h.archived; }); }
function chDayOK(c, d) {
  var hs = chHabits(c); if (!hs.length) return false;
  return hs.every(function (h) { return !dueOn(h, d) || habitDone(h, d); });
}
function challengesLive() { return Store.all('challenges').filter(function (c) { return !c.archived; }).sort(function (a, b) { return (a.created || 0) - (b.created || 0); }); }
/* Walks the run day by day. cells: done | grace | miss | today | todaydone | future */
function chState(c) {
  var t = today(), n = c.days, cells = [], done = 0, lastMiss = null, ended = null;
  for (var k = 0; k < n; k++) {
    var d = addDays(c.start, k);
    if (ended) { cells.push('off'); continue; }
    if (d > t) { cells.push('future'); continue; }
    if (d === t) { var ok = chDayOK(c, d); if (ok) done++; cells.push(ok ? 'todaydone' : 'today'); continue; }
    if (chDayOK(c, d)) { done++; cells.push('done'); continue; }
    if (c.mode === 'grace' && (!lastMiss || dayDiff(lastMiss, d) >= 7)) { lastMiss = d; cells.push('grace'); continue; }
    ended = d; cells.push('miss');
  }
  var day = Math.min(n, dayDiff(c.start, t) + 1);
  return { cells: cells, done: done, ended: ended, day: day, upcoming: c.start > t, complete: !ended && done === n,
    leftToday: c.start <= t && !ended ? chHabits(c).filter(function (h) { return dueOn(h, t) && !habitDone(h, t); }) : [] };
}
function chLine(c, s) {
  if (s.upcoming) return 'Starts ' + shortDate(c.start).toLowerCase();
  if (s.complete) return 'Complete · ' + c.days + ' of ' + c.days + ' days';
  if (s.ended) return 'Missed ' + DOW[parseYmd(s.ended).getDay()] + ' · start again when you\'re ready';
  return 'Day ' + s.day + ' of ' + c.days + (s.leftToday.length ? ' · ' + s.leftToday.length + ' left today' : ' · today done ✓');
}
/* Card at the top of Habits. */
function challengeCards() {
  var cs = challengesLive();
  if (!cs.length) return '<button class="chcard empty" data-act="newchallenge" data-n="111"><b>🔥 Try a challenge</b><span>Pick habits, pick a length (30, 75, 111 days). Every day you do them all fills a square.</span></button>';
  return cs.map(function (c) {
    var s = chState(c), pct = Math.round(100 * s.done / c.days);
    return '<button class="chcard' + (s.ended ? ' ended' : '') + '" data-act="open" data-v="challenge" data-id="' + c.id + '"><div class="chh"><b>🔥 ' + esc(c.name) + '</b><span>' + esc(chLine(c, s)) + '</span></div>'
      + '<div class="chbar"><i style="width:' + pct + '%"></i></div>'
      + '<div class="chhab">' + chHabits(c).map(function (h) { return '<span class="' + (habitDone(h, today()) ? 'on' : '') + '">' + esc(h.ic) + '</span>'; }).join('') + '</div></button>';
  }).join('') + '<button class="link" data-act="newchallenge" style="justify-self:start">+ New challenge</button>';
}
/* "· Day 12/111" for Today's Habits heading. */
function challengeTag() {
  var c = challengesLive().filter(function (x) { var s = chState(x); return !s.ended && !s.upcoming && !s.complete; })[0];
  if (!c) return ''; var s = chState(c);
  return ' · Day ' + s.day + '/' + c.days;
}

TITLES.challenge = function (id) { var c = Store.get('challenges', id); return c ? c.name : 'Challenge'; };
VIEWS.challenge = function (id) {
  var c = Store.get('challenges', id); if (!c) return '<div class="empty">This challenge is gone.</div>';
  var s = chState(c), t = today(), runs = c.runs || [];
  var h = '<div class="stats3"><div><span>' + (s.upcoming ? 'Starts' : 'Day') + '</span><b>' + (s.upcoming ? esc(shortDate(c.start)) : s.day + '<small>/' + c.days + '</small>') + '</b></div>'
    + '<div><span>Days done</span><b>' + s.done + '</b></div><div><span>Restarts</span><b>' + runs.length + '</b></div></div>';
  if (s.ended) h += '<div class="card flat chend"><p><b>The run ended on ' + esc(longDate(s.ended)) + '.</b> You got ' + s.done + ' day' + (s.done === 1 ? '' : 's') + ' in. That stays on the record.</p>'
    + '<div class="btnrow"><button class="btn accent" data-act="chrestart" data-id="' + c.id + '">Start again today</button></div></div>';
  if (s.complete) h += '<div class="card flat"><p><b>🎉 All ' + c.days + ' days done.</b></p><div class="btnrow"><button class="btn soft" data-act="chrestart" data-id="' + c.id + '">Go again</button></div></div>';
  // The wall
  h += '<section><div class="sechead"><h2>The wall</h2><span class="meta">' + (c.mode === 'grace' ? 'grace: 1 miss per 7 days' : 'strict') + '</span></div>'
    + '<div class="wall" style="--cols:' + (c.days > 60 ? 12 : 10) + '" role="img" aria-label="' + s.done + ' of ' + c.days + ' days done">'
    + s.cells.map(function (x, i) { return '<i class="' + x + '" title="Day ' + (i + 1) + ' · ' + esc(shortDate(addDays(c.start, i))) + '"></i>'; }).join('') + '</div>'
    + '<div class="wallkey small faint"><span><i class="done"></i>done</span>' + (c.mode === 'grace' ? '<span><i class="grace"></i>forgiven</span>' : '') + '<span><i class="today"></i>today</span></div></section>';
  // Today
  if (!s.ended && !s.upcoming && !s.complete) h += '<section><div class="sechead"><h2>Today</h2><span class="meta">' + (s.leftToday.length ? s.leftToday.length + ' left' : 'all done ✓') + '</span></div><div class="hchips">'
    + chHabits(c).filter(function (x) { return dueOn(x, t); }).map(habitChip).join('') + '</div></section>';
  if (runs.length) h += '<section><div class="sechead"><h2>Earlier runs</h2></div><div class="list">' + runs.slice().reverse().map(function (r) {
    return '<div class="row"><span class="grow small">' + esc(shortDate(r.start)) + ' → ' + esc(shortDate(r.ended)) + '</span><span class="small">' + r.reached + ' day' + (r.reached === 1 ? '' : 's') + '</span></div>';
  }).join('') + '</div></section>';
  h += '<div class="btnrow"><button class="btn soft" data-act="editchallenge" data-id="' + c.id + '">Edit</button><button class="btn ghost" data-act="delchallenge" data-id="' + c.id + '">Delete</button></div>';
  return h;
};
ACTS.chrestart = function (d) {
  var c = Store.get('challenges', d.id), s = chState(c);
  var runs = (c.runs || []).concat([{ start: c.start, ended: s.ended || today(), reached: s.done }]);
  Store.patch('challenges', c.id, { start: today(), runs: runs });
  logEvent('Started ' + c.name + ' again'); toast('Day 1. Go.');
};
ACTS.delchallenge = function (d) {
  var c = Store.get('challenges', d.id); Store.del('challenges', d.id); pop();
  toast('Challenge deleted', function () { Store.put('challenges', c); });
};

/* ── builder ─────────────────────────────────────────────────────── */
var chDraft = null;
ACTS.newchallenge = function (d) {
  var n = +(d && d.n) || 30;
  chDraft = { id: null, name: '', habits: [], days: n, mode: 'strict', when: 'today' };
  chPaint();
};
ACTS.editchallenge = function (d) {
  var c = Store.get('challenges', d.id);
  chDraft = { id: c.id, name: c.name, habits: (c.habits || []).slice(), days: c.days, mode: c.mode, when: null };
  chPaint();
};
function chPaint() {
  var x = chDraft, hs = habitsSorted();
  var h = '<div class="shead"><h2>' + (x.id ? 'Edit challenge' : 'New challenge') + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<div class="field"><label for="chname">Name</label><input id="chname" class="input" placeholder="' + x.days + '-day challenge" value="' + esc(x.name) + '" autocomplete="off"></div>'
    + '<div class="field"><span class="lbl">Habits · do all of them each day</span>' + (hs.length ? '<div class="chips">' + hs.map(function (hb) {
      var on = x.habits.indexOf(hb.id) > -1;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="chhab" data-id="' + hb.id + '" aria-pressed="' + on + '">' + esc(hb.ic) + ' ' + esc(hb.n) + '</button>';
    }).join('') + '</div>' : '<p class="note small">Make a habit first, then build a challenge on it.</p>') + '</div>'
    + '<div class="field"><span class="lbl">Length</span><div class="chips">' + [30, 75, 111].map(function (n) {
      return '<button type="button" class="chip' + (x.days === n ? ' on' : '') + '" data-act="chdays" data-n="' + n + '">' + n + ' days</button>';
    }).join('') + '<label class="sr" for="chdays">Other length</label><input id="chdays" class="input" inputmode="numeric" style="width:96px" placeholder="Other" value="' + ([30, 75, 111].indexOf(x.days) < 0 ? x.days : '') + '" data-act-change="chdaysin"></div></div>'
    + '<div class="field"><span class="lbl">If you miss a day</span><div class="chips">'
    + [['strict', 'Strict: start again'], ['grace', 'Grace: 1 miss per 7 days']].map(function (m) {
      return '<button type="button" class="chip' + (x.mode === m[0] ? ' on' : '') + '" data-act="chmode" data-m="' + m[0] + '">' + m[1] + '</button>';
    }).join('') + '</div></div>'
    + (x.id ? '' : '<div class="field"><span class="lbl">Start</span><div class="chips">' + [['today', 'Today'], ['tomorrow', 'Tomorrow']].map(function (w) {
      return '<button type="button" class="chip' + (x.when === w[0] ? ' on' : '') + '" data-act="chwhen" data-w="' + w[0] + '">' + w[1] + '</button>';
    }).join('') + '</div></div>')
    + '<button class="btn accent block" data-act="chsave"' + (x.habits.length ? '' : ' disabled') + '>' + (x.id ? 'Save' : 'Start the challenge') + '</button>';
  if ($('#sheetbg').hidden) openSheet(h); else { $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div>' + h; }
}
function chKeepName() { var el = $('#chname'); if (el && chDraft) chDraft.name = el.value; }
ACTS.chhab = function (d) { chKeepName(); var i = chDraft.habits.indexOf(d.id); if (i > -1) chDraft.habits.splice(i, 1); else chDraft.habits.push(d.id); chPaint(); };
ACTS.chdays = function (d) { chKeepName(); chDraft.days = +d.n; chPaint(); };
ACTS.chdaysin = function (d, el) { chKeepName(); var n = Math.round(+el.value); if (n >= 2 && n <= 400) { chDraft.days = n; chPaint(); } };
ACTS.chmode = function (d) { chKeepName(); chDraft.mode = d.m; chPaint(); };
ACTS.chwhen = function (d) { chKeepName(); chDraft.when = d.w; chPaint(); };
ACTS.chsave = function () {
  chKeepName(); var x = chDraft; if (!x || !x.habits.length) return;
  var name = (x.name || '').trim() || x.days + '-day challenge';
  if (x.id) { Store.patch('challenges', x.id, { name: name, habits: x.habits, days: x.days, mode: x.mode }); closeSheet(); toast('Challenge updated'); return; }
  var c = Store.put('challenges', { name: name, habits: x.habits, days: x.days, mode: x.mode, start: x.when === 'tomorrow' ? addDays(today(), 1) : today(), runs: [] }, true);
  logEvent('Started ' + name); chDraft = null; closeSheet(); push('challenge', c.id); toast('Day 1. Go.');
};
