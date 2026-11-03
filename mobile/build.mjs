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

const fill = (s, mark, value) => {
  const n = s.split(mark).length - 1;
  if (n !== 1) throw new Error(`build: ${mark} found ${n} times in index.html`);
  return s.replace(mark, () => value);
};
let out = fill(shell, '/*@@CSS@@*/', css);
out = fill(out, '/*@@JS@@*/', `(function(){'use strict';\n${js}\n})();`);

if (/<!doctype|<html[\s>]|<head[\s>]/i.test(out)) throw new Error('build: output must not carry its own document skeleton');
const t = out.indexOf('<title>');
if (t < 0 || t > 8000) throw new Error('build: <title> must appear in the first 8 KB');
if (out.includes('</script>', out.indexOf('<script>') + 8) && out.indexOf('</script>') !== out.lastIndexOf('</script>'))
  throw new Error('build: a source file contains a closing script tag');

mkdirSync(join(here, 'dist'), { recursive: true });
const dest = join(here, 'dist', 'mossos.html');
writeFileSync(dest, out);
console.log(`build: ${files.length} scripts → ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
