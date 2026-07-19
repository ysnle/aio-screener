import { createResourceBag } from '../../app/lifecycle.js';
import { selectTechnical, selectSignal, selectHomeSummary } from '../../state/selectors/analysis.js';

function setText(documentRef, id, value, fallback = '—') {
  const node = documentRef?.getElementById(id);
  if (node) node.textContent = value == null || value === '' ? fallback : String(value);
}

function render({ documentRef, store, route }) {
  const technical = selectTechnical(store.getState());
  const signal = selectSignal(store.getState());
  const home = selectHomeSummary(store.getState());
  setText(documentRef, 'home-hero-total', home?.availableInputs);
  setText(documentRef, 'home-hero-headline', home?.status === 'unavailable' ? '판단 입력 대기' : `시장 판단 ${home.action}`);
  setText(documentRef, 'home-hero-desc', home ? `${home.availableInputs}개 입력 · 뉴스 ${home.newsCount}건 · ${home.status}` : '데이터 수신 후 표시됩니다.');
  setText(documentRef, 'home-trading-signal', home?.action);
  setText(documentRef, 'home-quality-score', home?.availableInputs == null ? null : `${home.availableInputs}/4`);
  setText(documentRef, 'score-gauge-val', signal?.score == null ? null : signal.score.toFixed(2));
  setText(documentRef, 'score-decision-badge', signal?.action);
  setText(documentRef, 'score-decision-sub', signal?.reasons?.join(' · ') || signal?.status);
  setText(documentRef, 'tech-candle-meta', technical ? `${technical.observedCount}개 관측 · ${technical.status}` : null);
  setText(documentRef, 'tech-candle-title', technical?.symbol ? `${technical.symbol} 일봉 · 이동평균` : null);
  setText(documentRef, 'tech-health-pill', technical?.status);
  setText(documentRef, 'health-score-display', technical?.indicators?.changePct == null ? null : `${technical.indicators.changePct.toFixed(2)}%`);
  const page = documentRef?.getElementById(`page-${route}`);
  if (page) {
    page.dataset.aioArchitectureRoute = route;
    page.dataset.aioArchitectureRenderer = 'native';
    page.dataset.aioArchitectureStatus = (route === 'home' ? home?.status : route === 'signal' ? signal?.status : technical?.status) || 'unavailable';
  }
}

export function createAnalysisPage({ documentRef, store, route = 'home' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ documentRef, store, route });
      renderNow();
      bag.add(store.subscribe(renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:liveQuotes', renderNow);
      eventTarget?.addEventListener?.('aio:refresh:done', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', renderNow));
      bag.add(() => eventTarget?.removeEventListener?.('aio:refresh:done', renderNow));
      return () => bag.dispose();
    }
  };
}
