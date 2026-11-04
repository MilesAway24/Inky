/* ═══ JOURNAL ═══════════════════════════════════════════════════════
   One entry per day (id j<date>): a mood and some words. Recorded, not
   scored. The prompt is built from today's log, so there's always a
   place to start. */
var MOODS = { good: ['🙂', 'Good'], ok: ['😐', 'Okay'], low: ['🌧', 'Low'] };
function entryFor(day) { return Store.get('journal', 'j' + day); }
TITLES.journal = 'Journal';
VIEWS.journal = function () {
  var t = today(), e = entryFor(t) || {};
  var log = Store.all('log').filter(function (l) { return l.day === t; }).sort(function (a, b) { return a.at - b.at; });
  var prompt = log.length ? 'Today you: ' + log.slice(-3).map(function (l) { return l.text.replace(/^Done: /, ''); }).join('; ') + '. How did it feel?'
    : 'What took up most of today?';
  var past = Store.all('journal').filter(function (j) { return j.day !== t; }).sort(function (a, b) { return b.day.localeCompare(a.day); });
  var wk = range(7).map(function (i) { return addDays(t, i - 6); });
  var h = '<div class="moodweek">' + wk.map(function (d) {
    var j = entryFor(d);
    return '<span class="' + (d === t ? 'now' : '') + '"><b>' + (j && j.mood ? MOODS[j.mood][0] : '·') + '</b><em>' + DOW[parseYmd(d).getDay()].charAt(0) + '</em></span>';
  }).join('') + '</div>';
  h += '<section class="card" style="display:grid;gap:12px"><div class="sechead" style="margin:0"><h2>' + esc(DOWL[new Date().getDay()]) + '</h2><span class="meta">' + esc(shortDate(t)) + '</span></div>'
    + '<div class="chips" role="group" aria-label="Mood">' + Object.keys(MOODS).map(function (k) {
      return '<button class="chip' + (e.mood === k ? ' on' : '') + '" data-act="mood" data-m="' + k + '" aria-pressed="' + (e.mood === k) + '">' + MOODS[k][0] + ' ' + MOODS[k][1] + '</button>';
    }).join('') + '</div>'
    + '<label class="sr" for="jtext">Entry</label><textarea id="jtext" class="input" style="min-height:160px;font-size:16.5px;line-height:1.55" placeholder="' + esc(prompt) + '">' + esc(e.text || '') + '</textarea>'
    + '<p class="note small">Recorded, not scored. Saved as you type.</p></section>';
  h += past.length ? '<section><div class="sechead"><h2>Earlier</h2><span class="meta">' + past.length + '</span></div><div class="list">' + past.slice(0, 60).map(function (j) {
    return '<button class="row" data-act="open" data-v="entry" data-id="' + j.id + '" style="align-items:flex-start"><span class="jd"><b>' + esc(shortDate(j.day)) + '</b></span>'
      + '<span class="grow"><div class="t jt">' + esc(j.text || '(no words)') + '</div><div class="s">' + (j.mood ? MOODS[j.mood][0] + ' ' + MOODS[j.mood][1] : '') + ' ' + exPill(j) + '</div></span></button>';
  }).join('') + '</div></section>' : '';
  return h + todaysLogHtml();
};
VIEWS.journal.after = function () {
  var ta = $('#jtext'); if (!ta) return;
  ta.addEventListener('input', function () { saveEntry(today(), { text: ta.value }); });
};
function saveEntry(day, f) {
  var id = 'j' + day, e = Store.get('journal', id);
  if (e) Store.patch('journal', id, f);
  else Store.put('journal', Object.assign({ id: id, day: day, text: '', mood: null }, f));
}
ACTS.mood = function (d) {
  var e = entryFor(today()) || {};
  saveEntry(today(), { mood: e.mood === d.m ? null : d.m });
  if (e.mood !== d.m) logEvent('Journal: feeling ' + MOODS[d.m][1].toLowerCase());
};
TITLES.entry = function (id) { var j = Store.get('journal', id); return j ? shortDate(j.day) : 'Entry'; };
VIEWS.entry = function (id) {
  var j = Store.get('journal', id); if (!j) return '<div class="empty">This entry was deleted.</div>';
  return '<div class="chips">' + Object.keys(MOODS).map(function (k) {
    return '<button class="chip' + (j.mood === k ? ' on' : '') + '" data-act="entrymood" data-id="' + id + '" data-m="' + k + '">' + MOODS[k][0] + ' ' + MOODS[k][1] + '</button>';
  }).join('') + '</div>'
    + '<label class="sr" for="etext">Entry</label><textarea id="etext" class="input" style="min-height:50vh;font-size:16.5px;line-height:1.55">' + esc(j.text || '') + '</textarea>'
    + '<button class="btn ghost" style="color:var(--bad);justify-self:start" data-act="delentry" data-id="' + id + '">Delete entry</button>';
};
VIEWS.entry.after = function (id) { var ta = $('#etext'); if (ta) ta.addEventListener('input', function () { Store.patch('journal', id, { text: ta.value }); }); };
ACTS.entrymood = function (d) { var j = Store.get('journal', d.id); Store.patch('journal', d.id, { mood: j.mood === d.m ? null : d.m }); };
ACTS.delentry = function (d) { var j = Store.get('journal', d.id); Store.del('journal', d.id); pop(); toast('Entry deleted', function () { Store.put('journal', j); }); };
