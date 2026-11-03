/* ═══ CAPTURE ═══════════════════════════════════════════════════════
   One tap, type or dictate, save. Sorting happens later, by hand or
   with Claude. Each line of a brain-dump becomes its own item. */
var ASSETS = null;
function assetsInit() {
  if (!window.claude || !window.claude.use) return;
  window.claude.use('assets').then(function (a) { ASSETS = a; });
}
var capState = { kind: 'inbox', area: null, photo: null };
var CAP_KINDS = [['inbox', 'Inbox', 'Sort later'], ['task', 'Task', 'Due today'], ['note', 'Note', 'Keep it']];

ACTS.capture = function () {
  capState = { kind: 'inbox', area: null, photo: null };
  openSheet(capHtml(), function (s) {
    var ta = $('#captext', s); ta.focus();
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ACTS.capsave(); });
    var f = $('#capfile', s); if (f) f.addEventListener('change', capPhoto);
  });
};
function capHtml(text) {
  return '<div class="shead"><h2>Capture</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<label class="sr" for="captext">What\'s on your mind</label>'
    + '<textarea id="captext" class="capbox" placeholder="What\'s on your mind? Tap the mic on your keyboard to talk.">' + esc(text || '') + '</textarea>'
    + '<div id="capphoto">' + capPhotoHtml() + '</div>'
    + '<div class="chips" role="group" aria-label="Save as">' + CAP_KINDS.map(function (k) {
      return '<button class="chip' + (capState.kind === k[0] ? ' on' : '') + '" data-act="capkind" data-k="' + k[0] + '">' + k[1] + '</button>';
    }).join('') + '</div>'
    + (capState.kind !== 'inbox' ? '<div class="scrollx" role="group" aria-label="Area">' + areasSorted().map(function (a) {
      return '<button class="chip' + (capState.area === a.id ? ' on' : '') + '" data-act="caparea" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>';
    }).join('') + '</div>' : '<p class="note small">Each line becomes its own item in your inbox.</p>')
    + '<div class="btnrow">'
    + (ASSETS ? '<label class="btn soft" style="flex:0 0 auto" aria-label="Add a photo">' + icon('camera', 'sm') + '<input id="capfile" type="file" accept="image/*" class="sr"></label>' : '')
    + '<button class="btn accent" data-act="capsave">Save</button></div>';
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
  var text = $('#captext').value;
  $('#sheet').innerHTML = '<div class="grab" aria-hidden="true"></div>' + capHtml(text);
  var f = $('#capfile'); if (f) f.addEventListener('change', capPhoto);
  var ta = $('#captext'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}
ACTS.capkind = function (d) { capState.kind = d.k; capRedraw(); };
ACTS.caparea = function (d) { capState.area = capState.area === d.a ? null : d.a; capRedraw(); };
ACTS.capsave = function () {
  var text = $('#captext').value.trim(), photo = capState.photo && capState.photo.id ? capState.photo : null;
  if (!text && !photo) { $('#captext').focus(); return; }
  if (capState.photo === 'uploading') { toast('Wait for the photo to finish uploading'); return; }
  var k = capState.kind, n = 0;
  if (k === 'inbox') {
    var lines = text ? text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean) : [''];
    lines.forEach(function (line, i) { Store.put('inbox', { text: line, photo: i === 0 && photo ? photo.id : null }, true); n++; });
    logEvent('Captured ' + (n === 1 ? 'a thought' : n + ' thoughts'));
  } else if (k === 'task') {
    var first = text.split('\n')[0], rest = text.split('\n').slice(1).join('\n').trim();
    Store.put('tasks', { t: first || 'Photo', note: rest, area: capState.area, due: today(), done: false, steps: [], photo: photo ? photo.id : null }, true);
    logEvent('Captured a task: ' + first, capState.area);
  } else {
    var title = text.split('\n')[0];
    Store.put('notes', { title: title.slice(0, 80) || 'Photo', body: text, area: capState.area, photo: photo ? photo.id : null }, true);
    logEvent('Captured a note', capState.area);
  }
  closeSheet();
  toast(k === 'inbox' ? (n === 1 ? 'In your inbox' : n + ' items in your inbox') : k === 'task' ? 'Task added for today' : 'Note saved');
};

/* ═══ INBOX + SORT ══════════════════════════════════════════════════ */
var sortRun = null; // {busy, items:[suggestion], err}
TITLES.inbox = 'Inbox';
VIEWS.inbox = function () {
  var items = Store.all('inbox').sort(function (a, b) { return a.created - b.created; });
  var h = '';
  if (!items.length) { sortRun = null; return '<div class="empty">Inbox zero. Everything you capture lands here until you sort it.</div>'
    + '<button class="btn accent" data-act="capture">' + icon('plus', 'sm') + 'Capture something</button>'; }
  if (sortRun && sortRun.items) return sortView(items);
  h += '<div class="card"><p class="note">Claude reads each item and suggests what it is, which area it belongs to, a day if you mentioned one, and a first step. You confirm each one.</p>'
    + '<div class="btnrow" style="margin-top:12px"><button class="btn accent" data-act="sortai"' + (AI.ready && !(sortRun && sortRun.busy) ? '' : ' disabled') + '>'
    + icon('sparkle', 'sm') + (sortRun && sortRun.busy ? 'Sorting ' + items.length + '…' : 'Sort with Claude') + '</button></div>'
    + (AI.ready ? '' : '<p class="note small" style="margin-top:8px">Claude sorting works when MossOS is open in the Claude app. You can sort by hand below.</p>')
    + (sortRun && sortRun.err ? '<p class="note small" style="margin-top:8px;color:var(--warn)">' + esc(sortRun.err) + '</p>' : '') + '</div>';
  h += '<div class="list">' + items.map(function (it) {
    return '<div class="row" style="align-items:flex-start"><span class="grow"><div class="t">' + esc(it.text || '(photo)') + '</div>'
      + (it.photo ? '<img src="/_blob/' + esc(it.photo) + '" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:10px;margin-top:8px">' : '')
      + '<div class="s">' + esc(timeAgo(it.created)) + ' ' + exPill(it) + '</div>'
      + '<div class="chips" style="margin-top:8px"><button class="chip" data-act="file" data-id="' + it.id + '" data-k="task">→ Task</button>'
      + '<button class="chip" data-act="file" data-id="' + it.id + '" data-k="note">→ Note</button>'
      + '<button class="chip" data-act="file" data-id="' + it.id + '" data-k="drop">Delete</button></div></span></div>';
  }).join('') + '</div>';
  return h;
};
function timeAgo(ts) {
  var m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
  return shortDate(ymd(new Date(ts)));
}
ACTS.file = function (d) {
  var it = Store.get('inbox', d.id); if (!it) return;
  applySuggestion(it, { type: d.k, title: it.text, area: null, due: d.k === 'task' ? today() : null });
};
function applySuggestion(it, s) {
  var title = (s.title || it.text || 'Untitled').slice(0, 140);
  if (s.type === 'task') {
    var t = Store.put('tasks', { t: title, ic: s.icon || '', area: s.area || null, due: s.due || null, done: false, note: s.title && s.title !== it.text ? it.text : '',
      steps: s.firstStep ? [{ t: s.firstStep, done: false }] : [], photo: it.photo || null }, true);
    logEvent('Sorted into a task: ' + t.t, t.area);
  } else if (s.type === 'note' || s.type === 'idea') {
    Store.put('notes', { title: title.slice(0, 80), body: it.text, area: s.area || null, kind: s.type, photo: it.photo || null }, true);
    logEvent('Sorted into ' + (s.type === 'idea' ? 'an idea' : 'a note'), s.area);
  }
  Store.del('inbox', it.id);
}
ACTS.sortai = function () {
  var items = Store.all('inbox').sort(function (a, b) { return a.created - b.created; }).slice(0, 25);
  sortRun = { busy: true }; render();
  var t = today(), d = new Date();
  aiJson('You sort quick captures for a personal organizer. Today is ' + DOWL[d.getDay()] + ' ' + t + '.\n'
    + 'Life areas (id: name): ' + areasSorted().map(function (a) { return a.id + ': ' + a.name; }).join('; ') + '.\n'
    + 'For each item decide:\n- type: "task" (something to do), "note" (information to keep), "idea" (a thought to develop later) or "drop" (empty or meaningless)\n'
    + '- title: a short, clear version in the person\'s own voice, under 70 characters\n- area: one area id from the list, or null\n'
    + '- due: YYYY-MM-DD only if the text names or clearly implies a day, else null\n- firstStep: for tasks, one concrete step under 5 minutes, else null\n- icon: one emoji\n'
    + 'Items: ' + JSON.stringify(items.map(function (i) { return { id: i.id, text: i.text || '(photo with no text)' }; })) + '\n'
    + 'Reply with JSON only: {"items":[{"id":"…","type":"task","title":"…","area":null,"due":null,"firstStep":null,"icon":"📝"}]}')
    .then(function (r) {
      var ids = {}; items.forEach(function (i) { ids[i.id] = 1; });
      var areaIds = {}; areasSorted().forEach(function (a) { areaIds[a.id] = 1; });
      var out = (r && r.items || []).filter(function (s) { return s && ids[s.id]; }).map(function (s) {
        return { id: s.id, type: ['task', 'note', 'idea', 'drop'].indexOf(s.type) > -1 ? s.type : 'task',
          title: String(s.title || '').slice(0, 140), area: areaIds[s.area] ? s.area : null,
          due: /^\d{4}-\d\d-\d\d$/.test(s.due || '') ? s.due : null, firstStep: s.firstStep ? String(s.firstStep).slice(0, 120) : null,
          icon: typeof s.icon === 'string' ? s.icon.slice(0, 4) : '' };
      });
      sortRun = out.length ? { items: out } : { err: 'Claude didn\'t return any suggestions. Try again, or sort by hand.' };
      render();
    }).catch(function (e) { sortRun = { err: aiError(e) }; render(); });
};
function sortView(items) {
  var byId = {}; items.forEach(function (i) { byId[i.id] = i; });
  var live = sortRun.items.filter(function (s) { return byId[s.id]; });
  if (!live.length) { sortRun = null; return VIEWS.inbox(); }
  return '<div class="btnrow"><button class="btn accent" data-act="sortacceptall">Accept all ' + live.length + '</button><button class="btn ghost" data-act="sortcancel">Cancel</button></div>'
    + live.map(function (s) {
      var it = byId[s.id];
      return '<div class="sugg"><div class="orig">“' + esc(it.text) + '”</div>'
        + '<div class="t">' + esc(s.icon ? s.icon + ' ' : '') + esc(s.title || it.text) + '</div>'
        + '<div class="meta"><span class="pill">' + { task: 'Task', note: 'Note', idea: 'Idea', drop: 'Delete' }[s.type] + '</span>'
        + (s.area ? '<span class="pill">' + areaDot(s.area) + '&nbsp;' + esc(areaName(s.area)) + '</span>' : '')
        + (s.due ? '<span class="pill">' + esc(shortDate(s.due)) + '</span>' : '') + '</div>'
        + (s.firstStep ? '<div class="first">First step: ' + esc(s.firstStep) + '</div>' : '')
        + '<div class="chips"><button class="chip on" data-act="sortaccept" data-id="' + s.id + '">Accept</button>'
        + ['task', 'note', 'idea', 'drop'].filter(function (k) { return k !== s.type; }).map(function (k) {
          return '<button class="chip" data-act="sorttype" data-id="' + s.id + '" data-k="' + k + '">' + { task: 'Task', note: 'Note', idea: 'Idea', drop: 'Delete' }[k] + ' instead</button>';
        }).join('') + '</div></div>';
    }).join('');
}
function sugg(id) { return sortRun && sortRun.items ? sortRun.items.filter(function (s) { return s.id === id; })[0] : null; }
ACTS.sortaccept = function (d) { var s = sugg(d.id), it = Store.get('inbox', d.id); if (s && it) applySuggestion(it, s); };
ACTS.sorttype = function (d) { var s = sugg(d.id); if (s) { s.type = d.k; render(); } };
ACTS.sortcancel = function () { sortRun = null; render(); };
ACTS.sortacceptall = function () {
  var n = 0;
  sortRun.items.slice().forEach(function (s) { var it = Store.get('inbox', s.id); if (it) { applySuggestion(it, s); n++; } });
  sortRun = null; toast(n + ' sorted'); render();
};
