// Map: features/screener.md
import { openFromNav, expectText, expectCount, visibleText } from '../lib/drive.mjs';

const ROW = '#screener-results-body tr[data-aio-screener-ticker]';
const RSI_CHIP = '#scr-active-filter-chips [data-aio-screener-action="clear-filter"][data-aio-screener-arg="scr-rsi-min"]';
const tickers = (p) => p.$$eval(ROW, (r) => r.map((x) => x.dataset.aioScreenerTicker));
const passed = (p) => p.evaluate(() => Number((document.getElementById('scr-table-status')?.textContent || '').match(/통과\s*([\d,]+)/)?.[1]?.replace(/,/g, '') ?? NaN));
const headers = (p) => p.$$eval('#screener-results-table thead th', (cells) => cells.map((cell) => cell.textContent.trim()).join('|'));

export default {
  title: '스크리너 (시장 선택 · + 조건 칩 · 보기 · 검색 · 더 보기 · 설명 서랍 → 종목)',
  steps: [
    ['nav 스크리너', (p) => openFromNav(p, '스크리너', 'page-screener')],
    ['상장 시장 US + 순위 행', async (p) => {
      await p.selectOption('#scr-listing-market', 'US');
      return expectCount(p, ROW, 1, 30000).catch(async (error) => {
        // P1673: name the environment cause instead of a bare "0 rows" when the local artifact is stale.
        const empty = await p.evaluate(() => document.querySelector('#screener-results-body tr')?.textContent || '');
        if (/최신 거래일 기준이 아니어서 순위 판정을 보류/.test(empty)) throw new Error(`local screener artifact is older than the latest US session (all rows held): ${empty.trim().slice(0, 90)} — refresh public-data before driving`);
        throw error;
      });
    }],
    ['+ 조건 → RSI 하한 칩 → Escape 복귀 → 칩 × 로 원래 행', async (p) => {
      const before = await tickers(p);
      const passedBefore = await passed(p);
      await p.click('#scr-add-condition');
      await p.waitForFunction(() => document.getElementById('scr-condition-panel')?.hidden === false, null, { timeout: 5000 });
      await p.fill('#scr-rsi-min', '50');
      await p.dispatchEvent('#scr-rsi-min', 'change');
      await p.waitForSelector(RSI_CHIP, { timeout: 10000 });
      await p.keyboard.press('Escape');
      const closed = await p.evaluate(() => ({ hidden: document.getElementById('scr-condition-panel').hidden, focus: document.activeElement?.id }));
      if (!closed.hidden || closed.focus !== 'scr-add-condition') throw new Error(`Escape left the panel ${JSON.stringify(closed)}`);
      const chip = (await visibleText(p, RSI_CHIP)).replace(/\s+/g, ' ');
      const passedWith = await passed(p);
      if (Number.isFinite(passedBefore) && Number.isFinite(passedWith) && passedWith > passedBefore) throw new Error(`a narrowing condition grew the passing count ${passedBefore} -> ${passedWith}`);
      await p.click(RSI_CHIP);
      await p.waitForFunction(({ s, n }) => document.querySelectorAll(s).length === n, { s: ROW, n: before.length }, { timeout: 10000 });
      const after = await tickers(p);
      if (after.join() !== before.join()) throw new Error('clearing the chip did not restore the same rows');
      return { chip, passedBefore, passedWith, restored: after.length };
    }],
    ['보기 → 모멘텀 (가중치 + 열) → 균형 복귀', async (p) => {
      const baseHeader = await headers(p);
      await p.click('#scr-view-button');
      await p.click('#scr-view-panel [data-aio-screener-action="profile"][data-aio-screener-arg="momentum"]');
      const label = await expectText(p, '#scr-view-label', { pattern: /모멘텀/ });
      await p.waitForFunction((h) => [...document.querySelectorAll('#screener-results-table thead th')].map((c) => c.textContent.trim()).join('|') !== h, baseHeader, { timeout: 10000 });
      const momentumHeader = await headers(p);
      if (await p.isHidden('#scr-view-panel')) await p.click('#scr-view-button');
      await p.click('#scr-view-panel [data-aio-screener-action="profile"][data-aio-screener-arg="balanced"]');
      await expectText(p, '#scr-view-label', { pattern: /균형/ });
      await p.keyboard.press('Escape');
      return { ...label, momentumHeader: momentumHeader.slice(0, 80) };
    }],
    ['/ → 표에서 찾기 → 행 축소 → 지우면 복원', async (p) => {
      const before = await tickers(p);
      await p.evaluate(() => document.activeElement?.blur?.());
      await p.keyboard.press('/');
      if (await p.evaluate(() => document.activeElement?.id) !== 'scr-text-search') throw new Error('`/` did not focus 표에서 찾기');
      await p.keyboard.type(before[0]);
      await p.waitForFunction(({ s, n }) => { const r = document.querySelectorAll(s); return r.length > 0 && r.length < n; }, { s: ROW, n: before.length }, { timeout: 10000 }).catch(() => {});
      const after = await tickers(p);
      if (!after.includes(before[0])) throw new Error(`search "${before[0]}" lost its own row`);
      if (before.length > 1 && after.length >= before.length) throw new Error(`search did not narrow rows (${before.length} → ${after.length})`);
      await p.fill('#scr-text-search', '');
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
