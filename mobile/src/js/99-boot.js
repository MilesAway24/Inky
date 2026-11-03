/* ═══ BOOT ══════════════════════════════════════════════════════════ */
try { var th = localStorage.getItem('mossos.theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
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

/* A new day while the app stays open: repaint at midnight. */
(function tick() {
  var n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(function () { render(); tick(); }, next - n);
})();
