// v59.70 (screen re-review 2026-11-06, 89e8c881): the two re-review defects only a laid-out page shows.
// N5: a 매크로 chapter bar label ('기대인플레', '기간 프리미엄') is not cut by an ellipsis or its column.
// #7: an 오늘 index card drawn from its last close says why its day change is missing instead of leaving the slot blank
// (나스닥 100 had no 11/2 close, so no one-session change).
// Local artifacts only; external requests are aborted.
import { chromium } from 'playwright';
import { closeAll, startLocalServer, freePort } from './lib/browser-gate.mjs';

const port = Number(process.env.CI_REREVIEW_PORT) || await freePort();
const base = `http://127.0.0.1:${port}`;
const failures = [];
const check = (ok, label, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const VIEWPORTS = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 1000 }];
let server, browser;
try {
  server = await startLocalServer(port, { label: 'rereview/server' });
  browser = await chromium.launch({ headless: true });
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.route('**/*', (route) => (route.request().url().startsWith(base) || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), { timeout: 30000 });
    // #7: every fallback card carries a change or the shared '전일 종가 없음'.
    await page.waitForFunction(() => document.querySelectorAll('.home-index-fallback').length > 0, null, { timeout: 30000 }).catch(() => {});
    const blank = await page.evaluate(() => [...document.querySelectorAll('.home-index-card')].filter((card) => card.querySelector('.home-index-fallback'))
      .filter((card) => !(card.querySelector('.home-index-change')?.textContent || '').trim()).map((card) => card.querySelector('.home-index-name strong')?.textContent || '?'));
    const fallbacks = await page.locator('.home-index-fallback').count();
    check(fallbacks > 0, `v59.70 re-review 7 ${viewport.name}: 오늘 draws a last-close index card to check`);
    check(!blank.length, `v59.70 re-review 7 ${viewport.name}: an index card from its last close leaves no blank day change`, blank.join(', '));
    // N5: the rates chapter bar labels fit their column.
    await page.evaluate(() => window.showPage('macro'));
    await page.waitForFunction(() => document.querySelectorAll('#page-macro .mx-ch__x').length > 0, null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll('#page-macro .mx-ch details, #page-macro details.mx-ch__more').forEach((node) => { node.open = true; }));
    const labels = await page.evaluate(() => [...document.querySelectorAll('#page-macro .mx-ch__x')].filter((node) => node.offsetParent)
      .map((node) => ({ text: node.textContent, cut: node.scrollWidth > node.clientWidth + 1 })));
    check(labels.length > 0, `v59.70 re-review N5 ${viewport.name}: 매크로 draws chapter bar labels to check`);
    check(labels.some((label) => label.text === '기대인플레'), `v59.70 re-review N5 ${viewport.name}: the rates chapter draws its 기대인플레 bar`, labels.map((label) => label.text).join(', '));
    const cut = labels.filter((label) => label.cut).map((label) => label.text);
    check(!cut.length, `v59.70 re-review N5 ${viewport.name}: no chapter bar label is cut`, cut.join(', '));
    await page.close();
  }
} finally {
  await closeAll({ browser, server });
}
if (failures.length) {
  console.error(`[screen-rereview] ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('[screen-rereview] OK — index cards from the last close say why a day change is missing; 매크로 bar labels are not cut (390, 1440)');
