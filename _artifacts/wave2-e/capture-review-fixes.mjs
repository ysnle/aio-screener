// Screen-review 19/28/30 before/after captures: 3 widths x light/dark for the four affected states.
//   node _artifacts/wave2-e/capture-review-fixes.mjs <before|after> [port]
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { closeAll, startLocalServer } from '../../scripts/lib/browser-gate.mjs';

const tag = process.argv[2] || 'after';
const port = Number(process.argv[3] || 8796);
const outDir = resolve('_artifacts/wave2-e/screens/review-fixes');
mkdirSync(outDir, { recursive: true });
const WIDTHS = [[1440, 900], [768, 1024], [390, 844]];
const STATES = [
  // 19: domain overview (heading + sentence + fold), frame aside (concept block), lesson aside, frame list title.
  ['atlas-domain', 'atlas', '?mode=taxonomy&domain=domain-cloud-platform#atlas', '[data-atlas-domain]'],
  ['principles-frame', 'principles', '?mode=frames&node=truth-leverage-gauges#principles', '.af-issue'],
  // 30: hub card row; 28: top-10 bars.
  ['principles-hub', 'principles', '#principles', null],
  ['masters-bars', 'masters', '#masters', '.masters-weight-bars']
];
const server = await startLocalServer(port, { label: 'review-fixes/server' });
let browser;
const report = [];
try {
  browser = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    for (const [width, height] of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', colorScheme: theme });
      await context.addInitScript((value) => { try { localStorage.setItem('aio_theme', value); } catch {} }, theme);
      await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
      const page = await context.newPage();
      for (const [name, routeId, suffix, focus] of STATES) {
        await page.goto(`http://127.0.0.1:${port}/${suffix}`);
        await page.waitForFunction((id) => document.getElementById(`page-${id}`)?.dataset.aioArchitectureRoute === id, routeId, { timeout: 30000 });
        await page.waitForTimeout(2500);
        if (focus) await page.locator(focus).first().scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(400);
        const metrics = await page.evaluate(() => {
          const row = document.querySelector('.rl-hub-cards, [data-principles-hub-cards]') || null;
          const offRight = [...document.querySelectorAll('#page-principles article, #page-principles section > *')]
            .filter((node) => node.getBoundingClientRect().right > innerWidth + 1 && !node.closest('[data-scroll-row]')).length;
          return { scrollWidth: document.documentElement.scrollWidth, innerWidth, offRight, row: row?.className || null };
        });
        const file = `${tag}-${width}-${theme}-${name}.png`;
        await page.screenshot({ path: resolve(outDir, file) });
        report.push({ file, ...metrics });
      }
      await context.close();
    }
  }
} finally {
  await closeAll({ browser, server });
}
console.log(JSON.stringify(report));
