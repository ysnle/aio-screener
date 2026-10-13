// P1624/P1625/P1626/P1627: real route consumers; intercepted Yahoo fixture, local published artifacts.
// External requests are aborted except this identity-checked chart fixture. No paid AI/provider call executes.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_ENTITY_QUALITY_PORT || 8935);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts/entity-quality-20261012');
const sourceVersion = JSON.parse(readFileSync(resolve(root,'version.json'),'utf8')).version;
const sourceFiles = ['index.html','src/ui/pages/entity.js','src/ui/pages/screener.js','src/ui/pages/analysis.js',
  'src/ui/components/stock-chart.js','src/ui/components/stock-read.js','src/ui/components/fiscal-read.js',
  'src/domain/entity/summary-hydration.js','src/domain/screener/market-scope.js','src/domain/screener/factor-ranks.js',
  'src/data/providers/screener.js','src/domain/fundamental/fiscal-read.js','src/domain/technical/chart-scenarios.js'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex')]));
const failures = [], observations = [];
const viewports = [{ name: 'phone', width:390, height:844 }, { name:'tablet', width:820, height:1180 }, { name:'desktop', width:1440, height:1000 }];
const check = (condition, message, detail) => { if (!condition) failures.push({ message, detail }); };
mkdirSync(out, { recursive:true });

function chartFixture() {
  const dates = [];
  for (let ms = Date.parse('2025-10-01T13:30:00Z'); ms <= Date.parse('2026-10-09T13:30:00Z'); ms += 86400000) {
    if (![0,6].includes(new Date(ms).getUTCDay())) dates.push(ms / 1000);
  }
  const closes = dates.map((_, i) => Number((55 + i * .11 + Math.sin(i / 11) * 8).toFixed(2)));
  closes[closes.length - 2] = 87.21; closes[closes.length - 1] = 84.64;
  return { chart: { error:null, result:[{ meta: { symbol:'AEHR', shortName:'Aehr Test Systems', longName:'Aehr Test Systems',
    currency:'USD', instrumentType:'EQUITY', exchangeName:'NMS', exchangeTimezoneName:'America/New_York',
    regularMarketPrice:84.64, regularMarketTime:Date.parse('2026-10-09T20:00:00Z') / 1000,
    regularMarketPreviousClose:87.21, previousClose:87.21, chartPreviousClose:55,
    fiftyTwoWeekLow:45, fiftyTwoWeekHigh:110,
    currentTradingPeriod:{ regular:{ start:Date.parse('2026-10-09T13:30:00Z') / 1000, end:Date.parse('2026-10-09T20:00:00Z') / 1000 } } },
    timestamp:dates, indicators:{ quote:[{ close:closes, open:closes.map(x=>x-.5), high:closes.map(x=>x+1.5), low:closes.map(x=>x-1.5),
      volume:closes.map((_,i)=>100000 + i*1000) }], adjclose:[{ adjclose:closes }] } }] } };
}
const fixtureBody = JSON.stringify(chartFixture());
const libraries = [
  { url:'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',file:'browser-chart.umd.min.js',
    sri:'e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g' },
  { url:'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js',file:'browser-lightweight-charts.js',
    sri:'OK7vELvjHdhUFi31JYioPIcRHTROLdcDa6ZsNWgvgLaKj+9JqhU0Ad8g4wz3CXjA' }
].map(item=>{ const body=readFileSync(resolve(out,item.file));
  if(createHash('sha384').update(body).digest('base64')!==item.sri) throw Error(`Pinned chart library SRI mismatch: ${item.file}`);
  return {...item,body}; });
function decodeTarget(url) {
  let decoded = url;
  for (let i = 0; i < 3; i++) { try { decoded = decodeURIComponent(decoded); } catch (_) { break; } }
  return decoded;
}
function fixtureForTarget(url) {
  const target=decodeTarget(url);
  const chartSymbol=target.match(/query[12]\.finance\.yahoo\.com\/v8\/finance\/chart\/([^?&#]+)(?:\?|$)/i)?.[1];
  if(chartSymbol==='AEHR') return fixtureBody;
  return null;
}
async function captureLayout(page, label) {
  const result = await page.evaluate(() => {
    const host = document.querySelector('.page.active');
    const localScroll = node => { for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
    } return false; };
    const clipped = [...host.querySelectorAll('*')].filter(el => {
      if (el.closest('[hidden],[aria-hidden="true"]') || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.right > innerWidth + 2 && !localScroll(el);
    }).slice(0,10).map(el => ({ id:el.id, className:String(el.className), right:el.getBoundingClientRect().right }));
    return { route:host.id, overflow:document.documentElement.scrollWidth-innerWidth, clipped };
  });
  observations.push({ label, layout:result });
  check(result.overflow <= 2 && result.clipped.length === 0, `${label}: page content escapes viewport (P1624/P1625/P1626/P1627)`, result);
}
let server, browser;
try {
  server = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd:root, stdio:['ignore','pipe','pipe'] });
  await new Promise((ready,reject) => {
    const timeout = setTimeout(()=>reject(new Error('Entity quality local server startup timed out')),15000);
    server.stdout.on('data', data=>{ if (String(data).includes('AIO local server')) { clearTimeout(timeout); ready(); } });
    server.on('error',reject); server.on('exit',code=>{clearTimeout(timeout);reject(new Error(`Local server exited ${code}`));});
  });
  browser = await chromium.launch({ headless:true });
  // QA speed (2026-10-12): the six viewport x theme cases are independent pages on one browser; run three at once.
  const cases = viewports.flatMap((viewport) => [false, true].map((dark) => ({ viewport, dark })));
  const runCase = async ({ viewport, dark }) => {
    const label = `${viewport.name}-${dark ? 'dark' : 'light'}`;
    if(process.env.AIO_ENTITY_QUALITY_CASE && process.env.AIO_ENTITY_QUALITY_CASE!==label) return;
    console.log(`Entity quality: ${label}`);
    const page = await browser.newPage({ viewport:{width:viewport.width,height:viewport.height}, hasTouch:viewport.width<1100, serviceWorkers:'block' });
    const intercepted = [], errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*', async route => {
      const url = route.request().url();
      const library = libraries.find(item=>item.url===url);
      if(library) return route.fulfill({status:200,contentType:'application/javascript',body:library.body,headers:{'Access-Control-Allow-Origin':'*'}});
      const body=fixtureForTarget(url);
      if (body) { intercepted.push(url); return route.fulfill({ status:200, contentType:'application/json', body,
        headers:{'Access-Control-Allow-Origin':'*'} }); }
      // A deliberately unavailable ticker is HTTP 404, not relay failure. Do not let blocked background
      // network calls poison the healthy fixture's per-origin transport circuit (P784).
      if(/query[12]\.finance\.yahoo\.com\//.test(decodeTarget(url)))return route.fulfill({status:404,contentType:'application/json',
        body:JSON.stringify({chart:{result:null,error:{code:'Not Found',description:'Offline fixture source unavailable'}}}),headers:{'Access-Control-Allow-Origin':'*'}});
      if (url.startsWith(base) || url.startsWith('data:')) return route.continue();
      return route.abort();
    });
    try {
      await page.goto(`${base}/index.html#home`, {waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof window.showTicker === 'function' && window.AIO_ARCH?.getScreenerState?.()?.rows?.length>0, null, {timeout:30000});
      check((await page.locator('#app-version-badge').innerText()).trim()===sourceVersion,`${label}: rendered version does not match checked source (P1624)`,sourceVersion);
      const acknowledge=page.getByRole('button',{name:'확인했습니다',exact:true});
      if(await acknowledge.isVisible())await acknowledge.click();
      if (await page.locator('body').evaluate(el=>el.classList.contains('dark-theme')) !== dark) {
        if (!await page.locator('#sidebar-theme-btn').isVisible()) await page.locator('#sidebar-toggle-btn').click();
        await page.locator('#sidebar-theme-btn').click();
        await page.keyboard.press('Escape');
      }
      // Enter the actual summary action first. No technical route or chart fetch is invoked beforehand.
      await page.evaluate(()=>window.showTicker('AEHR'));
      await page.waitForFunction(()=>document.getElementById('ticker-hero-price')?.textContent.includes('84.64')
        && document.getElementById('ticker-price-chart')?.dataset.tickerChartEnd === '2026-10-09', null, {timeout:20000});
      const summary = await page.evaluate(()=>({ price:document.getElementById('ticker-hero-price').textContent,
        basis:document.getElementById('ticker-summary-price-basis').textContent,
        business:document.getElementById('ticker-business-profile').textContent,
        source:document.querySelector('#ticker-business-profile a')?.href,
        canvas:{ width:document.getElementById('ticker-price-chart').clientWidth,height:document.getElementById('ticker-price-chart').clientHeight },
        lastDate:document.getElementById('ticker-price-chart').dataset.tickerChartEnd,
        native:document.getElementById('ticker-price-chart').dataset.aioTickerChartRenderer,
        chart:{real:window.Chart?.version==='4.4.0',points:window.Chart?.getChart?.(document.getElementById('ticker-price-chart'))?.data?.datasets?.[0]?.data?.length || 0,
          pixels:(()=>{const canvas=document.getElementById('ticker-price-chart'),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)count++;return count;})()},
        active:document.querySelector('.page.active').id,
        signed:[...document.querySelectorAll('.stock-return-signed-bar')].map(el=>({ down:el.classList.contains('is-down'),left:parseFloat(el.style.left),width:parseFloat(el.style.width),title:el.title })) }));
      observations.push({label,summary,fixtureRequests:intercepted.length});
      check(summary.active==='page-ticker' && /^\$84\.64$/.test(summary.price),`${label}: first summary price/currency absent (P1624)`,summary);
      check(/Aehr Test Systems/.test(summary.business) && /^https:\/\//.test(summary.source || '')
        && !/Palantir/.test(summary.business),`${label}: selected issuer profile/source identity lost (P1624)`,summary);
      check(summary.canvas.width>100 && summary.canvas.height>100 && summary.native==='native' && summary.lastDate==='2026-10-09',`${label}: first summary chart absent (P1624)`,summary);
      check(summary.chart.real && summary.chart.points>=20 && summary.chart.pixels>1000,`${label}: native canvas has no actual pinned Chart.js data/render (P1624)`,summary.chart);
      check(summary.basis.includes('2026-10-10 05:00 한국 시간') && !/UTC|실시간/.test(summary.basis),`${label}: observation basis lost/promoted or not in Korean time (P1624/S21)`,summary);
      check(summary.signed.some(bar=>bar.down && bar.width>0) && summary.signed.every(bar=>bar.down ? Math.abs(bar.left+bar.width-50)<.05 : Math.abs(bar.left-50)<.05),`${label}: signed returns cross common zero incorrectly (P1624)`,summary.signed);
      await captureLayout(page,`${label}/summary`);
      await page.screenshot({path:resolve(out,`browser-${label}-summary.png`)});
      // P1640 supersedes P1624's collapsed default: the stock+company summary opens on first render and leads to
      // the technical and fundamental analyses.
      check(await page.locator('#ticker-company-analysis').isVisible() && await page.locator('.company-analysis-expanded').evaluate(el=>el.open)
        && await page.locator('#ticker-company-analysis .company-analysis-routes button').count()===2,`${label}: stock+company summary absent, collapsed or missing analysis routes (P1640)`);
      const rerender = await page.evaluate(()=>{
        const expanded=document.querySelector('.company-analysis-expanded'); expanded.open=true; expanded.querySelector('summary').focus();
        document.dispatchEvent(new CustomEvent('aio:liveQuotes'));
        const after=document.querySelector('.company-analysis-expanded');
        return { same:after===expanded, open:after.open, focus:document.activeElement===after.querySelector('summary') };
      });
      check(rerender.open && rerender.focus,`${label}: quote re-render collapsed the opened company evidence or dropped focus (P1630)`,rerender);
      await page.getByRole('button',{name:'AI로 기업 분석',exact:true}).click();
      check(await page.locator('#ai-panel-inp').inputValue().then(value=>value.startsWith('AEHR 기업') && value.includes('웹검색')),`${label}: company evidence does not hand off to AI research (P1624)`);
      await page.locator('.ai-ph-close').click();

      await page.evaluate(()=>window.showPage('screener'));
      await page.waitForSelector('#scr-listing-market');
      await page.locator('#scr-order').selectOption('ret3m');
      for (const market of ['US','KR']) {
        await page.locator('#scr-listing-market').selectOption(market);
        await page.waitForFunction(()=>document.querySelectorAll('#screener-results-body tr[data-aio-screener-ticker]').length>0,null,{timeout:5000}).catch(()=>{});
        await page.waitForTimeout(300);
        const listing = await page.locator('#screener-results-body').evaluate(body=>[...body.querySelectorAll('tr[data-aio-screener-ticker]')].map(row=>({
          symbol:row.dataset.aioScreenerTicker,price:row.querySelector('[data-column-key="price"]')?.textContent || '',
          ret3m:parseFloat(row.querySelector('[data-column-key="ret3m"]')?.textContent) })));
        const populationNote = await page.locator('#scr-population-note').textContent();
        // P1650: a market whose latest completed session is newer than its published factor session
        // legitimately holds ranking and states the reason (P1649: "…반영 대기"). Accept that
        // documented deferral; an empty population with no stated reason stays a P1625 regression.
        const deferredWithReason = listing.length === 0 && /반영 대기/.test(populationNote);
        observations.push({label,market,listing,note:populationNote});
        check(listing.length>0 || deferredWithReason,`${label}: ${market} published population has no visible constituents (P1625)`,{listing,note:populationNote});
        check(listing.every(row=>/\.K[QS]$/.test(row.symbol)===(market==='KR')),`${label}: US/KR listings are mixed (P1625)`,listing);
        // P715: published rows intentionally omit raw prices. Offline source absence remains '—'.
        check(listing.every(row=>row.price==='—' || (market==='US' ? /\$/.test(row.price) : /₩|원/.test(row.price))),`${label}: received listing price has no currency (P1625)`,listing);
        const values=listing.map(row=>row.ret3m).filter(Number.isFinite);
        if(values.length>1)check(values.every((value,i)=>!i || value<=values[i-1]),`${label}: actual 3M return ordering is incorrect (P1625)`,values);
      }
      const currencyFormat = await page.evaluate(async()=>{const {formatScreenerPrice}=await import('./src/domain/screener/market-scope.js');
        return {usd:formatScreenerPrice(84.64,'USD'),krw:formatScreenerPrice(73000,'KRW'),missing:formatScreenerPrice(null,'USD')};});
      check(currencyFormat.usd==='$84.64' && currencyFormat.krw==='₩73,000' && currencyFormat.missing==='—',`${label}: currency formatter/absence contract failed (P1625)`,currencyFormat);
      observations.push({label,currencyFormat,priceBoundary:'Unreceived public quotes remain unavailable; no published price is promoted into a current quote.'});
      await captureLayout(page,`${label}/screener`);

      await page.evaluate(()=>window.showTicker('AEHR'));
      await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='page-ticker');
      await page.locator('#aio-hub-tabs [data-arg="fundamental"]').click();
      await page.waitForSelector('.fiscal-amount-table tbody tr', {timeout:20000});
      const fiscal = await page.locator('#fund-flow').evaluate(host=>({
        rows:host.querySelectorAll('.fiscal-amount-table tbody tr').length,
        captions:[...host.querySelectorAll('.fiscal-amount-table caption')].map(el=>el.textContent),
        loss:[...host.querySelectorAll('.fiscal-bar.is-loss')].map(el=>({top:parseFloat(el.style.top),height:parseFloat(el.style.height),
          zero:parseFloat(el.closest('.fiscal-bars').style.getPropertyValue('--fiscal-zero'))})),
        tableText:host.querySelector('.fiscal-amount-table')?.textContent,
        basis:host.querySelector('.fiscal-period-basis')?.textContent }));
      observations.push({label,fiscal});
      check(fiscal.rows>=2 && fiscal.captions.some(text=>/USD.*B=10억/.test(text)) /* P1687/S20: compact B/T units, exact amount in the cell title */,`${label}: fiscal period/amount table absent (P1627)`,fiscal);
      check(fiscal.loss.length>0 && fiscal.loss.every(bar=>Math.abs(bar.top-bar.zero)<.02 && bar.height>0),`${label}: fiscal losses extend above zero (P1627)`,fiscal);
      check(/순이익/.test(fiscal.tableText) && /[−-]\$/.test(fiscal.tableText),`${label}: explicit monetary losses absent from table (P1627)`,fiscal.tableText);
      await captureLayout(page,`${label}/fiscal`);
      await page.screenshot({path:resolve(out,`browser-${label}-fiscal.png`),fullPage:true});

      await page.locator('#aio-hub-tabs [data-arg="technical"]').click();
      await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='page-technical');
      await page.waitForSelector('.chart-scenario', {timeout:20000});
      const technical = await page.locator('#stock-chart-evidence').evaluate(host=>({
        scenarios:[...host.querySelectorAll('.chart-scenario')].map(el=>({id:el.dataset.scenario,text:el.textContent})),
        volume:host.querySelector('.chart-volume-profile')?.textContent,
        zones:host.querySelectorAll('.chart-volume-zone').length,
        logic:host.querySelector('.chart-analysis-logic')?.textContent }));
      observations.push({label,technical});
      check(technical.scenarios.length===3 && new Set(technical.scenarios.map(row=>row.id)).size===3,`${label}: conditional three-path analysis absent (P1626)`,technical);
      check(technical.zones>0 && /일봉 추정/.test(technical.volume) && /실제 가격별 체결량/.test(technical.volume),`${label}: estimated price distribution lacks method/limit (P1626)`,technical);
      check(/완료된 일봉/.test(technical.logic) && /미래 방향을 확정하지/.test(technical.logic),`${label}: chart logic/conditional basis absent (P1626)`,technical);
      await captureLayout(page,`${label}/technical`);
      await page.screenshot({path:resolve(out,`browser-${label}-technical.png`),fullPage:true});
      check(errors.length===0,`${label}: route runtime errors (P1624/P1625/P1626/P1627)`,errors);
    } catch(error) {
      const runtime = await page.evaluate(()=>({active:document.querySelector('.page.active')?.id,
        current:window._currentTickerId,subject:window._aioLastOpenedSymbol,chart:document.getElementById('stock-chart-status')?.textContent,
        helper:typeof window._aioFetchYahooChartData,form:document.getElementById('stock-chart-form')?.dataset.aioStockChart,
        proxies:(typeof _PROXY_REGISTRY!=='undefined'?_PROXY_REGISTRY.list.map(p=>({id:p.id,yahoo:p.scopes?.['query1.finance.yahoo.com']})):null),
        text:document.querySelector('.page.active')?.innerText?.slice(0,3000)})).catch(()=>null);
      failures.push({message:`${label}: ${error.message}`,stack:error.stack,fixtureRequests:intercepted,runtime,errors});
      await page.screenshot({path:resolve(out,`browser-${label}-failure.png`)}).catch(()=>{});
    }
    finally { await page.close(); }
  };
  for (let index = 0; index < cases.length; index += 3) await Promise.all(cases.slice(index, index + 3).map(runCase));
} catch(error) { failures.push({message:error.message,stack:error.stack}); }
finally {
  await browser?.close(); server?.kill();
  const changed=sourceFiles.filter(file=>createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex')!==sourceHashes[file]);
  check(changed.length===0,'Source changed during browser run; rerun the final integrated snapshot (P1624)',changed);
  writeFileSync(resolve(out,'browser-report.json'),JSON.stringify({
    status:failures.length?'FAIL':'PASS',postmortems:['P1624','P1625','P1626','P1627'],
    version:sourceVersion,sourceHashes,
    evidence:'Headless real route lifecycle with intercepted synthetic AEHR Yahoo chart fixture; unrelated Yahoo tickers return explicit offline 404, other external calls aborted; local published screener/SEC artifacts. Not live market/provider certification.',
    paidCalls:0,selectedCase:process.env.AIO_ENTITY_QUALITY_CASE || null,libraries:libraries.map(({url,sri})=>({url,sri,transport:'intercepted local pinned bytes'})),viewports,themes:['light','dark'],observations,failures },null,2)+'\n');
}
if(failures.length) { console.error(`Entity quality browser FAIL (${failures.length})`); failures.forEach(row=>console.error(JSON.stringify(row))); process.exit(1); }
console.log('Entity quality browser PASS: first summary, signed returns, market separation/3M order, fiscal loss/table and three conditional chart paths across 3 viewports × 2 themes (intercepted fixture; no paid calls).');
