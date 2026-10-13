// Map: features/stock.md
import { openFromNav, tabTo, expectText, expectTabs, visibleText } from '../lib/drive.mjs';

const SUBJECT = '#aio-hub-tabs .aio-hub-subject strong';
const PRICE = /^(—|[$₩]?[\d,]+(\.\d+)?)$/;

async function search(p, value) {
  await p.fill('#ticker-direct-search', value);
  await p.press('#ticker-direct-search', 'Enter');
}

async function heroState(p, symbol) {
  await p.waitForFunction((s) => (document.querySelector('#aio-hub-tabs .aio-hub-subject strong')?.textContent || '') === s, symbol, { timeout: 25000 });
  const price = await visibleText(p, '#ticker-hero-price');
  if (!PRICE.test(price)) throw new Error(`hero price is neither a number nor —: "${price}"`);
  const basis = await visibleText(p, '#ticker-summary-price-basis');
  if (price === '—' && !basis) throw new Error('price is missing but no basis line explains why');
  return { subject: symbol, name: await visibleText(p, '#ticker-hero-name'), price, priceState: price === '—' ? 'missing' : 'numeric', basis };
}

export default {
  title: '종목 (티커·한글명 검색 · 같은 종목 3탭 유지 · 잘못된 입력)',
  steps: [
    ['nav 종목', (p) => openFromNav(p, '종목', 'page-ticker')],
    ['허브 탭 3개', (p) => expectTabs(p, ['요약', '차트', '재무 공시'])],
    ['티커 NVDA + Enter → 요약', async (p) => { await search(p, 'NVDA'); return heroState(p, 'NVDA'); }],
    ['탭 차트 (같은 종목)', async (p) => ({ ...(await tabTo(p, '차트', 'page-technical')), subject: await visibleText(p, SUBJECT) })],
    // The visible chart (stock-chart component) must follow the company, not stay on SPY.
    ['차트 제목이 같은 종목', async (p) => expectText(p, '#stock-chart-title', { pattern: /^NVDA\b/ })],
    ['탭 재무 공시 (같은 종목)', async (p) => {
      const r = await tabTo(p, '재무 공시', 'page-fundamental');
      const subject = await visibleText(p, SUBJECT);
      if (subject !== 'NVDA') throw new Error(`subject lost on 재무 공시: "${subject}"`);
      return { ...r, subject };
    }],
    ['탭 요약 복귀 (같은 종목)', async (p) => ({ ...(await tabTo(p, '요약', 'page-ticker')), ...(await heroState(p, 'NVDA')) })],
    ['한글명 삼성전자 → 005930.KS', async (p) => {
      await search(p, '삼성전자');
      const r = await heroState(p, '005930.KS');
      return { ...r, ...(await expectText(p, '#ticker-hero-name', { pattern: /삼성전자/ })) };
    }],
    ['잘못된 입력 → 안내, 화면 유지', async (p) => {
      await search(p, '!!');
      await p.waitForSelector('text=올바른 티커를 입력하세요', { timeout: 5000 });
      return { subject: await visibleText(p, SUBJECT) };
    }]
  ]
};
