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
  // Audit 2026-10-17 (owner D2): 양호 is entered at bufferPct above the rising 50-day line and held while the close stays at
  // or above the line plus holdAbovePct (the line itself), the line keeps rising and stays over the 200-day line; the
  // single-session rule flipped 양호/중립 19 times in 97 sessions of 2026-06~10 (9 with the hold).
  trend: Object.freeze({ maShort: 50, maLong: 200, slopeLookback: 20, bufferPct: 1, holdAbovePct: 0, latchSessions: 60, leaderDrop5dPct: 3 }),
  // v57.81: leadership break — the leadership proxy (Nasdaq-100) dropped leaderDrop5dPct in five sessions or closed under
  // its 50-day line, AND at least minConfirmations of: new lows above new highs; fewer than 45% of issues advancing on the
  // last session (more decliners than advancers by a margin); O'Neil's 6+ distribution days in 25 sessions (heavy
  // institutional selling); the Russell 2000 under its 200-day line. Conventions, not validated predictors.
  // v57.94 (owner 2026-10-17): a confirmation counts when it held on any of the last confirmWindowSessions sessions, and a
  // break holds while the proxy stays weak — single-session counts read 7/23 이탈 → 7/24~28 약세 → 7/29 이탈 in July 2026.
  // Audit 2026-10-17 (owner D1): the advance confirmation is the mean advance ratio over those sessions, not "any one of
  // them" — one session under 45% in five held on 87 of 97 sessions of 2026-06~10 (the mean on 20).
  // Owner 2026-10-18: AI 투자 꺾임 gate — Nasdaq-100 or semis (SMH) lagging the S&P 500 over 20 sessions. SMH's 20-session
  // relative move swings ~3x the Nasdaq-100's (sd 8.2 vs 2.7pp, 2025-11~2026-10), so its edge is 8pp against the NDX's 3pp.
  // v58.68 (owner 2026-10-23): a session is a leaders' 급락일 when SMH closes 4% or more down, or the Nasdaq 100 2.5% or more
  // (10/22: SMH -6.0%, SOXX -6.8%, Nasdaq 100 -2.9%). It labels the day on the leadership line; it is not an axis.
  // The money-flow line (leadership-verdict.js buildMarketFlow) calls a session a move into defensives when the defensive
  // sector ETFs (XLP·XLU·XLV) beat the growth ones (XLK·XLC·SMH) by rotationGapPp or more and rose; broadSectorCount of the
  // eleven sectors moving one way is a market-wide day (10/22: defensives +2.2%, growth -3.6%, 6 of 11 up). A sector's
  // sub-themes split when one rose splitSidePct or more, another fell as much, and they are themeSplitPp apart (10/22:
  // regulated utilities +2.6% vs nuclear/independent power -5.4%).
  leadership: Object.freeze({ advanceRatioWeakBelow: 0.45, distributionDaysAt: 6, minConfirmations: 2, confirmWindowSessions: 5, aiLagNdx20dPp: 3, aiLagSemis20dPp: 8, shockSemis1dPct: 4, shockNdx1dPct: 2.5, rotationGapPp: 3, broadSectorCount: 9, splitSidePct: 1, themeSplitPp: 4 }),
  // v57.81: "회복 중" only when the last session did not give back reversalShare of the window's gain (a 5-day +8pp bounce
  // that lost 4pp on the last close is 되밀림, not recovery); a last-session drop of lastSessionNoticePp or more is named.
  // indexConfirmDeadZonePp: a 20-session participation change inside ±3pp is "거의 변하지 않음", not 넓어짐/줄어듦.
  // Owner 2026-10-18: holdExitAt — once a ratio fell under weakBelow, 부담 holds until the lower of the 50/200-day ratios is
  // back at 45% (latchSessions window), the hysteresis the trend, rates and credit axes already use.
  // Owner 2026-10-18: 바닥 확인 조건 (market-read bottomWatchOf) — F&G 25 is the CNN extreme-fear edge; new lows at half their
  // recent peak, a +20pp short-term participation rebound and a 2:1 4%-up thrust are conventions, not validated predictors.
  bottomWatch: Object.freeze({ fearAtMost: 25, newLowsWindow: 10, newLowsShrinkShare: 0.5, b20Window: 20, b20ReboundPp: 20, thrustRatio: 2 }),
  breadth: Object.freeze({ weakBelow: 40, broadAtLeast: 60, reversalShare: 0.5, lastSessionNoticePp: 3, indexConfirmDeadZonePp: 3, holdExitAt: 45, latchSessions: 60 }),
  // VIX 18 / 25 / 32: the calm / stress / high band edges (a convention, not a validated predictor; P1367 fixed them
  // and the regime-drift alert already compares these bands). VIX above its 3-month (ratio >= 1) is an inverted term structure.
  // v57.81: 양호 needs VIX at least calmBufferPt under the calm edge, or under the edge and not rising over five sessions;
  // a five-session rise of rise5dWatchPct or more holds it at 중립 (VIX 16.87 after +11.9% in a week read 양호, 1.1pt off 18).
  // v57.84 (macro threshold consolidation): complacentBelow — VIX under 14 beside extreme greed is the briefing's thin-hedging
  // reading (a low-volatility convention, not a validated predictor).
  volatility: Object.freeze({ calmBelow: 18, stressAt: 25, highAt: 32, calmRatioBelow: 0.95, invertedRatioAt: 1, spike5dPct: 25, calmBufferPt: 1, rise5dWatchPct: 10, complacentBelow: 14 }),
  // 10-year Treasury: a 25bp move in 20 sessions, or the top 10% of its one-year range while still rising.
  // v57.81 hysteresis: once 부담, it stays until the range position falls under rangeExitAt or the 20-session rise is
  // under exit20dBp (a 5-day dip of -9bp at 91% of the range flipped 부담 to 중립 and back on one week's sign).
  rates: Object.freeze({ move20dBp: 25, rangeHighAt: 0.9, rangeExitAt: 0.8, exit20dBp: 10, latchSessions: 60, levelHighThird: 2 / 3 }),
  // ICE BofA US High Yield OAS: below 350bp tight, 450bp+ stressed, +25bp in five sessions a fast widening;
  // +15bp in five sessions is the early-watch level (P1449: HY 324bp +44bp must read as widening
  // stress forming, not calm), and ≤5bp / five sessions counts as calm for the smallcap reading.
  // T05 (2026-10-13): +25bp over 20 sessions keeps the credit axis at 중립 at best (a month-long widening is not calm).
  // T10: total put/call 1.1+ is heavy hedging, below 0.7 call-heavy optimism (one table for the card and the axis).
  // v57.50 C16: one RSI reading for stock summary, screener, briefing and AI (screener entry filters may be stricter,
  // but they are labelled as a filter, not as "과열").
  // v57.84 (technical definitions): the periods and bands every chart, screener field and summary sentence reads, so a
  // stock cannot be "확장 4배" on the chart and something else in the screener (src/domain/technical/definitions.js).
  //   atrPeriod/adrPeriod: Wilder ATR(14) and the average daily range (high − low) ÷ that day's close over 20 sessions;
  //   rangeSessions: the 52-week window is the last 252 sessions; fullYearSessions: a record counts as a full year from 240
  //   sessions — one calendar year is 251 US / 245 KR sessions and the producers fetch exactly one year (Yahoo range=1y),
  //   so a 252 floor was never met and nulled every 52-week figure (v57.86); a listing under ~11.5 months stays labelled by
  //   its length (P1428);
  //   nearHighPct: an index or stock within 3% of its 52-week high is 고점권 (briefing and daily diff);
  //   extension: distance to the 50-day line in ADRs — 2 near the base, 4 extended, 7 stretched (setup-profile, v57.50 C20);
  //   nearLineAdr/recentDropAdr: within 1 ADR of the 50-day line is 부근; a five-session fall beyond 2 ADRs is 단기 급락;
  //   ema8: 10% over the 8-day EMA is 과열권, 5% under it a break below the line; overheatAdr (expertise review 2026-10-19):
  //   a quiet stock is stretched well before +10%, so 4 average daily ranges over the line is 과열권 as well;
  //   weinstein: 30-week average, its 4-week slope, flat inside ±1%, and 26 weeks back to tell a base from a top;
  //   template: Minervini's published 52-week rules (within 25% of the high, 30% above the low); stage2Gate: the screener's
  //   own looser moving-average gate (within 30% of the high) — a separate, separately named test;
  //   breakout: the breakout day shared by the chart and the screener's VCP (technical/definitions.js isBreakoutDay).
  technical: Object.freeze({ rsi: Object.freeze({ overbought: 70, oversold: 30, climax: 80 }),
    atrPeriod: 14, adrPeriod: 20, rangeSessions: 252, fullYearSessions: 240, nearHighPct: 3,
    extension: Object.freeze({ nearBase: 2, extended: 4, stretched: 7 }), nearLineAdr: 1, recentDropAdr: 2,
    ema8: Object.freeze({ overheatPct: 10, overheatAdr: 4, breakBelowPct: 5 }),
    weinstein: Object.freeze({ maWeeks: 30, slopeWeeks: 4, flatSlopePct: 1, priorWeeks: 26 }),
    template: Object.freeze({ nearHighPct: 25, aboveLowPct: 30 }), stage2Gate: Object.freeze({ nearHighPct: 30 }),
    // Audit 2026-10-17 (owner D6): one breakout day for the chart, the screener and the legacy snapshot — O'Neil's close above
    // the pivot, no more than maxAbovePct over it, up from the prior close, on volume ≥ volumeMultiple × the prior
    // volumeSessions average (the day excluded). The chart used a 50-day average that included the day; the screener a
    // 20-day one, no ceiling, and an upper-half-of-range day counted as up.
    breakout: Object.freeze({ volumeMultiple: 1.4, volumeSessions: 50, maxAbovePct: 5 }),
    // v57.87 (owner X-bookmark read 2026-10-16): stock-level follow-through evidence (technical/follow-through.js).
    // Pocket pivot: an up close whose volume beats every down-close volume of the prior 10 sessions (Morales/Kacher).
    // Heavy down day: a close ≥ heavyDownPct (1%) lower on volume above the stock's own heavyDownAvgSessions (50) average
    // (v57.88; the index distribution-day rule of 0.2% on more volume than the prior session is too loose for one stock).
    // Base: a pullback of ≥ basePullbackPct from a closing high lasting ≥ baseMinSessions, completed by a close above that
    // high; the count restarts after a drawdown of resetDrawdownPct or a new 52-week closing low. Climax checks apply only
    // after a run of climaxMinRunPct from the 52-week low. Down-day resilience: index down closes in the last 60 sessions.
    followThrough: Object.freeze({ pocketWindow: 10, heavyDownPct: 1, heavyDownAvgSessions: 50, heavyDownWindow: 25, basePullbackPct: 8, baseMinSessions: 15,
      resetDrawdownPct: 35, climaxMinRunPct: 70, climaxUpDays: 8, climaxStretch200Pct: 70, resilienceWindow: 60, resilienceMinDays: 8 }) }),
  // v57.81: a 20-session widening reaches 부담 when it is in the top stress20dPct of the series' own 20-session changes (or
  // stress20dMultiple x widen20dBp when the record is shorter than recordMin); it stays 부담 until the 20-session change
  // is back under widen20dBp (hysteresis). HY +40bp in 20 sessions — the 96th percentile — could never reach 부담 before.
  credit: Object.freeze({ tightBelowBp: 350, stressAtBp: 450, widen5dBp: 25, widenWatch5dBp: 15, calm5dBp: 5, widen20dBp: 25, putCallHedgeAt: 1.1, putCallOptimismBelow: 0.7,
    stress20dPct: 90, stress20dMultiple: 2, recordMin: 120, latchSessions: 60 }),
  // WTI against its own one-year range (P1394) and 20-session change; the dollar index 20-session change.
  // v57.84: aboveYearAvgPct — WTI 25% above its one-year average is the second 유가 급등 test of the 거시 branches; turn5dPct — a
  // five-session WTI move this large against the 20-session direction is named beside it (시장 axis and 거시 headline).
  oil: Object.freeze({ rise20dPct: 10, fall20dPct: -5, rangeHighAt: 0.85, aboveYearAvgPct: 25, turn5dPct: 3 }),
  // v57.81: a dollar rise counts as 부담 only bufferPct past rise20dPct, or past rise20dPct with the dollar index in the top
  // of its own one-year range (rangeHighAt) — DXY +2.23% against a 2.0% line read 부담 on 0.23pp.
  dollar: Object.freeze({ rise20dPct: 2, fall20dPct: -2, bufferPct: 0.5, rangeHighAt: 0.8 }),
  // Won 20-session move; a yen rally of 3%+ in 20 sessions preceded the August 2024 carry unwind.
  // v57.81: a won move counts only when the 20-session change and the shift of the 20-session mean agree (meanShareOfBar of
  // the bar, same sign) — an endpoint on a one-day spike (9/17 1376.6) made a flat won read -2.5%. A KOSPI fall of
  // kospiContradict20dPct or more over 20 sessions (or a rare KOSPI day) holds a won-strength reading at 중립 (혼조).
  // v57.84: krwFlatPct — a won move inside ±0.5% is 보합권 on every window (20-session card, 5-session sentence, the last session
  // that holds a won-strength verdict at 중립).
  fx: Object.freeze({ krwMove20dPct: 2, yenRally20dPct: 3, meanShareOfBar: 0.5, kospiContradict20dPct: 5, krwFlatPct: 0.5 }),
  // v57.81: a Fear & Greed move of namedMovePt or more over one or five sessions is always named beside the 20-session read.
  sentiment: Object.freeze({ namedMovePt: 10 }),
  // Breakeven (10Y inflation compensation) weekly move used as the chain's inflation-expectation link.
  breakeven: Object.freeze({ move5dBp: 5 }),
  // Sahm (2019): 3-month average unemployment 0.5pp above its prior 12-month low; 0.3 an early watch level.
  // v57.84: payrollSlowdownK is a step (3-month average this far under the prior 3 months = 둔화, the quadrant); payrollStallK is
  // a level (3-month average under 25k = 고용 급랭 condition) — one number had served both meanings. Initial claims (4-week
  // average) above their one-year low: claimsWatchAbovePct a watch level, claimsRiseAbovePct a clear rise (Sahm-style pair).
  growth: Object.freeze({ sahmRecessionAt: 0.5, sahmWatchAt: 0.3, payrollSolidK: 100, payrollSlowdownK: 25, payrollStallK: 25, claimsWatchAbovePct: 10, claimsRiseAbovePct: 15 }),
  // FOMC longer-run goal: 2% PCE inflation; core PCE 3% a clear miss; a 3-month pace 0.5pp above the year re-accelerating.
  inflation: Object.freeze({ targetPct: 2, nearTargetPct: 2.5, missPct: 3, reaccelPp: 0.5 }),
  // 2-year yield vs the policy midpoint: ±0.25pp is a heuristic band of one 25bp step. The 2-year also carries a term premium
  // and averages two years of expected policy, so it is a direction proxy, not a fed-funds-futures count of priced moves
  // (v57.84 review). FOMC longer-run 3.0% less 2% ≈ 1% neutral real rate.
  policy: Object.freeze({ pricedMovePp: 0.25, neutralRealPct: 1, restrictiveRealPct: 2 }),
  // Macro audit 2026-10-17: the lines of the briefing's 오늘 종가 해석 sentences (market-read buildMarketRead). They decide only
  // whether a sentence is written and its weight — no axis state reads them — and moved here unchanged from literals in that
  // function, so every number a briefing sentence tests sits in this one table. Audit D6 (owner 2026-10-17): the oil-and-rates
  // sentence uses the axes' own lines (oil.rise20dPct, rates.move20dBp) instead of the lower 8% / 15bp it had, so the
  // sentence and the axes never disagree on whether oil and rates rose together. The index-defended line (45%) equals
  // leadership.advanceRatioWeakBelow but is kept as its own key.
  briefing: Object.freeze({ rateMove5dBp: 8, stocksDown5dPct: 1, yearExtremeAt: 0.95, curveMove5dBp: 8, dollarSoft5dPct: 0.3,
    broadWeakBelow: 30, newLowsMin: 10, newHighsMin: 20, highsOverLows: 3, techGap20dPp: 2, smallcapGap20dPp: 3,
    derisk1dPct: 0.8, deriskAdvanceBelow: 30, defendedAdvanceBelow: 45, goldDollar5dPct: 0.5, havenDollar5dPct: 1, havenGold20dPct: 3,
    goldFall20dPct: 3, goldRates20dBp: 10, krGap5dPp: 2, krGap1dPp: 1.5, krTailPct: 10 }),
  // Audit D8 (owner 2026-10-17): every "large move" the briefing pipeline tests, gathered in one table with the values
  // unchanged. attribution* — the validator asks for a cause headline (S&P 500/Nasdaq vs KOSPI, 1-session % change);
  // priorSession* — the packet names the last completed close; dailyDiff* — 어제와 달라진 점 lists a move; watchDayPct
  // — a watch-list name gets the strong attention mark. The equity 1% sits near a one-in-four day for the S&P 500,
  // 3% about one in fifty; retune here, not at the call sites.
  largeMove: Object.freeze({ attributionUsPct: 1, attributionKospiPct: 3, priorSession1dPct: 3, priorSession5dPct: 8,
    dailyDiffIndexPct: 1, dailyDiffVixPt: 2, dailyDiffTnxBp: 8, dailyDiffBreadthPp: 5, dailyDiffOtherPct: 1.5, watchDayPct: 3 }),
  // CNN Fear & Greed integer bands: extreme fear 0-24, fear 25-44, neutral 45-55, greed 56-75, extreme greed 76-100
  // (as reproduced from CNN Business by https://www.nerdwallet.com/article/investing/what-is-the-fear-and-greed-index;
  // the index is published as a whole number, so a reading is rounded before it is banded).
  fearGreed: Object.freeze({ extremeFearBelow: 25, fearBelow: 45, greedAbove: 55, extremeGreedAbove: 75 })
});
