// Map: features/shell.md
import { expectActive, expectCount, expectText } from '../lib/drive.mjs';

const isDark = (p) => p.evaluate(() => document.body.classList.contains('dark-theme'));

export default {
  title: '공통 셸 (도움말 · 다크/라이트 전환 유지 · 딥링크)',
  steps: [
    ['topbar 도움말 → 사용 설명서', async (p) => ({
      ...(await (async () => { await p.click('#topbar-help-btn'); return expectActive(p, 'page-guide'); })()),
      ...(await expectCount(p, '#page-guide > details.aio-guide-chapter', 3)) // v59.51: help has three chapters; screen cards retired
    })],
    // v59.70 (wave2-f S23, D4): one command search — 도움말 is its scope; Ctrl+K opens it on every screen.
    ['설명서 검색 → 문단으로 이동', async (p) => {
      await p.click('#guide-search-open');
      await p.waitForSelector('#aio-command-search[open]', { timeout: 5000 });
      await p.fill('#aio-command-input', '시장 폭');
      await p.locator('#aio-command-results [role="option"][data-kind="guide"]').first().waitFor({ timeout: 5000 });
      await p.press('#aio-command-input', 'Enter');
      await p.waitForFunction(() => { const el = document.activeElement; return el && el.id !== 'page-guide' && document.getElementById('page-guide')?.contains(el) && /시장 폭/.test(el.textContent || ''); }, null, { timeout: 5000 });
      return { focused: await p.evaluate(() => document.activeElement.textContent.trim().slice(0, 60)) };
    }],
    ['Ctrl+K → NVDA → 종목 개요', async (p) => {
      await p.keyboard.press('Control+k');
      await p.waitForSelector('#aio-command-search[open]', { timeout: 5000 });
      await p.keyboard.type('NVDA');
      await p.locator('#aio-command-results [role="option"]', { hasText: 'NVDA' }).first().waitFor({ timeout: 5000 });
      await p.keyboard.press('Enter');
      const r = await expectActive(p, 'page-ticker', 15000);
      await p.waitForFunction(() => window._currentTickerId === 'NVDA', null, { timeout: 10000 });
      return { ...r, subject: 'NVDA' };
    }],
    ['시장 폭 → 화면 이동', async (p) => {
      await p.keyboard.press('Control+k');
      await p.click('#aio-command-search [data-cmd-scope="screen"]');
      await p.fill('#aio-command-input', '시장 폭');
      await p.locator('#aio-command-results [role="option"][data-kind="screen"]').first().waitFor({ timeout: 5000 });
      await p.press('#aio-command-input', 'Enter');
      return expectActive(p, 'page-breadth', 15000);
    }],
    ['하이일드 → 용어', async (p) => {
      await p.keyboard.press('Control+k');
      await p.click('#aio-command-search [data-cmd-scope="term"]');
      await p.fill('#aio-command-input', '하이일드');
      await p.locator('#aio-command-results [role="option"][data-kind="term"]').first().waitFor({ timeout: 5000 });
      await p.press('#aio-command-input', 'Enter');
      await p.waitForFunction(() => /하이일드/.test(document.querySelector('#glossary-body details[open] .aio-glossary-term')?.textContent || ''), null, { timeout: 8000 });
      const term = await p.evaluate(() => document.querySelector('#glossary-body details[open] .aio-glossary-term').textContent);
      await p.keyboard.press('Escape');
      await p.waitForSelector('#glossary-modal', { state: 'hidden', timeout: 5000 });
      return { term };
    }],
    ['사이드바 테마 전환 → 라벨이 다음 동작을 가리킴', async (p) => {
      const before = await isDark(p);
      await p.click('.sidebar #sidebar-theme-btn');
      await p.waitForFunction((b) => document.body.classList.contains('dark-theme') !== b, before, { timeout: 5000 });
      const after = await isDark(p);
      const label = (await p.textContent('#sidebar-theme-label')).trim();
      if (label !== (after ? '라이트 모드로 전환' : '다크 모드로 전환')) throw new Error(`label "${label}" does not name the next action`);
      return { from: before ? 'dark' : 'light', to: after ? 'dark' : 'light', label, stored: await p.evaluate(() => localStorage.getItem('aio_theme')) };
    }],
    ['새로고침 후 테마 유지 → 원래대로 되돌림', async (p) => {
      const want = await isDark(p);
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), null, { timeout: 30000 });
      if ((await isDark(p)) !== want) throw new Error('theme not restored after reload');
      await p.click('.sidebar #sidebar-theme-btn');
      await p.waitForFunction((w) => document.body.classList.contains('dark-theme') !== w, want, { timeout: 5000 });
      return { restored: want ? 'dark' : 'light', revertedTo: (await isDark(p)) ? 'dark' : 'light' };
    }],
    ['딥링크 #fxbond → 해당 화면 + 허브 탭 활성', async (p, { baseUrl }) => {
      await p.goto(`${baseUrl}/index.html#fxbond`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => typeof window.showPage === 'function', null, { timeout: 30000 });
      const r = await expectActive(p, 'page-fxbond', 30000);
      const current = await p.$$eval('#aio-hub-tabs button.aio-hub-tab', (b) => b.filter((x) => x.getAttribute('aria-current') === 'page' || x.classList.contains('active') || x.getAttribute('aria-selected') === 'true').map((x) => x.textContent.trim()));
      if (!current.includes('금리와 환율')) throw new Error(`active hub tab ${JSON.stringify(current)} is not 금리와 환율`);
      return { ...r, activeTab: current };
    }]
  ]
};
