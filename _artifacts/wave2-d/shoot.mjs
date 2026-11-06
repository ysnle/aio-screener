// v59.70 wave2-d: screenshots of one route at 1440/768/390 × light/dark (quality bar). Usage:
//   node _artifacts/wave2-d/shoot.mjs <port> <prefix> <hash-route> [selector-to-scroll] [setup-js]
// Writes _artifacts/wave2-d/screens/<prefix>-<width>-<theme>.png (full page).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [port = '8767', prefix = 'shot', route = '', selector = '', setup = ''] = process.argv.slice(2);
const out = join(dirname(fileURLToPath(import.meta.url)), 'screens');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', colorScheme: theme });
    const page = await context.newPage();
    await page.addInitScript((t) => { try { localStorage.setItem('aio_theme', t); } catch (_) {} }, theme);
    // SHOOT_INJECT=<json file>: fixture data a producer has not published yet, read by the setup script as window.__inject.
    if (process.env.SHOOT_INJECT) await page.addInitScript((data) => { window.__inject = data; }, JSON.parse(readFileSync(process.env.SHOOT_INJECT, 'utf8')));
    await page.goto(`http://127.0.0.1:${port}/${route ? `#${route}` : ''}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    if (setup) { await page.evaluate(setup).catch((error) => console.error('setup', error.message)); await page.waitForTimeout(3500); }
    await page.evaluate((t) => { document.body.classList.toggle('dark-theme', t === 'dark'); }, theme);
    if (selector) await page.locator(selector).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(4000);
    // The app scrolls inside its own container; let it grow so the full-page shot holds the whole route.
    const tall = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, ...[...document.querySelectorAll('body *')]
      .filter((node) => /(auto|scroll)/.test(getComputedStyle(node).overflowY)).map((node) => node.scrollHeight)));
    await page.setViewportSize({ width, height: Math.min(Math.max(height, tall + 40), 16000) });
    await page.waitForTimeout(1200);
    const file = join(out, `${prefix}-${width}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
    // The changed block on its own (selector argument), so a reviewer need not find it in a tall page.
    if (selector) {
      const crop = file.replace(/\.png$/, '-crop.png');
      await page.locator(selector).first().screenshot({ path: crop }).then(() => console.log(crop)).catch((error) => console.error('crop', error.message.split('\n')[0]));
    }
    await context.close();
  }
}
await browser.close();
