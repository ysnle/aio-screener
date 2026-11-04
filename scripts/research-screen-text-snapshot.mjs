// S17~S19 content-invariance evidence: renders the research routes in a real browser and records the visible
// text of #page-principles, #page-atlas and #page-masters for a fixed set of states. Run it before and after a
// content move and compare the two files; `--compare a.json b.json` exits 1 on any changed state.
//   node scripts/research-screen-text-snapshot.mjs --out before.json [--port 8794]
//   node scripts/research-screen-text-snapshot.mjs --compare before.json after.json
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { readAtlasCopySource, readConceptStories, readIndustryStories, readPrinciplesCatalogSource } from './lib/research-content.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

if (args.includes('--compare')) {
  const [a, b] = [flag('--compare'), args[args.indexOf('--compare') + 2]].map((file) => JSON.parse(readFileSync(file, 'utf8')));
  const keys = [...new Set([...Object.keys(a.states), ...Object.keys(b.states)])];
  const changed = keys.filter((key) => a.states[key] !== b.states[key]);
  for (const key of changed) console.log(`changed: ${key} (${a.states[key]?.length ?? 'missing'} -> ${b.states[key]?.length ?? 'missing'} chars)`);
  console.log(JSON.stringify({ states: keys.length, changed: changed.length }));
  process.exit(changed.length ? 1 : 0);
}

const out = flag('--out');
if (!out) throw new Error('--out <file> is required');
const port = Number(flag('--port') || 8794);
const base = `http://127.0.0.1:${port}/`;
const catalog = readPrinciplesCatalogSource();
const nodeIds = catalog.nodes.map((node) => node.id);
const states = [
  ['principles', '?mode=tree#principles'],
  ['principles', '?mode=graph#principles'],
  ...nodeIds.map((id) => ['principles', `?mode=graph&node=${encodeURIComponent(id)}#principles`]),
  ...catalog.paths.map((path) => ['principles', `?mode=path&path=${encodeURIComponent(path.id)}#principles`]),
  ['atlas', '#atlas'],
  // Every 5th 산업 지도 node (guide + reading text), every domain overview, every AI 기초 layer, every 4th concept.
  ...Object.keys(readIndustryStories().INDUSTRY_NODE_STORIES).filter((_, i) => i % 5 === 0).map((id) => ['atlas', `?mode=taxonomy&node=${encodeURIComponent(id)}#atlas`]),
  ...Object.keys(readIndustryStories().INDUSTRY_DOMAIN_STORIES).map((id) => ['atlas', `?mode=taxonomy&domain=${encodeURIComponent(id)}#atlas`]),
  ...Object.keys(readAtlasCopySource().FOUNDATION_LAYER_DISPLAY).map((id) => ['atlas', `?mode=foundations&chapter=${id}#atlas`]),
  ...Object.keys(readConceptStories()).filter((_, i) => i % 4 === 0).map((id) => ['principles', `?mode=concept&node=${encodeURIComponent(id)}#principles`]),
  ['masters', '#masters']
];

const server = await startLocalServer(port, { label: 'research-snapshot/server' });
let browser;
const result = { generatedAt: new Date().toISOString(), states: {} };
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const page = await context.newPage();
  for (const [routeId, suffix] of states) {
    await page.goto(`${base}${suffix}`);
    await page.waitForFunction((id) => document.getElementById(`page-${id}`)?.dataset.aioArchitectureRoute === id, routeId, { timeout: 30000 });
    // Let async artifacts settle: wait until the route's text stops changing for 600 ms.
    let last = '', stable = 0;
    for (let i = 0; i < 40 && stable < 3; i += 1) {
      await page.waitForTimeout(200);
      const text = await page.evaluate((id) => document.getElementById(`page-${id}`)?.innerText || '', routeId);
      stable = text === last ? stable + 1 : 0;
      last = text;
    }
    result.states[suffix] = last.replace(/[ \t]+\n/g, '\n').trim();
  }
} finally {
  await closeAll({ browser, server });
}
writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify({ out, states: Object.keys(result.states).length }));
