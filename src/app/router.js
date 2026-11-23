import { ROUTE_IDS, isRouteId } from './routes.js';
import { createResourceBag } from './lifecycle.js';
import { getVerticalSliceContract } from './vertical-slices.js';
import { setStockSubject } from '../ui/navigation/route-hubs.js';
import { legacyThemeDetailTarget } from '../ui/navigation/theme-detail.js';

function defaultPage(route) {
  return {
    route,
    mount: () => () => {}
  };
}

function setLazyModuleState({ documentRef, route, state, errorMessage } = {}) {
  const page = documentRef?.getElementById?.(`page-${route}`);
  if (!page) return;
  page.dataset.aioRouteModuleState = state;
  const marker = page.querySelector?.('[data-aio-route-module-error]');
  if (state !== 'failed') {
    marker?.remove?.();
    return;
  }
  const status = marker || documentRef?.createElement?.('div');
  if (!status) return;
  status.dataset.aioRouteModuleError = route;
  status.className = 'info-box warning';
  status.setAttribute?.('role', 'alert');
  status.textContent = errorMessage || '이 화면을 불러오지 못했습니다(세 번 시도). 잠시 뒤 다른 화면에 갔다가 다시 열거나 새로고침해 주세요.';
  if (!marker) page.prepend?.(status);
}

/**
 * Keep a route out of the initial module graph while preserving the router's synchronous
 * transition contract. Successful imports/factories are cached; failed loads are cleared so
 * re-entering the route retries. A disposed route scope can never mount after its import settles.
 */
export function createLazyPage({ route, loader, factory, errorMessage, retryDelaysMs = [1500, 6000] } = {}) {
  if (!isRouteId(route)) throw new Error(`LAZY_ROUTE_INVALID:${route || ''}`);
  if (typeof loader !== 'function') throw new Error(`LAZY_ROUTE_LOADER_INVALID:${route}`);
  if (typeof factory !== 'function') throw new Error(`LAZY_ROUTE_FACTORY_INVALID:${route}`);
  let resolvedPage = null;
  let pendingPage = null;

  function resolvePage() {
    if (resolvedPage) return Promise.resolve(resolvedPage);
    if (pendingPage) return pendingPage;
    const loadWithRetry = (attempt = 0) => Promise.resolve().then(loader).catch((error) => {
      if (attempt >= retryDelaysMs.length) throw error;
      return new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt])).then(() => loadWithRetry(attempt + 1));
    });
    pendingPage = loadWithRetry()
      .then((module) => factory(module))
      .then((page) => {
        if (!page || typeof page.mount !== 'function') throw new Error(`LAZY_ROUTE_MODULE_INVALID:${route}`);
        resolvedPage = page;
        return page;
      })
      .catch((error) => {
        pendingPage = null;
        throw error;
      });
    return pendingPage;
  }

  return Object.freeze({
    route,
    loadingStrategy: 'route-dynamic-import',
    mount(context = {}) {
      let disposed = false;
      let innerDispose = null;
      setLazyModuleState({ documentRef: context.documentRef, route, state: 'loading' });
      void resolvePage()
        .then((page) => {
          if (disposed || context.scope?.disposed || context.scope?.isCurrent?.() === false) return;
          innerDispose = page.mount(context);
          if (typeof innerDispose !== 'function') innerDispose = null;
          if (disposed || context.scope?.disposed || context.scope?.isCurrent?.() === false) {
            try { innerDispose?.(); } catch (_) {}
            innerDispose = null;
            return;
          }
          setLazyModuleState({ documentRef: context.documentRef, route, state: 'ready' });
        })
        .catch((error) => {
          if (disposed || context.scope?.disposed || context.scope?.isCurrent?.() === false) return;
          // A mount can register resources before throwing. Release them and
          // permit the same route to be retried without visiting another page.
          context.scope?.dispose?.();
          setLazyModuleState({ documentRef: context.documentRef, route, state: 'failed', errorMessage });
          const EventConstructor = context.runtimeRoot?.CustomEvent || globalThis.CustomEvent;
          if (typeof EventConstructor === 'function') {
            context.runtimeRoot?.dispatchEvent?.(new EventConstructor('aio:routeModuleError', {
              detail: { route, message: String(error?.message || error) }
            }));
          }
        });
      return () => {
        disposed = true;
        try { innerDispose?.(); } catch (_) {}
        innerDispose = null;
      };
    }
  });
}

// The 종목 tabs (개요 · 쟁점과 전망 · 재무 공시) are about one company, and each keeps it in the address as ?sym= (run-6 #12);
// 쟁점과 전망 is a view of the ticker page (?view=outlook).
const ENTITY_ROUTES = new Set(['ticker', 'fundamental']);
const CHART_ROUTE = 'charts';
const CHART_ROUTE_ALIASES = Object.freeze({ technical: CHART_ROUTE });
const CHART_SUBJECT_VIEW = 'analysis'; // the view that shows the chart symbol (page-views.css)

function normalizeEntityId(candidate) {
  if (candidate == null) return null;
  if (typeof candidate === 'object') return null;
  let text = String(candidate);
  try { text = decodeURIComponent(text); } catch (_) { /* malformed % sequence: the regex below refuses it */ }
  const normalized = text.normalize('NFKC').trim().toUpperCase();
  if (!normalized || !/^[A-Z0-9][A-Z0-9.\-=]*$/.test(normalized)) return null;
  return normalized;
}

function entityIdFor(route, detail = {}) {
  if (!ENTITY_ROUTES.has(route)) return null;
  if (detail?.entityId != null || detail?.ticker != null || detail?.symbol != null) {
    return normalizeEntityId(detail.entityId ?? detail.ticker ?? detail.symbol);
  }
  if (Array.isArray(detail?.args) && detail.args.length) {
    return normalizeEntityId(detail.args[0]);
  }
  return null;
}

const THEME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
// A screen cut into views (src/ui/navigation/page-views.js) keeps the open one as ?view=; the first view has no key.
const VIEW_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

export function parseRouteDeepLink(hash, themeIds = null) {
  const match = String(hash || '').match(/^#([^?]*)(?:\?(.*))?$/);
  if (!match) return null;
  const [rawRoute = 'home', pathArg = ''] = (match[1] || 'home').split('/');
  const routeId = rawRoute === 'theme-detail' ? 'themes' : CHART_ROUTE_ALIASES[rawRoute] || rawRoute;
  if (!isRouteId(routeId)) return null;
  const params = new URLSearchParams(match[2] || '');
  const entityId = ENTITY_ROUTES.has(routeId) ? normalizeEntityId(params.get('sym') || pathArg) : null;
  const chartSymbol = routeId === CHART_ROUTE ? normalizeEntityId(params.get('sym') || pathArg) : null;
  const legacy = rawRoute === 'theme-detail' ? legacyThemeDetailTarget(hash, themeIds) : null;
  const theme = rawRoute === 'themes' ? String(params.get('theme') || '').trim() : legacy?.themeId || '';
  const view = String(params.get('view') || '');
  return Object.freeze({ routeId, entityId, chartSymbol, legacyChart: Object.hasOwn(CHART_ROUTE_ALIASES, rawRoute), themeId: THEME_ID_PATTERN.test(theme) ? theme : null, legacyTheme: !!legacy, view: VIEW_PATTERN.test(view) ? view : null });
}

// The hash for `routeId` with `key` set to `value` (or removed when value is empty), keeping the other keys.
export function routeDeepLinkHash(hash, routeId, key, value) {
  const match = String(hash || '').match(/^#([^?]*)(?:\?(.*))?$/);
  const [route, pathArg = ''] = (match?.[1] || '').split('/');
  const params = new URLSearchParams(route === routeId ? match[2] || '' : '');
  // A path-form subject (#ticker/NVDA?view=memo) stays the subject when another key is rewritten first.
  if (route === routeId && pathArg && (ENTITY_ROUTES.has(routeId) || routeId === CHART_ROUTE) && !params.has('sym')) params.set('sym', pathArg);
  if (value == null || value === '') params.delete(key); else params.set(key, String(value));
  const query = params.toString();
  return `#${routeId}${query ? `?${query}` : ''}`;
}

function installRouteDeepLinks({ runtimeRoot, documentRef, activeRoute }) {
  const location = runtimeRoot?.location;
  const history = runtimeRoot?.history;
  if (!location || typeof history?.replaceState !== 'function' || typeof runtimeRoot.addEventListener !== 'function') return () => {};
  const events = documentRef || runtimeRoot;
  const currentRoute = () => String(location.hash || '').match(/^#([^?]*)/)?.[1] || null;
  const writeHash = (routeId, key, value, { push = false } = {}) => {
    const next = routeDeepLinkHash(location.hash, routeId, key, value);
    if (next === location.hash) return;
    try { history[push ? 'pushState' : 'replaceState'](history.state ?? null, '', `${location.pathname}${location.search}${next}`); } catch (_) {}
  };
  // Views: the address names the open view of the current screen. A tab click is a history step (Back returns to the
  // view before it); a screen opened without a view keeps the one the reader left there, and the address follows.
  const viewPage = (routeId) => documentRef?.getElementById?.(`page-${routeId}`);
  const viewsOf = (routeId) => [...(viewPage(routeId)?.querySelectorAll?.(':scope > .page-views > [data-view]') || [])].map((tab) => tab.dataset.view);
  const writeView = (routeId, view, push) => writeHash(routeId, 'view', view && view !== viewsOf(routeId)[0] ? view : null, { push });
  // A retired view names the view that took its content (data-view-alias on that tab), so an old address still lands there.
  const aliasOf = (routeId, view) => viewPage(routeId)?.querySelector?.(`:scope > .page-views > [data-view-alias~="${view}"]`)?.dataset.view || null;
  const applyView = (link) => {
    const views = viewsOf(link.routeId);
    if (!views.length) return;
    const alias = link.view && !views.includes(link.view) ? aliasOf(link.routeId, link.view) : null;
    if (alias) { link = { ...link, view: alias }; writeView(link.routeId, alias, false); }
    if (link.view && !views.includes(link.view)) { writeHash(link.routeId, 'view', null); return; }
    const view = link.view || views[0];
    // Before the view module is installed (first load) the page element takes the view; the module reads it there.
    if (typeof runtimeRoot._aioShowPageView === 'function') runtimeRoot._aioShowPageView(`page-${link.routeId}`, view);
    else viewPage(link.routeId).dataset.view = view;
  };
  const onViewChanged = (event) => {
    const routeId = String(event?.detail?.page || '').replace(/^page-/, '');
    if (!routeId || routeId !== currentRoute()) return;
    writeView(routeId, event.detail.view, event.detail.byReader === true);
    // 기술적 분석's sym names the symbol of its 종목 분석 view (a link with one opens that view), so the other views drop it.
    if (routeId === CHART_ROUTE && event.detail.view !== CHART_SUBJECT_VIEW) writeHash(CHART_ROUTE, 'sym', null);
  };
  // Address → selection: the first load and every back/forward step.
  const themeIds = () => (Array.isArray(runtimeRoot.THEME_MAP) ? runtimeRoot.THEME_MAP.map((theme) => String(theme?.id || '')) : null);
  const applyAddress = () => {
    let link = parseRouteDeepLink(location.hash, themeIds());
    if (!link) return;
    applyView(link);
    if (link.legacyTheme) {
      // The old detail address is read here once (the classic showPage copy is spent too) and written as #themes?theme=.
      try { delete runtimeRoot._aioThemeDetailHash; } catch (_) { /* frozen root */ }
      writeHash('themes', 'theme', link.themeId);
    }
    // The address names a subject the way a reader typed it (#fundamental/005930); it resolves through
    // the same normalizer as the search box, so 차트 and 재무 공시 open 005930.KS (DART), not a US 'no SEC record' page.
    const resolved = link.entityId && typeof runtimeRoot._aioNormalizeTickerInput === 'function' ? normalizeEntityId(runtimeRoot._aioNormalizeTickerInput(link.entityId)) : null;
    if (resolved && resolved !== link.entityId) link = { ...link, entityId: resolved };
    if (link.entityId && (/^#[a-z]+\//.test(location.hash) || resolved)) writeHash(link.routeId, 'sym', link.entityId); // canonical address
    if (link.view && ENTITY_ROUTES.has(link.routeId) && !viewsOf(link.routeId).length) writeHash(link.routeId, 'view', null);
    if (link.entityId && link.routeId === 'ticker') {
      const current = String(runtimeRoot.AIO?.state?._currentTickerSym || runtimeRoot._currentTickerSym || '').toUpperCase();
      if (current !== link.entityId && typeof runtimeRoot.showTicker === 'function') {
        // This entry already came from a link or history. The classic selector must reuse it,
        // including a memo view or other query keys, when it updates the company on this page.
        try { history.replaceState({ ...(history.state || {}), page: link.routeId }, '', location.href); } catch (_) {}
        runtimeRoot.showTicker(link.entityId);
      }
    } else if (link.entityId) {
      // 차트 and 재무 공시 select without leaving their route; showTicker would move to the 요약 screen.
      setStockSubject({ root: runtimeRoot, documentRef, symbol: link.entityId });
      // Only 재무 공시 is an AI-context entity route (js/aio-core.js PAGES contextScope); 차트 shows the subject alone.
      if (link.routeId === 'fundamental' && String(runtimeRoot._currentTickerId || '').toUpperCase() !== link.entityId) {
        runtimeRoot._currentTickerId = link.entityId;
        const EventConstructor = runtimeRoot.CustomEvent || globalThis.CustomEvent;
        if (typeof EventConstructor === 'function') events?.dispatchEvent?.(new EventConstructor('aio:entityChanged', { detail: { symbol: link.entityId, source: 'address' } }));
      }
    }
    if (link.chartSymbol || link.legacyChart) {
      // The retired 차트 tab's address is written as #charts (with its symbol); the slot reads the request when it mounts,
      // or hears it now when 기술적 분석 is already open.
      const resolvedChart = link.chartSymbol && typeof runtimeRoot._aioNormalizeTickerInput === 'function' ? normalizeEntityId(runtimeRoot._aioNormalizeTickerInput(link.chartSymbol)) || link.chartSymbol : link.chartSymbol;
      if (link.legacyChart || /^#charts\//.test(location.hash) || (resolvedChart && resolvedChart !== link.chartSymbol)) writeHash(CHART_ROUTE, 'sym', resolvedChart);
      if (resolvedChart) {
        runtimeRoot._aioChartRequest = resolvedChart;
        const EventConstructor = runtimeRoot.CustomEvent || globalThis.CustomEvent;
        if (typeof EventConstructor === 'function') events?.dispatchEvent?.(new EventConstructor('aio:chartRequested', { detail: { symbol: resolvedChart } }));
      }
    }
    if (link.themeId) {
      const page = documentRef?.getElementById?.('page-themes');
      // A themes page still loading its module consumes the pending id when it mounts.
      const ready = activeRoute() === 'themes' && page?.dataset?.aioRouteModuleState === 'ready';
      if (ready && runtimeRoot._currentThemeId !== link.themeId && typeof runtimeRoot.showThemeDetail === 'function') runtimeRoot.showThemeDetail(link.themeId);
      else if (!ready) runtimeRoot._aioOpenThemeDetailOnThemes = link.themeId;
    }
  };
  // Selection → address (replace, not push: the route change already made the history step). One rule for the three
  // 종목 tabs: the address carries the subject (route-hubs.js setStockSubject). A selection overwrites it; a commit only
  // fills a missing sym — a hub tab or menu opens the bare route — so a link or Back that names a company still wins.
  const writeSubject = () => {
    const routeId = currentRoute();
    const symbol = normalizeEntityId(runtimeRoot._aioLastOpenedSymbol);
    if (ENTITY_ROUTES.has(routeId) && symbol) writeHash(routeId, 'sym', symbol);
  };
  const onCommit = () => {
    if (/^#theme-detail(?:[/?]|$)/.test(location.hash)) applyAddress();
    const link = parseRouteDeepLink(location.hash);
    if (!link?.entityId) writeSubject();
    if (link?.view) applyView(link);
    // A typed address (#ticker/AAPL) is rewritten by applyAddress with its subject; writing the view first would drop it.
    else if (link && !location.hash.includes('/') && viewPage(link.routeId)?.dataset?.view) writeView(link.routeId, viewPage(link.routeId).dataset.view, false);
  };
  const onThemeShown = (event) => {
    const themeId = String(event?.detail?.themeId || '').trim();
    if (currentRoute() === 'themes' && THEME_ID_PATTERN.test(themeId)) writeHash('themes', 'theme', themeId);
  };
  const onThemeClosed = () => { if (currentRoute() === 'themes') writeHash('themes', 'theme', null); };
  // A symbol the reader opened in the analysis slot goes in the address (replace: the click is not a screen change).
  const onChartSubject = (event) => { if (currentRoute() === CHART_ROUTE && event?.detail?.byReader) writeHash(CHART_ROUTE, 'sym', normalizeEntityId(event.detail.symbol)); };
  runtimeRoot.addEventListener('popstate', applyAddress);
  events.addEventListener?.('aio:subjectChanged', writeSubject);
  events.addEventListener?.('aio:tickerViewReset', writeSubject);
  events.addEventListener?.('aio:navigationCommitted', onCommit);
  events.addEventListener?.('aio:themeDetailShown', onThemeShown);
  events.addEventListener?.('aio:themeDetailClosed', onThemeClosed);
  events.addEventListener?.('aio:pageViewChanged', onViewChanged);
  events.addEventListener?.('aio:chartSubjectChanged', onChartSubject);
  let bootTimer = null;
  try { bootTimer = setTimeout(applyAddress, 0); } catch (_) { applyAddress(); }
  return () => {
    if (bootTimer != null) clearTimeout(bootTimer);
    runtimeRoot.removeEventListener('popstate', applyAddress);
    events.removeEventListener?.('aio:subjectChanged', writeSubject);
    events.removeEventListener?.('aio:tickerViewReset', writeSubject);
    events.removeEventListener?.('aio:navigationCommitted', onCommit);
    events.removeEventListener?.('aio:themeDetailShown', onThemeShown);
    events.removeEventListener?.('aio:themeDetailClosed', onThemeClosed);
    events.removeEventListener?.('aio:pageViewChanged', onViewChanged);
    events.removeEventListener?.('aio:chartSubjectChanged', onChartSubject);
  };
}

export function normalizeNavigationCommand(input = {}) {
  const route = typeof input === 'string' ? input : input.routeId || input.route || input.pageId || null;
  const canonical = route === 'theme-detail' ? 'themes' : route;
  if (!isRouteId(canonical)) return null;
  const entityId = entityIdFor(canonical, typeof input === 'object' ? input : {});
  const viewState = input && typeof input === 'object' && input.viewState && typeof input.viewState === 'object' ? input.viewState : null;
  return Object.freeze({
    routeId: canonical,
    entityId,
    viewState,
    source: typeof input?.source === 'string' ? input.source : 'unknown',
    historyMode: input?.historyMode === 'replace' ? 'replace' : 'push'
  });
}

function createRouteScope({ route, detail, mountId, isCurrent, slice } = {}) {
  const bag = createResourceBag();
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try { controller?.abort('route-scope-disposed'); } catch (_) {}
    bag.dispose();
  };
  return Object.freeze({
    route,
    routeId: route,
    mountId,
    entityId: entityIdFor(route, detail),
    sliceId: slice?.id || null,
    sliceOrder: slice?.order || null,
    sliceRoutes: slice?.routes || Object.freeze([]),
    requiredData: slice?.requiredData || Object.freeze([]),
    detail,
    signal: controller?.signal,
    isCurrent,
    add: bag.add,
    dispose,
    get disposed() { return disposed; }
  });
}

export function createRouteRegistry({ modules = {} } = {}) {
  return Object.freeze(Object.fromEntries(ROUTE_IDS.map((route) => [route, modules[route] || defaultPage(route)])));
}

export function createLifecycleRouter({ root, registry, context = {} } = {}) {
  if (!root || typeof root.addEventListener !== 'function') throw new Error('ROUTER_ROOT_INVALID');
  const routes = registry || createRouteRegistry();
  const rootBag = createResourceBag();
  let activeRoute = null;
  let activeDispose = null;
  let activeScope = null;
  let mountSequence = 0;
  let transitionSequence = 0;
  let disposed = false;
  let started = false;
  let startedHandle = null;
  let navigationAuthority = 'event';
  let activeViewState = null;

  function disposeActive() {
    const dispose = activeDispose;
    const scope = activeScope;
    activeDispose = null;
    activeScope = null;
    scope?.dispose();
    try { dispose?.(); } catch (_) {}
  }

  function assertSliceMarker(routeId) {
    const pageNode = context.documentRef?.getElementById?.(`page-${routeId}`);
    const slice = getVerticalSliceContract(routeId);
    if (!pageNode || !slice) return null;
    if (pageNode.dataset.aioVerticalSlice === slice.id) return pageNode;
    pageNode.dataset.aioVerticalSlice = slice.id;
    pageNode.dataset.aioVerticalSliceOrder = String(slice.order);
    pageNode.dataset.aioVerticalSliceRoutes = slice.routes.join(',');
    pageNode.dataset.aioVerticalSliceRequired = slice.requiredData.join(',');
    pageNode.dataset.aioVerticalSliceFailureState = context.runtimeRoot?.AIO?.getPageContract?.(routeId)?.failureState || 'partial';
    const completeness = context.runtimeRoot?.AIO?.getPageDataCompleteness?.(routeId);
    pageNode.dataset.aioVerticalSliceState = completeness?.status || pageNode.dataset.aioVerticalSliceFailureState;
    pageNode.dataset.aioVerticalSliceIssues = JSON.stringify((completeness?.issues || []).map((issue) => issue.producer));
    return pageNode;
  }

  function publishNavigationCommit({ routeId, entityId, mountId, command, directEntry, recommit }) {
    const EventConstructor = context.runtimeRoot?.CustomEvent || globalThis.CustomEvent;
    if (typeof EventConstructor !== 'function') return;
    root.dispatchEvent(new EventConstructor('aio:navigationCommitted', {
      detail: {
        routeId,
        entityId,
        mountId,
        viewState: activeViewState,
        source: command.source,
        historyMode: command.historyMode,
        directEntry: recommit ? false : directEntry === true,
        recommit: recommit === true
      }
    }));
  }

  function transition(route, detail = {}) {
    if (disposed) return false;
    const detailObject = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : null;
    const command = normalizeNavigationCommand(detailObject ? { routeId: route, ...detailObject } : { routeId: route });
    if (!command) return false;
    const normalizedRoute = command.routeId;
    const nextEntityId = command.entityId;
    const normalizedDetail = Object.freeze({ ...(detailObject || {}), routeId: command.routeId, entityId: command.entityId, viewState: command.viewState, source: command.source, historyMode: command.historyMode });
    if (activeRoute === normalizedRoute && !activeScope?.disposed && activeScope?.entityId === nextEntityId) {
      // Re-committing to the route we are already on is still a commit: if the node that carries
      // the marker was replaced, this is the only place that can restore it.
      assertSliceMarker(normalizedRoute);
      if (command.viewState && command.viewState !== activeViewState) {
        activeViewState = command.viewState;
        publishNavigationCommit({
          routeId: normalizedRoute,
          entityId: nextEntityId,
          mountId: activeScope?.mountId ?? null,
          command,
          recommit: true
        });
      }
      return true;
    }
    const transitionId = ++transitionSequence;
    disposeActive();
    if (disposed || transitionId !== transitionSequence) return false;
    const page = routes[normalizedRoute];
    const scope = createRouteScope({
      route: normalizedRoute,
      detail: normalizedDetail,
      mountId: ++mountSequence,
      isCurrent: () => activeScope === scope && !scope.disposed,
      slice: getVerticalSliceContract(normalizedRoute)
    });
    activeScope = scope;
    activeRoute = normalizedRoute;
    activeViewState = command.viewState;
    // The marker is asserted AFTER the mount, not before it. Written first, it was torn down by a
    // re-transition that disposed this scope while the replacement mount could no longer find the
    // page element — leaving the whole document unmarked (`probeMarked: []`) even though the route
    // was mounted, `aioArchitectureRoute` set and `completeness: loaded`. Mounting is what makes the
    // element certain to exist, so that is the point where the observation contract can be met.
    const slice = getVerticalSliceContract(normalizedRoute);
    try {
      const result = page.mount({ ...context, route: normalizedRoute, detail: normalizedDetail, scope });
      if (!scope.isCurrent() || disposed) {
        try { if (typeof result === 'function') result(); } catch (_) {}
        return false;
      }
      activeDispose = typeof result === 'function' ? result : () => {};
    } catch (error) {
      scope.dispose();
      if (activeScope === scope) {
        activeScope = null;
        activeRoute = null;
        activeViewState = null;
      }
      throw error;
    }
    const pageNode = assertSliceMarker(normalizedRoute);
    if (pageNode && slice) {
      const updateSliceState = () => {
        const completeness = context.runtimeRoot?.AIO?.getPageDataCompleteness?.(normalizedRoute);
        pageNode.dataset.aioVerticalSliceState = completeness?.status || pageNode.dataset.aioVerticalSliceFailureState;
        pageNode.dataset.aioVerticalSliceIssues = JSON.stringify((completeness?.issues || []).map((issue) => issue.producer));
      };
      const unsubscribe = context.store?.subscribe?.(updateSliceState);
      if (unsubscribe) scope.add(unsubscribe);
    }
    publishNavigationCommit({
      routeId: normalizedRoute,
      entityId: nextEntityId,
      mountId: scope.mountId,
      command,
      directEntry: detailObject?.directEntry === true
    });
    return true;
  }

  function onPageShown(event) {
    if (navigationAuthority === 'external') return;
    const detail = event?.detail;
    const route = typeof detail === 'string' ? detail : detail?.pageId || detail?.route;
    transition(route, event?.detail || {});
  }

  function claimNavigationAuthority() {
    navigationAuthority = 'external';
  }

  function releaseNavigationAuthority() {
    navigationAuthority = 'event';
  }

  function start() {
    if (disposed) throw new Error('ROUTER_DISPOSED');
    if (started) return startedHandle;
    root.addEventListener('aio:pageShown', onPageShown);
    rootBag.add(() => root.removeEventListener('aio:pageShown', onPageShown));
    rootBag.add(installRouteDeepLinks({ runtimeRoot: context.runtimeRoot, documentRef: context.documentRef, activeRoute: () => activeRoute }));
    started = true;
    startedHandle = Object.freeze({ transition, active: () => activeRoute, activeScope: () => activeScope, activeViewState: () => activeViewState, dispose, claimNavigationAuthority, releaseNavigationAuthority });
    return startedHandle;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    disposeActive();
    activeRoute = null;
    activeViewState = null;
    rootBag.dispose();
  }

  return Object.freeze({ start, transition, active: () => activeRoute, activeScope: () => activeScope, activeViewState: () => activeViewState, dispose, claimNavigationAuthority, releaseNavigationAuthority });
}
