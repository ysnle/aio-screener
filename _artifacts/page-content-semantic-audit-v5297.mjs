import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_SEMANTIC_AUDIT_PORT || 8917);
const baseUrl = `http://127.0.0.1:${port}/index.html?qa=page-content-semantic`;
const outDir = resolve(root, '_artifacts', 'page-content-semantic-v5298');
const routes = ['home','signal','breadth','sentiment','briefing','market-news','technical','screener','ticker','portfolio','themes','theme-detail','macro','fxbond','fundamental','options','kr-home','kr-supply','kr-themes','kr-macro','kr-technical','guide'];

function startServer() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd:root, stdio:['ignore','pipe','pipe'] });
    let ready = false;
    const done = () => { if (!ready) { ready = true; resolvePromise(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) done(); });
    child.stderr.on('data', (data) => process.stderr.write(`[server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(done, 2000);
  });
}

mkdirSync(outDir, { recursive:true });
const server = await startServer();
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
const consoleErrors = [];
page.on('pageerror', (error) => consoleErrors.push(`[pageerror] ${error.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error' && !/net::ERR_FAILED|Failed to fetch|ERR_BLOCKED_BY_CLIENT/.test(msg.text())) consoleErrors.push(`[console.error] ${msg.text()}`);
});
await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
await page.goto(baseUrl, { waitUntil:'domcontentloaded', timeout:45000 });
await page.waitForFunction(() => window.AIO && typeof window.showPage === 'function', { timeout:45000 });
await page.waitForTimeout(12000);

const report = {
  schemaVersion:'aio.page-content-semantic-audit.v1',
  generatedAt:new Date().toISOString(),
  baseUrl,
  routes:[],
  consoleErrors
};

for (const routeId of routes) {
  await page.evaluate((id) => window.showPage(id, null), routeId);
  await page.waitForTimeout(routeId === 'fundamental' || routeId === 'kr-supply' ? 2500 : 900);
  const row = await page.evaluate((id) => {
    const active = document.querySelector('.page.active');
    const visible = (el) => {
      if (!el || !el.isConnected) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && el.getClientRects().length > 0;
    };
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const locator = (el) => {
      if (el.id) return `#${el.id}`;
      const parts = [];
      let cur = el;
      while (cur && cur !== active && parts.length < 5) {
        let part = cur.tagName.toLowerCase();
        const cls = Array.from(cur.classList || []).filter((name) => !/active|loaded|ready|positive|negative/.test(name)).slice(0, 2);
        if (cls.length) part += '.' + cls.join('.');
        const parent = cur.parentElement;
        if (parent) {
          const peers = Array.from(parent.children).filter((node) => node.tagName === cur.tagName);
          if (peers.length > 1) part += `:nth-of-type(${peers.indexOf(cur) + 1})`;
        }
        parts.unshift(part);
        cur = parent;
      }
      return parts.join(' > ');
    };
    const selectors = 'h1,h2,h3,h4,h5,h6,p,li,td,th,label,button,a,span,strong,small,div';
    const leaves = active ? Array.from(active.querySelectorAll(selectors)).filter((el) => {
      if (!visible(el)) return false;
      const text = clean(el.innerText || el.textContent);
      if (!text) return false;
      const visibleTextChildren = Array.from(el.children).filter((child) => visible(child) && clean(child.innerText || child.textContent));
      return visibleTextChildren.length === 0 || ['BUTTON','A','TD','TH','LI'].includes(el.tagName);
    }) : [];
    const seen = new Set();
    const content = [];
    leaves.forEach((el) => {
      const text = clean(el.innerText || el.textContent);
      const key = `${locator(el)}|${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      const numbers = text.match(/[-+]?[$₩€£¥]?\d[\d,.]*(?:\s?(?:%|bp|bps|배|조|억|만|K|M|B|T|GW|MW|원|달러))?/gi) || [];
      const attrs = {};
      ['data-snap','data-source-kind','data-as-of','data-evidence-id','data-operational-use','title','aria-label'].forEach((name) => {
        if (el.hasAttribute(name)) attrs[name] = el.getAttribute(name);
      });
      content.push({ locator:locator(el), tag:el.tagName.toLowerCase(), text:text.slice(0, 1200), numbers, attrs });
    });
    const canvases = active ? Array.from(active.querySelectorAll('canvas')).filter(visible).map((canvas) => {
      let chart = null;
      try { chart = window.Chart && typeof window.Chart.getChart === 'function' ? window.Chart.getChart(canvas) : null; } catch(_) {}
      return {
        id:canvas.id || null,
        label:canvas.getAttribute('aria-label') || canvas.getAttribute('aria-describedby') || null,
        width:canvas.width,
        height:canvas.height,
        chart:chart ? {
          type:chart.config && chart.config.type || null,
          labels:Array.isArray(chart.data && chart.data.labels) ? chart.data.labels.slice() : [],
          datasets:(chart.data && chart.data.datasets || []).map((set) => ({ label:set.label || null, data:Array.isArray(set.data) ? set.data.slice() : [] }))
        } : null
      };
    }) : [];
    const links = active ? Array.from(active.querySelectorAll('a[href]')).filter(visible).map((el) => ({ text:clean(el.innerText || el.textContent), href:el.href })) : [];
    const sourceBadges = active ? Array.from(active.querySelectorAll('[data-source-kind],[data-as-of],[data-evidence-id]')).filter(visible).map((el) => ({
      locator:locator(el), text:clean(el.innerText || el.textContent).slice(0, 500), sourceKind:el.getAttribute('data-source-kind'), asOf:el.getAttribute('data-as-of'), evidenceId:el.getAttribute('data-evidence-id')
    })) : [];
    let completeness = null, evidence = null;
    try { completeness = window.AIO && window.AIO.getPageDataCompleteness ? window.AIO.getPageDataCompleteness(id) : null; } catch(error) { completeness = { error:error.message }; }
    try { evidence = window.AIO && window.AIO.getPageEvidenceState ? window.AIO.getPageEvidenceState(id) : null; } catch(error) { evidence = { error:error.message }; }
    return {
      routeId:id,
      activeId:active && active.id || null,
      title:active && clean(active.querySelector('h1,h2') && active.querySelector('h1,h2').textContent),
      fullText:active ? clean(active.innerText).slice(0, 200000) : '',
      content,
      contentCount:content.length,
      numericElementCount:content.filter((item) => item.numbers.length).length,
      canvases,
      links,
      sourceBadges,
      completeness,
      evidence
    };
  }, routeId);
  report.routes.push(row);
  console.log(`[semantic-audit] ${routeId}: content=${row.contentCount}, numeric=${row.numericElementCount}, charts=${row.canvases.length}, status=${row.completeness && row.completeness.status}`);
}

report.runtime = await page.evaluate(() => ({
  version:window.AIO && window.AIO.APP_VERSION || document.title,
  serverDataMeta:window._serverDataMeta || null,
  dataPipeline:window.AIO && window.AIO.getDataPipelineAudit ? window.AIO.getDataPipelineAudit() : null,
  pageCompleteness:window.AIO && window.AIO.auditPageDataCompleteness ? window.AIO.auditPageDataCompleteness({ allRoutes:true }) : null,
  currentness:window.AIO && window.AIO.getPageEvidenceCurrentnessAudit ? window.AIO.getPageEvidenceCurrentnessAudit() : null,
  snapshotFallback:window.AIO && window.AIO.getSnapshotFallbackConsistencyAudit ? window.AIO.getSnapshotFallbackConsistencyAudit({ rebuild:true }) : null,
  telegram:window.AIO && window.AIO.getTelegramPipelineAudit ? window.AIO.getTelegramPipelineAudit() : null
}));

writeFileSync(resolve(outDir, 'inventory.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
writeFileSync(resolve(outDir, 'summary.tsv'), [
  'route\tcontent_elements\tnumeric_elements\tcharts\tcompleteness\tfull_text_chars',
  ...report.routes.map((row) => [row.routeId,row.contentCount,row.numericElementCount,row.canvases.length,row.completeness && row.completeness.status,row.fullText.length].join('\t'))
].join('\n') + '\n', 'utf8');
await browser.close();
server.kill();
console.log(`[semantic-audit] wrote ${resolve(outDir, 'inventory.json')}`);
