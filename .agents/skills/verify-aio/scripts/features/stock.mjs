// Map: features/stock.md
import { openFromNav, tabTo, expectText, expectTabs, visibleText } from '../lib/drive.mjs';

const SUBJECT = '#aio-hub-tabs .aio-hub-subject strong';
const PRICE = /^(—|[$₩]?[\d,]+(\.\d+)?)$/;

// v59.70 (wave2-f S23): the 종목 box is the command search's 종목 scope; Enter opens the first row.
async function search(p, value) {
  await p.click('#ticker-search-open');
  await p.waitForSelector('#aio-command-search[open]', { timeout: 5000 });
  await p.fill('#aio-command-input', value);
  await p.press('#aio-command-input', 'Enter');
}

// v59.55 (alignment pass): on 개요 the hub line drops the symbol (the page title names it), so the selected company there is
// the route's `sym` and the hero; on 차트 and 재무 공시 it is the hub subject.
const OVERVIEW_SUBJECT = () => new URLSearchParams(decodeURIComponent(location.hash).split('?')[1] || '').get('sym') || '';
async function currentSubject(p) {
  return (await p.evaluate(() => document.querySelector('.page.active')?.id)) === 'page-ticker' ? p.evaluate(OVERVIEW_SUBJECT) : visibleText(p, SUBJECT);
}

async function heroState(p, symbol) {
  await p.waitForFunction(([s, read]) => new Function(`return (${read})()`)() === s && (document.querySelector('#ticker-hero-name')?.textContent || '').trim(), [symbol, OVERVIEW_SUBJECT.toString()], { timeout: 25000 });
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
    ['허브 탭 3개', (p) => expectTabs(p, ['개요', '차트', '재무 공시'])],
    ['티커 NVDA + Enter → 개요', async (p) => { await search(p, 'NVDA'); return heroState(p, 'NVDA'); }],
    ['탭 차트 (같은 종목)', async (p) => ({ ...(await tabTo(p, '차트', 'page-technical')), subject: await visibleText(p, SUBJECT) })],
    // The visible chart (stock-chart component) must follow the company, not stay on SPY.
    ['차트 제목이 같은 종목', async (p) => expectText(p, '#stock-chart-title', { pattern: /^NVDA\b/ })],
    ['탭 재무 공시 (같은 종목)', async (p) => {
      const r = await tabTo(p, '재무 공시', 'page-fundamental');
      const subject = await visibleText(p, SUBJECT);
      if (subject !== 'NVDA') throw new Error(`subject lost on 재무 공시: "${subject}"`);
      return { ...r, subject };
    }],
    ['탭 개요 복귀 (같은 종목)', async (p) => ({ ...(await tabTo(p, '개요', 'page-ticker')), ...(await heroState(p, 'NVDA')) })],
    ['한글명 삼성전자 → 005930.KS', async (p) => {
      await search(p, '삼성전자');
      const r = await heroState(p, '005930.KS');
      return { ...r, ...(await expectText(p, '#ticker-hero-name', { pattern: /삼성전자/ })) };
    }],
    // v58.80 (P2088/R728): a candidate picked from the Korean-name list fills the 재무 tile with the company summary below it;
    // a late repaint used to put the tile back on '불러오는 중' for ~12 s with the click-time arguments.
    ['한글 후보 애플 → 재무 칸 즉시', async (p) => {
      await p.click('#ticker-search-open');
      await p.fill('#aio-command-input', '애플');
      const pick = p.locator('#aio-command-results [role="option"]', { hasText: 'AAPL' });
      await pick.waitFor({ timeout: 5000 });
      const started = Date.now();
      await pick.click();
      await heroState(p, 'AAPL');
      await p.waitForFunction(() => { const tile = [...document.querySelectorAll('#ticker-read *')].find((n) => n.children.length && /^재무/.test((n.textContent || '').trim()) && n.textContent.length < 200); return tile && !/불러오는 중/.test(tile.textContent); }, null, { timeout: 4000 });
      return { subject: 'AAPL', tileReadyMs: Date.now() - started };
    }],
    ['잘못된 입력 → 안내, 화면 유지', async (p) => {
      // Codex audit F12: the miss stays where it was typed (no toast); the subject stays. v59.70: the command search says
      // there is no result, and an unlisted symbol is refused in its status line, never guessed.
      const before = await currentSubject(p);
      await search(p, '!!');
      await p.waitForFunction(() => /검색 결과가 없습니다/.test(document.getElementById('aio-command-results')?.textContent || ''), null, { timeout: 8000 });
      await p.fill('#aio-command-input', 'ZZZZQ'); // the dialog is still open; the page behind it is inert
      await p.press('#aio-command-input', 'Enter');
      await p.waitForFunction(() => /목록에 없는 기호/.test(document.getElementById('aio-command-status')?.textContent || ''), null, { timeout: 8000 });
      const hint = await visibleText(p, '#aio-command-status');
      await p.keyboard.press('Escape');
      const subject = await currentSubject(p);
      if (subject !== before) throw new Error(`an invalid search replaced the subject: "${before}" -> "${subject}"`);
      return { subject, hint: hint.slice(0, 80) };
    }]
  ]
};
