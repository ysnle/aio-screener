export const RULES = Object.freeze({
  trend: Object.freeze({ maShort: 50, maLong: 200, slopeLookback: 20, bufferPct: 1, holdAbovePct: 0, latchSessions: 60 }),
  rallyAttempt: Object.freeze({ correctionPct: 6, lookbackSessions: 63, minDay: 4, gainPct: 1.25, leaderWindowSessions: 15 }),
  leadership: Object.freeze({ advanceRatioWeakBelow: 0.45, distributionDaysAt: 6, minConfirmations: 2, confirmWindowSessions: 5, proxyDrop5dPct: 6, proxyBufferPct: 2, semisLagRsp5dPp: 7, aiLagSemis20dPp: 10, shockSemis1dPct: 4.5, shockNdx1dPct: 2.5, rotationGapPp: 3, broadSectorCount: 9, splitSidePct: 1, themeSplitPp: 4 }),
  bottomWatch: Object.freeze({ fearAtMost: 25, newLowsWindow: 10, newLowsShrinkShare: 0.5, b20Window: 20, b20ReboundPp: 20, thrustRatio: 2 }),
  breadth: Object.freeze({ weakBelow: 40, broadAtLeast: 60, holdExitAt: 45, latchSessions: 60, speedSessions: 5, speedMultiple: 2, speedRecordMin: 60 }),
  // 시장 상태 '추세와 시장 폭' pair: the share of S&P 500 members above their 50-day line reads broad at or above
  // broadAbovePct and narrow under narrowBelowPct; between them it is the middle reading.
  breadthCross: Object.freeze({ broadAbovePct: 55, narrowBelowPct: 45 }),
  // A count's place in the site's own record (분배일): 많은 편 at or above manyAtPct, 적은 편 at or below fewAtPct, else 중간쯤.
  recordRank: Object.freeze({ manyAtPct: 60, fewAtPct: 40 }),
  volatility: Object.freeze({ calmBelow: 18, stressAt: 25, highAt: 32, calmRatioBelow: 0.95, invertedRatioAt: 1, spike5dPct: 25, spikeFloor: 20, latchSessions: 60, calmBufferPt: 1, rise5dWatchPct: 10, complacentBelow: 14 }),
  rates: Object.freeze({ move20dBp: 25, rangeHighAt: 0.9, rangeExitAt: 0.8, exit20dBp: 10, latchSessions: 60, shock5dPct: 95, shock5dMinBp: 15, shock5dExitBp: 10, recordMin: 120, levelHighThird: 2 / 3, growthScareSpx20dPct: -3, splitMoveMinBp: 5, splitLeadRatio: 1.5 }),
  technical: Object.freeze({ rsi: Object.freeze({ overbought: 70, oversold: 30, climax: 80 }),
    atrPeriod: 14, adrPeriod: 20, rangeSessions: 252, fullYearSessions: 240, nearHighPct: 3,
    extension: Object.freeze({ nearBase: 2, extended: 4, stretched: 7 }), nearLineAdr: 1, recentDropAdr: 2,
    ema8: Object.freeze({ overheatPct: 10, overheatAdr: 4, breakBelowPct: 5 }),
    weinstein: Object.freeze({ maWeeks: 30, slopeWeeks: 4, flatSlopePct: 1, priorWeeks: 26 }),
    template: Object.freeze({ nearHighPct: 25, aboveLowPct: 30 }), stage2Gate: Object.freeze({ nearHighPct: 30 }),
    breakout: Object.freeze({ volumeMultiple: 1.4, volumeSessions: 50, maxAbovePct: 5, crossSessions: 5 }),
    followThrough: Object.freeze({ pocketWindow: 10, heavyDownPct: 1, heavyDownAvgSessions: 50, heavyDownWindow: 25, basePullbackPct: 8, baseMinSessions: 15,
      resetDrawdownPct: 35, climaxMinRunPct: 70, climaxUpDays: 8, climaxStretch200Pct: 70, resilienceWindow: 60, resilienceMinDays: 8 }) }),
  rankingPopulation: Object.freeze({ pinned: Object.freeze({ volAtMost: 8, adrPctAtMost: 1 }) }),
  credit: Object.freeze({ tightBelowBp: 350, stressAtBp: 450, widen5dBp: 25, widenWatch5dBp: 15, calm5dBp: 5, widen20dBp: 25,
    stress20dPct: 90, stress20dMultiple: 2, recordMin: 120, latchSessions: 60,
    dispersionSessions: 60, widen60dBp: 50, cccGap60dBp: 150 }),
  oil: Object.freeze({ rise20dPct: 10, fall20dPct: -5, rangeHighAt: 0.85, aboveYearAvgPct: 25, turn5dPct: 3 }),
  dollar: Object.freeze({ rise20dPct: 2, fall20dPct: -2, bufferPct: 0.5, rangeHighAt: 0.8 }),
  commodities: Object.freeze({ latchSessions: 60, oilExit20dPct: 5, oilRangeExitAt: 0.75, dollarExit20dPct: 1.5, edgeSessions: 1 }),
  crossAsset: Object.freeze({ window: 20, oil20dPct: 5, rate20dBp: 10, stock20dPct: 1, bond20dPct: 1, gold20dPct: 2, dollar20dPct: 1, vixRise20dPct: 15, semisLeadPp: 5 }),
  fx: Object.freeze({ krwMove20dPct: 2, yenRally20dPct: 3, meanShareOfBar: 0.5, kospiContradict20dPct: 5, krwFlatPct: 0.5 }),
  sentiment: Object.freeze({ fearRankAtOrBelow: 20, greedRankAtOrAbove: 80 }),
  // Breakeven (10Y inflation compensation) weekly move used as the chain's inflation-expectation link.
  breakeven: Object.freeze({ move5dBp: 5 }),
  growth: Object.freeze({ sahmRecessionAt: 0.5, sahmWatchAt: 0.3, payrollSolidK: 100, retailRealYoyPct: 1 /* after prices; the former nominal 3% line passed on inflation alone */, payrollSlowdownK: 25, payrollStallK: 25, claimsWatchAbovePct: 10, claimsRiseAbovePct: 15 }),
  // One month's payroll print (thousands), the release bands and the scenario triggers: under cold 급랭, under slow 둔화,
  // from hot 과열. A single print is noisier than the 3-month average, so these are not the growth lines above
  // (payrollSolidK, payrollStallK), which read the average.
  payrollPrintK: Object.freeze({ cold: 50, slow: 75, hot: 200 }),
  // reboundPct: a Nasdaq-100 close this far over its lowest close since the high is a rebound (rebound.js), half the
  // correction line; 76 of its 79 one-day gains of 5%+ since 1985 came inside a fall of 10%+.
  story: Object.freeze({ correctionPct: 10, bearPct: 20, bearEdgePp: 1, unwindGapPp: 5, broadBelowPct: 30, halfOffPct: 50, reboundPct: 5 }),
  // The rebound's cross-market checks (rebound-quality.js): the share of known checks met that reads 다른 시장도 확인
  // (3 of 4) or 엇갈림 (2 of 4), below it 지수만 반등; under minKnown known checks no word is given.
  reboundQuality: Object.freeze({ confirmShare: 0.75, mixedShare: 0.5, minKnown: 3 }),
  // The opening's cross-market rows (cross-market.js): each level beside its change over shortSessions (longSessions for the
  // dollar, whose rule reads 20 sessions); the 2-year's gap to the target midpoint is compared with the observation
  // pathLookbackDays calendar days earlier and reads as moving once it changed pathMoveBp.
  crossMarket: Object.freeze({ shortSessions: 5, longSessions: 20, pathLookbackDays: 30, pathMoveBp: 10 }),
  // The session read (session-read.js): a Nasdaq-100 session of movePct names where it gathered; leaders leadGapPp past the
  // equal weight read as leading; a rebound's give-back is said from giveBackMinShare once one index gave back giveBackShare
  // (% of the gain from the low to the highest close since); an after-hours extreme of afterHoursSwingPct that the last print left by afterHoursFadePp is said beside it; a theme's sub-theme is named when its median went partGapPp further the same way; the S&P 500 sector split is said when splitCoverage% of the index had a return and its sum is within splitGapPp of the index's move, naming up to splitAgainstMax sectors of splitAgainstWeight% weight that went splitAgainstPct the other way; list sizes and the
  // ledger ranks a theme group needs.
  // Per-stock daily returns the screener publishes (`rets`, oldest first) and the members a sub-theme median needs
  // before a "since the low" comparison names the group (src/domain/market/day/recent-returns.js).
  recentReturns: Object.freeze({ sessions: 20, groupMinMembers: 3 }),
  // Since a rebound's low: a theme's best and worst sub-themes are named when gapPp apart; namesMax of its most material stocks.
  reboundSpread: Object.freeze({ gapPp: 3, namesMax: 4 }),
  sessionRead: Object.freeze({ movePct: 1, leadGapPp: 1, giveBackShare: 50, giveBackMinShare: 25, groupsMax: 3, namesMax: 4, afterHoursMax: 3, afterHoursSwingPct: 3, afterHoursFadePp: 2, partGapPp: 1, splitCoverage: 95, splitGapPp: 0.2, splitAgainstPct: 0.5, splitAgainstWeight: 2, splitAgainstMax: 3, ranks: Object.freeze(['lead', 'major']) }),
  inflation: Object.freeze({ targetPct: 2, nearTargetPct: 2.5, missPct: 3, reaccelPp: 0.5, holdPp: 0.25, latchMonths: 6, edgePp: 0.1 }),
  policy: Object.freeze({ pricedMovePp: 0.25, neutralRealPct: 1, restrictiveRealPct: 2 }),
  briefing: Object.freeze({ rateMove5dBp: 8, stocksDown5dPct: 1, yearExtremeAt: 0.95, curveMove5dBp: 8, dollarSoft5dPct: 0.3,
    broadWeakBelow: 30, newLowsMin: 10, newHighsMin: 20, highsOverLows: 3, techGap20dPp: 2, smallcapGap20dPp: 3,
    derisk1dPct: 0.8, deriskAdvanceBelow: 30, defendedAdvanceBelow: 45, goldDollar5dPct: 0.5, havenDollar5dPct: 1, havenGold20dPct: 3,
    goldFall20dPct: 3, goldRates20dBp: 10, krGap5dPp: 2, krGap1dPp: 1.5, krTailPct: 10, krSeparate5dPct: 5,
    verdictDayAgainstPct: 0.5 }), // an S&P 500 session this size against the verdict's side gets the verdict's horizon named beside it
  largeMove: Object.freeze({ attributionUsPct: 1, attributionKospiPct: 3, priorSession1dPct: 3, priorSession5dPct: 8,
    dailyDiffIndexPct: 1, dailyDiffVixPt: 2, dailyDiffTnxBp: 8, dailyDiffBreadthPp: 5, dailyDiffOtherPct: 1.5, watchDayPct: 3 }),
  // How material a price move is, against its own volatility — the market-day ledger's scale
  // (src/domain/market/day/facts.js priceMove/priceMateriality; values unchanged from its literals). z = the last session's
  // step / the sd of the sdSessions steps before it (minSteps needed); the weekSessions leg is the cumulative change over
  // sd·√weekSessions and counts while the last step goes the same way (10년물 +29bp in five sessions read minor 23 on a
  // +5bp day). points = the larger |z| × pointsPerSd, core gauges in full and the rest × secondaryShare; tiers lead/major/
  // minor (below minor = context); unusualZ marks an unusual session. One table for every reader that ranks a move by size.
  moveMateriality: Object.freeze({ sdSessions: 60, minSteps: 10, weekSessions: 5, pointsPerSd: 25, secondaryShare: 0.7, unusualZ: 2,
    tiers: Object.freeze({ lead: 60, major: 35, minor: 15 }),
    coreGauges: Object.freeze(['spx', 'ndx', 'soxx', 'kospi', 'tnx', 'dxy', 'wti', 'gold', 'hyOas', 'vix']) }),
  marketReading: Object.freeze({ inSessionZ: 0.75, inSessionWtiPct: 2, retainHours: 12, retainDriftOtherPct: 3 }),
  // The market investigation (scripts/producer/market-investigation.mjs). A lead is a ledger move at the ledger's own lead
  // tier (moveMateriality.tiers.lead, sized against its own volatility) or a rule word that changed since the previous
  // session; at most maxLeads per kind group and in all. One investigation per lead set: at most maxRounds tool rounds,
  // maxFunctionCalls data calls and maxRequests requests (repair included). monthlyBudgetUsd is a hard stop for this
  // lane; runReserveUsd is what one run may spend at worst, so a run that could pass the budget does not start.
  investigation: Object.freeze({ maxLeads: 5, maxPriceLeads: 3, maxStockLeads: 2, maxGroupLeads: 1, maxRounds: 4, maxFunctionCalls: 10,
    maxRequests: 6, monthlyBudgetUsd: 6, runReserveUsd: 0.3, providerAttempts: 3 }),
  portfolio: Object.freeze({ holdingPct: Object.freeze([10, 15, 25]),
    sectorNear: 25, sectorOver: 40, top3Over: 60, corrOver: 0.7, currencyMax: 0.5 }),
  fearGreed: Object.freeze({ extremeFearBelow: 25, fearBelow: 45, greedAbove: 55, extremeGreedAbove: 75 }),
  pricedIn: Object.freeze({ farFromHighPct: -35, nearHighPct: -10, richPe: 28, smallGrowthPct: 10 })
});
