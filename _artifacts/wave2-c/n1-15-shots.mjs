// wave2-c evidence for re-review N1 + #15 (screen-review-20261104/RE-REVIEW.md): the 테마 screen at 390/1440 x
// light/dark with a stale basis (page clock five days after the data's US session), OUT=before|after. Saves the
// '세부 테마 상위' card, the page top, and the three 1-month #1 readings (head, 주도 단계 lead, scenario) as text.
// Needs the verify-aio server on PORT (default 8797).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'n1-15', process.env.OUT || 'after');
mkdirSync(out, { recursive: true });
const base = `http://127.0.0.1:${process.env.PORT || 8797}/`;
const usDay = readFileSync(resolve(here, '../../public-data/screener.json'), 'utf8').match(/"factorSessionDateByMarket":\{"US":"(\d{4}-\d{2}-\d{2})"/)[1];
const clock = new Date(Date.parse(`${usDay}T12:00:00Z`) + 5 * 86400000);
const browser = await chromium.launch();
const texts = {};
for (const view of [{ id: '1440', width: 1440, height: 1000 }, { id: '390', width: 390, height: 844, mobile: true }]) {
  for (const dark of [false, true]) {
    const tag = `${view.id}-${dark ? 'dark' : 'light'}`;
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, isMobile: !!view.mobile, hasTouch: !!view.mobile, colorScheme: dark ? 'dark' : 'light', serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.setFixedTime(clock);
    await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showPage === 'function', null, { timeout: 30000 });
    if (await page.evaluate(() => document.body.classList.contains('dark-theme')) !== dark) await page.evaluate(() => document.body.classList.toggle('dark-theme'));
    await page.evaluate(() => window.showPage('themes'));
    await page.waitForFunction(() => document.querySelector('.v2-themes-top__row') && document.querySelector('#theme-playbook .xr-lead'), null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: resolve(out, `themes-top-${tag}.png`) });
    const card = page.locator('.v2-themes-top').first();
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: resolve(out, `subtheme-card-${tag}.png`) });
    texts[tag] = await page.evaluate(() => ({
      stale: !!document.querySelector('.v2-themes-top__stale'),
      rowHeights: [...document.querySelectorAll('.v2-themes-top__row')].map((n) => Math.round(n.getBoundingClientRect().height)),
      valueWidths: [...document.querySelectorAll('.v2-themes-top__value')].map((n) => Math.round(n.getBoundingClientRect().width)),
      head: document.querySelector('#page-themes .v2-themes-hero')?.innerText.replace(/\s+/g, ' ').slice(0, 400) || '',
      strengthLead: document.querySelector('#theme-strength-lead, .theme-strength-lead')?.innerText.replace(/\s+/g, ' ').slice(0, 300) || '',
      scenario: document.querySelector('#theme-playbook .xr-lead')?.innerText.replace(/\s+/g, ' ') || ''
    }));
    texts[tag].errors = errors.length;
    console.log(tag, JSON.stringify({ stale: texts[tag].stale, rows: texts[tag].rowHeights, values: texts[tag].valueWidths, errors: errors.length }));
    await context.close();
  }
}
await browser.close();
writeFileSync(resolve(out, 'texts.json'), `${JSON.stringify({ clock: clock.toISOString(), usDay, texts }, null, 1)}\n`);
