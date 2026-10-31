// Screener-universe breadth (public-data/screener.json `breadth`), checked once for every reader. Legacy unification
// (2026-10-17): js/aio-data.js _aioApplyScreenerBreadth used to run these checks and copy the result into
// _aioScreenerBreadthState / _breadthLiveData / _krBreadthLiveData; readers now ask this function with the native
// screener metadata. It is an AIO screener-universe measurement, not official exchange breadth.
import { FRESHNESS_POLICY } from '../shared/freshness-policy.js';
import { isSessionCurrent } from './market-calendar.js';

const VALUE_KEYS = ['above5', 'above20', 'above50', 'above200', 'advanceRatio'];
const MAX_AGE_HOURS = FRESHNESS_POLICY.factorSessionMs / 3600000;

function valuesOk(segment) {
  return !!segment && VALUE_KEYS.every((key) => typeof segment[key] === 'number' && Number.isFinite(segment[key]) && segment[key] >= 0 && segment[key] <= (key === 'advanceRatio' ? 1 : 100));
}

function observedMsOf(segment) {
  return segment && segment.observedAt ? new Date(segment.observedAt).getTime() : 0;
}

// v59.45 (P17-BREADTH-01/02): one check for every population — a finite observation time inside the age window is
// required (a missing or invalid time is not current), and a candidate is chosen only after it passes all checks.
// v59.47: the age window is the session rule on the segment's exchange; 96 hours only where the calendar has no year.
function segmentCheck(segment, now, minEligible, market = 'US') {
  const observedMs = observedMsOf(segment);
  const ageHours = Number.isFinite(observedMs) && observedMs > 0 ? (now - observedMs) / 3600000 : null;
  const current = ageHours == null ? null : isSessionCurrent({ market, observedAt: segment.observedAt, sessionDate: segment.sessionDate || null, now }, FRESHNESS_POLICY.factorSession);
  const checks = {
    coverage: !!(segment && segment.coveragePct >= 85 && segment.eligible >= minEligible),
    observed: ageHours != null && ageHours >= -1 && (current != null ? current : ageHours <= MAX_AGE_HOURS),
    values: valuesOk(segment)
  };
  return { observedMs: ageHours == null ? 0 : observedMs, ageHours, checks, passed: Object.values(checks).every(Boolean) };
}

// v58.79 (owner 2026-10-25): the headline breadth is S&P 500 members. The history rows say which population each value
// counts (fieldMeta.universeScope); rows written before the switch keep the AIO US universe and say so.
export const SP500_BREADTH_SCOPE = 'sp500-members-not-official-index-breadth';
export function breadthScopeOf(history, field = 'breadth50') {
  const rows = Array.isArray(history) ? history : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.[field] == null) continue;
    const meta = rows[i].fieldMeta?.[field] || {};
    const sp500 = meta.universeScope === SP500_BREADTH_SCOPE;
    return { sp500, label: sp500 ? 'S&P 500 구성 종목' : 'AIO 미국 관찰 종목', eligible: Number.isFinite(Number(meta.eligible)) ? Number(meta.eligible) : null, date: rows[i].date };
  }
  return { sp500: false, label: 'AIO 미국 관찰 종목', eligible: null, date: null };
}

export function readScreenerBreadth(breadth, now = Date.now()) {
  const root = breadth && typeof breadth === 'object' ? breadth : null;
  // v58.79: S&P 500 members lead when that segment passes the same checks (age included); the AIO US universe is the
  // fallback. A stale S&P 500 segment no longer blocks a current US universe.
  const sp500 = root?.segments?.sp500 || null;
  const sp500Read = sp500 ? segmentCheck(sp500, now, 300) : null;
  const us = (sp500Read?.passed ? sp500 : null) || root?.segments?.us || (sp500 || null);
  const kr = root?.segments?.kr || null;
  const usRead = segmentCheck(us, now, 300);
  const { observedMs, ageHours } = usRead;
  const checks = { schema: !!(root && root.schemaVersion === '1.0'), ...usRead.checks };
  const passed = Object.values(checks).every(Boolean);
  const krRead = segmentCheck(kr, now, 100, 'KR');
  const krPassed = checks.schema && krRead.passed;
  const krState = { status: krPassed ? 'verified_current' : 'blocked', observedAt: kr?.observedAt || null, ageHours: krRead.ageHours, checks: krRead.checks };
  const state = {
    status: passed ? 'verified_current' : 'blocked',
    source: root?.source || null,
    label: us?.label || null,
    observedAt: us?.observedAt || null,
    ageHours,
    coveragePct: us?.coveragePct,
    eligible: us?.eligible,
    checks,
    decisionScope: root?.decisionScope || 'research/reference'
  };
  // Each market is judged on its own: a blocked US read no longer removes a current Korean one (krState says why).
  const krObservedMs = krRead.observedMs;
  return {
    state,
    krState,
    us: !passed ? null : {
      sma5: us.above5, sma20: us.above20, sma50: us.above50, above200: us.above200,
      advances: us.advances, declines: us.declines, advanceRatio: us.advanceRatio,
      ts: observedMs, generatedAt: us.observedAt,
      source: root.source || us.label || 'AIO US screener universe',
      coveragePct: us.coveragePct, eligible: us.eligible
    },
    kr: krPassed ? {
      sma5: kr.above5, sma20: kr.above20, sma50: kr.above50, above200: kr.above200,
      advances: kr.advances, declines: kr.declines, unchanged: kr.unchanged,
      advanceRatio: kr.advanceRatio, ts: krObservedMs, observedAt: kr.observedAt,
      source: root.source || kr.label, label: kr.label,
      coveragePct: kr.coveragePct, eligible: kr.eligible,
      decisionScope: root.decisionScope || 'research/reference'
    } : null
  };
}
