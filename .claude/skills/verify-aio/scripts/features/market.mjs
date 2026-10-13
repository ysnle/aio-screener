// Map: features/market.md
import { openFromNav, tabTo, expectText, expectCount, expectTabs } from '../lib/drive.mjs';

export default {
  title: '시장 상태 (국면 판정 · 시장 폭 · 투자 심리)',
  steps: [
    ['nav 시장 상태 → 국면 판정', (p) => openFromNav(p, '시장 상태', 'page-signal')],
    ['허브 탭 3개', (p) => expectTabs(p, ['국면 판정', '시장 폭', '투자 심리'])],
    ['국면 판정 확정 (판정 대기 아님)', async (p) => ({
      ...(await expectText(p, '#regime-overall')),
      ...(await expectText(p, '#regime-basis', { pattern: /종가 기준/ }))
    })],
    ['국면 요약 문장 · 충돌 근거', async (p) => ({
      ...(await expectText(p, '#regime-headline', { min: 20 })),
      ...(await expectCount(p, '#regime-conflicts li', 1))
    })],
    ['미국 6개 축 보드 + 한국 참고 보드', async (p) => ({
      ...(await expectCount(p, '#regime-board .regime-axis', 6)),
      ...(await expectCount(p, '#regime-board-kr > *', 1))
    })],
    ['탭 시장 폭', (p) => tabTo(p, '시장 폭', 'page-breadth')],
    ['시장 폭 판정 · 해석 · 추세 카드', async (p) => {
      await p.waitForFunction(() => { const el = document.querySelector('#breadth-state'); return el && !el.classList.contains('is-unknown') && el.innerText.trim() && el.innerText.trim() !== '판정 대기'; }, null, { timeout: 25000 });
      return { ...(await expectText(p, '#breadth-state')), ...(await expectText(p, '#breadth-read', { min: 10 })), ...(await expectCount(p, '#breadth-chart-grid .trend-card', 1)) };
    }],
    ['탭 투자 심리', (p) => tabTo(p, '투자 심리', 'page-sentiment')],
    ['투자 심리 종합 · 카드', async (p) => ({
      ...(await expectText(p, '#sentiment-basis')),
      ...(await expectText(p, '#sentiment-synthesis', { min: 10 })),
      ...(await expectCount(p, '#sentiment-card-grid > *', 1))
    })]
  ]
};
