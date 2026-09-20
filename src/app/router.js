import { ROUTE_IDS, isRouteId } from './routes.js';
import { createResourceBag } from './lifecycle.js';
import { getVerticalSliceContract } from './vertical-slices.js';

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
  status.textContent = errorMessage || '이 화면 모듈을 불러오지 못했습니다. 다른 화면으로 이동한 뒤 다시 열어 주세요.';
  if (!marker) page.prepend?.(status);
}

/**
 * Keep a route out of the initial module graph while preserving the router's synchronous
 * transition contract. Successful imports/factories are cached; failed loads are cleared so
 * re-entering the route retries. A disposed route scope can never mount after its import settles.
 */
export function createLazyPage({ route, loader, factory, errorMessage } = {}) {
  if (!isRouteId(route)) throw new Error(`LAZY_ROUTE_INVALID:${route || ''}`);
  if (typeof loader !== 'function') throw new Error(`LAZY_ROUTE_LOADER_INVALID:${route}`);
  if (typeof factory !== 'function') throw new Error(`LAZY_ROUTE_FACTORY_INVALID:${route}`);
  let resolvedPage = null;
  let pendingPage = null;

  function resolvePage() {
    if (resolvedPage) return Promise.resolve(resolvedPage);
    if (pendingPage) return pendingPage;
    pendingPage = Promise.resolve()
      .then(loader)
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

const ENTITY_ROUTES = new Set(['ticker', 'fundamental', 'options']);

function normalizeEntityId(candidate) {
  if (candidate == null) return null;
  if (typeof candidate === 'object') return null;
  const normalized = String(candidate).trim().toUpperCase();
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
  let disposed = false;
  let started = false;
  let startedHandle = null;
  // W00/P1143: a single navigation authority owns the transition. While the
  // compatibility facade is installed it emits the typed command; the raw
  // aio:pageShown event is then observation-only and must not replay a mount.
  let navigationAuthority = 'event';

  function disposeActive() {
    const dispose = activeDispose;
    const scope = activeScope;
    activeDispose = null;
    activeScope = null;
    scope?.dispose();
    try { dispose?.(); } catch (_) {}
  }

  function transition(route, detail = {}) {
    if (disposed) return false;
    // W00/P1143: one typed command owns identity. A scalar second argument is the
    // legacy page id carried by aio:pageShown, never an entity id; DOM nodes,
    // arrays, and arbitrary objects are only read through explicit
    // entityId/ticker/symbol/args fields, so a nav element can never become scope.
    const detailObject = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : null;
    const command = normalizeNavigationCommand(detailObject ? { routeId: route, ...detailObject } : { routeId: route });
    if (!command) return false;
    const normalizedRoute = command.routeId;
    const nextEntityId = command.entityId;
    const normalizedDetail = Object.freeze({ ...(detailObject || {}), routeId: command.routeId, entityId: command.entityId, viewState: command.viewState, source: command.source, historyMode: command.historyMode });
    if (activeRoute === normalizedRoute && !activeScope?.disposed && activeScope?.entityId === nextEntityId) return true;
    disposeActive();
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
    const pageNode = context.documentRef?.getElementById?.(`page-${normalizedRoute}`);
    const slice = getVerticalSliceContract(normalizedRoute);
    if (pageNode && slice) {
      pageNode.dataset.aioVerticalSlice = slice.id;
      pageNode.dataset.aioVerticalSliceOrder = String(slice.order);
      pageNode.dataset.aioVerticalSliceRoutes = slice.routes.join(',');
      pageNode.dataset.aioVerticalSliceRequired = slice.requiredData.join(',');
      pageNode.dataset.aioVerticalSliceFailureState = context.runtimeRoot?.AIO?.getPageContract?.(normalizedRoute)?.failureState || 'partial';
      const updateSliceState = () => {
        const completeness = context.runtimeRoot?.AIO?.getPageDataCompleteness?.(normalizedRoute);
        pageNode.dataset.aioVerticalSliceState = completeness?.status || pageNode.dataset.aioVerticalSliceFailureState;
        pageNode.dataset.aioVerticalSliceIssues = JSON.stringify((completeness?.issues || []).map((issue) => issue.producer));
      };
      updateSliceState();
      const unsubscribe = context.store?.subscribe?.(updateSliceState);
      if (unsubscribe) scope.add(unsubscribe);
      scope.add(() => {
        if (pageNode.dataset.aioVerticalSlice === slice.id) {
          delete pageNode.dataset.aioVerticalSlice;
          delete pageNode.dataset.aioVerticalSliceOrder;
          delete pageNode.dataset.aioVerticalSliceRoutes;
          delete pageNode.dataset.aioVerticalSliceRequired;
          delete pageNode.dataset.aioVerticalSliceFailureState;
          delete pageNode.dataset.aioVerticalSliceState;
          delete pageNode.dataset.aioVerticalSliceIssues;
        }
      });
    }
    try {
      const result = page.mount({ ...context, route: normalizedRoute, detail: normalizedDetail, scope });
      activeDispose = typeof result === 'function' ? result : () => {};
    } catch (error) {
      scope.dispose();
      activeScope = null;
      activeRoute = null;
      throw error;
    }
    // W00/P1143: publish the committed result so shell observers (store route,
    // timeline) follow the single commit instead of re-driving navigation.
    const EventConstructor = context.runtimeRoot?.CustomEvent || globalThis.CustomEvent;
    if (typeof EventConstructor === 'function') {
      root.dispatchEvent(new EventConstructor('aio:navigationCommitted', {
        detail: {
          routeId: normalizedRoute,
          entityId: nextEntityId,
          mountId: scope.mountId,
          source: command.source,
          historyMode: command.historyMode,
          directEntry: detailObject?.directEntry === true
        }
      }));
    }
    return true;
  }

  function onPageShown(event) {
    // W00/P1143: with an external authority installed the event only announces a
    // result. Replaying it here is what produced two mounts and a stale store route.
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
    started = true;
    startedHandle = Object.freeze({ transition, active: () => activeRoute, activeScope: () => activeScope, dispose, claimNavigationAuthority, releaseNavigationAuthority });
    return startedHandle;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    disposeActive();
    activeRoute = null;
    rootBag.dispose();
  }

  return Object.freeze({ start, transition, active: () => activeRoute, activeScope: () => activeScope, dispose, claimNavigationAuthority, releaseNavigationAuthority });
}
