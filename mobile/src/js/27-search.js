/* ═══ SEARCH ════════════════════════════════════════════════════════
   One box over everything: tasks, notes, journal, books and quotes,
   goals, projects, habits, life areas and shifts. */
var searchQ = '';
TITLES.search = 'Search';
function searchRecent() { try { return JSON.parse(localStorage.getItem('mossos.searches') || '[]'); } catch (e) { return []; } }
function searchRemember(q) { try { var r = searchRecent().filter(function (x) { return x !== q; }); r.unshift(q); localStorage.setItem('mossos.searches', JSON.stringify(r.slice(0, 8))); } catch (e) {} }
function searchHits(q) {
  q = q.trim().toLowerCase(); if (q.length < 2) return [];
  var has = function (s) { return String(s || '').toLowerCase().indexOf(q) > -1; };
  var snip = function (s) { s = String(s || '').replace(/\s+/g, ' '); var i = s.toLowerCase().indexOf(q); return i < 0 ? s.slice(0, 80) : (i > 30 ? '…' : '') + s.slice(Math.max(0, i - 30), i + 60); };
  var groups = [];
  var add = function (name, list) { if (list.length) groups.push([name, list.slice(0, 8), list.length]); };
  add('Tasks', Store.all('tasks').filter(function (t) { return has(t.t) || has(t.note); }).sort(function (a, b) { return !!a.done - !!b.done; })
    .map(function (t) { return { v: 'task', id: t.id, t: (t.done ? '✓ ' : '') + t.t, s: t.due ? shortDate(t.due) : 'Someday' }; }));
  add('Notes', Store.all('notes').filter(function (n) { return !n.book && (has(n.title) || has(n.body) || has((n.tags || []).join(' '))); })
    .map(function (n) { return { v: 'note', id: n.id, t: n.title || 'Untitled', s: snip(n.body) }; }));
  add('Journal', Store.all('journal').filter(function (j) { return has(j.text); }).sort(function (a, b) { return b.day.localeCompare(a.day); })
    .map(function (j) { return { v: 'entry', id: j.id, t: shortDate(j.day), s: snip(j.text) }; }));
  add('Books & quotes', Store.all('books').filter(function (b) { return has(b.title) || has(b.author); }).map(function (b) { return { v: 'book', id: b.id, t: '📖 ' + b.title, s: b.author || '' }; })
    .concat(Store.all('notes').filter(function (n) { return n.book && (has(n.body) || has(n.title)); }).map(function (n) { var b = Store.get('books', n.book); return { v: 'note', id: n.id, t: '❝ ' + snip(n.body), s: (b ? b.title : '') + (n.page ? ' p. ' + n.page : '') }; })));
  add('Goals', Store.all('goals').filter(function (g) { return has(g.n) || has(g.next) || has(g.why); }).map(function (g) { return { v: 'goal', id: g.id, t: g.n, s: g.next ? 'Next: ' + g.next : '' }; }));
  add('Projects', Store.all('projects').filter(function (x) { return has(x.t) || has(x.next); }).map(function (x) { return { v: 'project', id: x.id, t: x.t, s: x.next || '' }; }));
  add('Habits', habitsSorted().filter(function (h) { return has(h.n) || has(h.cue); }).map(function (h) { return { v: 'habit', id: h.id, t: h.ic + ' ' + h.n, s: h.cue || '' }; }));
  add('Life areas', areasSorted().filter(function (a) { return has(a.name) || has(a.focus); }).map(function (a) { return { v: 'area', id: a.id, t: a.name, s: a.focus || '' }; }));
  add('Shifts', Store.all('shifts').filter(function (s2) { return has(shiftJob(s2.job).name) || has(s2.note) || has(s2.date); }).sort(function (a, b) { return b.date.localeCompare(a.date); })
    .map(function (s2) { return { v: 'shift', id: s2.id, t: shiftJob(s2.job).ic + ' ' + shiftJob(s2.job).name, s: shortDate(s2.date) + ' · ' + shiftLabel(s2) }; }));
  return groups;
}
function searchResultsHtml() {
  var q = searchQ.trim();
  if (q.length < 2) {
    var r = searchRecent();
    return r.length ? '<section><div class="sechead"><h2>Recent</h2></div><div class="chips">' + r.map(function (x) { return '<button class="chip" data-act="searchset" data-q="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></section>'
      : '<p class="note">Search tasks, notes, journal, books and quotes, goals, projects, habits, life areas and shifts.</p>';
  }
  var g = searchHits(q);
  if (!g.length) return '<div class="empty">Nothing matches "' + esc(q) + '".</div>';
  return g.map(function (x) {
    return '<section><div class="sechead"><h2>' + x[0] + '</h2><span class="meta">' + x[2] + '</span></div><div class="list">' + x[1].map(function (r) {
      return '<button class="row" data-act="searchopen" data-v="' + r.v + '" data-id="' + r.id + '"><span class="grow"><div class="t">' + esc(r.t) + '</div>' + (r.s ? '<div class="s">' + esc(r.s) + '</div>' : '') + '</span>' + icon('chev', 'sm chev') + '</button>';
    }).join('') + '</div></section>';
  }).join('');
}
VIEWS.search = function () {
  return '<div class="search"><label class="sr" for="sq">Search everything</label><input id="sq" class="input" type="search" placeholder="Search everything" value="' + esc(searchQ) + '" autocomplete="off" enterkeyhint="search"></div>'
    + '<div id="sres">' + searchResultsHtml() + '</div>';
};
VIEWS.search.after = function () {
  var q = $('#sq'); if (!q) return;
  if (!searchQ) setTimeout(function () { try { q.focus(); } catch (e) {} }, 60);
  q.addEventListener('input', function () { searchQ = q.value; $('#sres').innerHTML = searchResultsHtml(); });
};
ACTS.searchset = function (d) { searchQ = d.q; render(false, true); };
ACTS.searchopen = function (d) { if (searchQ.trim().length > 1) searchRemember(searchQ.trim()); push(d.v, d.id); };
