import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
let currentRoute = 'boot';
const errors = [];
page.on('pageerror', (error) => errors.push({ route: currentRoute, kind: 'pageerror', message: String(error?.message || error) }));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push({ route: currentRoute, kind: 'console', message: message.text().slice(0, 500) });
});
await page.goto(process.env.AIO_AUDIT_URL || 'https://ysnle.github.io/aio-screener/index.html?qa=v5289-targeted', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction(() => typeof window.showPage === 'function');
await page.waitForTimeout(5000);

const result = {};
async function show(route, wait = 1200) {
  currentRoute = route;
  await page.evaluate((id) => window.showPage(id, null), route);
  await page.waitForFunction((id) => document.getElementById('page-' + id)?.classList.contains('active'), route);
  await page.waitForTimeout(wait);
}

await show('guide');
const guideInput = page.locator('#page-guide input:visible').first();
result.guide = {
  inputCount: await page.locator('#page-guide input:visible').count(),
  placeholder: await guideInput.getAttribute('placeholder')
};
await guideInput.fill('포트폴리오');
await page.waitForTimeout(250);
result.guide.visibleDetails = await page.locator('#page-guide details:visible').count();
result.guide.openDetails = await page.locator('#page-guide details[open]:visible').count();
result.guide.visibleText = (await page.locator('#page-guide').innerText()).replace(/\s+/g, ' ').slice(0, 500);

await show('market-news', 6000);
result.marketNews = await page.locator('#page-market-news').evaluate((root) => {
  const text = (root.innerText || '').replace(/\s+/g, ' ').trim();
  const topText = [...root.children].slice(0, 8).map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()).join(' | ');
  return {
    topText: topText.slice(0, 1200),
    dashSnippets: [...text.matchAll(/.{0,24}—.{0,24}/g)].slice(0, 12).map((m) => m[0]),
    visibleRows: [...root.querySelectorAll('.news-item,.news-card,.feed-item,tr')].filter((el) => el.offsetParent !== null).length,
    buttonNames: [...root.querySelectorAll('button')].filter((el) => el.offsetParent !== null).map((el) => (el.innerText || el.getAttribute('aria-label') || '').trim()).filter(Boolean)
  };
});

await show('briefing', 3500);
result.briefing = await page.locator('#page-briefing').evaluate((root) => {
  const candidates = [...root.querySelectorAll('a,.news-title,.news-item,.briefing-news-item')].filter((el) => el.offsetParent !== null);
  const titles = candidates.map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()).filter((x) => x.length > 25).slice(0, 12);
  return { titles, koreanTitleCount: titles.filter((x) => /[가-힣]/.test(x)).length };
});

await show('fundamental', 18000);
result.fundamental = await page.locator('#page-fundamental').evaluate((root) => {
  const loading = document.getElementById('fundamental-loading');
  const resultEl = document.getElementById('fundamental-result');
  return {
    loadingVisible: !!loading && getComputedStyle(loading).display !== 'none',
    loadingText: (loading?.innerText || '').replace(/\s+/g, ' ').trim(),
    resultVisible: !!resultEl && getComputedStyle(resultEl).display !== 'none',
    resultTextLength: (resultEl?.innerText || '').replace(/\s+/g, ' ').trim().length,
    pageText: (root.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1200)
  };
});

await show('kr-supply', 2500);
result.krSupply = await page.locator('#page-kr-supply').evaluate((root) => {
  const visible = [...root.querySelectorAll('*')].filter((el) => el.offsetParent !== null);
  const statusTexts = visible.map((el) => (el.children.length ? '' : (el.textContent || '').replace(/\s+/g, ' ').trim()))
    .filter((text) => /실패|폴백|CORS|원천 확인|미수신/.test(text));
  return { statusTexts: [...new Set(statusTexts)].slice(0, 20), total: [...new Set(statusTexts)].length };
});

await show('kr-themes', 1800);
result.krThemes = await page.locator('#page-kr-themes').evaluate((root) => {
  const cards = [...root.querySelectorAll('.kr-theme-card,.theme-card')].filter((el) => el.offsetParent !== null);
  const rows = [...root.querySelectorAll('.kr-theme-stock,.theme-stock,.stock-row')].filter((el) => el.offsetParent !== null);
  const rowTexts = rows.map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim());
  return {
    visibleCards: cards.length,
    visibleRows: rows.length,
    dashRows: rowTexts.filter((text) => /(?:^|\s)—(?:\s|$)/.test(text)).length,
    samples: rowTexts.slice(0, 24)
  };
});

await show('home');
result.closedAiKeyboard = await page.evaluate(async () => {
  const panel = document.querySelector('#ai-panel,.ai-panel,.ai-drawer,#unified-ai-panel');
  const panelVisible = panel ? (() => { const cs = getComputedStyle(panel), r = panel.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.left < innerWidth && r.right > 0; })() : null;
  document.body.focus();
  const hits = [];
  for (let i = 0; i < 45; i++) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  }
  return { panelFound: !!panel, panelVisible, note: 'Sequential focus evidence is recorded by the main audit; DOM state only here.' };
});

result.errorSummary = {
  total: errors.length,
  pageErrors: errors.filter((x) => x.kind === 'pageerror'),
  consoleByRoute: Object.fromEntries(Object.entries(Object.groupBy(errors.filter((x) => x.kind === 'console'), (x) => x.route)).map(([key, value]) => [key, value.length])),
  samples: errors.slice(0, 20)
};

writeFileSync(resolve('_artifacts', 'live-human-ux-v5289', 'targeted-report.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
