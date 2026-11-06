// wave2-c evidence for screen review items 3/15/16/23/24/29 (after). The before shots are in
// _artifacts/screen-review-20261104 (main checkout). Reads the verify-aio server on PORT (default 8797).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), 'review-shots');
mkdirSync(out, { recursive: true });
const base = `http://127.0.0.1:${process.env.PORT || 8797}/`;
const browser = await chromium.launch();
async function open(width, height, dark, mobile = false) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.showPage === 'function');
  if (dark) await page.evaluate(() => document.body.classList.add('dark-theme'));
  return { context, page };
}
const shoot = async (page, selector, name) => { const node = page.locator(selector).first(); await node.scrollIntoViewIfNeeded(); await node.screenshot({ path: resolve(out, `${name}.png`) }); };
for (const [w, h, dark, mobile, tag] of [[1440, 900, true, false, 'desktop-dark'], [768, 1024, true, false, 'tablet-dark'], [390, 844, false, true, 'phone-light'], [390, 844, true, true, 'phone-dark']]) {
  const { context, page } = await open(w, h, dark, mobile);
  await page.evaluate(() => window.showPage('themes'));
  await page.waitForFunction(() => document.querySelector('.capex-flow-seg') && document.querySelector('#theme-playbook .xr-lead') && document.querySelector('.sector-map-sector'), null, { timeout: 60000 });
  await page.evaluate(() => { const fold = document.getElementById('ai-capex-fold'); if (fold && 'open' in fold) fold.open = true; });
  await shoot(page, '#ai-capex-flow', `03-capex-${tag}`);
  await shoot(page, '.tp-section', `15-23-playbook-${tag}`);
  await shoot(page, '.aio-section.sector-map', `24-sector-map-${tag}`);
  await page.evaluate(() => window.showPage('screener'));
  await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length > 0);
  await page.evaluate(() => document.querySelector('.content')?.scrollTo?.({ top: 0 }));
  await page.screenshot({ path: resolve(out, `16-29-screener-${tag}.png`) });
  await page.locator('#screener-results-body tr[data-aio-screener-ticker] td').first().click();
  await page.waitForTimeout(500);
  await shoot(page, '#scr-why-drawer', `16-drawer-${tag}`);
  await context.close();
}
await browser.close();
console.log(`review shots in ${out}`);
