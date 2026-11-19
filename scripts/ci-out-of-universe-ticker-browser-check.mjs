// v57.81 (owner 2026-10-15: "단순 내부 데이터베이스에 등록만 한다고 끝이 아니야"): a US listing outside the published
// screener universe works across the app — it is placed against the universe with the screener's own formula, 종목's
// 개요 and 재무 공시 read its SEC filing on demand (or say why not), its chart opens on 기술적 분석 (v60.31), the watchlist,
// portfolio and AI context accept it, and an unlisted symbol is refused. Real route lifecycle; Yahoo chart, SEC
// companyfacts/submissions and the listing directory are intercepted fixtures; every other external call (AI included)
// is aborted. Not a live provider certification.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { closeAll, startLocalServer, freePort, gateNowMs } from './lib/browser-gate.mjs';
import { chartFixture, companyFactsFixture, submissionsFixture, listingFixture } from './lib/out-of-universe-fixtures.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = (Number(process.env.CI_OUT_OF_UNIVERSE_PORT) || await freePort());
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts/out-of-universe-20261015');
const libraryDir = resolve(root, '_artifacts/entity-quality-20261012');
const failures = [], observations = [];
const check = (condition, message, detail) => { if (!condition) failures.push({ message, detail }); };
mkdirSync(out, { recursive: true });

const nowMs = gateNowMs(); // the page clock under a pinned-data run
const CIK = { UFPT: '0000914156', MLI: '0000089439' };
const universe = new Set((JSON.parse(readFileSync(resolve(root, 'public-data/screener-universe.json'), 'utf8')).universe || []).map((row) => String(row.sym || row.symbol || '').toUpperCase()));
for (const sym of ['UFPT', 'HALO', 'MLI', 'BUFX']) if (universe.has(sym)) throw new Error(`${sym} joined the published universe; pick another out-of-universe fixture symbol`);
const charts = {
  UFPT: chartFixture('UFPT', { nowMs, name: 'UFP Technologies', start: 180, drift: 0.0012 }),
  HALO: chartFixture('HALO', { nowMs, name: 'Halozyme Therapeutics', start: 45, drift: 0.0004, wave: 0.09 }),
  MLI: chartFixture('MLI', { nowMs, name: 'Mueller Industries', start: 60, drift: 0.0009, exchange: 'NYQ' })
};
const listing = listingFixture([
  { symbol: 'UFPT', name: 'UFP Technologies, Inc. - Common Stock', exchange: 'Q', etf: 'N', cik: CIK.UFPT },
  { symbol: 'HALO', name: 'Halozyme Therapeutics, Inc. - Common Stock', exchange: 'Q', etf: 'N' },
  { symbol: 'MLI', name: 'Mueller Industries, Inc. Common Stock', exchange: 'N', etf: 'N', cik: CIK.MLI },
  // v59.54 (run-6 #11): listed, no quote fixture and no registry name, like FB (a ProShares ETF, not Facebook).
  { symbol: 'BUFX', name: 'Fixture Dynamic Buffer ETF', exchange: 'Z', etf: 'Y' }
]);
const sec = {
  [CIK.UFPT]: { facts: companyFactsFixture({ cik: CIK.UFPT, name: 'UFP Technologies', revenue: [400e6, 504e6], netIncome: [44e6, 59e6], equity: [300e6, 360e6], shares: 7.7e6 }),
    submissions: submissionsFixture({ cik: CIK.UFPT, name: 'UFP Technologies', ticker: 'UFPT' }) },
  [CIK.MLI]: { facts: companyFactsFixture({ cik: CIK.MLI, name: 'Mueller Industries', revenue: [3.4e9, 3.8e9], netIncome: [600e6, 610e6], equity: [2.5e9, 2.8e9], shares: 113e6 }),
    submissions: submissionsFixture({ cik: CIK.MLI, name: 'Mueller Industries', ticker: 'MLI', sic: '3350', sicDescription: 'Rolling Drawing & Extruding' }) }
};
const libraries = [
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
// v60.31: 종목 is company analysis (개요, 재무 공시) with no placement block, price chart or rank; the on-demand record is
// read where the screens read it, and the chart is 기술적 분석's analysis slot.
const recordReady = (page, sym, timeout = 30000) => page.waitForFunction((s) => window._aioOnDemandSymbol?.(s)?.status === 'ready', sym, { timeout });

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

      // 1. 종목: live quote + company overview from the on-demand SEC record; the on-demand placement reaches the AI context.
      await page.evaluate(() => window.showTicker('UFPT'));
      await recordReady(page, 'UFPT');
      await page.locator('#ticker-company').getByText('재무 한눈에').waitFor({ timeout: 20000 });
      const hero = await page.evaluate(async () => ({ price: document.getElementById('ticker-hero-price')?.textContent || '', company: document.getElementById('ticker-company')?.innerText || '',
        record: (({ status, secStatus, sessionDate, placement }) => ({ status, secStatus, sessionDate, rank: placement?.rank, ranked: placement?.ranked }))(window._aioOnDemandSymbol('UFPT') || {}),
        context: window.__aioCompanyAnalysis ? (await import('./src/domain/entity/company-analysis.js')).companyAnalysisContext(window.__aioCompanyAnalysis) : null, registered: window.__aioCompanyAnalysis?.identity?.registered }));
      observations.push({ label, hero: { ...hero, company: hero.company.slice(0, 400) } });
      check(hero.record.status === 'ready' && hero.record.secStatus === 'ready' && Number.isFinite(hero.record.rank) && hero.record.ranked > 100, `${label}: UFPT on-demand record incomplete (v57.81)`, hero.record);
      check(/\$\d/.test(hero.price), `${label}: UFPT hero has no quote (v57.81)`, hero.price);
      // The fixture filing: revenue 400M → 504M (+26.0%), net income 59M on 504M (11.7%).
      check(/매출 성장[\s\S]*\+26\.0%/.test(hero.company) && /순이익률[\s\S]*11\.7%/.test(hero.company), `${label}: UFPT 개요 재무 한눈에 does not read the on-demand SEC filing (v60.31)`, hero.company.slice(0, 600));
      check(/랭킹 대상 밖 종목/.test(hero.context || ''), `${label}: the AI company context lacks the on-demand placement (v57.81)`, hero.context);
      check(hero.registered === false, `${label}: the company analysis must not call an on-demand row a registered universe row (v57.81)`, hero.registered);
      // 1b. The chart: the 종목 subject line's link opens UFPT in 기술적 분석's analysis slot with the fixture series.
      await page.getByRole('button', { name: '기술적 분석에서 보기' }).click();
      await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'page-charts' && document.getElementById('stock-chart-section')?.dataset.symbol === 'UFPT'
        && !!document.querySelector('#stock-chart-canvas .tv-lightweight-charts'), null, { timeout: 30000 }).catch(() => {});
      const chart = await page.evaluate(() => ({ active: document.querySelector('.page.active')?.id || null, hash: location.hash, symbol: document.getElementById('stock-chart-section')?.dataset.symbol || null,
        drawn: !!document.querySelector('#stock-chart-canvas .tv-lightweight-charts'), status: document.getElementById('stock-chart-status')?.textContent || '' }));
      observations.push({ label, chart });
      check(chart.active === 'page-charts' && chart.symbol === 'UFPT' && chart.drawn && chart.status.startsWith(hero.record.sessionDate || '?') && /\$\d/.test(chart.status),
        `${label}: UFPT chart did not open on 기술적 분석 with the fixture series (v60.31)`, { chart, sessionDate: hero.record.sessionDate });
      await layout(page, `${label}/charts-ufpt`);
      // v59.54 (run-6 #11): a listed symbol no registry names shows the official listing name, not only its letters.
      await page.evaluate(() => window.showTicker('BUFX'));
      const bufx = await page.waitForFunction(() => /Fixture Dynamic Buffer ETF/.test(document.getElementById('ticker-hero-fullname')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
      check(bufx, `${label}: an unregistered listed symbol must show its official listing name (v59.54)`, await page.evaluate(() => document.getElementById('ticker-hero-fullname')?.textContent || ''));
      // v59.74 (integration review): the name stays after the symbol's own quote request re-renders the hero; a confirmed
      // listing counts as known, which used to drop the cached name back to the letters about a second later.
      await page.waitForFunction(() => !window.__aioQuoteDemand?.state().running, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const bufxKept = await page.evaluate(() => document.getElementById('ticker-hero-fullname')?.textContent || '');
      check(/Fixture Dynamic Buffer ETF/.test(bufxKept), `${label}: the listing name must survive the re-render after the symbol's quote request (v59.74)`, bufxKept);
      await page.evaluate(() => window.showTicker('UFPT'));
      await page.locator('#ticker-company').getByText('재무 한눈에').waitFor({ timeout: 20000 });
      await layout(page, `${label}/ticker-ufpt`);
      await atomicWriteFile(resolve(out, `browser-${label}-ufpt.png`), await page.screenshot({ fullPage: true }));

      // 2. 재무 공시 tab reads the same on-demand SEC record.
      await page.locator('#aio-hub-tabs [data-arg="fundamental"]').click();
      await page.waitForFunction(() => /SEC 연간 공시/.test(document.getElementById('fund-data-status')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
      const fund = await page.evaluate(() => document.getElementById('fund-data-status')?.textContent || '');
      observations.push({ label, fund });
      check(/SEC 연간 공시/.test(fund), `${label}: UFPT 재무 공시 status did not read the on-demand filing (v57.81)`, fund);
      await layout(page, `${label}/fundamental-ufpt`);

      // 3. No CIK: the record is placed without fundamentals (quality missing) and 재무 status says why.
      await page.evaluate(() => window.showTicker('HALO'));
      await recordReady(page, 'HALO').catch(() => {});
      const halo = await page.evaluate(() => (({ status, secStatus, placement }) => ({ status, secStatus, placed: !!placement,
        qualityMissing: (placement?.inputs || []).some((input) => input.key === 'quality' && input.active && !input.usable) }))(window._aioOnDemandSymbol?.('HALO') || {}));
      observations.push({ label, halo });
      check(halo.status === 'ready' && halo.secStatus === 'no-cik' && halo.placed && halo.qualityMissing, `${label}: HALO without CIK must still be placed with quality missing and its filing marked no-cik (v60.31)`, halo);
      await page.locator('#aio-hub-tabs [data-arg="fundamental"]').click();
      await page.waitForFunction(() => /CIK/.test(document.getElementById('fund-data-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
      const haloFund = await page.evaluate(() => document.getElementById('fund-data-status')?.textContent || '');
      check(/CIK/.test(haloFund) && !/SEC 데이터 미수신/.test(haloFund), `${label}: HALO 재무 status must name the missing CIK (v57.81)`, haloFund);

      // 5. Watchlist accepts listed symbols (v58.76: price alerts are retired), refuse unlisted ones, and add accepted ones to the quote set.
      const accept = await page.evaluate(async () => {
        localStorage.setItem('aio_watchlists', JSON.stringify([{ id: 'wl-oou', name: 'fixture', tickers: [] }]));
        localStorage.setItem('aio_watchlist_active', 'wl-oou');
        window.addToWatchlist('MLI', 'fixture');
        window.addToWatchlist('ZZZZ', 'fixture');
        await new Promise((r) => setTimeout(r, 1500));
        const saved = (JSON.parse(localStorage.getItem('aio_watchlists') || '[]')[0]?.tickers || []).map((t) => t.sym);
        await new Promise((r) => setTimeout(r, 800));
        return { saved, quoteSet: [...new Set([...(window.__aioQuoteDemand?.state().registered || []), ...(window.LIVE_SYMBOLS || [])])].filter((s) => ['MLI', 'HALO', 'ZZZZ', 'UFPT'].includes(s)), zzzz: await window._aioAcceptSymbol('ZZZZ') };
      });
      observations.push({ label, accept });
      check(accept.saved.includes('MLI') && !accept.saved.includes('ZZZZ'), `${label}: watchlist must accept a listed symbol and refuse an unlisted one (v57.81)`, accept);
      check(['MLI', 'UFPT'].every((s) => accept.quoteSet.includes(s)) && !accept.quoteSet.includes('ZZZZ') && accept.zzzz.ok === false, `${label}: accepted symbols must join the quote request set; unlisted never (v57.81)`, accept);

      // 5b. P2070: a stock page's 관심 종목 추가 with no list makes a "관심 종목" list instead of asking to pick one.
      //     P2069: a typed search for an unlisted symbol stays on the search miss instead of opening a stock page.
      const firstUse = await page.evaluate(async () => {
        localStorage.removeItem('aio_watchlists');
        localStorage.removeItem('aio_watchlist_active');
        window.addToWatchlist('MLI', 'fixture');
        await new Promise((r) => setTimeout(r, 1500));
        const lists = JSON.parse(localStorage.getItem('aio_watchlists') || '[]');
        window.showPage('ticker');
        const before = window._currentTickerId || null;
        // v59.70 (wave2-f S23): the typed symbol goes through the command search's 종목 scope and its listing check.
        await window._aioOpenCommandSearch({ scope: 'stock', query: 'ZZZZ' });
        const input = document.getElementById('aio-command-input');
        await window._aioCommandSearch.run('ZZZZ');
        input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise((r) => setTimeout(r, 1500));
        const status = document.getElementById('aio-command-status')?.textContent || '';
        window._aioCommandSearch.close();
        return { lists: lists.map((l) => ({ name: l.name, syms: (l.tickers || []).map((t) => t.sym) })), hasInput: !!input, refused: /목록에 없는/.test(status), before, after: window._currentTickerId || null };
      });
      observations.push({ label, firstUse });
      check(firstUse.lists.length === 1 && firstUse.lists[0].name === '관심 종목' && firstUse.lists[0].syms.join() === 'MLI', `${label}: watchlist add with no list must create "관심 종목" (P2070)`, firstUse);
      check(firstUse.hasInput && firstUse.refused && firstUse.after !== 'ZZZZ' && firstUse.after === firstUse.before, `${label}: a typed unlisted symbol must not open a stock page (P2069)`, firstUse);

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
      await page.waitForFunction(() => window._currentTickerId === 'MLI' && window._aioOnDemandSymbol?.('MLI')?.status === 'ready', null, { timeout: 30000 }).catch(() => {});
      const ai = await page.evaluate(async () => ({ block: window._aioOnDemandSymbol?.('MLI')?.status || null,
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
console.log('Out-of-universe ticker browser PASS: quote, company overview from on-demand SEC, chart on 기술적 분석, missing-CIK, watchlist, portfolio, search and AI context at 375px and desktop (fixtures; no paid calls).');
