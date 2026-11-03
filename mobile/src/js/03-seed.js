/* ═══ FIRST-RUN DATA ═════════════════════════════════════════════════
   Areas come from the Inky Desktop Status design and are real defaults
   (editable). Everything else is marked `example: true` and can be
   cleared in one tap from Today or Settings. */
var AREA_STATES = ['On track', 'Needs you', 'Blocked', 'Paused', 'Planned'];
var DEFAULT_AREAS = [
  { id: 'work', name: 'EMS · iCare', short: 'Work', color: '#5B9BF5', state: 'On track', focus: 'Shifts covered this week', next: '', open: '', order: 1 },
  { id: 'hcpd', name: 'HCPD', short: 'HCPD', color: '#E2B64B', state: 'Needs you', focus: 'Next application step', next: '', open: '', order: 2 },
  { id: 'gym', name: 'Gym', short: 'Gym', color: '#F08A4B', state: 'On track', focus: 'Academy prep block', next: '', open: 'Run 3× this week', order: 3 },
  { id: 'inky', name: 'Inky', short: 'Inky', color: '#A78BFA', state: 'Blocked', focus: 'AI fix before new UI', next: '', open: 'Generate Plan hang', order: 4 },
  { id: 'school', name: 'School', short: 'School', color: '#3CC4B4', state: 'Paused', focus: 'Sitting out fall term', next: '', open: 'Re-enroll steps', order: 5 },
  { id: 'partner', name: 'Partner', short: 'Partner', color: '#F27BA8', state: 'Planned', focus: 'Protected time this week', next: '', open: '', order: 6 },
  { id: 'money', name: 'Money', short: 'Money', color: '#5FCF8E', state: 'On track', focus: 'Friday pay plan', next: '', open: '', order: 7 }
];

function seedData() {
  var t = today();
  DEFAULT_AREAS.forEach(function (a) { if (!Store.get('areas', a.id)) Store.put('areas', Object.assign({}, a), true); });
  var tasks = [
    { ic: '🚔', t: 'Next HCPD application step', area: 'hcpd', due: t, prio: 'P1', prioDay: t, est: '30 min', note: 'Check the portal first. One step, not the whole packet.' },
    { ic: '🏋️', t: 'Leg day', area: 'gym', due: t, prio: 'P2', prioDay: t, est: '60 min', done: true, doneAt: Date.now() - 36e5 },
    { ic: '🐞', t: 'Fix the Generate Plan spinner', area: 'inky', due: t, prio: 'P2', prioDay: t, est: '1 hour', note: 'It hangs when the AI call times out. Show the error instead of spinning forever.',
      steps: [{ t: 'Reproduce with the network throttled', done: true }, { t: 'Add a 20 s timeout', done: false }, { t: 'Show "try again" on failure', done: false }] },
    { ic: '📮', t: 'Send Sam the revised invoice', area: 'money', due: t, est: '10 min', note: 'It is already written. It just needs attaching.' },
    { ic: '🦷', t: 'Schedule a dentist checkup', area: null, due: addDays(t, 1), est: '5 min', note: 'One phone call.' },
    { ic: '📄', t: 'Update resume for the HCPD packet', area: 'hcpd', due: addDays(t, 3), est: '45 min', slip: { was: addDays(t, -3), now: addDays(t, 3) } },
    { ic: '🧱', t: 'Home screen density pass', area: 'inky', due: addDays(t, 4), est: '2 hours', slip: { was: addDays(t, -2), now: addDays(t, 4) } },
    { ic: '🍱', t: 'Meal prep for shift days', area: 'gym', due: addDays(t, 2), est: '90 min', slip: { was: addDays(t, -1), now: addDays(t, 2) } },
    { ic: '💐', t: 'Plan the date night', area: 'partner', due: addDays(t, 5), est: '15 min' },
    { ic: '🔌', t: 'Order the replacement cable', area: null, due: addDays(t, -2), est: '5 min' },
    { ic: '📧', t: 'Reply to the important emails', area: 'work', due: addDays(t, -1), est: '20 min' },
    { ic: '💾', t: 'Back up the photo drive', area: null, due: null, est: '20 min' },
    { ic: '🎓', t: 'Look up spring re-enrollment dates', area: 'school', due: null, est: '10 min' }
  ];
  tasks.forEach(function (x) {
    Store.put('tasks', Object.assign({ example: true, done: false, steps: [], note: '', prio: null }, x), true);
  });
  Store.put('inbox', { example: true, text: 'Ask Ana if the deck can slip to Monday', created: Date.now() - 9e5 }, true);
  Store.put('inbox', { example: true, text: 'Idea: Inky should show the plan before generating it', created: Date.now() - 6e5 }, true);
  Store.put('notes', { example: true, title: 'Onboarding copy', body: 'The first screen cannot present what is owed. One thing, a reason, a button.', area: 'inky' }, true);
  var now = new Date(); now.setHours(7, 15, 0, 0);
  [['Morning brief opened, priorities set', null, 0], ['Leg day logged', 'gym', 145], ['3 slipped tasks moved to real dates', 'hcpd', 230]]
    .forEach(function (l) { if (now.getTime() + l[2] * 6e4 < Date.now()) Store.put('log', { example: true, at: now.getTime() + l[2] * 6e4, day: t, text: l[0], area: l[1] }, true); });
  seedPhase2();
  Store.put('meta', { id: 'setup', seeded: Date.now(), examples: true, v: 2 });
}

/* Habits and goals: added in phase 2, so they're also offered to people
   who started on phase 1 while they still have examples showing. */
function seedPhase2() {
  var t = today();
  var hist = function (bits) { var m = {}; bits.forEach(function (b, i) { if (b) m[addDays(t, i - bits.length)] = b; }); return m; };
  [['💊', 'Meds', '#5FCF8E', null, 'Same time as coffee. The coffee is the cue.', [1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1]],
   ['🚶', 'Morning walk', '#7AA2F7', 'gym', 'Ten minutes counts. It is daylight, not exercise.', [1,0,1,1,1,0,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1,1,1,1,0]],
   ['📖', 'Read 20 pages', '#F0C889', 'school', 'Any book. Pages, not minutes.', [1,1,0,0,1,1,1,0,1,1,0,0,1,1,1,0,1,1,1,0,0,1,1,1,1,0,1,1,1,0]],
   ['🧹', 'Tidy one thing', '#C39BD3', null, 'One thing. Not the room.', [0,1,0,1,1,0,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1,0,1]],
   ['🌙', 'No phone in bed', '#8FD3C7', 'partner', 'Charger lives in the kitchen.', [1,1,1,0,0,1,1,1,0,1,1,1,1,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,1,1]]]
    .forEach(function (x, i) {
      Store.put('habits', { example: true, ic: x[0], n: x[1], color: x[2], area: x[3], cue: x[4], days: [1, 1, 1, 1, 1, 1, 1], marks: hist(x[5]), since: addDays(t, -30), order: i + 1 }, true);
    });
  [['🚔', 'Get through the HCPD hiring process', 'hcpd', 'The job I actually want.', 'Finish the PAT prep block', '', [['Application submitted', 1], ['Pass the PAT', 0], ['Background check', 0], ['Oral board', 0]]],
   ['🏋️', 'Three gym sessions a week', 'gym', 'It is the thing that makes the other things possible.', 'Move the gym bag to the door', 'ongoing', [['Push day', 1], ['Pull day', 1], ['Legs', 0]]],
   ['💵', 'One month of runway saved', 'money', 'So a bad month is a bad month, not a crisis.', 'Move the standing order to the 2nd', 'Dec', [['Set the amount', 1], ['Automate it', 0], ['Leave it alone', 0]]],
   ['🐙', 'Inky beta by Dec 3', 'inky', 'A tool you do not open is not a tool.', 'Fix the Generate Plan spinner', 'Dec 3', [['M0 AI fix', 0], ['New UI', 0], ['Five beta testers', 0]]]]
    .forEach(function (x) {
      Store.put('goals', { example: true, ic: x[0], n: x[1], area: x[2], why: x[3], next: x[4], due: x[5], status: 'live', touched: t,
        steps: x[6].map(function (s) { return { t: s[0], done: !!s[1] }; }) }, true);
    });
}
function upgradeSeed() {
  var m = Store.get('meta', 'setup');
  if (!m || (m.v || 1) >= 2) return;
  if (m.examples && !Store.all('habits').length && !Store.all('goals').length) seedPhase2();
  Store.patch('meta', 'setup', { v: 2 });
}

function clearExamples() {
  ['tasks', 'inbox', 'notes', 'log', 'habits', 'goals'].forEach(function (c) {
    Store.all(c).forEach(function (o) { if (o.example) Store.del(c, o.id); });
  });
  var m = Store.get('meta', 'setup'); if (m) Store.patch('meta', 'setup', { examples: false });
}
function hasExamples() { var m = Store.get('meta', 'setup'); return !!(m && m.examples); }
