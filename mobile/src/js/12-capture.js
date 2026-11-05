/* ═══ SMART CAPTURE ═════════════════════════════════════════════════
   Put anything in. Each line is sorted into what it actually is: a new
   task, a task you just did, a habit you just did, a new habit, a
   note, an idea, a journal line, or a movie you watched (which then gets
   ranked). Claude does the sorting when it's available; a rule-based
   sorter does it otherwise. Nothing is filed until you confirm. */
var ASSETS = null;
function assetsInit() {
  if (!window.claude || !window.claude.use) return;
  window.claude.use('assets').then(function (a) { ASSETS = a; });
}
var capState = { kind: 'smart', area: null, photo: null };
var CAP_KINDS = [['smart', 'Smart sort'], ['inbox', 'Inbox'], ['task', 'Task'], ['note', 'Note']];
var STYPES = {
  task: ['Task', '✅'], done: ['Done ✓', '☑️'], habit_done: ['Habit ✓', '🔁'], habit_new: ['New habit', '🔁'],
  note: ['Note', '📝'], idea: ['Idea', '💡'], journal: ['Journal', '📔'],
  movie: ['Movie watched', '🎬'], rank: ['Rank list', '🏆'], spent: ['Spent', '💵'], grocery: ['Grocery list', '🛒'], reading: ['Reading', '📖'], quote: ['Quote', '❝'], drop: ['Delete', '🗑']
};

ACTS.capture = function () {
  capState = { kind: 'smart', area: null, photo: null, sugg: null };
  openSheet(capHtml(), capWire);
};
/* Quick capture: what opens when MossOS is opened. Straight to the inbox,
   Enter saves, Claude sorts later. */
function quickCapture() {
  capState = { kind: 'inbox', area: null, photo: null, sugg: null, quick: true };
  openSheet(capHtml(), capWire);
}
ACTS.capsortnow = function () { capState.quick = false; capState.kind = 'smart'; capRedraw(); };
function capWire(s) {
  var ta = $('#captext', s); if (!ta) return;
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (capState.quick && !e.shiftKey))) { e.preventDefault(); ACTS.capsave(); }
  });
  var f = $('#capfile', s); if (f) f.addEventListener('change', capPhoto);
}
function capHtml(text) {
  var k = capState.kind;
  if (capState.quick) return '<div class="shead"><h2>Quick capture</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<label class="sr" for="captext">What\'s on your mind</label>'
    + '<textarea id="captext" class="capbox quick" placeholder="Dump it here. Enter saves to your inbox.">' + esc(text || '') + '</textarea>'
    + '<div class="btnrow"><button class="btn accent" data-act="capsave">Save to inbox</button><button class="btn ghost" data-act="capsortnow">' + icon('sparkle', 'sm') + 'Sort now</button></div>'
    + '<p class="note small">Claude sorts it later from the inbox. Shift+Enter for a new line.</p>';
  return '<div class="shead"><h2>Capture</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<label class="sr" for="captext">What\'s on your mind</label>'
    + '<textarea id="captext" class="capbox" placeholder="Anything. &quot;Call the recruiter Friday&quot;, &quot;took meds&quot;, &quot;watched Heat 9/10&quot;… Tap the mic on your keyboard to talk.">' + esc(text || '') + '</textarea>'
    + '<div id="capphoto">' + capPhotoHtml() + '</div>'
    + '<div class="chips" role="group" aria-label="Save as">' + CAP_KINDS.map(function (x) {
      return '<button class="chip' + (k === x[0] ? ' on' : '') + '" data-act="capkind" data-k="' + x[0] + '" aria-pressed="' + (k === x[0]) + '">' + (x[0] === 'smart' ? icon('sparkle', 'sm') : '') + x[1] + '</button>';
    }).join('') + '</div>'
    + (k === 'task' || k === 'note' ? '<div class="scrollx" role="group" aria-label="Area">' + areasSorted().map(function (a) {
      return '<button class="chip' + (capState.area === a.id ? ' on' : '') + '" data-act="caparea" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</div>'
      : '<p class="note small">' + (k === 'smart' ? 'Each line is sorted into a task, a habit, a note, a movie and so on' + (AI.ready ? ' by Claude' : '') + '. You check it before anything is filed.' : 'Each line waits in your inbox until you sort it.') + '</p>')
    + '<div class="btnrow">'
    + (ASSETS ? '<label class="btn soft" style="flex:0 0 auto" aria-label="Add a photo">' + icon('camera', 'sm') + '<input id="capfile" type="file" accept="image/*" class="sr"></label>' : '')
    + '<button class="btn accent" data-act="capsave">' + (k === 'smart' ? 'Sort it' : 'Save') + '</button></div>';
}
function capPhotoHtml() {
  if (!capState.photo) return '';
  if (capState.photo === 'uploading') return '<div class="photo" aria-label="Uploading photo"></div>';
  return '<div class="photo"><img src="' + esc(capState.photo.url) + '" alt="Attached photo"><button data-act="capunphoto" aria-label="Remove photo">' + icon('x', 'sm') + '</button></div>';
}
function capPhoto(e) {
  var file = e.target.files && e.target.files[0]; if (!file || !ASSETS) return;
  capState.photo = 'uploading'; $('#capphoto').innerHTML = capPhotoHtml();
  ASSETS.upload(file).then(function (r) { capState.photo = { id: r.id, url: r.url }; $('#capphoto').innerHTML = capPhotoHtml(); })
    .catch(function () { capState.photo = null; $('#capphoto').innerHTML = ''; toast('The photo didn\'t upload. Try a smaller one.'); });
}
ACTS.capunphoto = function () { capState.photo = null; $('#capphoto').innerHTML = ''; };
function capRedraw() {
  var ta = $('#captext'), text = ta ? ta.value : '';
  $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div>' + capHtml(text); capWire($('#sheet'));
}
ACTS.capkind = function (d) { capState.kind = d.k; capRedraw(); };
ACTS.caparea = function (d) { capState.area = capState.area === d.a ? null : d.a; capRedraw(); };
ACTS.capsave = function () {
  var text = $('#captext').value.trim(), photo = capState.photo && capState.photo.id ? capState.photo : null;
  if (!text && !photo) { $('#captext').focus(); return; }
  if (capState.photo === 'uploading') { toast('Wait for the photo to finish uploading'); return; }
  var k = capState.kind;
  if (k === 'inbox' || k === 'smart') {
    var lines = text ? text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean) : [''];
    var items = lines.map(function (line, i) { return Store.put('inbox', { text: line, photo: i === 0 && photo ? photo.id : null }, true); });
    logEvent('Captured ' + (items.length === 1 ? 'a thought' : items.length + ' thoughts'));
    if (k === 'inbox') { closeSheet(); toast(items.length === 1 ? 'In your inbox' : items.length + ' items in your inbox'); return; }
    // Smart: sort now, inside the sheet.
    capState.ids = items.map(function (i) { return i.id; });
    $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div><div class="shead"><h2>Sorting…</h2></div><p class="note">' + (AI.ready ? 'Claude is reading ' : 'Reading ') + (items.length === 1 ? 'it' : 'all ' + items.length) + '.</p>';
    smartSort(items).then(function (sugg) { capState.sugg = sugg; capReview(); });
    return;
  }
  if (k === 'task') {
    var first = text.split('\n')[0], rest = text.split('\n').slice(1).join('\n').trim();
    Store.put('tasks', { t: first || 'Photo', note: rest, area: capState.area, due: today(), done: false, steps: [], photo: photo ? photo.id : null }, true);
    logEvent('Captured a task: ' + first, capState.area);
  } else {
    Store.put('notes', { title: text.split('\n')[0].slice(0, 80) || 'Photo', body: text, area: capState.area, photo: photo ? photo.id : null }, true);
    logEvent('Captured a note', capState.area);
  }
  closeSheet(); toast(k === 'task' ? 'Task added for today' : 'Note saved');
};
function capReview() {
  var live = (capState.sugg || []).filter(function (s) { return Store.get('inbox', s.id); });
  if (!live.length) { closeSheet(); return; }
  $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div><div class="shead"><h2>Here\'s what I got</h2><button class="iconbtn" data-act="close" aria-label="Close and keep in inbox">' + icon('x') + '</button></div>'
    + (capState.sortNote ? '<p class="note small">' + esc(capState.sortNote) + '</p>' : '')
    + (live.length > 2 ? '<button class="btn accent block" data-act="suggall" data-w="cap">File all ' + live.length + '</button>' : '')
    + suggCards(live, 'cap')
    + '<div class="btnrow"><button class="btn accent" data-act="suggall" data-w="cap">File ' + (live.length === 1 ? 'it' : 'all ' + live.length) + '</button><button class="btn ghost" data-act="close">Keep in inbox</button></div>';
}

/* ── the sorter ────────────────────────────────────────────────────── */
function sortContext() {
  return {
    areas: areasSorted().map(function (a) { return { id: a.id, name: a.name }; }),
    projects: projectsAll('active').map(function (p) { return { id: p.id, name: p.t }; }),
    tasks: Store.all('tasks').filter(function (t) { return !t.done; }).slice(0, 80).map(function (t) { return { id: t.id, t: t.t }; }),
    habits: habitsSorted().map(function (h) { return { id: h.id, name: h.n }; }),
    lists: Store.all('ranks').map(function (l) { return { id: l.id, name: l.name }; }),
    books: booksAll().map(function (b) { return { id: b.id, title: b.title, page: b.page || 0 }; })
  };
}
/* Resolves to suggestions; never rejects. */
function smartSort(items) {
  var ctx = sortContext();
  capState.sortNote = '';
  if (!AI.ready) { capState.sortNote = 'Sorted on this device. Open MossOS in the Claude app for smarter sorting.'; return Promise.resolve(items.map(function (i) { return guessSort(i, ctx); })); }
  var d = new Date();
  return aiJson('You sort quick captures for a personal organizer. Today is ' + DOWL[d.getDay()] + ' ' + today() + '.\n'
    + 'Context (JSON): ' + JSON.stringify(ctx) + '\n'
    + 'For each item choose one type:\n'
    + '- "task": something to do. Give title (without the day/time/repeat words), area, project, due, firstStep, time ("HH:MM" 24h, only if a time is stated) and repeat (only if it recurs: {"every":"day"} | {"every":"weekday"} | {"every":"week","days":[Mon..Sun as 0/1]} | {"every":"month","dom":1-31}).\n'
    + '- "done": says a task in context.tasks was already done ("sent the invoice"). Give targetId.\n'
    + '- "habit_done": says a habit in context.habits was done today ("took meds", "walked"). Give targetId.\n'
    + '- "habit_new": wants to start doing something regularly ("start stretching every morning"). Give title (short, like "Stretch").\n'
    + '- "note": information to keep (a fact, a number, a reference). "idea": a thought to develop later.\n'
    + '- "journal": about how the day or the person is going ("rough shift, tired").\n'
    + '- "movie": a film or show. Give title (clean, no score), status ("watched", "watching", or "want" for something they want to see / add to their watchlist), year if stated, score (0-10) if stated, note (any opinion).\n'
    + '- "rank": something to add to one of context.lists. Give targetId and title.\n'
    + '- "reading": reading progress on a book in context.books ("read 20 pages of Atomic Habits", "on page 140 of Dune"). Give targetId, and pagesRead (pages just read) or page (the page they are on now).\n'
    + '- "quote": a line from a book in context.books, usually in quotation marks. Give targetId, title (the quote itself, without the book name) and page if stated.\n'
    + '- "grocery": things to add to the grocery list ("add eggs and milk to the grocery list", "groceries: bread, rice"). Give items: an array of short item names.\n'
    + '- "spent": money already spent ("spent $12 at Wawa", "$8 chipotle"). Give amount (number), title (the store or what it was) and bucket: "rest" (restaurant meals: sit-down, takeout, delivery, fast-food meals), "allow" (snacks, drinks, gas-station runs), "gas" (fuel), "groc" (grocery shopping), "fun", "cloth" (clothes), "misc" (toiletries, small needs) or "need" (bills, health, other).\n'
    + '- "drop": empty or meaningless.\n'
    + 'Use only ids that appear in the context. area, project, due (YYYY-MM-DD, only if a day is named or clearly implied) may be null. icon: one emoji.\n'
    + 'Items: ' + JSON.stringify(items.map(function (i) { return { id: i.id, text: i.text || '(photo with no text)' }; })) + '\n'
    + 'Reply with JSON only: {"items":[{"id":"…","type":"task","title":"…","area":null,"project":null,"due":null,"firstStep":null,"targetId":null,"time":null,"repeat":null,"year":null,"status":null,"score":null,"note":null,"amount":null,"bucket":null,"items":null,"pagesRead":null,"page":null,"icon":"📝"}]}')
    .then(function (r) {
      var byId = {}; (r && r.items || []).forEach(function (s) { if (s && s.id) byId[s.id] = s; });
      return items.map(function (i) { return byId[i.id] ? cleanSugg(byId[i.id], i, ctx) : guessSort(i, ctx); });
    }).catch(function (e) {
      capState.sortNote = aiError(e) + ' Sorted on this device instead.';
      return items.map(function (i) { return guessSort(i, ctx); });
    });
}
function idIn(list, id) { return list.some(function (x) { return x.id === id; }) ? id : null; }
function cleanSugg(s, item, ctx) {
  var type = STYPES[s.type] ? s.type : 'task';
  var o = { id: item.id, raw: item.text, type: type, title: String(s.title || item.text || '').slice(0, 140),
    area: idIn(ctx.areas, s.area), project: idIn(ctx.projects, s.project),
    due: /^\d{4}-\d\d-\d\d$/.test(s.due || '') ? s.due : null, firstStep: s.firstStep ? String(s.firstStep).slice(0, 120) : null,
    year: s.year ? String(s.year).slice(0, 4) : '', score: s.score != null && !isNaN(+s.score) ? Math.max(0, Math.min(10, +s.score)) : null,
    status: ['want', 'watching', 'watched'].indexOf(s.status) > -1 ? s.status : 'watched',
    note: s.note ? String(s.note).slice(0, 200) : '', icon: typeof s.icon === 'string' ? s.icon.slice(0, 4) : '', targetId: null };
  if (type === 'reading' || type === 'quote') {
    o.targetId = idIn(ctx.books || [], s.targetId);
    var pr = type === 'reading' ? parseReading(item.text || '') : parseQuote(item.text || '');
    if (!o.targetId && pr) o.targetId = pr.book.id;
    o.pagesRead = +s.pagesRead > 0 ? Math.round(+s.pagesRead) : pr && pr.pages || null;
    o.page = +s.page > 0 ? Math.round(+s.page) : pr && pr.page || null;
    if (type === 'quote' && pr && (!s.title || s.title === item.text)) o.title = pr.text;
    if (!o.targetId || (type === 'reading' && !o.pagesRead && !o.page)) o.type = type === 'quote' ? 'note' : 'task';
  }
  if (type === 'grocery') {
    o.items = Array.isArray(s.items) ? s.items.map(function (x) { return String(x).trim().slice(0, 60).replace(/^\w/, function (c) { return c.toUpperCase(); }); }).filter(Boolean).slice(0, 20) : parseGrocery(item.text || '');
    if (!o.items || !o.items.length) o.type = 'task';
  }
  if (type === 'spent') {
    var ps = parseSpent(item.text || '');
    o.amount = +s.amount > 0 ? Math.round(+s.amount * 100) / 100 : ps ? ps.amount : null;
    o.bucket = FIN_BUCKETS[s.bucket] ? s.bucket : ps ? ps.bucket : 'allow';
    if (!o.amount) o.type = 'task';
  }
  if (type === 'done') o.targetId = idIn(ctx.tasks, s.targetId);
  if (type === 'habit_done') o.targetId = idIn(ctx.habits, s.targetId);
  if (type === 'rank') o.targetId = idIn(ctx.lists, s.targetId);
  if ((type === 'done' || type === 'habit_done' || type === 'rank') && !o.targetId) o.type = type === 'habit_done' ? 'habit_new' : 'task';
  o.time = /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time || '') ? s.time : null;
  var r = s.repeat;
  if (r && typeof r === 'object' && ['day', 'weekday', 'week', 'month'].indexOf(r.every) > -1) {
    o.repeat = { every: r.every };
    if (r.every === 'week') { o.repeat.days = (Array.isArray(r.days) && r.days.length === 7 ? r.days : [0, 0, 0, 0, 0, 0, 0]).map(function (x) { return x ? 1 : 0; }); if (!o.repeat.days.some(Boolean)) o.repeat = null; }
    if (o.repeat && r.every === 'month') o.repeat.dom = Math.max(1, Math.min(31, +r.dom || 1));
  } else o.repeat = null;
  // Fill in what Claude left out from the words themselves.
  if (o.type === 'task') {
    var pt = parseTaskText(item.text || '');
    if (!o.due) o.due = pt.due || null;
    if (!o.time) o.time = pt.time || null;
    if (!o.repeat) o.repeat = pt.repeat || null;
    if (o.repeat && !o.due) o.due = nextOccurrence(o.repeat, addDays(today(), -1));
  }
  return o;
}
/* Rule-based sorter: used without Claude, or when Claude fails. */
function guessSort(item, ctx) {
  var text = item.text || '', low = text.toLowerCase().trim();
  var o = { id: item.id, raw: text, type: 'task', title: text, area: null, project: null, due: null, time: null, repeat: null, firstStep: null, year: '', score: null, note: '', icon: '', targetId: null, status: 'watched' };
  var wm = /^(?:i\s+)?(?:want to (?:watch|see)|add\s+(.+?)\s+to\s+(?:my\s+)?watch\s?list$|to watch[:\s]+|watchlist[:\s]+)/i.exec(text) || /^(?:i'?m\s+|currently\s+|started\s+)?watching\s+/i.exec(text);
  if (wm) {
    var want = !/watching/i.test(wm[0]);
    o.type = 'movie'; o.status = want ? 'want' : 'watching';
    o.title = (wm[1] || text.slice(wm[0].length)).replace(/\s+to\s+(my\s+)?watch\s?list$/i, '').trim().replace(/^\w/, function (c) { return c.toUpperCase(); });
    return o;
  }
  var rp = parseReading(text);
  if (rp) { o.type = 'reading'; o.targetId = rp.book.id; o.pagesRead = rp.pages || null; o.page = rp.page || null; o.title = rp.book.title; return o; }
  var qp = parseQuote(text);
  if (qp) { o.type = 'quote'; o.targetId = qp.book.id; o.title = qp.text; o.page = qp.page; return o; }
  var gr = parseGrocery(text);
  if (gr) { o.type = 'grocery'; o.items = gr; o.title = gr.join(', '); return o; }
  var sp = parseSpent(text);
  if (sp) { o.type = 'spent'; o.title = sp.merchant; o.amount = sp.amount; o.bucket = sp.bucket; return o; }
  var sc = low.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:\/\s*10|out of 10)\b/);
  if (/^(i\s+)?(just\s+)?(watched|saw|rewatched|finished watching)\s+/.test(low) || /\b(movie|film)\b/.test(low) && sc) {
    var title = text.replace(/^(i\s+)?(just\s+)?(watched|saw|rewatched|finished watching)\s+/i, '').replace(/\b\d{1,2}(\.\d)?\s*(\/\s*10|out of 10)\b/i, '').replace(/\b(movie|film)\b/i, '').trim();
    var parts = title.split(/\s+[-–—]\s+|,\s+|\.\s+/), ym = /\((\d{4})\)/.exec(parts[0]);
    o.type = 'movie'; o.title = parts[0].replace(/\(\d{4}\)/, '').trim(); o.year = ym ? ym[1] : ''; o.score = sc ? +sc[1] : null; o.note = parts.slice(1).join(', ');
    return o;
  }
  var hab = ctx.habits.filter(function (h) { return overlap(h.name, text) >= 0.5 || low.indexOf(h.name.toLowerCase()) > -1; })[0];
  if (hab && /^(took|did|done|went|walked|read|drank|finished|✓|x\b)|\b(done|today)\b/.test(low) || hab && words(text).length <= 3) { o.type = 'habit_done'; o.targetId = hab.id; o.title = hab.name; return o; }
  if (/^(done|did|finished|sent|called|booked|paid|emailed|submitted|bought|fixed|cleaned)\b/.test(low)) {
    var best = null, bs = 0; ctx.tasks.forEach(function (t) { var v = overlap(t.t, text); if (v > bs) { bs = v; best = t; } });
    if (best && bs >= 0.5) { o.type = 'done'; o.targetId = best.id; o.title = best.t; return o; }
  }
  if (/\b(every (day|morning|night|evening)|each (day|morning|night)|daily|habit)\b/.test(low) && !/\b(\d{1,2}(:\d\d)?\s*(am|pm)|at \d)/.test(low)) {
    o.type = 'habit_new'; o.title = text.replace(/\b(start(ing)?|begin|i want to|i should)\b/ig, '').replace(/\b(every (day|morning|night|evening|week)|each (day|morning|night)|daily|habit)\b/ig, '').trim().replace(/^\w/, function (c) { return c.toUpperCase(); }) || text; return o;
  }
  if (/^idea\b[:\s-]*/i.test(text)) { o.type = 'idea'; o.title = text.replace(/^idea\b[:\s-]*/i, ''); return o; }
  if (/^(feeling|felt|i feel|today was|rough|good day|bad day|tired|grateful|journal)\b/.test(low)) { o.type = 'journal'; return o; }
  if (/^(note|remember that|fyi)\b[:\s-]*/i.test(text) || /https?:\/\//.test(low) || /\b(password|code|address|phone|number|ref)\b.*[:#]/.test(low)) { o.type = 'note'; o.title = text.replace(/^(note|remember that|fyi)\b[:\s-]*/i, '').slice(0, 80); return o; }
  // A task: read its day, time, repeat, area and project from the words.
  var pt = parseTaskText(text);
  o.title = pt.title; o.due = pt.due; o.time = pt.time; o.repeat = pt.repeat; o.area = pt.area; o.project = pt.project;
  return o;
}

/* ── showing and filing suggestions ────────────────────────────────── */
function suggCards(list, where) {
  return list.map(function (s) {
    var it = Store.get('inbox', s.id) || { text: s.raw };
    var target = s.type === 'done' ? Store.get('tasks', s.targetId) : s.type === 'habit_done' ? Store.get('habits', s.targetId) : s.type === 'rank' ? Store.get('ranks', s.targetId) : null;
    var line = s.type === 'done' ? 'Tick off: ' + (target ? target.t : '')
      : s.type === 'habit_done' ? 'Mark done today: ' + (target ? target.ic + ' ' + target.n : '')
      : s.type === 'rank' ? 'Add to ' + (target ? target.name : '') + ': ' + s.title
      : s.type === 'movie' ? s.title + (s.year ? ' (' + s.year + ')' : '') + (s.status === 'want' ? ' · want to watch' : s.status === 'watching' ? ' · watching' : '')
      : s.type === 'spent' ? fmtMoney(s.amount || 0) + ' · ' + s.title
      : s.type === 'reading' ? (s.pagesRead ? 'Log ' + s.pagesRead + ' pages of ' : 'On page ' + s.page + ' of ') + (Store.get('books', s.targetId) || {}).title
      : s.type === 'quote' ? '“' + s.title + '” · ' + (Store.get('books', s.targetId) || {}).title + (s.page ? ' p. ' + s.page : '')
      : s.type === 'grocery' ? 'Add to groceries: ' + (s.items || parseGrocery(it.text || '') || [s.title]).join(', ')
      : s.title;
    var meta = '<span class="pill">' + STYPES[s.type][1] + ' ' + STYPES[s.type][0] + '</span>'
      + (s.area ? '<span class="pill">' + areaDot(s.area) + '&nbsp;' + esc(areaName(s.area)) + '</span>' : '')
      + (s.project && Store.get('projects', s.project) ? '<span class="pill">' + esc(Store.get('projects', s.project).t) + '</span>' : '')
      + (s.due ? '<span class="pill">' + esc(shortDate(s.due)) + '</span>' : '')
      + (s.type === 'task' && s.time ? '<span class="pill">' + esc(fmtTime(s.time)) + '</span>' : '')
      + (s.type === 'task' && s.repeat ? '<span class="pill">↻ ' + esc(repeatLabel(s.repeat)) + '</span>' : '')
      + (s.type === 'movie' && s.score != null ? '<span class="pill">said ' + esc(s.score) + '/10</span>' : '')
      + (s.type === 'spent' ? '<span class="pill">' + esc(FIN_BUCKETS[s.bucket] || 'Allowance') + '</span>' : '');
    var opts = Object.keys(STYPES).filter(function (k) { return (k !== 'done' || s.type === 'done') && (k !== 'habit_done' || s.type === 'habit_done') && (k !== 'rank' || s.type === 'rank') && (k !== 'reading' || s.type === 'reading') && (k !== 'quote' || s.type === 'quote'); });
    return '<div class="sugg"><div class="orig">“' + esc(it.text || '') + '”</div>'
      + '<div class="t">' + esc(s.icon ? s.icon + ' ' : '') + esc(line) + '</div>'
      + '<div class="meta">' + meta + '</div>'
      + (s.firstStep ? '<div class="first">' + 'First step: ' + esc(s.firstStep) + '</div>' : '')
      + (s.type === 'movie' ? '<div class="first">' + (s.status === 'watched' ? 'Goes into Movies, then a few "which was better?" taps rank it.' : 'Goes on your watchlist in Movies.') + (s.note ? ' Note: ' + esc(s.note) : '') + '</div>' : '')
      + (s.type === 'grocery' ? '<div class="first">Goes on this week\'s list in Money → Groceries.</div>' : '')
      + (s.type === 'spent' ? '<div class="first">Goes into Money and counts toward this week straight away.</div>' : '')
      + '<div class="btnrow"><button class="btn sm accent" data-act="suggone" data-w="' + where + '" data-id="' + s.id + '">File it</button>'
      + '<label class="sr" for="st' + s.id + '">Change type</label><select id="st' + s.id + '" class="input sel" data-act-change="suggtype" data-w="' + where + '" data-id="' + s.id + '">'
      + opts.map(function (k) { return '<option value="' + k + '"' + (k === s.type ? ' selected' : '') + '>' + STYPES[k][0] + '</option>'; }).join('') + '</select></div></div>';
  }).join('');
}
function suggList(where) { return where === 'cap' ? capState.sugg || [] : sortRun && sortRun.items || []; }
function suggFind(where, id) { return suggList(where).filter(function (s) { return s.id === id; })[0]; }
function suggRefresh(where) { if (where === 'cap') capReview(); else render(); }
ACTS.suggtype = function (d, el) {
  var s = suggFind(d.w, d.id); if (!s) return; s.type = el.value;
  if (s.type === 'task' && s.title === s.raw) s.title = s.raw;
  suggRefresh(d.w);
};
ACTS.suggone = function (d) {
  var s = suggFind(d.w, d.id), it = Store.get('inbox', d.id); if (s && it) toast(applySuggestion(it, s)); suggRefresh(d.w);
};
ACTS.suggall = function (d) {
  var out = [];
  suggList(d.w).slice().forEach(function (s) { var it = Store.get('inbox', s.id); if (it) out.push(applySuggestion(it, s)); });
  if (d.w === 'cap') closeSheet(); else { sortRun = null; render(); }
  toast(out.length === 1 ? out[0] : out.length + ' filed');
  var m = moviesList(); if (out.some(function (x) { return /Movies/.test(x); }) && rankPending(m).length) setTimeout(function () { startRanking(m.id, rankPending(m)[0].id); }, 300);
};
/* Files one suggestion and returns a short line saying what happened. */
function applySuggestion(it, s) {
  var title = (s.title || it.text || 'Untitled').slice(0, 140), msg = 'Filed';
  if (s.type === 'task') {
    var t = Store.put('tasks', { t: title, ic: s.icon || '', area: s.area || null, project: s.project || null, due: s.due || null, time: s.time || null, repeat: s.repeat || null, done: false,
      note: s.title && s.title !== it.text ? it.text : '', steps: s.firstStep ? [{ t: s.firstStep, done: false }] : [], photo: it.photo || null }, true);
    logEvent('New task: ' + t.t, t.area); msg = 'Task added' + (t.due ? ' for ' + shortDate(t.due).toLowerCase() : '');
  } else if (s.type === 'done') {
    var dt = Store.get('tasks', s.targetId);
    if (dt) { completeTask(dt.id, true); msg = 'Ticked off: ' + esc(dt.t); }
    else { Store.put('tasks', { t: title, done: true, doneAt: Date.now(), due: today(), steps: [] }, true); msg = 'Logged as done'; }
  } else if (s.type === 'habit_done') {
    var h = Store.get('habits', s.targetId);
    if (h) { setMark(h.id, today(), 1); msg = esc(h.n) + ' done today'; }
  } else if (s.type === 'habit_new') {
    var nh = Store.put('habits', { ic: s.icon || '✨', n: title.slice(0, 60), color: '#5FCF8E', cue: '', area: s.area || null, days: [1, 1, 1, 1, 1, 1, 1], marks: {}, since: today() }, true);
    logEvent('New habit: ' + nh.n); msg = 'New habit: ' + esc(nh.n);
  } else if (s.type === 'note' || s.type === 'idea') {
    Store.put('notes', { title: title.slice(0, 80), body: it.text, area: s.area || null, project: s.project || null, kind: s.type, photo: it.photo || null }, true);
    logEvent('Saved ' + (s.type === 'idea' ? 'an idea' : 'a note'), s.area); msg = s.type === 'idea' ? 'Idea saved' : 'Note saved';
  } else if (s.type === 'journal') {
    var e = entryFor(today());
    saveEntry(today(), { text: (e && e.text ? e.text + '\n' : '') + it.text }); msg = 'Added to today\'s journal';
  } else if (s.type === 'movie') {
    var m = moviesList();
    var mst = s.status || 'watched';
    addToRank(m.id, { t: title, year: s.year || '', status: mst, note: [s.score != null ? 'said ' + s.score + '/10' : '', s.note || ''].filter(Boolean).join(' · '), watched: mst === 'watched' ? today() : null });
    if (mst === 'watched') { logEvent('Watched ' + title); msg = esc(title) + ' added to Movies'; } else msg = esc(title) + (mst === 'want' ? ' added to your watchlist' : ' marked as watching');
  } else if (s.type === 'reading') {
    var bk = Store.get('books', s.targetId);
    if (!bk) return 'That book isn\'t in Books';
    var lr = logPages(bk.id, s.page || (bk.page || 0) + (s.pagesRead || 0));
    msg = lr && lr.finished ? '🎉 Finished ' + esc(bk.title) : esc(bk.title) + ' · p. ' + (lr ? lr.page : bk.page);
  } else if (s.type === 'quote') {
    var qb = Store.get('books', s.targetId);
    if (!qb) return 'That book isn\'t in Books';
    addBookNote(qb.id, 'quote', title, s.page); msg = 'Quote saved to ' + esc(qb.title);
  } else if (s.type === 'grocery') {
    var gi = s.items && s.items.length ? s.items : parseGrocery(it.text || '') || [title];
    var gn = finGrocAdd(gi);
    msg = gi.length === 1 ? esc(gi[0]) + ' added to groceries' : gi.length + ' items added to groceries';
    if (!gn) msg += ' · it reaches Money in a moment';
  } else if (s.type === 'spent') {
    var amt = s.amount || (parseSpent(it.text || '') || {}).amount;
    if (!(amt > 0)) return 'Add the amount, like "spent $12 at Wawa"';
    var fr = finLog(amt, title, s.bucket || 'allow', it.text || '');
    logEvent('Spent ' + fmtMoney(amt) + ' · ' + title, 'money');
    msg = 'Logged ' + esc(fmtMoney(amt)) + ' at ' + esc(title) + (fr ? ' · ' + esc(fmtMoney(fr.leftToday, true)) + ' left today' : ' · it reaches Money in a moment');
  } else if (s.type === 'rank') {
    var l = Store.get('ranks', s.targetId);
    if (l) { addToRank(l.id, { t: title }); msg = 'Added to ' + esc(l.name); }
  } else msg = 'Deleted';
  Store.del('inbox', it.id);
  return msg;
}

/* ═══ INBOX ═════════════════════════════════════════════════════════ */
var sortRun = null; // {busy} | {items:[suggestion]} | {err}
TITLES.inbox = 'Inbox';
VIEWS.inbox = function () {
  var items = Store.all('inbox').sort(function (a, b) { return a.created - b.created; });
  if (!items.length) { sortRun = null; return '<div class="empty">Inbox zero. Anything you capture to the inbox waits here until you sort it.</div>'
    + '<button class="btn accent" data-act="capture">' + icon('plus', 'sm') + 'Capture something</button>'; }
  if (sortRun && sortRun.items) {
    var live = sortRun.items.filter(function (s) { return Store.get('inbox', s.id); });
    if (live.length) return '<div class="btnrow"><button class="btn accent" data-act="suggall" data-w="inbox">File all ' + live.length + '</button><button class="btn ghost" data-act="sortcancel">Cancel</button></div>'
      + (sortRun.note ? '<p class="note small">' + esc(sortRun.note) + '</p>' : '') + suggCards(live, 'inbox');
    sortRun = null;
  }
  return '<div class="card"><p class="note">Sorting reads each item and works out what it is: a task, something you already did, a habit, a note, a movie you watched. You check each one before it\'s filed.</p>'
    + '<div class="btnrow" style="margin-top:12px"><button class="btn accent" data-act="sortai"' + (sortRun && sortRun.busy ? ' disabled' : '') + '>'
    + icon('sparkle', 'sm') + (sortRun && sortRun.busy ? 'Sorting ' + items.length + '…' : AI.ready ? 'Sort with Claude' : 'Sort') + '</button></div></div>'
    + '<div class="list">' + items.map(function (it) {
      return '<div class="row" style="align-items:flex-start"><span class="grow"><div class="t">' + esc(it.text || '(photo)') + '</div>'
        + (it.photo ? '<img src="/_blob/' + esc(it.photo) + '" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:10px;margin-top:8px">' : '')
        + '<div class="s">' + esc(timeAgo(it.created)) + ' ' + exPill(it) + '</div></span>'
        + '<button class="btn sm soft" data-act="sortone" data-id="' + it.id + '">sort ›</button>'
        + '<button class="iconbtn" data-act="inboxdel" data-id="' + it.id + '" aria-label="Delete">' + icon('x', 'sm') + '</button></div>';
    }).join('') + '</div>';
};
function timeAgo(ts) {
  var m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
  return shortDate(ymd(new Date(ts)));
}
ACTS.inboxdel = function (d) { var it = Store.get('inbox', d.id); Store.del('inbox', d.id); toast('Deleted', function () { Store.put('inbox', it); }); };
ACTS.sortai = function () {
  var items = Store.all('inbox').sort(function (a, b) { return a.created - b.created; }).slice(0, 25);
  sortRun = { busy: true }; render();
  smartSort(items).then(function (s) { sortRun = { items: s, note: capState.sortNote }; render(); });
};
ACTS.sortcancel = function () { sortRun = null; render(); };
