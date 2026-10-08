const COMPATIBILITY_EVENT_DEDUPE_WINDOW_MS = 250;

function serializeCompatibilityEventDetail(detail) {
  if (!detail || typeof detail !== 'object') return null;
  const seen = new WeakSet();
  const serialize = (value) => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (seen.has(value)) throw new TypeError('cyclic event detail');
    seen.add(value);
    const serialized = Array.isArray(value)
      ? `[${value.map((entry) => serialize(entry)).join(',')}]`
      : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`).join(',')}}`;
    seen.delete(value);
    return serialized;
  };
  try {
    return serialize(detail);
  } catch (_) {
    return null;
  }
}

/**
 * Subscribe to a legacy event on both the document and its window without
 * making every native consumer know which target the legacy producer chose.
 * Refresh/history producers have not always agreed on that target. A short
 * detail-fingerprint window collapses the two dispatches of one logical event
 * while still allowing two events from the same target through.
 */
export function createCompatibilityEventAdapter({ root = globalThis, eventTarget = root?.document, now = () => Date.now(), onError = (error) => console.error(error) } = {}) {
  const primaryTarget = eventTarget || root;
  const secondaryTarget = root && root !== primaryTarget ? root : null;
  const targets = [...new Set([primaryTarget, secondaryTarget]
    .filter((target) => typeof target?.addEventListener === 'function'))];
  const subscriptions = new Map();
  const recentEvents = new Map();
  const eventTokens = new WeakMap();
  let nextEventToken = 0;
  let disposed = false;

  const readNow = () => {
    try {
      const value = Number(now());
      if (Number.isFinite(value)) return value;
    } catch (_) {}
    return Date.now();
  };
  const eventKey = (eventName, event) => {
    const serializedDetail = serializeCompatibilityEventDetail(event?.detail);
    if (serializedDetail != null) return `${eventName}:detail:${serializedDetail}`;
    if (event && typeof event === 'object') {
      if (!eventTokens.has(event)) eventTokens.set(event, ++nextEventToken);
      return `${eventName}:event:${eventTokens.get(event)}`;
    }
    return null;
  };
  const isDuplicate = (key, source, at) => {
    if (!key) return false;
    const previous = recentEvents.get(key);
    return !!previous && previous.expiresAt > at && previous.source !== source;
  };
  const remember = (key, source, at) => {
    if (!key) return;
    for (const [seenKey, record] of recentEvents) {
      if (record.expiresAt <= at) recentEvents.delete(seenKey);
    }
    recentEvents.set(key, { source, expiresAt: at + COMPATIBILITY_EVENT_DEDUPE_WINDOW_MS });
  };

  // P1518: one failed consumer must not block sibling refresh consumers.
  const reportError = (error) => {
    try { onError(error); } catch (reportingError) { console.error(reportingError); }
  };
  const on = (eventName, listener) => {
    const name = String(eventName || '').trim();
    if (disposed || !name || typeof listener !== 'function' || !targets.length) return () => {};
    let subscription = subscriptions.get(name);
    if (!subscription) {
      subscription = { name, listeners: new Set(), handlers: [] };
      const dispatch = (event, source) => {
        if (disposed) return;
        const at = readNow();
        const key = eventKey(name, event);
        // P1408: only a delivered event is remembered. Remembering the suppressed mirror rewrote the
        // record's source, so the next genuine update from the original target was dropped too.
        if (isDuplicate(key, source, at)) return;
        remember(key, source, at);
        for (const callback of [...subscription.listeners]) {
          if (disposed) break;
          try {
            const result = callback(event);
            if (result && typeof result.then === 'function') Promise.resolve(result).catch(reportError);
          } catch (error) { reportError(error); }
        }
      };
      targets.forEach((target) => {
        const handler = (event) => dispatch(event, target);
        target.addEventListener(name, handler);
        subscription.handlers.push({ target, handler });
      });
      subscriptions.set(name, subscription);
    }
    subscription.listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      subscription.listeners.delete(listener);
      if (subscription.listeners.size) return;
      subscription.handlers.forEach(({ target, handler }) => target.removeEventListener(name, handler));
      subscriptions.delete(name);
    };
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    subscriptions.forEach((subscription) => {
      subscription.handlers.forEach(({ target, handler }) => target.removeEventListener(subscription.name, handler));
    });
    subscriptions.clear();
    recentEvents.clear();
  };

  return Object.freeze({ on, dispose });
}
