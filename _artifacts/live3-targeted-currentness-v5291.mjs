import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = process.env.AIO_AUDIT_URL || 'http://127.0.0.1:8894/index.html?qa=live3-currentness';
const outDir = resolve('_artifacts/live3-targeted-currentness-v5291');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction(() => typeof window.showPage === 'function');
await page.waitForTimeout(20000);

async function show(route, file) {
  await page.evaluate((id) => window.showPage(id, null), route);
  await page.waitForFunction((id) => document.getElementById('page-' + id)?.classList.contains('active'), route);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(outDir, file), fullPage: false });
}

await show('signal', 'signal.png');
const result = await page.evaluate(() => {
  const fg = window.AIO?.getCanonicalMetric?.('fg') || null;
  return {
    version: document.querySelector('.version-badge')?.textContent?.trim() || document.title,
    fearGreed: fg ? { value: fg.value, sourceKind: fg.sourceKind, sourceLabel: fg.sourceLabel, status: fg.status, freshness: fg.freshness } : null,
    signalText: document.getElementById('page-signal')?.innerText.replace(/\s+/g, ' ').slice(0, 900) || '',
    serverData: window._serverDataMeta ? { generatedAt: window._serverDataMeta.generatedAt, symbolsOk: window._serverDataMeta.symbolsOk, fearGreedOk: window._serverDataMeta.fearGreedOk } : null
  };
});
await show('kr-supply', 'kr-supply.png');
result.krSupply = await page.evaluate(() => ({
  institution: document.getElementById('kr-supply-inst-detail')?.innerText.replace(/\s+/g, ' ').trim() || '',
  program: document.getElementById('kr-supply-program-table')?.innerText.replace(/\s+/g, ' ').trim() || '',
  values: ['kr-supply-kospi-foreign','kr-supply-kospi-inst','kr-supply-kospi-retail','kr-supply-kosdaq-foreign','kr-supply-kosdaq-inst','kr-supply-kosdaq-retail'].map((id) => document.getElementById(id)?.textContent?.trim())
}));
result.pageErrors = pageErrors;
writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
