#!/usr/bin/env node
// verify-aio: launch, doctor, drive and clean up a local AIO instance the way a user does.
// Usage (from the repo root):
//   node .claude/skills/verify-aio/scripts/verify-aio.mjs launch   [--port 8791]
//   node .claude/skills/verify-aio/scripts/verify-aio.mjs doctor   [--port 8791]
//   node .claude/skills/verify-aio/scripts/verify-aio.mjs check                       (static: map <-> driver parity, no browser)
//   node .claude/skills/verify-aio/scripts/verify-aio.mjs list
//   node .claude/skills/verify-aio/scripts/verify-aio.mjs drive <feature|all> [--port 8791] [--viewport desktop|tablet|phone] [--run <id>] [--send-ai]
//   node .claude/skills/verify-aio/scripts/verify-aio.mjs registry [--port 8791] [--run <id>]   (route-owners surfaces vs live DOM)
//   node .claude/skills/verify-aio/scripts/verify-aio.mjs cleanup  [--port 8791]
// Evidence: _artifacts/verify-aio/<run>/ (git-ignored, survives cleanup).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { instance, root, evidenceRoot, repoVersion } from './lib/instance.mjs';
import { driveOne, bootPage, VIEWPORTS } from './lib/drive.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, '..');
const mapDir = join(skillDir, 'features');
const driverDir = join(here, 'features');
const args = process.argv.slice(2);
const command = args[0] || 'help';
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);
const inst = instance(Number(flag('port', process.env.AIO_VERIFY_PORT || 8791)));
const runId = () => flag('run', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

const mapIds = () => readdirSync(mapDir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => f.slice(0, -3)).sort();
const driverIds = () => readdirSync(driverDir).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort();
const loadFeature = async (id) => (await import(pathToFileURL(join(driverDir, `${id}.mjs`)).href)).default;

// Static contract: every map file has a driver and vice versa, the README index lists every map file,
// each map file keeps the four H2 sections, and each driver names its map file.
function check() {
  const errors = [];
  const maps = mapIds();
  const drivers = driverIds();
  maps.filter((id) => !drivers.includes(id)).forEach((id) => errors.push(`features/${id}.md has no driver scripts/features/${id}.mjs`));
  drivers.filter((id) => !maps.includes(id)).forEach((id) => errors.push(`scripts/features/${id}.mjs has no map features/${id}.md`));
  const readme = readFileSync(join(mapDir, 'README.md'), 'utf8');
  maps.filter((id) => !readme.includes(`(./${id}.md)`)).forEach((id) => errors.push(`features/README.md does not index ${id}.md`));
  [...readme.matchAll(/\(\.\/([\w-]+)\.md\)/g)].map((m) => m[1]).filter((id) => !maps.includes(id)).forEach((id) => errors.push(`features/README.md links missing ${id}.md`));
  const h2 = ['Sub-features', 'How to get to it (user POV)', 'Driving it with verify-aio', 'Gotchas'];
  for (const id of maps) {
    const md = readFileSync(join(mapDir, `${id}.md`), 'utf8');
    const found = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    if (JSON.stringify(found) !== JSON.stringify(h2)) errors.push(`features/${id}.md H2s ${JSON.stringify(found)} != ${JSON.stringify(h2)}`);
    if (!/^# .+/m.test(md)) errors.push(`features/${id}.md has no H1`);
  }
  for (const id of drivers) {
    const src = readFileSync(join(driverDir, `${id}.mjs`), 'utf8');
    if (!src.includes(`// Map: features/${id}.md`)) errors.push(`scripts/features/${id}.mjs does not name its map file`);
  }
  errors.forEach((e) => console.error(`FAIL  ${e}`));
  console.log(errors.length ? `CHECK FAIL (${errors.length})` : `CHECK OK — ${maps.length} features, map <-> driver parity, README index and H2 contract hold.`);
  return !errors.length;
}

async function drive() {
  const target = args[1];
  const known = driverIds();
  const list = target === 'all' ? known : [target];
  if (!target || list.some((f) => !known.includes(f))) {
    console.error(`Unknown feature "${target}". Known: ${known.join(', ')}, all`);
    return false;
  }
  if (!(await inst.doctor({ quiet: true }))) { await inst.doctor(); return false; }
  const run = runId();
  const viewport = flag('viewport', 'desktop');
  if (!VIEWPORTS[viewport]) { console.error(`Unknown viewport ${viewport}`); return false; }
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const reports = [];
  try {
    for (const id of list) reports.push(await driveOne(browser, id, await loadFeature(id), { baseUrl: inst.baseUrl, run, viewport, sendAi: has('send-ai') }));
  } finally {
    await browser.close();
  }
  mkdirSync(join(evidenceRoot, run), { recursive: true });
  const summary = { run, viewport, port: inst.port, version: repoVersion(), results: reports.map((r) => ({ feature: r.feature, ok: r.ok, steps: `${r.steps.filter((s) => s.ok).length}/${r.steps.length}`, uncaught: r.pageErrors.length, unexpectedConsole: r.unexpectedConsoleErrors.length })) };
  writeFileSync(join(evidenceRoot, run, `summary-${viewport}.json`), JSON.stringify(summary, null, 2));
  console.log(`${reports.filter((r) => r.ok).length}/${reports.length} features PASS. Evidence: ${join(evidenceRoot, run)}`);
  return reports.every((r) => r.ok);
}

// Live check of architecture/route-owners.json: every declared native surface selector must exist once its route is active.
async function registry() {
  if (!(await inst.doctor({ quiet: true }))) { await inst.doctor(); return false; }
  const owners = JSON.parse(readFileSync(join(root, 'architecture', 'route-owners.json'), 'utf8')).routes;
  const run = runId();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const results = [];
  try {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop, locale: 'ko-KR', serviceWorkers: 'block' });
    const page = await bootPage(context, inst.baseUrl, 'desktop');
    for (const [route, o] of Object.entries(owners)) {
      if (route === 'theme-detail' || route === 'ticker') {
        await page.evaluate((r) => (r === 'ticker' ? window.showTicker('NVDA') : window.showPage(r)), route);
      } else {
        await page.evaluate((r) => window.showPage(r), route);
      }
      await page.waitForFunction((r) => document.querySelector('.page.active')?.id === `page-${r}`, route, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const check = async (list) => page.evaluate((sels) => sels.map((s) => ({ selector: s, present: !!document.querySelector(s) })), list || []);
      const primary = await check(o.nativePrimarySurface);
      const secondary = await check(o.nativeSecondarySurface);
      const missing = [...primary.filter((x) => !x.present).map((x) => ({ ...x, tier: 'primary' })), ...secondary.filter((x) => !x.present).map((x) => ({ ...x, tier: 'secondary' }))];
      results.push({ route, activePage: await page.evaluate(() => document.querySelector('.page.active')?.id), declared: primary.length + secondary.length, missing });
      console.log(`${missing.length ? 'DRIFT' : 'OK   '}  ${route.padEnd(12)} ${primary.length + secondary.length - missing.length}/${primary.length + secondary.length} declared surfaces present${missing.length ? ' — missing ' + missing.map((m) => `${m.selector} (${m.tier})`).join(', ') : ''}`);
    }
    await context.close();
  } finally {
    await browser.close();
  }
  mkdirSync(join(evidenceRoot, run), { recursive: true });
  writeFileSync(join(evidenceRoot, run, 'registry.json'), JSON.stringify({ run, version: repoVersion(), results }, null, 2));
  const drift = results.filter((r) => r.missing.length);
  console.log(`${results.length - drift.length}/${results.length} routes match route-owners.json. Evidence: ${join(evidenceRoot, run, 'registry.json')}`);
  return !drift.length;
}

let ok = true;
if (command === 'launch') ok = await inst.launch();
else if (command === 'doctor') ok = await inst.doctor();
else if (command === 'check') ok = check();
else if (command === 'drive') ok = await drive();
else if (command === 'registry') ok = await registry();
else if (command === 'cleanup') ok = inst.cleanup();
else if (command === 'list') { for (const id of driverIds()) console.log(`${id.padEnd(10)} ${(await loadFeature(id)).title}`); }
else console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n'));
// exitCode, not process.exit(): exiting right after fetch trips a libuv handle assertion on Windows.
process.exitCode = ok ? 0 : 1;
