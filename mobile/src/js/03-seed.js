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
    { ic: '🚔', t: 'Next HCPD application step', area: 'hcpd', due: t, time: '10:00', est: '30 min', note: 'Check the portal first. One step, not the whole packet.' },
    { ic: '🏋️', t: 'Leg day', area: 'gym', due: t, time: '07:00', est: '60 min', done: true, doneAt: Date.now() - 36e5 },
    { ic: '🐞', t: 'Fix the Generate Plan spinner', area: 'inky', due: t, est: '1 hour', note: 'It hangs when the AI call times out. Show the error instead of spinning forever.',
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
    { ic: '🎓', t: 'Look up spring re-enrollment dates', area: 'school', due: null, est: '10 min' },
    { ic: '🗑', t: 'Take out the trash', area: null, due: nextOccurrence({ every: 'week', days: [0, 0, 0, 1, 0, 0, 0] }, addDays(t, -1)), time: '20:00', repeat: { every: 'week', days: [0, 0, 0, 1, 0, 0, 0] }, est: '5 min' },
    { ic: '🏠', t: 'Pay rent', area: 'money', due: nextOccurrence({ every: 'month', dom: 1 }, addDays(t, -1)), time: '09:00', repeat: { every: 'month', dom: 1 }, est: '5 min' }
  ];
  tasks.forEach(function (x) {
    Store.put('tasks', Object.assign({ example: true, done: false, steps: [], note: '' }, x), true);
  });
  Store.put('inbox', { example: true, text: 'Ask Ana if the deck can slip to Monday', created: Date.now() - 9e5 }, true);
  Store.put('inbox', { example: true, text: 'Idea: Inky should show the plan before generating it', created: Date.now() - 6e5 }, true);
  Store.put('notes', { example: true, title: 'Onboarding copy', body: 'The first screen cannot present what is owed. One thing, a reason, a button.', area: 'inky' }, true);
  var now = new Date(); now.setHours(7, 15, 0, 0);
  [['Morning brief opened', null, 0], ['Leg day logged', 'gym', 145], ['3 slipped tasks moved to real dates', 'hcpd', 230]]
    .forEach(function (l) { if (now.getTime() + l[2] * 6e4 < Date.now()) Store.put('log', { example: true, at: now.getTime() + l[2] * 6e4, day: t, text: l[0], area: l[1] }, true); });
  seedPhase2(); seedPhase3(); seedPhase4();
  Store.put('meta', { id: 'setup', seeded: Date.now(), examples: true, v: 4 });
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
      var sess = []; [3, 5, 9, 12, 16, 20, 26, 33, 38, 44].forEach(function (k, j) { if ((j + x[1].length) % 3) sess.push(addDays(t, -k)); });
      Store.put('goals', { example: true, ic: x[0], n: x[1], area: x[2], why: x[3], next: x[4], due: x[5], status: 'live', touched: t, sessions: sess,
        steps: x[6].map(function (s) { return { t: s[0], done: !!s[1] }; }) }, true);
    });
}
function upgradeSeed() {
  var m = Store.get('meta', 'setup'), v = m ? (m.v || 1) : 4;
  if (!m || v >= 4) return;
  if (m.examples && v < 2 && !Store.all('habits').length && !Store.all('goals').length) seedPhase2();
  if (m.examples && v < 3 && !Store.all('projects').length && !Store.all('journal').length) seedPhase3();
  if (m.examples && !Store.all('ranks').length && !Store.all('decks').length && !Store.all('lifts').length) seedPhase4();
  Store.patch('meta', 'setup', { v: 4 });
}

/* Tools (phase 4): a ranked Movies list, a deck, Bored options, lifts. */
function seedPhase4() {
  var t = today();
  var films = [['Heat', '1995', 'The diner scene.'], ['Arrival', '2016', ''], ['Sinners', '2025', 'Better than the trailer suggested.'], ['Top Gun: Maverick', '2022', ''], ['Paddington 2', '2017', '']];
  var items = films.map(function (f, i) { return { id: 'rx' + i, t: f[0], year: f[1], note: f[2], watched: addDays(t, -10 * (i + 1)), added: addDays(t, -10 * (i + 1)) }; });
  Store.put('ranks', { example: true, name: 'Movies', ic: '🎬', kind: 'movies', items: items.concat([{ id: 'rx9', t: 'The Fall Guy', year: '2024', note: '', watched: addDays(t, -1), added: addDays(t, -1) }]),
    order: ['rx0', 'rx1', 'rx2', 'rx3', 'rx4'] }, true);
  var cards = [['¿Dónde le duele?', 'Where does it hurt?'], ['¿Está herido?', 'Are you hurt?'], ['¿Cómo se llama?', 'What is your name?'],
    ['¿Tiene alergias?', 'Do you have any allergies?'], ['Tranquilo, estoy aquí para ayudarle.', 'Stay calm, I\'m here to help you.']];
  Store.put('decks', { example: true, name: 'Spanish for calls', cards: cards.map(function (c, i) { return { id: 'cx' + i, q: c[0], a: c[1], box: i < 2 ? 2 : 1, due: i < 2 ? addDays(t, 1) : t, seen: i < 2 }; }) }, true);
  Store.put('tools', { example: true, id: 'bored', items: ['Walk to the end of the street and back', 'Ten push-ups', 'Text someone you haven\'t in a while', 'Tidy one surface',
    'Read ten pages', 'Stretch for five minutes', 'Plan tomorrow\'s meals', 'Put on an album you love, start to finish'] }, true);
  [['Bench press', [[125, 3, 8], [130, 3, 8], [135, 3, 6], [135, 3, 8]]], ['Squat', [[165, 3, 8], [175, 3, 8], [185, 3, 6]]], ['Deadlift', [[205, 3, 5], [215, 3, 5], [225, 3, 5]]]]
    .forEach(function (x, j) {
      Store.put('lifts', { example: true, n: x[0], unit: 'lb', lastAt: Date.now() - j * 864e5, log: x[1].map(function (r, i) { return { d: addDays(t, -(x[1].length - i) * 3 - j), w: r[0], sets: r[1], reps: r[2] }; }) }, true);
    });
}

/* Projects (from the Sep 18 build's model, about Miles's own work) and a
   few journal days. Added in phase 3. */
function seedPhase3() {
  var t = today(), now = Date.now();
  var P = [
    { id: 'pinky', ic: '🐙', t: 'Inky', kind: 'software', area: 'inky', done: 'Done when five beta testers use it every week.',
      next: 'Fix the Generate Plan spinner', left: 'Spinner hangs when the AI call times out. Reproduced it with the network throttled.',
      panels: ['checklist', 'log', 'links', 'docs'],
      data: { checklist: [{ t: 'M0: AI fix', done: false }, { t: 'New home screen', done: false }, { t: 'Invite five testers', done: false }],
        log: [{ t: 'Reproduced the spinner hang', at: now - 2 * 864e5 }], links: [{ t: 'Repo', url: 'https://github.com/MilesAway24/Inky' }] } },
    { id: 'phcpd', ic: '🚔', t: 'HCPD application', kind: 'admin', area: 'hcpd', done: 'Done when I have an offer letter.',
      next: 'Finish the PAT prep block', left: '',
      panels: ['checklist', 'people', 'docs', 'log'],
      data: { checklist: [{ t: 'Application submitted', done: true }, { t: 'PAT', done: false }, { t: 'Background packet', done: false }, { t: 'Oral board', done: false }],
        people: [{ n: 'Recruiter', role: 'Add their name and number' }] } },
    { id: 'pacad', ic: '🏃', t: 'Academy fitness prep', kind: 'fitness', area: 'gym', done: 'Done when I pass every PAT event twice in practice.',
      next: 'Timed 1.5 mile run on Saturday', left: 'Push-ups at 28. Sit-ups fine.',
      panels: ['checklist', 'log'],
      data: { checklist: [{ t: '1.5 mile under the standard', done: false }, { t: 'Push-ups to standard', done: false }, { t: 'Sit-ups to standard', done: true }],
        log: [{ t: 'Push-ups: 28 in a minute', at: now - 864e5 }] } },
    { id: 'pkit', ic: '🏠', t: 'Apartment setup', kind: 'reno', area: null, status: 'parked', done: 'Done when the desk and shelves are up.',
      next: 'Measure the wall by the window', left: 'Waiting on the shelf brackets.',
      panels: ['budget', 'checklist'],
      data: { budget: [{ t: 'Desk', amt: 140, paid: true }, { t: 'Shelves', amt: 85, paid: false }, { t: 'Brackets', amt: 24, paid: false }],
        checklist: [{ t: 'Desk', done: true }, { t: 'Shelves', done: false }] } }
  ];
  P.forEach(function (p, i) {
    Store.put('projects', Object.assign({ example: true, status: 'active', touched: addDays(t, -i), touchedAt: now - i * 864e5 }, p), true);
  });
  // Link existing example tasks to their projects.
  Store.all('tasks').forEach(function (x) {
    if (!x.example || x.project) return;
    var pid = x.area === 'inky' ? 'pinky' : x.area === 'hcpd' ? 'phcpd' : null;
    if (pid) Store.patch('tasks', x.id, { project: pid });
  });
  [[-1, 'good', 'Good day. Three gym sessions this week already. The spinner bug finally makes sense.'],
   [-2, 'low', 'Did almost nothing. Opened the HCPD portal and closed it. That still counts as opening it.'],
   [-3, 'ok', 'Long shift. Meal prep would have helped.']]
    .forEach(function (j) { var d = addDays(t, j[0]); Store.put('journal', { example: true, id: 'j' + d, day: d, mood: j[1], text: j[2] }, true); });
}

function clearExamples() {
  ['tasks', 'inbox', 'notes', 'log', 'habits', 'goals', 'projects', 'journal', 'ranks', 'decks', 'lifts', 'tools'].forEach(function (c) {
    Store.all(c).forEach(function (o) { if (o.example) Store.del(c, o.id); });
  });
  var m = Store.get('meta', 'setup'); if (m) Store.patch('meta', 'setup', { examples: false });
}
function hasExamples() { var m = Store.get('meta', 'setup'); return !!(m && m.examples); }
