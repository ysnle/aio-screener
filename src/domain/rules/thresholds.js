// P1428 (Codex review 2026-10-04 + owner): one table of the published judgement thresholds. 시장 상태,
// 투자 심리, 거시 경제, 금리 · 환율, the transmission chain and every gauge read these numbers, so the same
// observation can never be 부담 on one screen and calm on another (the chain once used oil ±5% beside
// cards using +10%; 투자 심리 treated 350bp as credit stress while 시장 상태 used 450bp).
// These are conventions with a stated source, not validated predictors; screens show them as 판정 기준.

export const RULES = Object.freeze({
  trend: Object.freeze({ maShort: 50, maLong: 200, slopeLookback: 20 }),
  breadth: Object.freeze({ weakBelow: 40, broadAtLeast: 60 }),
  // VIX 18 / 25: the common calm / stress bands; VIX above its 3-month (ratio >= 1) is an inverted term structure.
  volatility: Object.freeze({ calmBelow: 18, stressAt: 25, calmRatioBelow: 0.95, invertedRatioAt: 1, spike5dPct: 25 }),
  // 10-year Treasury: a 25bp move in 20 sessions, or the top 10% of its one-year range while still rising.
  rates: Object.freeze({ move20dBp: 25, rangeHighAt: 0.9 }),
  // ICE BofA US High Yield OAS: below 350bp tight, 450bp+ stressed, +25bp in five sessions a fast widening.
  credit: Object.freeze({ tightBelowBp: 350, stressAtBp: 450, widen5dBp: 25, putCallHedgeAt: 1.1 }),
  // WTI against its own one-year range (P1394) and 20-session change; the dollar index 20-session change.
  oil: Object.freeze({ rise20dPct: 10, fall20dPct: -5, rangeHighAt: 0.85 }),
  dollar: Object.freeze({ rise20dPct: 2, fall20dPct: -2 }),
  // Won 20-session move; a yen rally of 3%+ in 20 sessions preceded the August 2024 carry unwind.
  fx: Object.freeze({ krwMove20dPct: 2, yenRally20dPct: 3 }),
  // Breakeven (10Y inflation compensation) weekly move used as the chain's inflation-expectation link.
  breakeven: Object.freeze({ move5dBp: 5 }),
  // Sahm (2019): 3-month average unemployment 0.5pp above its prior 12-month low; 0.3 an early watch level.
  growth: Object.freeze({ sahmRecessionAt: 0.5, sahmWatchAt: 0.3, payrollSolidK: 100, payrollSlowdownK: 25 }),
  // FOMC longer-run goal: 2% PCE inflation; core PCE 3% a clear miss; a 3-month pace 0.5pp above the year re-accelerating.
  inflation: Object.freeze({ targetPct: 2, nearTargetPct: 2.5, missPct: 3, reaccelPp: 0.5 }),
  // 2-year yield vs the policy midpoint: ±0.25pp is one 25bp move priced; the FOMC longer-run 3.0% less 2% ≈ 1% neutral real rate.
  policy: Object.freeze({ pricedMovePp: 0.25, neutralRealPct: 1, restrictiveRealPct: 2 }),
  // CNN Fear & Greed published bands.
  fearGreed: Object.freeze({ extremeFearBelow: 25, fearBelow: 45, greedAbove: 55, extremeGreedAbove: 75 })
});
