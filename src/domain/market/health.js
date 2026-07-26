export const MARKET_HEALTH_MODEL_VERSION = 'market-health.v1';

function finite(value) {
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

function unavailable(missing) {
  return Object.freeze({
    modelVersion: MARKET_HEALTH_MODEL_VERSION,
    available: false,
    status: 'unavailable',
    score: null,
    grade: '—',
    regime: '판정 보류',
    missing: Object.freeze([...missing]),
    details: Object.freeze([]),
    bars: Object.freeze({ spy: 50, qqq: 50, vix: 0, pressure: 0, buyRisk: 0, trend: 50 })
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
  if (vix == null) missing.push('VIX');
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

  const leaders = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
  let leaderUp = 0;
  let leaderTotal = 0;
  leaders.forEach((symbol) => {
    const row = quotes?.[symbol];
    if (row) {
      leaderTotal += 1;
      if ((finite(row.pct) ?? 0) > 0) leaderUp += 1;
    }
  });
  if (leaderTotal > 0) {
    const ratio = leaderUp / leaderTotal;
    if (ratio >= 0.7) { score += 8; details.push(`M7 ${leaderUp}/${leaderTotal} 상승 (강한 리더십)`); }
    else if (ratio >= 0.4) score += 2;
    else { score -= 6; details.push(`M7 ${leaderUp}/${leaderTotal} 상승 (약한 리더십)`); }
  }

  const ma50 = finite(spxMA?.[50]);
  const ma200 = finite(spxMA?.[200]);
  const spyPrice = quoteValue(quotes, 'SPY', 'price');
  if (ma50 && ma200 && spyPrice) {
    if (ma50 > ma200 && spyPrice > ma50) { score += 8; details.push(`골든 크로스 (50MA>${Math.round(ma50)} > 200MA>${Math.round(ma200)}) + 가격 위`); }
    else if (ma50 > ma200 && spyPrice < ma50) { score += 2; details.push('50MA 위 200MA, 가격 50MA 하회 — 조정 구간'); }
    else if (ma50 < ma200 && spyPrice < ma50) { score -= 10; details.push('데스 크로스 (50MA<200MA) + 가격 아래 — 위험'); }
    else if (ma50 < ma200 && spyPrice > ma50) { score -= 3; details.push('데스 크로스이나 가격 반등 시도 중'); }
    const ath = finite(spxATH);
    if (ath && spyPrice) {
      const athDistance = ((spyPrice - ath) / ath) * 100;
      if (athDistance > -2) details.push(`ATH 근접 (${athDistance.toFixed(1)}%)`);
      else if (athDistance < -10) { score -= 5; details.push(`ATH 대비 ${athDistance.toFixed(1)}% — 조정 구간`); }
    }
  }

  const sectors = ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLRE', 'XLB', 'XLU', 'XLC'];
  let sectorUp = 0;
  let sectorTotal = 0;
  sectors.forEach((symbol) => {
    const row = quotes?.[symbol];
    if (row) {
      sectorTotal += 1;
      if ((finite(row.pct) ?? 0) > 0) sectorUp += 1;
    }
  });
  if (sectorTotal > 5) {
    const breadth = sectorUp / sectorTotal;
    if (breadth >= 0.8) { score += 6; details.push(`섹터 ${sectorUp}/${sectorTotal} 상승 (광범위)`); }
    else if (breadth >= 0.5) score += 2;
    else if (breadth < 0.3) { score -= 6; details.push(`섹터 ${sectorUp}/${sectorTotal} 상승 (취약)`); }
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

  const spyBar = clamp(50 + spyPct * 10);
  const qqqBar = clamp(50 + qqqPct * 10);
  const vixBar = clamp(((vix - 10) / 30) * 100);
  const trend = ma50 && ma200 && spyPrice
    ? (ma50 > ma200 && spyPrice > ma50 ? 85 : ma50 > ma200 ? 60 : spyPrice > ma50 ? 40 : 20)
    : 50;
  const pressure = vixBar;
  return Object.freeze({
    modelVersion: MARKET_HEALTH_MODEL_VERSION,
    available: true,
    status: 'current',
    score,
    grade,
    regime,
    missing: Object.freeze([]),
    details: Object.freeze(details),
    bars: Object.freeze({ spy: spyBar, qqq: qqqBar, vix: vixBar, pressure, buyRisk: 100 - pressure, trend }),
    inputs: Object.freeze({ spyPct, qqqPct, vix, spyPrice, ma50, ma200, leaderUp, leaderTotal, sectorUp, sectorTotal })
  });
}
