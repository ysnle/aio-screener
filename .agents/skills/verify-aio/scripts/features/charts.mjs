// Map: features/charts.md
import { openFromNav, expectText, expectCount } from '../lib/drive.mjs';

export default {
  title: '기술적 분석 (지수 차트 · 대표 종목)',
  steps: [
    ['nav 기술적 분석', (p) => openFromNav(p, '기술적 분석', 'page-charts')],
    ['종가 기준 줄', async (p) => {
      await p.waitForFunction(() => /종가 · 일봉/.test(document.querySelector('#charts-basis')?.innerText || ''), null, { timeout: 25000 });
      return expectText(p, '#charts-basis', { pattern: /종가 · 일봉/ });
    }],
    ['지수 추세 → 지수 카드 4개 이상 + 차트', async (p) => {
      await p.getByRole('tab', { name: '지수 추세', exact: true }).click();
      return { ...(await expectCount(p, '#charts-index-grid [data-index]', 4)), ...(await expectCount(p, '#charts-index-grid [data-index] svg', 4)), ...(await expectText(p, '#charts-conclusion')) };
    }],
    ['첫 카드 차트 읽기 접기', async (p) => {
      await p.locator('#charts-index-grid [data-index] details > summary').first().click();
      return expectText(p, '#charts-index-grid [data-index] details[open]');
    }],
    ['대표 종목 표', async (p) => {
      await p.getByRole('tab', { name: '대표 종목', exact: true }).click();
      await p.locator('#charts-stock-table tr').first().waitFor({ state: 'visible' });
      return expectCount(p, '#charts-stock-table tr', 2);
    }]
  ]
};
