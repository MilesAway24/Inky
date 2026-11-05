/* ═══ SHELL ══════════════════════════════════════════════════════════
   Navigation is a tab plus a stack of pushed pages (task detail, sweep…).
   Views return HTML strings; clicks are handled by one delegated
   listener that dispatches on data-act. */
var nav = { tab: 'today', stack: [] };
var VIEWS = {}, ACTS = {}, TITLES = {}, HEADS = {};
/* Every section. The bottom bar shows three of them (your choice, in
   Settings) around Capture, then More. */
var SECTIONS = {
  today: ['Dashboard', 'home'], tasks: ['Tasks', 'tasks'], habits: ['Habits', 'habits'], goals: ['Goals', 'goals'],
  notes: ['Notes', 'notes'], projects: ['Projects', 'projects'], calendar: ['Calendar', 'calendar'], journal: ['Journal', 'journal'],
  tools: ['Rank & cards', 'tools'], books: ['E-reader', 'book'], search: ['Search', 'search'], shifts: ['Shifts', 'shift'], plan: ['Tomorrow', 'calendar'], money: ['Money', 'money'], inbox: ['Inbox', 'inbox'], areas: ['Life areas', 'areas'], settings: ['Settings', 'settings']
};
var TAB_DEFAULT = ['today', 'tasks', 'habits'];
function tabPrefs() { var p = Store.get('meta', 'prefs'); var t = p && p.tabs; return t && t.length === 3 && t.every(function (x) { return SECTIONS[x]; }) ? t : TAB_DEFAULT; }
function tabsNow() {
  var t = tabPrefs();
  return [[t[0]].concat(SECTIONS[t[0]]), [t[1]].concat(SECTIONS[t[1]]), ['capture', 'Capture', 'plus'], [t[2]].concat(SECTIONS[t[2]]), ['more', 'Tools', 'grid']];
}
var SIDE_TOP = ['today', 'tasks', 'habits', 'journal', 'goals', 'notes', 'books'];
var SIDE_MORE = ['money', 'plan', 'calendar', 'shifts', 'projects', 'areas', 'inbox', 'tools', 'search', 'settings'].map(function (k) { return [k, SECTIONS[k][0], SECTIONS[k][1]]; });

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
  $('#top').className = 'top' + (sub ? ' sub' : '') + (!sub && HEADS[c.view] ? ' big' : '');
  $('#top').innerHTML = !sub && HEADS[c.view] ? HEADS[c.view]() : (sub ? '<button class="back" data-act="back" aria-label="Back">' + icon('back') + '</button>' : '')
    + '<h1>' + esc(title) + '</h1>' + (sub || c.view === 'search' ? '' : '<button class="iconbtn topsearch" data-act="tab" data-v="search" aria-label="Search">' + icon('search', 'sm') + '</button>');
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
  // Anything not on the bar lives under Tools.
  var onBar = tabsNow().some(function (t) { return t[0] === active; }), barActive = onBar ? active : 'more';
  $('#tabs').innerHTML = tabsNow().map(function (t) {
    if (t[0] === 'capture') return '<button class="cap" data-act="capture" aria-label="Capture">' + '<span>' + icon('plus') + '</span></button>';
    return '<button class="' + (barActive === t[0] ? 'on' : '') + '" data-act="tab" data-v="' + t[0] + '" aria-current="' + (barActive === t[0] ? 'page' : 'false') + '">' + icon(t[2]) + '<span>' + t[1] + '</span></button>';
  }).join('');
  var inboxN = Store.all('inbox').length;
  $('#side').innerHTML = '<div class="brand">' + icon('moss') + 'MossOS</div>'
    + '<button class="capbtn" data-act="capture">' + icon('plus', 'sm') + 'Capture</button>'
    + SIDE_TOP.map(function (k) { return [k, SECTIONS[k][0], SECTIONS[k][1]]; }).map(function (t) {
      return '<button class="' + (active === t[0] ? 'on' : '') + '" data-act="tab" data-v="' + t[0] + '">' + icon(t[2]) + t[1] + '</button>';
    }).join('')
    + '<div class="grp">Tools</div>'
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
  $('#sheetbg').hidden = true; document.body.style.overflow = ''; document.body.classList.remove('kbsheet');
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
  // iOS keeps a text field focused when you tap a button, and the page holds
  // its repaint while you're typing, so the tap seemed to do nothing (habit
  // "Mark done" next to the edit fields). Let go of the field first.
  var ae = document.activeElement, view = $('#view');
  if (ae && ae !== el && !el.contains(ae) && view.contains(ae) && view.contains(el) && el.dataset.act !== 'rename'
    && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) ae.blur();
  e.preventDefault(); if (tapLate(el)) return; tapDone(el); runAct(f, el.dataset, el, e);
  if (render.stale && !(document.activeElement && view.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))) render();
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

/* ── sheets and the keyboard ─────────────────────────────────────────
   Inside the Claude app the page is a frame that iOS doesn't shrink for
   the keyboard, so a bottom sheet ends up under it. While you type in a
   sheet it moves to the top half of the screen (or, where the browser
   reports the keyboard, sits right above it). */
(function () {
  var sheet = $('#sheet');
  function isField(el) {
    return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
      || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|color|file)$/.test(el.type || '')));
  }
  function kbFit() {
    var vv = window.visualViewport, kb = vv ? Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)) : 0;
    document.documentElement.style.setProperty('--kb', kb + 'px');
    document.body.classList.toggle('kbvv', kb > 80);
  }
  sheet.addEventListener('focusin', function (e) { if (isField(e.target)) { document.body.classList.add('kbsheet'); kbFit(); } });
  sheet.addEventListener('focusout', function () {
    setTimeout(function () { var ae = document.activeElement; if (!(isField(ae) && sheet.contains(ae))) document.body.classList.remove('kbsheet'); kbFit(); }, 80);
  });
  if (window.visualViewport) { visualViewport.addEventListener('resize', kbFit); visualViewport.addEventListener('scroll', kbFit); }
})();

/* ── actions never fail silently ─────────────────────────────────────
   If an action throws, say so on screen (so it can be reported) instead
   of the tap doing nothing. */
var errSeen = {};
function showErr(msg) {
  msg = String(msg || 'Unknown error').slice(0, 140);
  if (errSeen[msg]) return; errSeen[msg] = 1; setTimeout(function () { delete errSeen[msg]; }, 8000);
  try { toast('That didn\'t work: ' + esc(msg) + '. Send this to Claude.'); } catch (e) {}
}
function runAct(f, data, el, ev) {
  try { return f(data, el, ev); } catch (err) { console.error(err); showErr(err && err.message); }
}
addEventListener('error', function (e) { if (e && e.message) showErr(e.message); });
addEventListener('unhandledrejection', function (e) { var r = e && e.reason; if (r && r.message && !r.code) showErr(r.message); });

/* ── tap backup for iPhone ───────────────────────────────────────────
   iOS sometimes drops the click after a touch (for example when the page
   repaints under the finger). If a short, still tap on a button ends and
   no click follows, run the button's action once ourselves. */
var tapT = null, tapLast = null, tapStart = null, downSeq = 0;
function tapKey(el) { return el ? (el.dataset.act || '') + '|' + (el.dataset.id || '') + '|' + (el.dataset.v || '') + '|' + (el.dataset.k || '') + '|' + (el.dataset.d || '') : ''; }
function tapDone(el) { clearTimeout(tapT); tapLast = { key: tapKey(el), at: Date.now() }; }
/* The backup already ran this tap and the real click turned up late: skip it. */
function tapLate(el) { return !!(tapLast && tapLast.fb && tapLast.seq === downSeq && tapLast.key === tapKey(el) && Date.now() - tapLast.at < 1500 && (tapLast.fb = false, true)); }
document.addEventListener('pointerdown', function (e) {
  tapStart = null; downSeq++;
  if (e.pointerType !== 'touch') return;
  var el = e.target.closest && e.target.closest('[data-act]');
  if (!el || el.closest('.ruler,.trin,input,textarea,select,[contenteditable]') || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  tapStart = { key: tapKey(el), x: e.clientX, y: e.clientY, t: Date.now() };
}, true);
document.addEventListener('pointerup', function (e) {
  var st = tapStart; tapStart = null;
  if (!st || e.pointerType !== 'touch') return;
  if (Math.abs(e.clientX - st.x) > 10 || Math.abs(e.clientY - st.y) > 10 || Date.now() - st.t > 700) return;
  clearTimeout(tapT);
  tapT = setTimeout(function () {
    if (tapLast && tapLast.key === st.key && Date.now() - tapLast.at < 1500) return; // the click came
    var parts = st.key.split('|'), sel = '[data-act="' + parts[0] + '"]' + (parts[1] ? '[data-id="' + parts[1] + '"]' : '') + (parts[2] ? '[data-v="' + parts[2] + '"]' : '');
    var el = document.querySelector(sel), f = ACTS[parts[0]];
    if (!el || !f) return;
    tapLast = { key: st.key, at: Date.now(), fb: true, seq: downSeq };
    runAct(f, el.dataset, el);
  }, 350);
}, true);
