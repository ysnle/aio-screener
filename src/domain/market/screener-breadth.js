// Screener-universe breadth (public-data/screener.json `breadth`), checked once for every reader. Legacy unification
// (2026-10-17): js/aio-data.js _aioApplyScreenerBreadth used to run these checks and copy the result into
// _aioScreenerBreadthState / _breadthLiveData / _krBreadthLiveData; readers now ask this function with the native
// screener metadata. It is an AIO screener-universe measurement, not official exchange breadth.
const VALUE_KEYS = ['above5', 'above20', 'above50', 'above200', 'advanceRatio'];
const MAX_AGE_HOURS = 96;

function valuesOk(segment) {
  return !!segment && VALUE_KEYS.every((key) => typeof segment[key] === 'number' && Number.isFinite(segment[key]) && segment[key] >= 0 && segment[key] <= (key === 'advanceRatio' ? 1 : 100));
}

function observedMsOf(segment) {
  return segment && segment.observedAt ? new Date(segment.observedAt).getTime() : 0;
}

export function readScreenerBreadth(breadth, now = Date.now()) {
  const root = breadth && typeof breadth === 'object' ? breadth : null;
  const us = root?.segments?.us || null;
  const kr = root?.segments?.kr || null;
  const observedMs = observedMsOf(us);
  const ageHours = observedMs ? (now - observedMs) / 3600000 : null;
  const checks = {
    schema: !!(root && root.schemaVersion === '1.0'),
    coverage: !!(us && us.coveragePct >= 85 && us.eligible >= 300),
    observed: !!(observedMs && ageHours >= -1 && ageHours <= MAX_AGE_HOURS),
    values: valuesOk(us)
  };
  const passed = Object.values(checks).every(Boolean);
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
  if (!passed) return { state, us: null, kr: null };
  const krObservedMs = observedMsOf(kr);
  const krAgeHours = krObservedMs ? (now - krObservedMs) / 3600000 : null;
  const krPassed = !!(valuesOk(kr) && kr.coveragePct >= 85 && kr.eligible >= 100 && krAgeHours >= -1 && krAgeHours <= MAX_AGE_HOURS);
  return {
    state,
    us: {
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
