// v59.70 wave2-d: the 추세 row's correction base rate loads only when the row opens (boot-budget lazy cut).
import { chromium } from 'playwright';
import { closeAll, startLocalServer, freePort } from '../../scripts/lib/browser-gate.mjs';

const port = await freePort();
const server = await startLocalServer(port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const urls = [];
page.on('request', (req) => urls.push(req.url()));
const hit = () => urls.some((url) => /correction-base-rate/.test(url));
await page.goto(`http://127.0.0.1:${port}/index.html#signal`);
await page.waitForSelector('#regime-board .mk-axis[data-axis="trend"]', { timeout: 30000 });
await page.waitForTimeout(4000);
const before = { fetched: hit(), shown: await page.locator('.mk-correction').count() };
// The local scenario-outcomes.json predates the corrections field (the producer has not run since); seed the
// ci-data-audit fixture so the block has data to draw.
await page.evaluate(async () => {
  const { correctionBaseRates } = await import('/src/domain/scenarios/correction-base-rates.js');
  const closes = []; let level = 100; let day = Date.parse('1990-01-02T00:00:00Z');
  const push = (value) => { closes.push([new Date(day).toISOString().slice(0, 10), value]); day += 86400000; };
  for (let cycle = 0; cycle < 12; cycle += 1) {
    for (let i = 0; i < 20; i += 1) push(level *= 1.002);
    const bear = cycle % 3 === 2; const steps = bear ? 300 : 10; const floor = bear ? 0.75 : 0.92; const top = level;
    for (let i = 1; i <= steps; i += 1) push(top * (1 - (1 - floor) * i / steps));
    for (let i = 1; i <= steps; i += 1) push(top * (floor + (1.01 - floor) * i / steps));
    level = top * 1.01;
  }
  window._aioScenarioOutcomes = { ...(window._aioScenarioOutcomes || {}), corrections: correctionBaseRates(closes) };
});
await page.locator('#regime-board .mk-axis[data-axis="trend"] > summary').click();
await page.waitForSelector('#regime-board .mk-axis[data-axis="trend"] .mk-correction', { timeout: 20000 }).catch(() => {});
const after = { fetched: hit(), shown: await page.locator('#regime-board .mk-axis[data-axis="trend"] .mk-correction').count(), text: (await page.locator('.mk-correction h4').first().textContent().catch(() => '')) || '' };
console.log(JSON.stringify({ before, after }));
await closeAll({ browser, server });
process.exit(!before.fetched && before.shown === 0 && after.fetched && after.shown === 1 ? 0 : 1);
