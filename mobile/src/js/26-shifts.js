/* ═══ SHIFTS ════════════════════════════════════════════════════════
   His week runs on shifts (iCare EMS truck, Safeway closes) that change
   weekly. Enter them fast on a week grid; MossOS then shows a pre-shift
   checklist, a post-shift wind-down, keeps big tasks off shift days, and
   estimates the paycheck from hours.
   shifts: { date, job, start:'HH:MM', end:'HH:MM' (earlier = past midnight), worked, note, checks:[bool], wound } */
var SHIFT_DEFAULTS = {
  id: 'shiftcfg',
  jobs: [{ id: 'icare', name: 'iCare EMS', ic: '🚑', color: '#E2574C', rate: null, takeHome: 80 },
    { id: 'safeway', name: 'Safeway', ic: '🛒', color: '#5B9BF5', rate: 20.5, takeHome: 80 }],
  presets: [{ id: 'p1', label: 'Truck day', job: 'icare', start: '07:00', end: '19:00' },
    { id: 'p2', label: 'Truck night', job: 'icare', start: '19:00', end: '07:00' },
    { id: 'p3', label: 'Safeway close', job: 'safeway', start: '16:00', end: '23:00' }],
  checklist: ['Uniform + boots', 'ID + badge', 'Meds', 'Water jug', 'Packed meals', 'Phone charger'],
  before: 120
};
function shiftCfg() { var c = Store.get('meta', 'shiftcfg'); return c ? Object.assign({}, SHIFT_DEFAULTS, c) : JSON.parse(JSON.stringify(SHIFT_DEFAULTS)); }
function shiftCfgSave(f) { var c = shiftCfg(); Store.put('meta', Object.assign(c, f, { id: 'shiftcfg' })); }
function shiftJob(id) { return shiftCfg().jobs.filter(function (j) { return j.id === id; })[0] || { id: id, name: 'Work', ic: '💼', color: '#8E8E8A', rate: null, takeHome: 80 }; }
function shiftOn(d) { return Store.all('shifts').filter(function (s) { return s.date === d; }).sort(function (a, b) { return a.start.localeCompare(b.start); }); }
function shiftStartAt(s) { return new Date(s.date + 'T' + s.start + ':00'); }
function shiftEndAt(s) { var e = new Date(s.date + 'T' + s.end + ':00'); if (s.end <= s.start) e.setDate(e.getDate() + 1); return e; }
function shiftHours(s) { return s.worked != null ? +s.worked : Math.round((shiftEndAt(s) - shiftStartAt(s)) / 36e5 * 100) / 100; }
function tShort(t) { var h = +t.slice(0, 2), m = t.slice(3), ap = h < 12 ? 'a' : 'p'; h = h % 12 || 12; return h + (m !== '00' ? ':' + m : '') + ap; }
function shiftLabel(s) { return tShort(s.start) + '–' + tShort(s.end); }
function mondayOf(d) { return addDays(d, -wd(d)); }
function payWeekStart(d) { return addDays(d, -((wd(d) - 4 + 7) % 7)); } // Friday on or before
function isShiftDay(d) { return shiftOn(d).length > 0; }
function nextOffDay(from) { var d = addDays(from, 1); for (var i = 0; i < 14 && isShiftDay(d); i++) d = addDays(d, 1); return d; }
function isBigTask(t) { return !!t && (estMinutes(t.est) >= 45 && !!t.est || !!t.project); }
function dayShortName(d) { return DOW[parseYmd(d).getDay()]; }
/* Pay week Fri–Thu: hours per job and an estimated check. */
function payEstimate(d) {
  var ws = payWeekStart(d), we = addDays(ws, 6), by = {};
  Store.all('shifts').filter(function (s) { return s.date >= ws && s.date <= we; }).forEach(function (s) { by[s.job] = (by[s.job] || 0) + shiftHours(s); });
  var rows = Object.keys(by).map(function (k) { var j = shiftJob(k), h = Math.round(by[k] * 100) / 100, g = j.rate ? h * j.rate : null; return { job: j, hours: h, gross: g, take: g != null ? g * (j.takeHome || 80) / 100 : null }; });
  var take = rows.reduce(function (a, r) { return a + (r.take || 0); }, 0);
  return { start: ws, end: we, payday: addDays(ws, 7), rows: rows, hours: rows.reduce(function (a, r) { return a + r.hours; }, 0), take: take, missingRate: rows.some(function (r) { return r.take == null; }) };
}

/* ── the Shifts page ─────────────────────────────────────────────── */
var shWeek = null;
TITLES.shifts = 'Shifts';
VIEWS.shifts = function () {
  var t = today(); shWeek = shWeek || mondayOf(t);
  var pe = payEstimate(t), cfg = shiftCfg();
  var h = '<section class="card hourscard"><div class="sechead" style="margin:0"><h2>This pay week</h2><span class="meta">' + esc(shortDate(pe.start)) + ' – ' + esc(shortDate(pe.end)) + '</span></div>'
    + (pe.rows.length ? '<div class="list">' + pe.rows.map(function (r) {
      return '<div class="row"><span class="dot" style="background:' + esc(r.job.color) + '"></span><span class="grow"><div class="t">' + esc(r.job.name) + '</div><div class="s">' + fmtAmt(r.hours) + ' h'
        + (r.gross != null ? ' × ' + fmtMoney(r.job.rate) + ' = ' + fmtMoney(Math.round(r.gross)) + ' gross' : ' · add your rate below') + '</div></span>'
        + (r.take != null ? '<span class="amt">~' + fmtMoney(Math.round(r.take)) + '</span>' : '') + '</div>';
    }).join('') + '</div><p class="estcheck"><b>Est. check ' + esc(dayShortName(pe.payday)) + ' ' + esc(shortDate(pe.payday)) + ': ~' + fmtMoney(Math.round(pe.take)) + '</b>'
      + '<span class="muted small"> · ' + fmtAmt(pe.hours) + ' h · take-home at your % ' + (pe.missingRate ? '· some hours have no rate yet' : '') + '</span></p>'
      : '<p class="note">No shifts this pay week yet.</p>') + '</section>';
  // Week grid
  var mon = shWeek, days = range(7).map(function (i) { return addDays(mon, i); });
  var weekN = Store.all('shifts').filter(function (s) { return s.date >= mon && s.date <= addDays(mon, 6); }).length;
  h += '<section><div class="calhead"><button class="iconbtn" data-act="shweek" data-n="-7" aria-label="Previous week">' + icon('back') + '</button>'
    + '<b>' + (mon === mondayOf(t) ? 'This week' : mon === addDays(mondayOf(t), 7) ? 'Next week' : esc(absDate(mon))) + ' <span class="muted small">' + esc(shortDate(mon)) + ' – ' + esc(shortDate(addDays(mon, 6))) + '</span></b>'
    + '<button class="iconbtn" data-act="shweek" data-n="7" aria-label="Next week">' + icon('chev') + '</button></div>'
    + '<div class="shweek">' + days.map(function (d) {
      var ss = shiftOn(d);
      return '<div class="shday' + (d === t ? ' today' : '') + '"><button class="shd" data-act="shday" data-d="' + d + '" aria-label="Add a shift on ' + esc(longDate(d)) + '"><b>' + dayShortName(d) + '</b><span>' + parseYmd(d).getDate() + '</span></button>'
        + '<div class="shblocks">' + (ss.length ? ss.map(function (s) { var j = shiftJob(s.job);
          return '<button class="shblk" style="--c:' + esc(j.color) + '" data-act="open" data-v="shift" data-id="' + s.id + '">' + esc(j.ic) + ' ' + esc(shiftLabel(s)) + '</button>'; }).join('') : '<span class="faint small">Off</span>') + '</div>'
        + '<button class="iconbtn" data-act="shday" data-d="' + d + '" aria-label="Add a shift">' + icon('plus', 'sm') + '</button></div>';
    }).join('') + '</div>'
    + (!weekN ? '<button class="btn soft block" data-act="shcopy" style="margin-top:10px">Copy last week</button>' : '') + '</section>';
  // Settings
  h += '<details class="card flat"><summary><b>Jobs, presets and checklist</b></summary><div class="shset">'
    + '<div class="lbl">Jobs · hourly rate and take-home %</div>' + cfg.jobs.map(function (j, i) {
      return '<div class="btnrow shjob"><span class="dot" style="background:' + esc(j.color) + '"></span><input class="input" aria-label="Job name" data-sjob="' + i + '" data-k="name" value="' + esc(j.name) + '" style="flex:2">'
        + '<input class="input" aria-label="Hourly rate for ' + esc(j.name) + '" inputmode="decimal" placeholder="$/h" data-sjob="' + i + '" data-k="rate" value="' + esc(j.rate == null ? '' : j.rate) + '" style="flex:1">'
        + '<input class="input" aria-label="Take-home percent for ' + esc(j.name) + '" inputmode="numeric" placeholder="%" data-sjob="' + i + '" data-k="takeHome" value="' + esc(j.takeHome) + '" style="flex:1"></div>';
    }).join('')
    + '<div class="lbl">Presets</div><div class="chips">' + cfg.presets.map(function (p) {
      return '<span class="chip">' + esc(shiftJob(p.job).ic) + ' ' + esc(p.label) + ' · ' + esc(tShort(p.start) + '–' + tShort(p.end)) + ' <button class="x" data-act="shpredel" data-id="' + p.id + '" aria-label="Remove preset ' + esc(p.label) + '">×</button></span>';
    }).join('') + '</div><p class="note small">Add presets from "Custom time" when you add a shift.</p>'
    + '<div class="lbl">Pre-shift checklist · shows ' + cfg.before / 60 + ' h before</div><div class="chips">' + [60, 90, 120, 180].map(function (m) {
      return '<button class="chip' + (cfg.before === m ? ' on' : '') + '" data-act="shbefore" data-m="' + m + '">' + (m % 60 ? m / 60 : m / 60) + ' h</button>';
    }).join('') + '</div><div class="list">' + cfg.checklist.map(function (c, i) {
      return '<div class="row"><span class="grow">' + esc(c) + '</span><button class="iconbtn" data-act="shckdel" data-i="' + i + '" aria-label="Remove ' + esc(c) + '">' + icon('x', 'sm') + '</button></div>';
    }).join('') + '</div><form class="addstep" data-form="shckadd"><label class="sr" for="shck">Add a checklist item</label><input id="shck" class="input" placeholder="Add an item" autocomplete="off"><button class="btn soft" type="submit">Add</button></form>'
    + '</div></details>';
  return h;
};
VIEWS.shifts.after = function () {
  document.querySelectorAll('[data-sjob]').forEach(function (el) {
    el.addEventListener('change', function () {
      var cfg = shiftCfg(), j = cfg.jobs[+el.dataset.sjob], k = el.dataset.k, v = el.value.trim(); if (!j) return;
      if (k === 'name') { if (v) j.name = v.slice(0, 40); } else if (k === 'rate') j.rate = v === '' ? null : Math.max(0, +v || 0); else j.takeHome = Math.max(1, Math.min(100, Math.round(+v || 80)));
      shiftCfgSave({ jobs: cfg.jobs }); toast('Saved');
    });
  });
};
ACTS.shweek = function (d) { shWeek = addDays(shWeek || mondayOf(today()), +d.n); render(); };
ACTS.shbefore = function (d) { shiftCfgSave({ before: +d.m }); };
ACTS.shckdel = function (d) { var c = shiftCfg().checklist.slice(); c.splice(+d.i, 1); shiftCfgSave({ checklist: c }); };
ACTS.form_shckadd = function (d, f) { var v = $('input', f).value.trim(); if (!v) return; shiftCfgSave({ checklist: shiftCfg().checklist.concat([v.slice(0, 60)]) }); render(false, true); };
ACTS.shpredel = function (d) { shiftCfgSave({ presets: shiftCfg().presets.filter(function (p) { return p.id !== d.id; }) }); };
ACTS.shcopy = function () {
  var mon = shWeek, prev = addDays(mon, -7), made = [];
  Store.all('shifts').filter(function (s) { return s.date >= prev && s.date <= addDays(prev, 6); }).forEach(function (s) {
    made.push(Store.put('shifts', { date: addDays(s.date, 7), job: s.job, start: s.start, end: s.end, worked: null, note: '' }, true).id);
  });
  render();
  if (!made.length) { toast('Last week has no shifts to copy'); return; }
  toast('Copied ' + made.length + ' shift' + (made.length === 1 ? '' : 's'), function () { made.forEach(function (id) { Store.del('shifts', id); }); });
};
/* Tap a day: presets, or a custom time. */
ACTS.shday = function (d) {
  var cfg = shiftCfg(), ss = shiftOn(d.d);
  openSheet('<div class="shead"><h2>' + esc(longDate(d.d)) + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + (ss.length ? '<p class="note small">Already: ' + ss.map(function (s) { return esc(shiftJob(s.job).ic + ' ' + shiftLabel(s)); }).join(', ') + '</p>' : '')
    + '<div class="presetgrid">' + cfg.presets.map(function (p) { var j = shiftJob(p.job);
      return '<button class="btn soft big3" style="--c:' + esc(j.color) + '" data-act="shadd" data-d="' + d.d + '" data-p="' + p.id + '">' + esc(j.ic) + ' ' + esc(p.label) + '<small>' + esc(tShort(p.start) + '–' + tShort(p.end)) + '</small></button>'; }).join('')
    + '<button class="btn ghost big3" data-act="shcustom" data-d="' + d.d + '">Custom time…</button></div>');
};
function addShift(date, job, start, end) {
  var s = Store.put('shifts', { date: date, job: job, start: start, end: end, worked: null, note: '' }, true);
  closeSheet(); toast(esc(shiftJob(job).ic + ' ' + shiftLabel(s)) + ' on ' + esc(shortDate(date)), function () { Store.del('shifts', s.id); });
  return s;
}
ACTS.shadd = function (d) { var p = shiftCfg().presets.filter(function (x) { return x.id === d.p; })[0]; if (p) addShift(d.d, p.job, p.start, p.end); };
var shCustom = null;
ACTS.shcustom = function (d) {
  shCustom = { date: d.d, job: shiftCfg().jobs[0].id, start: '07:00', end: '19:00' };
  shCustomPaint();
};
function shCustomPaint() {
  var x = shCustom, cfg = shiftCfg();
  $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div><div class="shead"><h2>Custom shift · ' + esc(shortDate(x.date)) + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<div class="chips">' + cfg.jobs.map(function (j) { return '<button class="chip' + (x.job === j.id ? ' on' : '') + '" data-act="shcjob" data-j="' + j.id + '">' + esc(j.ic + ' ' + j.name) + '</button>'; }).join('') + '</div>'
    + '<div class="wlab"><span>Starts</span><b id="shcs">' + esc(fmtTime(x.start)) + '</b></div>' + rulerHtml('rs1', x.start)
    + '<div class="wlab"><span>Ends</span><b id="shce">' + esc(fmtTime(x.end)) + '</b></div>' + rulerHtml('rs2', x.end)
    + '<label class="chk"><input type="checkbox" id="shcpre"> Save as a preset</label>'
    + '<button class="btn accent block" data-act="shcsave">Add shift</button>';
  makeRuler({ ruler: $('#rs1'), strip: $('#rs1 .rstrip'), start: mins(x.start), onMove: function (m) { x.start = hm(m); $('#shcs').textContent = fmtTime(x.start); }, onSet: function () {} });
  makeRuler({ ruler: $('#rs2'), strip: $('#rs2 .rstrip'), start: mins(x.end), onMove: function (m) { x.end = hm(m); $('#shce').textContent = fmtTime(x.end); }, onSet: function () {} });
}
ACTS.shcjob = function (d) { shCustom.job = d.j; shCustomPaint(); };
ACTS.shcsave = function () {
  var x = shCustom; if (!x || x.start === x.end) { toast('Start and end can\'t be the same'); return; }
  if ($('#shcpre') && $('#shcpre').checked) {
    var j = shiftJob(x.job); shiftCfgSave({ presets: shiftCfg().presets.concat([{ id: 'p' + Date.now().toString(36), label: j.name + ' ' + tShort(x.start), job: x.job, start: x.start, end: x.end }]) });
  }
  addShift(x.date, x.job, x.start, x.end); shCustom = null;
};

/* ── one shift ───────────────────────────────────────────────────── */
TITLES.shift = function (id) { var s = Store.get('shifts', id); return s ? shiftJob(s.job).name + ' · ' + shortDate(s.date) : 'Shift'; };
VIEWS.shift = function (id) {
  var s = Store.get('shifts', id); if (!s) return '<div class="empty">This shift was removed.</div>';
  var cfg = shiftCfg();
  return '<div class="chips">' + cfg.jobs.map(function (j) { return '<button class="chip' + (s.job === j.id ? ' on' : '') + '" data-act="shsetjob" data-id="' + id + '" data-j="' + j.id + '">' + esc(j.ic + ' ' + j.name) + '</button>'; }).join('') + '</div>'
    + '<div class="props"><div class="prop"><span class="k">Date</span><span class="v">' + esc(longDate(s.date)) + '</span></div>'
    + '<div class="prop"><span class="k">Starts</span><span class="v"><label class="sr" for="shs">Starts</label><input id="shs" type="time" class="input" style="max-width:160px" data-shf="start" value="' + s.start + '"></span></div>'
    + '<div class="prop"><span class="k">Ends</span><span class="v"><label class="sr" for="she">Ends</label><input id="she" type="time" class="input" style="max-width:160px" data-shf="end" value="' + s.end + '"></span></div>'
    + '<div class="prop"><span class="k">Hours</span><span class="v">' + fmtAmt(shiftHours(s)) + ' h' + (s.worked != null ? ' (worked)' : ' (planned)') + '</span></div>'
    + '<div class="prop"><span class="k">Ran long?</span><span class="v"><label class="sr" for="shw">Hours actually worked</label><input id="shw" class="input" inputmode="decimal" style="max-width:160px" placeholder="Worked, e.g. 13.5" data-shf="worked" value="' + (s.worked != null ? s.worked : '') + '"></span></div>'
    + '<div class="prop"><span class="k">Calendar</span><span class="v">' + calBtn(shiftCal(s)) + '</span></div></div>'
    + '<label class="sr" for="shn">Note</label><textarea id="shn" class="input" rows="3" data-shf="note" placeholder="Note (partner, unit, anything)">' + esc(s.note || '') + '</textarea>'
    + '<div class="btnrow"><button class="btn ghost" data-act="shdel" data-id="' + id + '">Delete shift</button></div>';
};
VIEWS.shift.after = function (id) {
  document.querySelectorAll('[data-shf]').forEach(function (el) {
    el.addEventListener('change', function () {
      var k = el.dataset.shf, v = el.value.trim(), f = {};
      if (k === 'worked') f.worked = v === '' ? null : Math.max(0, Math.min(36, +v || 0));
      else if (k === 'start' || k === 'end') { if (!/^\d\d:\d\d$/.test(v)) return; f[k] = v; }
      else f.note = v.slice(0, 500);
      Store.patch('shifts', id, f);
    });
  });
};
function shiftCal(s) { var j = shiftJob(s.job); return { title: j.ic + ' ' + j.name + ' shift', date: s.date, time: s.start, minutes: Math.round(shiftHours(s) * 60), notes: s.note || '', alarmMin: 90 }; }
ACTS.shsetjob = function (d) { Store.patch('shifts', d.id, { job: d.j }); };
ACTS.shdel = function (d) { var s = Store.get('shifts', d.id); Store.del('shifts', d.id); pop(); toast('Shift deleted', function () { Store.put('shifts', s); }); };

/* ── Today: pre-shift checklist, wind-down, overview line ─────────── */
function shiftsNear() {
  var t = today(); return shiftOn(addDays(t, -1)).concat(shiftOn(t), shiftOn(addDays(t, 1)));
}
function shiftNow() { var n = Date.now(); return shiftsNear().filter(function (s) { return shiftStartAt(s) <= n && n < shiftEndAt(s); })[0] || null; }
function shiftUpcoming() { var n = Date.now(), b = shiftCfg().before * 60000; return shiftsNear().filter(function (s) { var st = shiftStartAt(s) - n; return st > 0 && st <= b; })[0] || null; }
function shiftJustDone() { var n = Date.now(); return shiftsNear().filter(function (s) { var e = shiftEndAt(s); return !s.wound && e <= n && n - e < 4 * 36e5; })[0] || null; }
function untilShort(ms) { var m = Math.round(ms / 60000), h = Math.floor(m / 60); return h ? h + ' h ' + (m % 60) + ' min' : m + ' min'; }
function shiftOverview() {
  var on = shiftNow(); if (on) return ' · on shift ' + shiftLabel(on);
  var ts = shiftOn(today()).filter(function (s) { return shiftStartAt(s) > Date.now(); })[0];
  return ts ? ' · shift at ' + fmtTime(ts.start) : '';
}
function shiftCards() {
  var h = '', up = shiftUpcoming(), done = shiftJustDone(), cfg = shiftCfg();
  if (up) {
    var j = shiftJob(up.job), ck = up.checks || [], all = cfg.checklist.length && cfg.checklist.every(function (x, i) { return ck[i]; });
    h += '<section class="shcard pre" style="--c:' + esc(j.color) + '"><div class="sechead" style="margin:0"><h2>' + esc(j.ic) + ' ' + esc(j.name) + ' at ' + esc(fmtTime(up.start)) + '</h2><span class="meta">in ' + esc(untilShort(shiftStartAt(up) - Date.now())) + '</span></div>'
      + (all ? '<p class="ready">Ready ✓</p>' : '<div class="list">' + cfg.checklist.map(function (c, i) {
        return '<button class="row ckrow' + (ck[i] ? ' on' : '') + '" data-act="shck" data-id="' + up.id + '" data-i="' + i + '" aria-pressed="' + !!ck[i] + '"><span class="ck' + (ck[i] ? ' on' : '') + '"><span></span></span><span class="grow">' + esc(c) + '</span></button>';
      }).join('') + '</div>') + '</section>';
  }
  if (done) {
    var dj = shiftJob(done.job), st = shiftStartAt(done).getTime(), en = shiftEndAt(done).getTime();
    var cap = Store.all('inbox').filter(function (x) { return x.created >= st && x.created <= en; }).length, e = entryFor(today()) || {};
    h += '<section class="shcard post" style="--c:' + esc(dj.color) + '"><div class="sechead" style="margin:0"><h2>Shift done ' + esc(dj.ic) + '</h2><button class="link" data-act="shwound" data-id="' + done.id + '">Done</button></div>'
      + '<p class="note">' + fmtAmt(shiftHours(done)) + ' h logged · <button class="link" data-act="open" data-v="shift" data-id="' + done.id + '">Ran long?</button></p>'
      + '<div class="lbl">How was it?</div><div class="chips">' + Object.keys(MOODS).map(function (k) {
        return '<button class="chip' + (e.mood === k ? ' on' : '') + '" data-act="shmood" data-m="' + k + '">' + MOODS[k][0] + ' ' + MOODS[k][1] + '</button>';
      }).join('') + '</div>'
      + '<form class="addstep" data-form="shjournal"><label class="sr" for="shj">One line about the shift</label><input id="shj" class="input" placeholder="One line about the shift" autocomplete="off"><button class="btn soft" type="submit">Save</button></form>'
      + '<div class="btnrow">' + (cap ? '<button class="btn sm soft" data-act="tab" data-v="inbox">Sort ' + cap + ' captured on shift</button>' : '') + '<button class="btn sm soft" data-act="tab" data-v="plan">Plan tomorrow →</button></div></section>';
  }
  return h;
}
ACTS.shck = function (d) { var s = Store.get('shifts', d.id), c = (s.checks || []).slice(); c[+d.i] = !c[+d.i]; Store.patch('shifts', d.id, { checks: c }); };
ACTS.shwound = function (d) { Store.patch('shifts', d.id, { wound: true }); };
ACTS.shmood = function (d) { var e = entryFor(today()) || {}; saveEntry(today(), { mood: e.mood === d.m ? null : d.m }); };
ACTS.form_shjournal = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return; inp.value = '';
  var e = entryFor(today()); saveEntry(today(), { text: (e && e.text ? e.text + '\n' : '') + v }); render(false, true); toast('Added to today\'s journal');
};

/* ── protect off days ────────────────────────────────────────────── */
/* After a big task lands on a shift day, offer the next off day. */
function shiftHint(t, msg) {
  if (!t || !t.due || !isShiftDay(t.due) || !isBigTask(t)) return false;
  var off = nextOffDay(t.due);
  toast((msg ? msg + ' · ' : '') + 'That\'s a shift day', function () { moveTask(t.id, off); toast('Moved to ' + esc(dayShortName(off)) + ' ' + esc(shortDate(off))); }, 'Move to ' + dayShortName(off));
  return true;
}
/* "Big jobs → off day" for a day's tasks. */
ACTS.shmovebig = function (d) {
  var off = nextOffDay(d.d), ts = tasksOn(d.d).filter(function (t) { return !t.done && isBigTask(t) && !t.time; }), undo = ts.map(function (t) { return snapshot(t.id); });
  ts.forEach(function (t) { moveTask(t.id, off); });
  toast(ts.length + ' moved to ' + esc(dayShortName(off)), function () { undo.forEach(function (u) { u(); }); });
};
/* "60 min" or "2h" in what you type becomes the estimate. */
function estFromText(text) {
  var m = /\s*\b(\d{1,3})\s*(min|mins|minutes|h|hr|hrs|hours)\b/i.exec(text || ''); if (!m) return null;
  return { est: /^h/i.test(m[2]) ? m[1] + ' h' : m[1] + ' min', rest: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim() };
}
