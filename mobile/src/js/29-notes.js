/* ═══ NOTES (like Apple Notes, plus smart filing) ═══════════════════
   Folders → a date-grouped list → a rich editor (styles, bold, lists,
   checklists, photos). Notes keep `html` (cleaned on every save and
   render), `body` (plain text for search and links), `title` (the first
   line), `folder`, `tags`, `pinned`.
   Claude files each note: folder, tags, a title for long first lines, the
   life area, and any to-dos it mentions. Without Claude, #tags in the
   text and "todo" lines still work. */
var NOTE_ALLOWED = { H1: 1, H2: 1, H3: 1, P: 1, DIV: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1, UL: 1, OL: 1, LI: 1, IMG: 1, A: 1, SPAN: 1, PRE: 1 };
var NOTE_DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, SVG: 1, MATH: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1, TITLE: 1, AUDIO: 1, VIDEO: 1, SOURCE: 1, BASE: 1, FRAME: 1, FRAMESET: 1 };
/* Whitelist cleaner. Runs in a <template>, so nothing in the input loads or runs. */
function cleanHtml(html) {
  var tpl = document.createElement('template'); tpl.innerHTML = String(html || '');
  (function walk(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (c) {
      if (c.nodeType === 8) { node.removeChild(c); return; }
      if (c.nodeType !== 1) return;
      var tag = c.tagName.toUpperCase();
      if (NOTE_DROP[tag]) { node.removeChild(c); return; }
      walk(c);
      if (!NOTE_ALLOWED[tag]) { while (c.firstChild) node.insertBefore(c.firstChild, c); node.removeChild(c); return; }
      var keep = {};
      if (tag === 'IMG') { var src = c.getAttribute('src') || ''; if (!/^\/_blob\/[\w-]+$/.test(src)) { node.removeChild(c); return; } keep.src = src; keep.alt = 'Photo'; }
      if (tag === 'A') { var href = c.getAttribute('href') || ''; if (/^https?:\/\//i.test(href)) { keep.href = href; keep.target = '_blank'; keep.rel = 'noopener'; } }
      if (tag === 'UL') { var cl = c.getAttribute('class'); if (cl === 'nck' || cl === 'dash') keep['class'] = cl; }
      if (tag === 'LI' && c.hasAttribute('data-done')) keep['data-done'] = '1';
      Array.prototype.slice.call(c.attributes).forEach(function (a) { c.removeAttribute(a.name); });
      Object.keys(keep).forEach(function (k) { c.setAttribute(k, keep[k]); });
    });
  })(tpl.content);
  return tpl.innerHTML;
}
function htmlToText(html) {
  var d = document.createElement('template');
  d.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-3]|li|pre|ul|ol)>/gi, '\n');
  return (d.content.textContent || '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function noteHtml(n) {
  if (n.html) return cleanHtml(n.html);
  var body = String(n.body || ''), t = String(n.title || '').replace(/^❝ /, '');
  var showTitle = t && n.kind !== 'quote' && body.replace(/\s+/g, ' ').indexOf(t.replace(/\s+/g, ' ').slice(0, 30)) !== 0;
  return (showTitle ? '<h1>' + esc(t) + '</h1>' : '') + body.split(/\n/).map(function (l) { return '<div>' + (esc(l) || '<br>') + '</div>'; }).join('');
}
function noteTags(n) { return (n.tags || []).slice(); }
function textTags(text) { var out = [], re = /(^|\s)#([a-z][\w-]{1,24})/gi, m; while ((m = re.exec(text))) { var t = m[2].toLowerCase(); if (out.indexOf(t) < 0) out.push(t); } return out; }
function noteImgs(n) { var out = [], re = /src="\/_blob\/([\w-]+)"/g, m; while ((m = re.exec(n.html || ''))) out.push(m[1]); if (n.photo && out.indexOf(n.photo) < 0) out.push(n.photo); return out; }

/* ── folders ─────────────────────────────────────────────────────── */
function nf() { var m = Store.get('meta', 'notefolders'); return { folders: (m && m.folders || []).slice(), smart: (m && m.smart || []).slice() }; }
function nfSave(x) { Store.put('meta', { id: 'notefolders', folders: x.folders, smart: x.smart }); }
function folderName(id) { var f = nf().folders.filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; }
function folderByName(name, create, auto) {
  var x = nf(), key = String(name || '').trim().toLowerCase(); if (!key) return null;
  var f = x.folders.filter(function (y) { return y.name.toLowerCase() === key; })[0];
  if (f || !create) return f || null;
  f = { id: 'nf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: String(name).trim().slice(0, 24), auto: !!auto };
  x.folders.push(f); nfSave(x); return f;
}
function notesAll() { return Store.all('notes'); }
function noteMatch(n, key) {
  if (key === 'all') return true;
  if (key === 'pinned') return !!n.pinned;
  if (key === 'ideas') return n.kind === 'idea';
  if (key === 'books') return !!n.book;
  if (key === 'unfiled') return !n.folder && !n.book && n.kind !== 'idea';
  if (key.indexOf('f:') === 0) return n.folder === key.slice(2);
  if (key.indexOf('t:') === 0) return noteTags(n).indexOf(key.slice(2)) > -1;
  if (key.indexOf('a:') === 0) return noteAreas(n).indexOf(key.slice(2)) > -1;
  if (key.indexOf('s:') === 0) {
    var s = nf().smart.filter(function (x) { return x.id === key.slice(2); })[0]; if (!s) return false;
    if (s.tag && noteTags(n).indexOf(s.tag) < 0) return false;
    if (s.area && noteAreas(n).indexOf(s.area) < 0) return false;
    if (s.days && (Date.now() - (n.updated || 0)) > s.days * 864e5) return false;
    if (s.has === 'checklist' && !/class="nck"/.test(n.html || '')) return false;
    if (s.has === 'photos' && !noteImgs(n).length) return false;
    return true;
  }
  return false;
}
function noteKeyName(key) {
  if (key === 'all') return 'All Notes'; if (key === 'pinned') return 'Pinned'; if (key === 'ideas') return 'Ideas'; if (key === 'books') return 'Books'; if (key === 'unfiled') return 'Not filed';
  if (key.indexOf('f:') === 0) return folderName(key.slice(2)) || 'Folder';
  if (key.indexOf('t:') === 0) return '#' + key.slice(2);
  if (key.indexOf('a:') === 0) return areaName(key.slice(2)) || 'Area';
  if (key.indexOf('s:') === 0) { var s = nf().smart.filter(function (x) { return x.id === key.slice(2); })[0]; return s ? s.name : 'Smart folder'; }
  return 'Notes';
}
function allTags() { var m = {}; notesAll().forEach(function (n) { noteTags(n).forEach(function (t) { m[t] = (m[t] || 0) + 1; }); }); return Object.keys(m).sort().map(function (t) { return [t, m[t]]; }); }

var noteQ = '';
TITLES.notes = 'Notes';
function frow(key, ic, name, n, extra) {
  return '<div class="row frow"><button class="grow frowb" data-act="open" data-v="notelist" data-id="' + esc(key) + '"><span class="fic">' + ic + '</span><span class="grow t">' + esc(name) + '</span><span class="meta">' + n + '</span>' + icon('chev', 'sm chev') + '</button>' + (extra || '') + '</div>';
}
function notesSearchHtml(q) {
  var ns = notesAll().filter(function (n) { return ((n.title || '') + ' ' + (n.body || '') + ' #' + noteTags(n).join(' #')).toLowerCase().indexOf(q) > -1; })
    .sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
  return ns.length ? '<div class="list">' + ns.map(noteRow).join('') + '</div>' : '<div class="empty">No notes match "' + esc(q) + '".</div>';
}
function foldersHtml() {
  var all = notesAll(), x = nf(), cnt = function (k) { return all.filter(function (n) { return noteMatch(n, k); }).length; };
  var h = '<div class="list fl">' + frow('all', '🗂', 'All Notes', all.length) + (cnt('pinned') ? frow('pinned', '📌', 'Pinned', cnt('pinned')) : '')
    + x.folders.map(function (f) { return frow('f:' + f.id, '📁', f.name, cnt('f:' + f.id), '<button class="iconbtn" data-act="folderdel" data-id="' + f.id + '" aria-label="Delete folder ' + esc(f.name) + '">' + icon('x', 'sm') + '</button>'); }).join('')
    + (cnt('ideas') ? frow('ideas', '💡', 'Ideas', cnt('ideas')) : '') + (cnt('books') ? frow('books', '📖', 'Books', cnt('books')) : '')
    + (cnt('unfiled') && x.folders.length ? frow('unfiled', '📄', 'Not filed', cnt('unfiled')) : '') + '</div>';
  var tags = allTags();
  if (tags.length) h += '<section><div class="sechead"><h2>Tags</h2></div><div class="chips">' + tags.map(function (t) {
    return '<button class="chip" data-act="open" data-v="notelist" data-id="t:' + esc(t[0]) + '">#' + esc(t[0]) + ' <span class="faint">' + t[1] + '</span></button>'; }).join('') + '</div></section>';
  h += '<section><div class="sechead"><h2>Smart Folders</h2><button class="link" data-act="smartnew">New</button></div>'
    + (x.smart.length ? '<div class="list fl">' + x.smart.map(function (s) {
      return frow('s:' + s.id, '⚙️', s.name, cnt('s:' + s.id), '<button class="iconbtn" data-act="smartdel" data-id="' + s.id + '" aria-label="Delete smart folder ' + esc(s.name) + '">' + icon('x', 'sm') + '</button>'); }).join('') + '</div>'
      : '<p class="note small">A smart folder gathers notes by itself: by tag, life area, how recent, or what\'s inside.</p>') + '</section>';
  return h;
}
VIEWS.notes = function () {
  var q = noteQ.trim().toLowerCase();
  return '<div class="search"><label class="sr" for="nq">Search notes</label><input id="nq" class="input" type="search" placeholder="Search" value="' + esc(noteQ) + '" autocomplete="off"></div>'
    + '<div id="notelist">' + (q ? notesSearchHtml(q) : foldersHtml()) + '</div>'
    + '<div class="btnrow"><button class="btn accent" data-act="newnote">' + icon('plus', 'sm') + 'New note</button><button class="btn soft" data-act="foldernew">New folder</button></div>';
};
VIEWS.notes.after = function () {
  var q = $('#nq'); if (!q) return;
  q.addEventListener('input', function () { noteQ = q.value; var s = noteQ.trim().toLowerCase(); $('#notelist').innerHTML = s ? notesSearchHtml(s) : foldersHtml(); });
};
ACTS.foldernew = function (d) {
  openSheet('<div class="shead"><h2>New folder</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<form class="addstep" data-form="foldernew" data-id="' + esc(d && d.id || '') + '"><label class="sr" for="fname">Folder name</label><input id="fname" class="input" placeholder="Folder name" autocomplete="off" maxlength="24"><button class="btn accent" type="submit">Create</button></form>',
    function () { var e = $('#fname'); if (e) e.focus(); });
};
ACTS.form_foldernew = function (d, f) {
  var v = $('#fname', f).value.trim(); if (!v) return;
  var fo = folderByName(v, true, false);
  if (d.id && Store.get('notes', d.id)) Store.patch('notes', d.id, { folder: fo.id, folderBy: 'me' });
  closeSheet(); toast('Folder "' + esc(fo.name) + '" ready');
};
ACTS.folderdel = function (d) {
  var x = nf(), f = x.folders.filter(function (y) { return y.id === d.id; })[0]; if (!f) return;
  var moved = notesAll().filter(function (n) { return n.folder === d.id; });
  x.folders = x.folders.filter(function (y) { return y.id !== d.id; }); nfSave(x);
  moved.forEach(function (n) { Store.patch('notes', n.id, { folder: null }); });
  toast('Folder deleted. Its ' + moved.length + ' note' + (moved.length === 1 ? '' : 's') + ' stay in All Notes.', function () { var y = nf(); y.folders.push(f); nfSave(y); moved.forEach(function (n) { Store.patch('notes', n.id, { folder: f.id }); }); });
};
ACTS.smartnew = function () {
  openSheet('<div class="shead"><h2>New smart folder</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div>'
    + '<form data-form="smartnew" style="display:grid;gap:12px"><div class="field"><label for="sname">Name</label><input id="sname" class="input" placeholder="e.g. HCPD this month" autocomplete="off" maxlength="30"></div>'
    + '<div class="field"><label for="stag">With tag</label><select id="stag" class="input sel"><option value="">Any</option>' + allTags().map(function (t) { return '<option value="' + esc(t[0]) + '">#' + esc(t[0]) + '</option>'; }).join('') + '</select></div>'
    + '<div class="field"><label for="sarea">In life area</label><select id="sarea" class="input sel"><option value="">Any</option>' + areasSorted().map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('') + '</select></div>'
    + '<div class="field"><label for="sdays">Edited in the last</label><select id="sdays" class="input sel"><option value="">Any time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>'
    + '<div class="field"><label for="shas">That has</label><select id="shas" class="input sel"><option value="">Anything</option><option value="checklist">A checklist</option><option value="photos">Photos</option></select></div>'
    + '<button class="btn accent" type="submit">Create</button></form>');
};
ACTS.form_smartnew = function (d, f) {
  var s = { id: 'sf' + Date.now().toString(36), name: $('#sname', f).value.trim().slice(0, 30), tag: $('#stag', f).value || null, area: $('#sarea', f).value || null, days: +$('#sdays', f).value || null, has: $('#shas', f).value || null };
  if (!s.tag && !s.area && !s.days && !s.has) { toast('Pick at least one rule'); return; }
  if (!s.name) s.name = [s.tag ? '#' + s.tag : '', s.area ? areaName(s.area) : '', s.days ? 'last ' + s.days + ' days' : '', s.has || ''].filter(Boolean).join(' · ');
  var x = nf(); x.smart.push(s); nfSave(x); closeSheet(); toast('Smart folder created');
};
ACTS.smartdel = function (d) { var x = nf(), s = x.smart.filter(function (y) { return y.id === d.id; })[0]; x.smart = x.smart.filter(function (y) { return y.id !== d.id; }); nfSave(x); toast('Smart folder deleted', function () { var y = nf(); y.smart.push(s); nfSave(y); }); };

/* ── the list ────────────────────────────────────────────────────── */
var noteGallery = false;
function noteRow(n) {
  var bk = n.book ? Store.get('books', n.book) : null, lines = String(n.body || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  var first = lines.filter(function (l) { return l !== (n.title || '') && ('❝ ' + l).indexOf(n.title || '\u0000') !== 0; })[0] || '';
  var d = new Date(n.updated || n.created || Date.now()), ds = ymd(d) === today() ? clock(d.getTime()) : shortDate(ymd(d));
  return '<button class="row nrow" data-act="open" data-v="note" data-id="' + n.id + '"><span class="grow"><div class="t">' + (n.pinned ? '📌 ' : '') + esc(n.title || 'New note') + '</div>'
    + '<div class="s nsub"><b>' + esc(ds) + '</b> ' + esc(first.slice(0, 80) || (noteImgs(n).length ? 'Photo' : 'No more text')) + '</div>'
    + '<div class="s">' + (bk ? '📖 ' + esc(bk.title) + (n.page ? ' p. ' + n.page : '') + ' · ' : '') + (n.folder && folderName(n.folder) ? '📁 ' + esc(folderName(n.folder)) + ' ' : '')
    + (n.area ? areaDot(n.area) + esc(areaName(n.area)) + ' ' : '') + noteTags(n).slice(0, 3).map(function (t) { return '<span class="ntag">#' + esc(t) + '</span>'; }).join(' ') + ' ' + exPill(n) + '</div></span>'
    + (noteImgs(n).length ? '<img class="nthumb" src="/_blob/' + esc(noteImgs(n)[0]) + '" alt="">' : '') + '</button>';
}
function noteGroup(n) {
  if (n.pinned) return 'Pinned';
  var d = ymd(new Date(n.updated || n.created || Date.now())), t = today(), diff = dayDiff(d, t);
  if (diff <= 0) return 'Today'; if (diff <= 7) return 'Previous 7 Days'; if (diff <= 30) return 'Previous 30 Days';
  var p = parseYmd(d); return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][p.getMonth()] + (p.getFullYear() !== parseYmd(t).getFullYear() ? ' ' + p.getFullYear() : '');
}
TITLES.notelist = function (key) { return noteKeyName(key || 'all'); };
VIEWS.notelist = function (key) {
  key = key || 'all';
  var ns = notesAll().filter(function (n) { return noteMatch(n, key); }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (b.updated || 0) - (a.updated || 0); });
  var h = '<div class="btnrow"><button class="btn accent" data-act="newnote" data-k="' + esc(key) + '">' + icon('plus', 'sm') + 'New note</button>'
    + '<button class="btn soft" data-act="notegallery" aria-pressed="' + noteGallery + '">' + (noteGallery ? 'List' : 'Gallery') + '</button></div>';
  if (!ns.length) return h + '<div class="empty">No notes here yet.</div>';
  if (noteGallery) {
    var imgs = []; ns.forEach(function (n) { noteImgs(n).forEach(function (id) { imgs.push([n.id, id]); }); });
    return h + (imgs.length ? '<div class="ngal">' + imgs.map(function (x) { return '<button data-act="open" data-v="note" data-id="' + x[0] + '"><img src="/_blob/' + esc(x[1]) + '" alt="Photo in a note"></button>'; }).join('') + '</div>' : '<div class="empty">No photos in these notes.</div>');
  }
  var groups = [], by = {};
  ns.forEach(function (n) { var g = noteGroup(n); if (!by[g]) { by[g] = []; groups.push(g); } by[g].push(n); });
  return h + groups.map(function (g) { return '<section><h2 class="ngh">' + g + '</h2><div class="list">' + by[g].map(noteRow).join('') + '</div></section>'; }).join('')
    + '<p class="note small" style="text-align:center">' + ns.length + ' note' + (ns.length === 1 ? '' : 's') + '</p>';
};
ACTS.notegallery = function () { noteGallery = !noteGallery; render(); };
ACTS.newnote = function (d) {
  var k = d && d.k || '', f = { title: '', body: '', html: '', tags: [] };
  if (k.indexOf('f:') === 0) { f.folder = k.slice(2); f.folderBy = 'me'; }
  if (k.indexOf('a:') === 0) f.area = k.slice(2);
  if (k === 'ideas') f.kind = 'idea';
  if (k === 'pinned') f.pinned = true;
  var n = Store.put('notes', f); push('note', n.id);
  setTimeout(function () { var e = $('#nedit'); if (e) e.focus(); }, 60);
};

/* ── the editor ──────────────────────────────────────────────────── */
var NOTE_TB = [['h1', 'Title'], ['h2', 'Heading'], ['h3', 'Subheading'], ['p', 'Body'], ['pre', 'Mono'], ['bold', '<b>B</b>'], ['italic', '<i>I</i>'], ['underline', '<u>U</u>'], ['strikeThrough', '<s>S</s>'],
  ['ck', '☑︎'], ['ul', '•'], ['dash', '–'], ['ol', '1.']];
var NOTE_TB_LABEL = { bold: 'Bold', italic: 'Italic', underline: 'Underline', strikeThrough: 'Strikethrough', ck: 'Checklist', ul: 'Bulleted list', dash: 'Dashed list', ol: 'Numbered list' };
TITLES.note = function (id) { var n = Store.get('notes', id); return n && n.folder && folderName(n.folder) ? folderName(n.folder) : 'Note'; };
VIEWS.note = function (id) {
  var n = Store.get('notes', id); if (!n) return '<div class="empty">This note was deleted.</div>';
  var nbk = n.book ? Store.get('books', n.book) : null;
  return '<div class="ntb" id="ntb" role="toolbar" aria-label="Formatting">' + NOTE_TB.map(function (b) {
      return '<button type="button" data-keep data-act="nfmt" data-c="' + b[0] + '" aria-label="' + (NOTE_TB_LABEL[b[0]] || b[1]) + '">' + b[1] + '</button>'; }).join('')
    + (ASSETS ? '<label class="ntbcam" aria-label="Add a photo or scan">' + icon('camera', 'sm') + '<input id="nphoto" type="file" accept="image/*" capture="environment" class="sr"></label>' : '') + '</div>'
    + (nbk ? '<button class="link" data-act="open" data-v="book" data-id="' + nbk.id + '" style="justify-self:start">📖 ' + esc(nbk.title) + (n.page ? ' · p. ' + n.page : '') + '</button>' : '')
    + '<div id="nedit" class="nedit" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note" data-ph="Title, then your note…">' + noteHtml(n) + '</div>'
    + '<div id="norg">' + noteOrgHtml(id) + '</div>'
    + '<details class="card flat nmore"><summary><b>Folder, area and more</b></summary><div style="display:grid;gap:12px;margin-top:12px">'
    + '<div class="scrollx" role="group" aria-label="Area">' + areasSorted().map(function (a) {
      return '<button class="chip' + (n.area === a.id ? ' on' : '') + '" data-act="notearea" data-id="' + id + '" data-a="' + a.id + '"><i style="background:' + esc(a.color) + '"></i>' + esc(a.short) + '</button>'; }).join('') + '</div>'
    + (projectsAll('active').length ? '<div class="scrollx" role="group" aria-label="Project">' + projectsAll('active').map(function (p) {
      return '<button class="chip' + (n.project === p.id ? ' on' : '') + '" data-act="noteproj" data-id="' + id + '" data-p="' + p.id + '">' + esc(p.ic || '📁') + ' ' + esc(p.t) + '</button>'; }).join('') + '</div>' : '')
    + '<div class="btnrow"><button class="btn soft" data-act="notemove" data-id="' + id + '">Move to folder</button><button class="btn soft" data-act="notepin" data-id="' + id + '">' + (n.pinned ? 'Unpin' : 'Pin to top') + '</button></div>'
    + '<div class="btnrow"><button class="btn soft" data-act="notetotask" data-id="' + id + '">Make it a task</button>'
    + '<button class="btn ghost" style="color:var(--bad)" data-act="delnote" data-id="' + id + '">Delete</button></div></div></details>';
};
/* Folder chip, tags, to-dos found, and the area suggestion. Repainted in place while typing. */
function noteOrgHtml(id) {
  var n = Store.get('notes', id); if (!n) return '';
  var h = '<div class="chips norgrow">';
  h += n.folder && folderName(n.folder) ? '<button class="chip" data-act="notemove" data-id="' + id + '">📁 ' + (n.folderBy === 'ai' ? 'Filed in ' : '') + esc(folderName(n.folder)) + ' · <span class="link">Move</span></button>'
    : '<button class="chip" data-act="notemove" data-id="' + id + '">📁 Add to folder</button>';
  h += noteTags(n).map(function (t) { return '<span class="chip ntagc">#' + esc(t) + ((n.aiTags || []).indexOf(t) > -1 ? ' <button class="x" data-act="notetagdel" data-id="' + id + '" data-t="' + esc(t) + '" aria-label="Remove tag ' + esc(t) + '">×</button>' : '') + '</span>'; }).join('');
  h += '</div>';
  var todos = (n.todos || []).filter(function (t) { return (n.todosDone || []).indexOf(t) < 0; });
  if (todos.length) h += '<div class="todobar"><div class="grow"><b>' + todos.length + ' to-do' + (todos.length === 1 ? '' : 's') + ' found</b><div class="s">' + todos.map(function (t) { return esc(t); }).join(' · ') + '</div></div>'
    + '<button class="btn sm accent" data-act="notetodos" data-id="' + id + '">Add as tasks</button><button class="iconbtn" data-act="notetodosno" data-id="' + id + '" aria-label="Dismiss">' + icon('x', 'sm') + '</button></div>';
  return h + spotChip('note', id);
}
function noteOrgPaint(id) { var el = $('#norg'); if (el && current().view === 'note' && current().arg === id) el.innerHTML = noteOrgHtml(id); }
var noteSaveT = null, noteOrgT = null, noteOrgSeen = {};
function noteSaveNow(id) {
  clearTimeout(noteSaveT);
  var ed = $('#nedit'), n = Store.get('notes', id); if (!ed || !n || current().arg !== id) return;
  var html = cleanHtml(ed.innerHTML), body = htmlToText(html), lines = body.split('\n').map(function (l) { return l.trim(); }).filter(Boolean), first = lines[0] || '';
  var title = (n.aiTitle && first.length > 50 ? n.aiTitle : first).slice(0, 80);
  if (n.kind === 'quote' && title && title.indexOf('❝') !== 0) title = '❝ ' + title.slice(0, 70);
  var typed = textTags(body), tags = typed.slice(); (n.aiTags || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); });
  var f = { html: html, body: body, title: title, tags: tags };
  if (!AI.ready) { var td = lines.filter(function (l) { return /^(todo\b[:\s-]*|-?\s*\[ \]\s*)/i.test(l); }).map(function (l) { return l.replace(/^(todo\b[:\s-]*|-?\s*\[ \]\s*)/i, '').trim(); }).filter(Boolean); if (td.length || (n.todos || []).length) f.todos = td; }
  if (html === (n.html || '') && body === (n.body || '') && title === (n.title || '')) return;
  Store.patch('notes', id, f); noteOrgPaint(id);
}
function noteSaveSoon(id) {
  clearTimeout(noteSaveT); noteSaveT = setTimeout(function () { noteSaveNow(id); }, 500);
  clearTimeout(noteOrgT); noteOrgT = setTimeout(function () { noteOrganize(id); }, 4000);
}
VIEWS.note.after = function (id) {
  var ed = $('#nedit'), tb = $('#ntb'); if (!ed) return;
  ed.addEventListener('input', function () { noteSaveSoon(id); });
  ed.addEventListener('blur', function () { noteSaveNow(id); });
  ed.addEventListener('paste', function (e) {
    var cd = e.clipboardData; if (!cd) return; e.preventDefault();
    var html = cd.getData('text/html'), text = cd.getData('text/plain');
    document.execCommand('insertHTML', false, html ? cleanHtml(html) : esc(text).replace(/\n/g, '<br>'));
  });
  // Tap the circle of a checklist item to tick it.
  ed.addEventListener('click', function (e) {
    var li = e.target.closest && e.target.closest('ul.nck > li'); if (!li) return;
    if (e.clientX - li.getBoundingClientRect().left > 32) return;
    if (li.hasAttribute('data-done')) li.removeAttribute('data-done'); else li.setAttribute('data-done', '1');
    e.preventDefault(); noteSaveNow(id);
  });
  if (tb) tb.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) e.preventDefault(); }); // keep the caret where it is
  var ph = $('#nphoto'); if (ph) ph.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0]; if (!file || !ASSETS) return;
    toast('Adding the photo…');
    ASSETS.upload(file).then(function (r) {
      var e2 = $('#nedit'); if (!e2 || current().arg !== id) return;
      e2.focus(); document.execCommand('insertHTML', false, '<img src="/_blob/' + r.id + '" alt="Photo"><div><br></div>');
      if (!/_blob/.test(e2.innerHTML)) e2.insertAdjacentHTML('beforeend', '<img src="/_blob/' + r.id + '" alt="Photo"><div><br></div>');
      noteSaveNow(id); toast('Photo added');
    }).catch(function () { toast('The photo didn\'t upload. Try a smaller one.'); });
    e.target.value = '';
  });
};
function selLi() { var s = getSelection(); if (!s || !s.rangeCount) return null; var n = s.anchorNode; n = n && (n.nodeType === 1 ? n : n.parentElement); return n && n.closest ? n.closest('#nedit li') : null; }
ACTS.nfmt = function (d) {
  var ed = $('#nedit'), c = d.c; if (!ed) return;
  if (document.activeElement !== ed) ed.focus();
  if (c === 'bold' || c === 'italic' || c === 'underline' || c === 'strikeThrough') document.execCommand(c);
  else if (c === 'ol') document.execCommand('insertOrderedList');
  else if (c === 'ul' || c === 'dash' || c === 'ck') {
    var li = selLi(), ul = li && li.closest('ul'), want = c === 'ul' ? '' : c === 'ck' ? 'nck' : c;
    if (ul && (ul.className || '') !== want) ul.className = want;
    else { document.execCommand('insertUnorderedList'); li = selLi(); ul = li && li.closest('ul'); if (ul) ul.className = want; }
  } else document.execCommand('formatBlock', false, '<' + c + '>');
  noteSaveSoon(current().arg);
};
ACTS.notepin = function (d) { var n = Store.get('notes', d.id); Store.patch('notes', d.id, { pinned: !n.pinned }); toast(n.pinned ? 'Unpinned' : 'Pinned to the top'); };
ACTS.noteproj = function (d) { var n = Store.get('notes', d.id); Store.patch('notes', d.id, { project: n.project === d.p ? null : d.p }); };
ACTS.notearea = function (d) { var n = Store.get('notes', d.id); Store.patch('notes', d.id, { area: n.area === d.a ? null : d.a }); delete spotted['note:' + d.id]; noteOrgPaint(d.id); };
ACTS.delnote = function (d) { var n = Store.get('notes', d.id); clearTimeout(noteSaveT); clearTimeout(noteOrgT); Store.del('notes', d.id); pop(); toast('Note deleted', function () { Store.put('notes', n); }); };
ACTS.notetotask = function (d) {
  noteSaveNow(d.id); var n = Store.get('notes', d.id);
  var t = Store.put('tasks', { t: n.title || 'From a note', note: n.body || '', area: n.area || null, project: n.project || null, due: today(), done: false, steps: [] });
  logEvent('Turned a note into a task: ' + t.t, t.area); push('task', t.id);
};
ACTS.notemove = function (d) {
  var n = Store.get('notes', d.id), x = nf();
  openSheet('<div class="shead"><h2>Move to folder</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('x') + '</button></div><div class="list">'
    + x.folders.map(function (f) { return '<button class="row" data-act="notefolder" data-id="' + d.id + '" data-f="' + f.id + '"><span class="fic">📁</span><span class="grow t">' + esc(f.name) + '</span>' + (n.folder === f.id ? '<span class="meta">✓</span>' : '') + '</button>'; }).join('')
    + (n.folder ? '<button class="row" data-act="notefolder" data-id="' + d.id + '" data-f=""><span class="fic">📄</span><span class="grow t">No folder</span></button>' : '') + '</div>'
    + '<form class="addstep" data-form="foldernew" data-id="' + d.id + '"><label class="sr" for="fname">New folder name</label><input id="fname" class="input" placeholder="New folder" autocomplete="off" maxlength="24"><button class="btn soft" type="submit">Create</button></form>');
};
ACTS.notefolder = function (d) { Store.patch('notes', d.id, { folder: d.f || null, folderBy: 'me' }); closeSheet(); toast(d.f ? 'Moved to ' + esc(folderName(d.f)) : 'Removed from its folder'); };
ACTS.notetagdel = function (d) {
  var n = Store.get('notes', d.id); if (!n) return;
  Store.patch('notes', d.id, { aiTags: (n.aiTags || []).filter(function (t) { return t !== d.t; }), tags: noteTags(n).filter(function (t) { return t !== d.t; }), noTags: (n.noTags || []).concat([d.t]) });
  noteOrgPaint(d.id);
};
ACTS.notetodos = function (d) {
  var n = Store.get('notes', d.id); if (!n) return;
  var todos = (n.todos || []).filter(function (t) { return (n.todosDone || []).indexOf(t) < 0; }), made = [];
  todos.forEach(function (t) { var pt = parseTaskText(t); made.push(Store.put('tasks', { t: pt.title || t, area: n.area || pt.area || null, project: n.project || null, due: pt.due || null, time: pt.time || null, done: false, steps: [], note: 'From the note "' + (n.title || '') + '"', fromNote: n.id }, true).id); });
  Store.patch('notes', d.id, { todosDone: (n.todosDone || []).concat(todos) }); noteOrgPaint(d.id);
  toast(made.length + ' task' + (made.length === 1 ? '' : 's') + ' added', function () { made.forEach(function (id) { Store.del('tasks', id); }); Store.patch('notes', d.id, { todosDone: n.todosDone || [] }); });
};
ACTS.notetodosno = function (d) { var n = Store.get('notes', d.id); if (n) { Store.patch('notes', d.id, { todosDone: (n.todosDone || []).concat(n.todos || []) }); noteOrgPaint(d.id); } };

/* ── Claude files the note ───────────────────────────────────────────
   One call, a few seconds after you stop typing: folder, tags, a title
   for a long first line, the life area, and any to-dos. */
function noteOrganize(id) {
  var n = Store.get('notes', id); if (!n || !AI.ready || n.book) return;
  var text = String(n.body || '').trim(); if (text.length < 15 || noteOrgSeen[id] === text) return;
  noteOrgSeen[id] = text;
  var x = nf();
  aiJson('Organize this note for a personal notes app.\nFolders (JSON): ' + JSON.stringify(x.folders.map(function (f) { return f.name; }))
    + '\nLife areas (JSON): ' + JSON.stringify(areasSorted().map(function (a) { return { id: a.id, name: a.name }; }))
    + '\nNote text: ' + JSON.stringify(text.slice(0, 2500))
    + '\nReply with JSON only: {"title": "short title, at most 6 words", "folder": "an existing folder name if one fits, otherwise a new 1-2 word name", '
    + '"tags": ["up to 3 lowercase single words"], "area": "a life area id or null", "todos": ["things the writer still has to do, each short, keep any day or time mentioned"]}. Use [] for todos if there are none.')
    .then(function (r) {
      var cur = Store.get('notes', id); if (!cur || !r) return;
      var f = {};
      if (r.title && typeof r.title === 'string') f.aiTitle = r.title.slice(0, 60);
      if (!cur.folder && cur.kind !== 'idea' && typeof r.folder === 'string' && r.folder.trim()) { var fo = folderByName(r.folder, true, true); if (fo) { f.folder = fo.id; f.folderBy = 'ai'; } }
      var no = cur.noTags || [], ai = (Array.isArray(r.tags) ? r.tags : []).map(function (t) { return String(t).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24); }).filter(function (t) { return t && no.indexOf(t) < 0; }).slice(0, 3);
      f.aiTags = ai; var tags = textTags(cur.body || ''); ai.forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); }); f.tags = tags;
      var first = String(cur.body || '').split('\n')[0] || ''; if (f.aiTitle && first.length > 50) f.title = f.aiTitle;
      if (Array.isArray(r.todos)) f.todos = r.todos.map(function (t) { return String(t).trim().slice(0, 120); }).filter(Boolean).slice(0, 6);
      Store.patch('notes', id, f);
      if (r.area && area(r.area) && !noteAreas(cur).length && spotSeen['note:' + id] !== 'no') spotted['note:' + id] = r.area;
      noteOrgPaint(id);
    }).catch(function () {});
}
