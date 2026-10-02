// 2026-10-01 information architecture (AGENTS.md): 19 routes are presented as eight
// screens. A screen's sub-routes are switched by the in-page tab bar below the topbar;
// route ids, deep links and page owners stay unchanged until each screen is merged.
export const ROUTE_HUBS = Object.freeze([
  { id: 'today', label: '오늘', routes: [{ id: 'home', label: '대시보드' }, { id: 'briefing', label: '브리핑' }, { id: 'market-news', label: '뉴스' }] },
  { id: 'market', label: '시장 상태', routes: [{ id: 'signal', label: '국면 판정' }, { id: 'breadth', label: '시장 폭' }, { id: 'sentiment', label: '투자 심리' }] },
  { id: 'macro', label: '거시 · 금리', routes: [{ id: 'macro', label: '거시경제' }, { id: 'fxbond', label: '환율 · 채권' }] },
  { id: 'themes', label: '테마 · 섹터', routes: [{ id: 'themes', label: '테마 · 섹터', also: ['theme-detail'] }, { id: 'theme-detail', label: '테마 상세', tab: false }] },
  { id: 'stock', label: '종목', routes: [{ id: 'fundamental', label: '기업 분석' }, { id: 'technical', label: '차트 · 기술' }, { id: 'ticker', label: '종목 상세', tab: false }] },
  { id: 'screener', label: '스크리너', routes: [{ id: 'screener', label: '스크리너' }] },
  { id: 'portfolio', label: '포트폴리오', routes: [{ id: 'portfolio', label: '포트폴리오' }] },
  { id: 'learn', label: '배우기', routes: [{ id: 'principles', label: '시장 원리' }, { id: 'masters', label: '대가의 포트폴리오' }, { id: 'atlas', label: '지식 지도' }, { id: 'guide', label: '사용 설명서' }] }
].map((hub) => Object.freeze({ ...hub, routes: Object.freeze(hub.routes.map((route) => Object.freeze({ ...route }))) })));

export function hubForRoute(routeId) {
  return ROUTE_HUBS.find((hub) => hub.routes.some((route) => route.id === routeId)) || null;
}

export function renderHubTabs({ documentRef, routeId }) {
  const nav = documentRef?.getElementById?.('aio-hub-tabs');
  if (!nav) return null;
  const hub = hubForRoute(routeId);
  const tabs = hub ? hub.routes.filter((route) => route.tab !== false) : [];
  nav.replaceChildren();
  if (tabs.length < 2) {
    nav.hidden = true;
    delete nav.dataset.hub;
    return null;
  }
  nav.hidden = false;
  nav.dataset.hub = hub.id;
  for (const tab of tabs) {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'aio-hub-tab';
    button.dataset.action = 'showPage';
    button.dataset.arg = tab.id;
    button.textContent = tab.label;
    if (tab.id === routeId || (tab.also || []).includes(routeId)) button.setAttribute('aria-current', 'page');
    nav.appendChild(button);
  }
  return hub.id;
}

export function installRouteHubTabs({ root = globalThis, documentRef = root.document, activeRoute = () => null } = {}) {
  const render = (event) => renderHubTabs({ documentRef, routeId: event?.detail?.routeId || activeRoute() });
  // The router commits on the document (bootstrap legacy.on listens there too).
  const target = documentRef || root;
  target?.addEventListener?.('aio:navigationCommitted', render);
  render();
  return () => target?.removeEventListener?.('aio:navigationCommitted', render);
}
