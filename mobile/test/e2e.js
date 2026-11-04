// End-to-end check of the built app in Chromium (Playwright).
//   node mobile/test/e2e.js [screenshotDir]
// Runs against mobile/dist/mossos.html wrapped the way claude.ai wraps it,
// with a fake window.claude (mobile/test/mock-claude.js).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const NodeURL = require('url').URL;
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
const mockRaw = fs.readFileSync(path.join(__dirname, 'mock-claude.js'), 'utf8');
// Most checks start on Today: pretend MossOS was open a moment ago, so it
// doesn't land in Quick capture (checked on its own below).
const seenNow = "try{localStorage.setItem('mossos.lastSeen',String(Date.now()))}catch(e){}\n";
const mock = seenNow + mockRaw;

let failures = 0;
async function reloadKeeping(p, ctx) {
  const d = await p.evaluate(() => JSON.stringify(window.__mock.docs));
  await ctx.addInitScript('window.__mockSeed = ' + d + '; window.__mockSeedId = ' + Date.now() + ';');
  await p.reload(); await p.waitForTimeout(700);
}
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
  ok(!(await p.isVisible('text=Priorities')) && !(await p.$('[data-act=pickprio]')), 'Today has no Priorities section');
  ok(await p.isVisible('.play'), 'example data fills the Play card');
  ok(await p.isVisible('.sync.on'), 'sync badge shows Synced');
  const paths = await p.evaluate(() => Object.keys(window.__mock.docs));
  ok(paths.length > 10 && paths.every((k) => k.startsWith('data/users/u_test/m/')), 'writes go to the private per-user subtree (' + paths.length + ' docs)');
  await p.screenshot({ path: shots + '/phone-today.png', fullPage: true });

  // Play: do it
  const first = await p.textContent('.play .t span:last-child');
  await p.click('.play [data-act=playdo]'); await p.waitForTimeout(200);
  ok(!(await p.textContent('.play .t span:last-child')).includes(first) , 'Play "Do it" moves to the next card');
  ok(await p.isVisible('#toast >> text=Undo'), 'done shows an Undo toast');

  // ── Tasks: three groups, add in words, swipe, rename, repeat ─────
  await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  const groups = await p.$$eval('.grouph', (x) => x.map((e) => e.childNodes[0].textContent.trim()));
  ok(groups.join(',') === 'Today,Upcoming,Someday', 'the list has Today, Upcoming and Someday (' + groups.join(',') + ')');
  ok(!(await p.isVisible('text=P1')), 'no P1/P2 anywhere in the list');
  const task = (title) => p.evaluate((t) => Object.values(window.__mock.docs).filter((d) => d.t === t)[0], title);
  await p.fill('#qadd', 'Pay the storage unit every month on the 15th at 9am'); await p.press('#qadd', 'Enter'); await p.waitForTimeout(500);
  let tk = await task('Pay the storage unit');
  ok(tk && tk.repeat && tk.repeat.every === 'month' && tk.repeat.dom === 15 && tk.time === '09:00' && tk.due.endsWith('-15'),
    'the add box reads "every month on the 15th at 9am" (' + JSON.stringify(tk && { r: tk.repeat, time: tk.time, due: tk.due }) + ')');
  await p.fill('#qadd', 'Call mom at 8am today'); await p.press('#qadd', 'Enter'); await p.waitForTimeout(400);
  const openToday = await p.$$eval('section:has(.grouph:text-is("Today")) .trow:not(.done) .tt', (x) => x.map((e) => e.textContent));
  ok(/Call mom/.test(openToday[0] || ''), 'a timed task sorts first among open tasks on Today (' + (openToday[0] || '') + ')');
  await p.fill('#qadd', 'gym 6pm every Mon, Thu'); await p.press('#qadd', 'Enter'); await p.waitForTimeout(500);
  tk = await task('Gym');
  ok(tk && tk.time === '18:00' && tk.repeat && tk.repeat.days.join('') === '1001000', 'and "gym 6pm every Mon, Thu" (' + JSON.stringify(tk && tk.repeat) + ')');
  const swipe = async (title, dx) => {
    const el = await p.$('.trow:has-text("' + title + '") .trin'); await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
    const b = await el.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
    for (let i = 1; i <= 6; i++) await p.mouse.move(b.x + b.width / 2 + dx * i / 6, b.y + b.height / 2 + 2);
    await p.mouse.up(); await p.waitForTimeout(600);
  };
  await swipe('Plan the date night', 140);
  ok((await task('Plan the date night')).done === true, 'swiping right ticks a task off');
  await p.click('#toast [data-act=undo]'); await p.waitForTimeout(500);
  ok((await task('Plan the date night')).done === false, 'and Undo puts it back');
  await swipe('Back up the photo drive', -140); await p.waitForTimeout(400);
  ok((await task('Back up the photo drive')).due === await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }),
    'swiping left moves it to tomorrow');
  await p.click('.trow:has-text("Schedule a dentist checkup") .tt'); await p.waitForTimeout(100);
  await p.fill('.ttedit', 'Book the dentist'); await p.press('.ttedit', 'Enter'); await p.waitForTimeout(500);
  ok(!!(await task('Book the dentist')), 'tapping a name renames it in place');
  await p.click('.trow:has-text("Book the dentist") .tt'); await p.fill('.ttedit', 'Something else'); await p.press('.ttedit', 'Escape'); await p.waitForTimeout(300);
  ok(!!(await task('Book the dentist')) && !(await task('Something else')), 'Esc cancels a rename');
  const trash0 = await task('Take out the trash');
  await p.click('.trow:has-text("Take out the trash") .ck'); await p.waitForTimeout(500);
  const trash1 = await task('Take out the trash');
  ok(!trash1.done && trash1.due > trash0.due && (trash1.doneDates || []).length === 1 && /every Thu/.test(await p.textContent('.trow:has-text("Take out the trash")')),
    'finishing a weekly task rolls it to next week and records the day (' + trash0.due + ' → ' + trash1.due + ')');
  await p.click('[data-act=open][aria-label="Open Send Sam the revised invoice"]'); await p.waitForTimeout(150);
  ok(!(await p.$('[data-act=taskprio]')) && await p.isVisible('[data-act=taskwhen]') && await p.isVisible('[data-act=taskrep][data-r=week]'), 'task detail has When and Repeat, and no P1/P2');
  await p.click('[data-act=taskrep][data-r=week]'); await p.waitForTimeout(150);
  ok(await p.isVisible('[data-act=taskrepday]'), 'Weekly shows day chips');
  await p.click('[data-act=taskrep][data-r=""]'); await p.waitForTimeout(100);
  // ── When picker with the time ruler ─────────────────────────────
  ok(!(await p.isVisible('#ttime')), 'the old time field is gone from task detail');
  await p.click('[data-act=taskwhen]'); await p.waitForTimeout(200);
  ok(await p.isVisible('#ruler') && /All day|AM|PM/.test(await p.textContent('#wbig')), 'When opens with a big readout and the ruler');
  await p.click('[data-act=wpreset][data-t="09:00"]'); await p.waitForTimeout(100);
  ok((await p.textContent('#wbig')).replace(/\s/g, '') === '9AM', 'a preset sets 9 AM (' + (await p.textContent('#wbig')) + ')');
  const rb = await (await p.$('#ruler')).boundingBox();
  await p.mouse.move(rb.x + rb.width / 2, rb.y + 20); await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(rb.x + rb.width / 2 - 6 * i, rb.y + 20);
  await p.waitForTimeout(200); await p.mouse.up(); await p.waitForTimeout(400);
  const after = (await p.textContent('#wbig')).replace(/\s/g, '');
  ok(/^9:(25|30|35|40)AM$/.test(after), 'dragging the ruler 60px left moves the time ~30 min later, in 5-minute steps (' + after + ')');
  await p.focus('#ruler'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  const k = (await p.textContent('#wbig')).replace(/\s/g, '');
  ok(/^9:\d5AM$|^9:\d0AM$/.test(k) && k !== after, 'arrow keys move it by 5 minutes (' + after + ' → ' + k + ')');
  await p.click('[data-act=wfull]'); await p.waitForTimeout(100);
  ok(await p.isVisible('.wmonth .cal'), 'Full month opens a month grid');
  const pick = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await p.click('[data-act=wday][data-d="' + pick + '"] >> nth=0'); await p.waitForTimeout(100);
  await p.click('[data-act=wremind][data-m="120"]'); await p.waitForTimeout(100);
  ok(/1 set/.test(await p.textContent('#whenbox')), 'a reminder can be set');
  const shown = (await p.textContent('#wbig')).replace(/\s/g, '');
  await p.click('[data-act=wdone]'); await p.waitForTimeout(600);
  const sam = await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.t === 'Send Sam the revised invoice')[0]);
  const want = (() => { const m = shown.match(/^(\d+)(?::(\d\d))?(AM|PM)$/); let h = +m[1] % 12 + (m[3] === 'PM' ? 12 : 0); return String(h).padStart(2, '0') + ':' + (m[2] || '00'); })();
  ok(sam.due === pick && sam.time === want && (sam.remind || []).indexOf(120) > -1, 'Done saves the day, time and reminder (' + sam.due + ' ' + sam.time + ' vs ' + pick + ' ' + want + ')');
  await p.click('[data-act=taskwhen]'); await p.waitForTimeout(150);
  await p.click('[data-act=wpreset][data-t=""]'); await p.click('[data-act=wdone]'); await p.waitForTimeout(500);
  ok(!(await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.t === 'Send Sam the revised invoice')[0].time)), 'All day clears the time');
  await p.click('[data-act=taskwhen]'); await p.waitForTimeout(150); await p.click('[data-act=wday] >> nth=0'); await p.click('[data-act=wdone]'); await p.waitForTimeout(300);

  // Steps + Break it down
  await p.fill('#newstep', 'Attach the PDF'); await p.press('#newstep', 'Enter'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Attach the PDF'), 'adding a step works');
  await p.click('[data-act=breakdown]'); await p.waitForTimeout(300);
  ok(await p.isVisible('text=Find the timeout'), 'Break it down adds Claude\'s steps');
  await p.fill('#tnote', 'Edited note text'); await p.waitForTimeout(500);
  await p.click('.back'); await p.waitForTimeout(150);

  // ── Reschedule sheet (replaces the one-at-a-time sweep) ─────────
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(150);
  const tk2 = (title) => p.evaluate((t) => Object.values(window.__mock.docs).filter((d) => d.t === t)[0], title);
  await p.click('[data-act=reschedule] >> nth=0'); await p.waitForTimeout(200);
  ok(await p.isVisible('#rsbox') && (await p.$$('.odrow input:checked')).length === 2 && /2 of 2 overdue/.test(await p.textContent('#rsbox .shead')),
    'Reschedule lists every overdue task, all ticked');
  await p.uncheck('.odrow >> nth=1 >> input'); await p.waitForTimeout(150);
  ok(/1 of 2/.test(await p.textContent('#rsbox .shead')) && /Reschedule 1 task/.test(await p.textContent('[data-act=rsgo]')), 'unticking one updates both counts');
  ok(await p.isDisabled('[data-act=rsgo]'), 'Reschedule waits for a date');
  const todayCell = await p.$('.cal.mini .day.today .dots i');
  ok(!!todayCell, 'the month grid dots days that already have tasks');
  await p.click('[data-act=rsdelete]'); await p.waitForTimeout(600);
  ok(!(await tk2('Order the replacement cable')) && !(await p.isVisible('#rsbox')), 'Delete removes the ticked task');
  await p.click('#toast [data-act=undo]'); await p.waitForTimeout(600);
  ok(!!(await tk2('Order the replacement cable')), 'and Undo brings it back');
  await p.click('[data-act=reschedule] >> nth=0'); await p.waitForTimeout(200);
  await p.click('[data-act=rsspread]'); await p.waitForTimeout(600);
  const sp = [await tk2('Order the replacement cable'), await tk2('Reply to the important emails')];
  const tday = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  ok(sp.every((x) => x.due >= tday) && /Spread over/.test(await p.textContent('#toast')), 'Spread puts them on days this week (' + sp.map((x) => x.due).join(', ') + ')');
  await p.click('#toast [data-act=undo]'); await p.waitForTimeout(600);
  await p.click('[data-act=reschedule] >> nth=0'); await p.waitForTimeout(200);
  await p.click('.sweep3 [data-act=rsday] >> nth=1'); await p.waitForTimeout(100);
  await p.click('[data-act=rspreset][data-t="19:00"]'); await p.waitForTimeout(100);
  ok((await p.textContent('#rsbig')).replace(/\s/g, '') === '7PM', 'the ruler presets set 7 PM');
  await p.fill('#rsremark', 'Long shift, no energy');
  await p.click('[data-act=rsgo]'); await p.waitForTimeout(600);
  const moved = [await tk2('Order the replacement cable'), await tk2('Reply to the important emails')];
  ok(moved.every((x) => x.due > tday && x.time === '19:00' && x.slip && x.slip.remark === 'Long shift, no energy'), 'Reschedule moves them with the time and the remark');
  ok(await p.isVisible('text=Slipped, rescheduled'), 'Today lists slipped, rescheduled tasks');

  // Capture two lines → inbox → sort with Claude
  await p.click('.tabs .cap'); await p.waitForTimeout(150);
  await p.click('[data-act=capkind][data-k=inbox]');
  await p.fill('#captext', 'Call the HCPD office about the packet\nIdea: a shift-day meal plan');
  await p.click('[data-act=capsave]'); await p.waitForTimeout(200);
  ok(await p.isVisible('text=2 items in your inbox'), 'a two-line capture makes two inbox items');
  await p.click('.headsup [data-v=inbox]'); await p.waitForTimeout(150);
  await p.screenshot({ path: shots + '/phone-inbox.png', fullPage: true });
  await p.click('[data-act=sortai]'); await p.waitForTimeout(400);
  ok(await p.isVisible('text=File all'), 'Sort with Claude shows suggestions');
  await p.screenshot({ path: shots + '/phone-sort.png', fullPage: true });
  await p.click('[data-act=suggall]'); await p.waitForTimeout(300);
  ok(await p.isVisible('text=Inbox zero'), 'accepting all empties the inbox');
  await p.waitForTimeout(500); // saves are debounced by 350 ms
  const t = await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.t === 'Call the HCPD office about the packet' && d.steps && d.steps.length));
  ok(t, 'the sorted capture became a task with a first step');

  // Reload: everything still there. The fake db is handed over explicitly
  // so the check is about the app, not the browser's storage timing.
  await p.waitForTimeout(600);
  await reloadKeeping(p, ctx);

  await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  const survived = await p.isVisible('text=Call the HCPD office about the packet');
  if (!survived) { await p.screenshot({ path: shots + '/fail-reload.png', fullPage: true }); console.log(await p.evaluate(() => document.querySelector('#top').textContent + ' | ' + Object.values(window.__mock.docs).filter((d) => d.t).map((d) => d.t).join(' / '))); }
  ok(survived, 'tasks survive a reload');
  await p.click('[data-act=open][aria-label="Open Send Sam the revised invoice"]'); await p.waitForTimeout(150);
  ok((await p.inputValue('#tnote')) === 'Edited note text', 'note edits survive a reload');


  // ── Phase 2: habits ──────────────────────────────────────────────
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(150);
  ok((await p.$$('.hchip')).length === 6, 'Today lists the 6 habits due today');
  await p.click('.hchip >> nth=0'); await p.waitForTimeout(150);
  ok(await p.isVisible('.hchip.on'), 'tapping a habit on Today marks it done');
  ok(/in a row/.test(await p.textContent('#toast')), 'marking shows the streak');
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=habits]'); await p.waitForTimeout(150);
  ok((await p.$$('.hcard')).length === 6, 'Habits lists 6 habit cards');
  const stat = await p.textContent('.stats4 > div:first-child b');
  ok(/^1\/6/.test(stat.replace(/\s/g, '')), 'Done today reads 1/6 (' + stat + ')');
  const hv = await p.$$eval('[data-act=habview]', (x) => x.map((e) => e.textContent.trim()));
  ok(hv.join(',') === 'Daily,Weekly,Monthly', 'habit views read Daily, Weekly, Monthly in that order (' + hv.join(',') + ')');
  await p.click('[data-act=habview][data-v=month]'); await p.waitForTimeout(100);
  ok(await p.isVisible('.hmonth span.today'), 'Monthly shows this calendar month with today marked');
  await p.click('[data-act=habview][data-v=week]'); await p.waitForTimeout(100);
  ok(await p.isVisible('.hweek'), 'Weekly shows the week strip');
  // iPhone keeps a text field focused when you tap a button. Mark done on the
  // habit page (next to its edit fields) must still repaint.
  await p.click('.hcard:has(.hmark:text("Mark done")) .hhead >> nth=0'); await p.waitForTimeout(150);
  const hName = await p.textContent('#top h1');
  await p.focus('#hcue');
  await p.evaluate(() => document.querySelector('#view .hmark').click()); await p.waitForTimeout(300);
  ok(/^Done/.test((await p.textContent('#view .hmark')).trim()), 'Mark done on the habit page works while an edit field is focused (' + hName + ')');
  await p.evaluate(() => document.querySelector('#view .hmark').click()); await p.waitForTimeout(300);
  await p.click('[data-act=back]'); await p.waitForTimeout(150);
  await p.screenshot({ path: shots + '/phone-habits.png', fullPage: true });
  await p.click('.hcard >> nth=1 >> .hhead'); await p.waitForTimeout(150);
  const s0 = await p.textContent('.stats4 > div:first-child b');
  await p.click('[data-act=habskip]'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Undo skip'), 'skip today, on purpose');
  ok((await p.textContent('.stats4 > div:first-child b')) === s0, 'a deliberate skip keeps the streak (' + s0 + ')');
  const yday = await p.$('.hcard.big .hgrid button >> nth=28');
  const before2 = await yday.getAttribute('class');
  await yday.click(); await p.waitForTimeout(120);
  ok((await (await p.$('.hcard.big .hgrid button >> nth=28')).getAttribute('class')) !== before2, 'tapping a past day changes its mark');
  await p.click('.back'); await p.click('[data-act=newhabit]'); await p.waitForTimeout(120);
  await p.click('.tpl >> text=Run'); await p.waitForTimeout(150);
  ok(await p.isVisible('#hn') && (await p.inputValue('#hn')) === 'Run', 'a template creates a habit and opens it');
  await p.click('.back'); await p.waitForTimeout(100);

  // ── Goals, rebuilt from the demo ────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=goals]'); await p.waitForTimeout(150);
  ok((await p.$$('.goal2')).length === 4, 'Goals lists 4 live goals');
  ok(!/%/.test(await p.textContent('#view')), 'no percentage anywhere on Goals');
  ok((await p.$$eval('.stats3 span', (x) => x.map((e) => e.textContent))).join('|') === 'Live|Next actions ready|Touched this week', 'tiles: Live · Next actions ready · Touched this week');
  await p.screenshot({ path: shots + '/phone-goals.png', fullPage: true });
  await p.click('.goal2:has-text("HCPD")'); await p.waitForTimeout(150);
  ok(!/%/.test(await p.textContent('#view')) && await p.isVisible('text=Last seven weeks') && await p.isVisible('text=No week is marked as a failure'), 'a goal shows its seven weeks, no percentage');
  const goalDoc = () => p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.n === 'Get through the HCPD hiring process')[0]);
  const g0 = ((await goalDoc()).sessions || []).length;
  await p.click('[data-act=goaltask]'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=On your task list'), '"Put it on today" makes a task');
  await p.click('[data-act=goalnextdone]'); await p.waitForTimeout(500);
  ok(await p.isVisible('text=What\'s next?') && ((await goalDoc()).sessions || []).length === g0 + 1, 'Done records a session and asks for the next action');
  ok(!(await p.$('[data-act=goalsuggest]')), 'no Claude suggestions for goals');
  const linked = await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.t === 'Finish the PAT prep block')[0]);
  ok(linked && linked.done, 'the goal\'s task was ticked off with it');
  await p.click('#sheet [data-act=goalpick] >> nth=0'); await p.waitForTimeout(200);
  ok(await p.isVisible('.nextcard >> text=Pass the PAT'), 'picking an unfinished step makes it the next action');
  await p.click('[data-act=goalelse]'); await p.waitForTimeout(150);
  await p.fill('#gnext', 'Book the PAT practice slot'); await p.press('#gnext', 'Enter'); await p.waitForTimeout(200);
  ok(await p.isVisible('.nextcard >> text=Book the PAT practice slot'), '"Something else" swaps the action');
  const bars = await p.$$eval('.wk1 b', (x) => x.reduce((s, e) => s + (+e.textContent || 0), 0));
  ok(/across seven weeks/.test(await p.textContent('#view')) && bars >= 1, 'the seven-week bars count sessions (' + bars + ')');
  await p.click('[data-act=goaltask]'); await p.waitForTimeout(150);
  await p.click('.back'); await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  await p.click('.trow:has-text("Book the PAT practice slot") .ck'); await p.waitForTimeout(150);
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=goals]'); await p.waitForTimeout(150);
  ok(await p.isVisible('.goal2:has-text("HCPD") >> text=Nothing set yet'), 'ticking a goal task from Tasks clears the goal\'s next action');
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(150);
  const kinds = await p.evaluate(() => document.querySelector('.play [data-act=playdo]').dataset.k);
  ok(['task', 'habit', 'goal'].includes(kinds), 'Play serves tasks, habits and goals (now: ' + kinds + ')');

  // ── Phase 3: projects ────────────────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=projects]'); await p.waitForTimeout(150);
  ok((await p.$$('.pcard')).length === 4, 'Projects lists 3 active + 1 parked');
  await p.screenshot({ path: shots + '/phone-projects.png', fullPage: true });
  await p.click('.pcard:has-text("Inky")'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Done when…') && await p.isVisible('text=Where I left off'), 'a project page shows Done when and Where I left off');
  ok(await p.isVisible('details[data-panel=checklist]') && await p.isVisible('details[data-panel=links]'), 'its panels follow its kind');
  ok(await p.isVisible('.trow:has-text("Fix the Generate Plan spinner")'), 'its tasks are listed on it');
  await p.fill('details[data-panel=checklist] input', 'Write the release notes'); await p.press('details[data-panel=checklist] input', 'Enter'); await p.waitForTimeout(150);
  ok(await p.isVisible('details[data-panel=checklist] >> text=Write the release notes'), 'adding a checklist item works');
  await p.click('[data-act=projnextdone]'); await p.waitForTimeout(150);
  await p.fill('#pnext', 'Ship the timeout fix'); await p.press('#pnext', 'Enter'); await p.waitForTimeout(150);
  ok(await p.isVisible('.nextcard >> text=Ship the timeout fix'), 'finishing the next step sets a new one');
  ok(await p.isVisible('details[data-panel=log] >> text=Done: Fix the Generate Plan spinner'), 'the finished step is logged on the project');
  await p.click('[data-act=projstart]'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=On your task list for Today'), 'Start puts the next step on today');
  await p.screenshot({ path: shots + '/phone-project.png', fullPage: true });
  await p.click('.back'); await p.click('.pcard:has-text("Apartment")'); await p.waitForTimeout(150);
  await p.fill('details[data-panel=budget] input[name=t]', 'Paint'); await p.fill('details[data-panel=budget] input[name=amt]', '$36.50');
  await p.press('details[data-panel=budget] input[name=amt]', 'Enter'); await p.waitForTimeout(150);
  ok((await p.textContent('details[data-panel=budget] .kvrow')).includes('Total $285.5'), 'budget totals add up (' + (await p.textContent('details[data-panel=budget] .kvrow')) + ')');
  await p.click('.back'); await p.click('[data-act=newproject]'); await p.waitForTimeout(100);
  await p.fill('#npt', 'The Capri'); await p.click('label.chip:has-text("Build")'); await p.click('#sheet button[type=submit]'); await p.waitForTimeout(150);
  ok(await p.isVisible('details[data-panel=budget]') && await p.isVisible('details[data-panel=links]'), 'a new Build project gets build panels');
  await p.click('.back'); await p.waitForTimeout(100);

  // ── Phase 3: journal ─────────────────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=journal]'); await p.waitForTimeout(150);
  ok((await p.getAttribute('#jtext', 'placeholder')).startsWith('Today you:'), 'the journal prompt is built from today\'s log');
  await p.click('[data-act=mood][data-m=good]'); await p.fill('#jtext', 'Shipped the timeout fix.'); await p.waitForTimeout(500);
  ok((await p.$$('.list .row')).length === 3, 'earlier entries are listed');
  await p.screenshot({ path: shots + '/phone-journal.png', fullPage: true });

  // ── Add to iPhone Calendar (tap-to-add .ics links) ───────────────
  await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  await p.fill('#qadd', 'Dentist tomorrow at 2:30pm'); await p.press('#qadd', 'Enter'); await p.waitForTimeout(600);
  const hcpd = await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.t === 'Dentist')[0]);
  if (hcpd) {
    await p.evaluate((id) => { const b = document.createElement('button'); b.dataset.act = 'open'; b.dataset.v = 'task'; b.dataset.id = id; document.getElementById('view').appendChild(b); b.click(); }, hcpd.id);
    await p.waitForTimeout(200);
    const href = await p.getAttribute('.callink', 'href').catch(() => null);
    const want = await p.evaluate((t) => { const s = new Date(t.due + 'T' + t.time + ':00'); return s.toISOString().replace(/\.\d{3}Z$/, 'Z'); }, hcpd);
    const u = href ? new NodeURL(href) : null;
    ok(u && u.host === 'ics.agical.io' && u.searchParams.get('subject') === 'Dentist' && u.searchParams.get('dtstart') === want,
      'a timed task has an Add to Calendar link with its title and UTC start (' + (u && u.searchParams.get('dtstart')) + ')');
    ok(u && u.searchParams.get('dtend') === new Date(new Date(want).getTime() + 30 * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z'), 'the event lasts the task\'s estimate (30 min)');
    ok(await p.getAttribute('.callink', 'target') === '_blank', 'the link opens outside MossOS so iPhone can offer Add to Calendar');
    await p.click('[data-act=back]'); await p.waitForTimeout(150);
  } else ok(false, 'example timed task exists');
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(300);
  const billHref = await p.getAttribute('section.money .calicon >> nth=0', 'href').catch(() => null);
  ok(billHref && new NodeURL(billHref).searchParams.get('reminder') === '1440', 'each bill on Today can go to Calendar, alerting the day before');

  // ── Tomorrow: one planning page ─────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=plan]'); await p.waitForTimeout(200);
  ok((await p.textContent('#top h1')) === 'Tomorrow', 'More opens the Tomorrow planning page');
  const leftTitle = await p.$eval('.planrow .t', (e) => e.childNodes[1] ? e.textContent.trim() : '').catch(() => '');
  const leftId = await p.$eval('.planrow [data-act=planmove][data-to=tomorrow]', (e) => e.dataset.id).catch(() => null);
  ok(!!leftId, 'Left from today lists unfinished tasks with quick moves');
  if (leftId) {
    await p.click('.planrow [data-act=planmove][data-to=tomorrow][data-id="' + leftId + '"]'); await p.waitForTimeout(200);
    ok(await p.isVisible('.trow[data-id="' + leftId + '"], [data-id="' + leftId + '"] >> nth=0') && !(await p.$('.planrow [data-id="' + leftId + '"]')), 'moving it to tomorrow lists it under Tomorrow');
  }
  await p.fill('#planadd', 'Drop off the uniform 7pm'); await p.press('#planadd', 'Enter'); await p.waitForTimeout(500);
  const pa = await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.t === 'Drop off the uniform')[0]);
  const tmw = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  ok(pa && pa.due === tmw && pa.time === '19:00', 'adding on Tomorrow dates it tomorrow and reads the time');
  await p.fill('#planj', 'Long shift but got the PAT practice in'); await p.press('#planj', 'Enter'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.day && /PAT practice in/.test(d.text || ''))), 'the one line about today saves to the journal');
  await p.screenshot({ path: shots + '/phone-tomorrow.png', fullPage: true });

  // ── Phase 3: calendar ────────────────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=calendar]'); await p.waitForTimeout(150);
  ok(await p.isVisible('.cal .day.today'), 'the month grid marks today');
  const tomorrowBtn = await p.$('.cal .day.today + .day');
  if (tomorrowBtn) { await tomorrowBtn.click(); await p.waitForTimeout(100); }
  await p.fill('#caladd', 'Pick up the uniform'); await p.press('#caladd', 'Enter'); await p.waitForTimeout(150);
  ok(await p.isVisible('.card .trow:has-text("Pick up the uniform")'), 'adding a task on a chosen day works');
  await p.click('[data-act=calmode][data-v=week]'); await p.waitForTimeout(150);
  ok(await p.isVisible('.blk:has-text("Pick up the uniform")'), 'the week view shows it as a block');
  await p.screenshot({ path: shots + '/phone-week.png', fullPage: true });

  // ── Phase 3: notes ───────────────────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=notes]'); await p.waitForTimeout(150);
  await p.fill('#nq', 'onboarding'); await p.waitForTimeout(100);
  ok((await p.$$('#notelist .row')).length === 1, 'note search filters as you type');
  await p.fill('#nq', ''); await p.click('[data-act=notef][data-f=idea]'); await p.waitForTimeout(100);
  ok((await p.$$('#notelist .row')).length >= 1, 'the Ideas filter shows sorted ideas');

  // ── Smart capture with Claude: five kinds in one go ──────────────
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(100);
  ok((await p.$$('.jump .jt2')).length === 6, 'Today has one-tap tiles to Habits, Goals, Notes, Projects, Tools, Calendar');
  await p.click('.jump [data-v=goals]'); await p.waitForTimeout(100);
  ok((await p.textContent('#top h1')) === 'Goals', 'a tile opens its section in one tap');
  await p.click('.tabs .cap'); await p.waitForTimeout(100);
  await p.fill('#captext', 'Send the uniform form Friday\ntook Meds\nwatched Inception 9/10\nstart stretching every morning\nIdea: a shift-swap board');
  await p.click('[data-act=capsave]'); await p.waitForTimeout(400);
  const kinds5 = await p.$$eval('#sheet .sugg .meta .pill:first-child', (x) => x.map((e) => e.textContent.trim()));
  ok(kinds5.length === 5 && /Task/.test(kinds5[0]) && /Habit ✓/.test(kinds5[1]) && /Movie/.test(kinds5[2]) && /New habit/.test(kinds5[3]) && /Idea/.test(kinds5[4]),
    'smart capture sorts a task, a habit done, a movie, a new habit and an idea (' + kinds5.join(' | ') + ')');
  await p.screenshot({ path: shots + '/phone-smart.png', fullPage: true });
  ok(!(await p.$('#sheet option[value=goal]')), 'smart capture never offers Goal');
  await p.selectOption('#sheet .sugg >> nth=0 >> select', 'note'); await p.waitForTimeout(100);
  ok(/Note/.test(await p.textContent('#sheet .sugg >> nth=0 >> .meta .pill')), 'changing a suggestion\'s type works');
  await p.selectOption('#sheet .sugg >> nth=0 >> select', 'task'); await p.waitForTimeout(100);
  ok(/Fri/.test(await p.textContent('#sheet .sugg >> nth=0')), 'a day Claude left out is read from the words (Friday)');
  await p.click('[data-act=suggall] >> nth=0'); await p.waitForTimeout(500);
  ok(await p.isVisible('text=Which was better?'), 'filing a movie goes straight into ranking it');
  let guard = 0;
  while (await p.isVisible('text=Which was better?') && guard++ < 8) { await p.click('#sheet .vs >> nth=0'); await p.waitForTimeout(150); }
  ok(!(await p.isVisible('text=Which was better?')) && guard <= 6, 'ranking carries on through everything waiting, about 3 questions each (' + guard + ' asked for 2 movies)');
  const marked = await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.n === 'Meds' && d.marks && Object.keys(d.marks).some((k) => d.marks[k] === 1 && k === new Date().toISOString().slice(0, 10) || 0)));
  const st = await p.evaluate(() => { const v = Object.values(window.__mock.docs); return { stretch: v.some((d) => d.n === 'Stretch'), task: v.some((d) => d.t === 'Send the uniform form Friday'), idea: v.some((d) => d.kind === 'idea' && /shift-swap/.test(d.title)) }; });
  ok(st.stretch && st.task && st.idea, 'the new habit, the task and the idea were all filed');

  // ── Rank ─────────────────────────────────────────────────────────
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(100);
  await p.click('.jump [data-v=tools]'); await p.waitForTimeout(100);
  await p.click('.tool:has-text("Rank")'); await p.click('.row:has-text("Movies")'); await p.waitForTimeout(150);
  const ranked = await p.$$eval('.ranked .rrow .t', (x) => x.map((e) => e.textContent));
  ok(ranked.length === 7 && /Fall Guy|Inception/.test(ranked[0]) && /Fall Guy|Inception/.test(ranked[1]), 'both new movies won every comparison, so they top the list (' + ranked.slice(0, 3).join(', ') + ')');
  await p.click('.rrow:has-text("Fall Guy")'); await p.click('[data-act=rerank]'); await p.waitForTimeout(150);
  while (await p.isVisible('text=Which was better?')) { await p.click('#sheet .vs >> nth=1'); await p.waitForTimeout(120); }
  const last = await p.$$eval('.ranked .rrow .t', (x) => x[x.length - 1].textContent);
  ok(/Fall Guy/.test(last), '"Rank it again" and losing every comparison puts it last (' + last + ')');
  await p.screenshot({ path: shots + '/phone-rank.png', fullPage: true });
  await p.click('.rrow >> nth=1'); await p.click('[data-act=rankmove][data-n="-1"]'); await p.waitForTimeout(100);
  ok((await p.$$eval('.ranked .rrow .t', (x) => x[0].textContent)).length > 0, 'move up works');
  await p.click('.back'); await p.fill('#nrank', 'Burgers'); await p.press('#nrank', 'Enter'); await p.waitForTimeout(150);
  await p.fill('#radd', 'Five Guys'); await p.press('#radd', 'Enter'); await p.waitForTimeout(150);
  await p.fill('#radd', 'In-N-Out'); await p.press('#radd', 'Enter'); await p.waitForTimeout(150);
  await p.click('#sheet .vs >> nth=0'); await p.waitForTimeout(150);
  ok((await p.$$eval('.ranked .rrow .t', (x) => x.map((e) => e.textContent))).join(',') === 'In-N-Out,Five Guys', 'any list can be ranked head-to-head');

  // ── Flashcards, Bored, Gym, Timer ─────────────────────────────────
  await p.click('.back'); await p.click('.back'); await p.click('.tool:has-text("Flashcards")'); await p.click('.row:has-text("Spanish")'); await p.waitForTimeout(150);
  await p.click('[data-act=cardstart]'); await p.waitForTimeout(100);
  await p.click('[data-act=cardshow]'); await p.click('[data-act=cardans][data-ok="1"]'); await p.waitForTimeout(100);
  await p.click('[data-act=cardshow]'); await p.click('[data-act=cardans][data-ok="0"]'); await p.waitForTimeout(100);
  ok(/left/.test(await p.textContent('.flash .small')), 'reviewing: Got it moves on, Again sends the card to the back');
  await p.click('[data-act=cardstop]'); await p.click('.back'); await p.click('.back');
  await p.click('.tool:has-text("Bored")'); await p.click('[data-act=boredgo]'); await p.waitForTimeout(100);
  ok(!/Let it choose/.test(await p.textContent('.flash .q')), 'Bored picks one thing');
  await p.click('.back'); await p.click('.tool:has-text("Gym")'); await p.click('.row:has-text("Bench press")'); await p.waitForTimeout(100);
  ok((await p.inputValue('#lw')) === '135', 'Gym pre-fills last time\'s weight');
  await p.fill('#lw', '140'); await p.click('.liftform button[type=submit]'); await p.waitForTimeout(150);
  ok(/140/.test(await p.textContent('.stats4 > div:first-child b')), 'logging a set updates Last');
  await p.click('.back'); await p.click('.back'); await p.click('.tool:has-text("Focus timer")'); await p.waitForTimeout(100);
  await p.click('[data-act=tgo]'); await p.waitForTimeout(1300);
  ok((await p.textContent('#tclock')) !== '25:00', 'the focus timer counts down');
  await p.click('[data-act=tgo]'); await p.click('[data-act=treset]');

  // ── Bottom bar is yours ─────────────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=settings]'); await p.waitForTimeout(100);
  await p.selectOption('#tab1', 'notes'); await p.waitForTimeout(150);
  ok(await p.isVisible('.tabs [data-v=notes]') && !(await p.isVisible('.tabs [data-v=tasks]')), 'Settings can put Notes in the bottom bar');
  await p.selectOption('#tab1', 'tasks'); await p.waitForTimeout(150);

  // ── Today overview ──────────────────────────────────────────────
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(200);
  const openN = await p.$$eval('#view section:has(h2:text-is("Today")) .trow', (x) => x.length);
  ok(new RegExp('^' + openN + ' tasks? today').test(await p.textContent('.ovcount')), 'the overview count matches today\'s open tasks (' + (await p.textContent('.ovcount')) + ')');
  ok(await p.isVisible('details.donegrp >> text=Completed'), 'a collapsed Completed list holds what\'s done today');
  await p.click('.tabs .cap'); await p.click('[data-act=capkind][data-k=inbox]'); await p.fill('#captext', 'watched Arrival again 10/10'); await p.click('[data-act=capsave]'); await p.waitForTimeout(300);
  await p.click('#view [data-act=sortone] >> nth=0'); await p.waitForTimeout(400);
  ok(/Movie/.test(await p.textContent('#sheet')), 'inbox "sort ›" sorts that one item on the spot');
  await p.click('#sheet [data-act=close]'); await p.waitForTimeout(150);
  // an in-app reminder: due in ~90 minutes, remind 2 hours before
  const target = await p.evaluate(() => { const n = new Date(); return Math.ceil((n.getHours() * 60 + n.getMinutes() + 90) / 5) * 5; });
  if (target < 1435) {
    await p.click('.tabs [data-v=tasks]'); await p.fill('#qadd', 'Reminder probe'); await p.press('#qadd', 'Enter'); await p.waitForTimeout(300);
    await p.click('[data-act=open][aria-label="Open Reminder probe"]'); await p.click('[data-act=taskwhen]'); await p.waitForTimeout(150);
    await p.click('[data-act=wday] >> nth=0'); await p.waitForTimeout(100);
    await p.focus('#ruler'); const steps = Math.round((target - 540) / 5);
    for (let i = 0; i < Math.abs(steps); i++) await p.keyboard.press(steps > 0 ? 'ArrowRight' : 'ArrowLeft');
    await p.click('[data-act=wremind][data-m="120"]'); await p.click('[data-act=wdone]'); await p.waitForTimeout(400);
    await p.click('.back'); await p.click('.tabs [data-v=today]'); await p.waitForTimeout(200);
    ok(/Reminder probe/.test(await p.textContent('.headsup')), 'a reminder shows in Heads up once its window opens');
  } else ok(true, 'reminder check skipped this late in the day');

  // ── Challenges (built on habits) ───────────────────────────────
  await p.click('.tabs [data-v=habits]'); await p.waitForTimeout(200);
  ok(await p.isVisible('.chcard.empty'), 'Habits offers a challenge when there is none');
  await p.click('.chcard.empty'); await p.waitForTimeout(150);
  await p.click('#sheet [data-act=chhab] >> nth=0'); await p.click('#sheet [data-act=chhab] >> nth=1');
  await p.fill('#chdays', '3'); await p.dispatchEvent('#chdays', 'change'); await p.waitForTimeout(100);
  await p.click('#sheet [data-act=chsave]'); await p.waitForTimeout(300);
  ok(await p.$$eval('.wall i', (x) => x.length) === 3, 'a 3-day challenge shows a wall of 3 squares');
  for (let i = 0; i < 4 && await p.$('.hchips .hchip:not(.on)'); i++) { await p.click('.hchips .hchip:not(.on) >> nth=0'); await p.waitForTimeout(200); }
  ok(await p.$eval('.wall i:first-child', (e) => e.className) === 'todaydone', 'doing every habit in it fills today\'s square');
  await p.click('.hchips .hchip.on >> nth=0'); await p.waitForTimeout(200);
  ok(await p.$eval('.wall i:first-child', (e) => e.className) === 'today', 'undoing one of them empties the square again');
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(200);
  ok(/Day 1\/3/.test(await p.textContent('section:has(h2:text("Habits today")) .meta')), 'Today\'s Habits heading shows the challenge day');
  // Strict vs grace, with known history
  await p.evaluate(() => {
    const ymd = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const base = 'data/users/u_test/m/', now = Date.now(), seven = [1, 1, 1, 1, 1, 1, 1];
    const m2 = {}; m2[ymd(-2)] = 1;
    window.__mock.docs[base + 'habits/hA'] = { id: 'hA', ic: '🧊', n: 'Cold shower', color: '#7AA2F7', days: seven, marks: m2, since: ymd(-10), created: now, updated: now };
    window.__mock.docs[base + 'habits/hB'] = { id: 'hB', ic: '🤸', n: 'Stretch', color: '#C39BD3', days: seven, marks: Object.assign({}, m2), since: ymd(-10), created: now, updated: now };
    window.__mock.docs[base + 'challenges/cS'] = { id: 'cS', name: 'Strict test', habits: ['hA', 'hB'], days: 5, mode: 'strict', start: ymd(-2), runs: [], created: now, updated: now };
    window.__mock.docs[base + 'challenges/cG'] = { id: 'cG', name: 'Grace test', habits: ['hA', 'hB'], days: 5, mode: 'grace', start: ymd(-2), runs: [], created: now + 1, updated: now };
  });
  await reloadKeeping(p, ctx);
  await p.click('.tabs [data-v=habits]'); await p.waitForTimeout(200);
  await p.click('.chcard:has-text("Strict test")'); await p.waitForTimeout(200);
  const sc = await p.$$eval('.wall i', (x) => x.map((e) => e.className));
  ok(sc[0] === 'done' && sc[1] === 'miss' && await p.isVisible('.chend'), 'strict: a missed day ends the run and offers a fresh start (' + sc.join(',') + ')');
  await p.click('[data-act=chrestart]'); await p.waitForTimeout(600);
  const cs = await p.evaluate(() => window.__mock.docs['data/users/u_test/m/challenges/cS']);
  ok(cs.runs.length === 1 && cs.runs[0].reached === 1 && !(await p.isVisible('.chend')), 'starting again keeps the old run on record');
  await p.click('[data-act=back]'); await p.waitForTimeout(150);
  await p.click('.chcard:has-text("Grace test")'); await p.waitForTimeout(200);
  const gc = await p.$$eval('.wall i', (x) => x.map((e) => e.className));
  ok(gc[0] === 'done' && gc[1] === 'grace' && !(await p.isVisible('.chend')), 'grace: one miss in a week is forgiven (' + gc.join(',') + ')');
  await p.screenshot({ path: shots + '/phone-challenge.png', fullPage: true });
  await p.click('[data-act=back]'); await p.waitForTimeout(150);
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(200);

  // ── Habit amounts ──────────────────────────────────────────────
  const water = () => p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.n === 'Drink water')[0]);
  ok(/0 \/ 3 L/.test(await p.textContent('.hchip:has-text("Drink water")')), 'an amount habit shows 0 / 3 L');
  await p.click('.hchip:has-text("Drink water")'); await p.waitForTimeout(500);
  ok(/3 \/ 3 L/.test(await p.textContent('.hchip:has-text("Drink water")')) && (await p.$('.hchip.on:has-text("Drink water")')), 'a tap logs the full target and marks it done');
  await p.click('#toast [data-act=undo]'); await p.waitForTimeout(500);
  const chip = await p.$('.hchip:has-text("Drink water")'); const cb = await chip.boundingBox();
  await p.mouse.move(cb.x + 20, cb.y + cb.height / 2); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(200);
  ok(await p.isVisible('#sheet >> text=Fill it'), 'press and hold opens Log some');
  await p.fill('#hamt', '1.5'); await p.press('#hamt', 'Enter'); await p.waitForTimeout(500);
  let w = await water(), td = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  ok(w.amounts[td] === 1.5 && w.marks[td] !== 1 && await p.isVisible('.hchip.part:has-text("Drink water")'), 'logging 1.5 of 3 L is partial, not done');
  await p.click('.tabs [data-v=habits]'); await p.waitForTimeout(150);
  await p.click('.hcard:has-text("Drink water") [data-act=habsome]'); await p.click('#sheet [data-act=habadd] >> nth=1'); await p.waitForTimeout(500);
  w = await water();
  ok(w.amounts[td] === 3 && w.marks[td] === 1, 'logging another 1.5 reaches the target and marks it done (' + w.amounts[td] + ')');

  // ── Watchlist in Rank ───────────────────────────────────────────
  await p.click('.tabs [data-v=today]'); await p.click('.jump [data-v=tools]'); await p.click('.tool:has-text("Rank")'); await p.click('.row:has-text("Movies")'); await p.waitForTimeout(150);
  const ranked0 = (await p.$$('.ranked .rrow')).length;
  await p.fill('#radd', 'Dune: Part Two (2024)'); await p.selectOption('#rstat', 'want'); await p.press('#radd', 'Enter'); await p.waitForTimeout(300);
  ok(!(await p.isVisible('text=Which was better?')) && (await p.$$('.ranked .rrow')).length === ranked0, 'a Want-to-watch movie isn\'t ranked');
  ok(/1 to watch · 0 watching/.test(await p.textContent('#view .small.muted')), 'the watchlist counts are right (' + (await p.textContent('#view .small.muted')) + ')');
  await p.click('[data-act=mtab][data-t=want]'); await p.waitForTimeout(100);
  ok(await p.isVisible('.row:has-text("Dune: Part Two")') && !(await p.$('.ranked')), 'the Want to watch tab shows it, without ranks');
  await p.click('.row:has-text("Dune: Part Two") [data-act=mset][data-s=watched]'); await p.waitForTimeout(250);
  ok(await p.isVisible('text=Which was better?'), 'moving it to Watched starts the comparisons');
  while (await p.isVisible('text=Which was better?')) { await p.click('#sheet .vs >> nth=0'); await p.waitForTimeout(120); }
  await p.click('[data-act=mtab][data-t=all]'); await p.waitForTimeout(100);
  ok((await p.$$('.ranked .rrow')).length === ranked0 + 1, 'and then it\'s ranked');
  await p.click('.tabs .cap'); await p.fill('#captext', 'want to watch Oppenheimer'); await p.click('[data-act=capsave]'); await p.waitForTimeout(400);
  ok(/want to watch/.test(await p.textContent('#sheet .sugg')), 'smart capture puts "want to watch X" on the watchlist');
  await p.click('[data-act=suggall] >> nth=0'); await p.waitForTimeout(300);

  // ── Money: Payday OS in the Money tab ───────────────────────────
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(1500);
  const fin = () => p.frames().find((f) => f !== p.mainFrame());
  ok(!!fin(), 'Payday OS loads in a frame after the first paint');
  const fsum = await fin().evaluate(() => __finSummary());
  ok(fsum && fsum.bills.length > 0, 'Payday answers with its summary (' + (fsum && fsum.bills.length) + ' bills)');
  const todayLeft = await p.textContent('section.money .fin3 button:first-child b');
  ok(todayLeft === '$' + fsum.leftToday, 'Today\'s Money strip shows Payday\'s own allowance (' + todayLeft + ' vs ' + fsum.leftToday + ')');
  ok(await fin().evaluate(() => __finInfo().bridge && __finInfo().sync === 'cloud'), 'the frame uses the page\'s Claude connection and syncs');
  await p.click('section.money [data-act=tab][data-v=money] >> nth=0'); await p.waitForTimeout(400);
  const fbox = await p.evaluate(() => { const r = document.getElementById('fin').getBoundingClientRect(); return { h: r.height, top: r.top, hidden: document.getElementById('fin').hidden }; });
  ok(!fbox.hidden && fbox.h > 400, 'the Money tab shows Payday filling the screen (' + Math.round(fbox.h) + 'px)');
  await p.screenshot({ path: shots + '/phone-money.png' });
  for (const v of ['budget', 'debts', 'savings']) {
    await p.click('[data-fv=' + v + ']'); await p.waitForTimeout(200);
    const cur = await fin().evaluate(() => current);
    const hl = await p.getAttribute('[data-fv=' + v + ']', 'aria-current');
    ok(cur === v && hl === 'page', 'Money nav "' + v + '" switches Payday and highlights itself');
  }
  await p.click('[data-fv=today]'); await p.waitForTimeout(200);
  await p.click('#finnav [data-act=afford]'); await p.waitForTimeout(300);
  await fin().fill('#affAmt', '8'); await fin().dispatchEvent('#affAmt', 'input'); await p.waitForTimeout(150);
  ok(await fin().isVisible('#affSheet') && /fits|Yes|Almost|Not/.test(await fin().textContent('#affOut')), '"Can I afford this?" opens in Money and gives a verdict');
  await fin().evaluate(() => closeAfford());
  // Import a backup made by Payday's own export, with a different pay
  const backup = await fin().evaluate(() => JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), state: { ...state, pay: 1234 }, monarch }));
  await p.click('[data-act=finimport]'); await p.waitForTimeout(150);
  await p.fill('#finpaste', 'not a backup'); await p.click('#sheet [type=submit]'); await p.waitForTimeout(100);
  ok(/isn't a Payday OS backup/.test(await p.textContent('#finmsg')), 'a bad paste is refused with a plain message');
  await p.fill('#finpaste', backup); await p.click('#sheet [type=submit]'); await p.waitForTimeout(1200);
  ok(await fin().evaluate(() => state.pay) === 1234, 'importing a Payday OS backup replaces the plan');
  ok(!(await p.isVisible('[data-act=finhideimport]')), 'the import card goes away once imported');
  const payDoc = await p.evaluate(() => window.__mock.docs['data/users/u_test/state']);
  ok(payDoc && payDoc.pay === 1234, 'the imported plan syncs to this artifact\'s database');
  // Calendar: paydays and bills
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=calendar]'); await p.waitForTimeout(200);
  await p.click('[data-act=calmode][data-v=month]'); await p.waitForTimeout(150);
  ok((await p.$$('.cal .dots i.fin.pay')).length >= 4 && (await p.$$('.cal .dots i.fin.bill')).length >= 1, 'the calendar shows payday and bill marks');
  ok(await p.evaluate(() => document.getElementById('fin').hidden), 'the frame hides when you leave Money');
  // Smart capture: spent
  const ql0 = await fin().evaluate(() => state.quickLog.length);
  await p.click('.tabs .cap'); await p.waitForTimeout(100);
  await p.fill('#captext', 'spent $12 at Wawa'); await p.click('[data-act=capsave]'); await p.waitForTimeout(400);
  ok(/Spent/.test(await p.textContent('#sheet .sugg .meta .pill:first-child')), 'capture sorts "spent $12 at Wawa" as Spent');
  await p.click('#sheet [data-act=suggone]'); await p.waitForTimeout(200);
  const ql = await fin().evaluate(() => state.quickLog.slice(-1)[0]);
  ok(await fin().evaluate(() => state.quickLog.length) === ql0 + 1 && ql.amt === 12 && /Wawa/.test(ql.merchant), 'it lands in Payday\'s purchase log (' + JSON.stringify(ql) + ')');
  if (await p.isVisible('#sheetbg')) await p.keyboard.press('Escape');
  // Second pass: groceries, more screens, Heads up
  await p.click('.tabs .cap'); await p.waitForTimeout(100);
  await p.fill('#captext', 'add eggs and milk to the grocery list'); await p.click('[data-act=capsave]'); await p.waitForTimeout(400);
  ok(/Grocery list/.test(await p.textContent('#sheet .sugg .meta .pill:first-child')), 'capture sorts "add eggs and milk to the grocery list" as Grocery list');
  await p.click('#sheet [data-act=suggone]'); await p.waitForTimeout(200);
  if (await p.isVisible('#sheetbg')) await p.keyboard.press('Escape');
  const gx = await fin().evaluate(() => state.grocExtra.map((x) => x[1]));
  ok(gx.includes('Eggs') && gx.includes('Milk'), 'both items land on Payday\'s grocery list (' + gx.join(', ') + ')');
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=money]'); await p.waitForTimeout(300);
  await p.click('[data-fv=food]'); await p.waitForTimeout(300);
  ok(await fin().evaluate(() => current) === 'food' && await p.isVisible('[data-act=fingroctask]'), 'Groceries opens Payday\'s grocery screen with a send-to-Tasks bar');
  const nG = await fin().evaluate(() => __finGroceries().length);
  await p.click('[data-act=fingroctask]'); await p.waitForTimeout(600);
  const run = await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.grocery && !d.done)[0]);
  ok(run && run.t === 'Grocery run' && run.steps.length === nG && run.steps.some((x) => /Eggs/.test(x.t)), 'the shopping list becomes a "Grocery run" task, one step per item (' + (run && run.steps.length) + '/' + nG + ')');
  await p.click('[data-act=fingroctask]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.grocery && !d.done).length) === 1, 'sending again updates the same task instead of adding another');
  await p.click('[data-act=finmore]'); await p.waitForTimeout(150);
  const moreItems = await p.$$eval('#sheet [data-act=fingoto]', (x) => x.map((e) => e.dataset.fv));
  ok(['roadmap', 'data', 'sort', 'future'].every((v) => moreItems.includes(v)), 'More in Money lists Roadmap, Spending, Sort purchases and What if');
  await p.click('#sheet [data-fv=roadmap]'); await p.waitForTimeout(300);
  ok(await fin().evaluate(() => current) === 'roadmap' && /Roadmap/.test(await p.textContent('#finmorebtn')) && await p.$eval('#finmorebtn', (e) => e.classList.contains('on')), 'picking Roadmap opens it and the More chip names it');
  ok(await fin().isVisible('#rmHero .display'), 'the Roadmap shows a debt-free date');
  for (const v of ['future', 'data', 'sort']) {
    await p.click('[data-act=finmore]'); await p.waitForTimeout(100); await p.click('#sheet [data-fv=' + v + ']'); await p.waitForTimeout(250);
    ok(await fin().evaluate(() => current) === v, 'More → ' + v + ' opens it');
  }
  await p.screenshot({ path: shots + '/phone-money-sort.png' });
  // A wishlist item whose 72 hours are up shows in Heads up
  await fin().evaluate(() => { state.wish.unshift({ id: 'w1', name: 'PS6 controller', amt: 79, kind: 'fun', at: Date.now() - 73 * 36e5 }); persist(); rerender(); });
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(700);
  ok(await p.isVisible('.headsup >> text=PS6 controller'), 'a wishlist item past 72 hours shows in Heads up');
  ok(await p.isVisible('.finline'), 'Today\'s Money section shows the next card to go');

  // ── Books ───────────────────────────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=books]'); await p.waitForTimeout(200);
  ok(await p.isVisible('#bkt'), 'Books starts with a way to add the book you\'re reading');
  await p.fill('#bkt', 'Atomic Habits'); await p.fill('#bka', 'James Clear'); await p.fill('#bkp', '320');
  await p.click('form[data-form=addbook] [type=submit]'); await p.waitForTimeout(300);
  ok((await p.textContent('#top h1')) === 'Atomic Habits', 'adding a book opens its page');
  await p.fill('#bkpg', '40'); await p.press('#bkpg', 'Enter'); await p.waitForTimeout(300);
  const pace = await p.textContent('#bkpace');
  ok(/p\. 40/.test(await p.textContent('.bigpage')) && /13%/.test(await p.textContent('.bigpage')) && /40 pages a day/.test(pace) && /finish around/.test(pace),
    'logging a page shows progress, pace and a finish date (' + pace.trim() + ')');
  await p.click('[data-act=bookadd][data-n="20"]'); await p.waitForTimeout(250);
  ok(/p\. 60/.test(await p.textContent('.bigpage')), '+20 pages moves it on');
  await p.fill('#bkn', 'You do not rise to the level of your goals. You fall to the level of your systems.'); await p.fill('#bknp', '27');
  await p.click('form[data-form=booknote] [type=submit]'); await p.waitForTimeout(500);
  ok(await p.isVisible('.t.quote:has-text("fall to the level of your systems")'), 'a quote is kept with the book');
  await p.click('[data-act=bookai][data-k=recap]'); await p.waitForTimeout(400);
  const bp = await p.evaluate(() => window.__mock.sampleCalls.slice(-1)[0] || '');
  ok(/page 60/.test(bp) && /No spoilers past page 60/.test(bp) && /say so plainly/.test(bp), 'the companion is told your page and not to spoil or guess');
  ok(await p.isVisible('#sheet .aitext'), 'the recap shows in a sheet');
  await p.click('[data-act=booksaveai]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.kind === 'thought' && /Claude on Atomic Habits/.test(d.title || ''))), 'a companion answer can be saved as a note');
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=notes]'); await p.waitForTimeout(200);
  await p.fill('#nq', 'level of your systems'); await p.waitForTimeout(200);
  ok(await p.isVisible('#notelist .row:has-text("Atomic Habits p. 27")'), 'the quote shows up in Notes search, tagged with the book and page');
  await p.fill('#nq', ''); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(300);
  await p.click('.tabs .cap'); await p.waitForTimeout(100);
  await p.fill('#captext', 'read 20 pages of Atomic Habits'); await p.click('[data-act=capsave]'); await p.waitForTimeout(400);
  ok(/Reading/.test(await p.textContent('#sheet .sugg .meta .pill:first-child')), 'capture sorts "read 20 pages of Atomic Habits" as Reading');
  await p.click('#sheet [data-act=suggone]'); await p.waitForTimeout(500);
  if (await p.isVisible('#sheetbg')) await p.keyboard.press('Escape');
  ok(await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.title === 'Atomic Habits')[0].page) === 80, 'filing it moves the book to page 80');
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=books]'); await p.waitForTimeout(200);
  await p.screenshot({ path: shots + '/phone-books.png', fullPage: true });
  await p.click('.bookcard'); await p.waitForTimeout(200);
  await p.screenshot({ path: shots + '/phone-book.png', fullPage: true });

  // ── Shifts ──────────────────────────────────────────────────────
  const ymdIn = (n) => p.evaluate((n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }, n);
  const shiftDocs = () => p.evaluate(() => Object.keys(window.__mock.docs).filter((k) => k.indexOf('/m/shifts/') > -1).map((k) => window.__mock.docs[k]));
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=shifts]'); await p.waitForTimeout(200);
  ok((await p.textContent('#top h1')) === 'Shifts' && (await p.$$('.shday')).length === 7, 'Shifts shows a 7-day week grid');
  const tdy = await ymdIn(0);
  await p.click('.shday.today .shd'); await p.waitForTimeout(150);
  await p.click('#sheet [data-act=shadd][data-p=p1]'); await p.waitForTimeout(500);
  let sd = await shiftDocs();
  ok(sd.some((x) => x.date === tdy && x.job === 'icare' && x.start === '07:00' && x.end === '19:00'), 'tapping a day and "Truck day" adds a 7a–7p iCare shift');
  await p.click('.shday:not(.today) .shd >> nth=0'); await p.waitForTimeout(150);
  await p.click('#sheet [data-act=shcustom]'); await p.waitForTimeout(150);
  await p.focus('#rs1'); for (let i = 0; i < 6; i++) await p.keyboard.press('ArrowRight');
  await p.click('#sheet [data-act=shcsave]'); await p.waitForTimeout(500);
  sd = await shiftDocs();
  ok(sd.some((x) => x.start === '07:30' && x.end === '19:00'), 'a custom shift set with the time ruler saves 7:30a–7p');
  await p.click('[data-act=shweek][data-n="7"]'); await p.waitForTimeout(150);
  const before = (await shiftDocs()).length;
  await p.click('[data-act=shcopy]'); await p.waitForTimeout(500);
  const copied = (await shiftDocs()).length - before;
  ok(copied === before && copied >= 2, 'Copy last week fills next week (' + copied + ' shifts)');
  await p.click('#toast [data-act=undo]'); await p.waitForTimeout(500);
  ok((await shiftDocs()).length === before, 'undo removes the copied shifts');
  // Hours and the estimated check: two 7 h Safeway closes at $20.50
  await p.evaluate(() => {
    const pad = (n) => String(n).padStart(2, '0'), ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const base = 'data/users/u_test/m/shifts/'; Object.keys(window.__mock.docs).filter((k) => k.indexOf(base) === 0).forEach((k) => delete window.__mock.docs[k]);
    const fri = new Date(); fri.setDate(fri.getDate() - ((fri.getDay() - 5 + 7) % 7)); const sat = new Date(fri); sat.setDate(sat.getDate() + 1);
    [[fri, 'sw1'], [sat, 'sw2']].forEach((x) => { window.__mock.docs[base + x[1]] = { id: x[1], date: ymd(x[0]), job: 'safeway', start: '01:00', end: '08:00', worked: null, note: '', created: 1, updated: 1 }; });
  });
  await reloadKeeping(p, ctx);
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=shifts]'); await p.waitForTimeout(200);
  const hc = await p.textContent('.hourscard');
  ok(/14 h × \$20\.50 = \$287 gross/.test(hc) && /~\$230/.test(hc), 'the pay week shows 14 h, $287 gross and ~$230 take-home at 80% (' + hc.replace(/\s+/g, ' ').slice(0, 120) + ')');
  await p.screenshot({ path: shots + '/phone-shifts.png', fullPage: true });
  // Pre-shift checklist, wind-down, and protecting off days
  await p.evaluate(() => {
    const pad = (n) => String(n).padStart(2, '0'), ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
    const base = 'data/users/u_test/m/shifts/'; Object.keys(window.__mock.docs).filter((k) => k.indexOf(base) === 0).forEach((k) => delete window.__mock.docs[k]);
    const now = Date.now(), put = (id, o) => { window.__mock.docs[base + id] = Object.assign({ id: id, worked: null, note: '', created: 1, updated: 1 }, o); };
    const ps = new Date(now + 60 * 60000); ps.setMinutes(Math.ceil(ps.getMinutes() / 5) * 5, 0, 0); const pe = new Date(ps.getTime() + 8 * 36e5);
    put('pre', { date: ymd(ps), job: 'icare', start: hm(ps), end: hm(pe) });
    const ws = new Date(now - 9 * 36e5), we = new Date(now - 60 * 60000); ws.setSeconds(0, 0); we.setSeconds(0, 0);
    put('post', { date: ymd(ws), job: 'icare', start: hm(ws), end: hm(we) });
    const tm = new Date(now); tm.setDate(tm.getDate() + 1); put('tom', { date: ymd(tm), job: 'icare', start: '09:00', end: '17:00' });
    window.__mock.docs['data/users/u_test/m/inbox/ishift'] = { id: 'ishift', text: 'radio check idea for the unit', created: now - 2 * 36e5, updated: now - 2 * 36e5 };
  });
  await reloadKeeping(p, ctx);
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(300);
  ok(await p.isVisible('.shcard.pre'), 'an hour before a shift, Today shows the pre-shift checklist');
  for (let i = 0; i < 8 && await p.$('.shcard.pre .ckrow:not(.on)'); i++) { await p.click('.shcard.pre .ckrow:not(.on) >> nth=0'); await p.waitForTimeout(150); }
  ok(await p.isVisible('.shcard.pre .ready'), 'ticking every item shows Ready ✓');
  ok(await p.isVisible('.shcard.post') && /Sort 1 captured on shift/.test(await p.textContent('.shcard.post')), 'after a shift, Today shows the wind-down with what you captured on shift');
  const moodNow = await p.evaluate((t) => (window.__mock.docs['data/users/u_test/m/journal/j' + t] || {}).mood || null, tdy);
  const pickMood = moodNow === 'low' ? 'ok' : 'low';
  await p.click('.shcard.post [data-act=shmood][data-m=' + pickMood + ']'); await p.waitForTimeout(600);
  const tj = await p.evaluate((t) => window.__mock.docs['data/users/u_test/m/journal/j' + t], tdy);
  ok(tj && tj.mood === pickMood, 'the wind-down mood saves to today\'s journal');
  await p.screenshot({ path: shots + '/phone-shiftcards.png', fullPage: true });
  await p.click('.shcard.post [data-act=shwound]'); await p.waitForTimeout(200);
  ok(!(await p.isVisible('.shcard.post')), 'Done puts the wind-down away');
  // A big task on a shift day gets offered the next off day
  const offDay = await p.evaluate(() => {
    const pad = (n) => String(n).padStart(2, '0'), ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const busy = Object.keys(window.__mock.docs).filter((k) => k.indexOf('/m/shifts/') > -1).map((k) => window.__mock.docs[k].date);
    const d = new Date(); d.setDate(d.getDate() + 2); while (busy.indexOf(ymd(d)) > -1) d.setDate(d.getDate() + 1); return ymd(d);
  });
  await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  await p.fill('#qadd', 'Study the PAT packet tomorrow 60 min'); await p.press('#qadd', 'Enter'); await p.waitForTimeout(300);
  ok(/shift day/.test(await p.textContent('#toast')) && /Move to/.test(await p.textContent('#toast [data-act=undo]')), 'adding a 60-min task on a shift day offers to move it');
  await p.click('#toast [data-act=undo]'); await p.waitForTimeout(500);
  const pat = await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.t === 'Study the PAT packet')[0]);
  ok(pat && pat.est === '60 min' && pat.due === offDay, 'Move puts it on the next off day (' + (pat && pat.due) + ' vs ' + offDay + ')');
  // Calendar
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=calendar]'); await p.waitForTimeout(200);
  await p.click('[data-act=calmode][data-v=month]'); await p.waitForTimeout(150);
  ok((await p.$$('.cal .shbar')).length >= 1, 'the month grid marks shift days');
  const tmY = await ymdIn(1);
  if (await p.$('.cal .day[data-d="' + tmY + '"]')) { await p.click('.cal .day[data-d="' + tmY + '"]'); await p.waitForTimeout(150); }
  else { await p.click('[data-act=calnav][data-n="1"]'); await p.waitForTimeout(100); await p.click('.cal .day[data-d="' + tmY + '"]'); await p.waitForTimeout(150); }
  const shHref = await p.getAttribute('.billrow:has([data-v=shift]) .calicon', 'href').catch(() => null);
  ok(shHref && new NodeURL(shHref).searchParams.get('reminder') === '90', 'the day panel lists the shift with an Add to Calendar link alerting 90 min before');
  await p.click('[data-act=calmode][data-v=week]'); await p.waitForTimeout(150);
  ok((await p.$$('.blk.shiftblk')).length >= 1, 'the week view shows shift blocks');
  await p.click('[data-act=calmode][data-v=month]'); await p.waitForTimeout(100);

  // Every screen: no sideways scrolling
  const views = ['plan', 'shifts', 'books', 'notes', 'tools', 'ranks', 'decks', 'bored', 'gym', 'timer','today', 'tasks', 'more', 'areas', 'inbox', 'notes', 'settings', 'money', 'habits', 'goals', 'projects', 'journal', 'calendar'];
  let wide = [];
  for (const v of views) {
    await p.evaluate((v) => { document.querySelector('[data-act=tab][data-v="' + v + '"]') ? document.querySelector('[data-act=tab][data-v="' + v + '"]').click() : null; }, v);
    await p.waitForTimeout(120);
    const w = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (w > 1) wide.push(v + ' +' + w);
  }
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=areas]'); await p.click('.abig >> nth=1'); await p.waitForTimeout(150);
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

  // ── someone who started on phase 1 gets habits and goals ─────────
  ctx = await b.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('__mockdb')) return;
    const base = 'data/users/u_test/m/';
    sessionStorage.setItem('__mockdb', JSON.stringify({
      [base + 'meta/setup']: { id: 'setup', examples: true },
      [base + 'areas/gym']: { id: 'gym', name: 'Gym', short: 'Gym', color: '#F08A4B', state: 'On track', order: 1 },
      [base + 'tasks/t1']: { id: 't1', t: 'My real task', due: null, done: false, steps: [] }
    }));
  });
  await ctx.addInitScript(mock); // after the planted data, so the fake db loads it
  p = await ctx.newPage(); watch(p, 'upgrade');
  await p.goto(URL); await p.waitForTimeout(700);
  ok((await p.$$('.hchip')).length === 6, 'a phase-1 user with examples gets example habits');
  const kept = await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.t === 'My real task'));
  ok(kept, 'and their own data is untouched');
  await p.screenshot({ path: shots + '/phone-today-dark.png', fullPage: true });
  await ctx.close();

  // ── A save that never reached the server is re-sent next launch ──
  // Timing-sensitive in headless Chromium: localStorage writes reach shared
  // storage lazily, so a relaunch can read the copy from a moment before.
  // Up to 3 attempts in a fresh browser each; a real break fails all three.
  async function outboxAttempt(n) {
    const bx = await chromium.launch(), cx = await bx.newContext({ ...devices['iPhone 13'] });
    await cx.addInitScript(mock);
    let pg = await cx.newPage(); watch(pg, 'outbox');
    await pg.goto(URL); await pg.waitForTimeout(1500);
    const title = 'Written just before the app was suspended ' + n;
    await pg.evaluate(() => sessionStorage.setItem('__mockDrop', '1'));
    await pg.click('.tabs .cap'); await pg.fill('#captext', title);
    await pg.click('[data-act=capkind][data-k=task]'); await pg.click('[data-act=capsave]'); await pg.waitForTimeout(500);
    const lost = await pg.evaluate((t) => !Object.values(window.__mock.docs).some((d) => d.t === t), title);
    await pg.evaluate(() => sessionStorage.removeItem('__mockDrop'));
    await pg.waitForTimeout(1500);
    await pg.reload();
    const back = await pg.waitForFunction((t) => Object.values(window.__mock.docs).some((d) => d.t === t), title, { timeout: 6000 }).then(() => true, () => false);
    await bx.close();
    return lost && back;
  }
  let obOk = false, obTries = 0;
  while (!obOk && obTries < 3) { obTries++; obOk = await outboxAttempt(obTries); }
  ok(obOk, 'an edit the server never received is kept and re-sent on the next launch' + (obTries > 1 ? ' (attempt ' + obTries + ' of 3; headless Chromium storage timing)' : ''));

  // ── Opening after a while lands in Quick capture ─────────────────
  ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(mockRaw);
  p = await ctx.newPage(); watch(p, 'quick');
  await p.goto(URL); await p.waitForTimeout(900);
  ok(await p.isVisible('#sheet h2:has-text("Quick capture")'), 'opening MossOS lands in Quick capture');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'captext'), 'the cursor is already in the box');
  await p.fill('#captext', 'ask Dana about the overtime list'); await p.press('#captext', 'Enter'); await p.waitForTimeout(800);
  ok(await p.isHidden('#sheetbg') && await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.text === 'ask Dana about the overtime list')), 'Enter saves it to the inbox and closes');
  await p.reload(); await p.waitForTimeout(900);
  ok(await p.isHidden('#sheetbg'), 'reopening within 10 minutes goes straight to Today');
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=settings]'); await p.waitForTimeout(150);
  await p.click('[data-act=setopen][data-v=today]'); await p.waitForTimeout(500);
  await p.evaluate(() => localStorage.setItem('mossos.lastSeen', '1'));
  await reloadKeeping(p, ctx); await p.waitForTimeout(400);
  ok(await p.isHidden('#sheetbg'), 'Settings → Opens to Today turns it off');
  await ctx.close();

  // ── plain browser, no window.claude ───────────────────────────────
  ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(seenNow);
  p = await ctx.newPage(); watch(p, 'local');
  await p.goto(URL); await p.waitForTimeout(500);
  // Smart capture still sorts without Claude, by rules.
  await p.click('.tabs .cap'); await p.waitForTimeout(100);
  await p.fill('#captext', 'watched Heat 9/10\ntook meds\nsent the revised invoice to Sam\nfeeling wiped after the shift\nstart flossing every night\ncall the recruiter tomorrow');
  await p.click('[data-act=capsave]'); await p.waitForTimeout(300);
  const offl = await p.$$eval('#sheet .sugg .meta .pill:first-child', (x) => x.map((e) => e.textContent.trim()));
  ok(/Movie/.test(offl[0]) && /Habit ✓/.test(offl[1]) && /Done/.test(offl[2]) && /Journal/.test(offl[3]) && /New habit/.test(offl[4]) && /Task/.test(offl[5]),
    'without Claude, rules still sort movie / habit done / task done / journal / new habit / task (' + offl.join(' | ') + ')');
  ok(/Tomorrow/.test(await p.textContent('#sheet .sugg >> nth=5')), 'and pick up "tomorrow" as the day');
  await p.click('[data-act=suggall] >> nth=0'); await p.waitForTimeout(300);
  if (await p.isVisible('text=Which was better?')) await p.click('[data-act=rankstop]');
  await p.click('.tabs .cap'); await p.fill('#captext', 'want to watch Oppenheimer\nwatching Severance'); await p.click('[data-act=capsave]'); await p.waitForTimeout(300);
  const wl = await p.$$eval('#sheet .sugg .t', (x) => x.map((e) => e.textContent));
  ok(/Oppenheimer · want to watch/.test(wl[0]) && /Severance · watching/.test(wl[1]), 'rules spot watchlist and watching without Claude (' + wl.join(' | ') + ')');
  await p.click('[data-act=suggall] >> nth=0'); await p.waitForTimeout(300);
  if (await p.isVisible('text=Which was better?')) await p.click('[data-act=rankstop]');
  ok(await p.isVisible('text=This device'), 'without Claude it runs on this device');
  ok(await p.isVisible('.play'), 'and still seeds its examples');
  ok(await p.isDisabled('[data-act=breakdown]').catch(() => true), 'Claude-only buttons are off when Claude is absent');
  await ctx.close();

  await b.close();
  ok(!errs.length, 'no page errors ' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : ''));
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
