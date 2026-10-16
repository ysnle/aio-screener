// Map: features/learn.md
import { openFromNav, tabTo, expectText, expectCount, expectTabs } from '../lib/drive.mjs';
import { RESEARCH_PAGES } from '../../../../../src/ui/knowledge/research-shell.js';

// Codex audit F12 (2026-10-15): titles come from the product registry, not copies — a renamed tab failed the drive
// while the screen worked.
const T = Object.fromEntries(RESEARCH_PAGES.map((page) => [page.route, page.title]));

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const title = (route) => (p) => expectText(p, `.rl-shell[data-research-page="${route}"] h1.rl-title`, { pattern: new RegExp(`^${escape(T[route])}$`) });

export default {
  title: '리서치 라이브러리 (탭별 제목 · 통합 검색 · 목차 문서 열기)',
  steps: [
    ['nav 리서치 라이브러리', (p) => openFromNav(p, '리서치 라이브러리', 'page-principles')],
    ['허브 탭 3개', (p) => expectTabs(p, [T.principles, T.atlas, T.masters])],
    ['개념·분석 제목 + 서가', async (p) => ({ ...(await title('principles')(p)), ...(await expectText(p, '#page-principles .rl-shelf > summary', { pattern: /컬렉션/ })) })],
    ['통합 검색 ROIC → 결과', async (p) => {
      await p.fill('#page-principles input[aria-label="리서치 라이브러리 통합 검색"]', 'ROIC');
      return expectCount(p, '#page-principles .rl-result[data-research-result]', 1, 10000);
    }],
    ['목차 항목 열기 → 활성 표시 + 본문 변경', async (p) => {
      await p.keyboard.press('Escape');
      const item = p.locator('#page-principles .rl-nav-item[data-principles-action="frame"]:not([aria-pressed="true"])').first();
      const label = (await item.innerText()).trim().split('\n')[0];
      const before = await p.evaluate(() => document.querySelector('#page-principles .rl-main')?.innerText.slice(0, 200) || '');
      await item.scrollIntoViewIfNeeded();
      await item.click();
      await p.waitForFunction((b) => { const m = document.querySelector('#page-principles .rl-main'); return m && m.innerText.slice(0, 200) !== b; }, before, { timeout: 10000 });
      const pressed = await p.$$eval('#page-principles .rl-nav-item[aria-pressed="true"], #page-principles .rl-nav-item.is-active', (n) => n.map((x) => x.innerText.trim().split('\n')[0]));
      if (!pressed.includes(label)) throw new Error(`clicked "${label}" but active items are ${JSON.stringify(pressed)}`);
      return { opened: label, docTitle: await p.evaluate(() => document.querySelector('#page-principles .rl-main h2.rl-doc-title')?.innerText.trim() || null) };
    }],
    ['서가 칩 칼럼 → 책등 → 상세 카드 → 읽기', async (p) => {
      const shelf = '#page-principles .rl-shelf';
      await p.evaluate((s) => { const d = document.querySelector(s); if (d && !d.open) d.open = true; }, shelf);
      await expectCount(p, `${shelf} .rl-spine`, 1, 10000);
      const chip = p.locator(`${shelf} .rl-shelf-chip`, { hasText: '칼럼' }).first();
      const want = Number((await chip.locator('span').innerText()).trim());
      await chip.click();
      await p.waitForFunction(({ s, n }) => document.querySelectorAll(`${s} .rl-spine`).length === n, { s: shelf, n: want }, { timeout: 10000 });
      const spine = p.locator(`${shelf} .rl-spine`).first();
      const label = (await spine.getAttribute('aria-label')) || '';
      await spine.click();
      const card = `${shelf} .rl-book:not([hidden])`;
      await p.waitForSelector(`${card} h3`, { timeout: 10000 });
      const heading = (await p.textContent(`${card} h3`)).trim();
      if (!label.startsWith(heading)) throw new Error(`card "${heading}" does not match spine "${label}"`);
      await p.click(`${card} button:has-text("읽기")`);
      await p.waitForFunction(() => /[?&]chapter=/.test(location.search), null, { timeout: 10000 });
      return { columns: want, opened: heading, search: await p.evaluate(() => location.search) };
    }],
    ['탭 산업 지도', async (p) => ({ ...(await tabTo(p, T.atlas, 'page-atlas')), ...(await title('atlas')(p)) })],
    ['탭 대가 보유 종목 + 운용사 목차', async (p) => ({
      ...(await tabTo(p, T.masters, 'page-masters')),
      ...(await title('masters')(p)),
      ...(await expectCount(p, '#page-masters .rl-nav-item[data-masters-action]', 1))
    })]
  ]
};
