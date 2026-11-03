// Builds the MossOS mobile app into one HTML file for a claude.ai artifact.
//
//   node mobile/build.mjs            → mobile/dist/mossos.html
//
// Source: mobile/src/index.html (shell), styles.css, js/*.js (loaded in
// file-name order, wrapped in one IIFE). The artifact host wraps the page
// in its own document, so the output has no doctype/html/head of its own.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const shell = readFileSync(join(src, 'index.html'), 'utf8');
const css = readFileSync(join(src, 'styles.css'), 'utf8');
const files = readdirSync(join(src, 'js')).filter((f) => f.endsWith('.js')).sort();
const js = files.map((f) => `/* ── ${f} ── */\n` + readFileSync(join(src, 'js', f), 'utf8')).join('\n');

/* ── Finance: Payday OS runs unchanged inside a srcdoc frame in the Money
   tab. Each edit below must match exactly once, so a changed source fails
   the build instead of silently losing the glue. */
const edit = (s, find, repl, what) => {
  const n = s.split(find).length - 1;
  if (n !== 1) throw new Error(`build: payday edit "${what}" matched ${n} times`);
  return s.replace(find, () => repl);
};
let pay = readFileSync(join(here, 'finance', 'payday.html'), 'utf8');
// 1. Bridge: use the MossOS page's Claude connection (db, user, mcp, sample).
//    Chrome: MossOS supplies the header and the section nav.
pay = edit(pay, '<head>', '<head><script>try{if(parent!==window&&parent.claude)window.claude=parent.claude}catch(e){}</script>'
  + '<style>.top,.tabs,.rail{display:none!important}body::before{display:none!important}'
  + '.shell{margin-left:0!important}.main{padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))!important}'
  + '.toast{bottom:20px!important}.budfab{bottom:18px!important;right:16px!important}.composer{bottom:0!important}</style>', 'bridge');
// 2. Tell MossOS which Payday view is showing, so its section nav follows.
pay = edit(pay, 'function go(id){\n', 'function go(id){try{parent.__finNav&&parent.__finNav(id)}catch(e){}\n', 'go hook');
// 3. Glue MossOS calls into, built only from Payday's own functions.
pay = edit(pay, "applyMonarch();setSync('local');initNav();go('today');initCloud();initMonarchLive();initSpendWatch();",
  readFileSync(join(here, 'finance', 'glue.js'), 'utf8')
  + "\napplyMonarch();setSync('local');initNav();go('today');initCloud();initMonarchLive();initSpendWatch();", 'glue');
// As a JS string inside MossOS's one script: no "<" survives, so nothing in
// it can close or confuse the outer <script>.
const paySrc = 'var PAYDAY_SRC = ' + JSON.stringify(pay).replace(/</g, '\\u003c') + ';\n';

const fill = (s, mark, value) => {
  const n = s.split(mark).length - 1;
  if (n !== 1) throw new Error(`build: ${mark} found ${n} times in index.html`);
  return s.replace(mark, () => value);
};
let out = fill(shell, '/*@@CSS@@*/', css);
out = fill(out, '/*@@JS@@*/', `(function(){'use strict';\n${paySrc}${js}\n})();`);

if (/<!doctype|<html[\s>]|<head[\s>]/i.test(out)) throw new Error('build: output must not carry its own document skeleton');
const t = out.indexOf('<title>');
if (t < 0 || t > 8000) throw new Error('build: <title> must appear in the first 8 KB');
if (out.includes('</script>', out.indexOf('<script>') + 8) && out.indexOf('</script>') !== out.lastIndexOf('</script>'))
  throw new Error('build: a source file contains a closing script tag');

mkdirSync(join(here, 'dist'), { recursive: true });
const dest = join(here, 'dist', 'mossos.html');
writeFileSync(dest, out);
console.log(`build: ${files.length} scripts → ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
