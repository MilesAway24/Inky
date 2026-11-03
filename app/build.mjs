// Builds the installable MossOS web app from the demo.
//
//   node app/build.mjs
//
// Reads ../mossos-full.html (the source of truth) and writes app/index.html.
// Every edit is an exact string replacement that must match exactly once, so
// if the demo changes underneath it the build fails loudly instead of
// producing a half-patched app.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'mossos-full.html');
const out = join(here, 'index.html');

let html = readFileSync(src, 'utf8');

function swap(label, from, to) {
  const n = html.split(from).length - 1;
  if (n !== 1) throw new Error(`build: "${label}" matched ${n} times (expected 1)`);
  html = html.replace(from, () => to);
}

/* ── 1. Document head: real <html>/<head>, manifest, icons, viewport ───── */
swap('title', '<title>Moss for Mac</title>', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#121211">
<meta name="color-scheme" content="dark">
<meta name="description" content="MossOS — tasks, habits, focus and tools in one place.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MossOS">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="icons/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<title>MossOS</title>`);

/* ── 2. App-shell CSS: drop the fake desktop, fill the real window ─────── */
const APP_CSS = `
/* ═══ APP SHELL (added by app/build.mjs) ═══════════════════════════════ */
html,body{height:100%;overflow:hidden;background:var(--bg);overscroll-behavior:none}
.note,.menubar,.dock,.lights{display:none!important}
.stagewrap{position:fixed;inset:0;overflow:hidden;padding:0}
.desktop{width:100%;height:100%;margin:0;border-radius:0;background:var(--bg)}
.win{inset:0;left:0;top:0;width:auto;height:auto;border:0;border-radius:0;box-shadow:none;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)}
.status{padding-bottom:env(safe-area-inset-bottom);height:calc(26px + env(safe-area-inset-bottom))}
.tabstrip{-webkit-app-region:drag;app-region:drag}
.tabstrip button,.tabstrip .tb{-webkit-app-region:no-drag;app-region:no-drag}
.railbtn{display:none;align-self:center;flex:none;width:32px;height:30px;border-radius:7px;
  place-items:center;color:var(--mu);font-size:17px;margin-right:6px}
.railbtn:hover{background:var(--hov);color:var(--tx)}
.railscrim{display:none}
.offline{display:none;color:var(--org)}
.offline.on{display:inline}

/* medium windows: dashboard goes to two columns */
@media (max-width:1180px){
  .dash{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .dash>.col:nth-child(2){grid-column:1/-1;order:-1}
  .studio{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .studio>*:nth-child(2){grid-column:1/-1;order:-1}
}

/* phones and narrow windows: rail becomes a drawer, everything stacks */
@media (max-width:760px){
  body{font-size:14px}
  .railbtn{display:grid}
  .rail{position:absolute;z-index:85;left:0;top:0;bottom:0;width:min(280px,84vw);
    padding-top:calc(10px + env(safe-area-inset-top));padding-left:calc(8px + env(safe-area-inset-left));
    transform:translateX(-102%);transition:transform .22s ease;box-shadow:0 0 40px rgba(0,0,0,.6)}
  .win.railopen .rail{transform:none}
  .win.railopen .railscrim{display:block;position:absolute;inset:0;z-index:84;background:rgba(0,0,0,.5)}
  .rl{padding:9px 8px;font-size:14px}
  .scroll{padding:0 12px 22px}
  .banner{margin:0 -12px}
  .crumbs{overflow-x:auto;scrollbar-width:none;padding:0 10px}
  .crumbs::-webkit-scrollbar{display:none}
  .crumbs b{white-space:nowrap}
  .status>span:nth-child(n+2){display:none}
  .dash,.studio,.feat,.wgrow,.board,.hbtpl{grid-template-columns:minmax(0,1fr)}
  .dash>.col:nth-child(2),.studio>*:nth-child(2){grid-column:auto}
  .tstats,.gstats,.hstats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .phrow{grid-template-columns:repeat(3,1fr)}
  .pal{width:calc(100% - 24px);top:calc(60px + env(safe-area-inset-top))}
  .dlg{width:calc(100% - 24px)}
  .drift,.wid,.capwrap{right:12px;left:12px;width:auto}
  .notif{right:12px;left:12px;width:auto;top:calc(12px + env(safe-area-inset-top))}
  .toast{max-width:calc(100% - 24px)}
  h1{font-size:23px}
}
@media (prefers-reduced-motion:reduce){.rail{transition:none}}
`;
swap('end of style', '\n</style>', APP_CSS + '</style>');

/* ── 3. Markup: rail drawer button, drawer scrim, offline indicator ────── */
swap('rail button',
  '<div class="tabscroll" id="tabscroll"></div>',
  '<button class="railbtn" id="railbtn" aria-label="Menu" title="Menu">☰</button><div class="tabscroll" id="tabscroll"></div>');
swap('rail scrim',
  '<nav class="rail" id="rail"></nav>',
  '<nav class="rail" id="rail"></nav><div class="railscrim" id="railscrim"></div>');
swap('offline indicator',
  '<div class="r"><span id="tabcount">1 tab</span>',
  '<div class="r"><span class="offline" id="offline">● Offline</span><span id="tabcount">1 tab</span>');

/* ── 4. Context menu was clamped to the 1232×790 demo window ───────────── */
swap('ctx clamp',
  "ctxEl.style.left=Math.min(e.clientX-d.left,1040)+'px';",
  "ctxEl.style.left=Math.max(8,Math.min(e.clientX-d.left,d.width-232))+'px';");
swap('ctx clamp y',
  "ctxEl.style.top=Math.min(e.clientY-d.top,690)+'px';",
  "ctxEl.style.top=Math.max(8,Math.min(e.clientY-d.top,d.height-300))+'px';");

/* ── 5. Saved data ─────────────────────────────────────────────────────── */
// The demo keeps everything in plain arrays and objects. The app snapshots
// them to localStorage after every interaction and puts them back, in place,
// before anything reads them. Restore runs twice because the variables are
// declared in two places: once before the rail is built (so pinned tools show
// up), once at the very end for everything declared further down.
const PERSIST = `
/* ═══ SAVED DATA (added by app/build.mjs) ═══════════════════════════════ */
var SAVE_KEY='mossos.app.v1',SAVED=null;
try{SAVED=JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch(err){SAVED=null}
function putBack(target,v){
  if(!v||typeof target!=='object'||target===null) return;
  if(Array.isArray(target)){if(!Array.isArray(v))return;target.length=0;
    v.forEach(function(x){target.push(x)});return}
  Object.keys(target).forEach(function(k){delete target[k]});
  Object.keys(v).forEach(function(k){target[k]=v[k]});
}
`;
swap('persist early', 'var RAIL=[\n', PERSIST + `if(SAVED){
  putBack(TASKS,SAVED.TASKS);putBack(HABITS,SAVED.HABITS);putBack(PROJECTS,SAVED.PROJECTS);
  putBack(TOOLS,SAVED.TOOLS);putBack(STARRED,SAVED.STARRED);putBack(RECENT,SAVED.RECENT);
  if(Array.isArray(SAVED.TABS)&&SAVED.TABS.length&&SAVED.TABS[0].pin){putBack(TABS,SAVED.TABS);
    active=Math.max(0,Math.min(+SAVED.active||0,TABS.length-1));uid=Math.max(+SAVED.uid||1,TABS.length)}
}
var RAIL=[
`);

const BOOT = `
/* ═══ APP BOOT (added by app/build.mjs) ═════════════════════════════════ */
if(SAVED){putBack(GOALS,SAVED.GOALS);putBack(JOURNAL,SAVED.JOURNAL);putBack(DOCS,SAVED.DOCS);
  putBack(WS,SAVED.WS);putBack(CALITEMS,SAVED.CALITEMS);putBack(swS,SAVED.swS)}
var saveT=null;
function saveNow(){
  clearTimeout(saveT);
  try{localStorage.setItem(SAVE_KEY,JSON.stringify({v:1,at:Date.now(),
    TASKS:TASKS,HABITS:HABITS,PROJECTS:PROJECTS,TOOLS:TOOLS,STARRED:STARRED,RECENT:RECENT,
    GOALS:GOALS,JOURNAL:JOURNAL,DOCS:DOCS,WS:WS,CALITEMS:CALITEMS,swS:swS,
    TABS:TABS,active:active,uid:uid}))}catch(err){}
}
function saveSoon(){clearTimeout(saveT);saveT=setTimeout(saveNow,350)}
['click','input','change','keyup','pointerup'].forEach(function(ev){addEventListener(ev,saveSoon,true)});
addEventListener('pagehide',saveNow);
document.addEventListener('visibilitychange',function(){if(document.hidden)saveNow()});

CMDS.push(['App','↺','Reset saved data','','resetdata']);
var runBase=run,resetAsked=0;
run=function(k){
  if(k==='resetdata'){
    // Two steps instead of confirm(), which some hosts (claude.ai) block.
    if(Date.now()-resetAsked>6000){resetAsked=Date.now();
      toast('↺ Run <b>Reset saved data</b> again within 6 s to clear everything you changed');return}
    try{localStorage.removeItem(SAVE_KEY)}catch(err){}
    removeEventListener('pagehide',saveNow);saveNow=function(){};location.reload();
    return}
  return runBase(k)};

/* rail as a drawer on narrow screens */
var winEl=document.querySelector('.win');
function railOpen(on){winEl.classList.toggle('railopen',on)}
$('#railbtn').onclick=function(e){e.stopPropagation();railOpen(!winEl.classList.contains('railopen'))};
$('#railscrim').onclick=function(){railOpen(false)};
$('#rail').addEventListener('click',function(e){if(e.target.closest('.rl'))railOpen(false)});
addEventListener('keydown',function(e){if(e.key==='Escape')railOpen(false)});

/* offline indicator */
function netPaint(){$('#offline').classList.toggle('on',!navigator.onLine)}
addEventListener('online',netPaint);addEventListener('offline',netPaint);netPaint();

/* ?view=tasks deep links, used by the manifest shortcuts */
try{var qv=new URLSearchParams(location.search).get('view');
  if(qv&&VIEWMETA[qv]){var qi=tabFor(qv,'');if(qi>-1)active=qi;
    else TABS.push({id:uid++,icon:VIEWMETA[qv][0],title:VIEWMETA[qv][1],view:qv,arg:''}),active=TABS.length-1}}catch(err){}

if('serviceWorker' in navigator&&location.protocol!=='file:'){
  addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})})}
`;
// The demo pops the drift card 2.8 s after load to show it off. In the app
// that would nag on every launch, so it is left to ⌘K → "Show the drift card".
swap('boot',
  "\npaint();\nsetTimeout(function(){$('#drift').classList.remove('hide')},2800);",
  '\n' + BOOT + '\npaint();');

// `run` is declared as a function statement; the boot code reassigns it, so
// every caller (palette, crumbs, header menus) goes through the wrapper.
swap('close html', '</script>\n', '</script>\n</html>\n');

writeFileSync(out, html);
console.log(`build: wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);

// Stamp the service worker's cache name with a hash of the page, so an
// installed copy notices the new build and replaces its offline cache.
const swPath = join(here, 'sw.js');
const hash = createHash('sha256').update(html).digest('hex').slice(0, 10);
const sw = readFileSync(swPath, 'utf8');
const stamped = sw.replace(/const VERSION = '[^']*';/, `const VERSION = 'mossos-${hash}';`);
if (stamped === sw && !sw.includes(`mossos-${hash}`)) throw new Error('build: VERSION line not found in sw.js');
writeFileSync(swPath, stamped);
console.log(`build: sw.js cache version mossos-${hash}`);

// Optional: `node app/build.mjs --hosted <file>` also writes a copy for hosts
// that wrap the page in their own document (claude.ai artifacts). It has no
// <html>/<head> of its own, no manifest or service worker, and the icon inline.
const hostedAt = process.argv.indexOf('--hosted');
if (hostedAt > -1) {
  const dest = process.argv[hostedAt + 1];
  if (!dest) throw new Error('build: --hosted needs a file path');
  const svg = readFileSync(join(here, 'icons', 'icon.svg'), 'utf8').trim();
  const icon = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  let h = html;
  const cut = (label, from, to) => {
    if (!h.includes(from)) throw new Error(`build --hosted: "${label}" not found`);
    h = h.replace(from, () => to);
  };
  cut('head', h.slice(0, h.indexOf('<title>MossOS</title>')),
    `<link rel="icon" href="${icon}" type="image/svg+xml">\n`);
  cut('close html', '</script>\n</html>\n', '</script>\n');
  cut('color scheme', '\n</style>', '\n:root{color-scheme:dark}\n</style>');
  writeFileSync(dest, h);
  console.log(`build: wrote hosted copy ${dest} (${(h.length / 1024).toFixed(0)} KB)`);
}
