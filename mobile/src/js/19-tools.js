/* ═══ TOOLS ═════════════════════════════════════════════════════════
   The tools from the desktop builds, rebuilt for the phone: Rank (movies
   and any other list, head-to-head instead of stars), Flashcards (spaced
   review), Bored (pick one thing), Gym (sets, reps, last time) and a
   focus timer. */
var TOOL_LIST = [
  ['rank', '🏆', 'Rank', 'Movies and anything else, ranked head-to-head, not with stars'],
  ['cards', '🎴', 'Flashcards', 'Decks with spaced review: see a card again just before you\'d forget it'],
  ['bored', '🎲', 'Bored', 'One thing to do when nothing appeals'],
  ['gym', '🏋️', 'Gym', 'Sets, reps, and what you lifted last time'],
  ['timer', '⏱', 'Focus timer', 'Twenty-five on, five off']
];
TITLES.tools = 'Tools';
VIEWS.tools = function () {
  var pending = Store.all('ranks').reduce(function (n, l) { return n + rankPending(l).length; }, 0);
  var due = Store.all('decks').reduce(function (n, d) { return n + dueCards(d).length; }, 0);
  var badge = { rank: pending ? pending + ' to rank' : '', cards: due ? due + ' due' : '', timer: timerState.running ? 'running' : '' };
  return '<div class="toolgrid">' + TOOL_LIST.map(function (t) {
    return '<button class="tool" data-act="open" data-v="' + (t[0] === 'rank' ? 'ranks' : t[0] === 'cards' ? 'decks' : t[0]) + '">'
      + '<span class="tic">' + t[1] + '</span><b>' + t[2] + '</b><small>' + esc(t[3]) + '</small>'
      + (badge[t[0]] ? '<span class="pill" style="justify-self:start">' + esc(badge[t[0]]) + '</span>' : '') + '</button>';
  }).join('') + '</div>';
};

/* ── RANK ───────────────────────────────────────────────────────────────
   A list keeps `items` (all of them) and `order` (ids, best first). An
   item not in `order` is waiting to be ranked. Placing one asks "which was
   better?" against the middle of the remaining range: binary insertion,
   so a list of 100 takes about 7 taps. */
function rankList(id) { return Store.get('ranks', id); }
function rankPending(l) { var o = {}; (l.order || []).forEach(function (x) { o[x] = 1; }); return (l.items || []).filter(function (i) { return !o[i.id]; }); }
function rankItem(l, iid) { return (l.items || []).filter(function (i) { return i.id === iid; })[0]; }
function moviesList() {
  var l = Store.all('ranks').filter(function (x) { return x.kind === 'movies'; })[0];
  if (!l) l = Store.put('ranks', { name: 'Movies', ic: '🎬', kind: 'movies', items: [], order: [] }, true);
  return l;
}
function addToRank(listId, item) {
  var l = rankList(listId); if (!l) return null;
  var it = Object.assign({ id: uid('r'), added: today() }, item);
  Store.patch('ranks', listId, { items: (l.items || []).concat([it]) });
  return it;
}
TITLES.ranks = 'Rank';
VIEWS.ranks = function () {
  var ls = Store.all('ranks').sort(function (a, b) { return (a.kind === 'movies' ? -1 : 0) - (b.kind === 'movies' ? -1 : 0) || a.created - b.created; });
  return '<p class="note">Head-to-head, not stars. Each new entry is placed by asking which of two was better, a few times.</p>'
    + (ls.length ? '<div class="list">' + ls.map(function (l) {
      var p = rankPending(l).length, top = (l.order || [])[0], ti = top ? rankItem(l, top) : null;
      return '<button class="row" data-act="open" data-v="rank" data-id="' + l.id + '"><span class="ic">' + esc(l.ic || '🏆') + '</span><span class="grow"><div class="t">' + esc(l.name) + '</div>'
        + '<div class="s">' + (l.order || []).length + ' ranked' + (p ? ' · <b style="color:var(--accent);font-weight:500">' + p + ' to rank</b>' : '') + (ti ? ' · #1 ' + esc(ti.t) : '') + ' ' + exPill(l) + '</div></span>' + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div>' : '')
    + '<form class="addstep" data-form="newrank"><label class="sr" for="nrank">New list</label><input id="nrank" class="input" placeholder="New list: books, burgers, albums…" autocomplete="off"><button class="btn soft" type="submit">Add</button></form>';
};
ACTS.form_newrank = function (d, f) {
  var v = $('input', f).value.trim(); if (!v) return;
  var l = Store.put('ranks', { name: v, ic: '🏆', kind: 'custom', items: [], order: [] }); push('rank', l.id);
};
TITLES.rank = function (id) { var l = rankList(id); return l ? l.name : 'Rank'; };
VIEWS.rank = function (id) {
  var l = rankList(id); if (!l) return '<div class="empty">This list was deleted.</div>';
  var pend = rankPending(l), isM = l.kind === 'movies';
  var h = '';
  if (pend.length) h += '<button class="inboxbar" data-act="rankgo" data-id="' + id + '">' + icon('sparkle') + '<span class="grow"><b>' + pend.length + ' to rank</b><span class="muted small"> · ' + esc(pend.map(function (p) { return p.t; }).slice(0, 3).join(', ')) + '</span></span>' + icon('chev', 'sm chev') + '</button>';
  h += '<form class="addstep" data-form="rankadd" data-id="' + id + '"><label class="sr" for="radd">' + (isM ? 'A movie you watched' : 'Add to this list') + '</label><input id="radd" class="input" placeholder="' + (isM ? 'A movie you watched' : 'Add something') + '" autocomplete="off"><button class="btn accent" type="submit">Add</button></form>';
  var order = l.order || [];
  if (!order.length && !pend.length) h += '<div class="empty">' + (isM ? 'Add a movie you\'ve seen. The second one asks which was better, and the list builds itself from there.' : 'Add two things and the comparing starts.') + '</div>';
  if (order.length) h += '<ol class="ranked">' + order.map(function (iid, i) {
    var it = rankItem(l, iid); if (!it) return '';
    return '<li><button class="rrow' + (i < 3 ? ' top' : '') + '" data-act="rankitem" data-id="' + id + '" data-i="' + iid + '"><span class="pos">' + (i + 1) + '</span><span class="grow"><span class="t">' + esc(it.t) + (it.year ? ' <span class="faint">(' + esc(it.year) + ')</span>' : '') + '</span>'
      + (it.note || it.watched ? '<span class="s">' + (it.watched ? 'Watched ' + esc(shortDate(it.watched)) : '') + (it.note && it.watched ? ' · ' : '') + esc(it.note || '') + '</span>' : '') + '</span></button></li>';
  }).join('') + '</ol>';
  h += '<details class="card"><summary class="muted" style="cursor:pointer">List settings</summary><div style="display:grid;gap:12px;margin-top:12px">'
    + '<div class="btnrow"><div class="field" style="flex:1"><label for="rname">Name</label><input id="rname" class="input" data-rfield="name" value="' + esc(l.name) + '"></div>'
    + '<div class="field" style="flex:0 0 80px"><label for="ric">Icon</label><input id="ric" class="input" style="text-align:center" maxlength="4" data-rfield="ic" value="' + esc(l.ic || '') + '"></div></div>'
    + '<button class="btn ghost" style="color:var(--bad);justify-self:start" data-act="delrank" data-id="' + id + '">Delete list</button></div></details>';
  return h;
};
VIEWS.rank.after = function (id) {
  $$('[data-rfield]').forEach(function (el) { el.addEventListener('input', function () { var f = {}; f[el.dataset.rfield] = el.value; Store.patch('ranks', id, f); }); });
};
ACTS.form_rankadd = function (d, f) {
  var inp = $('input', f), v = inp.value.trim(); if (!v) return;
  var l = rankList(d.id), m = /^(.*?)\s*\((\d{4})\)\s*$/.exec(v);
  var it = addToRank(d.id, { t: m ? m[1] : v, year: m ? m[2] : '', watched: l.kind === 'movies' ? today() : null });
  inp.value = '';
  if (l.kind === 'movies') logEvent('Watched ' + it.t);
  startRanking(d.id, it.id);
};
ACTS.rankgo = function (d) { var l = rankList(d.id), p = rankPending(l)[0]; if (p) startRanking(d.id, p.id); };
ACTS.delrank = function (d) {
  var l = rankList(d.id); Store.del('ranks', d.id); pop(); toast('List deleted', function () { Store.put('ranks', l); });
};

/* The comparison sheet. */
var cmp = null; // {list, item, lo, hi, asked}
function startRanking(listId, itemId) {
  var l = rankList(listId), order = (l.order || []).filter(function (x) { return x !== itemId; });
  if (!order.length) { Store.patch('ranks', listId, { order: [itemId] }); toast('Added. The next one gets compared to it.'); return; }
  cmp = { list: listId, item: itemId, lo: 0, hi: order.length, asked: 0, total: Math.ceil(Math.log2(order.length + 1)) };
  askNext();
}
function askNext() {
  var l = rankList(cmp.list), order = (l.order || []).filter(function (x) { return x !== cmp.item; });
  if (cmp.lo >= cmp.hi) {
    order.splice(cmp.lo, 0, cmp.item); Store.patch('ranks', cmp.list, { order: order });
    var it = rankItem(l, cmp.item), pos = cmp.lo + 1, next = rankPending(rankList(cmp.list))[0];
    var listId = cmp.list; cmp = null;
    if (next) { toast(esc(it.t) + ' is #' + pos + '. Next one…'); startRanking(listId, next.id); }
    else { closeSheet(); toast(esc(it.t) + ' is #' + pos + ' of ' + order.length); }
    return;
  }
  var mid = (cmp.lo + cmp.hi) >> 1, a = rankItem(l, cmp.item), b = rankItem(l, order[mid]);
  cmp.mid = mid; cmp.asked++;
  var card = function (it, side) {
    return '<button class="vs" data-act="rankpick" data-s="' + side + '"><b>' + esc(it.t) + '</b>' + (it.year ? '<span>' + esc(it.year) + '</span>' : '')
      + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</button>';
  };
  openSheet('<div class="shead"><h2>' + (l.kind === 'movies' ? 'Which was better?' : 'Which is better?') + '</h2><button class="iconbtn" data-act="rankstop" aria-label="Stop for now">' + icon('x') + '</button></div>'
    + '<p class="note small">Question ' + cmp.asked + ' of about ' + Math.max(cmp.asked, cmp.total) + '. Go with your gut.</p>'
    + '<div class="vsgrid">' + card(a, 'new') + '<span class="vsor">or</span>' + card(b, 'old') + '</div>'
    + '<button class="btn ghost block" data-act="rankpick" data-s="tie">Too close to call</button>', null, function () { cmp = null; });
}
ACTS.rankpick = function (d) {
  if (!cmp) return;
  if (d.s === 'new') cmp.hi = cmp.mid; else cmp.lo = cmp.mid + 1; // a tie places it just below
  sheetOnClose = null; askNext();
};
ACTS.rankstop = function () { cmp = null; closeSheet(); toast('Saved. The rest wait under "to rank".'); };
ACTS.rankitem = function (d) {
  var l = rankList(d.id), it = rankItem(l, d.i), pos = (l.order || []).indexOf(d.i) + 1;
  openSheet('<div class="shead"><h2>#' + pos + ' · ' + esc(it.t) + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<div class="field"><label for="rinote">Note</label><input id="rinote" class="input" value="' + esc(it.note || '') + '" placeholder="What stuck with you"></div>'
    + '<div class="btnrow"><button class="btn soft" data-act="rankmove" data-id="' + d.id + '" data-i="' + d.i + '" data-n="-1"' + (pos === 1 ? ' disabled' : '') + '>Move up</button>'
    + '<button class="btn soft" data-act="rankmove" data-id="' + d.id + '" data-i="' + d.i + '" data-n="1"' + (pos === (l.order || []).length ? ' disabled' : '') + '>Move down</button></div>'
    + '<div class="btnrow"><button class="btn accent" data-act="rerank" data-id="' + d.id + '" data-i="' + d.i + '">Rank it again</button>'
    + '<button class="btn ghost" style="color:var(--bad)" data-act="rankdel" data-id="' + d.id + '" data-i="' + d.i + '">Remove</button></div>',
    function (s) {
      $('#rinote', s).addEventListener('input', function (e) {
        var cur = rankList(d.id); Store.patch('ranks', d.id, { items: cur.items.map(function (x) { return x.id === d.i ? Object.assign({}, x, { note: e.target.value }) : x; }) });
      });
    });
};
ACTS.rankmove = function (d) {
  var l = rankList(d.id), o = (l.order || []).slice(), i = o.indexOf(d.i), j = i + (+d.n);
  if (j < 0 || j >= o.length) return; o.splice(i, 1); o.splice(j, 0, d.i);
  Store.patch('ranks', d.id, { order: o }); closeSheet();
};
ACTS.rerank = function (d) {
  var l = rankList(d.id); Store.patch('ranks', d.id, { order: (l.order || []).filter(function (x) { return x !== d.i; }) });
  closeSheet(); startRanking(d.id, d.i);
};
ACTS.rankdel = function (d) {
  var l = rankList(d.id);
  Store.patch('ranks', d.id, { items: l.items.filter(function (x) { return x.id !== d.i; }), order: (l.order || []).filter(function (x) { return x !== d.i; }) });
  closeSheet(); toast('Removed', function () { Store.put('ranks', l); });
};

/* ── FLASHCARDS ────────────────────────────────────────────────────────
   Five boxes. Right moves a card up a box and pushes it further out
   (1, 2, 4, 8, 16 days); wrong sends it back to box 1, due today. */
var GAPS = [0, 1, 2, 4, 8, 16];
function dueCards(dk) { var t = today(); return (dk.cards || []).filter(function (c) { return !c.due || c.due <= t; }); }
TITLES.decks = 'Flashcards';
VIEWS.decks = function () {
  var ds = Store.all('decks').sort(function (a, b) { return a.created - b.created; });
  return (ds.length ? '<div class="list">' + ds.map(function (dk) {
    var due = dueCards(dk).length;
    return '<button class="row" data-act="open" data-v="deck" data-id="' + dk.id + '"><span class="ic">🎴</span><span class="grow"><div class="t">' + esc(dk.name) + '</div>'
      + '<div class="s">' + (dk.cards || []).length + ' cards' + (due ? ' · <b style="color:var(--accent);font-weight:500">' + due + ' due</b>' : ' · all caught up') + ' ' + exPill(dk) + '</div></span>' + icon('chev', 'sm chev') + '</button>';
  }).join('') + '</div>' : '<div class="empty">No decks yet.</div>')
    + '<form class="addstep" data-form="newdeck"><label class="sr" for="ndeck">New deck</label><input id="ndeck" class="input" placeholder="New deck" autocomplete="off"><button class="btn soft" type="submit">Add</button></form>';
};
ACTS.form_newdeck = function (d, f) { var v = $('input', f).value.trim(); if (!v) return; var dk = Store.put('decks', { name: v, cards: [] }); push('deck', dk.id); };
TITLES.deck = function (id) { var dk = Store.get('decks', id); return dk ? dk.name : 'Deck'; };
var review = null; // {deck, queue:[ids], shown}
VIEWS.deck = function (id) {
  var dk = Store.get('decks', id); if (!dk) return '<div class="empty">This deck was deleted.</div>';
  var due = dueCards(dk), cards = dk.cards || [];
  var h = '<div class="stats4">' + [['Due', due.length], ['Cards', cards.length], ['Learned', cards.filter(function (c) { return (c.box || 1) >= 4; }).length], ['New', cards.filter(function (c) { return !c.seen; }).length]]
    .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
  if (review && review.deck === id && review.queue.length) {
    var c = cards.filter(function (x) { return x.id === review.queue[0]; })[0];
    if (c) return h + '<div class="flash"><div class="small faint">' + review.queue.length + ' left · box ' + (c.box || 1) + '</div><div class="q">' + esc(c.q) + '</div>'
      + (review.shown ? '<div class="a">' + esc(c.a) + '</div><div class="btnrow"><button class="btn soft" data-act="cardans" data-ok="0">Again</button><button class="btn accent" data-act="cardans" data-ok="1">Got it</button></div>'
        : '<button class="btn accent block" data-act="cardshow">Show the answer</button>') + '</div>'
      + '<button class="link" data-act="cardstop">Stop for now</button>';
  }
  h += due.length ? '<button class="btn accent block" data-act="cardstart" data-id="' + id + '">Review ' + due.length + ' card' + (due.length === 1 ? '' : 's') + '</button>' : '<div class="empty">All caught up. The next cards come due ' + esc(nextDue(dk)) + '.</div>';
  h += '<form class="cardform" data-form="addcard" data-id="' + id + '"><label class="sr" for="cq">Front</label><input id="cq" class="input" name="q" placeholder="Front: the question" autocomplete="off">'
    + '<label class="sr" for="ca">Back</label><input id="ca" class="input" name="a" placeholder="Back: the answer" autocomplete="off"><button class="btn soft" type="submit">Add card</button></form>';
  h += cards.length ? '<details class="card"><summary class="muted" style="cursor:pointer">All ' + cards.length + ' cards</summary><div class="list" style="margin-top:6px">' + cards.map(function (c) {
    return '<div class="row"><span class="grow"><div class="t">' + esc(c.q) + '</div><div class="s">' + esc(c.a) + ' · box ' + (c.box || 1) + '</div></span><button class="iconbtn" data-act="delcard" data-id="' + id + '" data-c="' + c.id + '" aria-label="Delete card">' + icon('x', 'sm') + '</button></div>';
  }).join('') + '</div></details>' : '';
  h += '<button class="btn ghost" style="color:var(--bad);justify-self:start" data-act="deldeck" data-id="' + id + '">Delete deck</button>';
  return h;
};
function nextDue(dk) { var d = (dk.cards || []).map(function (c) { return c.due; }).filter(Boolean).sort()[0]; return d ? shortDate(d).toLowerCase() : 'later'; }
ACTS.cardstart = function (d) { var dk = Store.get('decks', d.id); review = { deck: d.id, queue: dueCards(dk).map(function (c) { return c.id; }), shown: false, right: 0 }; render(); };
ACTS.cardshow = function () { review.shown = true; render(); };
ACTS.cardstop = function () { review = null; render(); };
ACTS.cardans = function (d) {
  var dk = Store.get('decks', review.deck), cid = review.queue.shift(), ok = d.ok === '1';
  var cards = dk.cards.map(function (c) {
    if (c.id !== cid) return c;
    var box = ok ? Math.min(5, (c.box || 1) + 1) : 1;
    return Object.assign({}, c, { box: box, due: ok ? addDays(today(), GAPS[box]) : today(), seen: true });
  });
  if (!ok) review.queue.push(cid); else review.right++;
  review.shown = false;
  Store.patch('decks', review.deck, { cards: cards });
  if (!review.queue.length) { logEvent('Reviewed ' + dk.name + ': ' + review.right + ' cards'); toast('Done. ' + review.right + ' cards reviewed.'); review = null; render(); }
};
ACTS.form_addcard = function (d, f) {
  var q = $('[name=q]', f).value.trim(), a = $('[name=a]', f).value.trim(); if (!q || !a) { toast('A card needs a front and a back'); return; }
  var dk = Store.get('decks', d.id);
  Store.patch('decks', d.id, { cards: (dk.cards || []).concat([{ id: uid('c'), q: q, a: a, box: 1, due: today() }]) });
  render(false, true); var n = $('#cq'); if (n) n.focus();
};
ACTS.delcard = function (d) { var dk = Store.get('decks', d.id); Store.patch('decks', d.id, { cards: dk.cards.filter(function (c) { return c.id !== d.c; }) }); };
ACTS.deldeck = function (d) { var dk = Store.get('decks', d.id); Store.del('decks', d.id); pop(); toast('Deck deleted', function () { Store.put('decks', dk); }); };

/* ── BORED ─────────────────────────────────────────────────────────── */
function boredDoc() { return Store.get('tools', 'bored') || Store.put('tools', { id: 'bored', items: [], last: null }, true); }
TITLES.bored = 'Bored';
var boredPick = null;
VIEWS.bored = function () {
  var b = boredDoc(), items = b.items || [];
  return '<div class="flash" style="text-align:center"><div class="q">' + esc(boredPick || 'Nothing appeals? Let it choose.') + '</div>'
    + '<button class="btn accent block" data-act="boredgo"' + (items.length ? '' : ' disabled') + '>🎲 ' + (boredPick ? 'Something else' : 'Pick one') + '</button>'
    + (boredPick ? '<button class="link" data-act="boredtask">Put it on today</button>' : '') + '</div>'
    + '<form class="addstep" data-form="boredadd"><label class="sr" for="badd">Add an option</label><input id="badd" class="input" placeholder="Add an option" autocomplete="off"><button class="btn soft" type="submit">Add</button></form>'
    + '<div class="list">' + items.map(function (x, i) {
      return '<div class="row"><span class="grow t">' + esc(x) + '</span><button class="iconbtn" data-act="boreddel" data-i="' + i + '" aria-label="Remove">' + icon('x', 'sm') + '</button></div>';
    }).join('') + '</div>';
};
ACTS.boredgo = function () {
  var items = boredDoc().items || []; if (!items.length) return;
  var pool = items.length > 1 ? items.filter(function (x) { return x !== boredPick; }) : items;
  boredPick = pool[Math.floor(Math.random() * pool.length)]; render();
};
ACTS.boredtask = function () { Store.put('tasks', { t: boredPick, due: today(), done: false, steps: [], note: 'Picked by Bored.' }); toast('On today'); };
ACTS.form_boredadd = function (d, f) { var v = $('input', f).value.trim(); if (!v) return; var b = boredDoc(); Store.patch('tools', 'bored', { items: (b.items || []).concat([v]) }); render(false, true); var n = $('#badd'); if (n) n.focus(); };
ACTS.boreddel = function (d) { var b = boredDoc(), items = (b.items || []).slice(); items.splice(+d.i, 1); Store.patch('tools', 'bored', { items: items }); };

/* ── GYM ───────────────────────────────────────────────────────────── */
TITLES.gym = 'Gym';
VIEWS.gym = function () {
  var ex = Store.all('lifts').sort(function (a, b) { return (b.lastAt || 0) - (a.lastAt || 0); });
  return (ex.length ? '<div class="list">' + ex.map(function (e) {
    var last = (e.log || [])[e.log.length - 1];
    return '<button class="row" data-act="open" data-v="lift" data-id="' + e.id + '"><span class="ic">🏋️</span><span class="grow"><div class="t">' + esc(e.n) + '</div>'
      + '<div class="s">' + (last ? 'Last: ' + liftLine(last, e.unit) + ' · ' + esc(shortDate(last.d)) : 'Not logged yet') + ' ' + exPill(e) + '</div></span>' + icon('chev', 'sm chev') + '</button>';
  }).join('') + '</div>' : '<div class="empty">Add the lifts you do. Each one remembers what you did last time.</div>')
    + '<form class="addstep" data-form="newlift"><label class="sr" for="nlift">New exercise</label><input id="nlift" class="input" placeholder="New exercise" autocomplete="off"><button class="btn soft" type="submit">Add</button></form>';
};
function liftLine(x, unit) { return (x.w ? x.w + ' ' + (unit || 'lb') + ' · ' : '') + x.sets + '×' + x.reps; }
ACTS.form_newlift = function (d, f) { var v = $('input', f).value.trim(); if (!v) return; var e = Store.put('lifts', { n: v, unit: 'lb', log: [] }); push('lift', e.id); };
TITLES.lift = function (id) { var e = Store.get('lifts', id); return e ? e.n : 'Exercise'; };
VIEWS.lift = function (id) {
  var e = Store.get('lifts', id); if (!e) return '<div class="empty">This exercise was deleted.</div>';
  var log = e.log || [], last = log[log.length - 1], best = log.reduce(function (m, x) { return Math.max(m, +x.w || 0); }, 0);
  var recent = log.slice(-12), maxW = recent.reduce(function (m, x) { return Math.max(m, +x.w || 0); }, 0) || 1;
  return '<div class="stats4">' + [['Last', last ? (last.w || '—') : '—'], ['Best', best || '—'], ['Sessions', log.length], ['Unit', e.unit || 'lb']].map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>'
    + (recent.length > 1 ? '<div class="liftbars" aria-label="Weight over the last ' + recent.length + ' sessions">' + recent.map(function (x) { return '<i style="height:' + Math.max(8, Math.round((+x.w || 0) / maxW * 100)) + '%" title="' + esc(liftLine(x, e.unit)) + '"></i>'; }).join('') + '</div>' : '')
    + '<form class="liftform" data-form="logset" data-id="' + id + '"><div class="field"><label for="lw">Weight</label><input id="lw" class="input" name="w" inputmode="decimal" value="' + esc(last ? last.w : '') + '"></div>'
    + '<div class="field"><label for="ls">Sets</label><input id="ls" class="input" name="sets" inputmode="numeric" value="' + esc(last ? last.sets : '3') + '"></div>'
    + '<div class="field"><label for="lr">Reps</label><input id="lr" class="input" name="reps" inputmode="numeric" value="' + esc(last ? last.reps : '8') + '"></div>'
    + '<button class="btn accent" type="submit">Log today</button></form>'
    + (last ? '<p class="note small">Last time: ' + esc(liftLine(last, e.unit)) + ' on ' + esc(shortDate(last.d)) + '. Same again counts.</p>' : '')
    + (log.length ? '<div class="list">' + log.slice().reverse().slice(0, 20).map(function (x, i) {
      return '<div class="row"><span class="grow"><div class="t">' + esc(liftLine(x, e.unit)) + '</div><div class="s">' + esc(shortDate(x.d)) + '</div></span>'
        + '<button class="iconbtn" data-act="delset" data-id="' + id + '" data-i="' + (log.length - 1 - i) + '" aria-label="Delete">' + icon('x', 'sm') + '</button></div>';
    }).join('') + '</div>' : '')
    + '<div class="btnrow"><button class="btn soft" data-act="liftunit" data-id="' + id + '">Switch to ' + (e.unit === 'kg' ? 'lb' : 'kg') + '</button><button class="btn ghost" style="color:var(--bad)" data-act="dellift" data-id="' + id + '">Delete</button></div>';
};
ACTS.form_logset = function (d, f) {
  var g = function (n) { return $('[name=' + n + ']', f).value.trim(); };
  var x = { d: today(), w: parseFloat(g('w')) || 0, sets: parseInt(g('sets'), 10) || 1, reps: parseInt(g('reps'), 10) || 1 };
  var e = Store.get('lifts', d.id);
  Store.patch('lifts', d.id, { log: (e.log || []).concat([x]), lastAt: Date.now() });
  logEvent(e.n + ': ' + liftLine(x, e.unit), 'gym'); toast('Logged');
};
ACTS.delset = function (d) { var e = Store.get('lifts', d.id), log = (e.log || []).slice(); log.splice(+d.i, 1); Store.patch('lifts', d.id, { log: log }); };
ACTS.liftunit = function (d) { var e = Store.get('lifts', d.id); Store.patch('lifts', d.id, { unit: e.unit === 'kg' ? 'lb' : 'kg' }); };
ACTS.dellift = function (d) { var e = Store.get('lifts', d.id); Store.del('lifts', d.id); pop(); toast('Deleted', function () { Store.put('lifts', e); }); };

/* ── FOCUS TIMER ───────────────────────────────────────────────────── */
var TMODES = [['Focus', 25], ['Short break', 5], ['Long break', 15]];
var timerState = (function () { try { return JSON.parse(localStorage.getItem('mossos.timer') || 'null') || { m: 0, end: null, left: 1500, running: false }; } catch (e) { return { m: 0, end: null, left: 1500, running: false }; } })();
function timerSave() { try { localStorage.setItem('mossos.timer', JSON.stringify(timerState)); } catch (e) {} }
function timerLeft() { return timerState.running ? Math.max(0, Math.round((timerState.end - Date.now()) / 1000)) : timerState.left; }
var timerTick = null;
function timerLoop() {
  clearInterval(timerTick);
  if (!timerState.running) return;
  timerTick = setInterval(function () {
    var l = timerLeft(), el = $('#tclock');
    if (el) el.textContent = fmtSecs(l);
    if (l <= 0) {
      clearInterval(timerTick); timerState.running = false; timerState.left = TMODES[timerState.m][1] * 60; timerSave();
      if (timerState.m === 0) logEvent('Focused for ' + TMODES[0][1] + ' minutes');
      toast(timerState.m === 0 ? 'Focus done. Take five.' : 'Break over.');
      if (navigator.vibrate) navigator.vibrate(200);
      render();
    }
  }, 500);
}
function fmtSecs(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
TITLES.timer = 'Focus timer';
VIEWS.timer = function () {
  return '<div class="seg" role="tablist">' + TMODES.map(function (m, i) {
    return '<button role="tab" aria-selected="' + (timerState.m === i) + '" class="' + (timerState.m === i ? 'on' : '') + '" data-act="tmode" data-i="' + i + '">' + m[0] + '</button>';
  }).join('') + '</div>'
    + '<div class="timer"><div id="tclock" class="tclock" aria-live="off">' + fmtSecs(timerLeft()) + '</div>'
    + '<div class="btnrow"><button class="btn accent" data-act="tgo">' + (timerState.running ? 'Pause' : 'Start') + '</button><button class="btn soft" data-act="treset">Reset</button></div></div>'
    + '<p class="note">Keep MossOS open for the alert. If you leave, the time still counts down and you\'ll see where it got to when you come back.</p>';
};
VIEWS.timer.after = function () { timerLoop(); };
ACTS.tmode = function (d) { timerState = { m: +d.i, end: null, left: TMODES[+d.i][1] * 60, running: false }; timerSave(); render(); };
ACTS.tgo = function () {
  if (timerState.running) { timerState.left = timerLeft(); timerState.running = false; }
  else { timerState.end = Date.now() + timerState.left * 1000; timerState.running = true; }
  timerSave(); render();
};
ACTS.treset = function () { timerState = { m: timerState.m, end: null, left: TMODES[timerState.m][1] * 60, running: false }; timerSave(); render(); };
