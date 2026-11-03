/* ═══ CALENDAR ══════════════════════════════════════════════════════
   Month: a grid with a dot per task (in its area's colour) and a mark
   for journal days. Week: the Status design's view, each day a column of
   blocks coloured by area. Tap a day to see and add to it. Money
   adds paydays (green) and bills (amber) from Payday OS. */
var cal = { mode: 'month', sel: null, month: null };
function monthStart(s) { return s.slice(0, 8) + '01'; }
function tasksOn(d) {
  return Store.all('tasks').filter(function (t) { return t.due === d || (t.done && t.doneAt && ymd(new Date(t.doneAt)) === d && t.due !== d); }).sort(byWhen);
}
TITLES.calendar = 'Calendar';
VIEWS.calendar = function () {
  var t = today(); cal.sel = cal.sel || t; cal.month = cal.month || monthStart(t);
  var h = '<div class="seg" role="tablist">' + [['month', 'Month'], ['week', 'Week']].map(function (v) {
    return '<button role="tab" aria-selected="' + (cal.mode === v[0]) + '" class="' + (cal.mode === v[0] ? 'on' : '') + '" data-act="calmode" data-v="' + v[0] + '">' + v[1] + '</button>';
  }).join('') + '</div>';
  h += cal.mode === 'month' ? monthView() : weekView();
  h += dayDetail(cal.sel);
  return h;
};
function monthView() {
  var t = today(), m = cal.month, first = parseYmd(m), lead = (first.getDay() + 6) % 7;
  var days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  var h = '<div class="calhead"><button class="iconbtn" data-act="calnav" data-n="-1" aria-label="Previous month">' + icon('back') + '</button>'
    + '<b>' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][first.getMonth()] + ' ' + first.getFullYear() + '</b>'
    + '<button class="iconbtn" data-act="calnav" data-n="1" aria-label="Next month">' + icon('chev') + '</button></div>'
    + '<div class="cal">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (x) { return '<span class="wdh">' + x + '</span>'; }).join('');
  for (var i = 0; i < lead; i++) h += '<span></span>';
  var fe = typeof finEventsFor === 'function' ? finEventsFor(m) : {};
  for (var dnum = 1; dnum <= days; dnum++) {
    var d = m.slice(0, 8) + String(dnum).padStart(2, '0'), ts = tasksOn(d), j = entryFor(d);
    h += '<button class="day' + (d === t ? ' today' : '') + (d === cal.sel ? ' sel' : '') + '" data-act="calday" data-d="' + d + '" aria-label="' + esc(shortDate(d)) + ', ' + ts.length + ' tasks">'
      + '<span class="n">' + dnum + '</span><span class="dots">' + ts.slice(0, 4).map(function (x) {
        return '<i style="background:' + areaColor(x.area) + (x.done ? ';opacity:.4' : '') + '"></i>';
      }).join('') + (fe[dnum] ? fe[dnum].map(function (e) { return '<i class="fin ' + e.type + '" title="' + esc(e.title) + '"></i>'; }).join('') : '') + '</span>' + (j && j.mood ? '<span class="mood">' + MOODS[j.mood][0] + '</span>' : '') + '</button>';
  }
  return h + '</div>';
}
function weekView() {
  var t = today(), sel = cal.sel, mon = addDays(sel, -wd(sel));
  var h = '<div class="calhead"><button class="iconbtn" data-act="calweek" data-n="-7" aria-label="Previous week">' + icon('back') + '</button>'
    + '<b>' + esc(absDate(mon)) + ' – ' + esc(absDate(addDays(mon, 6))) + '</b>'
    + '<button class="iconbtn" data-act="calweek" data-n="7" aria-label="Next week">' + icon('chev') + '</button></div>';
  h += '<div class="arealegend">' + areasSorted().map(function (a) { return '<span><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</span>'; }).join('') + '</div>';
  h += '<div class="wk">' + range(7).map(function (i) {
    var d = addDays(mon, i), ts = tasksOn(d), hd = habitsSorted().filter(function (x) { return dueOn(x, d); }), hit = hd.filter(function (x) { return mark(x, d) === 1; }).length;
    return '<div class="wkday' + (d === t ? ' today' : '') + (d === sel ? ' sel' : '') + '"><button class="wkh" data-act="calday" data-d="' + d + '"><b>' + DOW[parseYmd(d).getDay()] + '</b><span>' + parseYmd(d).getDate() + '</span></button>'
      + '<div class="blocks">' + (ts.length ? ts.map(function (x) {
        return '<button class="blk' + (x.done ? ' done' : '') + '" style="--c:' + areaColor(x.area) + '" data-act="open" data-v="task" data-id="' + x.id + '">' + (x.time ? esc(fmtTime(x.time)) + ' ' : '') + esc(x.t) + '</button>';
      }).join('') : '<span class="faint small">Nothing planned</span>') + '</div>'
      + (hd.length && d <= t ? '<span class="hab small faint">' + hit + '/' + hd.length + ' habits</span>' : '') + '</div>';
  }).join('') + '</div>';
  return h;
}
function dayDetail(d) {
  var ts = tasksOn(d), j = entryFor(d), t = today();
  var hs = habitsSorted().filter(function (x) { return dueOn(x, d); });
  var h = '<section class="card" style="display:grid;gap:10px"><div class="sechead" style="margin:0"><h2>' + esc(shortDate(d)) + '</h2>'
    + '<span class="meta">' + ts.filter(function (x) { return !x.done; }).length + ' open</span></div>';
  h += ts.length ? '<div class="list">' + ts.map(taskRow).join('') + '</div>' : '<p class="note">Nothing due.</p>';
  var fe = typeof finEventsFor === 'function' ? (finEventsFor(monthStart(d))[parseYmd(d).getDate()] || []) : [];
  if (fe.length) h += '<div class="list">' + fe.map(function (e) {
    return '<button class="row" data-act="tab" data-v="money"><span class="dot fin ' + e.type + '"></span><span class="grow t">' + esc(e.title) + '</span><span class="amt' + (e.type === 'pay' ? ' good' : '') + '">' + (e.type === 'pay' ? '+' : '−') + esc(fmtMoney(e.amount)) + '</span></button>';
  }).join('') + '</div>';
  h += '<form class="addstep" data-form="caladd" data-d="' + d + '"><label class="sr" for="caladd">Add a task on this day</label><input id="caladd" class="input" placeholder="Add a task on ' + esc(shortDate(d)) + '" autocomplete="off"><button class="btn soft" type="submit">Add</button></form>';
  if (hs.length && d <= t) h += '<div class="small muted">Habits: ' + hs.map(function (x) { var m = mark(x, d); return esc(x.ic) + (m === 1 ? '✓' : m === 2 ? '–' : '·'); }).join('  ') + '</div>';
  if (j && (j.mood || j.text)) h += '<button class="row" data-act="open" data-v="entry" data-id="' + j.id + '"><span class="grow"><div class="s">Journal' + (j.mood ? ' · ' + MOODS[j.mood][0] + ' ' + MOODS[j.mood][1] : '') + '</div><div class="t jt">' + esc(j.text || '') + '</div></span></button>';
  return h + '</section>';
}
ACTS.calmode = function (d) { cal.mode = d.v; render(); };
ACTS.calday = function (d) { cal.sel = d.d; render(); };
ACTS.calnav = function (d) {
  var f = parseYmd(cal.month); f.setMonth(f.getMonth() + (+d.n)); cal.month = ymd(f);
  cal.sel = cal.month.slice(0, 7) === today().slice(0, 7) ? today() : cal.month; render();
};
ACTS.calweek = function (d) { cal.sel = addDays(cal.sel, +d.n); cal.month = monthStart(cal.sel); render(); };
ACTS.form_caladd = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return; inp.value = '';
  Store.put('tasks', { t: v, area: null, due: d.d, done: false, steps: [], note: '' });
  render(false, true); toast('Added to ' + shortDate(d.d));
};
