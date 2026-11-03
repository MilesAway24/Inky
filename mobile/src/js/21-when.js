/* ═══ WHEN PICKER ═══════════════════════════════════════════════════
   From Miles's recording: a big time readout, a week strip of days (with
   a dot where other tasks already sit) that opens to a full month, and a
   ruler you drag sideways that snaps every 5 minutes. Presets, All day,
   and in-app reminders. pickWhen({due, time, remind, id}, onDone). */
var REMIND_OPTS = [[10080, '1 week'], [4320, '3 days'], [1440, '1 day'], [120, '2 hours'], [60, '1 hour'], [30, '30 min'], [15, '15 min']];
var TICK = 10;               // px per 5 minutes
var when = null;             // {due, time, remind, id, full, month, onDone}

function remindLabel(m) {
  var o = REMIND_OPTS.filter(function (x) { return x[0] === m; })[0]; if (o) return o[1];
  if (m % 10080 === 0) return (m / 10080) + ' weeks'; if (m % 1440 === 0) return (m / 1440) + ' days';
  if (m % 60 === 0) return (m / 60) + ' hours'; return m + ' min';
}
function hm(mins) { return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'); }
function mins(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
function longDate(s) { var d = parseYmd(s); return DOWL[d.getDay()] + ', ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()] + ' ' + d.getDate(); }
function busyOn(d, exceptId) { return Store.all('tasks').filter(function (t) { return t.due === d && !t.done && t.id !== exceptId; }).length; }

/* A month grid shared by the pickers. opts: {pick, nav, exceptId, ring} */
function monthGrid(month, sel, opts) {
  var first = parseYmd(month), lead = (first.getDay() + 6) % 7, days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), t = today();
  var h = '<div class="calhead"><button type="button" class="iconbtn" data-act="' + opts.nav + '" data-n="-1" aria-label="Previous month">' + icon('back') + '</button>'
    + '<b>' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][first.getMonth()] + ' ' + first.getFullYear() + '</b>'
    + '<button type="button" class="iconbtn" data-act="' + opts.nav + '" data-n="1" aria-label="Next month">' + icon('chev') + '</button></div>'
    + '<div class="cal mini">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (x) { return '<span class="wdh">' + x + '</span>'; }).join('');
  for (var i = 0; i < lead; i++) h += '<span></span>';
  for (var n = 1; n <= days; n++) {
    var d = month.slice(0, 8) + String(n).padStart(2, '0'), busy = busyOn(d, opts.exceptId);
    h += '<button type="button" class="day' + (d === t ? ' today' : '') + (d === sel ? ' sel' : '') + (d < t ? ' past' : '') + '" data-act="' + opts.pick + '" data-d="' + d + '" aria-label="' + esc(longDate(d)) + (busy ? ', ' + busy + ' other tasks' : '') + '">'
      + '<span class="n">' + n + '</span><span class="dots">' + (busy ? '<i style="background:var(--accent)"></i>' : '') + '</span></button>';
  }
  return h + '</div>';
}

function pickWhen(o, onDone) {
  when = { due: o.due || null, time: o.time || null, remind: (o.remind || []).slice(), id: o.id || null, full: false,
    month: (o.due || today()).slice(0, 8) + '01', onDone: onDone, title: o.title || 'When' };
  openSheet('<div id="whenbox"></div>', function () { whenPaint(); });
}
function whenPaint() {
  var w = when, t = today(), box = $('#whenbox'); if (!box || !w) return;
  var tm = w.time ? fmtTime(w.time) : null;
  var h = '<div class="shead"><h2>' + esc(w.title) + '</h2><button class="iconbtn" data-act="close" aria-label="Cancel">' + icon('x') + '</button></div>'
    + '<div class="readout" aria-live="polite"><div class="big2" id="wbig">' + bigTime(w.time) + '</div>'
    + '<div class="muted">' + (w.due ? esc(longDate(w.due)) + (w.due === t ? ' · <b class="todaytag">today</b>' : '') : 'No date · Someday') + '</div></div>';
  // dates
  h += '<div class="wlab"><span>Date</span><button type="button" class="link" data-act="wfull">' + (w.full ? 'Hide month' : 'Full month') + '</button></div>'
    + '<div class="wstrip">' + range(7).map(function (i) {
      var d = addDays(t, i), busy = busyOn(d, w.id);
      return '<button type="button" class="wday' + (w.due === d ? ' on' : '') + '" data-act="wday" data-d="' + d + '" aria-pressed="' + (w.due === d) + '"><em>' + (i === 0 ? 'Today' : DOW[parseYmd(d).getDay()]) + '</em><b>' + parseYmd(d).getDate() + '</b><i' + (busy ? '' : ' class="none"') + '></i></button>';
    }).join('') + '<button type="button" class="wday some' + (!w.due ? ' on' : '') + '" data-act="wday" data-d="" aria-pressed="' + !w.due + '"><em>No</em><b>date</b><i class="none"></i></button></div>';
  if (w.full) h += '<div class="wmonth">' + monthGrid(w.month, w.due, { pick: 'wday', nav: 'wmonth', exceptId: w.id }) + '</div>';
  h += '<p class="note small">• dot = other tasks already that day</p>';
  // time ruler
  h += '<div class="wlab"><span>Time</span><span class="faint">5 min steps</span></div>'
    + rulerHtml('ruler', w.time)
    + '<div class="scrollx">' + [['06:00'], ['09:00'], ['12:00'], ['17:00'], ['20:00'], ['', 'All day']].map(function (p) {
      var on = (p[0] || null) === (w.time || null);
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="wpreset" data-t="' + p[0] + '">' + esc(p[1] || fmtTime(p[0]).replace(/^(\d+)(am|pm)$/, '$1:00$2').toUpperCase().replace(/(AM|PM)$/, ' $1')) + '</button>';
    }).join('') + '</div>';
  // reminders
  h += '<div class="wlab"><span>Remind me before' + (w.remind.length ? ' · ' + w.remind.length + ' set' : '') + '</span></div>'
    + '<div class="chips">' + REMIND_OPTS.map(function (r) {
      var on = w.remind.indexOf(r[0]) > -1;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="wremind" data-m="' + r[0] + '" aria-pressed="' + on + '">' + (on ? '✓ ' : '') + r[1] + '</button>';
    }).join('') + '</div>'
    + '<form class="addstep" data-form="wremindadd"><label class="sr" for="wrn">Custom reminder</label><input id="wrn" class="input" name="n" inputmode="numeric" placeholder="10" style="flex:0 0 72px">'
    + '<label class="sr" for="wru">Unit</label><select id="wru" name="u" class="input sel"><option value="1">min</option><option value="60" selected>hour</option><option value="1440">day</option><option value="10080">week</option></select>'
    + '<button class="btn soft" type="submit">Add</button></form>'
    + w.remind.filter(function (m) { return !REMIND_OPTS.some(function (r) { return r[0] === m; }); }).map(function (m) {
      return '<div class="remrow">🔔 ' + esc(remindLabel(m)) + ' before <button type="button" class="iconbtn" data-act="wremind" data-m="' + m + '" aria-label="Remove">' + icon('x', 'sm') + '</button></div>';
    }).join('')
    + '<p class="note small">Shown in Heads up on Today. Your phone won\'t ping: the Claude app can\'t send notifications.</p>';
  h += '<div class="btnrow"><button type="button" class="btn ghost" data-act="close">Cancel</button><button type="button" class="btn accent" data-act="wdone">Done</button></div>';
  box.innerHTML = h;
  wireRuler();
}
function rulerTicks() {
  var h = '';
  for (var m = 0; m < 1440; m += 5) {
    var cls = m % 60 === 0 ? 'hr' : m % 15 === 0 ? 'q' : '';
    h += '<i class="' + cls + '" style="left:' + (m / 5 * TICK) + 'px"></i>';
    if (m % 60 === 0) h += '<span style="left:' + (m / 5 * TICK) + 'px">' + fmtTime(hm(m)).toUpperCase().replace(/(AM|PM)$/, ' $1') + '</span>';
  }
  return h;
}
/* A ruler you drag sideways; snaps every 5 minutes. Shared by the When
   picker and the Reschedule sheet.
   cfg: {ruler, strip, start (minutes), onMove(min), onSet(min)} */
function makeRuler(cfg) {
  var r = cfg.ruler, strip = cfg.strip; if (!r || !strip) return;
  var cur = cfg.start, x0 = 0, base = 0, on = false, last = [], pid = null;
  var place = function (m, anim) { strip.style.transition = anim ? 'transform .25s cubic-bezier(.2,.8,.3,1)' : 'none'; strip.style.transform = 'translateX(' + (r.clientWidth / 2 - m / 5 * TICK) + 'px)'; };
  var setT = function (m, final) {
    m = Math.max(0, Math.min(1435, Math.round(m / 5) * 5)); cur = m;
    r.classList.remove('allday'); r.setAttribute('aria-valuenow', m); r.setAttribute('aria-valuetext', fmtTime(hm(m)));
    if (cfg.onMove) cfg.onMove(m);
    if (final) { place(m, true); if (cfg.onSet) cfg.onSet(m); }
  };
  place(cur, false);
  r.addEventListener('pointerdown', function (e) { on = true; pid = e.pointerId; x0 = e.clientX; base = cur; last = [[e.clientX, e.timeStamp]]; try { r.setPointerCapture(pid); } catch (er) {} });
  r.addEventListener('pointermove', function (e) {
    if (!on || e.pointerId !== pid) return;
    var m = Math.max(0, Math.min(1435, base - (e.clientX - x0) / TICK * 5));
    strip.style.transition = 'none'; strip.style.transform = 'translateX(' + (r.clientWidth / 2 - m / 5 * TICK) + 'px)';
    setT(m, false); last.push([e.clientX, e.timeStamp]); if (last.length > 5) last.shift();
  });
  var end = function (e) {
    if (!on) return; on = false;
    // a flick carries on a little, then settles on the nearest 5 minutes
    var a = last[0], b = last[last.length - 1], v = b && a && b[1] > a[1] ? (b[0] - a[0]) / (b[1] - a[1]) : 0;
    var m = cur - (Math.abs(v) > 0.4 ? v * 140 / TICK * 5 : 0);
    if (Math.abs(e.clientX - x0) < 4 && last.length < 3) { var rect = r.getBoundingClientRect(); m = cur + (e.clientX - rect.left - rect.width / 2) / TICK * 5; }
    setT(m, true);
  };
  r.addEventListener('pointerup', end); r.addEventListener('pointercancel', end);
  r.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setT(cur + 5, true); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setT(cur - 5, true); }
  });
}
function rulerHtml(id, time) {
  var tm = time ? fmtTime(time) : 'All day';
  return '<div class="ruler' + (time ? '' : ' allday') + '" id="' + id + '" tabindex="0" role="slider" aria-label="Time" aria-valuemin="0" aria-valuemax="1435" aria-valuenow="' + (time ? mins(time) : 540) + '" aria-valuetext="' + esc(tm) + '">'
    + '<div class="rstrip">' + rulerTicks() + '</div><span class="rline" aria-hidden="true"></span></div>'
    + '<p class="note small" style="text-align:center">Drag the rail. It snaps every 5 minutes.</p>';
}
function bigTime(t) { if (!t) return 'All day'; var tm = fmtTime(t); return esc(tm.replace(/(am|pm)$/, '')) + '<small>' + tm.slice(-2).toUpperCase() + '</small>'; }
function wireRuler() {
  makeRuler({ ruler: $('#ruler'), strip: $('#ruler .rstrip'), start: when.time ? mins(when.time) : 540,
    onMove: function (m) { when.time = hm(m); $('#wbig').innerHTML = bigTime(when.time); },
    onSet: function () { $$('[data-act=wpreset]').forEach(function (b) { b.classList.toggle('on', b.dataset.t === when.time); }); } });
}
ACTS.wfull = function () { when.full = !when.full; whenPaint(); };
ACTS.wday = function (d) { when.due = d.d || null; if (d.d) when.month = d.d.slice(0, 8) + '01'; whenPaint(); };
ACTS.wmonth = function (d) { var f = parseYmd(when.month); f.setMonth(f.getMonth() + (+d.n)); when.month = ymd(f); whenPaint(); };
ACTS.wpreset = function (d) { when.time = d.t || null; whenPaint(); };
ACTS.wremind = function (d) { var m = +d.m, i = when.remind.indexOf(m); if (i > -1) when.remind.splice(i, 1); else when.remind.push(m); when.remind.sort(function (a, b) { return b - a; }); whenPaint(); };
ACTS.form_wremindadd = function (d, f) {
  var n = parseInt($('[name=n]', f).value, 10), u = +$('[name=u]', f).value; if (!n || n < 1) return;
  var m = n * u; if (when.remind.indexOf(m) < 0) when.remind.push(m); when.remind.sort(function (a, b) { return b - a; }); whenPaint();
};
ACTS.wdone = function () {
  var w = when; when = null; closeSheet();
  if (w && w.onDone) w.onDone({ due: w.due, time: w.time, remind: w.due ? w.remind : [] });
};

/* In-app reminders: tasks whose reminder window is open right now. */
function dueAt(t) { var d = parseYmd(t.due), p = (t.time || '09:00').split(':'); d.setHours(+p[0], +p[1], 0, 0); return d.getTime(); }
function remindersNow() {
  var now = Date.now();
  return Store.all('tasks').filter(function (t) {
    if (t.done || !t.due || !t.remind || !t.remind.length) return false;
    var at = dueAt(t); if (now >= at) return false;
    return t.remind.some(function (m) { return now >= at - m * 6e4; });
  }).sort(function (a, b) { return dueAt(a) - dueAt(b); });
}
function untilText(t) {
  var m = Math.round((dueAt(t) - Date.now()) / 6e4);
  if (m < 60) return 'in ' + m + ' min'; if (m < 1440) return 'in ' + Math.round(m / 60) + ' h';
  return shortDate(t.due).toLowerCase() === 'tomorrow' ? 'tomorrow' + (t.time ? ' at ' + fmtTime(t.time) : '') : 'in ' + Math.round(m / 1440) + ' days';
}
