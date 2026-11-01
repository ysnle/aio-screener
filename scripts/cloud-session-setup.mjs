#!/usr/bin/env node
// Cloud session bootstrap (v59.56). A Claude Code cloud container clones the repository without node_modules and
// ships its own Chromium under PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers) at a revision that can lag the repo's
// pinned Playwright. Every cloud thread used to rediscover both by hand (npm ci, then "Executable doesn't exist"
// on the first browser gate, then a manual symlink). This script does it once, idempotently:
//   1. npm ci when node_modules/playwright is missing or older than package-lock.json;
//   2. for each browser the pinned playwright-core expects (chromium, headless shell, ffmpeg) whose revision
//      directory is absent, link it to the newest installed directory of the same browser — never downloads;
//   3. launches headless Chromium once and reports the result.
// Usage: node scripts/cloud-session-setup.mjs [--check] [--force]
//   --check  report what would change and exit 1 when setup is needed (used by the SessionStart hook)
//   --force  run outside a cloud session too (CLAUDE_CODE_REMOTE unset)
import { existsSync, readdirSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const LINKED = ['chromium', 'chromium-headless-shell', 'ffmpeg'];

export function dependenciesStale(dir = root) {
  const marker = join(dir, 'node_modules', 'playwright-core', 'package.json');
  const lock = join(dir, 'package-lock.json');
  if (!existsSync(marker)) return true;
  return existsSync(lock) && statSync(lock).mtimeMs > statSync(join(dir, 'node_modules')).mtimeMs + 1000;
}

// Pure planner: given the browsers the pinned Playwright expects and the directory names installed, return the
// links to create. A browser whose expected directory exists, or that has no installed revision at all, is skipped.
export function planBrowserLinks(expected, installed) {
  const links = [];
  for (const { name, revision } of expected) {
    const prefix = name.replace(/-/g, '_') + '-';
    const want = prefix + revision;
    if (installed.includes(want)) continue;
    const candidates = installed.filter((dir) => dir.startsWith(prefix) && /^\d+$/.test(dir.slice(prefix.length)))
      .sort((a, b) => Number(b.slice(prefix.length)) - Number(a.slice(prefix.length)));
    if (candidates.length) links.push({ link: want, target: candidates[0] });
  }
  return links;
}

function expectedBrowsers() {
  const file = join(root, 'node_modules', 'playwright-core', 'browsers.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8')).browsers.filter((b) => LINKED.includes(b.name));
}

function main() {
  if (process.env.CLAUDE_CODE_REMOTE !== 'true' && !args.has('--force')) {
    console.log('cloud-session-setup: not a cloud session (CLAUDE_CODE_REMOTE unset); pass --force to run anyway');
    return 0;
  }
  const needDeps = dependenciesStale();
  if (checkOnly && needDeps) { console.log('cloud-session-setup: node_modules missing or older than package-lock.json'); return 1; }
  if (needDeps) {
    const run = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
    if (run.status !== 0) { console.error('cloud-session-setup: npm ci failed'); return 1; }
  }
  const installed = existsSync(browsersPath) ? readdirSync(browsersPath) : [];
  const links = planBrowserLinks(expectedBrowsers(), installed);
  if (checkOnly) {
    if (links.length) { console.log(`cloud-session-setup: browser revisions to link: ${links.map((l) => `${l.link} -> ${l.target}`).join(', ')}`); return 1; }
    console.log('cloud-session-setup: ready');
    return 0;
  }
  for (const { link, target } of links) {
    symlinkSync(join(browsersPath, target), join(browsersPath, link));
    console.log(`linked ${link} -> ${target}`);
  }
  const require = createRequire(join(root, 'package.json'));
  const smoke = spawnSync(process.execPath, ['-e', "require('playwright').chromium.launch().then(b => b.close()).then(() => console.log('chromium launch ok'))"], { cwd: root, stdio: 'inherit', timeout: 60000 });
  if (smoke.status !== 0) { console.error(`cloud-session-setup: chromium did not launch (playwright ${require('playwright/package.json').version})`); return 1; }
  console.log('cloud-session-setup: ready');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
