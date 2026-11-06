// masters.js split evidence: the visible text of #page-masters (and screenshots) for the overview, the ticker
// lookup and every detail tab of three managers. Run before and after the split and compare.
//   node _artifacts/wave2-e/masters-split-snapshot.mjs <before|after> [port]
//   node _artifacts/wave2-e/masters-split-snapshot.mjs --compare a.json b.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { closeAll, startLocalServer } from '../../scripts/lib/browser-gate.mjs';

const args = process.argv.slice(2);
if (args[0] === '--compare') {
  const [a, b] = [args[1], args[2]].map((file) => JSON.parse(readFileSync(file, 'utf8')).states);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const changed = keys.filter((key) => a[key] !== b[key]);
  changed.forEach((key) => console.log(`changed: ${key}`));
  console.log(JSON.stringify({ states: keys.length, changed: changed.length }));
  process.exit(changed.length ? 1 : 0);
}
const tag = args[0] || 'after';
const port = Number(args[1] || 8821);
const outDir = resolve('_artifacts/wave2-e/screens/masters-split');
mkdirSync(outDir, { recursive: true });
const server = await startLocalServer(port, { label: 'masters-split/server' });
let browser;
const states = {};
const settle = async (page) => {
  let last = '', stable = 0;
  for (let i = 0; i < 50 && stable < 3; i += 1) {
    await page.waitForTimeout(200);
    const text = await page.evaluate(() => document.getElementById('page-masters')?.innerText || '');
    stable = text === last ? stable + 1 : 0;
    last = text;
  }
  return last.replace(/[ \t]+\n/g, '\n').trim();
};
try {
  browser = await chromium.launch();
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', colorScheme: 'light' });
    await context.addInitScript(() => { try { localStorage.setItem('aio_theme', 'light'); } catch {} });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    const page = await context.newPage();
    const shot = async (name) => { if (width === 1440 || /overview|changes/.test(name)) await page.screenshot({ path: resolve(outDir, `${tag}-${width}-${name}.png`), fullPage: true }); };
    await page.goto(`http://127.0.0.1:${port}/#masters`);
    await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioArchitectureRoute === 'masters', null, { timeout: 30000 });
    states[`${width}:default`] = await settle(page);
    await shot('default');
    const managers = await page.$$eval('[data-masters-action="select-manager"]', (nodes) => [...new Set(nodes.map((node) => node.dataset.mastersValue))].slice(0, 3));
    for (const id of managers) {
      await page.click(`[data-masters-action="select-manager"][data-masters-value="${id}"]`);
      const views = await page.$$eval('[data-masters-action="view"]', (nodes) => nodes.map((node) => node.dataset.mastersValue));
      for (const view of views) {
        await page.click(`[data-masters-action="view"][data-masters-value="${view}"]`);
        states[`${width}:${id}:${view}`] = await settle(page);
        if (id === managers[0]) await shot(`${id}-${view}`);
      }
    }
    const style = await page.$('[data-masters-action="style-overview"]');
    if (style) { await style.click(); states[`${width}:style-overview`] = await settle(page); await shot('style-overview'); }
    const lookup = await page.$('[data-masters-action="goto-ticker-lookup"]');
    if (lookup) {
      await lookup.click();
      states[`${width}:ticker-lookup`] = await settle(page);
      const field = await page.$('.masters-ticker-lookup-input');
      if (field) { await field.fill('AAPL'); states[`${width}:ticker-lookup:AAPL`] = await settle(page); await shot('ticker-lookup-AAPL'); }
    }
    await context.close();
  }
} finally {
  await closeAll({ browser, server });
}
const out = resolve(`_artifacts/wave2-e/masters-split-${tag}.json`);
writeFileSync(out, `${JSON.stringify({ generatedAt: new Date().toISOString(), states }, null, 1)}\n`);
console.log(JSON.stringify({ out, states: Object.keys(states).length }));
