import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', e => console.log('pageerror:', e.message));
page.on('console', msg => { if (msg.type() === 'error') console.log('console.error:', msg.text()); });

await page.goto('http://localhost:8934/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(15000);
await page.evaluate(() => { if (typeof window.showPage === 'function') window.showPage('sentiment'); });
await page.waitForTimeout(4000);

const data = await page.evaluate(() => {
  const cv = document.getElementById('vix-term-chart');
  if (!cv) return { missing: true };
  const rect = cv.getBoundingClientRect();
  const parent = cv.parentElement;
  const parentRect = parent ? parent.getBoundingClientRect() : null;
  return {
    clientWidth: cv.clientWidth, clientHeight: cv.clientHeight,
    attrWidth: cv.width, attrHeight: cv.height,
    rectWidth: rect.width, rectHeight: rect.height,
    offsetParentNull: cv.offsetParent === null,
    computedDisplay: getComputedStyle(cv).display,
    computedWidth: getComputedStyle(cv).width,
    computedHeight: getComputedStyle(cv).height,
    parentRect: parentRect ? { w: parentRect.width, h: parentRect.height } : null,
    parentStyle: parent ? parent.getAttribute('style') : null,
    chartRegistered: !!window._vixTermChart,
    liveDataPoints: (() => {
      const ld = window._liveData || {};
      return { vix9d: ld['^VIX9D'], vix: ld['^VIX'], vix3m: ld['^VIX3M'], vix6m: ld['^VIX6M'] };
    })(),
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
