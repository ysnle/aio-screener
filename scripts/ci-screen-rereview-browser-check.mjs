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
    await page.evaluate(() => { window.showPage('macro'); document.getElementById('page-macro').dataset.view = 'all'; }); // every view of the page
    await page.waitForFunction(() => document.querySelectorAll('#page-macro .mx-ch__x').length > 0, null, { timeout: 30000 }).catch(() => {});
    // v60.59: the section redraws (topic re-picked) when a late artifact lands — history, the researched rows, the funding
    // chain — so every topic is shown and read in one task; a redraw between two evaluates left only the picked topic.
    const labels = await page.evaluate(() => {
      document.querySelectorAll('#page-macro .mx-ch').forEach((node) => { node.hidden = false; }); // every topic, not only the picked one
      return [...document.querySelectorAll('#page-macro .mx-ch__x')].filter((node) => node.offsetParent)
        .map((node) => ({ text: node.textContent, cut: node.scrollWidth > node.clientWidth + 1 }));
    });
    check(labels.length > 0, `v59.70 re-review N5 ${viewport.name}: 매크로 draws chapter bar labels to check`);
    check(labels.some((label) => label.text === '기대인플레'), `v59.70 re-review N5 ${viewport.name}: the rates chapter draws its 기대인플레 bar`, labels.map((label) => label.text).join(', '));
    const cut = labels.filter((label) => label.cut).map((label) => label.text);
    check(!cut.length, `v59.70 re-review N5 ${viewport.name}: no chapter bar label is cut`, cut.join(', '));
    // v60.61: the view row sticks just under the top of the scroller with an opaque full-width band behind it (a narrow
    // pill floated over the text and the text showed beside and above it).
    const row = await page.evaluate(() => {
      const scroller = document.getElementById('main-content');
      const views = [...document.querySelectorAll('#page-macro .page-views')].find((node) => node.getClientRects().length);
      if (!scroller || !views || scroller.scrollHeight - scroller.clientHeight < 600) return null;
      scroller.scrollTop = 500;
      const style = getComputedStyle(views);
      return { position: style.position, band: style.boxShadow !== 'none' && style.clipPath !== 'none', gap: Math.round(views.getBoundingClientRect().top - scroller.getBoundingClientRect().top) };
    });
    check(row, `v60.61 view row ${viewport.name}: 매크로 has a view row and a scrolled page to check`);
    check(row && row.position === 'sticky' && row.band && row.gap >= 0 && row.gap <= 8, `v60.61 view row ${viewport.name}: sticks under the top of the scroller with its band`, JSON.stringify(row));
    await page.close();
    // v60.61: entering 포트폴리오 directly and opening the sample preview requests the market-day ledger (the cause line
    // was drawn only when another screen had loaded it first); on the phone the cause row is the last line of its card.
    const direct = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await direct.route('**/*', (route) => (route.request().url().startsWith(base) || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    await direct.goto(`${base}/index.html#portfolio`, { waitUntil: 'domcontentloaded' });
    const preview = direct.locator('#page-portfolio button', { hasText: '예시로 미리 보기' }).first();
    await preview.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    check(await preview.count() > 0, `v60.61 portfolio ${viewport.name}: an empty portfolio offers the sample preview`);
    if (await preview.count()) {
      const ledger = direct.waitForResponse((response) => /market-day\.json/.test(response.url()), { timeout: 15000 }).then(() => true, () => false);
      await preview.click();
      check(await ledger, `v60.61 portfolio ${viewport.name}: the sample preview requests the market-day ledger`);
      await direct.waitForSelector('#page-portfolio tr.pfp-cause', { timeout: 5000 }).catch(() => {});
      const detached = await direct.evaluate(() => [...document.querySelectorAll('#page-portfolio tr.pfp-cause')].filter((cause) => {
        const card = cause.previousElementSibling?.getBoundingClientRect();
        const own = cause.getBoundingClientRect();
        return !card || Math.abs(own.top - card.bottom) > 1 || Math.abs(own.left - card.left) > 1 || Math.abs(own.width - card.width) > 1;
      }).map((cause) => cause.dataset.causeFor));
      if (viewport.name === 'phone') check(!detached.length, 'v60.61 portfolio phone: a cause row is joined to its stock card', detached.join(', '));
    }
    await direct.close();
  }
} finally {
  await closeAll({ browser, server });
}
if (failures.length) {
  console.error(`[screen-rereview] ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('[screen-rereview] OK — index cards from the last close say why a day change is missing; 매크로 bar labels are not cut (390, 1440)');
