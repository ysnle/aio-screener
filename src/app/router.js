import { ROUTE_IDS, isRouteId } from './routes.js';
import { createResourceBag } from './lifecycle.js';

function defaultPage(route) {
  return {
    route,
    mount: () => () => {}
  };
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

  function transition(route, detail = {}) {
    if (!isRouteId(route)) return false;
    if (activeRoute === route) return true;
    activeDispose?.();
    activeDispose = null;
    const page = routes[route];
    const result = page.mount({ ...context, route, detail });
    activeDispose = typeof result === 'function' ? result : () => {};
    activeRoute = route;
    return true;
  }

  function onPageShown(event) {
    const detail = event?.detail;
    const route = typeof detail === 'string' ? detail : detail?.pageId || detail?.route;
    transition(route, event?.detail || {});
  }

  function start() {
    root.addEventListener('aio:pageShown', onPageShown);
    rootBag.add(() => root.removeEventListener('aio:pageShown', onPageShown));
    return Object.freeze({ transition, active: () => activeRoute, dispose });
  }

  function dispose() {
    activeDispose?.();
    activeDispose = null;
    activeRoute = null;
    rootBag.dispose();
  }

  return Object.freeze({ start, transition, active: () => activeRoute, dispose });
}
