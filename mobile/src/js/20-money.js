/* ═══ MONEY ═════════════════════════════════════════════════════════
   Payday OS runs unchanged in a frame (PAYDAY_SRC, added by build.mjs).
   The frame is made once, a second after the first paint, and lives
   outside #view so re-renders never reload it. It shares this page's
   origin, so it uses the same Claude connection (sync, Monarch, Benji)
   and MossOS can ask it for numbers: __finSummary, __finEvents, __finLog,
   __finImport, __finTheme, __finInfo. */
var FIN = { frame: null, ready: false, view: 'today', sum: null, extra: null, sumKey: '' };
var FIN_NAV = [['today', 'Today'], ['plan', 'Plan Friday'], ['budget', 'Budget'], ['food', 'Groceries'], ['debts', 'Debts'], ['savings', 'Savings']];
var FIN_MORE = [['roadmap', 'Roadmap', 'Card kill dates, decision day, big buys, Roth IRA'], ['data', 'Spending', 'Plan vs actual, interest saved, where it went'],
  ['sort', 'Sort purchases', 'Swipe purchases into the right bucket'], ['calendar', 'Month', 'Every day\'s money, spending and bills'],
  ['future', 'What if', 'A bigger check, a bigger payment: see the date move'], ['ask', 'Ask Payday', 'Step-by-step answers from your plan'],
  ['monarch', 'Monarch', 'Live balances and spending'], ['settings', 'Settings', 'Backup, sync, reset'], ['more', 'Everything else', 'Payday\'s own menu']];
function finMoreOn() { return FIN_MORE.some(function (x) { return x[0] === FIN.view; }); }
var FIN_LINK = 'https://claude.ai/artifact/QwpmDA1mcVAk9UvC9dgqyb';

function finWin() { try { return FIN.ready && FIN.frame ? FIN.frame.contentWindow : null; } catch (e) { return null; } }
function finCall(name, args) {
  var w = finWin(); if (!w) return undefined;
  try { return typeof w[name] === 'function' ? w[name].apply(null, args || []) : undefined; } catch (e) { return undefined; }
}
function ensureFin() {
  if (FIN.frame || typeof PAYDAY_SRC !== 'string') return;
  var f = document.createElement('iframe');
  f.id = 'fin'; f.title = 'Money'; f.hidden = true;
  f.addEventListener('load', function () {
    FIN.ready = true;
    finCall('__finTheme', [document.documentElement.dataset.theme || '']);
    finFlushQueue(); finRefresh(false);
    if (current().view === 'money') render();
  });
  FIN.frame = f; f.srcdoc = PAYDAY_SRC;
  document.body.appendChild(f);
}
setTimeout(ensureFin, 1000);

/* The frame tells us when it repaints; keep Today and Calendar in step. */
var finChangeT = null;
window.__finChanged = function () { clearTimeout(finChangeT); finChangeT = setTimeout(function () { finRefresh(false); }, 300); };
window.__finNav = function (id) {
  var was = FIN.view; FIN.view = id;
  // The bar under the nav changes with the screen; repaint so it fits.
  if (current().view === 'money' && (was === 'food') !== (id === 'food')) render(); else finPaintNav();
};
function finRefresh(quiet) {
  var s = finCall('__finSummary'); if (!s) return;
  var x = finCall('__finExtra') || null;
  var key = JSON.stringify([s, x]); FIN.sum = s; FIN.extra = x;
  if (key === FIN.sumKey) return; FIN.sumKey = key;
  var v = current().view;
  if (!quiet && (v === 'today' || v === 'calendar' || v === 'area')) render();
}

/* Place the frame between the section nav and the tab bar. */
function finLayout() {
  var f = FIN.frame, on = current().view === 'money';
  document.body.classList.toggle('finmode', on);
  if (!f) { if (on) ensureFin(); f = FIN.frame; if (!f) return; }
  if (!on) { f.hidden = true; return; }
  var slot = $('#finslot'), main = document.querySelector('.main'), tabs = $('#tabs');
  if (!slot || !main) { f.hidden = true; return; }
  var r = slot.getBoundingClientRect(), m = main.getBoundingClientRect();
  var tb = tabs && getComputedStyle(tabs).display !== 'none' ? Math.max(0, innerHeight - tabs.getBoundingClientRect().top) : 0;
  f.style.top = Math.round(r.top) + 'px'; f.style.left = Math.round(m.left) + 'px'; f.style.width = Math.round(m.width) + 'px';
  f.style.height = Math.max(200, Math.round(innerHeight - tb - r.top)) + 'px';
  f.hidden = false;
  finCall('__finTheme', [document.documentElement.dataset.theme || '']);
}
addEventListener('resize', function () { if (current().view === 'money') finLayout(); });
function finPaintNav() {
  var nav2 = $('#finnav'); if (!nav2) return;
  nav2.querySelectorAll('[data-fv]').forEach(function (b) {
    var on = b.dataset.fv === FIN.view; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  var mb = $('#finmorebtn');
  setTimeout(finChipIntoView, 0);
  if (mb) { var cur = FIN_MORE.filter(function (x) { return x[0] === FIN.view; })[0]; mb.classList.toggle('on', !!cur); mb.firstChild.textContent = cur ? cur[1] + ' ' : 'More '; }
}

TITLES.money = 'Money';
VIEWS.money = function () {
  var meta = Store.get('meta', 'fin') || {}, info = finCall('__finInfo') || {};
  var h = '<nav class="finnav" id="finnav" aria-label="Money sections">' + FIN_NAV.map(function (x) {
    return '<button class="chip' + (FIN.view === x[0] ? ' on' : '') + '" data-act="fingo" data-fv="' + x[0] + '" aria-current="' + (FIN.view === x[0] ? 'page' : 'false') + '">' + x[1] + '</button>';
  }).join('') + (function () { var cur = FIN_MORE.filter(function (x) { return x[0] === FIN.view; })[0];
    return '<button class="chip' + (cur ? ' on' : '') + '" id="finmorebtn" data-act="finmore" aria-haspopup="dialog">' + (cur ? cur[1] : 'More') + ' ' + icon('chev', 'sm chevdown') + '</button>'; })()
    + '<button class="chip" data-act="afford">Can I afford this?</button></nav>';
  if (FIN.view === 'food' && FIN.ready)
    h += '<div class="finbar row"><span class="grow small"><b>Shopping list → Tasks</b><span class="muted"> · a "Grocery run" task with every item as a step</span></span>'
      + '<button class="btn sm soft" data-act="fingroctask">Send</button></div>';
  if (FIN.ready && window.claude && window.claude.use && info.bridge === false)
    h += '<p class="note small finbar">Money can\'t reach your Claude connection here, so it is saved on this device only and Monarch is off. <a href="' + FIN_LINK + '" target="_blank" rel="noopener">Open Payday OS</a></p>';
  else if (!meta.imported && !meta.hideImport)
    h += '<div class="finbar row"><span class="grow small"><b>Bring your Payday OS data over</b><span class="muted"> · one paste, once</span></span>'
      + '<button class="btn sm soft" data-act="finimport">Import</button><button class="iconbtn" data-act="finhideimport" aria-label="Hide">' + icon('x', 'sm') + '</button></div>';
  h += '<div id="finslot" class="finslot">' + (FIN.ready ? '' : '<p class="note">Loading Payday OS…</p>') + '</div>';
  return h;
};
function finChipIntoView() {
  var n = $('#finnav'), on = n && n.querySelector('.chip.on'); if (!on) return;
  var l = on.offsetLeft - n.offsetLeft, r = l + on.offsetWidth;
  if (l < n.scrollLeft) n.scrollLeft = l - 16; else if (r > n.scrollLeft + n.clientWidth) n.scrollLeft = r - n.clientWidth + 16;
}
VIEWS.money.after = function () { ensureFin(); finChipIntoView(); };
ACTS.fingo = function (d) {
  FIN.view = d.fv;
  if (finWin()) finCall('go', [d.fv]);
  render();
};
ACTS.finmore = function () {
  openSheet('<div class="shead"><h2>More in Money</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<div class="list">' + FIN_MORE.map(function (x) {
      return '<button class="row" data-act="fingoto" data-fv="' + x[0] + '"><span class="grow"><div class="t">' + x[1] + '</div><div class="s">' + x[2] + '</div></span>' + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div>');
};
/* Open Money on one of Payday's screens, from anywhere in MossOS. */
ACTS.fingoto = function (d) {
  if (!$('#sheetbg').hidden) { $('#sheetbg').hidden = true; document.body.style.overflow = ''; sheetOnClose = null; }
  FIN.view = d.fv;
  if (finWin()) finCall('go', [d.fv]);
  if (current().view !== 'money') go('money'); else render();
};
ACTS.fingroctask = function () {
  var items = finCall('__finGroceries') || [];
  if (!items.length) { toast('Nothing left on the list'); return; }
  var steps = items.map(function (x) { return { t: x.name + (x.price ? ' · ' + fmtMoney(x.price) : '') + ' (' + x.store + ')', done: false }; });
  var old = Store.all('tasks').filter(function (t) { return !t.done && t.grocery; })[0];
  var t = old ? Store.put('tasks', Object.assign({}, old, { steps: steps, due: old.due || today() }))
    : Store.put('tasks', { t: 'Grocery run', ic: '🛒', area: 'money', due: today(), done: false, grocery: true, est: '45 min', steps: steps, note: 'From Money → Groceries. Tick items off here or in Money.' });
  logEvent((old ? 'Updated' : 'Made') + ' the grocery run: ' + steps.length + ' items', 'money');
  var msg = (old ? 'Grocery run updated' : 'Grocery run added to Today') + ' · ' + steps.length + ' items';
  if (old) toast(msg, function () { Store.put('tasks', old); }); else toast(msg, function () { Store.del('tasks', t.id); });
};
ACTS.afford = function () {
  if (!finWin()) { ensureFin(); toast('Money is still loading'); return; }
  if (current().view !== 'money') go('money');
  finCall('openAfford', []);
};
ACTS.finhideimport = function () { var m = Store.get('meta', 'fin') || { id: 'fin' }; m.hideImport = true; Store.put('meta', m); render(); };
ACTS.finimport = function () {
  openSheet('<div class="shead"><h2>Import from Payday OS</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<ol class="note small" style="margin:0 0 12px;padding-left:18px"><li>Open <a href="' + FIN_LINK + '" target="_blank" rel="noopener">Payday OS</a>.</li><li>Go to Settings and tap <b>Copy JSON backup</b>.</li><li>Paste it below.</li></ol>'
    + '<form data-form="finimport" style="display:grid;gap:10px"><label class="sr" for="finpaste">Payday OS backup</label>'
    + '<textarea id="finpaste" class="input" rows="6" placeholder="Paste the backup here" autocomplete="off" spellcheck="false"></textarea>'
    + '<p class="note small" id="finmsg">This replaces the plan in Money with your Payday OS plan: pay, bills, budget lines, debts, savings and Benji\'s memory.</p>'
    + '<button class="btn accent" type="submit">Import</button></form>');
};
ACTS.form_finimport = function (d, f) {
  var text = $('#finpaste', f).value;
  if (!text.trim()) return;
  if (!finWin()) { $('#finmsg').textContent = 'Money is still loading. Try again in a moment.'; return; }
  var r = finCall('__finImport', [text]) || { ok: false, msg: 'Couldn\'t import that.' };
  if (!r.ok) { $('#finmsg').textContent = r.msg; return; }
  var m = Store.get('meta', 'fin') || { id: 'fin' }; m.imported = Date.now(); Store.put('meta', m);
  FIN.view = 'today'; closeSheet(); toast('Payday OS data imported'); finRefresh(true);
};

/* ── Today: bills strip ─────────────────────────────────────────────── */
function billsSection() {
  var s = FIN.sum; if (!s) return '';
  var t = today();
  var rows = (s.bills || []).slice(0, 3).map(function (b) {
    var n = Math.round((parseYmd(b.date) - parseYmd(t)) / 864e5);
    return '<button class="row" data-act="tab" data-v="money"><span class="grow"><div class="t">' + esc(b.name) + '</div><div class="s">' + esc(shortDate(b.date)) + (b.est ? ' · projected' : '') + '</div></span>'
      + '<span class="amt">' + esc(fmtMoney(b.amt)) + '</span><span class="pill">' + (n <= 0 ? 'today' : 'in ' + n + 'd') + '</span></button>';
  }).join('');
  return '<section class="money"><div class="sechead"><h2>Money</h2><button class="link" data-act="tab" data-v="money">Open</button></div>'
    + '<div class="stats3 fin3"><button data-act="tab" data-v="money"><b class="' + (s.leftToday < 0 ? 'bad' : '') + '">' + esc(fmtMoney(s.leftToday, true)) + '</b><span>left today</span></button>'
    + '<button data-act="tab" data-v="money"><b>' + esc(fmtMoney(s.weekLeft, true)) + '</b><span>until Friday</span></button>'
    + (s.isFriday ? '<button data-act="tab" data-v="money"><b>' + s.friday.done + '/' + s.friday.total + '</b><span>Friday checklist</span></button>'
      : '<button data-act="afford"><b>?</b><span>Can I afford it</span></button>') + '</div>'
    + finExtraLine()
    + (rows ? '<div class="list">' + rows + '</div>' : '') + '</section>';
}
function finExtraLine() {
  var x = FIN.extra; if (!x) return '';
  var bits = [];
  if (x.week) bits.push('<span class="' + (x.week.spent > x.week.plan ? 'bad' : '') + '">' + fmtMoney(x.week.spent, true) + ' of ' + fmtMoney(x.week.plan, true) + ' plan this week</span>');
  if (x.nextKill) bits.push('next card gone: <b>' + esc(x.nextKill.name) + '</b> · ' + esc(x.nextKill.when));
  return bits.length ? '<p class="note small finline">' + bits.join(' · ') + '</p>' : '';
}
/* Rows for Today's Heads up card. */
function finHeadsUp() {
  var x = FIN.extra, s = FIN.sum, out = [];
  if (!x || !s) return out;
  if (x.toSort) out.push('<div class="hurow"><span>🧾</span><span class="grow"><b>' + x.toSort + ' purchase' + (x.toSort === 1 ? '' : 's') + ' to sort</b></span><button class="btn sm soft" data-act="fingoto" data-fv="sort">Sort</button></div>');
  x.wishReady.slice(0, 2).forEach(function (w) {
    out.push('<div class="hurow"><span>🛍</span><span class="grow"><b>' + esc(w.name) + '</b> <span class="muted">' + esc(fmtMoney(w.amt, true)) + ' · 72 hours are up</span></span><button class="btn sm soft" data-act="afford">Decide</button></div>');
  });
  if (s.isFriday && s.friday.done < s.friday.total) out.push('<div class="hurow"><span>💵</span><span class="grow"><b>Friday plan</b> <span class="muted">' + s.friday.done + ' of ' + s.friday.total + ' done</span></span><button class="btn sm soft" data-act="fingoto" data-fv="today">Open</button></div>');
  return out;
}
function fmtMoney(n, whole) {
  n = +n || 0; var neg = n < 0; n = Math.abs(n);
  var s = '$' + n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : (n % 1 ? 2 : 0), maximumFractionDigits: whole ? 0 : 2 });
  return (neg ? '−' : '') + s;
}
/* Calendar: paydays and bills for a month, by day number. */
function finEventsFor(month) {
  var p = parseYmd(month), ev = finCall('__finEvents', [p.getFullYear(), p.getMonth()]) || [], by = {};
  ev.forEach(function (e) { (by[e.day] = by[e.day] || []).push(e); });
  return by;
}
/* The Money area's "next" line. */
function finNextBill() { var s = FIN.sum, b = s && s.bills && s.bills[0]; return b ? b.name + ' ' + fmtMoney(b.amt) + ' · ' + shortDate(b.date) : ''; }

/* ── Smart capture: "spent $12 at Wawa" ─────────────────────────────── */
var FIN_BUCKETS = { allow: 'Allowance', gas: 'Gas', groc: 'Groceries', fun: 'Fun', cloth: 'Clothes', misc: 'Misc', need: 'Need / other' };
function finQueue() { try { return JSON.parse(localStorage.getItem('mossos.finq') || '[]'); } catch (e) { return []; } }
function finQueueSet(q) { try { localStorage.setItem('mossos.finq', JSON.stringify(q)); } catch (e) {} }
function finFlushQueue() {
  var q = finQueue(); if (!q.length) return;
  finQueueSet([]);
  q.forEach(function (x) { if (x.groc) finCall('__finGrocAdd', [x.groc]); else finCall('__finLog', [x.amount, x.merchant, x.bucket, x.note]); });
}
function finLog(amount, merchant, bucket, note) {
  var r = finCall('__finLog', [amount, merchant, bucket, note]);
  if (r) { finRefresh(true); return r; }
  var q = finQueue(); q.push({ amount: amount, merchant: merchant, bucket: bucket, note: note || '' }); finQueueSet(q); ensureFin();
  return null;
}
function guessBucket(text, amt) {
  var low = text.toLowerCase();
  if (/\b(safeway|walmart|aldi|giant|lidl|grocer(y|ies)|costco|target run|food lion|trader joe)/.test(low)) return 'groc';
  if (/\b(gas|fuel|shell|exxon|bp|sunoco|royal farms|wawa|sheetz|7-?eleven)\b/.test(low) && amt >= 20 && /\b(gas|fuel|fill|tank)\b|exxon|shell|sunoco|\bbp\b/.test(low)) return 'gas';
  if (/\b(shirt|shoes|jeans|hoodie|clothes|jacket|nike|old navy|h&m)\b/.test(low)) return 'cloth';
  if (/\b(movie|game|steam|ps5|xbox|concert|bar|bowling)\b/.test(low)) return 'fun';
  if (/\b(cvs|walgreens|toothpaste|shampoo|soap|deodorant)\b/.test(low)) return 'misc';
  if (/\b(doctor|copay|pharmacy|bill|insurance|phone)\b/.test(low)) return 'need';
  return 'allow';
}
/* "spent $12 at Wawa", "$8.50 chipotle", "bought gas $40" → {amount, merchant, bucket} */
function parseSpent(text) {
  var m = /\$\s?(\d+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s?(?:dollars|bucks)\b/i.exec(text); if (!m) return null;
  var low = text.toLowerCase().trim();
  if (!/^(spent|paid|bought|got|grabbed|dropped|blew)\b|^\$|\b(at|on)\b/.test(low) || /^(pay|send|transfer|owe|buy|get|order|pick up|need)\b/.test(low)) return null;
  var amt = +(m[1] || m[2]);
  var at = /\b(?:at|from)\s+([^,.;]+?)(?:\s+(?:for|on|today|yesterday)\b|[,.;]|$)/i.exec(text);
  var merchant = at ? at[1] : text.replace(m[0], '').replace(/^(i\s+)?(spent|paid|bought|got|grabbed|dropped|blew)\b/i, '').replace(/\b(on|for)\b/gi, ' ').trim();
  merchant = merchant.replace(/\s+/g, ' ').trim().replace(/^\w/, function (c) { return c.toUpperCase(); }) || 'Purchase';
  return { amount: amt, merchant: merchant.slice(0, 60), bucket: guessBucket(text, amt) };
}

/* "add eggs and milk to the grocery list", "groceries: eggs, bread" → ['Eggs', 'Bread'] */
function parseGrocery(text) {
  var m = /^(?:please\s+)?(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:the\s+|my\s+)?(?:grocery|groceries|shopping)\s*list\.?$/i.exec(text)
    || /^(?:grocery|groceries|shopping)(?:\s+list)?\s*[:\-–]\s*(.+)$/i.exec(text)
    || /^(.+?)\s+(?:to|on)\s+(?:the\s+|my\s+)?(?:grocery|shopping)\s+list\.?$/i.exec(text);
  if (!m) return null;
  var items = m[1].split(/\s*,\s*|\s+and\s+|\s*\+\s*/).map(function (x) { return x.trim().replace(/^(some|a|an)\s+/i, '').replace(/^\w/, function (c) { return c.toUpperCase(); }); }).filter(Boolean);
  return items.length ? items.slice(0, 20) : null;
}
function finGrocAdd(items) {
  var n = finCall('__finGrocAdd', [items]);
  if (n) { finRefresh(true); return n; }
  var q = finQueue(); q.push({ groc: items }); finQueueSet(q); ensureFin();
  return 0;
}
