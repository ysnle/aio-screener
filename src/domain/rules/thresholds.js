// P1428 (Codex review 2026-10-04 + owner): one table of the published judgement thresholds. 시장 상태,
// 투자 심리, 거시 경제, 금리 · 환율, the transmission chain and every gauge read these numbers, so the same
// observation can never be 부담 on one screen and calm on another (the chain once used oil ±5% beside
// cards using +10%; 투자 심리 treated 350bp as credit stress while 시장 상태 used 450bp).
// These are conventions with a stated source, not validated predictors; screens show them as 판정 기준.

export const RULES = Object.freeze({
  // v57.81 (owner 2026-10-15): a close 0.15% above the 50-day line read 양호. bufferPct is the usual whipsaw filter — within
  // ±1% of the 50-day line the index is testing the line, not trending. A Nasdaq-100 drop of 3% in five sessions is about
  // one weekly standard deviation of that index (annual volatility in the low 20s); with the Russell 2000 under its own
  // 200-day line it means leaders and small caps are falling together, so the S&P 500 alone cannot read 양호.
  trend: Object.freeze({ maShort: 50, maLong: 200, slopeLookback: 20, bufferPct: 1, leaderDrop5dPct: 3 }),
  // v57.81: leadership break — the leadership proxy (Nasdaq-100) dropped leaderDrop5dPct in five sessions or closed under
  // its 50-day line, AND at least minConfirmations of: new lows above new highs; fewer than 45% of issues advancing on the
  // last session (more decliners than advancers by a margin); O'Neil's 6+ distribution days in 25 sessions (heavy
  // institutional selling); the Russell 2000 under its 200-day line. Conventions, not validated predictors.
  leadership: Object.freeze({ advanceRatioWeakBelow: 0.45, distributionDaysAt: 6, minConfirmations: 2 }),
  // v57.81: "회복 중" only when the last session did not give back reversalShare of the window's gain (a 5-day +8pp bounce
  // that lost 4pp on the last close is 되밀림, not recovery); a last-session drop of lastSessionNoticePp or more is named.
  // indexConfirmDeadZonePp: a 20-session participation change inside ±3pp is "거의 변하지 않음", not 넓어짐/줄어듦.
  breadth: Object.freeze({ weakBelow: 40, broadAtLeast: 60, reversalShare: 0.5, lastSessionNoticePp: 3, indexConfirmDeadZonePp: 3 }),
  // VIX 18 / 25 / 32: the calm / stress / high band edges (a convention, not a validated predictor; P1367 fixed them
  // and the regime-drift alert already compares these bands). VIX above its 3-month (ratio >= 1) is an inverted term structure.
  // v57.81: 양호 needs VIX at least calmBufferPt under the calm edge, or under the edge and not rising over five sessions;
  // a five-session rise of rise5dWatchPct or more holds it at 중립 (VIX 16.87 after +11.9% in a week read 양호, 1.1pt off 18).
  volatility: Object.freeze({ calmBelow: 18, stressAt: 25, highAt: 32, calmRatioBelow: 0.95, invertedRatioAt: 1, spike5dPct: 25, calmBufferPt: 1, rise5dWatchPct: 10 }),
  // 10-year Treasury: a 25bp move in 20 sessions, or the top 10% of its one-year range while still rising.
  // v57.81 hysteresis: once 부담, it stays until the range position falls under rangeExitAt or the 20-session rise is
  // under exit20dBp (a 5-day dip of -9bp at 91% of the range flipped 부담 to 중립 and back on one week's sign).
  rates: Object.freeze({ move20dBp: 25, rangeHighAt: 0.9, rangeExitAt: 0.8, exit20dBp: 10, latchSessions: 60 }),
  // ICE BofA US High Yield OAS: below 350bp tight, 450bp+ stressed, +25bp in five sessions a fast widening;
  // +15bp in five sessions is the early-watch level (P1449: HY 324bp +44bp must read as widening
  // stress forming, not calm), and ≤5bp / five sessions counts as calm for the smallcap reading.
  // T05 (2026-10-13): +25bp over 20 sessions keeps the credit axis at 중립 at best (a month-long widening is not calm).
  // T10: total put/call 1.1+ is heavy hedging, below 0.7 call-heavy optimism (one table for the card and the axis).
  // v57.50 C16: one RSI reading for stock summary, screener, briefing and AI (screener entry filters may be stricter,
  // but they are labelled as a filter, not as "과열").
  technical: Object.freeze({ rsi: Object.freeze({ overbought: 70, oversold: 30, climax: 80 }) }),
  // v57.81: a 20-session widening reaches 부담 when it is in the top stress20dPct of the series' own 20-session changes (or
  // stress20dMultiple x widen20dBp when the record is shorter than recordMin); it stays 부담 until the 20-session change
  // is back under widen20dBp (hysteresis). HY +40bp in 20 sessions — the 96th percentile — could never reach 부담 before.
  credit: Object.freeze({ tightBelowBp: 350, stressAtBp: 450, widen5dBp: 25, widenWatch5dBp: 15, calm5dBp: 5, widen20dBp: 25, putCallHedgeAt: 1.1, putCallOptimismBelow: 0.7,
    stress20dPct: 90, stress20dMultiple: 2, recordMin: 120, latchSessions: 60 }),
  // WTI against its own one-year range (P1394) and 20-session change; the dollar index 20-session change.
  oil: Object.freeze({ rise20dPct: 10, fall20dPct: -5, rangeHighAt: 0.85 }),
  // v57.81: a dollar rise counts as 부담 only bufferPct past rise20dPct, or past rise20dPct with the dollar index in the top
  // of its own one-year range (rangeHighAt) — DXY +2.23% against a 2.0% line read 부담 on 0.23pp.
  dollar: Object.freeze({ rise20dPct: 2, fall20dPct: -2, bufferPct: 0.5, rangeHighAt: 0.8 }),
  // Won 20-session move; a yen rally of 3%+ in 20 sessions preceded the August 2024 carry unwind.
  // v57.81: a won move counts only when the 20-session change and the shift of the 20-session mean agree (meanShareOfBar of
  // the bar, same sign) — an endpoint on a one-day spike (9/17 1376.6) made a flat won read -2.5%. A KOSPI fall of
  // kospiContradict20dPct or more over 20 sessions (or a rare KOSPI day) holds a won-strength reading at 중립 (혼조).
  fx: Object.freeze({ krwMove20dPct: 2, yenRally20dPct: 3, meanShareOfBar: 0.5, kospiContradict20dPct: 5 }),
  // v57.81: a Fear & Greed move of namedMovePt or more over one or five sessions is always named beside the 20-session read.
  sentiment: Object.freeze({ namedMovePt: 10 }),
  // Breakeven (10Y inflation compensation) weekly move used as the chain's inflation-expectation link.
  breakeven: Object.freeze({ move5dBp: 5 }),
  // Sahm (2019): 3-month average unemployment 0.5pp above its prior 12-month low; 0.3 an early watch level.
  growth: Object.freeze({ sahmRecessionAt: 0.5, sahmWatchAt: 0.3, payrollSolidK: 100, payrollSlowdownK: 25 }),
  // FOMC longer-run goal: 2% PCE inflation; core PCE 3% a clear miss; a 3-month pace 0.5pp above the year re-accelerating.
  inflation: Object.freeze({ targetPct: 2, nearTargetPct: 2.5, missPct: 3, reaccelPp: 0.5 }),
  // 2-year yield vs the policy midpoint: ±0.25pp is one 25bp move priced; the FOMC longer-run 3.0% less 2% ≈ 1% neutral real rate.
  policy: Object.freeze({ pricedMovePp: 0.25, neutralRealPct: 1, restrictiveRealPct: 2 }),
  // CNN Fear & Greed integer bands: extreme fear 0-24, fear 25-44, neutral 45-55, greed 56-75, extreme greed 76-100
  // (as reproduced from CNN Business by https://www.nerdwallet.com/article/investing/what-is-the-fear-and-greed-index;
  // the index is published as a whole number, so a reading is rounded before it is banded).
  fearGreed: Object.freeze({ extremeFearBelow: 25, fearBelow: 45, greedAbove: 55, extremeGreedAbove: 75 })
});
