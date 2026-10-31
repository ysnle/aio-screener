// v58.75 (owner decision 2026-10-24): the price-level map and the plan check. The app never proposes an entry, stop or
// target; it lists the levels the published methods use (swing points, moving averages, volume zones, the 52-week range,
// the pivot and contraction low, unfilled gaps) and checks a plan the user typed against them. Pure functions on
// completed daily bars — no DOM, no network.
import { smaSeries, emaSeries, atrWilder, adrPctOf, rangeExtremesOf, detectContractions } from './definitions.js';
import { buildVolumeByPrice } from './chart-scenarios.js';
import { finiteNumber as finite } from '../shared/number.js';


export const PRICE_LEVEL_RULES = Object.freeze({
  swingSpan: 5, // a swing high (low) is the highest high (lowest low) of 5 bars on each side
  lookback: 252, // swing points, gaps and reactions are read over the last year of bars
  mergeAdr: 0.5, // levels within half an average daily range of each other are one zone
  touchAdr: 0.25, // a bar "reaches" a zone when its high/low comes within a quarter ADR of it
  maxPerSide: 5,
  minGapPct: 0.3 // gaps smaller than 0.3% of price are noise
});

// Swing points confirmed by `span` bars on each side (the newest `span` bars cannot be confirmed yet).
export function swingPoints(bars, from, span) {
  const highs = [], lows = [];
  for (let i = Math.max(from, span); i < bars.length - span; i++) {
    let isHigh = true, isLow = true;
    for (let k = i - span; k <= i + span; k++) {
      if (k === i) continue;
      if (bars[k].high >= bars[i].high) isHigh = false;
      if (bars[k].low <= bars[i].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }
  return { highs, lows };
}

// Gaps whose range no later bar has traded back through. A partly filled gap keeps its untraded part.
function unfilledGaps(bars, from, minGapPct) {
  const gaps = [];
  for (let i = Math.max(1, from); i < bars.length; i++) {
    const prev = bars[i - 1], bar = bars[i];
    if (bar.low > prev.high) {
      let top = bar.low;
      for (let k = i + 1; k < bars.length && top > prev.high; k++) top = Math.min(top, bars[k].low);
      if (top > prev.high && (top - prev.high) / prev.high * 100 >= minGapPct) gaps.push({ low: prev.high, high: top, index: i, direction: 'up' });
    } else if (bar.high < prev.low) {
      let bottom = bar.high;
      for (let k = i + 1; k < bars.length && bottom < prev.low; k++) bottom = Math.max(bottom, bars[k].high);
      if (bottom < prev.low && (prev.low - bottom) / prev.low * 100 >= minGapPct) gaps.push({ low: bottom, high: prev.low, index: i, direction: 'down' });
    }
  }
  return gaps;
}

/**
 * @param {Array<{time:string,open:number,high:number,low:number,close:number,volume?:number}>} input completed daily bars
 * @param {{ pivot?: number|null, contractionLow?: number|null }} [extra] values the chart analysis already found
 */
export function buildPriceLevels(input = [], extra = {}, rules = PRICE_LEVEL_RULES) {
  const bars = (Array.isArray(input) ? input : []).filter((bar) => [bar?.high, bar?.low, bar?.close].every((v) => finite(v) != null && v > 0) && bar.high >= bar.low);
  if (bars.length < 60) return { available: false, reason: 'bars-insufficient' };
  const n = bars.length - 1;
  const last = bars[n];
  const close = last.close;
  const closes = bars.map((bar) => bar.close);
  const adrPct = adrPctOf(bars.map((bar) => bar.high), bars.map((bar) => bar.low), closes);
  if (!(adrPct > 0)) return { available: false, reason: 'adr-unavailable' };
  const atr = atrWilder(bars);
  const from = Math.max(0, bars.length - rules.lookback);
  const candidates = [];
  const add = (price, kind, extraFields = {}) => { if (finite(price) != null && price > 0) candidates.push({ price, low: extraFields.low ?? price, high: extraFields.high ?? price, kind, ...extraFields }); };

  const { highs, lows } = swingPoints(bars, from, rules.swingSpan);
  highs.forEach((i) => add(bars[i].high, '스윙 고점', { time: bars[i].time }));
  lows.forEach((i) => add(bars[i].low, '스윙 저점', { time: bars[i].time }));
  const sma50 = smaSeries(closes, 50).at(-1), sma200 = smaSeries(closes, 200).at(-1), ema21 = emaSeries(closes, 21).at(-1);
  add(sma50, '50일선'); add(sma200, '200일선'); add(ema21, '21일 EMA');
  const recent20 = bars.slice(-20);
  add(Math.max(...recent20.map((bar) => bar.high)), '20일 고점'); add(Math.min(...recent20.map((bar) => bar.low)), '20일 저점');
  const range = rangeExtremesOf(bars.map((bar) => bar.high), bars.map((bar) => bar.low));
  const rangeLabel = range?.fullYear ? '52주' : `최근 ${range?.sessions || bars.length}거래일`;
  if (range) { add(range.high, `${rangeLabel} 고점`); add(range.low, `${rangeLabel} 저점`); }
  const vcp = detectContractions(bars);
  const pivot = finite(extra.pivot) ?? (vcp.valid ? vcp.pivot : null);
  const contractionLow = finite(extra.contractionLow) ?? (vcp.valid ? finite(vcp.contractions.at(-1)?.low) : null);
  add(pivot, '피벗'); add(contractionLow, '마지막 수축 저점');
  const profile = buildVolumeByPrice(bars);
  if (profile.available) profile.zones.forEach((zone) => add((zone.low + zone.high) / 2, '거래 집중 가격대', { low: zone.low, high: zone.high, share: zone.share }));
  unfilledGaps(bars, from, rules.minGapPct).forEach((gap) => add((gap.low + gap.high) / 2, gap.direction === 'up' ? '미메운 갭(상승)' : '미메운 갭(하락)', { low: gap.low, high: gap.high, time: bars[gap.index].time }));

  // One zone for levels within half an ADR of the zone's lowest member (measured on today's close), so a zone is never
  // wider than half an ADR however many levels sit close together.
  const mergeWidth = close * adrPct / 100 * rules.mergeAdr;
  const sorted = candidates.sort((a, b) => a.price - b.price);
  const zones = [];
  for (const item of sorted) {
    const current = zones.at(-1);
    if (current && item.price - current.members[0].price <= mergeWidth) current.members.push(item);
    else zones.push({ members: [item] });
  }
  const touch = close * adrPct / 100 * rules.touchAdr;
  const levels = zones.map(({ members }) => {
    const price = members.reduce((sum, item) => sum + item.price, 0) / members.length;
    const low = Math.min(...members.map((item) => item.low)), high = Math.max(...members.map((item) => item.high));
    const kinds = [...new Set(members.map((item) => item.kind))];
    // Reactions: bars of the last year whose high reached the zone from below and closed under it, or whose low reached it
    // from above and closed over it.
    let reactions = 0;
    for (let i = from; i <= n; i++) {
      const bar = bars[i];
      if ((bar.high >= low - touch && bar.close < low - touch) || (bar.low <= high + touch && bar.close > high + touch)) reactions += 1;
    }
    const pct = (price / close - 1) * 100;
    return { price, low, high, kinds, pct, adrMultiple: pct / adrPct, reactions, side: price > close ? 'above' : 'below', containsClose: low <= close && close <= high };
  });
  const byDistance = (a, b) => Math.abs(a.pct) - Math.abs(b.pct);
  const above = levels.filter((level) => level.side === 'above').sort(byDistance).slice(0, rules.maxPerSide);
  const below = levels.filter((level) => level.side === 'below').sort(byDistance).slice(0, rules.maxPerSide);
  const swingLowBelow = [...lows].reverse().map((i) => bars[i]).find((bar) => bar.low < close) || null;
  const baseLow = vcp.contractions.length ? Math.min(...vcp.contractions.map((row) => row.low)) : null;
  const baseDepth = vcp.valid && finite(vcp.baseHigh) && baseLow ? vcp.baseHigh - baseLow : null;
  return {
    available: true,
    asOf: last.time,
    close,
    adrPct,
    atr,
    rangeLabel,
    above,
    below,
    swingLowBelow: swingLowBelow ? { price: swingLowBelow.low, time: swingLowBelow.time } : null,
    contractionLow,
    pivot,
    base: baseDepth ? { high: vcp.baseHigh, low: baseLow, depth: baseDepth, depthPct: baseDepth / vcp.baseHigh * 100 } : null,
    rules
  };
}

/**
 * Facts about a plan the user typed. No judgement: where the stop sits against the map, the levels on the way to the
 * stop and the target, reward per unit of risk, and the loss at the stop for the amounts given.
 * @param {ReturnType<typeof buildPriceLevels>} map
 * @param {{ entry:number, stop:number, target?:number|null, amount?:number|null, capital?:number|null }} plan
 */
export function checkPricePlan(map, plan = {}) {
  if (!map?.available) return { available: false, reason: 'levels-unavailable' };
  const entry = finite(plan.entry), stop = finite(plan.stop), target = finite(plan.target);
  const amount = finite(plan.amount), capital = finite(plan.capital);
  if (!(entry > 0) || !(stop > 0)) return { available: false, reason: 'entry-stop-required' };
  if (stop === entry) return { available: false, reason: 'stop-equals-entry' };
  const direction = stop < entry ? 'long' : 'short';
  const levels = [...map.above, ...map.below].sort((a, b) => a.price - b.price);
  const between = (a, b) => levels.filter((level) => level.price > Math.min(a, b) && level.price < Math.max(a, b));
  const risk = Math.abs(entry - stop);
  const riskPct = risk / entry * 100;
  // The nearest mapped level on the entry side of the stop (the one the stop sits beyond) and the next one past it.
  const entrySide = direction === 'long' ? levels.filter((level) => level.price > stop && level.price < entry).sort((a, b) => a.price - b.price)[0] || null
    : levels.filter((level) => level.price < stop && level.price > entry).sort((a, b) => b.price - a.price)[0] || null;
  const beyond = direction === 'long' ? levels.filter((level) => level.price < stop).sort((a, b) => b.price - a.price)[0] || null
    : levels.filter((level) => level.price > stop).sort((a, b) => a.price - b.price)[0] || null;
  const distance = (from, to) => ({ pct: (to / from - 1) * 100, adrMultiple: (to / from - 1) * 100 / map.adrPct });
  const targetValid = target > 0 && (direction === 'long' ? target > entry : target < entry);
  const reward = targetValid ? Math.abs(target - entry) : null;
  const lossAtStop = amount > 0 ? amount * riskPct / 100 : null;
  return {
    available: true,
    direction,
    entry, stop, target: targetValid ? target : null, targetIgnored: target > 0 && !targetValid,
    riskPct,
    riskAdr: riskPct / map.adrPct,
    stopVsLevel: entrySide ? { level: entrySide, ...distance(entrySide.price, stop) } : null,
    stopBeyond: beyond ? { level: beyond, ...distance(stop, beyond.price) } : null,
    levelsToStop: between(entry, stop),
    levelsToTarget: targetValid ? between(entry, target) : [],
    rewardRisk: reward != null ? reward / risk : null,
    rewardPct: reward != null ? reward / entry * 100 : null,
    lossAtStop,
    lossOfCapitalPct: lossAtStop != null && capital > 0 ? lossAtStop / capital * 100 : null
  };
}
