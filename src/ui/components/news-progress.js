// Legacy unification (2026-10-26, roadmap item 11, screen 오늘 · 뉴스): the 뉴스 page's collection progress line and bar
// (#news-progress-wrap/-label/-bar) moved here from the writers inside fetchAllNews in js/aio-data.js. Texts, widths and
// the 2.5s hide after completion are unchanged. fetchAllNews still runs the collection and reports each step through
// window._aioRenderNewsProgress; it also keeps the last step in window._aioNewsProgressState so a step reported before
// this module loaded is painted when src/app/compatibility-globals.js installs it.

export function renderNewsProgress({ documentRef = globalThis.document, state } = {}) {
  if (!state) return;
  const wrap = documentRef?.getElementById?.('news-progress-wrap');
  const bar = documentRef?.getElementById?.('news-progress-bar');
  const label = documentRef?.getElementById?.('news-progress-label');
  const setLabel = (text) => { if (label) label.textContent = text; };
  const setWidth = (pct) => { if (bar) bar.style.width = `${pct}%`; };
  switch (state.phase) {
    case 'cached': // v21: the 10-minute cache was reused
      setLabel('뉴스 캐시 사용 중 - 최신 수집본 유지');
      setWidth(100);
      break;
    case 'start':
      if (wrap) wrap.style.display = 'block';
      setWidth(0);
      setLabel('뉴스 수집 준비 중');
      break;
    case 'step': {
      const { done = 0, total = 0 } = state;
      setWidth(Math.round(done / total * 100));
      setLabel((state.elapsedMs || 0) > 12000 ? `백그라운드 갱신, ${done}/${total}` : `뉴스 수집 중... ${done}/${total}`);
      break;
    }
    case 'done':
      setLabel(`뉴스 수집 완료, ${state.count}건 (${state.removed}건 필터링)`);
      setWidth(100);
      if (wrap) setTimeout(() => { wrap.style.display = 'none'; }, 2500);
      break;
    case 'empty': // v27.2: the run finished with no items
      setLabel('뉴스 소스 연결 실패 — 새로고침하거나 잠시 후 다시 시도하세요.');
      break;
    case 'error':
      setLabel('뉴스 수집 중 에러 발생 — 새로고침 버튼을 눌러주세요.');
      break;
    default:
      break;
  }
}
