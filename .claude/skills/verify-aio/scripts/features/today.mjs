// Map: features/today.md
import { openFromNav, tabTo, expectText, expectTabs } from '../lib/drive.mjs';

export default {
  title: '오늘 (요약 · 브리핑 · 뉴스)',
  steps: [
    ['nav 오늘 → 요약', (p) => openFromNav(p, '오늘', 'page-home')],
    ['허브 탭 3개', (p) => expectTabs(p, ['요약', '브리핑', '뉴스'])],
    // Codex audit F12 → v58.79 (layout over captions): the close basis is the page date line and the tally the axis chips;
    // the hero line speaks only for a held verdict. Check what each must carry, not one wording.
    ['요약 판정 (날짜 줄 종가 기준 · 판정어 · 축 칩)', async (p) => ({
      ...(await expectText(p, '#home-date-label', { pattern: /미국 종가 기준/ })),
      ...(await expectText(p, '#home-hero-total', { pattern: /^(?!판정 대기).+/ })),
      chips: await p.locator('#home-hero-components > *').count()
    })],
    // v58.80 F01 (P2089): the static shell requests the produced verdict first, preloads its one stylesheet, and leaves the
    // legacy scripts to the end of body, so the page and stylesheet win the first seconds. The served <head> is parsed, not the
    // live one: lazy chunks (aio-chat.js on idle or under webdriver, aio-qa-audits.js) are appended to document.head after boot.
    ['첫 화면 순서 (판정 요청 · 스타일 먼저 · 스크립트 뒤)', async (p) => {
      const shell = await p.evaluate(async () => {
        const served = new DOMParser().parseFromString(await (await fetch('./index.html', { cache: 'no-store' })).text(), 'text/html');
        return {
          verdictRequested: typeof window._aioTodayVerdict?.then === 'function',
          stylePreload: !!served.head.querySelector('link[rel="preload"][as="style"][href$="responsive.css"]'),
          headScripts: served.head.querySelectorAll('script[src*="js/aio-"], link[rel="preload"][as="script"]').length
        };
      });
      if (!shell.verdictRequested || !shell.stylePreload || shell.headScripts) throw new Error(`first-screen order: ${JSON.stringify(shell)}`);
      return shell;
    }],
    ['탭 브리핑', (p) => tabTo(p, '브리핑', 'page-briefing')],
    ['브리핑 날짜줄', (p) => expectText(p, '#briefing-date-line')],
    ['탭 뉴스', (p) => tabTo(p, '뉴스', 'page-market-news')],
    ['수집 창 (KST)', (p) => expectText(p, '#news-window-label', { pattern: /KST|직전 수집본/ })],
    ['24시간 건수 · 소스 수', async (p) => ({
      ...(await expectText(p, '#news-24h-count', { pattern: /\d/ })),
      ...(await expectText(p, '#news-24h-sources', { pattern: /개 출처/ }))
    })],
    ['표시 건수', (p) => expectText(p, '#market-news-count')]
  ]
};
