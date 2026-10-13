// Map: features/macro.md
import { openFromNav, tabTo, expectText, expectCount, expectTabs } from '../lib/drive.mjs';

export default {
  title: '거시 · 금리 (거시 국면 · 금리 곡선 · 환율)',
  steps: [
    ['nav 거시 · 금리 → 거시 경제', (p) => openFromNav(p, '거시 · 금리', 'page-macro')],
    ['허브 탭 2개', (p) => expectTabs(p, ['거시 경제', '금리 · 환율'])],
    ['다음 주요 발표 확정', async (p) => {
      await p.waitForFunction(() => { const t = document.querySelector('#macro-next-release')?.innerText.trim() || ''; return t && !/계산 중/.test(t); }, null, { timeout: 25000 });
      return expectText(p, '#macro-next-release', { pattern: /다음 주요 발표/ });
    }],
    ['거시 국면 사분면 + 영향 카드', async (p) => ({ ...(await expectCount(p, '#macro-regime > *', 1)), ...(await expectCount(p, '#macro-axes > *', 1)) })],
    ['공식 지표 보드', (p) => expectCount(p, '#macro-board > *', 1)],
    ['탭 금리 · 환율', (p) => tabTo(p, '금리 · 환율', 'page-fxbond')],
    ['국채 5개 만기 (% · bp)', async (p) => {
      const r = await expectCount(p, '#rates-yields .rates-yield', 5);
      return { ...r, ...(await expectText(p, '#rates-yields', { pattern: /%[\s\S]*bp/ })), ...(await expectText(p, '#rates-basis', { pattern: /종가|고시/ })) };
    }],
    ['곡선 · 스프레드', async (p) => ({ ...(await expectText(p, '#rates-curve')), ...(await expectText(p, '#rates-spreads')) })],
    ['환율 카드', (p) => expectCount(p, '#rates-fx-grid > *', 4)]
  ]
};
