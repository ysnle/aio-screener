// Map: features/portfolio.md
import { openFromNav, expectActive, NAV } from '../lib/drive.mjs';

const KEY = 'aio_portfolio_data';
const holdings = (p) => p.evaluate(() => document.querySelector('#pf-holdings-table-section')?.innerText || '');
const stored = (p) => p.evaluate((k) => localStorage.getItem(k), KEY);

export default {
  title: '포트폴리오 (추가 · 미확인 티커 거부 · 저장 · 새로고침 유지 · 삭제)',
  steps: [
    ['nav 포트폴리오 (빈 상태)', async (p) => {
      const r = await openFromNav(p, '포트폴리오', 'page-portfolio');
      await p.waitForFunction(() => /포트폴리오가 비어 있습니다/.test(document.querySelector('#pf-holdings-table-section')?.innerText || ''), null, { timeout: 10000 })
        .catch(async () => { throw new Error(`fresh context is not empty: ${(await holdings(p)).slice(0, 120)}`); });
      return r;
    }],
    ['종목 추가 → 입력 폼', async (p) => {
      await p.click('#page-portfolio button[data-action="_aioTogglePortfolioEntry"]:text-is("종목 추가")');
      await p.waitForSelector('#pf-entry-section.is-open #pf-add-ticker', { state: 'visible', timeout: 8000 });
      return { formOpen: true };
    }],
    ['미확인 티커 ZZZZQ 거부 (저장 안 됨)', async (p) => {
      await p.fill('#pf-add-ticker', 'ZZZZQ');
      await p.fill('#pf-add-qty', '1');
      await p.fill('#pf-add-cost', '10');
      await p.click('#page-portfolio button[data-action="addPortfolioPosition"]');
      await p.waitForSelector('text=검증되지 않은 티커라 저장하지 않았습니다', { timeout: 5000 });
      const raw = await stored(p);
      if (raw && /ZZZZQ/.test(raw)) throw new Error('unknown ticker was stored');
      return { rejected: true, stored: raw };
    }],
    ['MSFT 3주 @400 추가 → 저장 완료 안내', async (p) => {
      await p.fill('#pf-add-ticker', 'MSFT');
      await p.fill('#pf-add-qty', '3');
      await p.fill('#pf-add-cost', '400');
      await p.click('#page-portfolio button[data-action="addPortfolioPosition"]');
      await p.waitForSelector('text=MSFT 포지션 추가 완료, 브라우저에 저장됨', { timeout: 8000 });
      await p.waitForFunction(() => /MSFT/.test(document.querySelector('#pf-holdings-table-section')?.innerText || ''), null, { timeout: 8000 });
      return { holdingsRow: true };
    }],
    ['저장소 두 번째 관점 (aio_portfolio_data)', async (p) => {
      const rows = JSON.parse((await stored(p)) || '[]');
      const m = rows.find((r) => r.ticker === 'MSFT');
      if (!m || m.qty !== 3 || m.cost !== 400) throw new Error(`stored row mismatch: ${JSON.stringify(rows)}`);
      return { key: KEY, row: { ticker: m.ticker, qty: m.qty, cost: m.cost, target: m.target, costCurrency: m.costCurrency } };
    }],
    ['새로고침 후 유지', async (p) => {
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), null, { timeout: 30000 });
      await p.click(NAV('포트폴리오'));
      await expectActive(p, 'page-portfolio');
      await p.waitForFunction(() => /MSFT/.test(document.querySelector('#pf-holdings-table-section')?.innerText || ''), null, { timeout: 10000 });
      return { persisted: true };
    }],
    ['상세 → 삭제 → 확인 모달 → 빈 상태 복귀', async (p) => {
      // The table row and the card layout both render a 삭제 for the symbol; only one has a box at a given width.
      const more = p.locator('#pf-holdings-table-section button[aria-label="MSFT 수량·단가·관리 보기"]:visible');
      if (await more.count()) await more.first().click();
      await p.click('#pf-holdings-table-section button[data-action="_aioRemovePosition"][data-arg="MSFT"]:visible');
      await p.waitForSelector('#aio-confirm-modal', { state: 'visible', timeout: 5000 });
      const title = (await p.textContent('#aio-confirm-title')).trim();
      await p.click('#aio-confirm-ok');
      await p.waitForFunction(() => !/MSFT/.test(document.querySelector('#pf-holdings-table-section')?.innerText || ''), null, { timeout: 8000 });
      const rows = JSON.parse((await stored(p)) || '[]');
      if (rows.some((r) => r.ticker === 'MSFT')) throw new Error('MSFT still stored after delete');
      return { confirmTitle: title, storedAfter: rows.length, emptyState: /포트폴리오가 비어 있습니다/.test(await holdings(p)) };
    }]
  ]
};
