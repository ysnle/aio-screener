#!/usr/bin/env node
// What a reader can do on each screen, checked in a real browser on the committed data. Each task is stated the way a
// reader would state it ("I can read the verdict and why without opening anything"), and is checked on what is visible
// and operable — text, roles, keyboard — never on an element's id, class or position. A screen may be rebuilt freely;
// this gate fails only when a reader loses something.
//   read      the words a reader looks for are visible on the first screen, without scrolling
//   reasons   the facts behind the verdict are readable with every fold closed
//   folds     every fold says what it holds (원자료 표 · 계산 방법 · 데이터 출처) and opens from the keyboard
//   views     every view tab is reachable and shows something of its own
//   fits      nothing runs off a 390 px screen; the page raises no error
//   act       the screen's own job (기술적 분석: find a stock and open its analysis)
// A company screen (종목) is opened on one company (`symbol`), and `ready` names the last part to arrive.
// Usage: node scripts/ci-screen-tasks-browser-check.mjs [--only signal,charts]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, startLocalServer, freePort } from './lib/browser-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(',')) : null;
const FOLD_NAME = /^(원자료 표|계산 방법|데이터 출처)/;

// One row per screen: what its reader comes for. `read` on the first screen; `reasons` anywhere, folds closed.
const SCREENS = [
  { route: 'signal', name: '시장 상태', read: [/(양호|중립|부담) 우세|혼조/], reasons: [/까지 [+\-−]?\d/, /→ (양호|중립|부담)/, /추세/, /변동성/, /신용/] },
  { route: 'breadth', name: '시장 폭', read: [/양호|중립|부담/], reasons: [/50일선 위 종목/, /200일선 위 종목/, /\d+(\.\d+)?%/, /판정이 바뀌는 조건/] },
  { route: 'sentiment', name: '투자 심리', read: [/공포|탐욕|중립/], reasons: [/공포·탐욕 지수/, /단기 불안 비율/, /AAII/] },
  { route: 'macro', name: '매크로', read: [/양호|중립|부담/], reasons: [/성장/, /물가/, /통화정책|정책/, /판정 사유|기준 (이상|미만)/] },
  { route: 'fxbond', name: '금리와 환율', read: [/\d+\.\d+%/], reasons: [/10년/, /2년/] },
  { route: 'charts', name: '기술적 분석', read: [/추세|조정|부근|이탈/], reasons: [/50일선/, /200일선/], act: 'open-stock-analysis' },
  // 종목 (owner 2026-11-19, "이 회사는 무엇으로 돈을 벌고 산업의 어디에 있는가"), opened on one company the way a reader picks
  // it: what it is on the first screen; its business, its place in the value chain and its money with every fold closed.
  { route: 'ticker', name: '종목', symbol: 'NVDA', ready: /순이익률/, read: [/NVIDIA/, /GPU|데이터센터/],
    reasons: [/사업/, /무엇을 파나/, /밸류체인 안의 자리/, /\d층 /, /사 주는 곳|공급하는 곳/, /재무 한눈에/, /매출 성장/, /순이익률/, /[+\-]?\d+(\.\d+)?%/, /쟁점과 전망: /] },
  // 쟁점과 전망 is 종목's second view, "무엇이 다투어지고 무엇이 보는 눈을 바꾸나"; the company head stays.
  { route: 'ticker', view: 'outlook', name: '종목 쟁점과 전망', symbol: 'NVDA', ready: /핵심 쟁점/, read: [/NVIDIA/],
    reasons: [/핵심 쟁점/, /이야기가 유지된다는 읽기/, /이야기가 깨진다는 읽기/, /회사가 밝힌 전망과 계획/, /맞아가고 있다는 신호/] }
].filter((screen) => !only || only.has(screen.route));

const failures = [];
const check = (ok, message, detail) => { if (!ok) failures.push(detail === undefined ? message : `${message} — ${JSON.stringify(detail)}`); };

const LWC_URL = 'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js';
const lwcBody = readFileSync(resolve(root, '_artifacts/entity-quality-20261012/browser-lightweight-charts.js'));
function dailyBars(sym, base) {
  const timestamps = [];
  for (let ms = Date.parse('2024-11-18T14:30:00Z'); ms <= Date.parse('2026-11-18T14:30:00Z'); ms += 86400000) if (![0, 6].includes(new Date(ms).getUTCDay())) timestamps.push(ms / 1000);
  const closes = timestamps.map((_, i) => Number((base * (1 + i * 0.0006) + Math.sin(i / 17) * base * 0.05).toFixed(2)));
  return { chart: { error: null, result: [{ meta: { symbol: sym, currency: 'USD', exchangeTimezoneName: 'America/New_York' }, timestamp: timestamps,
    indicators: { quote: [{ open: closes.map((c) => c * 0.996), high: closes.map((c) => c * 1.01), low: closes.map((c) => c * 0.99), close: closes, volume: closes.map(() => 1e6) }], adjclose: [{ adjclose: closes }] } }] } };
}
const decode = (url) => { let text = url; for (let i = 0; i < 3; i += 1) { try { text = decodeURIComponent(text); } catch (_) { break; } } return text; };

// What the reader sees of the open screen, read in the page.
const seen = () => {
  const page = document.querySelector('.page.active');
  const visible = (node) => !!node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  const firstScreen = [...page.querySelectorAll('h1, h2, h3, p, b, strong, span, li, dt, dd, td, th, button, a')]
    .filter((node) => visible(node) && node.getBoundingClientRect().top < innerHeight && node.getBoundingClientRect().bottom > 0)
    .map((node) => node.textContent.trim()).filter(Boolean).join(' ');
  const folds = [...page.querySelectorAll('details')].filter((fold) => visible(fold.querySelector('summary')) && !fold.parentElement.closest('details:not([open])'));
  return { text: page.innerText, firstScreen, folds: folds.map((fold) => fold.querySelector('summary').innerText.trim().split('\n')[0]),
    overflow: document.documentElement.scrollWidth - innerWidth, tabs: [...page.querySelectorAll('[role="tab"]')].filter(visible).map((tab) => tab.textContent.trim()) };
};

let server, browser;
try {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  server = await startLocalServer(port, { label: 'screen-tasks/server' });
  browser = await chromium.launch({ headless: true });
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', hasTouch: width < 1100 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url === LWC_URL) return route.fulfill({ status: 200, contentType: 'application/javascript', body: lwcBody, headers: { 'Access-Control-Allow-Origin': '*' } });
      const daily = decode(url).match(/query[12]\.finance\.yahoo\.com\/v8\/finance\/chart\/([A-Z]{1,5})\?[^#]*?interval=1d/);
      if (daily) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dailyBars(daily[1], 100 + daily[1].length * 37)), headers: { 'Access-Control-Allow-Origin': '*' } });
      // An unknown symbol is "not found", never a dead relay: an aborted call would open the page's transport circuit.
      if (/query[12]\.finance\.yahoo\.com\//.test(decode(url))) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"chart":{"result":null,"error":{"code":"Not Found"}}}', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (url.startsWith(base) || url.startsWith('data:')) return route.continue();
      return route.abort();
    });
    await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), null, { timeout: 30000 });
    const ack = page.getByRole('button', { name: '확인했습니다', exact: true });
    if (await ack.isVisible().catch(() => false)) await ack.click();

    for (const screen of SCREENS) {
      const where = `${screen.name} ${width}px`;
      errors.length = 0;
      // A company screen opens on its company (the reader's pick), any other on its route.
      // A screen cut into views the hub line shows as tabs (종목) opens on the named one, the default when none is named.
      await page.evaluate(({ route, symbol, view }) => { if (view) window._aioShowPageView?.(`page-${route}`, view); if (symbol) window.showTicker(symbol); else window.showPage(route); window.scrollTo(0, 0); }, { route: screen.route, symbol: screen.symbol || null, view: screen.view || (screen.route === 'ticker' ? 'overview' : null) });
      await page.waitForFunction((words) => new RegExp(words).test(document.querySelector('.page.active')?.innerText || ''), (screen.ready || screen.read[0]).source, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(800);
      const view = await page.evaluate(seen);

      for (const word of screen.read) check(word.test(view.firstScreen), `v60.31 ${where}: the reader does not find ${word} on the first screen`);
      for (const fact of screen.reasons) check(fact.test(view.text), `v60.31 ${where}: ${fact} is not readable with every fold closed`);
      check(view.folds.every((name) => FOLD_NAME.test(name)), `v60.31 ${where}: a fold does not say what it holds`, view.folds.filter((name) => !FOLD_NAME.test(name)));
      check(view.overflow <= 1, `v60.31 ${where}: the page runs ${view.overflow}px off the screen`);

      if (width === 1440) {
        // A fold opens from the keyboard and shows more than its name.
        const summary = page.locator('.page.active details > summary:visible').first();
        if (await summary.count()) {
          const before = (await page.evaluate(() => document.querySelector('.page.active').innerText)).length;
          await summary.focus();
          await page.keyboard.press('Enter');
          await page.waitForTimeout(300);
          const after = (await page.evaluate(() => document.querySelector('.page.active').innerText)).length;
          check(after > before, `v60.31 ${where}: the first fold does not open from the keyboard`, { before, after });
          await page.keyboard.press('Enter');
        }
        // Every view shows something of its own.
        const tabs = page.locator('.page.active [role="tab"]:visible');
        const texts = new Set();
        for (let i = 0; i < await tabs.count(); i += 1) {
          await tabs.nth(i).focus();
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
          const text = await page.evaluate(() => document.querySelector('.page.active').innerText);
          check(text.replace(/\s/g, '').length > 80, `v60.31 ${where}: the view "${view.tabs[i]}" is empty`);
          texts.add(text);
        }
        check(await tabs.count() < 2 || texts.size === await tabs.count(), `v60.31 ${where}: two views show the same thing`, view.tabs);
      }

      if (screen.act === 'open-stock-analysis') {
        await page.evaluate((route) => { window.showPage(route); window.scrollTo(0, 0); }, screen.route);
        const search = page.locator('.page.active').getByRole('combobox').or(page.locator('.page.active').getByRole('searchbox')).or(page.locator('.page.active').getByRole('button', { name: /종목 (이름이나 기호|검색)/ })).first();
        check(await search.isVisible().catch(() => false), `v60.31 ${where}: no stock search on the screen itself`);
        if (await search.isVisible().catch(() => false)) {
          await search.click();
          await page.waitForFunction(() => document.activeElement?.matches('input'), null, { timeout: 5000 }).catch(() => {});
          await page.keyboard.type('NVDA');
          await page.getByRole('option', { name: /NVDA/ }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
          await page.keyboard.press('Enter');
          // The chart is the one drawn after the stock's own heading, not any chart on the screen.
          const opened = await page.waitForFunction(() => {
            const heading = [...document.querySelectorAll('.page.active h2, .page.active h3')].find((h) => /NVDA/.test(h.textContent) && h.getClientRects().length);
            return !!heading && !/시세를 받아오지 못했습니다/.test(document.querySelector('.page.active').innerText)
              && [...document.querySelectorAll('.page.active canvas')].some((canvas) => canvas.getClientRects().length && canvas.width > 100 && (heading.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING));
          }, null, { timeout: 15000 }).then(() => true, () => false);
          check(opened, `v60.31 ${where}: searching NVDA does not open its analysis with a chart on this screen`, opened || await page.evaluate(() => ({ at: location.hash,
            headings: [...document.querySelectorAll('.page.active h2, .page.active h3')].filter((h) => h.getClientRects().length).map((h) => h.textContent.trim()).filter((text) => /일봉|NVDA/.test(text)),
            charts: [...document.querySelectorAll('.page.active canvas')].filter((canvas) => canvas.getClientRects().length).length })));
          check(/기술적 분석/.test(await page.evaluate(() => document.querySelector('.page.active h1')?.textContent || '')), `v60.31 ${where}: the search left the screen`);
        }
      }
      check(!errors.length, `v60.31 ${where}: the page raised an error`, errors.slice(0, 3));
    }
    await context.close();
  }
} finally {
  await closeAll({ browser, server });
}

if (failures.length) {
  console.error(`[screen-tasks] FAIL (${failures.length})\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`[screen-tasks] PASS: ${SCREENS.map((screen) => screen.name).join(', ')} — verdict on the first screen, reasons with folds closed, named folds that open from the keyboard, views of their own, 390 px fit, no page error.`);
