import { isRouteId } from './routes.js';

const ROUTE_KEYS = Object.freeze(['mode', 'node', 'path', 'step', 'chapter', 'lesson', 'domain', 'topic', 'guide', 'criticality', 'manager', 'period', 'view']);

function locationUrl(locationLike) {
  if (locationLike?.href) return new URL(locationLike.href);
  const pathname = locationLike?.pathname || '/';
  const search = locationLike?.search || '';
  const hash = locationLike?.hash || '#atlas';
  return new URL(`https://aio-screener.local${pathname}${search}${hash}`);
}

export function parseKnowledgeRouteState(locationLike) {
  const url = locationUrl(locationLike);
  const values = Object.fromEntries(ROUTE_KEYS.map((key) => [key, url.searchParams.get(key) || '']));
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
    view: values.view || null
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

export function serializeKnowledgeRouteState(locationLike, state = {}) {
  const url = locationUrl(locationLike);
  for (const key of ROUTE_KEYS) url.searchParams.delete(key);
  for (const key of ROUTE_KEYS) {
    const value = state[key];
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}

export function replaceKnowledgeRouteState({ root = globalThis, locationLike = root.location, historyLike = root.history, state = {} } = {}) {
  const nextUrl = serializeKnowledgeRouteState(locationLike, state);
  if (typeof historyLike?.replaceState === 'function') historyLike.replaceState(historyLike.state || null, '', nextUrl);
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

// v57.50 I17/I18: a link into a research page with a selection (?mode=concept&node=…#principles). Pushing the URL
// and then calling showPage lost the selection — showPage strips the knowledge keys from the search part of a plain
// route URL before the page mounts — so the page opened on its default view. The pending route URL is the one
// showPage pushes as is.
export function knowledgeRouteHref({ root = globalThis, page, params = {} } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) if (value != null && value !== '') query.set(key, String(value));
  const search = query.toString();
  return `${root?.location?.pathname || ''}${search ? `?${search}` : ''}#${page}`;
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
