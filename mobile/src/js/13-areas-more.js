/* ═══ LIFE AREAS ═══════════════════════════════════════════════════ */
TITLES.areas = 'Life areas';
VIEWS.areas = function () {
  return '<div class="agrid">' + areasSorted().map(function (a) {
    var open = Store.all('tasks').filter(function (t) { return t.area === a.id && !t.done; });
    var next = open.filter(function (t) { return t.due; }).sort(function (x, y) { return x.due.localeCompare(y.due); })[0];
    return '<button class="abig" style="--c:' + esc(a.color) + '" data-act="open" data-v="area" data-id="' + a.id + '">'
      + '<div class="h"><b><span class="dot" style="background:' + esc(a.color) + '"></span>' + esc(a.name) + '</b>'
      + '<span class="st st-' + a.state.toLowerCase().replace(/\s/g, '') + '">' + esc(a.state) + '</span></div>'
      + '<div>' + esc(a.focus || 'No focus set') + '</div>'
      + '<div class="kv"><span>Next</span><span>' + esc((a.id === 'money' && typeof finNextBill === 'function' && finNextBill()) || (next ? next.t + ' · ' + shortDate(next.due) : (a.next || '—'))) + '</span></div>'
      + '<div class="kv"><span>Open</span><span>' + (open.length ? open.length + ' task' + (open.length === 1 ? '' : 's') : esc(a.open || 'Nothing open')) + '</span></div></button>';
  }).join('') + '</div>';
};
TITLES.area = function (id) { var a = area(id); return a ? a.name : 'Area'; };
ACTS.areastate = function (d) { Store.patch('areas', d.id, { state: d.s }); logEvent(areaName(d.id) + ' is ' + d.s.toLowerCase(), d.id); };

/* ═══ MORE ═══════════════════════════════════════════════════════════ */
TITLES.more = 'Tools';
var SOON = {};
/* Tools: everything that isn't on the Dashboard, grouped. */
var TOOL_GROUPS = [
  ['Money', [['money', '💵', 'Money', function () { return FIN.sum ? fmtMoney(FIN.sum.leftToday, true) + ' left today' : 'Payday OS'; }]]],
  ['Plan', [['plan', '🌙', 'Tomorrow'], ['calendar', '📅', 'Calendar'], ['shifts', '🚑', 'Shifts'], ['projects', '📁', 'Projects']]],
  ['Life', [['areas', '🧭', 'Life areas'], ['inbox', '📥', 'Inbox'], ['habits', '🔁', 'Habits'], ['search', '🔎', 'Search']]],
  ['Make', [['ranks', '🏆', 'Rank'], ['decks', '🗂', 'Flashcards'], ['gym', '🏋️', 'Gym'], ['timer', '⏱', 'Focus timer'], ['bored', '🎲', 'Bored']]],
  ['', [['settings', '⚙️', 'Settings']]]
];
function toolCount(k) {
  if (k === 'ranks') { var r = Store.all('ranks').reduce(function (a, l) { return a + rankPending(l).length; }, 0); return r ? r + ' to rank' : Store.all('ranks').length + ' lists'; }
  if (k === 'decks') { var c = Store.all('decks').reduce(function (a, dk) { return a + dueCards(dk).length; }, 0); return c ? c + ' cards due' : Store.all('decks').length + ' decks'; }
  if (k === 'gym') return Store.all('lifts').length + ' lifts';
  if (k === 'timer') return 'Focus';
  if (k === 'bored') return 'Pick something';
  if (k === 'search') return 'Everything';
  if (k === 'settings') return '';
  return sectionCount(k);
}
VIEWS.more = function () {
  return TOOL_GROUPS.map(function (g) {
    return '<section>' + (g[0] ? '<h2 class="grouph2">' + g[0] + '</h2>' : '') + '<div class="toolgrid' + (g[1].length === 1 ? ' one' : '') + '">' + g[1].map(function (x) {
      var n = typeof x[3] === 'function' ? x[3]() : toolCount(x[0]);
      return '<button class="tooltile" data-act="tab" data-v="' + x[0] + '"><span class="te">' + x[1] + '</span><b>' + x[2] + '</b>' + (n ? '<span>' + esc(n) + '</span>' : '') + '</button>';
    }).join('') + '</div></section>';
  }).join('');
};
VIEWS.soon = function () {
  var c = current();
  return '<div class="empty">' + esc(SOON[c.view] || 'Coming soon.') + '</div>';
};

/* ═══ SETTINGS ═══════════════════════════════════════════════════════ */
TITLES.settings = 'Settings';
VIEWS.settings = function () {
  var s = Store.status();
  var syncText = { synced: 'Synced. Your data follows you between iPhone and iPad.', connecting: 'Connecting to sync…',
    slow: 'Sync is taking a while. Changes are kept on this device and go up when it connects.', error: 'Sync stopped. Reload MossOS to reconnect; nothing on this device is lost.',
    local: 'Saved on this device only. Open MossOS in the Claude app, signed in, to sync between devices.' }[s] || '';
  return '<section><div class="sechead"><h2>Sync</h2>' + syncBadge() + '</div><p class="note">' + esc(syncText) + '</p></section>'
    + '<section><div class="sechead"><h2>Claude</h2></div><p class="note">' + (AI.ready ? 'Available. Sorting and "Break it down" use Claude.' : 'Not available in this view. Sorting and "Break it down" need MossOS open in the Claude app.') + '</p></section>'
    + '<section><div class="sechead"><h2>Opens to</h2></div><p class="note small" style="margin-bottom:10px">What you see when you open MossOS after being away 10 minutes or more.</p><div class="chips">'
    + [['capture', 'Quick capture'], ['today', 'Today']].map(function (o) {
      return '<button class="chip' + (openPref() === o[0] ? ' on' : '') + '" data-act="setopen" data-v="' + o[0] + '" aria-pressed="' + (openPref() === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div></section>'
    + '<section><div class="sechead"><h2>Bottom bar</h2></div><p class="note small" style="margin-bottom:10px">Pick the three sections that sit around Capture. Everything else is one tap away under More.</p>'
    + tabPrefs().map(function (cur, slot) {
      return '<div class="field" style="margin-bottom:10px"><label for="tab' + slot + '">' + ['First tab', 'Second tab', 'After Capture'][slot] + '</label><select id="tab' + slot + '" class="input sel" data-act-change="settab" data-slot="' + slot + '">'
        + Object.keys(SECTIONS).filter(function (k) { return k !== 'settings'; }).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + SECTIONS[k][0] + '</option>'; }).join('') + '</select></div>';
    }).join('') + '</section>'

    + '<section><div class="sechead"><h2>Data</h2></div>'
    + (hasExamples() ? '<p class="note small" style="margin-bottom:10px"><b>Example data.</b> MossOS started with sample tasks, habits, goals and notes (marked <span class="pill ex">example</span>) so the screens weren\'t empty. Clear examples removes only those; your own items stay.</p>' : '')
    + '<div class="btnrow">'
    + (hasExamples() ? '<button class="btn soft" data-act="clearex">Clear examples</button>' : '')
    + '<button class="btn soft" data-act="finimport">Import from Payday OS</button>'
    + '<button class="btn ghost" data-act="resetall">Erase everything</button></div></section>';
};

var resetAsked = 0;
ACTS.resetall = function () {
  if (Date.now() - resetAsked > 6000) { resetAsked = Date.now(); toast('Tap "Erase everything" again to delete all your MossOS data on every device'); return; }
  resetAsked = 0; Store.resetLocal(); toast('Everything erased'); go('today');
};

function openPref() { var p = Store.get('meta', 'prefs'); return p && p.open === 'today' ? 'today' : 'capture'; }
ACTS.setopen = function (d) {
  var p = Store.get('meta', 'prefs');
  if (p) Store.patch('meta', 'prefs', { open: d.v }); else Store.put('meta', { id: 'prefs', open: d.v });
  toast(d.v === 'today' ? 'MossOS opens to Today' : 'MossOS opens to Quick capture');
};
ACTS.settab = function (d, el) {
  var t = tabPrefs().slice(), i = +d.slot, other = t.indexOf(el.value);
  if (other > -1 && other !== i) t[other] = t[i]; // swap rather than show a section twice
  t[i] = el.value;
  var p = Store.get('meta', 'prefs');
  if (p) Store.patch('meta', 'prefs', { tabs: t }); else Store.put('meta', { id: 'prefs', tabs: t });
  toast('Bottom bar updated');
};
