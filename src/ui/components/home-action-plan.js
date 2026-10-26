// Legacy unification (2026-10-26, roadmap item 11, screen 오늘): the home 행동 계획 card lines (#home-action-position,
// #home-action-sentiment, #home-action-breadth) moved here from window._aioRefreshActionPlan in js/aio-core.js. Texts and
// the marketState-first source are unchanged. The rules (AIO_ACTION_RULES) and market state are still read from the
// window, so this module imports nothing.

export function renderHomeActionPlan({ documentRef = globalThis.document, root = globalThis, now = Date.now() } = {}) {
  try {
    const rules = root.AIO_ACTION_RULES;
    if (!rules || !rules.getActionPlan) return null;
    // v50.43: marketState first — the action item reads the same plan as the conclusion bar and trading card.
    // Without a fresh marketState it computes from the same inputs (vix/fg/breadth50).
    const ms = root.AIO && root.AIO.marketState;
    const fresh = ms && ms.actionPlan && (now - (ms.ts || 0) < 15 * 60 * 1000);
    // P1164/B03: a missing value is not 0 — Number(null) made a missing F&G read '극단 공포' and a missing VIX
    // '저변동'. The display sentinel is NaN ('—').
    const num = (v) => { const n = typeof root._aioFiniteNum === 'function' ? root._aioFiniteNum(v) : (typeof v === 'number' && isFinite(v) ? v : null); return n == null ? NaN : n; };
    let vixVal; let fgVal; let plan;
    if (fresh) {
      vixVal = num(ms.vix);
      fgVal = num(ms.fg);
      plan = ms.actionPlan;
    } else {
      const ld = root._liveData || {};
      vixVal = num((ld['^VIX'] && ld['^VIX'].price != null) ? ld['^VIX'].price : (root.DATA_SNAPSHOT ? root.DATA_SNAPSHOT.vix : null));
      const fgMetric = root.AIO && typeof root.AIO.getCanonicalMetric === 'function' ? root.AIO.getCanonicalMetric('fg') : null;
      fgVal = num((fgMetric && fgMetric.value != null) ? fgMetric.value : (root._lastFG != null ? root._lastFG : (root.DATA_SNAPSHOT ? root.DATA_SNAPSHOT.fg : null)));
      const breadthEv = root.AIO && typeof root.AIO.getCurrentBreadthEvidence === 'function' ? root.AIO.getCurrentBreadthEvidence() : { available: false };
      plan = rules.getActionPlan({ vix: vixVal, fg: fgVal, breadth50: breadthEv.available ? breadthEv.sma50 : NaN });
    }
    const posEl = documentRef.getElementById('home-action-position');
    const sentEl = documentRef.getElementById('home-action-sentiment');
    const brEl = documentRef.getElementById('home-action-breadth');
    if (posEl && plan.position) posEl.textContent = `변동성 구간(${plan.position.label}): ${plan.position.note} (VIX ${isNaN(vixVal) ? '—' : vixVal.toFixed(2)})`; // one VIX rounding (first-users S4#11)
    if (sentEl && plan.sentiment) sentEl.textContent = `심리 환경(${plan.sentiment.action}): ${plan.sentiment.note} (F&G ${isNaN(fgVal) ? '—' : fgVal})`;
    if (brEl && plan.actions && plan.actions.length > 2) brEl.textContent = `${plan.actions[plan.actions.length - 1]}`;
    if (posEl) posEl.setAttribute('data-refreshed-at', new Date(now).toISOString());
    return plan;
  } catch (e) {
    if (root._aioLog) root._aioLog('error', 'action-plan', `refresh failed: ${(e && e.message) || e}`);
    return null;
  }
}
