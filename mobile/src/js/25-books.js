/* ═══ BOOKS ═════════════════════════════════════════════════════════
   Progress (pages, pace, a finish estimate), quotes and thoughts kept as
   notes (so Notes search finds them), and Claude as a reading companion
   that never reads ahead of your page.
   { title, author, pages, page, color, started, finished, log:{ymd: page} } */
var BOOK_COLORS = ['#F0C889', '#7AA2F7', '#5FCF8E', '#C39BD3', '#F08A4B', '#3CC4B4', '#F27BA8'];
function booksAll() {
  return Store.all('books').sort(function (a, b) { return (!!a.finished - !!b.finished) || (b.updated || 0) - (a.updated || 0); });
}
function booksReading() { return booksAll().filter(function (b) { return !b.finished; }); }
function bookPct(b) { return b.pages ? Math.min(100, Math.round(100 * (b.page || 0) / b.pages)) : 0; }
/* The page you were on at the end of a day (0 before you started). */
function bookPageOn(b, d) {
  var best = null, log = b.log || {};
  Object.keys(log).forEach(function (k) { if (k <= d && (!best || k > best)) best = k; });
  return best ? +log[best] : 0;
}
function bookPace(b) {
  var t = today(), from = addDays(t, -14), start = b.started || t;
  var base = start > from ? 0 : bookPageOn(b, from), days = Math.max(1, Math.min(14, dayDiff(start, t) + (start > from ? 1 : 0)));
  var read = (b.page || 0) - base;
  return read > 0 ? read / days : 0;
}
function bookEta(b) {
  var p = bookPace(b); if (!p || !b.pages || b.finished) return null;
  return addDays(today(), Math.max(1, Math.ceil((b.pages - (b.page || 0)) / p)));
}
function bookNotes(id) { return Store.all('notes').filter(function (n) { return n.book === id; }).sort(function (a, b) { return (b.created || 0) - (a.created || 0); }); }
function bookFind(text) {
  var best = null, bs = 0;
  booksAll().forEach(function (b) { var v = overlap(b.title, text); if (v > bs || (v === bs && best && best.finished && !b.finished)) { bs = v; best = b; } });
  if (best && bs >= 0.5) return best;
  var r = booksReading(); return !text.trim() && r.length === 1 ? r[0] : null;
}
/* Logging pages also feeds a reading habit: one with a "pages" target
   gets the amount; one called "Read …" is marked done once today's pages
   reach the number in its name. */
function bookFeedHabit(delta, readToday) {
  if (!(delta > 0)) return;
  var hs = habitsSorted(), t = today();
  var amt = hs.filter(function (h) { return h.target && /^pages?$/i.test(h.unit || ''); })[0];
  if (amt) { logAmount(amt.id, t, delta); return; }
  var rd = hs.filter(function (h) { return !h.target && /\bread/i.test(h.n); })[0];
  if (rd && !habitDone(rd, t)) { var m = /(\d+)/.exec(rd.n); if (readToday >= (m ? +m[1] : 1)) setMark(rd.id, t, 1); }
}
function logPages(id, page) {
  var b = Store.get('books', id); if (!b) return null;
  var t = today(), was = b.page || 0;
  page = Math.max(0, Math.round(+page || 0)); if (b.pages) page = Math.min(b.pages, page);
  var log = Object.assign({}, b.log || {}); log[t] = page;
  var f = { page: page, log: log, started: b.started || t };
  var fin = b.pages && page >= b.pages && !b.finished;
  if (fin) f.finished = t;
  Store.patch('books', id, f);
  bookFeedHabit(page - was, page - bookPageOn(b, addDays(t, -1)));
  if (fin) logEvent('Finished ' + b.title + ' 📖'); else if (page > was) logEvent('Read ' + (page - was) + ' pages of ' + b.title);
  return { read: page - was, page: page, finished: fin };
}
function addBookNote(id, kind, text, page) {
  var b = Store.get('books', id); if (!b || !text.trim()) return null;
  var body = text.trim();
  return Store.put('notes', { title: (kind === 'quote' ? '❝ ' : '') + body.replace(/\s+/g, ' ').slice(0, 70), body: body, kind: kind, book: id, page: page ? +page : null, area: null }, true);
}

TITLES.books = 'Books';
VIEWS.books = function () {
  var rd = booksReading(), fin = booksAll().filter(function (b) { return b.finished; });
  var h = rd.length ? '<div class="booklist">' + rd.map(bookCard).join('') + '</div>' : '<div class="empty">No book on the go. Add the one you\'re reading, and log pages as you go.</div>';
  h += '<details class="card flat"' + (rd.length ? '' : ' open') + '><summary><b>Add a book</b></summary><form class="bookform" data-form="addbook">'
    + '<label class="sr" for="bkt">Title</label><input id="bkt" class="input" placeholder="Title" autocomplete="off" required>'
    + '<div class="btnrow"><label class="sr" for="bka">Author</label><input id="bka" class="input" placeholder="Author" autocomplete="off" style="flex:2">'
    + '<label class="sr" for="bkp">Pages</label><input id="bkp" class="input" inputmode="numeric" placeholder="Pages" style="flex:1"></div>'
    + '<button class="btn accent" type="submit">Add</button></form></details>';
  if (fin.length) h += '<section><div class="sechead"><h2>Finished</h2><span class="meta">' + fin.length + '</span></div><div class="list">' + fin.map(function (b) {
    return '<button class="row" data-act="open" data-v="book" data-id="' + b.id + '"><span class="dot" style="background:' + esc(b.color) + '"></span><span class="grow"><div class="t">' + esc(b.title) + '</div><div class="s">' + esc(b.author || '') + (b.author ? ' · ' : '') + 'finished ' + esc(shortDate(b.finished)) + '</div></span>' + icon('chev', 'sm chev') + '</button>';
  }).join('') + '</div></section>';
  return h;
};
function bookCard(b) {
  var eta = bookEta(b);
  return '<button class="bookcard" style="--c:' + esc(b.color) + '" data-act="open" data-v="book" data-id="' + b.id + '"><span class="bcov">📖</span><span class="grow">'
    + '<div class="t">' + esc(b.title) + '</div><div class="s">' + esc(b.author || '') + '</div>'
    + '<div class="chbar"><i style="width:' + bookPct(b) + '%;background:var(--c)"></i></div>'
    + '<div class="s">p. ' + (b.page || 0) + (b.pages ? ' / ' + b.pages + ' · ' + bookPct(b) + '%' : '') + (eta ? ' · done ~' + esc(shortDate(eta)) : '') + '</div></span></button>';
}
ACTS.form_addbook = function (d, f) {
  var t = $('#bkt', f).value.trim(); if (!t) return;
  var b = Store.put('books', { title: t.slice(0, 120), author: $('#bka', f).value.trim().slice(0, 80), pages: Math.max(0, Math.round(+$('#bkp', f).value || 0)) || null,
    page: 0, color: BOOK_COLORS[Store.all('books').length % BOOK_COLORS.length], started: today(), finished: null, log: {} }, true);
  logEvent('Started reading ' + b.title); push('book', b.id);
};

TITLES.book = function (id) { var b = Store.get('books', id); return b ? b.title : 'Book'; };
VIEWS.book = function (id) {
  var b = Store.get('books', id); if (!b) return '<div class="empty">This book was removed.</div>';
  var pace = bookPace(b), eta = bookEta(b), ns = bookNotes(id);
  var h = '<div class="bookhead" style="--c:' + esc(b.color) + '"><span class="bcov big">📖</span><div><div class="t">' + esc(b.title) + '</div><div class="s">' + esc(b.author || 'Author unknown') + '</div></div></div>';
  // Progress
  h += '<section class="card"><div class="bigpage"><b>p. ' + (b.page || 0) + '</b>' + (b.pages ? '<span> / ' + b.pages + ' · ' + bookPct(b) + '%</span>' : '') + '</div>'
    + '<div class="chbar"><i style="width:' + bookPct(b) + '%;background:' + esc(b.color) + '"></i></div>'
    + '<p class="note small" id="bkpace">' + (b.finished ? 'Finished ' + esc(longDate(b.finished)) + '.' : pace ? '~' + Math.round(pace) + ' pages a day lately' + (eta ? ' · finish around ' + esc(shortDate(eta)) : '') : 'Log a page to see your pace and a finish date.') + '</p>'
    + (b.finished ? '<button class="btn soft" data-act="bookreopen" data-id="' + id + '">Reading it again</button>'
      : '<form class="addstep" data-form="bookpage" data-id="' + id + '"><label class="sr" for="bkpg">Page you\'re on</label><input id="bkpg" class="input" inputmode="numeric" placeholder="Page no." autocomplete="off"><button class="btn soft" type="submit">Log</button></form>'
      + '<div class="chips">' + [10, 20, 50].map(function (n) { return '<button class="chip" data-act="bookadd" data-id="' + id + '" data-n="' + n + '">+' + n + ' pages</button>'; }).join('') + '</div>')
    + '</section>';
  // Claude companion
  h += '<section><div class="sechead"><h2>Reading companion</h2><span class="meta">up to p. ' + (b.page || 0) + '</span></div>'
    + (AI.ready ? '<div class="chips">' + [['recap', 'Recap so far'], ['questions', 'Discussion questions'], ['apply', 'How does this apply to me?']].map(function (x) {
      return '<button class="chip" data-act="bookai" data-id="' + id + '" data-k="' + x[0] + '">' + icon('sparkle', 'sm') + x[1] + '</button>';
    }).join('') + '</div><form class="addstep" data-form="bookask" data-id="' + id + '" style="margin-top:10px"><label class="sr" for="bkq">Ask about the book</label><input id="bkq" class="input" placeholder="Ask anything about it so far" autocomplete="off"><button class="btn soft" type="submit">Ask</button></form>'
      + '<p class="note small">Claude only talks about the book up to your page, and says so if it doesn\'t know the book well.</p>'
      : '<p class="note">Open MossOS in the Claude app to talk the book through with Claude.</p>') + '</section>';
  // Quotes and thoughts
  h += '<section><div class="sechead"><h2>Quotes and thoughts</h2><span class="meta">' + ns.length + '</span></div>'
    + '<form class="bookform" data-form="booknote" data-id="' + id + '"><label class="sr" for="bkn">Quote or thought</label><textarea id="bkn" class="input" rows="3" placeholder="A line worth keeping, or what you think"></textarea>'
    + '<div class="btnrow"><label class="sr" for="bknp">Page</label><input id="bknp" class="input" inputmode="numeric" placeholder="Page" style="flex:1" value="' + (b.page || '') + '">'
    + '<button class="btn soft" type="submit" style="flex:1">Save quote</button><button class="btn soft" type="button" data-act="booknotethought" data-id="' + id + '" style="flex:1">Save thought</button></div></form>'
    + (ns.length ? '<div class="list">' + ns.map(function (n) {
      return '<button class="row" data-act="open" data-v="note" data-id="' + n.id + '"><span class="grow"><div class="t' + (n.kind === 'quote' ? ' quote' : '') + '">' + esc((n.body || n.title || '').slice(0, 160)) + '</div><div class="s">' + (n.kind === 'quote' ? 'Quote' : 'Thought') + (n.page ? ' · p. ' + n.page : '') + ' · ' + esc(timeAgo(n.created)) + '</div></span>' + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div>' : '') + '</section>';
  h += '<details class="card flat"><summary><b>Edit book</b></summary><div class="bookform">'
    + '<label class="sr" for="bket">Title</label><input id="bket" class="input" data-bfield="title" value="' + esc(b.title) + '">'
    + '<div class="btnrow"><label class="sr" for="bkea">Author</label><input id="bkea" class="input" data-bfield="author" value="' + esc(b.author || '') + '" placeholder="Author" style="flex:2">'
    + '<label class="sr" for="bkep">Pages</label><input id="bkep" class="input" inputmode="numeric" data-bfield="pages" value="' + esc(b.pages || '') + '" placeholder="Pages" style="flex:1"></div>'
    + '<div class="btnrow"><button class="btn ghost" data-act="delbook" data-id="' + id + '">Remove book</button></div></div></details>';
  return h;
};
VIEWS.book.after = function (id) {
  document.querySelectorAll('[data-bfield]').forEach(function (el) {
    el.addEventListener('change', function () {
      var k = el.dataset.bfield, v = el.value.trim(), f = {};
      if (k === 'pages') f.pages = Math.max(0, Math.round(+v || 0)) || null; else if (k === 'title') { if (!v) return; f.title = v.slice(0, 120); } else f[k] = v.slice(0, 80);
      Store.patch('books', id, f);
    });
  });
};
function bookLogged(r, b) {
  if (!r) return;
  toast(r.finished ? '🎉 Finished ' + esc(b.title) : r.read > 0 ? '+' + r.read + ' pages · p. ' + r.page : 'On p. ' + r.page);
}
ACTS.form_bookpage = function (d, f) {
  var v = $('#bkpg', f).value.trim(); if (!v) return;
  bookLogged(logPages(d.id, v), Store.get('books', d.id)); render(false, true);
};
ACTS.bookadd = function (d) { var b = Store.get('books', d.id); bookLogged(logPages(d.id, (b.page || 0) + (+d.n)), b); };
ACTS.bookreopen = function (d) { Store.patch('books', d.id, { finished: null }); };
ACTS.delbook = function (d) {
  var b = Store.get('books', d.id); Store.del('books', d.id); pop();
  toast('Book removed. Its quotes stay in Notes.', function () { Store.put('books', b); });
};
function saveBookNote(id, f, kind) {
  var n = addBookNote(id, kind, $('#bkn', f).value, $('#bknp', f).value); if (!n) { $('#bkn', f).focus(); return; }
  $('#bkn', f).value = ''; render(false, true); toast(kind === 'quote' ? 'Quote saved · it\'s in Notes too' : 'Thought saved · it\'s in Notes too');
}
ACTS.form_booknote = function (d, f) { saveBookNote(d.id, f, 'quote'); };
ACTS.booknotethought = function (d, el) { saveBookNote(d.id, el.closest('form'), 'thought'); };

/* ── Claude companion ─────────────────────────────────────────────── */
var bookAnswer = null;
function bookPrompt(b, kind, q) {
  var where = 'The reader is on page ' + (b.page || 0) + (b.pages ? ' of ' + b.pages : '') + ' of "' + b.title + '"' + (b.author ? ' by ' + b.author : '') + '.';
  var rules = ' You are a reading companion. Only use what comes up to about page ' + (b.page || 0) + '. No spoilers past page ' + (b.page || 0) + '. If you don\'t know this book well enough to be accurate, say so plainly instead of guessing.';
  var ask = kind === 'recap' ? 'Give a short recap of what the book has covered so far, in plain language, under 180 words.'
    : kind === 'questions' ? 'Give 5 discussion questions about the part read so far, the kind that make you think about your own life.'
    : kind === 'apply' ? 'In under 160 words, say how the ideas so far might apply to this reader. Their life areas: ' + areasSorted().map(function (a) { return a.name; }).join(', ') + '. Their goals: ' + goalsLive().map(function (g) { return g.n; }).join(', ') + '.'
    : 'Answer this question about the book so far, in under 160 words: ' + q;
  return where + rules + '\n' + ask + '\nReply with JSON only: {"text": string, "known": boolean}';
}
var BOOK_AI_TITLES = { recap: 'Recap so far', questions: 'Discussion questions', apply: 'How it applies to you', ask: 'Your question' };
function bookAsk(id, kind, q) {
  var b = Store.get('books', id); if (!b) return;
  bookAnswer = { id: id, kind: kind, q: q || '', text: null };
  openSheet('<div class="shead"><h2>' + esc(BOOK_AI_TITLES[kind]) + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div><p class="note">Claude is thinking it over…</p>');
  aiJson(bookPrompt(b, kind, q), { modelTier: 'default' }).then(function (r) {
    var text = r && typeof r.text === 'string' ? r.text.trim() : '';
    if (!text) throw { code: 'empty' };
    bookAnswer.text = text; bookAnswerPaint();
  }).catch(function (e) {
    if ($('#sheetbg').hidden) return;
    $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div><div class="shead"><h2>' + esc(BOOK_AI_TITLES[kind]) + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div><p class="note">' + esc(aiError(e)) + '</p>';
  });
}
function bookAnswerPaint() {
  var a = bookAnswer; if (!a || $('#sheetbg').hidden) return;
  $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div><div class="shead"><h2>' + esc(BOOK_AI_TITLES[a.kind]) + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + (a.q ? '<p class="note small">“' + esc(a.q) + '”</p>' : '')
    + '<div class="aitext">' + a.text.split(/\n+/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>'
    + '<div class="btnrow"><button class="btn soft" data-act="booksaveai">Save as note</button><button class="btn ghost" data-act="close">Done</button></div>';
}
ACTS.bookai = function (d) { bookAsk(d.id, d.k); };
ACTS.form_bookask = function (d, f) { var q = $('#bkq', f).value.trim(); if (!q) return; $('#bkq', f).value = ''; bookAsk(d.id, 'ask', q); };
ACTS.booksaveai = function () {
  var a = bookAnswer, b = a && Store.get('books', a.id); if (!b || !a.text) return;
  Store.put('notes', { title: 'Claude on ' + b.title + ' · ' + BOOK_AI_TITLES[a.kind], body: (a.q ? 'Q: ' + a.q + '\n\n' : '') + a.text, kind: 'thought', book: b.id, page: b.page || null, area: null }, true);
  closeSheet(); toast('Saved with the book and in Notes');
};

/* ── smart capture helpers ───────────────────────────────────────── */
/* "read 20 pages of Atomic Habits" → {pages:20, book}; "on page 140 of Dune" → {page:140, book} */
function parseReading(text) {
  var m = /^(?:i\s+)?(?:just\s+)?read\s+(\d{1,4})\s+pages?(?:\s+(?:of|in)\s+(.+?))?\.?$/i.exec(text.trim());
  var p = /^(?:i'?m\s+)?(?:on|at|up to)\s+(?:page|p\.?)\s*(\d{1,4})\s+(?:of|in)\s+(.+?)\.?$/i.exec(text.trim());
  if (!m && !p) return null;
  var b = bookFind((m ? m[2] : p[2]) || ''); if (!b) return null;
  return m ? { pages: +m[1], book: b } : { page: +p[1], book: b };
}
/* "“Quote text” — Atomic Habits p. 27" → {text, book, page} */
function parseQuote(text) {
  var m = /^["“”']\s*([\s\S]+?)\s*["“”']\s*(?:[-–—,:]|from|in)?\s*(.+?)(?:,?\s*(?:p\.?|page)\s*(\d{1,4}))?\.?$/i.exec(text.trim());
  if (!m) return null;
  var b = bookFind(m[2]); if (!b) return null;
  return { text: m[1], book: b, page: m[3] ? +m[3] : b.page || null };
}
