// v60.31 chart-scale (owner 2026-11-19, "차트 스케일이 안 맞거나 깨져서 나온다"): the three candle surfaces drawn at their
// real size and scale. Intercepted Yahoo fixtures (the 11/18 SPY session arrived with 64 of 79 five-minute bars null) and
// the pinned lightweight-charts bytes; every other external request is aborted. No paid AI/provider call executes.
//   오늘 지수 줄 — each candle at its own time slot: the 16:00 closing bar at the right end, not beside 10:40.
//   기술적 분석 일봉 카드 — the chart fills its card, no 76 px pane-alignment axis on a card without panes, the cards of
//     one row start their charts on one line, and no library logo over the candles (attribution in 데이터 출처).
//   종목 차트 — every candle chart keeps only price ticks whose whole label fits (entireTextOnly).
//   2026-11-19 (기술적 분석 개편): the four fund cards (QQQ · SPY · SOXX · IWM) of 시장 지수, row by row; the old 종목 차트
//     request (showPage('technical')) opens NVDA in 기술적 분석's analysis slot; on every candle chart the last candle sits
//     left of the volume profile rows, and the last close and level labels are tags inside the plot, not axis labels over
//     the tick numbers.
// Usage: node scripts/ci-chart-scale-browser-check.mjs [--shots <dir>]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, startLocalServer, freePort } from './lib/browser-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg > 0 ? resolve(root, process.argv[shotsArg + 1]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const failures = [];
const check = (ok, message, detail) => { if (!ok) failures.push({ message, detail }); };

const LWC_URL = 'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js';
const lwcBody = readFileSync(resolve(root, '_artifacts/entity-quality-20261012/browser-lightweight-charts.js'));
if (createHash('sha384').update(lwcBody).digest('base64') !== 'OK7vELvjHdhUFi31JYioPIcRHTROLdcDa6ZsNWgvgLaKj+9JqhU0Ad8g4wz3CXjA') throw Error('pinned lightweight-charts SRI mismatch');

const SESSION_START = 1795012200; // 2026-11-18 09:30 New York
const SESSION_END = SESSION_START + 23400;
function intradayFixture(sym, base, nullFrom = null, nullTo = null) {
  const timestamps = Array.from({ length: 79 }, (_, i) => SESSION_START + i * 300);
  const closes = timestamps.map((_, i) => Number((base + Math.sin(i / 6) * base * 0.004).toFixed(2)));
  const blank = (values) => values.map((value, i) => (nullFrom != null && i >= nullFrom && i <= nullTo ? null : value));
  return { chart: { error: null, result: [{ meta: { symbol: sym, currency: 'USD', exchangeTimezoneName: 'America/New_York', chartPreviousClose: base * 1.001,
    regularMarketTime: SESSION_END, currentTradingPeriod: { regular: { start: SESSION_START, end: SESSION_END } } },
    timestamp: timestamps, indicators: { quote: [{ open: blank(closes.map((c) => c - 0.2)), high: blank(closes.map((c) => c + 0.5)), low: blank(closes.map((c) => c - 0.5)), close: blank(closes), volume: closes.map(() => 1e5) }] } }] } };
}
function dailyFixture(sym, base, wave) {
  const timestamps = [];
  for (let ms = Date.parse('2024-11-18T14:30:00Z'); ms <= Date.parse('2026-11-18T14:30:00Z'); ms += 86400000) if (![0, 6].includes(new Date(ms).getUTCDay())) timestamps.push(ms / 1000);
  const closes = timestamps.map((_, i) => Number((base * (1 + i * 0.0006) + Math.sin(i / wave) * base * 0.06).toFixed(2)));
  const volume = closes.map((_, i) => 1e6 + (i % 7) * 1e5 + (i === closes.length - 1 && sym === 'SPY' ? 3e6 : 0));
  return { chart: { error: null, result: [{ meta: { symbol: sym, currency: 'USD', exchangeTimezoneName: 'America/New_York', regularMarketTime: SESSION_END,
    currentTradingPeriod: { regular: { start: SESSION_START, end: SESSION_END } } },
    timestamp: timestamps, indicators: { quote: [{ open: closes.map((c) => c * 0.996), high: closes.map((c) => c * 1.01), low: closes.map((c) => c * 0.99), close: closes, volume }], adjclose: [{ adjclose: closes }] } }] } };
}
const FIXTURES = {
  'SPY 5m': intradayFixture('SPY', 730, 14, 77), // the live 11/18 shape: 9:30–10:35 and the 16:00 bar only
  'QQQ 5m': intradayFixture('QQQ', 659), 'SOXX 5m': intradayFixture('SOXX', 141), 'IWM 5m': intradayFixture('IWM', 270),
  'QQQ 1d': dailyFixture('QQQ', 520, 23), 'SPY 1d': dailyFixture('SPY', 600, 9), 'SOXX 1d': dailyFixture('SOXX', 140, 13), 'IWM 1d': dailyFixture('IWM', 230, 31), 'NVDA 1d': dailyFixture('NVDA', 120, 17),
  // 대표 종목: two stocks with bars; every other stock's daily request answers 404, so its card shows the no-value line.
  'AAPL 1d': dailyFixture('AAPL', 210, 11), 'MSFT 1d': dailyFixture('MSFT', 420, 19)
};
// The index funds and the slot's symbols; any other two-year daily request is a 대표 종목 card's (counted for the lazy-load
// check). The page's quote refresh asks the same endpoint for a short range, so only range=2y counts.
const NOT_STOCK_CARDS = new Set(['SPY', 'QQQ', 'SOXX', 'IWM', 'NVDA']);
const dailySymbol = (url) => { const target = decode(url); return /[?&]range=2y\b/.test(target) ? target.match(/query[12]\.finance\.yahoo\.com\/v8\/finance\/chart\/([^?&#]+)\?[^#]*?interval=1d/i)?.[1] || null : null; };
const decode = (url) => { let text = url; for (let i = 0; i < 3; i++) { try { text = decodeURIComponent(text); } catch (_) { break; } } return text; };
function fixtureFor(url) {
  const target = decode(url);
  const match = target.match(/query[12]\.finance\.yahoo\.com\/v8\/finance\/chart\/([^?&#]+)\?[^#]*?interval=(\w+)/i);
  return match ? FIXTURES[`${match[1]} ${match[2]}`] || null : null;
}

// Owner 2026-11-19: (1) the last candle sits left of the volume profile rows (the recent view leaves the profile's share of
// the plot free right of it); (2) no price label is drawn on the axis over its tick numbers — the last close and every
// level are tags inside the plot (stock-chart-layers.js), inside the plot's width and not on top of each other.
function labelChecks(label, sym, geometry, lastValueVisible) {
  check(geometry && geometry.lastBarRight != null && geometry.profileLeft != null && geometry.lastBarRight <= geometry.profileLeft,
    `${label}: ${sym} last candle runs under the volume profile rows (last bar right ${geometry?.lastBarRight?.toFixed?.(1)} > profile left ${geometry?.profileLeft?.toFixed?.(1)})`, geometry);
  check(lastValueVisible === false, `${label}: ${sym} draws its last close on the price axis, over the tick numbers`, { lastValueVisible });
  const tags = geometry?.tags || [];
  check(tags.some((tag) => tag.kind === 'close'), `${label}: ${sym} has no last-close tag in the plot`, tags);
  check(tags.every((tag) => tag.x >= 0 && tag.x + tag.w <= geometry.plotWidth + 0.5), `${label}: ${sym} a price tag leaves the plot`, tags);
  const sorted = [...tags].sort((a, b) => a.y - b.y);
  check(sorted.every((tag, i) => i === 0 || tag.y >= sorted[i - 1].y + sorted[i - 1].h), `${label}: ${sym} price tags overlap`, tags);
}

const CASES = [
  { width: 1920, height: 1080, scheme: 'dark' }, { width: 1690, height: 940, scheme: 'dark' }, { width: 1690, height: 940, scheme: 'light' },
  { width: 1440, height: 900, scheme: 'dark' }, { width: 820, height: 1180, scheme: 'dark' }, { width: 390, height: 844, scheme: 'dark' }
];

let server, browser;
try {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  server = await startLocalServer(port, { label: 'chart-scale/server' });
  browser = await chromium.launch({ headless: true });
  const runCase = async ({ width, height, scheme }) => {
    const label = `${width}x${height}-${scheme}`;
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, serviceWorkers: 'block', hasTouch: width < 1100 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const stockLoads = { total: 0, inFlight: 0, max: 0, syms: [] };
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url === LWC_URL) return route.fulfill({ status: 200, contentType: 'application/javascript', body: lwcBody, headers: { 'Access-Control-Allow-Origin': '*' } });
      const stockSym = dailySymbol(url);
      // The live-quote refresh asks the same endpoint for futures, indexes and FX (ES=F, ^VIX, DX-Y.NYB); only stock symbols count.
      if (stockSym && !NOT_STOCK_CARDS.has(stockSym) && /^(?:[A-Z]{1,5}(?:[.-][A-Z])?|\d{6}\.K[SQ])$/.test(stockSym)) {
        // Held briefly so overlapping requests overlap here too: the page keeps at most four in flight.
        stockLoads.total += 1; stockLoads.syms.push(stockSym); stockLoads.inFlight += 1; stockLoads.max = Math.max(stockLoads.max, stockLoads.inFlight);
        await new Promise((done) => setTimeout(done, 150));
        stockLoads.inFlight -= 1;
      }
      const body = fixtureFor(url);
      if (body) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': '*' } });
      if (/query[12]\.finance\.yahoo\.com\//.test(decode(url))) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"chart":{"result":null,"error":{"code":"Not Found"}}}', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (url.startsWith(base) || url.startsWith('data:')) return route.continue();
      return route.abort();
    });
    try {
      await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), null, { timeout: 30000 });
      const ack = page.getByRole('button', { name: '확인했습니다', exact: true });
      if (await ack.isVisible().catch(() => false)) await ack.click();

      // 오늘: the SPY card's candles at their time slots.
      await page.evaluate(() => window.showPage('home'));
      await page.waitForFunction(() => document.getElementById('home-index-strip')?.dataset.models === 'live', null, { timeout: 30000 });
      const strip = await page.evaluate(() => [...document.querySelectorAll('#home-index-strip .home-index-card')].map((card) => {
        const svg = card.querySelector('svg.home-index-chart');
        const width = Number(svg?.viewBox?.baseVal?.width) || 0;
        const xs = [...(svg?.querySelectorAll('rect') || [])].map((rect) => Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')) / 2);
        return { sym: card.dataset.sym, width, bars: xs.length, firstX: xs[0], lastX: xs.at(-1), secondLastX: xs.at(-2) };
      }));
      const spy = strip.find((card) => card.sym === 'SPY');
      check(spy && spy.bars === 15, `${label}: SPY card should draw the 15 priced bars of the fixture`, spy);
      // 79 slots; the 16:00 bar is slot 78 (centre 98.7% of the width), the 10:35 bar slot 13 (17.1%).
      check(spy && spy.lastX / spy.width > 0.97 && spy.secondLastX / spy.width < 0.2, `${label}: the 16:00 closing bar must sit at the right end and 10:35 where it belongs, not side by side (chart-scale v60.31)`, spy);
      const full = strip.find((card) => card.sym === 'QQQ');
      check(full && full.bars === 79 && full.lastX / full.width > 0.97 && full.firstX / full.width < 0.02, `${label}: a full session spans the card's width`, full);
      if (shots) await page.locator('#home-index-strip').screenshot({ path: resolve(shots, `home-${label}.png`) });

      // 기술적 분석 일봉 cards.
      await page.evaluate(() => window.showPage('charts'));
      await page.waitForFunction(() => document.querySelectorAll('#charts-index-grid .charts-candle-card .tv-lightweight-charts').length === 4, null, { timeout: 30000 });
      await page.waitForTimeout(600); // autoSize lays the charts out after a frame
      const cards = await page.evaluate(() => [...document.querySelectorAll('#charts-index-grid .charts-candle-card')].map((card) => {
        const box = card.querySelector('.charts-candle-canvas');
        const lwc = box.querySelector('.tv-lightweight-charts');
        const canvases = [...lwc.querySelectorAll('table tr:first-child canvas')].map((canvas) => canvas.getBoundingClientRect());
        const plot = Math.max(...canvases.map((rect) => rect.width));
        const rect = lwc.getBoundingClientRect();
        return { sym: card.dataset.symbol, cardTop: Math.round(card.getBoundingClientRect().top), boxW: box.clientWidth, lwcW: Math.round(rect.width), lwcH: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left),
          plot: Math.round(plot), axis: Math.round(rect.width - plot), logo: !!card.querySelector('a[href*="tradingview"], #tv-attr-logo'),
          geometry: box.__aioChart?.layers?.geometry?.() || null, lastValueVisible: box.__aioChart?.candles?.options?.().lastValueVisible };
      }));
      for (const card of cards) {
        check(card.lwcW >= card.boxW * 0.95, `${label}: ${card.sym} chart must fill its card (≥95% of the card's chart box)`, card);
        check(card.axis <= 60, `${label}: ${card.sym} card reserves a ${card.axis}px price axis; a card without study panes keeps its axis to its labels (chart-scale v60.31)`, card);
        check(!card.logo, `${label}: ${card.sym} card draws the library logo over its candles`, card);
        labelChecks(label, card.sym, card.geometry, card.lastValueVisible);
      }
      // Cards side by side (same grid row — the card boxes start on one line): their charts start on one line and are the
      // same size. Six cards make several rows (2026-11-19 시장 지수), each checked on its own.
      for (const rowTop of [...new Set(cards.map((card) => card.cardTop))]) {
        const sideBySide = cards.filter((card) => Math.abs(card.cardTop - rowTop) <= 1);
        if (sideBySide.length < 2) continue;
        const tops = sideBySide.map((card) => card.top), heights = sideBySide.map((card) => card.lwcH);
        check(Math.max(...tops) - Math.min(...tops) <= 1 && Math.max(...heights) - Math.min(...heights) <= 1, `${label}: cards of one row start their charts on different lines or at different heights (chart-scale v60.31)`, sideBySide);
      }
      const sources = await page.evaluate(() => document.querySelector('#page-charts > details.page-sources')?.textContent || '');
      check(/Lightweight Charts/.test(sources) && /tradingview\.com/.test(sources), `${label}: 기술적 분석 데이터 출처 must carry the chart library attribution once the card logo is off`, sources.slice(0, 200));
      if (shots) await page.locator('#charts-indexes').screenshot({ path: resolve(shots, `charts-${label}.png`) });

      // 대표 종목 (owner 2026-11-19): the same card part, one card per stock. Nothing is requested while the view is closed;
      // opening it loads the cards that come into view, at most four at a time; a stock with bars draws its candles under
      // the same label rules, one without says the date and that there is no value, and the cards of a row stay aligned.
      check(stockLoads.total === 0, `${label}: 대표 종목 cards requested bars while their view was closed`, stockLoads);
      await page.locator('#page-charts .page-views [data-view="stocks"]').click();
      await page.waitForFunction(() => document.querySelectorAll('#charts-stocks .charts-index-card[data-stock]').length >= 2, null, { timeout: 30000 });
      const stockCount = await page.evaluate(() => document.querySelectorAll('#charts-stocks .charts-index-card[data-stock]').length);
      for (let i = 0; i < stockCount; i += 1) {
        await page.evaluate((index) => document.querySelectorAll('#charts-stocks .charts-index-card[data-stock]')[index]?.scrollIntoView({ block: 'center' }), i);
        await page.waitForTimeout(60);
      }
      await page.waitForFunction(() => [...document.querySelectorAll('#charts-stocks .charts-index-card[data-stock]')].every((card) => ['bars', 'missing'].includes(card.dataset.source)), null, { timeout: 30000 });
      await page.waitForTimeout(600);
      const stockCards = await page.evaluate(() => [...document.querySelectorAll('#charts-stocks .charts-index-card[data-stock]')].map((card) => {
        const chart = card.querySelector('.charts-index-chart');
        const box = card.querySelector('.charts-candle-canvas');
        return { sym: card.dataset.symbol, source: card.dataset.source, group: card.closest('.charts-stock-group')?.id, cardTop: Math.round(card.getBoundingClientRect().top), chartTop: Math.round(chart.getBoundingClientRect().top),
          drawn: !!chart.querySelector('canvas, svg'), missing: chart.querySelector('.charts-card-missing')?.textContent || '', verdict: card.querySelector('.charts-trend')?.textContent || '',
          geometry: box?.__aioChart?.layers?.geometry?.() || null, lastValueVisible: box?.__aioChart?.candles?.options?.().lastValueVisible };
      }));
      check(stockLoads.max <= 4, `${label}: 대표 종목 had ${stockLoads.max} bar requests in flight at once (at most four)`, stockLoads);
      check(stockCards.some((card) => card.source === 'bars') && stockCards.some((card) => card.source === 'missing'), `${label}: 대표 종목 should show both a stock with bars and one without`, stockCards.map((card) => `${card.sym}:${card.source}`));
      for (const card of stockCards) {
        if (card.source === 'bars') labelChecks(label, card.sym, card.geometry, card.lastValueVisible);
        else check(!card.drawn && /\d+\/\d+ 종가 기준 일봉 값 없음/.test(card.missing) && card.verdict === '값 없음', `${label}: ${card.sym} without bars draws an empty chart or does not say the date and that there is no value`, card);
      }
      for (const group of new Set(stockCards.map((card) => card.group))) {
        const inGroup = stockCards.filter((card) => card.group === group);
        for (const rowTop of [...new Set(inGroup.map((card) => card.cardTop))]) {
          const row = inGroup.filter((card) => Math.abs(card.cardTop - rowTop) <= 1);
          if (row.length < 2) continue;
          const tops = row.map((card) => card.chartTop);
          check(Math.max(...tops) - Math.min(...tops) <= 1, `${label}: 대표 종목 cards of one row start their charts on different lines`, row);
        }
      }
      if (shots) await page.locator('#charts-stocks').screenshot({ path: resolve(shots, `stocks-${label}.png`) });
      await page.locator('#page-charts .page-views [data-view="indexes"]').click();

      // 종목 차트 (NVDA daily): fills its box and keeps whole tick labels only.
      await page.evaluate(() => { window._aioChartRequest = 'NVDA'; window.showPage('technical'); });
      await page.waitForFunction(() => document.getElementById('stock-chart-section')?.dataset.symbol === 'NVDA' && document.querySelector('#stock-chart-canvas .tv-lightweight-charts'), null, { timeout: 30000 });
      await page.waitForTimeout(600);
      const stock = await page.evaluate(() => {
        const instance = window.__aioStockChartInstance;
        const host = document.getElementById('stock-chart-canvas');
        const lwc = host.querySelector('.tv-lightweight-charts');
        return { hostW: host.clientWidth, lwcW: Math.round(lwc.getBoundingClientRect().width), entireTextOnly: instance?.chart?.priceScale('right').options().entireTextOnly,
          geometry: instance?.layers?.geometry?.() || null, lastValueVisible: instance?.candles?.options?.().lastValueVisible, page: document.querySelector('.page.active')?.id, hash: location.hash };
      });
      check(stock.lwcW >= stock.hostW * 0.95, `${label}: NVDA chart must fill its box`, stock);
      check(stock.page === 'page-charts' && new URLSearchParams(stock.hash.split('?')[1] || '').get('sym') === 'NVDA' && stock.hash.startsWith('#charts?'), `${label}: the old 종목 차트 request (showPage('technical')) opens NVDA in 기술적 분석's analysis slot`, stock);
      labelChecks(label, 'NVDA', stock.geometry, stock.lastValueVisible);
      check(stock.entireTextOnly === true, `${label}: the candle chart's price axis draws ticks cut at the pane edge (entireTextOnly, chart-scale v60.31)`, stock);
      if (shots) await page.locator('#stock-chart-canvas').screenshot({ path: resolve(shots, `stock-${label}.png`) });
      check(errors.length === 0, `${label}: page errors`, errors);
      console.log(`chart-scale ${label}: strip SPY last ${spy ? (spy.lastX / spy.width).toFixed(3) : '?'} · cards axis ${cards.map((c) => c.axis).join('/')} plot ${cards.map((c) => c.plot).join('/')} top ${cards.map((c) => c.top).join('/')} · stock entireTextOnly ${stock.entireTextOnly} · 대표 종목 ${stockCards.length} cards (${stockCards.filter((card) => card.source === 'bars').length} drawn), ${stockLoads.total} requests, at most ${stockLoads.max} at once`);
    } catch (error) {
      failures.push({ message: `${label}: ${error.message}` });
      if (shots) await page.screenshot({ path: resolve(shots, `failure-${label}.png`) }).catch(() => {});
    } finally { await context.close(); }
  };
  for (let i = 0; i < CASES.length; i += 3) await Promise.all(CASES.slice(i, i + 3).map(runCase));
} catch (error) { failures.push({ message: error.message, stack: error.stack }); }
finally { await closeAll({ browser, server }); }
if (shots) writeFileSync(resolve(shots, 'chart-scale-report.json'), `${JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', cases: CASES, failures }, null, 2)}\n`);
if (failures.length) { console.error(`chart-scale browser FAIL (${failures.length})`); for (const row of failures) console.error(JSON.stringify(row).slice(0, 600)); process.exit(1); }
console.log(`chart-scale browser PASS: ${CASES.length} viewport/theme cases`);
