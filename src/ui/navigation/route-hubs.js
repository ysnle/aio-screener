// 2026-10-01 information architecture (AGENTS.md): the routes are presented as screens (eight hubs over the 20 routes of architecture/route-owners.json). A screen's sub-routes are switched by the in-page tab bar below the topbar;
// route ids, deep links and page owners stay unchanged until each screen is merged.
import { readSavedStockSubject, saveStockSubject } from '../../data/stock-subject-store.js';
export const ROUTE_HUBS = Object.freeze([
  { id: 'today', label: '오늘', routes: [{ id: 'home', label: '요약' }, { id: 'briefing', label: '브리핑' }, { id: 'market-news', label: '뉴스' }] },
  // 시장 상태 and 매크로 are one screen — the verdict, then the evidence behind it, each tab named for itself.
  { id: 'market', label: '시장과 매크로', plainTabs: true, routes: [{ id: 'signal', label: '시장 상태' }, { id: 'breadth', label: '시장 폭' }, { id: 'sentiment', label: '투자 심리' }, { id: 'macro', label: '매크로' }, { id: 'fxbond', label: '금리와 환율' }] },
  // 기술적 분석 is a screen of its own, like 매크로.
  { id: 'charts', label: '기술적 분석', routes: [{ id: 'charts', label: '기술적 분석' }] },
  { id: 'themes', label: '테마와 섹터', routes: [{ id: 'themes', label: '테마와 섹터', also: ['theme-detail'] }, { id: 'theme-detail', label: '테마 상세', tab: false }] },
  // One 종목 screen — 개요 · 재무 공시 are views of the same selected company. Owner 2026-11-19 ("탭 없애고 연결"):
  // the 차트 tab left for 기술적 분석; the hub line links there with the company (renderSubject).
  // The ticker page is cut into views (개요 · 쟁점과 전망, its page-views row); viewTabs shows each as a
  // tab of this line, so the screen reads 개요 · 쟁점과 전망 · 재무 공시.
  // v59.55 (flow review): 스크리너 before 종목 — find, then examine; the sidebar, phone tab bar and number keys share it.
  { id: 'screener', label: '스크리너', routes: [{ id: 'screener', label: '스크리너' }] },
  { id: 'stock', label: '종목', routes: [{ id: 'ticker', label: '개요', viewTabs: true }, { id: 'fundamental', label: '재무 공시' }] },
  { id: 'portfolio', label: '포트폴리오', routes: [{ id: 'portfolio', label: '포트폴리오' }] },
  // 2026-10-05 owner decision: 리서치 라이브러리 — three research pages; the product guide is help (topbar), not research.
  { id: 'learn', label: '리서치 라이브러리', routes: [{ id: 'principles', label: '개념·분석' }, { id: 'atlas', label: '산업 지도' }, { id: 'masters', label: '대가 보유 종목' }, { id: 'guide', label: '도움말', tab: false }] }
].map((hub) => Object.freeze({ ...hub, routes: Object.freeze(hub.routes.map((route) => Object.freeze({ ...route }))) })));

export function hubForRoute(routeId) {
  return ROUTE_HUBS.find((hub) => hub.routes.some((route) => route.id === routeId)) || null;
}

// The name a route goes by outside its own screen ('매크로, 금리와 환율', '종목, 차트', '스크리너'); the AI panel's
// page hints and move suggestions read it here instead of keeping their own copies of screen names.
export function routeLabel(routeId) {
  const hub = hubForRoute(routeId);
  if (!hub) return '';
  const route = hub.routes.find((entry) => entry.id === routeId);
  if (route && hub.plainTabs) return route.label; // each tab is a name of its own ('매크로', '시장 폭')
  return !route || route.label === hub.label || route.label === '개요' || hub.routes.length === 1 ? hub.label : `${hub.label}, ${route.label}`;
}

// The 종목 screen names the company all three tabs are about, and where the user came from.
const SUBJECT_ORIGINS = Object.freeze({ home: '오늘', briefing: '브리핑', 'market-news': '뉴스', screener: '스크리너', themes: '테마', portfolio: '포트폴리오', masters: '대가 보유 종목', signal: '시장 상태', breadth: '시장 폭', sentiment: '투자 심리' });

export function readStockSubject(root) {
  const symbol = String(root?._aioLastOpenedSymbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) return null;
  const name = root?._aioLastOpenedName?.symbol === symbol ? String(root._aioLastOpenedName.name || '') : '';
  const from = String(root?.AIO?.state?.tickerReturnRoute || '');
  return { symbol, name: name && name.toUpperCase() !== symbol ? name : '', from: Object.hasOwn(SUBJECT_ORIGINS, from) ? from : null };
}

// 2026-10-18 UI review: 차트 had no way to pick a company and 재무 공시's own box only looked separate; one
// control on the hub line opens the 요약 search, which already sets the company for all three tabs. v59.70 (wave2-f S23):
// it opens the command search's 종목 scope where the reader is; from 재무 공시 the pick keeps that tab.
function pickButton(documentRef, root, label) {
  const pick = documentRef.createElement('button');
  pick.type = 'button';
  pick.className = 'aio-hub-subject-pick';
  pick.textContent = label;
  pick.setAttribute('aria-haspopup', 'dialog');
  pick.addEventListener('click', () => {
    if (typeof root?._aioOpenCommandSearch === 'function' && root._aioOpenCommandSearch({ scope: 'stock' })) return;
    root?.showPage?.('ticker');
  });
  return pick;
}

function renderSubject(documentRef, nav, subject, root, routeId) {
  const box = documentRef.createElement('span');
  box.className = 'aio-hub-subject';
  // v59.55 (alignment pass): on 개요 the page title already names the stock (and the search box invites one), so the
  // subject line keeps only the way back.
  if (!subject && routeId === 'ticker') return;
  if (!subject) {
    // v59.70 (ui-states): the button alone; the sentence explaining the three tabs was help copy.
    box.append(pickButton(documentRef, root, '종목 고르기'));
    nav.appendChild(box);
    return;
  }
  if (routeId !== 'ticker') {
    const sym = documentRef.createElement('strong');
    sym.textContent = subject.symbol;
    box.appendChild(sym);
    if (subject.name) box.append(` ${subject.name}`);
  }
  if (subject.from) {
    const back = documentRef.createElement('button');
    back.type = 'button';
    back.className = 'aio-hub-subject-from';
    back.dataset.action = 'showPage';
    back.dataset.arg = subject.from;
    back.textContent = `← ${SUBJECT_ORIGINS[subject.from]}`;
    box.appendChild(back);
  }
  // The company's chart is read on 기술적 분석: the link carries the company there (stock-chart.js openMarketChart).
  const chart = documentRef.createElement('button');
  chart.type = 'button';
  chart.className = 'aio-hub-subject-chart';
  chart.dataset.action = 'aioOpenMarketChart';
  chart.dataset.arg = subject.symbol;
  chart.textContent = '기술적 분석에서 보기';
  box.appendChild(chart);
  if (routeId !== 'ticker') box.appendChild(pickButton(documentRef, root, '다른 종목'));
  if (!box.childNodes.length) return;
  nav.appendChild(box);
}

export function renderHubTabs({ documentRef, routeId, root = globalThis }) {
  const nav = documentRef?.getElementById?.('aio-hub-tabs');
  if (!nav) return null;
  delete nav.dataset.pending; // the static shell's held height (index.html, phone CLS)
  // 도움말 is help, not research — the sidebar no longer marks 리서치 라이브러리; the topbar button does.
  const help = documentRef.getElementById?.('topbar-help-btn');
  if (help) { if (routeId === 'guide') help.setAttribute('aria-current', 'page'); else help.removeAttribute('aria-current'); }
  const hub = hubForRoute(routeId);
  const tabs = hub ? hub.routes.filter((route) => route.tab !== false) : [];
  nav.replaceChildren();
  // A hidden route with no parent tab (도움말 under 리서치 라이브러리) is not one of the hub's views —
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
  // First-users F08 (runs 1-4) put the menu name above a tab's own title; v59.70 drops it — the hub's tab
  // strip names the tab and the sidebar / bottom bar mark the menu, so the extra word only floated between date and title.
  const subject = hub.id === 'stock' ? readStockSubject(root) : null;
  // 개편 v2: the tabs sit in one segmented control (soft-ui.css .aio-hub-seg).
  // First-users run-6 #20: a screen reader heard three loose buttons; the segment is the screen's tab list (one tab stop and
  // the arrow keys come from behaviors/roving.js; a tab opens a screen, so arrows move focus and Enter opens it).
  const seg = documentRef.createElement('span');
  seg.className = 'aio-hub-seg';
  seg.setAttribute('role', 'tablist');
  seg.setAttribute('aria-label', hub.label);
  seg.dataset.activation = 'manual';
  nav.appendChild(seg);
  for (const tab of tabs) {
    // A route with viewTabs gives one tab per view of its page row (page-views.js); that row stays hidden (page-views.css).
    const views = tab.viewTabs ? viewTabsOf(documentRef, tab.id) : [];
    for (const entry of views.length ? views : [{ view: null, label: tab.label }]) {
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
      // On its own screen a view tab only switches the view; from another screen the view is set before the action opens it.
      if (entry.view) {
        button.dataset.hubView = entry.view;
        button.dataset.hubViewOf = tab.id;
        if (routeId === tab.id) delete button.dataset.action;
        button.addEventListener('click', () => (routeId === tab.id ? showStockView({ root, documentRef, view: entry.view }) : root?._aioShowPageView?.(`page-${tab.id}`, entry.view)));
      }
      button.textContent = entry.label;
      button.setAttribute('role', 'tab');
      const selected = tab.id === routeId || (tab.also || []).includes(routeId);
      button.setAttribute('aria-selected', String(selected));
      if (selected) button.setAttribute('aria-current', 'page');
      seg.appendChild(button);
    }
  }
  markViewTabs(documentRef, routeId);
  if (hub.id === 'stock') renderSubject(documentRef, nav, subject, root, routeId);
  return hub.id;
}

function viewTabsOf(documentRef, routeId) {
  return [...(documentRef.getElementById?.(`page-${routeId}`)?.querySelectorAll?.(':scope > .page-views > [data-view]') || [])]
    .map((node) => ({ view: node.dataset.view, label: node.textContent.trim() }));
}

// The view tabs of the open screen follow its view without a rebuild, so a focused tab keeps focus.
function markViewTabs(documentRef, routeId) {
  const page = documentRef?.getElementById?.(`page-${routeId}`);
  const view = page?.dataset?.view || viewTabsOf(documentRef, routeId)[0]?.view;
  for (const button of documentRef?.getElementById?.('aio-hub-tabs')?.querySelectorAll?.('[data-hub-view]') || []) {
    if (button.dataset.hubViewOf !== routeId) continue; // views of a screen not open: not selected
    const on = button.dataset.hubView === view;
    button.setAttribute('aria-selected', String(on));
    if (on) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
}

// A 종목 view the reader asked for from the hub line or a link on the page: a history step, and the view starts at its
// top, as a hub tab that opens a screen does.
export function showStockView({ root = globalThis, documentRef = root?.document, view } = {}) {
  if (!root?._aioShowPageView?.('page-ticker', view, { byReader: true })) return false;
  const scroller = documentRef?.querySelector?.('.content');
  if (scroller) scroller.scrollTop = 0;
  return true;
}

// First-users F15 (runs 1-3): a reload or Back on 차트 lost the company (subject "종목 고르기" over an SPY chart). The subject
// is kept for the tab's session (src/data/stock-subject-store.js) and restored before the first render; a ?sym= deep link
// still wins (it sets the subject). Run-6 #18: the restore goes through setStockSubject, the one place that sets the subject,
// so every listener (the 차트 tab, the address) hears it.
export function installRouteHubTabs({ root = globalThis, documentRef = root.document, activeRoute = () => null } = {}) {
  const saved = root._aioLastOpenedSymbol ? null : readSavedStockSubject(root);
  if (saved) setStockSubject({ root, documentRef, symbol: saved.symbol, name: saved.name });
  const render = (event) => renderHubTabs({ documentRef, root, routeId: event?.detail?.routeId || activeRoute() });
  const renderActive = () => renderHubTabs({ documentRef, root, routeId: activeRoute() });
  // The router commits on the document (bootstrap legacy.on listens there too).
  const target = documentRef || root;
  target?.addEventListener?.('aio:navigationCommitted', render);
  target?.addEventListener?.('aio:subjectChanged', renderActive);
  // A selection (showTicker, 기업 분석 search) names the company before its data arrives.
  const onEntity = (event) => { if (event?.detail?.id) setStockSubject({ root, documentRef, symbol: event.detail.id }); };
  target?.addEventListener?.('aio:entityChanged', onEntity);
  const onView = () => markViewTabs(documentRef, activeRoute());
  target?.addEventListener?.('aio:pageViewChanged', onView);
  render();
  return () => {
    target?.removeEventListener?.('aio:navigationCommitted', render);
    target?.removeEventListener?.('aio:subjectChanged', renderActive);
    target?.removeEventListener?.('aio:entityChanged', onEntity);
    target?.removeEventListener?.('aio:pageViewChanged', onView);
  };
}

// The one place that changes the 종목 screen's company. Display continuity only — the AI
// context scope (_currentTickerId) and the entity store keep their own owners.
export function setStockSubject({ root = globalThis, documentRef = root?.document, symbol, name = '' } = {}) {
  const next = String(symbol || '').trim().toUpperCase();
  if (!root || !/^[A-Z0-9.-]{1,12}$/.test(next)) return false;
  const label = String(name || '').trim();
  const nameChanged = !!label && root._aioLastOpenedName?.name !== label;
  if (label) root._aioLastOpenedName = { symbol: next, name: label };
  if (root._aioLastOpenedSymbol === next && !nameChanged) return false;
  root._aioLastOpenedSymbol = next;
  saveStockSubject(root, { symbol: next, name: root._aioLastOpenedName?.symbol === next ? root._aioLastOpenedName.name : '' });
  try { documentRef?.dispatchEvent?.(new CustomEvent('aio:subjectChanged', { detail: { symbol: next } })); } catch (_) {}
  return true;
}
