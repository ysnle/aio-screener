// Map: features/charts.md
import { openFromNav, expectText, expectCount, activePage } from '../lib/drive.mjs';

// Owner 2026-11-19: one 기술적 분석 page — search, 시장 지수 cards, 대표 종목 rows, and one analysis slot below them.
const slotOn = (p, symbol) => p.waitForFunction((s) => document.getElementById('stock-chart-section')?.dataset.aioStockChartEntity === s
  && new RegExp(`^${s.replace('.', '\\.')}\\b`).test(document.getElementById('stock-chart-title')?.textContent || ''), symbol, { timeout: 25000 });

export default {
  title: '기술적 분석 (검색 · 시장 지수 · 대표 종목 · 분석 자리)',
  steps: [
    ['nav 기술적 분석', (p) => openFromNav(p, '기술적 분석', 'page-charts')],
    ['종가 기준 줄', async (p) => {
      await p.waitForFunction(() => /종가 · 일봉/.test(document.querySelector('#charts-basis')?.innerText || ''), null, { timeout: 25000 });
      return expectText(p, '#charts-basis', { pattern: /종가 · 일봉/ });
    }],
    ['시장 지수 카드 4개 이상 + 판정 + 차트', async (p) => ({
      ...(await expectCount(p, '#charts-index-grid [data-index]', 4)),
      ...(await expectCount(p, '#charts-index-grid [data-index] .charts-trend', 4)),
      ...(await expectCount(p, '#charts-index-grid [data-index] .charts-index-chart :is(svg, canvas)', 4)),
      ...(await expectText(p, '#charts-conclusion'))
    })],
    ['첫 카드 수치 표 접기', async (p) => {
      await p.locator('#charts-index-grid [data-index] details > summary').first().click();
      return expectText(p, '#charts-index-grid [data-index] details[open]');
    }],
    ['분석 자리 기본 SPY', async (p) => { await slotOn(p, 'SPY'); return expectText(p, '#stock-chart-title', { pattern: /^SPY\b/ }); }],
    ['검색 NVDA → 같은 화면 분석 자리', async (p) => {
      await p.click('#charts-search-open');
      await p.waitForSelector('#aio-command-search[open]', { timeout: 5000 });
      await p.fill('#aio-command-input', 'NVDA');
      await p.press('#aio-command-input', 'Enter');
      await slotOn(p, 'NVDA');
      const page = await activePage(p);
      const sym = await p.evaluate(() => new URLSearchParams(location.hash.split('?')[1] || '').get('sym'));
      if (page !== 'page-charts' || sym !== 'NVDA') throw new Error(`search left 기술적 분석 or the address: ${page} ${sym}`);
      return { page, sym };
    }],
    // The same card part as 시장 지수, one card per stock; a card settles on its candles or on the no-value line.
    ['대표 종목 카드 → 분석 자리', async (p) => {
      await p.getByRole('tab', { name: '대표 종목', exact: true }).click();
      const card = p.locator('#charts-weight-grid .charts-index-card[data-stock]').first();
      await card.waitFor({ state: 'visible', timeout: 25000 });
      await p.waitForFunction(() => ['bars', 'missing'].includes(document.querySelector('#charts-weight-grid .charts-index-card[data-stock]')?.dataset.source), null, { timeout: 25000 });
      const symbol = await card.getAttribute('data-symbol');
      const source = await card.getAttribute('data-source');
      await card.locator('.charts-open').click();
      await slotOn(p, symbol);
      return { symbol, source, ...(await expectCount(p, '#charts-weight-grid .charts-index-card[data-stock] .charts-trend', 2)) };
    }]
  ]
};
