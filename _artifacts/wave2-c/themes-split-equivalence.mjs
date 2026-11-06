// wave2-c evidence: the themes.js split changes no behaviour. Run once per code state (OUT=before|after) against the
// verify-aio server on PORT (default 8797); it records a normalized DOM hash of #page-themes / #page-theme-detail for
// every state of a scripted path (load, each period tab, the 등락/회전 verdict view, back), three laps, at desktop and
// phone, plus screenshots. Compare the two JSON files: identical hashes per state = identical behaviour.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const tag = process.env.OUT || 'after';
const out = resolve(dirname(fileURLToPath(import.meta.url)), 'themes-split', tag);
mkdirSync(out, { recursive: true });
const base = `http://127.0.0.1:${process.env.PORT || 8797}/`;
const browser = await chromium.launch();
const record = {};
const hashOf = (page, id) => page.evaluate((pageId) => {
  const node = document.getElementById(pageId);
  if (!node) return 'missing';
  // Volatile bits only: element ids made from Date.now() and the AI ask rows' generated ids.
  return node.innerHTML.replace(/fb-\d{10,}/g, 'fb').replace(/\b\d{13}\b/g, 'T');
}, id).then((html) => createHash('sha256').update(html).digest('hex').slice(0, 16));
for (const view of [{ id: 'desktop', width: 1440, height: 1000 }, { id: 'phone', width: 390, height: 844, mobile: true }]) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, isMobile: !!view.mobile, hasTouch: !!view.mobile, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(() => { try { localStorage.clear(); } catch (_) {} });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00Z'));
  await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.showPage === 'function');
  await page.waitForFunction(() => (window.AIO_ARCH?.getScreenerRows?.() || []).length > 0, null, { timeout: 45000 });
  await page.evaluate(() => window.showPage('themes'));
  await page.waitForFunction(() => document.querySelector('#sector-perf-tabs button[data-period]') && document.querySelector('.sector-map-sector') && document.querySelector('#theme-playbook .xr-lead'), null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  const states = [];
  const snap = async (name) => {
    await page.waitForTimeout(900);
    states.push([name, await hashOf(page, 'page-themes')]);
    if (process.env.DUMP === 'all') writeFileSync(resolve(out, `${view.id}-${name}.html`), (await page.evaluate(() => document.getElementById('page-themes').innerHTML)).replace(/></g, '>\n<'));
  };
  await snap('load');
  if (process.env.DUMP) writeFileSync(resolve(out, `${view.id}-load.html`), (await page.evaluate(() => document.getElementById('page-themes').innerHTML)).replace(/></g, '>\n<'));
  await page.screenshot({ path: resolve(out, `${view.id}-themes.png`), fullPage: false });
  // Lap 0 is a warm-up (lazy chunks and late artifacts land during it); laps 1-3 are the round trips compared.
  for (let lap = 0; lap <= 3; lap += 1) {
    for (const period of ['1w', '1m', '3m', '1d']) {
      await page.click(`#sector-perf-tabs button[data-period="${period}"]`);
      await snap(`lap${lap}-period-${period}`);
    }
    const tabs = page.locator('#rrg-view-tabs button');
    const count = await tabs.count();
    for (let i = count - 1; i >= 0; i -= 1) { await tabs.nth(i).click(); await snap(`lap${lap}-view-${i}`); }
  }
  await page.evaluate(() => { window.location.hash = '#themes?theme=software'; });
  await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'page-theme-detail' && document.getElementById('theme-detail-reading'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  states.push(['detail-software', await hashOf(page, 'page-theme-detail')]);
  await page.screenshot({ path: resolve(out, `${view.id}-theme-detail.png`), fullPage: false });
  record[view.id] = { states, errors };
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, 'hashes.json'), `${JSON.stringify(record, null, 1)}\n`);
for (const [id, { states, errors }] of Object.entries(record)) {
  const laps = [1, 2, 3].map((lap) => states.filter(([name]) => name.startsWith(`lap${lap}-`)).map(([, h]) => h).join(','));
  console.log(`${tag} ${id}: ${states.length} states, laps identical ${new Set(laps).size === 1}, errors ${errors.length}`);
}
