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
      await p.locator('#page-principles .rl-nav-list > summary').first().click();
      const item = p.locator('#page-principles .rl-nav-item[data-principles-action="frame"]:not([aria-pressed="true"])').first();
      const label = (await item.innerText()).trim().split('\n')[0];
      const before = await p.evaluate(() => document.querySelector('#page-principles .rl-main')?.innerText.slice(0, 200) || '');
      await item.scrollIntoViewIfNeeded();
      await item.click();
      await p.waitForFunction((b) => { const m = document.querySelector('#page-principles .rl-main'); return m && m.innerText.slice(0, 200) !== b; }, before, { timeout: 10000 });
      const pressed = await p.$$eval('#page-principles .rl-nav-item[aria-pressed="true"], #page-principles .rl-nav-item.is-active', (n) => n.map((x) => x.innerText.trim().split('\n')[0]));
      if (!pressed.includes(label)) throw new Error(`clicked "${label}" but active items are ${JSON.stringify(pressed)}`);
      // v59.53: opening a document must move keyboard reading into it, rather than dropping focus on BODY.
      if (!await p.evaluate(() => !!document.activeElement?.closest('#page-principles .rl-main'))) throw new Error('opened document did not receive reading focus');
      return { opened: label, docTitle: await p.evaluate(() => document.querySelector('#page-principles .rl-main h2.rl-doc-title')?.innerText.trim() || null) };
    }],
    ['서가 칩 칼럼 → 책등 → 상세 카드 → 읽기', async (p) => {
      const shelf = '#page-principles .rl-shelf';
      await p.locator(`${shelf} > summary`).click();
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
      // A research page keeps its open document in the hash query (#principles?chapter=…, knowledge-route-state.js).
      await p.waitForFunction(() => /[?&]chapter=/.test(location.hash), null, { timeout: 10000 });
      return { columns: want, opened: heading, hash: await p.evaluate(() => location.hash) };
    }],
    ['탭 산업 지도', async (p) => ({ ...(await tabTo(p, T.atlas, 'page-atlas')), ...(await title('atlas')(p)) })],
    // 산업 지도 › AI 지도: the contents group opens the value chain; a layer picked by keyboard lands in the address, and the
    // data-center map opens from the map tabs. The capital map is offered only while its dated file has deals.
    ['산업 지도 › AI 지도 → 층 선택 → 데이터센터 지도', async (p) => {
      await p.locator('#page-atlas .rl-nav-group-head[data-atlas-value="aimap"]').click();
      await p.waitForSelector('#page-atlas .nmap--chain', { timeout: 20000 });
      const tabs = await p.$$eval('#page-atlas .nmap-tabs [role="tab"]', (n) => n.map((x) => x.textContent.trim()));
      if (!tabs.includes('밸류체인') || !tabs.includes('데이터센터·전력')) throw new Error(`map tabs ${JSON.stringify(tabs)}`);
      const layer = p.locator('#page-atlas .nmap-layer-open[data-atlas-value="2"]');
      if (await layer.isVisible()) { await layer.focus(); await p.keyboard.press('Enter'); } else await p.locator('#page-atlas .nmap-rows--layers [data-atlas-value="2"]').click();
      await p.waitForFunction(() => /[?&]layer=2(?:&|$)/.test(location.hash), null, { timeout: 10000 });
      const detail = (await p.textContent('#page-atlas .nmap-detail-title')).trim();
      await p.locator('#page-atlas .nmap-tabs [data-atlas-value="datacenter"]').click();
      await p.waitForSelector('#page-atlas .nmap--dc .nmap-detail-title', { timeout: 10000 });
      return { tabs, layerDetail: detail, hash: await p.evaluate(() => location.hash) };
    }],
    ['탭 대가 보유 종목 + 운용사 목차', async (p) => ({
      ...(await tabTo(p, T.masters, 'page-masters')),
      ...(await title('masters')(p)),
      ...(await expectCount(p, '#page-masters .rl-nav-item[data-masters-action]', 1))
    })]
  ]
};
