// v57.81 (owner 2026-10-15: "단순 내부 데이터베이스에 등록만 한다고 끝이 아니야"): a US listing outside the published
// screener universe works across the app — the ticker summary places it against the universe with the screener's own
// formula, the 재무 공시 tab reads its SEC filing on demand (or says why not), the compare tray, watchlist, price alerts,
// portfolio and AI context accept it, and an unlisted symbol is refused. Real route lifecycle; Yahoo chart, SEC
// companyfacts/submissions and the listing directory are intercepted fixtures; every other external call (AI included)
// is aborted. Not a live provider certification.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { chartFixture, companyFactsFixture, submissionsFixture, listingFixture } from './lib/out-of-universe-fixtures.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_OUT_OF_UNIVERSE_PORT || 8961);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts/out-of-universe-20261015');
const libraryDir = resolve(root, '_artifacts/entity-quality-20261012');
const failures = [], observations = [];
const check = (condition, message, detail) => { if (!condition) failures.push({ message, detail }); };
mkdirSync(out, { recursive: true });

const nowMs = Date.now();
const CIK = { UFPT: '0000914156', MLI: '0000089439' };
const universe = new Set((JSON.parse(readFileSync(resolve(root, 'public-data/screener-universe.json'), 'utf8')).universe || []).map((row) => String(row.sym || row.symbol || '').toUpperCase()));
for (const sym of ['UFPT', 'HALO', 'MLI']) if (universe.has(sym)) throw new Error(`${sym} joined the published universe; pick another out-of-universe fixture symbol`);
const charts = {
  UFPT: chartFixture('UFPT', { nowMs, name: 'UFP Technologies', start: 180, drift: 0.0012 }),
  HALO: chartFixture('HALO', { nowMs, name: 'Halozyme Therapeutics', start: 45, drift: 0.0004, wave: 0.09 }),
  MLI: chartFixture('MLI', { nowMs, name: 'Mueller Industries', start: 60, drift: 0.0009, exchange: 'NYQ' })
};
const listing = listingFixture([
  { symbol: 'UFPT', name: 'UFP Technologies, Inc. - Common Stock', exchange: 'Q', etf: 'N', cik: CIK.UFPT },
  { symbol: 'HALO', name: 'Halozyme Therapeutics, Inc. - Common Stock', exchange: 'Q', etf: 'N' },
  { symbol: 'MLI', name: 'Mueller Industries, Inc. Common Stock', exchange: 'N', etf: 'N', cik: CIK.MLI }
]);
const sec = {
  [CIK.UFPT]: { facts: companyFactsFixture({ cik: CIK.UFPT, name: 'UFP Technologies', revenue: [400e6, 504e6], netIncome: [44e6, 59e6], equity: [300e6, 360e6], shares: 7.7e6 }),
    submissions: submissionsFixture({ cik: CIK.UFPT, name: 'UFP Technologies', ticker: 'UFPT' }) },
  [CIK.MLI]: { facts: companyFactsFixture({ cik: CIK.MLI, name: 'Mueller Industries', revenue: [3.4e9, 3.8e9], netIncome: [600e6, 610e6], equity: [2.5e9, 2.8e9], shares: 113e6 }),
    submissions: submissionsFixture({ cik: CIK.MLI, name: 'Mueller Industries', ticker: 'MLI', sic: '3350', sicDescription: 'Rolling Drawing & Extruding' }) }
};
const libraries = [
  { url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', file: 'browser-chart.umd.min.js', sri: 'e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g' },
  { url: 'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js', file: 'browser-lightweight-charts.js', sri: 'OK7vELvjHdhUFi31JYioPIcRHTROLdcDa6ZsNWgvgLaKj+9JqhU0Ad8g4wz3CXjA' }
].map((item) => { const body = readFileSync(resolve(libraryDir, item.file));
  if (createHash('sha384').update(body).digest('base64') !== item.sri) throw new Error(`Pinned chart library SRI mismatch: ${item.file}`);
  return { ...item, body }; });
const decodeTarget = (url) => { let decoded = url; for (let i = 0; i < 3; i += 1) { try { decoded = decodeURIComponent(decoded); } catch (_) { break; } } return decoded; };
function fixtureFor(url) {
  const target = decodeTarget(url);
  if (url.startsWith(base) && /\/public-data\/us-listings\.json/.test(url)) return { kind: 'listing', body: listing };
  const chartSymbol = target.match(/query[12]\.finance\.yahoo\.com\/v8\/finance\/chart\/([^?&#/]+)/i)?.[1]?.toUpperCase();
  if (chartSymbol && charts[chartSymbol]) return { kind: `chart:${chartSymbol}`, body: charts[chartSymbol] };
  const facts = target.match(/data\.sec\.gov\/api\/xbrl\/companyfacts\/CIK(\d{10})\.json/)?.[1];
  if (facts && sec[facts]) return { kind: `sec-facts:${facts}`, body: sec[facts].facts };
  const subs = target.match(/data\.sec\.gov\/submissions\/CIK(\d{10})\.json/)?.[1];
  if (subs && sec[subs]) return { kind: `sec-submissions:${subs}`, body: sec[subs].submissions };
  return null;
}
async function layout(page, label) {
  const result = await page.evaluate(() => {
    const host = document.querySelector('.page.active');
    const localScroll = (node) => { for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) if (/auto|scroll/.test(getComputedStyle(el).overflowX)) return true; return false; };
    const clipped = [...host.querySelectorAll('*')].filter((el) => !el.closest('[hidden],[aria-hidden="true"]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
      && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > innerWidth + 2 && !localScroll(el)).slice(0, 8).map((el) => ({ id: el.id, className: String(el.className) }));
    return { route: host.id, overflow: document.documentElement.scrollWidth - innerWidth, clipped };
  });
  observations.push({ label, layout: result });
  check(result.overflow <= 2 && !result.clipped.length, `${label}: content escapes the viewport (v57.81)`, result);
}
const blockState = (page) => page.evaluate(() => {
  const block = document.getElementById('ticker-out-of-universe');
  return block ? { state: block.dataset.onDemandState, text: block.textContent, inputs: [...block.querySelectorAll('li[data-factor]')].map((li) => ({ factor: li.dataset.factor, status: li.dataset.status })),
    marker: !!block.querySelector('.stock-read-marker'), button: !!block.querySelector('button') } : null;
});

let server, browser;
try {
  server = await startLocalServer(port, { label: 'out-of-universe/server' });
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ name: 'phone', width: 375, height: 812 }, { name: 'desktop', width: 1440, height: 1000 }]) {
    const label = viewport.name;
    console.log(`Out-of-universe ticker: ${label}`);
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.width < 1100, serviceWorkers: 'block' });
    const served = [], aborted = [], errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      const library = libraries.find((item) => item.url === url);
      if (library) return route.fulfill({ status: 200, contentType: 'application/javascript', body: library.body, headers: { 'Access-Control-Allow-Origin': '*' } });
      const fixture = fixtureFor(url);
      if (fixture) { served.push(fixture.kind); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.body), headers: { 'Access-Control-Allow-Origin': '*' } }); }
      if (/query[12]\.finance\.yahoo\.com\//.test(decodeTarget(url))) return route.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ chart: { result: null, error: { code: 'Not Found', description: 'Offline fixture source unavailable' } } }), headers: { 'Access-Control-Allow-Origin': '*' } });
      if (url.startsWith(base) || url.startsWith('data:')) return route.continue();
      aborted.push(new URL(url).host);
      return route.abort();
    });
    try {
      await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.showTicker === 'function' && window.AIO_ARCH?.getScreenerState?.()?.rows?.length > 0 && typeof window._aioRequestOnDemandSymbol === 'function', null, { timeout: 30000 });
      check(!served.some((kind) => /^(listing|chart:|sec-)/.test(kind)), `${label}: the listing directory, a chart or a filing loaded at boot (v57.81 no boot cost)`, served.slice());
      const acknowledge = page.getByRole('button', { name: '확인했습니다', exact: true });
      if (await acknowledge.isVisible()) await acknowledge.click();

      // 1. Ticker summary: live quote + chart + on-demand placement with SEC-backed quality.
      await page.evaluate(() => window.showTicker('UFPT'));
      await page.waitForFunction(() => document.getElementById('ticker-out-of-universe')?.dataset.onDemandState === 'ready', null, { timeout: 30000 });
      const ufpt = await blockState(page);
      const hero = await page.evaluate(async () => ({ price: document.getElementById('ticker-hero-price')?.textContent || '', chartEnd: document.getElementById('ticker-price-chart')?.dataset.tickerChartEnd || null,
        record: (({ status, secStatus, sessionDate, placement }) => ({ status, secStatus, sessionDate, rank: placement?.rank, ranked: placement?.ranked }))(window._aioOnDemandSymbol('UFPT') || {}),
        context: window.__aioCompanyAnalysis ? (await import('./src/domain/entity/company-analysis.js')).companyAnalysisContext(window.__aioCompanyAnalysis) : null, registered: window.__aioCompanyAnalysis?.identity?.registered }));
      observations.push({ label, ufpt, hero });
      check(/랭킹 대상 밖 종목 — 현재 유니버스 기준 위치/.test(ufpt?.text || '') && /요청 시 계산/.test(ufpt.text) && /상위 약/.test(ufpt.text) && ufpt.marker && ufpt.button,
        `${label}: UFPT placement block lacks title / on-demand label / percentile (v57.81)`, ufpt);
      check(ufpt?.inputs.some((input) => input.factor === 'quality' && input.status === 'used'), `${label}: UFPT SEC facts did not reach the quality input (v57.81)`, ufpt?.inputs);
      check(hero.record.status === 'ready' && hero.record.secStatus === 'ready' && Number.isFinite(hero.record.rank) && hero.record.ranked > 100, `${label}: UFPT on-demand record incomplete (v57.81)`, hero.record);
      check(/\$\d/.test(hero.price), `${label}: UFPT hero has no quote (v57.81)`, hero.price);
      check(hero.chartEnd === hero.record.sessionDate || hero.chartEnd > hero.record.sessionDate, `${label}: UFPT chart did not render the fixture series (v57.81)`, hero);
      check(/랭킹 대상 밖 종목/.test(hero.context || ''), `${label}: the AI company context lacks the on-demand placement (v57.81)`, hero.context);
      check(hero.registered === false, `${label}: the company analysis must not call an on-demand row a registered universe row (v57.81)`, hero.registered);
      await layout(page, `${label}/ticker-ufpt`);
      await atomicWriteFile(resolve(out, `browser-${label}-ufpt.png`), await page.screenshot({ fullPage: true }));
      // The section re-renders with each quote event, so the viewport is captured after scrolling to it.
      await page.evaluate(() => document.getElementById('ticker-out-of-universe')?.scrollIntoView({ block: 'start' }));
      await atomicWriteFile(resolve(out, `browser-${label}-ufpt-placement.png`), await page.screenshot());

      // 2. 재무 공시 tab reads the same on-demand SEC record.
      await page.locator('#aio-hub-tabs [data-arg="fundamental"]').click();
      await page.waitForFunction(() => /SEC 연간 공시/.test(document.getElementById('fund-data-status')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
      const fund = await page.evaluate(() => document.getElementById('fund-data-status')?.textContent || '');
      observations.push({ label, fund });
      check(/SEC 연간 공시/.test(fund), `${label}: UFPT 재무 공시 status did not read the on-demand filing (v57.81)`, fund);
      await layout(page, `${label}/fundamental-ufpt`);

      // 3. No CIK: placement without fundamentals, missing quality named, 재무 status says why.
      await page.evaluate(() => window.showTicker('HALO'));
      await page.waitForFunction(() => document.getElementById('ticker-out-of-universe')?.dataset.onDemandState === 'ready', null, { timeout: 30000 }).catch(() => {});
      const halo = await blockState(page);
      observations.push({ label, halo });
      check(halo?.state === 'ready' && halo.inputs.some((input) => input.factor === 'quality' && input.status === 'missing') && /CIK/.test(halo.text), `${label}: HALO without CIK must show placement with quality missing and say why (v57.81)`, halo);
      await page.locator('#aio-hub-tabs [data-arg="fundamental"]').click();
      await page.waitForFunction(() => /CIK/.test(document.getElementById('fund-data-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
      const haloFund = await page.evaluate(() => document.getElementById('fund-data-status')?.textContent || '');
      check(/CIK/.test(haloFund) && !/SEC 데이터 미수신/.test(haloFund), `${label}: HALO 재무 status must name the missing CIK (v57.81)`, haloFund);

      // 4. Compare tray: the placement button queues HALO; the tray shows it with the on-demand note and no rank.
      await page.evaluate(() => window.showTicker('HALO'));
      await page.waitForFunction(() => document.getElementById('ticker-out-of-universe')?.dataset.onDemandState === 'ready', null, { timeout: 15000 });
      await page.locator('#ticker-out-of-universe button').click();
      await page.evaluate(() => window.showPage('screener'));
      await page.waitForFunction(() => /HALO/.test(document.getElementById('scr-compare-list')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
      const tray = await page.evaluate(() => ({ list: document.getElementById('scr-compare-list')?.textContent || '', note: document.querySelector('.scr-compare-on-demand')?.textContent || '' }));
      observations.push({ label, tray });
      check(/HALO/.test(tray.list) && /랭킹 대상 밖 종목/.test(tray.note), `${label}: compare tray lacks the on-demand HALO row/note (v57.81)`, tray);
      await layout(page, `${label}/screener-compare`);

      // 5. Watchlist accepts listed symbols (v58.76: price alerts are retired), refuse unlisted ones, and add accepted ones to the quote set.
      const accept = await page.evaluate(async () => {
        localStorage.setItem('aio_watchlists', JSON.stringify([{ id: 'wl-oou', name: 'fixture', tickers: [] }]));
        localStorage.setItem('aio_watchlist_active', 'wl-oou');
        window.addToWatchlist('MLI', 'fixture');
        window.addToWatchlist('ZZZZ', 'fixture');
        await new Promise((r) => setTimeout(r, 1500));
        const saved = (JSON.parse(localStorage.getItem('aio_watchlists') || '[]')[0]?.tickers || []).map((t) => t.sym);
        await new Promise((r) => setTimeout(r, 800));
        return { saved, quoteSet: [...new Set([...(window._aioQuoteRequestSymbols || []), ...(window.LIVE_SYMBOLS || [])])].filter((s) => ['MLI', 'HALO', 'ZZZZ', 'UFPT'].includes(s)), zzzz: await window._aioAcceptSymbol('ZZZZ') };
      });
      observations.push({ label, accept });
      check(accept.saved.includes('MLI') && !accept.saved.includes('ZZZZ'), `${label}: watchlist must accept a listed symbol and refuse an unlisted one (v57.81)`, accept);
      check(['MLI', 'UFPT'].every((s) => accept.quoteSet.includes(s)) && !accept.quoteSet.includes('ZZZZ') && accept.zzzz.ok === false, `${label}: accepted symbols must join the quote request set; unlisted never (v57.81)`, accept);

      // 6. Portfolio: an out-of-universe holding joins the analytics rows with its own on-demand row.
      await page.evaluate(() => window.savePortfolioData([{ sym: 'UFPT', qty: 10, cost: 150 }, { sym: 'HALO', qty: 20, cost: 40 }]));
      await page.evaluate(() => window.showPage('portfolio'));
      await page.waitForFunction(() => (window._aioPortfolioOnDemandRows || []).length >= 2, null, { timeout: 20000 }).catch(() => {});
      const portfolio = await page.evaluate(() => ({ rows: (window._aioPortfolioOnDemandRows || []).map((row) => row.sym),
        valued: (window._aioPortfolioSurface?.rows || []).filter((row) => ['UFPT', 'HALO'].includes(row.symbol) && row.value > 0).map((row) => row.symbol) }));
      observations.push({ label, portfolio });
      check(portfolio.rows.includes('UFPT') && portfolio.rows.includes('HALO') && portfolio.valued.length === 2, `${label}: portfolio analytics lack the on-demand holdings (v57.81)`, portfolio);
      await layout(page, `${label}/portfolio`);
      await page.evaluate(() => window.savePortfolioData([]));

      // 7. Search + AI: a typed symbol opens the same placement; the chat block and public-facts reader include it.
      await page.evaluate(() => window.showTicker('mli'));
      await page.waitForFunction(() => window._currentTickerId === 'MLI' && document.getElementById('ticker-out-of-universe')?.dataset.onDemandState === 'ready', null, { timeout: 30000 }).catch(() => {});
      const ai = await page.evaluate(async () => ({ block: document.getElementById('ticker-out-of-universe')?.dataset.onDemandState || null,
        chat: await window._aioOnDemandChatContext('MLI'), facts: Object.keys(await window.AIO.readPublicFundamentals(['MLI', 'HALO'])) }));
      observations.push({ label, ai });
      check(ai.block === 'ready' && /랭킹 대상 밖 종목/.test(ai.chat) && /순위 n위/.test(ai.chat), `${label}: search/AI context lacks the MLI on-demand placement (v57.81)`, ai);
      check(ai.facts.includes('MLI') && !ai.facts.includes('HALO'), `${label}: the AI public-facts reader must include MLI's on-demand filing and nothing for HALO (no CIK) (v57.81)`, ai.facts);
      await layout(page, `${label}/ticker-mli`);
      check(!served.some((kind) => kind === 'chart:ZZZZ'), `${label}: an unlisted symbol was fetched (v57.81)`, served);
      check(errors.length === 0, `${label}: page errors (v57.81)`, errors);
      observations.push({ label, served: [...new Set(served)], abortedHosts: [...new Set(aborted)] });
    } catch (error) {
      failures.push({ message: `${label}: ${error.message}`, served, errors });
      await atomicWriteFile(resolve(out, `browser-${label}-failure.png`), await page.screenshot()).catch(() => {});
    } finally { await page.close(); }
  }
} catch (error) { failures.push({ message: error.message, stack: error.stack }); }
finally {
  await closeAll({ browser, server });
  await atomicWriteFile(resolve(out, 'browser-report.json'), `${JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', release: 'v57.81',
    evidence: 'Headless real routes; Yahoo chart, SEC companyfacts/submissions and the US listing directory are intercepted fixtures; other external calls (AI included) aborted. Not live provider certification.',
    paidCalls: 0, observations, failures }, null, 2)}\n`);
}
if (failures.length) { console.error(`Out-of-universe ticker browser FAIL (${failures.length})`); failures.forEach((row) => console.error(JSON.stringify(row).slice(0, 1500))); process.exit(1); }
console.log('Out-of-universe ticker browser PASS: placement, quote/chart, on-demand SEC, missing-CIK, compare, watchlist, alerts, portfolio, search and AI context at 375px and desktop (fixtures; no paid calls).');
