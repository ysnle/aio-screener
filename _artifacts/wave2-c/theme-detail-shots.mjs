// wave2-c evidence: theme detail on the integrated tree at 1440/390 x light/dark, opened the way the text-budget gate
// opens it (addressThemeDetail). Needs the verify-aio server on PORT (default 8797).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addressThemeDetail } from '../../scripts/lib/theme-detail-address.mjs';

const out = resolve(dirname(fileURLToPath(import.meta.url)), 'theme-detail-shots');
mkdirSync(out, { recursive: true });
const base = `http://127.0.0.1:${process.env.PORT || 8797}/`;
const browser = await chromium.launch();
for (const view of [{ id: '1440', width: 1440, height: 1000 }, { id: '390', width: 390, height: 844, mobile: true }]) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, isMobile: !!view.mobile, hasTouch: !!view.mobile, colorScheme: scheme, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), null, { timeout: 30000 });
    await page.evaluate((s) => { try { document.documentElement.dataset.theme = s; } catch (_) {} }, scheme);
    await page.waitForFunction(() => Array.isArray(window.THEME_MAP) && window.THEME_MAP.length > 0, null, { timeout: 45000 });
    const id = await addressThemeDetail(page);
    await page.waitForFunction(() => document.getElementById('theme-detail-panel')?.style.display !== 'none', null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: resolve(out, `theme-detail-${view.id}-${scheme}.png`), fullPage: false });
    console.log(`${view.id} ${scheme} theme=${id} errors=${errors.length}`);
    await context.close();
  }
}
await browser.close();
