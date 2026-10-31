// Map: features/screener.md
import { openFromNav, expectText, expectCount, visibleText } from '../lib/drive.mjs';

const ROW = '#screener-results-body tr[data-aio-screener-ticker]';
const tickers = (p) => p.$$eval(ROW, (r) => r.map((x) => x.dataset.aioScreenerTicker));
// Phone keeps the filters (market, search) in a bottom sheet behind 필터; desktop and tablet show them inline.
const inFilters = async (p, act) => {
  const sheet = await p.isVisible('#scr-filter-open');
  if (sheet) await p.click('#scr-filter-open');
  await act();
  if (sheet) await p.click('#scr-filter-sheet .scr-filter-close');
};

export default {
  title: '스크리너 (시장 선택 · 퍼널 · 검색 · 더 보기 · 설명 서랍 → 종목)',
  steps: [
    ['nav 스크리너', (p) => openFromNav(p, '스크리너', 'page-screener')],
    ['상장 시장 US + 순위 행', async (p) => {
      await inFilters(p, () => p.selectOption('#scr-listing-market', 'US'));
      return expectCount(p, ROW, 1, 30000).catch(async (error) => {
        // P1673: name the environment cause instead of a bare "0 rows" when the local artifact is stale.
        const empty = await p.evaluate(() => document.querySelector('#screener-results-body tr')?.textContent || '');
        if (/최신 거래일 기준이 아니어서 순위 판정을 보류/.test(empty)) throw new Error(`local screener artifact is older than the latest US session (all rows held): ${empty.trim().slice(0, 90)} — refresh public-data before driving`);
        throw error;
      });
    }],
    // The fold lives in #screener-workbench, shown only in the 맞춤 조건 view, which in turn hides the ranking table.
    ['맞춤 조건 → 결과 범위 펼치기 → 퍼널 수치 → 순위 복귀', async (p) => {
      await p.click('#scr-view-button-custom');
      if (!(await p.evaluate(() => document.getElementById('scr-funnel-universe')?.closest('details')?.open))) await p.click('#scr-workbench-advanced > summary');
      const funnel = { ...(await expectText(p, '#scr-funnel-universe', { pattern: /\d/ })), ...(await expectText(p, '#scr-funnel-passed', { pattern: /\d/ })) };
      await p.click('#scr-tab-button-ranking');
      await expectCount(p, ROW, 1, 10000);
      return funnel;
    }],
    ['텍스트 검색 → 행 축소 → 지우면 복원', async (p) => {
      const before = await tickers(p);
      await inFilters(p, () => p.fill('#scr-text-search', before[0]));
      await p.waitForFunction(({ s, n }) => { const r = document.querySelectorAll(s); return r.length > 0 && r.length < n; }, { s: ROW, n: before.length }, { timeout: 10000 }).catch(() => {});
      const after = await tickers(p);
      if (!after.includes(before[0])) throw new Error(`search "${before[0]}" lost its own row`);
      if (before.length > 1 && after.length >= before.length) throw new Error(`search did not narrow rows (${before.length} → ${after.length})`);
      await inFilters(p, () => p.fill('#scr-text-search', ''));
      await p.waitForFunction(({ s, n }) => document.querySelectorAll(s).length === n, { s: ROW, n: before.length }, { timeout: 10000 });
      return { query: before[0], before: before.length, after: after.length, restored: before.length };
    }],
    ['더 보기 → 12행 추가 (남은 행이 있을 때)', async (p) => {
      const n = (await tickers(p)).length;
      const more = p.locator('#page-screener button:has-text("더 보기")').first();
      if (!(await more.count()) || !(await more.isVisible())) return { skipped: `no load-more button (${n} rows is the whole filtered set)` };
      await more.click();
      await p.waitForFunction(({ s, k }) => document.querySelectorAll(s).length > k, { s: ROW, k: n }, { timeout: 10000 });
      return { before: n, after: (await tickers(p)).length };
    }],
    ['행 클릭 → 설명 서랍', async (p) => {
      const sym = (await tickers(p))[0];
      await p.locator(`${ROW}[data-aio-screener-ticker="${sym}"] td`).first().click();
      await p.waitForFunction(() => document.querySelector('#scr-why-drawer') && !document.querySelector('#scr-why-drawer').hidden, null, { timeout: 10000 });
      const title = await visibleText(p, '#scr-why-title');
      if (!title.startsWith(sym)) throw new Error(`drawer title "${title}" does not start with ${sym}`);
      return { symbol: sym, title };
    }],
    ['서랍 → 종목 열기', async (p) => {
      const sym = (await visibleText(p, '#scr-why-title')).split(/\s/)[0];
      await p.click('#scr-why-drawer [data-aio-screener-action="open-ticker"]');
      await p.waitForFunction(() => document.querySelector('.page.active')?.id === 'page-ticker', null, { timeout: 15000 });
      return { symbol: sym, ...(await expectText(p, '#ticker-hero-name', { pattern: new RegExp(sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })) };
    }]
  ]
};
