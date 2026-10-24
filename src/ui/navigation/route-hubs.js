// 2026-10-01 information architecture (AGENTS.md): 19 routes are presented as eight
// screens. A screen's sub-routes are switched by the in-page tab bar below the topbar;
// route ids, deep links and page owners stay unchanged until each screen is merged.
export const ROUTE_HUBS = Object.freeze([
  { id: 'today', label: '오늘', routes: [{ id: 'home', label: '요약' }, { id: 'briefing', label: '브리핑' }, { id: 'market-news', label: '뉴스' }] },
  { id: 'market', label: '시장 상태', routes: [{ id: 'signal', label: '국면 판정' }, { id: 'breadth', label: '시장 폭' }, { id: 'sentiment', label: '투자 심리' }] },
  { id: 'macro', label: '거시와 금리', routes: [{ id: 'macro', label: '거시 경제' }, { id: 'fxbond', label: '금리와 환율' }] },
  { id: 'themes', label: '테마와 섹터', routes: [{ id: 'themes', label: '테마와 섹터', also: ['theme-detail'] }, { id: 'theme-detail', label: '테마 상세', tab: false }] },
  // P1430: one 종목 screen — 요약 · 차트 · 재무 공시 are three views of the same selected company.
  { id: 'stock', label: '종목', routes: [{ id: 'ticker', label: '요약' }, { id: 'technical', label: '차트' }, { id: 'fundamental', label: '재무 공시' }] },
  { id: 'screener', label: '스크리너', routes: [{ id: 'screener', label: '스크리너' }] },
  { id: 'portfolio', label: '포트폴리오', routes: [{ id: 'portfolio', label: '포트폴리오' }] },
  // 2026-10-05 owner decision: 리서치 라이브러리 — three research pages; the product guide is help (topbar), not research.
  { id: 'learn', label: '리서치 라이브러리', routes: [{ id: 'principles', label: '개념·분석' }, { id: 'atlas', label: '산업 지도' }, { id: 'masters', label: '대가 보유 종목' }, { id: 'guide', label: '도움말', tab: false }] }
].map((hub) => Object.freeze({ ...hub, routes: Object.freeze(hub.routes.map((route) => Object.freeze({ ...route }))) })));

export function hubForRoute(routeId) {
  return ROUTE_HUBS.find((hub) => hub.routes.some((route) => route.id === routeId)) || null;
}

// P1430: the 종목 screen names the company all three tabs are about, and where the user came from.
const SUBJECT_ORIGINS = Object.freeze({ home: '오늘', briefing: '브리핑', 'market-news': '뉴스', screener: '스크리너', themes: '테마', portfolio: '포트폴리오', masters: '대가 보유 종목', signal: '시장 상태', breadth: '시장 폭', sentiment: '투자 심리' });

export function readStockSubject(root) {
  const symbol = String(root?._aioLastOpenedSymbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) return null;
  const name = root?._aioLastOpenedName?.symbol === symbol ? String(root._aioLastOpenedName.name || '') : '';
  const from = String(root?.AIO?.state?.tickerReturnRoute || '');
  return { symbol, name: name && name.toUpperCase() !== symbol ? name : '', from: Object.hasOwn(SUBJECT_ORIGINS, from) ? from : null };
}

// 2026-10-18 UI review: 차트 had no way to pick a company and 재무 공시's own box only looked separate; one
// control on the hub line opens the 요약 search, which already sets the company for all three tabs.
function pickButton(documentRef, root, label) {
  const pick = documentRef.createElement('button');
  pick.type = 'button';
  pick.className = 'aio-hub-subject-pick';
  pick.textContent = label;
  pick.addEventListener('click', () => {
    root?.showPage?.('ticker');
    root?.setTimeout?.(() => documentRef.getElementById('ticker-direct-search')?.focus(), 60);
  });
  return pick;
}

function renderSubject(documentRef, nav, subject, root, routeId) {
  const box = documentRef.createElement('span');
  box.className = 'aio-hub-subject';
  if (!subject) {
    box.textContent = '종목을 고르면 세 탭이 같은 종목을 보여줍니다';
    if (routeId !== 'ticker') box.append(' ', pickButton(documentRef, root, '종목 고르기'));
    nav.appendChild(box);
    return;
  }
  const sym = documentRef.createElement('strong');
  sym.textContent = subject.symbol;
  box.appendChild(sym);
  if (subject.name) box.append(` ${subject.name}`);
  if (subject.from) {
    const back = documentRef.createElement('button');
    back.type = 'button';
    back.className = 'aio-hub-subject-from';
    back.dataset.action = 'showPage';
    back.dataset.arg = subject.from;
    back.textContent = `← ${SUBJECT_ORIGINS[subject.from]}`;
    box.appendChild(back);
  }
  if (routeId !== 'ticker') box.appendChild(pickButton(documentRef, root, '다른 종목'));
  nav.appendChild(box);
}

export function renderHubTabs({ documentRef, routeId, root = globalThis }) {
  const nav = documentRef?.getElementById?.('aio-hub-tabs');
  if (!nav) return null;
  const hub = hubForRoute(routeId);
  const tabs = hub ? hub.routes.filter((route) => route.tab !== false) : [];
  nav.replaceChildren();
  // Audit 2026-10-14: a hidden route with no parent tab (도움말 under 리서치 라이브러리) is not one of the hub's views —
  // showing the three research tabs with none selected read as a broken state.
  const current = hub ? hub.routes.find((route) => route.id === routeId) : null;
  const orphan = current?.tab === false && !tabs.some((tab) => (tab.also || []).includes(routeId));
  if (tabs.length < 2 || orphan) {
    nav.hidden = true;
    delete nav.dataset.hub;
    return null;
  }
  nav.hidden = false;
  nav.dataset.hub = hub.id;
  const subject = hub.id === 'stock' ? readStockSubject(root) : null;
  // v58.53 개편 v2: the tabs sit in one segmented control (soft-ui.css .aio-hub-seg).
  const seg = documentRef.createElement('span');
  seg.className = 'aio-hub-seg';
  nav.appendChild(seg);
  for (const tab of tabs) {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'aio-hub-tab';
    button.dataset.action = 'showPage';
    button.dataset.arg = tab.id;
    // 요약 is rebuilt by showTicker; opening it from 차트/재무 공시 keeps the same company.
    if (hub.id === 'stock' && tab.id === 'ticker' && subject && routeId !== 'ticker') {
      button.dataset.action = 'showTicker';
      button.dataset.arg = subject.symbol;
      button.dataset.hubRoute = 'ticker';
    }
    button.textContent = tab.label;
    if (tab.id === routeId || (tab.also || []).includes(routeId)) button.setAttribute('aria-current', 'page');
    seg.appendChild(button);
  }
  if (hub.id === 'stock') renderSubject(documentRef, nav, subject, root, routeId);
  return hub.id;
}

export function installRouteHubTabs({ root = globalThis, documentRef = root.document, activeRoute = () => null } = {}) {
  const render = (event) => renderHubTabs({ documentRef, root, routeId: event?.detail?.routeId || activeRoute() });
  const renderActive = () => renderHubTabs({ documentRef, root, routeId: activeRoute() });
  // The router commits on the document (bootstrap legacy.on listens there too).
  const target = documentRef || root;
  target?.addEventListener?.('aio:navigationCommitted', render);
  target?.addEventListener?.('aio:subjectChanged', renderActive);
  // A selection (showTicker, 기업 분석 search) names the company before its data arrives.
  const onEntity = (event) => { if (event?.detail?.id) setStockSubject({ root, documentRef, symbol: event.detail.id }); };
  target?.addEventListener?.('aio:entityChanged', onEntity);
  render();
  return () => {
    target?.removeEventListener?.('aio:navigationCommitted', render);
    target?.removeEventListener?.('aio:subjectChanged', renderActive);
    target?.removeEventListener?.('aio:entityChanged', onEntity);
  };
}

// P1430: the one place that changes the 종목 screen's company. Display continuity only — the AI
// context scope (_currentTickerId) and the entity store keep their own owners.
export function setStockSubject({ root = globalThis, documentRef = root?.document, symbol, name = '' } = {}) {
  const next = String(symbol || '').trim().toUpperCase();
  if (!root || !/^[A-Z0-9.-]{1,12}$/.test(next)) return false;
  const label = String(name || '').trim();
  const nameChanged = !!label && root._aioLastOpenedName?.name !== label;
  if (label) root._aioLastOpenedName = { symbol: next, name: label };
  if (root._aioLastOpenedSymbol === next && !nameChanged) return false;
  root._aioLastOpenedSymbol = next;
  try { documentRef?.dispatchEvent?.(new CustomEvent('aio:subjectChanged', { detail: { symbol: next } })); } catch (_) {}
  return true;
}
