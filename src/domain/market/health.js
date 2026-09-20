export const MARKET_HEALTH_MODEL_VERSION = 'market-health.v2';

// W08-A/P1147 (H01): every optional dimension reports its own coverage against a fixed
// expected universe, so a 1/7 sample can never read as "strong leadership". The overall
// score is the sum of the components that clear their minimum coverage, and the result
// carries `partial` when any of them does not.
export const MARKET_HEALTH_COMPONENT_MIN_COVERAGE = 0.8;
export const MARKET_HEALTH_LEADERS = Object.freeze(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA']);
export const MARKET_HEALTH_SECTORS = Object.freeze(['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLRE', 'XLB', 'XLU', 'XLC']);

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function quoteValue(quotes, symbol, field) {
  const row = quotes?.[symbol];
  return finite(row?.[field] ?? row?.value);
}

function quotePct(quotes, symbol) {
  const row = quotes?.[symbol];
  if (!row || typeof row !== 'object') return null;
  const pct = finite(row.pct ?? row.regularMarketChangePercent);
  return pct;
}

function makeComponent({ id, universe, observedIds, expected, contribution, minimumCoverage = MARKET_HEALTH_COMPONENT_MIN_COVERAGE }) {
  const expectedUniverse = expected != null ? expected : universe.length;
  const observedCount = observedIds.length;
  const ratio = expectedUniverse > 0 ? observedCount / expectedUniverse : 0;
  const sufficient = expectedUniverse > 0 && ratio >= minimumCoverage;
  return Object.freeze({
    id,
    expectedUniverse,
    observedCount,
    missingIds: Object.freeze(universe.filter((symbol) => !observedIds.includes(symbol))),
    coverageRatio: Math.round(ratio * 1000) / 1000,
    minimumCoverage,
    sufficient,
    contribution: sufficient ? contribution : null,
    status: sufficient ? 'observed' : observedCount ? 'partial' : 'missing'
  });
}

function unavailable(missing) {
  return Object.freeze({
    modelVersion: MARKET_HEALTH_MODEL_VERSION,
    available: false,
    status: 'unavailable',
    score: null,
    grade: '—',
    regime: '판정 보류',
    missing: Object.freeze([...missing]),
    partialComponents: Object.freeze([]),
    components: Object.freeze([]),
    coverage: Object.freeze({ expectedComponents: 0, observedComponents: 0, partialComponents: Object.freeze([]), minimumCoverage: MARKET_HEALTH_COMPONENT_MIN_COVERAGE }),
    leadership: Object.freeze({ observed: 0, expected: MARKET_HEALTH_LEADERS.length, up: 0, withheld: true }),
    details: Object.freeze([]),
    // A bar for an unobserved dimension is null, never a fabricated neutral 50.
    bars: Object.freeze({ spy: null, qqq: null, vix: null, pressure: null, buyRisk: null, trend: null })
  });
}

/**
 * Computes the market-health surface previously embedded in index.html.
 * The model is deliberately pure: DOM ownership belongs to a route renderer.
 */
export function computeMarketHealth({ quotes = {}, spxMA = {}, spxATH = null } = {}) {
  const spyPct = quoteValue(quotes, 'SPY', 'pct');
  const qqqPct = quoteValue(quotes, 'QQQ', 'pct');
  const vix = quoteValue(quotes, '^VIX', 'price');
  const missing = [];
  if (spyPct == null) missing.push('SPY 등락률');
  if (qqqPct == null) missing.push('QQQ 등락률');
  if (vix == null || vix < 0) missing.push('VIX');
  if (missing.length) return unavailable(missing);

  let score = 50;
  const details = [];

  if (spyPct > 1) { score += 10; details.push(`SPY 강세 +${spyPct.toFixed(1)}%`); }
  else if (spyPct > 0.05) { score += 5; details.push('SPY 소폭 양봉'); }
  else if (spyPct >= -0.05) details.push('SPY 보합');
  else if (spyPct > -1) { score -= 5; details.push('SPY 소폭 음봉'); }
  else { score -= 10; details.push(`SPY 약세 ${spyPct.toFixed(1)}%`); }

  if (qqqPct > 1) { score += 8; details.push('QQQ 강세'); }
  else if (qqqPct > 0) score += 4;
  else if (qqqPct > -1) score -= 4;
  else { score -= 8; details.push('QQQ 약세'); }

  if (vix < 15) { score += 12; details.push(`VIX ${vix.toFixed(1)} 안정`); }
  else if (vix < 20) { score += 6; details.push(`VIX ${vix.toFixed(1)} 보통`); }
  else if (vix < 25) { score -= 4; details.push(`VIX ${vix.toFixed(1)} 주의`); }
  else if (vix < 30) { score -= 10; details.push(`VIX ${vix.toFixed(1)} 경고`); }
  else { score -= 18; details.push(`VIX ${vix.toFixed(1)} 공포!`); }
  const baseComponent = makeComponent({ id: 'base-indices', universe: ['SPY', 'QQQ', '^VIX'], observedIds: ['SPY', 'QQQ', '^VIX'], contribution: null, minimumCoverage: 1 });

  // M7 leadership: the denominator stays the full seven-name universe. Receiving fewer names
  // is a coverage gap, not a smaller universe, so a thin sample withholds the leadership read.
  const leaderObserved = MARKET_HEALTH_LEADERS.filter((symbol) => quotePct(quotes, symbol) != null);
  const leaderUp = leaderObserved.filter((symbol) => quotePct(quotes, symbol) > 0).length;
  let leadershipContribution = 0;
  if (leaderObserved.length) {
    const ratio = leaderUp / leaderObserved.length;
    leadershipContribution = ratio >= 0.7 ? 8 : ratio >= 0.4 ? 2 : -6;
  }
  const leadership = makeComponent({ id: 'm7-leadership', universe: MARKET_HEALTH_LEADERS, observedIds: leaderObserved, contribution: leadershipContribution });
  if (leadership.sufficient) {
    const ratio = leaderUp / leaderObserved.length;
    if (ratio >= 0.7) details.push(`M7 ${leaderUp}/${leaderObserved.length} 상승 (강한 리더십)`);
    else if (ratio < 0.4) details.push(`M7 ${leaderUp}/${leaderObserved.length} 상승 (약한 리더십)`);
    score += leadership.contribution;
  } else {
    details.push(`M7 ${leaderUp}/${leaderObserved.length} 수신 · 표본 부족으로 리더십 판단 보류`);
  }

  const ma50 = finite(spxMA?.[50]);
  const ma200 = finite(spxMA?.[200]);
  const spyPrice = quoteValue(quotes, 'SPY', 'price');
  const trendObserved = [];
  if (ma50 > 0) trendObserved.push('ma50');
  if (ma200 > 0) trendObserved.push('ma200');
  let trendContribution = 0;
  if (ma50 > 0 && ma200 > 0 && spyPrice > 0) {
    if (ma50 > ma200 && spyPrice > ma50) { trendContribution += 8; details.push(`골든 크로스 (50MA>${Math.round(ma50)} > 200MA>${Math.round(ma200)}) + 가격 위`); }
    else if (ma50 > ma200 && spyPrice < ma50) { trendContribution += 2; details.push('50MA 위 200MA, 가격 50MA 하회 — 조정 구간'); }
    else if (ma50 < ma200 && spyPrice < ma50) { trendContribution -= 10; details.push('데스 크로스 (50MA<200MA) + 가격 아래 — 위험'); }
    else if (ma50 < ma200 && spyPrice > ma50) { trendContribution -= 3; details.push('데스 크로스이나 가격 반등 시도 중'); }
    const ath = finite(spxATH);
    if (ath > 0) {
      const athDistance = ((spyPrice - ath) / ath) * 100;
      if (athDistance > -2) details.push(`ATH 근접 (${athDistance.toFixed(1)}%)`);
      else if (athDistance < -10) { trendContribution -= 5; details.push(`ATH 대비 ${athDistance.toFixed(1)}% — 조정 구간`); }
    }
  }
  const trendComponent = makeComponent({ id: 'spx-trend', universe: ['ma50', 'ma200'], observedIds: trendObserved, contribution: trendContribution });
  if (trendComponent.sufficient) score += trendContribution;
  else details.push(`SPX 50/200MA ${trendObserved.length}/2 수신 · 추세 판단 보류`);

  const sectorObserved = MARKET_HEALTH_SECTORS.filter((symbol) => quotePct(quotes, symbol) != null);
  const sectorUp = sectorObserved.filter((symbol) => quotePct(quotes, symbol) > 0).length;
  let sectorContribution = 0;
  if (sectorObserved.length > 5) {
    const breadth = sectorUp / sectorObserved.length;
    sectorContribution = breadth >= 0.8 ? 6 : breadth >= 0.5 ? 2 : breadth < 0.3 ? -6 : 0;
  }
  const sectorComponent = makeComponent({ id: 'sector-breadth', universe: MARKET_HEALTH_SECTORS, observedIds: sectorObserved, contribution: sectorContribution, minimumCoverage: 0.5 });
  if (sectorComponent.sufficient) {
    const breadth = sectorUp / sectorObserved.length;
    if (breadth >= 0.8) details.push(`섹터 ${sectorUp}/${sectorObserved.length} 상승 (광범위)`);
    else if (breadth < 0.3) details.push(`섹터 ${sectorUp}/${sectorObserved.length} 상승 (취약)`);
    score += sectorContribution;
  } else {
    details.push(`섹터 ${sectorUp}/${sectorObserved.length} 수신 · 표본 부족으로 판단 보류`);
  }

  score = Math.round(clamp(score));
  let grade;
  let regime;
  if (score >= 80) { grade = 'A+'; regime = '강한 상승장'; }
  else if (score >= 65) { grade = 'A'; regime = '상승 추세'; }
  else if (score >= 50) { grade = 'B'; regime = '중립/혼조'; }
  else if (score >= 35) { grade = 'C'; regime = '약세 주의'; }
  else if (score >= 20) { grade = 'D'; regime = '약세장'; }
  else { grade = 'F'; regime = '극심한 약세'; }

  const components = Object.freeze([baseComponent, leadership, trendComponent, sectorComponent]);
  const partialComponents = components.filter((component) => !component.sufficient).map((component) => component.id);

  const spyBar = clamp(50 + spyPct * 10);
  const qqqBar = clamp(50 + qqqPct * 10);
  const vixBar = clamp(((vix - 10) / 30) * 100);
  // A missing trend dimension stays unavailable instead of defaulting to a neutral 50.
  const trendBar = trendComponent.sufficient
    ? (ma50 > ma200 && spyPrice > ma50 ? 85 : ma50 > ma200 ? 60 : spyPrice > ma50 ? 40 : 20)
    : null;
  const pressure = vixBar;
  return Object.freeze({
    modelVersion: MARKET_HEALTH_MODEL_VERSION,
    available: true,
    // `partial` is propagated whenever any component misses its minimum coverage.
    status: partialComponents.length ? 'partial' : 'current',
    score,
    grade,
    regime,
    missing: Object.freeze([]),
    partialComponents: Object.freeze(partialComponents),
    components,
    coverage: Object.freeze({
      expectedComponents: components.length,
      observedComponents: components.filter((component) => component.sufficient).length,
      partialComponents: Object.freeze(partialComponents),
      minimumCoverage: MARKET_HEALTH_COMPONENT_MIN_COVERAGE
    }),
    leadership: Object.freeze({ observed: leaderObserved.length, expected: MARKET_HEALTH_LEADERS.length, up: leaderUp, withheld: !leadership.sufficient }),
    details: Object.freeze(details),
    bars: Object.freeze({ spy: spyBar, qqq: qqqBar, vix: vixBar, pressure, buyRisk: 100 - pressure, trend: trendBar }),
    inputs: Object.freeze({ spyPct, qqqPct, vix, spyPrice, ma50, ma200, leaderUp, leaderTotal: leaderObserved.length, leaderExpected: MARKET_HEALTH_LEADERS.length, sectorUp, sectorTotal: sectorObserved.length, sectorExpected: MARKET_HEALTH_SECTORS.length })
  });
}
