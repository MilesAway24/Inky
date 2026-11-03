/* ═══ RESCHEDULE ════════════════════════════════════════════════════
   From Miles's screenshots: every overdue task in one sheet. Tick the
   ones to move, then Spread / Someday / Delete them, or give them a new
   date (and a time on the ruler) with an optional note about what
   happened. One Undo covers the whole batch. */
var rs = null; // {sel:{id:1}, open, due, month, time, remark}

function rsTasks() { return slipped().sort(function (a, b) { return (a.due || '').localeCompare(b.due || '') || (a.created || 0) - (b.created || 0); }); }
function rsSelected() { return rsTasks().filter(function (t) { return rs.sel[t.id]; }); }
function batchUndo(ids) { var u = ids.map(snapshot); return function () { u.forEach(function (f) { f(); }); }; }

ACTS.reschedule = function () {
  var list = rsTasks();
  if (!list.length) { toast('Nothing overdue'); return; }
  rs = { sel: {}, open: true, due: null, month: today().slice(0, 8) + '01', time: null, remark: '' };
  list.forEach(function (t) { rs.sel[t.id] = 1; });
  openSheet('<div id="rsbox"></div>', function () { rsPaint(); }, function () { rs = null; });
};
function rsPaint() {
  var box = $('#rsbox'); if (!box || !rs) return;
  var scroller = $('#sheet'), keep = scroller.scrollTop;
  var all = rsTasks(), sel = rsSelected(), n = sel.length, t = today();
  if (!all.length) { closeSheet(); return; }
  var h = '<div class="shead"><div><h2>Reschedule</h2><div class="small muted">' + n + ' of ' + all.length + ' overdue task' + (all.length === 1 ? '' : 's') + '</div></div>'
    + '<button type="button" class="link" data-act="close">Cancel</button></div>';
  // the list
  h += '<div class="odbox"><button type="button" class="odhead" data-act="rsopen" aria-expanded="' + rs.open + '"><span>⚠️ Overdue tasks · ' + n + ' selected</span><span aria-hidden="true">' + (rs.open ? '▴' : '▾') + '</span></button>';
  if (rs.open) h += '<div class="odlinks"><button type="button" class="link" data-act="rsall">Select all</button><span class="faint">·</span><button type="button" class="link" data-act="rsnone">Clear</button></div>'
    + all.map(function (x) {
      var on = !!rs.sel[x.id];
      return '<label class="odrow"><input type="checkbox" data-act-change="rspick" data-id="' + x.id + '"' + (on ? ' checked' : '') + '><span class="grow">' + esc(x.t) + '</span>'
        + '<span class="od">Overdue · ' + esc(shortDate(x.due)) + '</span></label>';
    }).join('');
  h += '</div>';
  // quick sweep
  h += '<div class="wlab"><span>⚡ ADHD overdue sweep</span></div>'
    + '<div class="sweep3"><button type="button" class="btn soft" data-act="rsspread"' + (n ? '' : ' disabled') + '>🔀 Spread</button>'
    + '<button type="button" class="btn soft" data-act="rssomeday"' + (n ? '' : ' disabled') + '>📥 Someday</button>'
    + '<button type="button" class="btn ghost danger" data-act="rsdelete"' + (n ? '' : ' disabled') + '>🗑 Delete</button></div>'
    + '<p class="note small">Spread puts them on the emptiest days this week, at most two a day.</p>';
  // new date
  h += '<div class="wlab"><span>New date</span>' + (rs.due ? '<b class="small" style="text-transform:none;letter-spacing:0;color:var(--ink)">' + esc(shortDate(rs.due)) + '</b>' : '') + '</div>'
    + monthGrid(rs.month, rs.due, { pick: 'rsday', nav: 'rsmonth', exceptId: null })
    + '<div class="sweep3"><button type="button" class="btn soft' + (rs.due === t ? ' on' : '') + '" data-act="rsday" data-d="' + t + '">Today</button>'
    + '<button type="button" class="btn soft' + (rs.due === addDays(t, 1) ? ' on' : '') + '" data-act="rsday" data-d="' + addDays(t, 1) + '">Tomorrow</button>'
    + '<button type="button" class="btn soft" data-act="rsday" data-d="">Clear</button></div>'
    + '<p class="note small">• dot = other tasks already scheduled that day</p>';
  // new time
  h += '<div class="wlab"><span>New time</span>' + (rs.time ? '<button type="button" class="link" data-act="rsnotime">No time</button>' : '<span class="faint" style="text-transform:none;letter-spacing:0">optional · keeps each task\'s own</span>') + '</div>'
    + '<div class="big2 sm" id="rsbig">' + (rs.time ? bigTime(rs.time) : '—') + '</div>'
    + rulerHtml('rsruler', rs.time)
    + '<div class="scrollx">' + ['07:00', '09:00', '12:00', '17:00', '19:00', '21:00'].map(function (p) {
      return '<button type="button" class="chip' + (rs.time === p ? ' on' : '') + '" data-act="rspreset" data-t="' + p + '">' + esc(fmtTime(p).toUpperCase().replace(/(AM|PM)$/, ' $1')) + '</button>';
    }).join('') + '</div>';
  // remark
  h += '<div class="field"><label for="rsremark" class="wlab" style="margin:0"><span>Overdue remark (optional)</span></label>'
    + '<textarea id="rsremark" class="input" style="min-height:80px" placeholder="Why was this missed? What changed?">' + esc(rs.remark) + '</textarea></div>';
  h += '<button type="button" class="btn accent block big3" data-act="rsgo"' + (n && rs.due ? '' : ' disabled') + '>Reschedule ' + n + ' task' + (n === 1 ? '' : 's') + '</button>'
    + (n && !rs.due ? '<p class="note small" style="text-align:center">Pick a new date, or use Spread or Someday.</p>' : '');
  box.innerHTML = h;
  scroller.scrollTop = keep;
  $('#rsremark').addEventListener('input', function (e) { rs.remark = e.target.value; });
  makeRuler({ ruler: $('#rsruler'), strip: $('#rsruler .rstrip'), start: rs.time ? mins(rs.time) : 540,
    onMove: function (m) { rs.time = hm(m); $('#rsbig').innerHTML = bigTime(rs.time); },
    onSet: function () { $$('[data-act=rspreset]').forEach(function (b) { b.classList.toggle('on', b.dataset.t === rs.time); }); } });
}
ACTS.rsopen = function () { rs.open = !rs.open; rsPaint(); };
ACTS.rsall = function () { rsTasks().forEach(function (t) { rs.sel[t.id] = 1; }); rsPaint(); };
ACTS.rsnone = function () { rs.sel = {}; rsPaint(); };
ACTS.rspick = function (d, el) { if (el.checked) rs.sel[d.id] = 1; else delete rs.sel[d.id]; rsPaint(); };
ACTS.rsday = function (d) { rs.due = d.d || null; if (d.d) rs.month = d.d.slice(0, 8) + '01'; rsPaint(); };
ACTS.rsmonth = function (d) { var f = parseYmd(rs.month); f.setMonth(f.getMonth() + (+d.n)); rs.month = ymd(f); rsPaint(); };
ACTS.rspreset = function (d) { rs.time = d.t; rsPaint(); };
ACTS.rsnotime = function () { rs.time = null; rsPaint(); };

function rsFinish(msg, undo) { rs = null; sheetOnClose = null; closeSheet(); toast(msg, undo); }
ACTS.rsspread = function () {
  var sel = rsSelected(), ids = sel.map(function (t) { return t.id; }), undo = batchUndo(ids), t = today();
  var days = range(7).map(function (i) { var d = addDays(t, i); return { d: d, n: busyOn(d), added: 0 }; });
  var used = {};
  sel.forEach(function (x) {
    var open = days.filter(function (d) { return d.added < 2; });
    if (!open.length) open = days;
    open.sort(function (a, b) { return (a.n + a.added) - (b.n + b.added) || a.d.localeCompare(b.d); });
    var day = open[0]; day.added++; used[day.d] = 1;
    moveTask(x.id, day.d);
  });
  var ds = Object.keys(used).sort();
  logEvent('Spread ' + sel.length + ' overdue task' + (sel.length === 1 ? '' : 's') + ' over the week');
  rsFinish('Spread over ' + DOW[parseYmd(ds[0]).getDay()] + (ds.length > 1 ? '–' + DOW[parseYmd(ds[ds.length - 1]).getDay()] : ''), undo);
};
ACTS.rssomeday = function () {
  var sel = rsSelected(), undo = batchUndo(sel.map(function (t) { return t.id; }));
  sel.forEach(function (x) { moveTask(x.id, 'whenever'); });
  rsFinish(sel.length + ' moved to Someday', undo);
};
ACTS.rsdelete = function () {
  var sel = rsSelected(), undo = batchUndo(sel.map(function (t) { return t.id; }));
  sel.forEach(function (x) { Store.del('tasks', x.id); });
  rsFinish(sel.length + ' deleted', undo);
};
ACTS.rsgo = function () {
  if (!rs || !rs.due) return;
  var sel = rsSelected(), undo = batchUndo(sel.map(function (t) { return t.id; })), remark = rs.remark.trim(), due = rs.due, time = rs.time;
  sel.forEach(function (x) {
    moveTask(x.id, due);
    var cur = Store.get('tasks', x.id), f = {};
    if (time) f.time = time;
    if (remark && cur.slip) f.slip = Object.assign({}, cur.slip, { remark: remark });
    if (Object.keys(f).length) Store.patch('tasks', x.id, f);
  });
  logEvent('Rescheduled ' + sel.length + ' to ' + shortDate(due) + (remark ? ': ' + remark : ''));
  rsFinish(sel.length + ' moved to ' + shortDate(due) + (time ? ' at ' + fmtTime(time) : ''), undo);
};
