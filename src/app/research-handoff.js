const HANDOFF_KEY = '_aioResearchHandoff';

export function setResearchHandoff({ root = globalThis, routeId = null, context = {}, label = null, fromRoute = null } = {}) {
  if (!root || !routeId) return false;
  const clean = {};
  for (const [key, value] of Object.entries(context || {})) {
    if (value == null || value === '') continue;
    clean[key] = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  }
  root[HANDOFF_KEY] = Object.freeze({ routeId: String(routeId), context: Object.freeze(clean), label: label || null, fromRoute: fromRoute || null, at: Date.now() });
  return true;
}

// Same-route one-shot consume. Different-route handoffs are left for their own route.
export function consumeResearchHandoff({ root = globalThis, routeId = null, symbol = null } = {}) {
  const handoff = root?.[HANDOFF_KEY];
  if (!handoff || handoff.routeId !== routeId) return null;
  delete root[HANDOFF_KEY];
  return !symbol || handoff.context.symbol === symbol ? handoff : null;
}
