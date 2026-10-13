// Map: features/glossary.md
import { NAV, expectCount, visibleText } from '../lib/drive.mjs';

const ITEMS = '#glossary-body .aio-glossary-item';

export default {
  title: '용어 사전 (열기 · 분류 칩 · 검색 · Esc 닫기)',
  steps: [
    ['nav 용어 사전 → 대화상자 + 검색창 포커스', async (p) => {
      await p.click(NAV('용어 사전'));
      await p.waitForSelector('#glossary-modal', { state: 'visible', timeout: 10000 });
      const r = await expectCount(p, ITEMS, 10, 10000);
      await p.waitForFunction(() => document.activeElement?.id === 'glossary-search', null, { timeout: 3000 });
      return { ...r, focus: 'glossary-search' };
    }],
    ['분류 칩 → 항목 축소', async (p) => {
      const all = await p.$$eval(ITEMS, (n) => n.length);
      const chip = p.locator('#glossary-cats button[data-action="_aioGlossaryCat"]').nth(1);
      const label = (await chip.innerText()).trim();
      await chip.click();
      await p.waitForFunction((n) => { const c = document.querySelectorAll('#glossary-cats button[aria-pressed="true"]'); return c.length === 1 && document.querySelectorAll('#glossary-body .aio-glossary-item').length < n; }, all, { timeout: 5000 });
      return { chip: label, all, filtered: await p.$$eval(ITEMS, (n) => n.length) };
    }],
    ['검색 PER → 일치 항목', async (p) => {
      await p.fill('#glossary-search', 'PER');
      await p.waitForFunction(() => /PER/.test(document.querySelector('#glossary-body')?.innerText || ''), null, { timeout: 8000 });
      return { items: await p.$$eval(ITEMS, (n) => n.length), body: (await visibleText(p, '#glossary-body')).slice(0, 80) };
    }],
    ['Esc 닫기', async (p) => {
      await p.keyboard.press('Escape');
      await p.waitForSelector('#glossary-modal', { state: 'hidden', timeout: 5000 });
      return { closed: true };
    }]
  ]
};
