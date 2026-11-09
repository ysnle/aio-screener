#!/usr/bin/env node
// v59.70: screen review 2026-11-04 (1차 통합본) items owned by the 테마 and 스크리너 screens, as one browser gate so the
// same class fails again instead of waiting for the next eye review.
//   3  AI 설비투자 띠: segment labels >= 4.5:1 in dark; each card's layer name and '$N / $100' stay on one line each.
//   15 테마 시나리오 lead is short (<= 3 lines on a phone) and says which rule it uses (1개월 수익률, 주도 단계 or not).
//   23 momentum map: the axis title overlaps no quadrant caption.
//   24 S&P 500 지도: no sector header is cut by an ellipsis.
//   16 스크리너: the kicker names the ranked count, and the drawer's rank reads against that same count.
//   29 스크리너 검증 안내 띠: not cut on a phone.
// Re-review (RE-REVIEW.md, 89e8c881):
//   N1 '세부 테마 상위' on a phone with a stale basis (page clock five days after the data's US session): every value
//      cell is the last grid column at full width (the old placeholder span pushed it into a 20px cell, '+9/.6/%').
//   15 a theme named like a sector (헬스케어, 필수소비재 …) says '테마' in the stage columns and the scenario lead, so its
//      number is not read as the sector line's number for the same name.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { SECTOR_ETF_LABELS } from '../src/domain/market/interpretation/concepts.js';
import { closeAll, freePort, startLocalServer } from './lib/browser-gate.mjs';

const port = (Number(process.env.CI_THEME_SCREENER_REVIEW_PORT) || await freePort());
const base = `http://127.0.0.1:${port}/`;
const failures = [];
const fail = (where, message) => failures.push(`[${where}] ${message}`);
const SECTOR_NAMES = new Set(Object.values(SECTOR_ETF_LABELS));
// Five days after the data's US session always holds a later completed session, whatever weekday the data ends on.
const usDay = readFileSync(new URL('../public-data/screener.json', import.meta.url), 'utf8').match(/"factorSessionDateByMarket":\{"US":"(\d{4}-\d{2}-\d{2})"/)?.[1];
if (!usDay) { console.error('theme-screener-review: public-data/screener.json has no US factor session date'); process.exit(1); }
const STALE_CLOCK = new Date(Date.parse(`${usDay}T12:00:00Z`) + 5 * 86400000);

async function open(browser, { width, height, dark, mobile = false, clock = null }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (clock) await page.clock.setFixedTime(clock);
  await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.showPage === 'function', null, { timeout: 30000 });
  if (await page.evaluate(() => document.body.classList.contains('dark-theme')) !== dark) {
    await page.evaluate(() => { document.body.classList.toggle('dark-theme'); });
  }
  return { context, page, errors };
}

const server = await startLocalServer(port, { label: 'theme-screener-review/server' });
let browser;
try {
  browser = await chromium.launch();
  // 테마 at desktop dark (3), phone light (15, 23, 24).
  for (const view of [{ id: 'desktop-dark', width: 1440, height: 1000, dark: true }, { id: 'tablet-dark', width: 768, height: 1024, dark: true }, { id: 'phone-light', width: 390, height: 844, dark: false, mobile: true }]) {
    const { context, page, errors } = await open(browser, view);
    await page.evaluate(() => window.showPage('themes'));
    await page.waitForFunction(() => document.querySelector('.capex-flow-seg') && document.querySelector('#theme-playbook .xr-lead') && document.querySelector('.sector-map-sector'), null, { timeout: 60000 });
    await page.evaluate(() => { const fold = document.getElementById('ai-capex-fold'); if (fold && 'open' in fold) fold.open = true; });
    const read = await page.evaluate(() => {
      const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      const segs = [...document.querySelectorAll('.capex-flow-seg-label')].filter((n) => n.getClientRects().length).map((n) => ({ text: n.textContent, ratio: +ratio(parse(getComputedStyle(n).color), parse(getComputedStyle(n.parentElement).backgroundColor)).toFixed(2) }));
      const lines = (n) => { const s = getComputedStyle(n); const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3; return Math.round(n.getBoundingClientRect().height / lh); };
      const cards = [...document.querySelectorAll('.capex-flow-card')].filter((n) => n.getClientRects().length).map((card) => ({ layer: card.dataset.layer, title: lines(card.querySelector('.trend-card-title')), value: lines(card.querySelector('.trend-card-value')) }));
      const lead = document.querySelector('#theme-playbook .xr-lead');
      const map = document.querySelector('#theme-playbook svg.tp-map:not([hidden])') || document.querySelector('#theme-playbook svg.tp-map');
      const boxes = (sel) => [...(map?.querySelectorAll(sel) || [])].filter((n) => n.getClientRects().length).map((n) => n.getBoundingClientRect());
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const axis = boxes('.tp-axis-label'), quads = boxes('.tp-quad');
      const mapOverlaps = axis.flatMap((a) => quads.filter((q) => overlap(a, q))).length;
      const cut = [...document.querySelectorAll('.sector-map-sector-label')].filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent);
      return { segs, cards, lead: lead?.textContent || '', leadLines: lead ? lines(lead) : 0, mapOverlaps, cut };
    });
    if (view.dark) {
      const low = read.segs.filter((s) => s.ratio < 4.5);
      if (!read.segs.length) fail(view.id, 'no AI 설비투자 segment label visible');
      if (low.length) fail(view.id, `AI 설비투자 segment labels below 4.5:1: ${JSON.stringify(low)}`);
      const broken = read.cards.filter((c) => c.title > 1 || c.value > 1);
      if (broken.length) fail(view.id, `AI 설비투자 card heads break inside a line: ${JSON.stringify(broken)}`);
    }
    if (view.mobile) {
      if (read.leadLines > 3) fail(view.id, `테마 시나리오 lead runs ${read.leadLines} lines: ${read.lead.slice(0, 80)}`);
      if (!/1개월 수익률/.test(read.lead) || !/주도 단계/.test(read.lead)) fail(view.id, `테마 시나리오 lead does not name its rule: ${read.lead.slice(0, 80)}`);
      if (read.mapOverlaps) fail(view.id, `momentum map axis title overlaps ${read.mapOverlaps} quadrant caption(s)`);
    }
    if (read.cut.length) fail(view.id, `S&P 500 지도 sector headers cut: ${read.cut.join(', ')}`);
    // 15: no bare sector name stands for a theme basket.
    const names = await page.evaluate(() => ({
      cols: [...document.querySelectorAll('#page-themes .thp-col-name')].map((n) => n.textContent.trim()),
      lead: document.querySelector('#theme-playbook .xr-lead')?.textContent.trim() || ''
    }));
    const bare = names.cols.filter((name) => SECTOR_NAMES.has(name.replace(/^한국 /, '')));
    const leadBare = [...names.lead.matchAll(/(?:1위|최하위) ([^\s+\-−(]+) [+\-−]/g)].map((m) => m[1]).filter((name) => SECTOR_NAMES.has(name));
    if (bare.length) fail(view.id, `stage columns name theme baskets with a bare sector name: ${bare.join(', ')}`);
    if (leadBare.length) fail(view.id, `scenario lead names a theme basket with a bare sector name: ${leadBare.join(', ')} ("${names.lead.slice(0, 80)}")`);
    if (errors.length) fail(view.id, `page errors: ${errors.slice(0, 2).join(' | ')}`);
    console.log(`[theme-review] ${view.id}: segs ${read.segs.map((s) => s.ratio).join('/')}, lead ${read.leadLines} lines, map overlaps ${read.mapOverlaps}, cut ${read.cut.length}`);
    await context.close();
  }
  // N1: '세부 테마 상위' on a phone, light and dark, with a stale basis.
  for (const dark of [false, true]) {
    const id = `phone-stale-${dark ? 'dark' : 'light'}`;
    const { context, page, errors } = await open(browser, { width: 390, height: 844, dark, mobile: true, clock: STALE_CLOCK });
    await page.evaluate(() => window.showPage('themes'));
    await page.waitForFunction(() => document.querySelectorAll('.v2-themes-top__row').length > 0, null, { timeout: 60000 });
    await page.waitForTimeout(800);
    const rows = await page.evaluate(() => ({
      stale: !!document.querySelector('.v2-themes-top__stale'),
      rows: [...document.querySelectorAll('.v2-themes-top__row')].map((row) => {
        const value = row.querySelector('.v2-themes-top__value');
        const cols = getComputedStyle(row).gridTemplateColumns.split(' ').length;
        const box = value?.getBoundingClientRect(), rowBox = row.getBoundingClientRect();
        return { value: value?.textContent || '', width: Math.round(box?.width || 0), height: Math.round(rowBox.height), lines: box ? Math.round(box.height / (parseFloat(getComputedStyle(value).lineHeight) || 20)) : 0, sameLine: box ? box.top < rowBox.top + rowBox.height / 2 : false, cols, placeholders: [...row.children].filter((n) => !n.className && !n.textContent.trim()).length };
      })
    }));
    if (!rows.stale) fail(id, 'the stale clock did not put the 세부 테마 상위 card in its stale state (fixture)');
    const bad = rows.rows.filter((row) => row.width < 44 || row.lines > 1 || !row.sameLine || row.placeholders);
    if (!rows.rows.length) fail(id, 'no 세부 테마 상위 rows');
    if (bad.length) fail(id, `세부 테마 상위 value cells break on a stale basis: ${JSON.stringify(bad.slice(0, 2))}`);
    if (errors.length) fail(id, `page errors: ${errors.slice(0, 2).join(' | ')}`);
    console.log(`[theme-review] ${id}: stale ${rows.stale}, values ${rows.rows.map((row) => `${row.value}@${row.width}px`).join(' ')}, rows ${rows.rows.map((row) => row.height).join('/')}px`);
    await context.close();
  }
  // 스크리너 at phone light (16, 29).
  {
    const { context, page, errors } = await open(browser, { width: 390, height: 844, dark: false, mobile: true });
    await page.evaluate(() => window.showPage('screener'));
    await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length > 0 && /순위/.test(document.getElementById('scr-kicker-counts')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
    const kicker = await page.evaluate(() => document.getElementById('scr-kicker-counts')?.textContent.trim() || '');
    const ranked = kicker.match(/([\d,]+)종목 순위/)?.[1];
    if (!ranked) fail('screener', `kicker does not name the ranked count: "${kicker}"`);
    const banner = await page.evaluate(() => [...document.querySelectorAll('#scr-validation-banner > *')].filter((n) => n.getClientRects().length).map((n) => ({ text: n.textContent.trim(), cut: n.scrollWidth > n.clientWidth + 1 || getComputedStyle(n).textOverflow === 'ellipsis' && getComputedStyle(n).whiteSpace === 'nowrap' })));
    if (banner.some((n) => n.cut)) fail('screener', `validation banner cut on a phone: ${JSON.stringify(banner)}`);
    const firstPassed = page.locator('#screener-results-body tr[data-aio-screener-ticker] td').first();
    if (await firstPassed.count()) {
      await firstPassed.click();
      await page.waitForFunction(() => document.getElementById('scr-why-drawer') && !document.getElementById('scr-why-drawer').hidden, null, { timeout: 10000 }).catch(() => {});
      const rankline = await page.evaluate(() => document.getElementById('scr-why-rankline')?.textContent.trim() || '');
      if (ranked && !/보류/.test(rankline) && !rankline.includes(`${ranked}종목 중`)) fail('screener', `drawer rank "${rankline}" does not read against the kicker's ${ranked} ranked`);
      console.log(`[theme-review] screener: kicker "${kicker}", drawer "${rankline}"`);
    }
    if (errors.length) fail('screener', `page errors: ${errors.slice(0, 2).join(' | ')}`);
    await context.close();
  }
} finally {
  await closeAll({ browser, server });
}
if (failures.length) {
  console.error('Theme/screener screen-review check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Theme/screener screen-review check OK: capex contrast + one-line heads, short scenario lead, map captions clear, sector headers whole, connected screener counts, banner whole.');
