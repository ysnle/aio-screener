// The holding-level technical risk read — moved from js/aio-core.js calcSellPressure,
// calcPositionTechnicalRisk and calcPortfolioTechnicalRisk. The concentration tier is concentration.js's
// concentrationPenaltyForWeight (P758), the technical input is technical/snapshot.js. The holding-level read is the
// legacy one, pinned by architecture/fixtures/technical-snapshot-golden.json; the book-level read is value-weighted
// over the scored positions (below). The 포트폴리오 panel (js/aio-ui.js
// renderPortfolioTechnicalRisk) shows the action as a load level, not an instruction.
// The legacy names calcSellPressure / calcPositionTechnicalRisk / calcPortfolioTechnicalRisk are installed from here by
// src/app/legacy-screen-bridges.js.
import { technicalSnapshot } from '../technical/snapshot.js';
import { concentrationPenaltyForWeight } from './concentration.js';
import { readNumber } from '../shared/number.js';

// readNumber is the strict read the legacy shell used (_aioStrictFinite): booleans, blanks and non-numbers are unknown.
const finite = readNumber;
const isSnapshot = (value) => !!value && value.ok !== undefined;
const actionFor = (score) => (score >= 75 ? 'EXIT_OR_HEDGE' : score >= 58 ? 'TRIM_50' : score >= 38 ? 'TRIM_25_33' : score >= 18 ? 'NO_ADD_RAISE_STOP' : 'HOLD_CORE');
const upperTicker = (position) => (position.ticker || position.symbol || '').toString().toUpperCase();
// A weight needs today's value, not a live tick: a decision-grade quote, or the value the valuation screen shows from a
// completed close or a delayed quote (surface.js sourceKind, passed as valueSource). A stored or cached price is neither.
const VALUE_SOURCES = ['live-quote', 'completed-close', 'delayed-reference-quote'];
const exposureAdmitted = (p) => !!p && (p.currentQuoteAllowedUse === true || p.allowedUse === 'decision'
  || p.quoteSourceKind === 'live-quote' || p.priceSource === 'live-quote' || VALUE_SOURCES.includes(p.valueSource));
// Positions under this share of the book's value leave the book-level read on hold.
export const TECHNICAL_RISK_MIN_COVERAGE_PCT = 80;

export function sellPressure(ohlcvOrSnapshot, context = {}) {
  context = context || {};
  const snapshot = isSnapshot(ohlcvOrSnapshot) ? ohlcvOrSnapshot : technicalSnapshot(ohlcvOrSnapshot);
  const flags = [];
  let score = 0;
  const add = (points, flag) => { score += points; flags.push(flag); };
  if (!snapshot || !snapshot.ok) return { score: null, action: 'WAIT', flags: ['DATA_INSUFFICIENT'], snapshot };
  const dist50Adr = snapshot.dist50Pct != null && snapshot.adr20Pct > 0 ? snapshot.dist50Pct / snapshot.adr20Pct : null; // RULES.technical.extension ADR bands
  if (dist50Adr !== null && dist50Adr >= 4) add(24, 'DIST_50SMA_EXTENDED_4ADR');
  if (dist50Adr !== null && dist50Adr >= 7) add(20, 'DIST_50SMA_STRETCHED_7ADR');
  if (snapshot.dist21Atr !== null && snapshot.dist21Atr >= 2.5) add(10, 'DIST_21EMA_PLUS_2_5ATR_SHORT_TERM_EXTENSION');
  if (snapshot.rsi14 !== null && snapshot.rsi14 >= 80) add(8, 'RSI_80_OVERHEAT_NOT_AUTO_SELL');
  if (snapshot.rsi14 !== null && snapshot.rsi14 >= 85) add(10, 'RSI_85_EXTREME_OVERHEAT');
  if (snapshot.dayGainPct >= 6 && snapshot.rvol20 !== null && snapshot.rvol20 >= 2.5 && snapshot.closePosition !== null && snapshot.closePosition < 0.5) add(25, 'CLIMAX_REVERSAL_RISK_DAY_GAIN_RVOL_WEAK_CLOSE');
  if (snapshot.bbReentry) add(15, 'UPPER_BOLLINGER_REENTRY_EXHAUSTION');
  if (snapshot.above10EMA === false) add(14, 'CLOSE_BELOW_10EMA_TRIM_TRADING_LOT');
  if (snapshot.above21EMA === false) add(18, 'CLOSE_BELOW_21EMA_REDUCE_SWING_LOT');
  if (snapshot.above50SMA === false) add(28, 'CLOSE_BELOW_50SMA_SWING_THESIS_DAMAGED');
  if (context.semiHeat && context.semiHeat.state === 'SEMI_HEATED') add(6, 'SEMI_HEATED_CONTEXT');
  if (context.semiHeat && context.semiHeat.state === 'SEMI_MANIA') add(12, 'SEMI_MANIA_CONTEXT');
  if (context.lockoutAction && context.lockoutAction.score >= 35) add(Math.min(18, Math.round(context.lockoutAction.score / 4)), `LOCKOUT_ACTION_${context.lockoutAction.action}`);
  if (context.blowoffTop && context.blowoffTop.score >= 25) add(Math.min(18, Math.round(context.blowoffTop.score / 4)), `BLOWOFF_TOP_${context.blowoffTop.action}`);
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, action: actionFor(score), flags: flags.length ? flags : ['TREND_HEALTHY_NO_EXIT_SIGNAL'], snapshot };
}

export function positionTechnicalRisk(position = {}, ohlcvOrSnapshot = null, portfolioContext = {}) {
  position = position || {};
  portfolioContext = portfolioContext || {};
  const snapshot = isSnapshot(ohlcvOrSnapshot) ? ohlcvOrSnapshot : technicalSnapshot(ohlcvOrSnapshot || []);
  const qty = finite(position.qty != null ? position.qty : position.shares);
  const cost = finite(position.cost != null ? position.cost : position.avgCost);
  const quoteAllowed = exposureAdmitted(position);
  let px = quoteAllowed ? finite(position.price) : null;
  if (px == null && quoteAllowed) px = finite(position.currentPrice);
  const referencePx = px != null ? px : (snapshot && snapshot.ok === true ? finite(snapshot.price) : null); // reference close for P&L only, never exposure or weight
  const hasTechnicalSnapshot = !!(snapshot && snapshot.ok === true);
  const totalValue = finite(portfolioContext.totalValue);
  // The caller's base-currency value wins over qty × price; still only behind an admitted price (exposureAdmitted).
  const value = px != null && px > 0 && finite(position.value) != null && finite(position.value) > 0 ? finite(position.value) : qty != null && qty >= 0 && px != null && px > 0 ? qty * px : null;
  const weightPct = value != null && totalValue != null && totalValue > 0 ? (value / totalValue) * 100 : null;
  const pnlPct = cost != null && cost > 0 && referencePx != null && referencePx > 0 ? ((referencePx - cost) / cost) * 100 : null;
  const ticker = upperTicker(position);
  // Cost basis is historical context only: it never stands in for a missing quote, exposure or portfolio denominator.
  if (!hasTechnicalSnapshot || value == null || totalValue == null || totalValue <= 0 || weightPct == null) {
    return {
      ticker, score: null, action: 'WAIT', state: 'DATA_INSUFFICIENT', weightPct: null,
      pnlPct, value: null, snapshot,
      sellPressure: { score: null, action: 'WAIT', flags: ['DATA_INSUFFICIENT'], snapshot },
      flags: ['DATA_INSUFFICIENT'], dataQuality: position.dataQuality || null,
      reason: !hasTechnicalSnapshot ? 'current technical snapshot unavailable' : !value ? 'current quote/exposure unavailable' : 'portfolio total value unavailable'
    };
  }
  const pressure = sellPressure(snapshot, portfolioContext);
  const concentrationPenalty = concentrationPenaltyForWeight(weightPct);
  const score = pressure && finite(pressure.score) != null ? Math.max(0, Math.min(100, Math.round(pressure.score + concentrationPenalty))) : null;
  if (score == null) return { ticker, score: null, action: 'WAIT', state: 'DATA_INSUFFICIENT', weightPct, pnlPct, value, snapshot, sellPressure: pressure, flags: ['DATA_INSUFFICIENT'], dataQuality: position.dataQuality || null };
  const flags = (pressure.flags || []).slice();
  if (concentrationPenalty) flags.push(`POSITION_CONCENTRATION_${Math.round(weightPct)}PCT`);
  return { ticker, score, action: actionFor(score), state: 'CURRENT', weightPct, pnlPct, value, snapshot, sellPressure: pressure, flags, dataQuality: position.dataQuality || null };
}

export function portfolioTechnicalRisk(positions = [], riskItems = [], context = {}) {
  positions = positions || [];
  riskItems = riskItems || [];
  context = context || {};
  if (!positions.length) return { state: 'EMPTY', heatScore: null, action: 'WAIT', items: [] };
  const explicitTotal = finite(context.totalValue);
  const positionValues = positions.map((p) => {
    const quoteAllowed = exposureAdmitted(p);
    const declared = quoteAllowed ? finite(p && p.value) : null;
    if (declared != null && declared >= 0) return declared;
    const qty = finite(p && (p.qty != null ? p.qty : p.shares));
    const price = quoteAllowed ? finite(p && (p.price != null ? p.price : p.currentPrice)) : null;
    return qty != null && qty >= 0 && price != null && price > 0 ? qty * price : null;
  });
  const totalValue = explicitTotal != null ? explicitTotal : (positionValues.every((v) => v != null) ? positionValues.reduce((s, v) => s + v, 0) : null);
  const items = (riskItems.length ? riskItems : positions).map((item) => (item && item.action && item.score !== undefined ? item : positionTechnicalRisk(item, item && item.snapshot, { totalValue })));
  // The book-level read counts each scored position by its share of the book's value, and says how much of the book
  // that is (coveragePct). The legacy read needed one item per position (so a book scored on its 12 largest of 13 was
  // always held), averaged the scores with equal weights and took the plain maximum — a 1% position scoring 90 beside
  // 50% and 49% positions scoring 0 read 'TRIM_50'. The largest-score term now counts a position in full from the
  // equal-weight share (100 / positions) up and in proportion below it.
  const scored = items.filter((i) => i && i.state !== 'DATA_INSUFFICIENT' && finite(i.score) != null && finite(i.weightPct) != null);
  const coveragePct = scored.reduce((s, i) => s + finite(i.weightPct), 0);
  if (!(totalValue > 0) || !scored.length || coveragePct < TECHNICAL_RISK_MIN_COVERAGE_PCT) {
    return { state: 'DATA_INSUFFICIENT', heatScore: null, action: 'WAIT', items, totalValue, topWeightPct: null, avgSellPressure: null, maxSellPressure: null, coveragePct: totalValue > 0 ? coveragePct : null, reason: 'current position exposure or technical evidence unavailable' };
  }
  const equalShare = 100 / positions.length;
  const avg = scored.reduce((s, i) => s + finite(i.score) * finite(i.weightPct), 0) / coveragePct;
  const max = Math.max(...scored.map((i) => finite(i.score) * Math.min(1, finite(i.weightPct) / equalShare)));
  const topWeight = Math.max(...scored.map((i) => finite(i.weightPct)));
  const heatScore = Math.max(0, Math.min(100, Math.round(avg * 0.45 + max * 0.35 + Math.min(100, topWeight * 2) * 0.20)));
  const state = heatScore >= 75 ? 'PORTFOLIO_HEAT_EXTREME' : heatScore >= 58 ? 'PORTFOLIO_HEAT_HIGH' : heatScore >= 38 ? 'PORTFOLIO_HEAT_ELEVATED' : 'PORTFOLIO_HEAT_NORMAL';
  return { state, heatScore, action: actionFor(heatScore), items, totalValue, topWeightPct: topWeight, avgSellPressure: avg, maxSellPressure: max, coveragePct };
}
