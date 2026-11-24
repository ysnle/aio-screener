import { isRouteId } from './routes.js';

// map and layer: 산업 지도 › AI 지도 (#atlas?mode=aimap&map=capital&node=NVDA, src/domain/knowledge/ai-map.js).
const ROUTE_KEYS = Object.freeze(['mode', 'node', 'path', 'step', 'chapter', 'lesson', 'domain', 'topic', 'guide', 'criticality', 'manager', 'period', 'view', 'map', 'layer']);

function locationUrl(locationLike) {
  if (locationLike?.href) return new URL(locationLike.href);
  const pathname = locationLike?.pathname || '/';
  const search = locationLike?.search || '';
  const hash = locationLike?.hash || '#atlas';
  return new URL(`https://aio-screener.local${pathname}${search}${hash}`);
}

// A research page's open document lives in its own hash query (#atlas?mode=taxonomy&node=…), the convention of
// #ticker?sym= and #themes?view=. It used to live in location.search, so leaving the page by a plain #route link kept
// the atlas keys in every later address (?mode=taxonomy&node=…#guide). An old ?mode=…#atlas link is still read on
// entry, once: the hash query wins when it carries any route key, and the next write moves the keys into the hash.
function hashParts(url) {
  const match = String(url.hash || '').match(/^#([^?]*)(?:\?(.*))?$/);
  return { route: String(match?.[1] || '').split('/')[0], params: new URLSearchParams(match?.[2] || '') };
}

export function knowledgeRouteParams(locationLike) {
  const url = locationUrl(locationLike);
  const { params } = hashParts(url);
  const source = ROUTE_KEYS.some((key) => params.has(key)) ? params : url.searchParams;
  const out = new URLSearchParams();
  for (const key of ROUTE_KEYS) { const value = source.get(key); if (value) out.set(key, value); }
  return out;
}

export function parseKnowledgeRouteState(locationLike) {
  const params = knowledgeRouteParams(locationLike);
  const values = Object.fromEntries(ROUTE_KEYS.map((key) => [key, params.get(key) || '']));
  const step = values.step === '' ? null : Number(values.step);
  return Object.freeze({
    mode: values.mode || null,
    node: values.node || null,
    path: values.path || null,
    step: Number.isInteger(step) && step >= 0 ? step : null,
    chapter: values.chapter || null,
    lesson: values.lesson || null,
    domain: values.domain || null,
    topic: values.topic || null,
    guide: values.guide || null,
    criticality: values.criticality || null,
    manager: values.manager || null,
    period: values.period || null,
    view: values.view || null,
    map: values.map || null,
    layer: values.layer || null
  });
}

function parseReturnContext(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.freeze({ ...parsed }) : null;
  } catch {
    return null;
  }
}

export function parseKnowledgeTargetContext({ root = globalThis, locationLike = root.location } = {}) {
  const active = root?.AIO_KNOWLEDGE_ROUTE_CONTEXT;
  if (active?.active && isRouteId(active.routeId)) return Object.freeze({ ...active });
  const pendingHash = typeof root?._aioPendingRouteHash === 'string' ? root._aioPendingRouteHash : '';
  const hash = pendingHash || locationUrl(locationLike).hash;
  const match = String(hash || '').match(/^#([^?]+)(?:\?(.*))?$/);
  if (!match || !isRouteId(match[1])) return null;
  const params = new URLSearchParams(match[2] || '');
  const knowledgeNode = params.get('knowledgeNode');
  const metric = params.get('metric');
  const timeframe = params.get('timeframe');
  if (!knowledgeNode && !metric && !timeframe) return null;
  return Object.freeze({
    routeId: match[1],
    knowledgeNode: knowledgeNode || null,
    metric: metric || null,
    timeframe: timeframe || null,
    returnContext: parseReturnContext(params.get('return')),
    active: true
  });
}

// The address with `state` as the route's hash query. Other hash keys (knowledgeNode, return) stay; route keys left in
// location.search by an old link are dropped. `page` names the writer: when the address already shows another route
// (the reader left before a late write), the address is returned unchanged, so no page writes into another's address.
export function serializeKnowledgeRouteState(locationLike, state = {}, { page = null } = {}) {
  const url = locationUrl(locationLike);
  const { route, params } = hashParts(url);
  const current = `${url.pathname}${url.search}${url.hash}`;
  if (page && route && route !== page) return current;
  const target = page || route;
  for (const key of ROUTE_KEYS) { url.searchParams.delete(key); params.delete(key); }
  for (const key of ROUTE_KEYS) {
    const value = state[key];
    if (value == null || value === '') continue;
    params.set(key, String(value));
  }
  const search = url.searchParams.toString();
  const query = params.toString();
  return `${url.pathname}${search ? `?${search}` : ''}${target ? `#${target}${query ? `?${query}` : ''}` : ''}`;
}

export function replaceKnowledgeRouteState({ root = globalThis, locationLike = root.location, historyLike = root.history, state = {}, page = null } = {}) {
  const nextUrl = serializeKnowledgeRouteState(locationLike, state, { page });
  const current = `${locationLike?.pathname || ''}${locationLike?.search || ''}${locationLike?.hash || ''}`;
  if (nextUrl !== current && typeof historyLike?.replaceState === 'function') historyLike.replaceState(historyLike.state || null, '', nextUrl);
  return nextUrl;
}

// first-users run-2 R2-17: opening a document on the same page only replaced the URL, so Back left the library. Opening
// one adds a history entry (the same page state), and the page re-reads the URL when Back returns to it.
export function pushKnowledgeRouteState({ root = globalThis, locationLike = root.location, historyLike = root.history, state = {}, page = null } = {}) {
  const nextUrl = serializeKnowledgeRouteState(locationLike, state, { page });
  const current = `${locationLike?.pathname || ''}${locationLike?.search || ''}${locationLike?.hash || ''}`;
  if (nextUrl !== current && typeof historyLike?.pushState === 'function') historyLike.pushState(historyLike.state || null, '', nextUrl);
  return nextUrl;
}

export function knowledgeTargetHash(target = {}) {
  if (!isRouteId(target.routeId)) return '';
  const params = new URLSearchParams();
  if (target.conceptId) params.set('knowledgeNode', target.conceptId);
  if (target.metric) params.set('metric', target.metric);
  if (target.timeframe) params.set('timeframe', target.timeframe);
  try {
    params.set('return', JSON.stringify(target.returnContext || { route: 'principles' }));
  } catch {
    return '';
  }
  return `#${target.routeId}?${params}`;
}

export function navigateKnowledgeTarget({ root = globalThis, target = {} } = {}) {
  const hash = knowledgeTargetHash(target);
  if (!hash || typeof root?.showPage !== 'function') return false;
  root._aioPendingRouteHash = hash;
  root.showPage(target.routeId);
  return true;
}

// A link into a research page with a selection (#principles?mode=concept&node=…). Pushing the URL
// and then calling showPage lost the selection — showPage writes a plain #route address before the page mounts — so
// the page opened on its default view. The pending route URL is the one showPage pushes as is. The selection
// is the target route's hash query, and the old search part is not carried.
export function knowledgeRouteHref({ root = globalThis, page, params = {} } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) if (value != null && value !== '') query.set(key, String(value));
  const hash = query.toString();
  return `${root?.location?.pathname || ''}#${page}${hash ? `?${hash}` : ''}`;
}

export function navigateKnowledgeRoute({ root = globalThis, page, params = {} } = {}) {
  if (!isRouteId(page)) return false;
  const href = knowledgeRouteHref({ root, page, params });
  if (typeof root?.showPage !== 'function') {
    root?.location?.assign?.(href);
    return true;
  }
  root._aioPendingRouteHash = href;
  root.showPage(page);
  return true;
}

export { ROUTE_KEYS };
