/* ═══ BOOT ══════════════════════════════════════════════════════════ */
document.documentElement.dataset.theme = 'dark'; // dark only
var hadCache = Store.init();
Store.on(function () { render(); });

/* First run: seed when there is truly nothing, after db has answered (or
   straight away when there is no db). Never seed over real data. */
function maybeSeed() {
  if (Store.get('meta', 'setup')) { upgradeSeed(); return; }
  if (Store.all('tasks').length || Store.all('areas').length) { Store.put('meta', { id: 'setup', seeded: Date.now(), examples: false }); return; }
  seedData();
}
Store.connect(maybeSeed).then(function (live) { if (!live) maybeSeed(); });
if (!hadCache && (!window.claude || !window.claude.use)) maybeSeed();
aiInit(); assetsInit(); timerLoop();
render(true);

/* Opening MossOS after 10+ minutes away lands in Quick capture (Settings →
   Opens to). Away = page closed or in the background. */
var AWAY_MS = 10 * 60 * 1000;
function lastSeen() { try { return +localStorage.getItem('mossos.lastSeen') || 0; } catch (e) { return 0; } }
function markSeen() { try { localStorage.setItem('mossos.lastSeen', String(Date.now())); } catch (e) {} }
function maybeQuickCapture() {
  var away = Date.now() - lastSeen() >= AWAY_MS; markSeen();
  if (!away || openPref() !== 'capture' || !$('#sheetbg').hidden) return;
  var ae = document.activeElement; if (ae && /INPUT|TEXTAREA/.test(ae.tagName)) return;
  quickCapture();
}
setTimeout(maybeQuickCapture, 250);
document.addEventListener('visibilitychange', function () { if (document.hidden) markSeen(); else maybeQuickCapture(); });
addEventListener('pagehide', markSeen);
setInterval(function () { if (!document.hidden) markSeen(); }, 60000);

/* A new day while the app stays open: repaint at midnight. */
(function tick() {
  var n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(function () { render(); tick(); }, next - n);
})();
