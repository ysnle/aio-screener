import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await context.newPage();
await page.goto('https://ysnle.github.io/aio-screener/index.html?qa=v5289-interaction', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction(() => typeof window.showPage === 'function');
await page.waitForTimeout(3500);
const result = {};

await page.evaluate(() => window.showPage('guide', null));
await page.waitForTimeout(300);
const guideInput = page.locator('#page-guide input:visible').first();
await guideInput.fill('포트폴리오');
await page.locator('#page-guide button:visible').filter({ hasText: /^검색$/ }).click();
await page.waitForTimeout(300);
result.guide = {
  openDetails: await page.locator('#page-guide details[open]:visible').count(),
  visibleDetails: await page.locator('#page-guide details:visible').count(),
  openedSummaries: await page.locator('#page-guide details[open]:visible summary').allInnerTexts(),
  searchResultVisible: await page.locator('#guide-search-result').isVisible(),
  searchResultText: (await page.locator('#guide-search-result').innerText()).replace(/\s+/g, ' ').trim()
};

await page.evaluate(() => window.showPage('kr-themes', null));
await page.waitForTimeout(700);
result.krThemes = await page.locator('#page-kr-themes').evaluate((root) => {
  const cards = [...root.querySelectorAll('[class*="theme-card"],.kr-theme-card')].filter((el) => el.offsetParent !== null).slice(0, 3);
  const texts = cards.map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim());
  return { cardTexts: texts, dashCount: texts.join(' ').match(/—/g)?.length || 0 };
});

await page.evaluate(() => window.showPage('home', null));
await page.waitForTimeout(250);
result.aiPanel = await page.evaluate(() => {
  const candidates = [...document.querySelectorAll('[id*="ai" i],[class*="ai-" i]')];
  const panels = candidates.filter((el) => /panel|drawer/.test((el.id + ' ' + el.className).toLowerCase()));
  return panels.map((el) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { id: el.id, cls: String(el.className).slice(0, 100), display: cs.display, visibility: cs.visibility, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), ariaHidden: el.getAttribute('aria-hidden') };
  }).slice(0, 20);
});
await page.locator('body').click({ position: { x: 2, y: 2 } });
const focusSequence = [];
for (let i = 0; i < 38; i++) {
  await page.keyboard.press('Tab');
  focusSequence.push(await page.evaluate(() => {
    const el = document.activeElement;
    const r = el.getBoundingClientRect();
    const hiddenPanel = el.closest('[id*="ai" i],[class*="ai-" i]');
    return {
      i: 0,
      tag: el.tagName,
      name: (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      left: Math.round(r.left), right: Math.round(r.right),
      insideAi: !!hiddenPanel,
      aiAncestor: hiddenPanel ? (hiddenPanel.id || String(hiddenPanel.className).slice(0, 80)) : ''
    };
  }));
}
focusSequence.forEach((row, index) => { row.i = index + 1; });
result.focus = {
  sequence: focusSequence,
  offscreen: focusSequence.filter((row) => row.right <= 0 || row.left >= 390),
  insideAi: focusSequence.filter((row) => row.insideAi)
};

writeFileSync(resolve('_artifacts', 'live-human-ux-v5289', 'interaction-report.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
