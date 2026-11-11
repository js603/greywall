// Folds the `--mode single` build (dist-single/) into one self-contained HTML file:
// the module script and stylesheet go inline (their assets are already data: URLs).
//   node tools/inline-html.mjs [out.html]   (default dist-single/greywall.html)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-single';
const out = process.argv[2] ?? join(dir, 'greywall.html');
let html = readFileSync(join(dir, 'index.html'), 'utf8');
const read = (src) => readFileSync(join(dir, src), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (_, src) => {
  const js = read(src);
  if (/<\/script/i.test(js)) throw new Error(`${src} contains "</script"`);
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (_, href) => `<style>${read(href)}</style>`);
html = html.replace(/<link rel="modulepreload"[^>]*>\n?/g, '');
if (/(src|href)="\.\//.test(html)) throw new Error('a local reference is left in the page');
writeFileSync(out, html);
console.log(`${out}: ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB`);
