/* ═══ SHELL ══════════════════════════════════════════════════════════
   Navigation is a tab plus a stack of pushed pages (task detail, sweep…).
   Views return HTML strings; clicks are handled by one delegated
   listener that dispatches on data-act. */
var nav = { tab: 'today', stack: [] };
var VIEWS = {}, ACTS = {}, TITLES = {};
/* Every section. The bottom bar shows three of them (your choice, in
   Settings) around Capture, then More. */
var SECTIONS = {
  today: ['Today', 'today'], tasks: ['Tasks', 'tasks'], habits: ['Habits', 'habits'], goals: ['Goals', 'goals'],
  notes: ['Notes', 'notes'], projects: ['Projects', 'projects'], calendar: ['Calendar', 'calendar'], journal: ['Journal', 'journal'],
  tools: ['Tools', 'tools'], books: ['Books', 'journal'], shifts: ['Shifts', 'calendar'], plan: ['Tomorrow', 'calendar'], money: ['Money', 'money'], inbox: ['Inbox', 'inbox'], areas: ['Life areas', 'areas'], settings: ['Settings', 'settings']
};
var TAB_DEFAULT = ['today', 'tasks', 'habits'];
function tabPrefs() { var p = Store.get('meta', 'prefs'); var t = p && p.tabs; return t && t.length === 3 && t.every(function (x) { return SECTIONS[x]; }) ? t : TAB_DEFAULT; }
function tabsNow() {
  var t = tabPrefs();
  return [[t[0]].concat(SECTIONS[t[0]]), [t[1]].concat(SECTIONS[t[1]]), ['capture', 'Capture', 'plus'], [t[2]].concat(SECTIONS[t[2]]), ['more', 'More', 'more']];
}
var SIDE_MORE = ['plan', 'shifts', 'habits', 'goals', 'notes', 'books', 'projects', 'calendar', 'journal', 'tools', 'inbox', 'areas', 'settings'].map(function (k) { return [k, SECTIONS[k][0], SECTIONS[k][1]]; });

function leaving() { if (current().view === 'project' && typeof maybeAskLeftOff === 'function') setTimeout(maybeAskLeftOff, 0); }
function go(tab) { leaving(); nav.tab = tab; nav.stack = []; render(true); }
function push(view, arg) { if (view !== 'task' && view !== 'note') leaving(); nav.stack.push({ view: view, arg: arg }); render(true); }
function pop() { leaving(); nav.stack.pop(); render(true); }
function current() { return nav.stack.length ? nav.stack[nav.stack.length - 1] : { view: nav.tab, arg: null }; }

function syncBadge() {
  var s = Store.status();
  var map = { synced: ['on', 'Synced'], connecting: ['', 'Connecting…'], slow: ['warn', 'Sync is slow'], error: ['warn', 'Sync stopped'], local: ['', 'This device'] };
  var m = map[s] || map.local;
  return '<span class="sync ' + m[0] + '" title="' + (s === 'local' ? 'Saved on this device only. Open MossOS in the Claude app, signed in, to sync between your phone and iPad.' : m[1]) + '"><i></i>' + m[1] + '</span>';
}

var lastKey = '';
function render(scrollTop, force) {
  var c = current(), v = VIEWS[c.view] || VIEWS.soon;
  var sub = nav.stack.length > 0;
  var title = typeof TITLES[c.view] === 'function' ? TITLES[c.view](c.arg) : (TITLES[c.view] || '');
  $('#top').className = 'top' + (sub ? ' sub' : '');
  $('#top').innerHTML = (sub ? '<button class="back" data-act="back" aria-label="Back">' + icon('back') + '</button>' : '')
    + '<h1>' + esc(title) + '</h1>' + (sub ? '' : syncBadge());
  // Keep focus and caret if the user is typing in this view.
  var ae = document.activeElement, keep = ae && ae.id && $('#view').contains(ae) ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  if (keep && (ae.isContentEditable || ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') && !scrollTop && !force) {
    // Don't rebuild under someone's fingers; repaint when they leave the field.
    render.stale = true; paintChrome(); return;
  }
  render.stale = false;
  $('#view').innerHTML = v(c.arg);
  if (v.after) v.after(c.arg);
  paintChrome();
  if (typeof finLayout === 'function') finLayout();
  var key = c.view + ':' + (c.arg || '');
  if (scrollTop || key !== lastKey) window.scrollTo(0, 0);
  lastKey = key;
}
function paintChrome() {
  var c = current(), active = nav.stack.length ? nav.tab : c.view;
  $('#tabs').innerHTML = tabsNow().map(function (t) {
    if (t[0] === 'capture') return '<button class="cap" data-act="capture" aria-label="Capture">' + '<span>' + icon('plus') + '</span></button>';
    return '<button class="' + (active === t[0] ? 'on' : '') + '" data-act="tab" data-v="' + t[0] + '" aria-current="' + (active === t[0] ? 'page' : 'false') + '">' + icon(t[2]) + '<span>' + t[1] + '</span></button>';
  }).join('');
  var inboxN = Store.all('inbox').length;
  $('#side').innerHTML = '<div class="brand">' + icon('moss') + 'MossOS</div>'
    + '<button class="capbtn" data-act="capture">' + icon('plus', 'sm') + 'Capture</button>'
    + [['today', 'Today', 'today'], ['tasks', 'Tasks', 'tasks'], ['money', 'Money', 'money']].map(function (t) {
      return '<button class="' + (active === t[0] ? 'on' : '') + '" data-act="tab" data-v="' + t[0] + '">' + icon(t[2]) + t[1] + '</button>';
    }).join('')
    + '<div class="grp">More</div>'
    + SIDE_MORE.map(function (t) {
      return '<button class="' + (active === t[0] ? 'on' : '') + '" data-act="tab" data-v="' + t[0] + '">' + icon(t[2]) + t[1]
        + (t[0] === 'inbox' && inboxN ? '<span class="pill" style="margin-left:auto">' + inboxN + '</span>' : '') + '</button>';
    }).join('');
}
/* A tap or swipe that starts while a text field is focused blurs it. Don't
   repaint in the middle of that gesture; wait for the finger to lift. */
var pointerIsDown = false;
document.addEventListener('pointerdown', function () { pointerIsDown = true; }, true);
['pointerup', 'pointercancel'].forEach(function (ev) {
  document.addEventListener(ev, function () {
    pointerIsDown = false;
    if (render.stale) setTimeout(function () { var ae = document.activeElement; if (render.stale && !(ae && $('#view').contains(ae) && (ae.isContentEditable || /TEXTAREA|INPUT/.test(ae.tagName)))) render(); }, 30);
  }, true);
});
document.addEventListener('focusout', function () {
  setTimeout(function () {
    if (pointerIsDown) return;
    var ae = document.activeElement;
    if (render.stale && !(ae && $('#view').contains(ae) && (ae.isContentEditable || /TEXTAREA|INPUT/.test(ae.tagName)))) render();
  }, 0);
});
addEventListener('scroll', function () { $('#top').classList.toggle('edge', scrollY > 4); }, { passive: true });

/* ── sheet ─────────────────────────────────────────────────────────── */
var sheetOnClose = null;
function openSheet(html, after, onClose) {
  $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div>' + html;
  $('#sheetbg').hidden = false;
  document.body.style.overflow = 'hidden';
  sheetOnClose = onClose || null;
  if (after) after($('#sheet'));
}
function closeSheet() {
  if ($('#sheetbg').hidden) return;
  $('#sheetbg').hidden = true; document.body.style.overflow = '';
  var f = sheetOnClose; sheetOnClose = null; if (f) f();
  render();
}
$('#sheetbg').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });
addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

/* ── toast with optional undo ───────────────────────────────────────── */
var toastT = null;
function toast(msg, undo, label) {
  clearTimeout(toastT);
  var el = $('#toast');
  el.innerHTML = '<span>' + msg + '</span>' + (undo ? '<button data-act="undo">' + esc(label || 'Undo') + '</button>' : '');
  el.hidden = false; toast.undo = undo || null;
  toastT = setTimeout(function () { el.hidden = true; toast.undo = null; }, undo ? 5000 : 2600);
}
ACTS.undo = function () { var f = toast.undo; $('#toast').hidden = true; toast.undo = null; if (f) f(); };

/* ── one listener for every button ─────────────────────────────────── */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]'); if (!el) return;
  var f = ACTS[el.dataset.act]; if (!f) return;
  e.preventDefault(); f(el.dataset, el, e);
});
ACTS.tab = function (d) { go(d.v); };
ACTS.back = function () { pop(); };
ACTS.close = function () { closeSheet(); };
ACTS.open = function (d) { push(d.v, d.id); };

/* ── AI (Claude via the sample capability) ─────────────────────────── */
var AI = { s: null, ready: false };
function aiInit() {
  if (!window.claude || !window.claude.use) return;
  window.claude.use('sample').then(function (s) { AI.s = s; AI.ready = !!s; render(); });
}
function aiJson(prompt, opts) {
  if (!AI.s) return Promise.reject({ code: 'not_granted' });
  return AI.s.json(prompt, Object.assign({ modelTier: 'quick' }, opts || {}));
}
function aiError(e) {
  var c = e && e.code;
  if (c === 'not_granted') return 'Claude isn\'t available here. Open MossOS in the Claude app to use it.';
  if (c === 'rate_limited') return 'Claude is busy. Try again in a minute.';
  if (c === 'cancelled') return 'Stopped.';
  return 'Claude couldn\'t answer that. Try again.';
}

/* Shared bits of markup. */
function areaDot(id) { return '<span class="dot" style="background:' + areaColor(id) + '"></span>'; }
function areaName(id) { var a = area(id); return a ? a.short : ''; }
function exPill(o) { return o && o.example ? '<span class="pill ex">example</span>' : ''; }
