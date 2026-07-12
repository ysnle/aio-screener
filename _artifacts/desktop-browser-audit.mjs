import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = 'C:/Projects/AIO';
const PORT = 8893;
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const OUT = resolve(ROOT, '_artifacts', 'desktop-browser-audit');
const ROUTES = [
  'home','signal','breadth','sentiment','briefing','market-news','technical','screener',
  'ticker','portfolio','themes','theme-detail','macro','fxbond','fundamental','options',
  'kr-home','kr-supply','kr-themes','kr-macro','kr-technical','guide'
];
const VIEWPORTS = [
  { name: 'laptop1024', width: 1024, height: 768 },
  { name: 'desktop1440', width: 1440, height: 900 }
];

mkdirSync(OUT, { recursive: true });

function startServer() {
  return new Promise((resolveStart, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(PORT)], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe']
    });
    let done = false;
    const ready = () => { if (!done) { done = true; resolveStart(child); } };
    child.stdout.on('data', d => { if (String(d).includes('AIO local server')) ready(); });
    child.stderr.on('data', d => process.stderr.write(String(d)));
    child.on('error', reject);
    child.on('exit', code => { if (!done) reject(new Error(`server exited ${code}`)); });
    setTimeout(ready, 2000);
  });
}

function safeName(s) { return String(s || '').replace(/[^a-z0-9_-]+/gi, '-'); }

const server = await startServer();
const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), base: BASE, viewports: [], summary: {} };

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const runtime = { currentRoute: null, errors: [], failedRequests: [], responses: [] };
    page.on('pageerror', e => runtime.errors.push({ route: runtime.currentRoute, kind: 'pageerror', message: String(e?.message || e) }));
    page.on('console', m => { if (m.type() === 'error') runtime.errors.push({ route: runtime.currentRoute, kind: 'console', message: m.text().slice(0, 500) }); });
    page.on('requestfailed', r => runtime.failedRequests.push({ route: runtime.currentRoute, url: r.url(), error: r.failure()?.errorText || '' }));
    page.on('response', r => { if (r.url().startsWith(BASE.slice(0, BASE.lastIndexOf('/')))) runtime.responses.push({ url: r.url(), status: r.status() }); });
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
      return route.fulfill({ status: 204, body: '' });
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof window.showPage === 'function', { timeout: 30000 });
    await page.addStyleTag({ content: '*{font-family:Arial,"Malgun Gothic",sans-serif!important} html{scroll-behavior:auto!important}' });
    const vpResult = { ...vp, routes: [] };

    for (const routeId of ROUTES) {
      runtime.currentRoute = routeId;
      const beforeErrors = runtime.errors.length;
      await page.evaluate(id => window.showPage(id, null), routeId);
      await page.waitForTimeout(400);
      const data = await page.evaluate(id => {
        const canonical = id === 'theme-detail' ? 'themes' : id;
        const active = document.querySelector('.page.active') || document.getElementById('page-' + canonical);
        if (!active) return { fatal: 'active page missing' };
        const visible = el => {
          const cs = getComputedStyle(el), r = el.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        const txt = el => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        const take = (sel, n=80) => Array.from(active.querySelectorAll(sel)).filter(visible).slice(0,n);
        const headings = take('h1,h2,h3,h4,[role="heading"]',100).map(txt).filter(Boolean);
        const controls = take('button,a[href],input,select,textarea,[role="button"]',160).map(el => ({
          tag: el.tagName.toLowerCase(), text: txt(el).slice(0,120), aria: el.getAttribute('aria-label') || '',
          disabled: !!el.disabled, href: el.getAttribute('href') || '', action: el.getAttribute('data-action') || ''
        }));
        const sections = take('section,.card,.panel,.glass-card,.content-section,[class*="section"]',160).map(el => txt(el).slice(0,180)).filter(Boolean);
        const tables = take('table',40).map(el => ({ rows: el.rows?.length || 0, cols: el.rows?.[0]?.cells?.length || 0, preview: txt(el).slice(0,180) }));
        const canvases = take('canvas',80).map(el => ({ id:el.id, label:el.getAttribute('aria-label')||'', css:[el.clientWidth,el.clientHeight], bitmap:[el.width,el.height] }));
        const images = take('img',80).map(el => ({ alt:el.alt||'', src:el.currentSrc||el.src||'', natural:[el.naturalWidth,el.naturalHeight] }));
        const bodyText = txt(active);
        const placeholders = (bodyText.match(/(?:로딩(?: 중)?|데이터 수신 대기|준비 중|산정 불가|연결 필요|API[^ ]* 필요|—|--|N\/A|null|undefined|NaN)/gi) || []).slice(0,100);
        const rect = active.getBoundingClientRect();
        const clipped = take('button,a[href],input,select,canvas,table',240).filter(el => {
          const r=el.getBoundingClientRect();
          if (!(r.right>innerWidth+2 || r.left<-2)) return false;
          /* A table wider than the laptop viewport is valid only when its
             nearest scroll container exposes the horizontal overflow. */
          if (el.tagName === 'TABLE') {
            let p=el.parentElement;
            while (p && p !== active) {
              const cs=getComputedStyle(p);
              if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2) return false;
              p=p.parentElement;
            }
          }
          return true;
        }).slice(0,30).map(el => ({ tag:el.tagName.toLowerCase(), text:txt(el).slice(0,80), rect:[Math.round(el.getBoundingClientRect().left),Math.round(el.getBoundingClientRect().right)] }));
        const tiny = take('*',1200).filter(el => parseFloat(getComputedStyle(el).fontSize)<10).slice(0,40).map(el => ({ text:txt(el).slice(0,80), size:getComputedStyle(el).fontSize }));
        return {
          canonical, title: headings[0] || '', textLength: bodyText.length, activeRect:[Math.round(rect.width),Math.round(rect.height)],
          headings, controls, sections, tables, canvases, images, placeholders, clipped, tiny,
          counts:{ headings:headings.length, controls:controls.length, sections:sections.length, tables:tables.length, canvases:canvases.length, images:images.length },
          scroll:{ documentWidth:document.documentElement.scrollWidth, viewportWidth:innerWidth, activeHeight:active.scrollHeight }
        };
      }, routeId);
      data.routeId = routeId;
      data.errors = runtime.errors.slice(beforeErrors);
      if (process.env.AIO_PRINT_CLIPPED && data.clipped?.length) {
        process.stdout.write(`[desktop-audit] clipped ${vp.name}/${routeId}: ${JSON.stringify(data.clipped)}\n`);
      }
      try {
        await page.screenshot({ path: resolve(OUT, `${vp.name}-${safeName(routeId)}.png`), fullPage: false, animations: 'disabled', timeout: 30000 });
        data.screenshot = `${vp.name}-${safeName(routeId)}.png`;
      } catch (e) {
        data.screenshotError = String(e?.message || e).split('\n')[0];
      }
      vpResult.routes.push(data);
      process.stdout.write(`[desktop-audit] ${vp.name}/${routeId}\n`);
    }
    vpResult.failedRequests = runtime.failedRequests;
    vpResult.localResponses = runtime.responses;
    report.viewports.push(vpResult);
    await context.close();
  }
  const all = report.viewports.flatMap(v => v.routes.map(r => ({ viewport:v.name, ...r })));
  report.summary = {
    combinations: all.length,
    fatal: all.filter(x => x.fatal).length,
    consoleOrPageErrors: all.reduce((n,x)=>n+(x.errors?.length||0),0),
    horizontalOverflow: all.filter(x => x.scroll && x.scroll.documentWidth > x.scroll.viewportWidth + 3).map(x=>`${x.viewport}/${x.routeId}`),
    clipped: all.filter(x => x.clipped?.length).map(x=>({ key:`${x.viewport}/${x.routeId}`, count:x.clipped.length })),
    zeroCanvases: all.filter(x => x.canvases?.some(c=>!c.css[0]||!c.css[1]||!c.bitmap[0]||!c.bitmap[1])).map(x=>`${x.viewport}/${x.routeId}`),
    screenshotFailures: all.filter(x=>x.screenshotError).map(x=>({key:`${x.viewport}/${x.routeId}`,error:x.screenshotError})),
    placeholderHeavy: all.filter(x => (x.placeholders?.length||0)>=10).map(x=>({key:`${x.viewport}/${x.routeId}`,count:x.placeholders.length}))
  };
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report.summary, null, 2) + '\n');
} finally {
  await browser.close();
  server.kill();
}
