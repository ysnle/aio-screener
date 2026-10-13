// Map: features/shell.md
import { expectActive, expectCount, expectText } from '../lib/drive.mjs';

const isDark = (p) => p.evaluate(() => document.body.classList.contains('dark-theme'));

export default {
  title: '공통 셸 (도움말 · 다크/라이트 전환 유지 · 딥링크)',
  steps: [
    ['topbar 도움말 → 사용 설명서', async (p) => ({
      ...(await (async () => { await p.click('#topbar-help-btn'); return expectActive(p, 'page-guide'); })()),
      ...(await expectCount(p, '#guide-screen-cards > *', 1))
    })],
    ['설명서 검색 → 결과', async (p) => {
      await p.fill('#guide-search-input', '시장 폭');
      await p.press('#guide-search-input', 'Enter');
      return expectText(p, '#guide-search-result', { pattern: /시장 폭/ });
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
      if (!current.includes('금리 · 환율')) throw new Error(`active hub tab ${JSON.stringify(current)} is not 금리 · 환율`);
      return { ...r, activeTab: current };
    }]
  ]
};
