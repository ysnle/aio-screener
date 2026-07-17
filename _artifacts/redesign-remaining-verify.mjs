import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const isMobile = process.env.AIO_MOBILE === '1';
const out = resolve('_artifacts', isMobile ? 'redesign-remaining-mobile' : 'redesign-remaining-desktop');
const routes = ['guide','kr-home','kr-supply','kr-themes','kr-macro','kr-technical'];
mkdirSync(out, { recursive:true });
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({
  viewport:isMobile ? { width:390, height:844 } : { width:1440, height:900 },
  deviceScaleFactor:1,
  isMobile,
  hasTouch:isMobile
});
const errors = [];
page.on('pageerror', error => errors.push(String(error.message || error)));
await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:30000 });
await page.waitForFunction(() => typeof window.showPage === 'function');
const report = [];
for (const [index, route] of routes.entries()) {
  await page.evaluate(id => window.showPage(id, null), route);
  await page.waitForTimeout(500);
  await page.evaluate(() => scrollTo(0, 0));
  const metrics = await page.evaluate(id => {
    const root = document.getElementById('page-' + id);
    const visible = el => { const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0; };
    return {
      route:id,
      height:root.scrollHeight,
      directVisible:[...root.children].filter(visible).length,
      direct:[...root.children].filter(visible).map((el,index) => ({ index, id:el.id, cls:el.className, text:(el.innerText||'').replace(/\s+/g,' ').trim().slice(0,100), height:Math.round(el.getBoundingClientRect().height) })),
      details:[...root.querySelectorAll('details')].filter(visible).length,
      decisionHeaders:[...root.querySelectorAll('.aio-decision-header')].filter(visible).length,
      textLength:(root.innerText||'').replace(/\s+/g,' ').trim().length
    };
  }, route);
  report.push(metrics);
  const prefix=String(index+1).padStart(2,'0')+'-'+route;
  await page.screenshot({ path:resolve(out,prefix+'-fold.png'), fullPage:false, animations:'disabled' });
  await page.screenshot({ path:resolve(out,prefix+'-full.png'), fullPage:true, animations:'disabled' });
}
await page.evaluate(() => window.openGlossary());
await page.waitForTimeout(250);
const glossary = await page.evaluate(() => {
  const modal=document.getElementById('glossary-modal');
  return { visible:getComputedStyle(modal).display!=='none', terms:modal.querySelectorAll('.aio-glossary-item').length, textLength:(modal.innerText||'').replace(/\s+/g,' ').trim().length };
});
await page.screenshot({ path:resolve(out,'07-glossary-fold.png'), fullPage:false, animations:'disabled' });
writeFileSync(resolve(out,'report.json'), JSON.stringify({ errors, report, glossary }, null, 2));
console.log(JSON.stringify({ errors, report, glossary }, null, 2));
await browser.close();
