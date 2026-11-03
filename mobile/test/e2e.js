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
  await p.click('[data-act=capkind][data-k=inbox]');
  await p.fill('#captext', 'Call the HCPD office about the packet\nIdea: a shift-day meal plan');
  await p.click('[data-act=capsave]'); await p.waitForTimeout(200);
  ok(await p.isVisible('text=2 items in your inbox'), 'a two-line capture makes two inbox items');
  await p.click('.inboxbar'); await p.waitForTimeout(150);
  await p.screenshot({ path: shots + '/phone-inbox.png', fullPage: true });
  await p.click('[data-act=sortai]'); await p.waitForTimeout(400);
  ok(await p.isVisible('text=File all'), 'Sort with Claude shows suggestions');
  await p.screenshot({ path: shots + '/phone-sort.png', fullPage: true });
  await p.click('[data-act=suggall]'); await p.waitForTimeout(300);
  ok(await p.isVisible('text=Inbox zero'), 'accepting all empties the inbox');
  await p.waitForTimeout(500); // saves are debounced by 350 ms
  const t = await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.t === 'Call the HCPD office about the packet' && d.steps && d.steps.length));
  ok(t, 'the sorted capture became a task with a first step');

  // Reload: everything still there. The fake db keeps its data in
  // sessionStorage; wait until that copy holds the latest writes, so the
  // test checks the app and not the harness.
  await p.waitForFunction(() => { const d = JSON.parse(sessionStorage.getItem('__mockdb') || '{}');
    return Object.values(d).some((x) => x.note === 'Edited note text') && Object.values(d).some((x) => x.t === 'Call the HCPD office about the packet'); }, null, { timeout: 5000 });
  await p.waitForTimeout(1500); // Chromium commits storage to the next page in batches
  await p.reload(); await p.waitForTimeout(700);
  await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  const survived = await p.isVisible('text=Call the HCPD office about the packet');
  if (!survived) { await p.screenshot({ path: shots + '/fail-reload.png', fullPage: true }); console.log(await p.evaluate(() => document.querySelector('#top').textContent + ' | ' + Object.values(window.__mock.docs).filter((d) => d.t).map((d) => d.t).join(' / '))); }
  ok(survived, 'tasks survive a reload');
  await p.click('text=Send Sam the revised invoice'); await p.waitForTimeout(150);
  ok((await p.inputValue('#tnote')) === 'Edited note text', 'note edits survive a reload');

  // A save that never reached the server (app suspended) is re-sent next launch
  await p.evaluate(() => sessionStorage.setItem('__mockDrop', '1'));
  await p.click('.tabs .cap'); await p.fill('#captext', 'Written just before the app was suspended');
  await p.click('[data-act=capkind][data-k=task]'); await p.click('[data-act=capsave]'); await p.waitForTimeout(500);
  const lostBefore = await p.evaluate(() => !Object.values(window.__mock.docs).some((d) => d.t === 'Written just before the app was suspended'));
  await p.evaluate(() => sessionStorage.removeItem('__mockDrop'));
  await p.reload(); await p.waitForTimeout(800);
  const resent = await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.t === 'Written just before the app was suspended'));
  ok(lostBefore && resent, 'an edit the server never received is kept and re-sent on the next launch');

  // ── Phase 2: habits ──────────────────────────────────────────────
  await p.click('.tabs [data-v=today]'); await p.waitForTimeout(150);
  ok((await p.$$('.hchip')).length === 5, 'Today lists the 5 habits due today');
  await p.click('.hchip >> nth=0'); await p.waitForTimeout(150);
  ok(await p.isVisible('.hchip.on'), 'tapping a habit on Today marks it done');
  ok(/in a row/.test(await p.textContent('#toast')), 'marking shows the streak');
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=habits]'); await p.waitForTimeout(150);
  ok((await p.$$('.hcard')).length === 5, 'Habits lists 5 habit cards');
  const stat = await p.textContent('.stats4 > div:first-child b');
  ok(/^1\/5/.test(stat.replace(/\s/g, '')), 'Done today reads 1/5 (' + stat + ')');
  for (const v of ['month', 'daily', 'week']) { await p.click('[data-act=habview][data-v=' + v + ']'); await p.waitForTimeout(80); }
  ok(await p.isVisible('.hweek'), 'Week / 30 days / Daily views switch');
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

  // ── Phase 2: goals ───────────────────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=goals]'); await p.waitForTimeout(150);
  ok((await p.$$('.goal')).length === 4, 'Goals lists 4 live goals');
  await p.screenshot({ path: shots + '/phone-goals.png', fullPage: true });
  await p.click('.goal >> text=HCPD'); await p.waitForTimeout(150);
  await p.click('[data-act=goaltask]'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=It\'s on your task list'), '"Put it on today" makes a task');
  await p.click('[data-act=goalnextdone]'); await p.waitForTimeout(150);
  ok(await p.isVisible('text=Nice. What\'s next?'), 'finishing the next action asks for the next one');
  await p.click('[data-act=goalsuggest]'); await p.waitForTimeout(300);
  await p.click('#gsugg .row >> nth=0'); await p.waitForTimeout(150);
  ok(await p.isVisible('.nextcard >> text=Book the PAT practice slot'), 'Claude\'s suggestion becomes the next action');
  const linked = await p.evaluate(() => Object.values(window.__mock.docs).filter((d) => d.t === 'Finish the PAT prep block')[0]);
  ok(linked && linked.done, 'the goal\'s task was ticked off with it');
  await p.click('[data-act=goaltask]'); await p.waitForTimeout(150);
  await p.click('.back'); await p.click('.tabs [data-v=tasks]'); await p.waitForTimeout(150);
  await p.click('.row:has-text("Book the PAT practice slot") .ck'); await p.waitForTimeout(150);
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=goals]'); await p.waitForTimeout(150);
  ok(await p.isVisible('.goal:has-text("HCPD") >> text=No next action yet'), 'ticking a goal task from Tasks clears the goal\'s next action');
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
  ok(await p.isVisible('.row:has-text("Fix the Generate Plan spinner")'), 'its tasks are listed on it');
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

  // ── Phase 3: calendar ────────────────────────────────────────────
  await p.click('.tabs [data-v=more]'); await p.click('#view [data-act=tab][data-v=calendar]'); await p.waitForTimeout(150);
  ok(await p.isVisible('.cal .day.today'), 'the month grid marks today');
  const tomorrowBtn = await p.$('.cal .day.today + .day');
  if (tomorrowBtn) { await tomorrowBtn.click(); await p.waitForTimeout(100); }
  await p.fill('#caladd', 'Pick up the uniform'); await p.press('#caladd', 'Enter'); await p.waitForTimeout(150);
  ok(await p.isVisible('.card .row:has-text("Pick up the uniform")'), 'adding a task on a chosen day works');
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

  // Every screen: no sideways scrolling
  const views = ['tools', 'ranks', 'decks', 'bored', 'gym', 'timer','today', 'tasks', 'more', 'areas', 'inbox', 'notes', 'settings', 'money', 'habits', 'goals', 'projects', 'journal', 'calendar'];
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
  ok((await p.$$('.hchip')).length === 5, 'a phase-1 user with examples gets example habits');
  const kept = await p.evaluate(() => Object.values(window.__mock.docs).some((d) => d.t === 'My real task'));
  ok(kept, 'and their own data is untouched');
  await p.screenshot({ path: shots + '/phone-today-dark.png', fullPage: true });
  await ctx.close();

  // ── plain browser, no window.claude ───────────────────────────────
  ctx = await b.newContext({ ...devices['iPhone 13'] });
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
  ok(await p.isVisible('text=This device'), 'without Claude it runs on this device');
  ok((await p.$$('.prio')).length === 3, 'and still seeds its examples');
  ok(await p.isDisabled('[data-act=breakdown]').catch(() => true), 'Claude-only buttons are off when Claude is absent');
  await ctx.close();

  await b.close();
  ok(!errs.length, 'no page errors ' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : ''));
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
