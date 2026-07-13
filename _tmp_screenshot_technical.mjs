import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

await page.goto('http://localhost:8934/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(15000);

await page.evaluate(() => { if (typeof window.showPage === 'function') window.showPage('technical'); });
await page.waitForTimeout(4000);

const dir = 'C:\\Users\\zmfhd\\AppData\\Local\\Temp\\claude\\C--Projects-AIO\\b8660fd9-4e1d-4125-9c10-3170126aa9fd\\scratchpad';
await page.screenshot({ path: dir + '\\technical-full.png', fullPage: true });

const heroBox = await page.locator('#health-score-display').first().boundingBox();
console.log('hero score box:', heroBox);

const data = await page.evaluate(() => {
  const t = id => { const el = document.getElementById(id); return el ? el.textContent.trim() : '__MISSING__'; };
  return {
    healthScore: t('health-score-display'),
    healthRegime: t('health-regime-display'),
    hcSpy: t('hc-spy'),
    hcQqq: t('hc-qqq'),
    hcVix: t('hc-vix'),
    m7Row: (document.getElementById('m7-health-row') || {}).children ? document.getElementById('m7-health-row').children.length : -1,
    breadthPct: t('breadth-pct'),
    rsi: t('tech-rsi-val'),
    macd: t('tech-macd-val'),
    stoch: t('tech-stoch-val'),
    adx: t('tech-adx-val'),
    tickerInputPlaceholder: (document.getElementById('ticker-analysis-input') || {}).placeholder,
    candleTitle: t('tech-candle-title'),
    candleMeta: t('tech-candle-meta'),
    srLevels: (document.getElementById('sr-levels-container') || {}).children ? document.getElementById('sr-levels-container').children.length : -1,
    wsStage1: t('ws-stage1'),
    wsStage2: t('ws-stage2'),
    wsAnalysis: t('ws-analysis').slice(0, 80),
    mtfCells: (document.getElementById('mtf-analysis') || {}).children ? document.getElementById('mtf-analysis').children.length : -1,
    mtfVerdict: t('mtf-verdict-text').slice(0, 80),
    techHealthPill: t('tech-health-pill'),
    chartRegistered: !!(window._aioChartRegistry && window._aioChartRegistry.get('tech-candle-chart')),
  };
});
console.log(JSON.stringify(data, null, 2));

// click QQQ pill and verify chart title updates
await page.click('[data-action="_aioTechSymSwitch"][data-arg="QQQ"]');
await page.waitForTimeout(2500);
const afterQQQ = await page.evaluate(() => ({
  title: document.getElementById('tech-candle-title').textContent,
  pillBg: getComputedStyle(document.querySelector('#tech-sym-toggle span[data-arg="QQQ"]')).backgroundColor,
}));
console.log('after QQQ click:', JSON.stringify(afterQQQ));

// expand one details to confirm it works
const detailsCount = await page.locator('#page-technical details').count();
console.log('details count on page:', detailsCount);
await page.locator('#page-technical details summary').first().click();
await page.waitForTimeout(300);
const firstDetailsOpen = await page.locator('#page-technical details').first().evaluate(el => el.open);
console.log('first details opens on click:', firstDetailsOpen);

console.log('JS errors:', errors.length ? errors.slice(0, 30) : 'none');

await browser.close();
