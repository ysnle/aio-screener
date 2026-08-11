const ROUTE_KEYS = Object.freeze(['mode', 'node', 'path', 'step', 'chapter', 'lesson']);

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
    lesson: values.lesson || null
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
  if (typeof historyLike?.replaceState === 'function') historyLike.replaceState(null, '', nextUrl);
  return nextUrl;
}

export { ROUTE_KEYS };
