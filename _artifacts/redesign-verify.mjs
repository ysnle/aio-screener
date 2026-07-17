import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = 'http://127.0.0.1:8899/index.html';
const isMobile = process.env.AIO_MOBILE === '1';
const out = resolve('_artifacts', isMobile ? 'redesign-current-v5288-mobile' : 'redesign-current-v5288');
const routes = ['home','signal','briefing','breadth','sentiment','technical','macro','fxbond','fundamental','themes','portfolio','market-news','screener'];
mkdirSync(out, { recursive:true });
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({
  viewport:isMobile ? { width:390, height:844 } : { width:1440, height:900 },
  deviceScaleFactor:1,
  isMobile,
  hasTouch:isMobile
});
const errors = [];
page.on('pageerror', e => errors.push(String(e.message || e)));
await page.goto(base, { waitUntil:'domcontentloaded', timeout:30000 });
await page.waitForFunction(() => typeof window.showPage === 'function');
const report = [];
for (const [index, route] of routes.entries()) {
  await page.evaluate(id => window.showPage(id, null), route);
  await page.waitForTimeout(350);
  if (route === 'fundamental') {
    await page.waitForFunction(() => {
      const loading = document.getElementById('fundamental-loading');
      const result = document.getElementById('fundamental-result');
      return (loading && getComputedStyle(loading).display === 'none') || (result && result.textContent.trim().length > 500);
    }, { timeout:8000 }).catch(() => {});
  }
  await page.evaluate(() => scrollTo(0, 0));
  const metrics = await page.evaluate(id => {
    const root = document.getElementById('page-' + id);
    const visible = el => { const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0; };
    return {
      route:id,
      height:root.scrollHeight,
      textLength:(root.innerText||'').replace(/\s+/g,' ').trim().length,
      directVisible:[...root.children].filter(visible).map(el => ({ id:el.id, cls:el.className, text:(el.innerText||'').replace(/\s+/g,' ').trim().slice(0,90) })),
      decisionHeaders:[...root.querySelectorAll('.aio-decision-header')].filter(visible).length,
      visibleDetails:[...root.querySelectorAll('details')].filter(visible).length,
      tableRows:root.querySelectorAll('#screener-results-body tr').length
      ,largest:[...root.querySelectorAll('*')].filter(visible).map(el=>({id:el.id,cls:el.className,h:Math.round(el.getBoundingClientRect().height),text:(el.innerText||'').replace(/\s+/g,' ').trim().slice(0,50)})).sort((a,b)=>b.h-a.h).slice(0,8)
    };
  }, route);
  report.push(metrics);
  const prefix=String(index+1).padStart(2,'0')+'-'+route;
  await page.screenshot({ path:resolve(out,prefix+'-fold.png'), fullPage:false, animations:'disabled' });
  await page.screenshot({ path:resolve(out,prefix+'-full.png'), fullPage:true, animations:'disabled' });
}
writeFileSync(resolve(out,'report.json'), JSON.stringify({errors,report},null,2));
console.log(JSON.stringify({errors,report:report.map(x=>({route:x.route,height:x.height,textLength:x.textLength,directVisible:x.directVisible.length,decisionHeaders:x.decisionHeaders,visibleDetails:x.visibleDetails,tableRows:x.tableRows}))},null,2));
await browser.close();
