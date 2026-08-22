const ROUTE_KEYS = Object.freeze(['mode', 'node', 'path', 'step', 'chapter', 'lesson', 'domain', 'topic', 'guide', 'criticality', 'manager', 'period']);

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
    period: values.period || null
  });
}

function parseReturnContext(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function parseKnowledgeTargetContext({ root = globalThis, locationLike = root.location } = {}) {
  const active = root?.AIO_KNOWLEDGE_ROUTE_CONTEXT;
  if (active?.active && active.routeId) return Object.freeze({ ...active });
  const pendingHash = typeof root?._aioPendingRouteHash === 'string' ? root._aioPendingRouteHash : '';
  const hash = pendingHash || locationUrl(locationLike).hash;
  const match = String(hash || '').match(/^#([^?]+)(?:\?(.*))?$/);
  if (!match) return null;
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
  if (!target.routeId) return '';
  const params = new URLSearchParams();
  if (target.conceptId) params.set('knowledgeNode', target.conceptId);
  if (target.metric) params.set('metric', target.metric);
  if (target.timeframe) params.set('timeframe', target.timeframe);
  params.set('return', JSON.stringify(target.returnContext || { route: 'principles' }));
  return `#${target.routeId}?${params}`;
}

export function navigateKnowledgeTarget({ root = globalThis, target = {} } = {}) {
  const hash = knowledgeTargetHash(target);
  if (!hash || typeof root?.showPage !== 'function') return false;
  root._aioPendingRouteHash = hash;
  root.showPage(target.routeId);
  return true;
}

export { ROUTE_KEYS };
