// wave2-d: dump each route's text with every fold open (screen re-review lookups). Usage: node dump-text.mjs <outDir> [routes]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { closeAll, startLocalServer, freePort } from '../../scripts/lib/browser-gate.mjs';

const out = process.argv[2];
const routes = (process.argv[3] || 'home,briefing,signal,macro,fxbond,charts,themes').split(',');
mkdirSync(out, { recursive: true });
const port = await freePort();
const server = await startLocalServer(port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`http://127.0.0.1:${port}/index.html#home`);
await page.waitForTimeout(5000);
for (const route of routes) {
  await page.evaluate((r) => { location.hash = `#${r}`; }, route);
  await page.waitForTimeout(6000);
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await page.waitForTimeout(2500);
  const text = await page.evaluate(() => { const p = [...document.querySelectorAll('[id^=page-]')].find((n) => n.offsetParent && !n.hidden && !/-label$/.test(n.id)); return (p || document.body).innerText; });
  writeFileSync(join(out, `${route}.txt`), text);
}
await closeAll({ browser, server });
