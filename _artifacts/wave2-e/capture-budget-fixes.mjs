// Budget fixes after integration (v59.70): atlas domain overview (secondary text) and the principles first paint
// (catalog.json shipped without indentation). 1440/390 x light/dark screenshots and the visible page text.
//   node _artifacts/wave2-e/capture-budget-fixes.mjs <before|after> [port] [repo-root]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { closeAll, startLocalServer } from '../../scripts/lib/browser-gate.mjs';

const tag = process.argv[2] || 'after';
const port = Number(process.argv[3] || 8833);
const root = process.argv[4] ? resolve(process.argv[4]) : undefined;
const outDir = resolve('_artifacts/wave2-e/screens/budget-fixes');
mkdirSync(outDir, { recursive: true });
const STATES = [
  ['atlas-default', 'atlas', '#atlas', '.atlas-domain-detail-title'],
  ['atlas-cloud', 'atlas', '?mode=taxonomy&domain=domain-cloud-platform#atlas', '.atlas-domain-detail-title'],
  ['principles', 'principles', '#principles', null],
  // The secondary-text gate serves public-data from its dataPin commit, which predates industry-stories.json, so it
  // measures the domain-guide fallback; this state blocks that file the same way.
  ['atlas-fallback', 'atlas', '?mode=taxonomy&domain=domain-cloud-platform#atlas', '.atlas-domain-detail-title', 'industry-stories.json']
];
const server = await startLocalServer(port, { label: 'budget-fixes/server', ...(root ? { root } : {}) });
let browser;
const text = {};
try {
  browser = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', colorScheme: theme });
      await context.addInitScript((value) => { try { localStorage.setItem('aio_theme', value); } catch {} }, theme);
      await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
      const page = await context.newPage();
      for (const [name, routeId, suffix, focus, blocked] of STATES) {
        if (blocked) await page.route(`**/public-data/atlas/${blocked}`, (route) => route.fulfill({ status: 404, body: '' }));
        await page.goto(`http://127.0.0.1:${port}/${suffix}`);
        await page.waitForFunction((id) => document.getElementById(`page-${id}`)?.dataset.aioArchitectureRoute === id, routeId, { timeout: 30000 });
        await page.waitForTimeout(3000);
        if (focus) await page.locator(focus).first().scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
        if (theme === 'light') text[`${width}:${name}`] = await page.evaluate((id) => document.getElementById(`page-${id}`)?.innerText.replace(/[ \t]+\n/g, '\n').trim(), routeId);
        await page.screenshot({ path: resolve(outDir, `${tag}-${width}-${theme}-${name}.png`) });
        if (blocked) await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
      await context.close();
    }
  }
} finally {
  await closeAll({ browser, server });
}
writeFileSync(resolve(`_artifacts/wave2-e/budget-fixes-${tag}.json`), `${JSON.stringify(text, null, 1)}\n`);
console.log(JSON.stringify({ tag, states: Object.keys(text).length }));
