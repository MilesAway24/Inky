// End-to-end check of the built app in Chromium (Playwright).
//   node mobile/test/e2e.js [screenshotDir]
// Runs against mobile/dist/mossos.html wrapped the way claude.ai wraps it,
// with a fake window.claude (mobile/test/mock-claude.js).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const shots = process.argv[2] || path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const page = fs.readFileSync(path.join(root, 'dist', 'mossos.html'), 'utf8');
const wrapped = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<style>:root{box-sizing:border-box}body{margin:0}</style></head><body>' + page + '</body></html>';
const file = path.join(shots, 'index.html');
fs.writeFileSync(file, wrapped);
const URL = 'file://' + file;
const mock = fs.readFileSync(path.join(__dirname, 'mock-claude.js'), 'utf8');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failures++; };

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const watch = (p, tag) => { p.on('pageerror', (e) => errs.push(tag + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(tag + ' console: ' + m.text()); }); };

  // ── phone, with sync + Claude ──────────────────────────────────────
  let ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(mock);
  let p = await ctx.newPage(); watch(p, 'phone');
  await p.goto(URL); await p.waitForTimeout(600);
  ok(await p.isVisible('text=Priorities'), 'Today shows Priorities');
  ok((await p.$$('.prio')).length === 3, 'example data seeds 1 P1 + 2 P2');
  ok(await p.isVisible('.sync.on'), 'sync badge shows Synced');
  const paths = await p.evaluate(() => Object.keys(window.__mock.docs));
  ok(paths.length > 10 && paths.every((k) => k.startsWith('data/users/u_test/m/')), 'writes go to the private per-user subtree (' + paths.length + ' docs)');
  await p.screenshot({ path: shots + '/phone-today.png', fullPage: true });

  // Play: do it
  const first = await p.textContent('.play .t span:last-child');
  await p.click('.play [data-act=playdo]'); await p.waitForTimeout(200);
  ok(!(await p.textContent('.play .t span:last-child')).includes(first) , 'Play "Do it" moves to the next card');
  ok(await p.isVisible('#toast >> text=Undo'), 'done shows an Undo toast');

  // Priority cap: P2 slots are full, so the swap sheet appears from a task
  await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  await p.click('text=Send Sam the revised invoice'); await p.waitForTimeout(150);
  await p.click('[data-act=taskprio][data-l=P2]'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Cap reached'), 'adding a third P2 opens the swap sheet');
  await p.click('#sheet [data-act=swap] >> nth=0'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Choose a P2'), 'swapping one out lets you choose a replacement');
  await p.click('#sheet [data-act=close]'); await p.waitForTimeout(100);

  // Steps + Break it down
  await p.fill('#newstep', 'Attach the PDF'); await p.press('#newstep', 'Enter'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Attach the PDF'), 'adding a step works');
  await p.click('[data-act=breakdown]'); await p.waitForTimeout(300);
  ok(await p.isVisible('text=Find the timeout'), 'Break it down adds Claude\'s steps');
  await p.fill('#tnote', 'Edited note text'); await p.waitForTimeout(500);
  await p.click('.back'); await p.waitForTimeout(150);

  // Sweep
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(150);
  await p.click('.sweepbar'); await p.waitForTimeout(150);
  const before = await p.$$eval('.sweepcard', (x) => x.length);
  await p.click('[data-act=sweepto][data-to=tomorrow]'); await p.waitForTimeout(150);
  await p.click('[data-act=sweepto][data-to=drifted]'); await p.waitForTimeout(150);
  ok(before === 1 && await p.isVisible('text=All swept'), 'sweep moves every slipped task to a real day');
  await p.click('.back'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Slipped, rescheduled'), 'Today lists slipped, rescheduled tasks');

  // Capture two lines → inbox → sort with Claude
  await p.click('.tabs .cap'); await p.waitForTimeout(150);
  await p.fill('#captext', 'Call the HCPD office about the packet\nIdea: a shift-day meal plan');
  await p.click('[data-act=capsave]'); await p.waitForTimeout(200);
  ok(await p.isVisible('text=2 items in your inbox'), 'a two-line capture makes two inbox items');
  await p.click('.inboxbar'); await p.waitForTimeout(150);
  await p.screenshot({ path: shots + '/phone-inbox.png', fullPage: true });
  await p.click('[data-act=sortai]'); await p.waitForTimeout(400);
  ok(await p.isVisible('text=Accept all'), 'Sort with Claude shows suggestions');
  await p.screenshot({ path: shots + '/phone-sort.png', fullPage: true });
  await p.click('[data-act=sortacceptall]'); await p.waitForTimeout(300);
  ok(await p.isVisible('text=Inbox zero'), 'accepting all empties the inbox');
  await p.waitForTimeout(500); // saves are debounced by 350 ms
  const t = await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.t === 'Call the HCPD office about the packet' && d.steps && d.steps.length));
  ok(t, 'the sorted capture became a task with a first step');

  // Reload: everything still there
  await p.reload(); await p.waitForTimeout(700);
  await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Call the HCPD office about the packet'), 'tasks survive a reload');
  await p.click('text=Send Sam the revised invoice'); await p.waitForTimeout(150);
  ok((await p.inputValue('#tnote')) === 'Edited note text', 'note edits survive a reload');

  // Every screen: no sideways scrolling
  const views = ['today', 'tasks', 'more', 'areas', 'inbox', 'notes', 'settings', 'money', 'habits'];
  let wide = [];
  for (const v of views) {
    await p.evaluate((v) => { document.querySelector('[data-act=tab][data-v="' + v + '"]') ? document.querySelector('[data-act=tab][data-v="' + v + '"]').click() : null; }, v);
    await p.waitForTimeout(120);
    const w = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (w > 1) wide.push(v + ' +' + w);
  }
  await p.click('.tabs [data-v=more]'); await p.click('.menu [data-v=areas]'); await p.click('.abig >> nth=1'); await p.waitForTimeout(150);
  const wa = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (wa > 1) wide.push('area +' + wa);
  ok(!wide.length, 'no screen scrolls sideways on a phone ' + (wide.length ? JSON.stringify(wide) : ''));
  await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  await p.screenshot({ path: shots + '/phone-tasks.png', fullPage: true });
  await ctx.close();

  // ── iPad ───────────────────────────────────────────────────────────
  ctx = await b.newContext({ ...devices['iPad Pro 11 landscape'] });
  await ctx.addInitScript(mock);
  p = await ctx.newPage(); watch(p, 'ipad');
  await p.goto(URL); await p.waitForTimeout(600);
  ok(await p.isVisible('.side .brand'), 'iPad shows the sidebar instead of tabs');
  await p.screenshot({ path: shots + '/ipad-today.png' });
  await ctx.close();

  // ── plain browser, no window.claude ───────────────────────────────
  ctx = await b.newContext({ ...devices['iPhone 13'] });
  p = await ctx.newPage(); watch(p, 'local');
  await p.goto(URL); await p.waitForTimeout(500);
  ok(await p.isVisible('text=This device'), 'without Claude it runs on this device');
  ok((await p.$$('.prio')).length === 3, 'and still seeds its examples');
  ok(await p.isDisabled('[data-act=breakdown]').catch(() => true), 'Claude-only buttons are off when Claude is absent');
  await ctx.close();

  await b.close();
  ok(!errs.length, 'no page errors ' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : ''));
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
