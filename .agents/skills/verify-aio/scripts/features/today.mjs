// Map: features/today.md
import { openFromNav, tabTo, expectText, expectTabs } from '../lib/drive.mjs';

export default {
  title: '오늘 (대시보드 · 브리핑 · 뉴스)',
  steps: [
    ['nav 오늘 → 대시보드', (p) => openFromNav(p, '오늘', 'page-home')],
    ['허브 탭 3개', (p) => expectTabs(p, ['대시보드', '브리핑', '뉴스'])],
    ['대시보드 판정 헤드라인 (종가 기준 · 6개 축)', (p) => expectText(p, '#home-hero-headline', { pattern: /종가 기준.*6개 축/ })],
    ['탭 브리핑', (p) => tabTo(p, '브리핑', 'page-briefing')],
    ['브리핑 날짜줄', (p) => expectText(p, '#briefing-date-line')],
    ['탭 뉴스', (p) => tabTo(p, '뉴스', 'page-market-news')],
    ['수집 창 (KST)', (p) => expectText(p, '#news-window-label', { pattern: /KST|직전 수집본/ })],
    ['24시간 건수 · 소스 수', async (p) => ({
      ...(await expectText(p, '#news-24h-count', { pattern: /\d/ })),
      ...(await expectText(p, '#news-24h-sources', { pattern: /개 소스/ }))
    })],
    ['표시 건수', (p) => expectText(p, '#market-news-count')]
  ]
};
