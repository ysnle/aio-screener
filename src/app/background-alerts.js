// v57.54 review: price/VIX alerts exist to raise an OS notification while the tab is in the background, but quotes
// (REFRESH_SCHEDULE, since v46.9) and the 1-minute alert check (P1756 timer registry) both pause while hidden. Only when
// the reader has an armed alert and has granted notifications, this refreshes just the alerted symbols every 5 minutes
// while hidden and re-checks; nothing runs for anyone else, and visibility return hands back to the normal scheduler.
const HIDDEN_ALERT_MS = 5 * 60 * 1000;

function armedAlerts(root) {
  try {
    if (typeof root.Notification === 'undefined' || root.Notification.permission !== 'granted') return [];
    const alerts = typeof root._aioGetAlerts === 'function' ? root._aioGetAlerts() : [];
    return Array.isArray(alerts) ? alerts.filter((alert) => alert && !alert.triggered) : [];
  } catch (_) { return []; }
}

export function alertSymbols(alerts) {
  const symbols = alerts.filter((a) => a.metric === 'price' && a.tickerOrIndex).map((a) => String(a.tickerOrIndex));
  if (alerts.some((a) => a.metric === 'vix')) symbols.push('^VIX');
  return [...new Set(symbols)];
}

export function installBackgroundAlerts(root = globalThis, doc = root.document) {
  if (!doc || root.__aioBackgroundAlerts) return null;
  let timer = null;
  const tick = () => {
    const alerts = armedAlerts(root);
    if (!alerts.length) { root.clearInterval(timer); timer = null; return; }
    const symbols = alertSymbols(alerts);
    const refresh = symbols.length && typeof root.AIO?.runScheduledRefresh === 'function'
      ? root.AIO.runScheduledRefresh({ keys: ['quotes'], reason: 'background-alerts', symbols })
      : null;
    Promise.resolve(refresh).catch(() => {}).finally(() => { try { root._aioCheckAlerts?.(); } catch (_) {} });
  };
  doc.addEventListener('visibilitychange', () => {
    root.clearInterval(timer);
    timer = null;
    if (doc.hidden && armedAlerts(root).length) timer = root.setInterval(tick, HIDDEN_ALERT_MS);
  });
  root.__aioBackgroundAlerts = { tick, active: () => timer !== null };
  return root.__aioBackgroundAlerts;
}
