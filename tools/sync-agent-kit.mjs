// Installs the agent kit from the vendored submodules into .claude/ (and a few docs/ files).
//   node tools/sync-agent-kit.mjs           copy, then write .claude/agent-kit.lock.json
//   node tools/sync-agent-kit.mjs --check   exit 1 if the installed copies drifted from the lock
// Files listed under studio.local are owned by this project and never overwritten.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const cfg = JSON.parse(readFileSync(join(ROOT, 'tools/agent-kit.json'), 'utf8'));
const LOCK = join(ROOT, '.claude/agent-kit.lock.json');
const check = process.argv.includes('--check');

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : [p]);
const junk = (p) => /(__pycache__|\.pyc$|\.DS_Store$)/.test(p);
const glob = (name, pats) => pats.some((g) => new RegExp('^' + g.replace(/\*/g, '.*') + '$').test(name));
const commit = (repo) => {
  try { return execFileSync('git', ['-C', join(ROOT, repo), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; }
};

// plan: [destination, source] pairs
const plan = [];
const add = (dst, src) => { for (const f of walk(src)) if (!junk(f)) plan.push([join(dst, relative(src, f)), f]); };
const studio = cfg.studio;
const local = new Set(studio.local.map((p) => join(ROOT, p)));
for (const part of studio.copy) {
  const src = join(ROOT, studio.repo, part);
  if (!existsSync(src)) continue;
  if (statSync(src).isDirectory()) {
    for (const entry of readdirSync(src)) {
      if (glob(entry.replace(/\.md$/, ''), studio.exclude)) continue;
      add(join(ROOT, part, entry), join(src, entry));
    }
  } else plan.push([join(ROOT, part), src]);
}
for (const [base, skills] of Object.entries(cfg.skills))
  for (const s of skills) add(join(ROOT, '.claude/skills', basename(s)), join(ROOT, base, s));

const sources = Object.fromEntries([studio.repo, ...Object.keys(cfg.skills).map((b) => b.split('/').slice(0, 2).join('/'))].map((r) => [r, commit(r)]));
const files = {};
for (const [dst, src] of plan) if (!local.has(dst)) files[relative(ROOT, dst)] = sha(src);

if (check) {
  const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { files: {} };
  const drift = [];
  for (const [f, h] of Object.entries(lock.files)) {
    const p = join(ROOT, f);
    if (!existsSync(p)) drift.push(`missing   ${f}`);
    else if (sha(p) !== h) drift.push(`edited    ${f}`);
    else if (files[f] && files[f] !== h) drift.push(`outdated  ${f}`);
  }
  for (const f of Object.keys(files)) if (!(f in lock.files)) drift.push(`new       ${f}`);
  console.log(drift.length ? drift.join('\n') : 'agent kit: in sync');
  process.exit(drift.length ? 1 : 0);
}

// remove what the previous sync installed, then copy fresh
if (existsSync(LOCK)) for (const f of Object.keys(JSON.parse(readFileSync(LOCK, 'utf8')).files)) rmSync(join(ROOT, f), { force: true });
for (const [dst, src] of plan) {
  if (local.has(dst) && existsSync(dst)) continue;
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
}
writeFileSync(LOCK, JSON.stringify({ sources, files }, null, 1) + '\n');
console.log(`agent kit: ${Object.keys(files).length} files from ${Object.keys(sources).length} repos`);
