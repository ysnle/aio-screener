// "평소 관계와 어긋난 곳" and the rule verdicts between assets. Oil, rates, stocks, long bonds, gold, credit, the dollar and
// the yen crosses are tied together; this module is the one place a relation between them is judged. Each relation is
// tested on the same 20 sessions as the S&P 500 (a FRED leg on its own last observation, with its own dates); a verdict is
// a fixed state word plus the legs it read — the sentence that explains it is the AI reading's. Tendencies, not forecasts.
import { buildCloseSeries, sessionPointBack } from '../market/session/close-series.js';
import { RULES } from '../rules/thresholds.js';
import { signedText } from '../shared/number.js';

const C = RULES.crossAsset;
// Story order: where the money went (havens), then what rates did for stocks, then what drove rates.
const ORDER = ['stocks-bonds-down', 'risk-off-gold-down', 'risk-off-dollar-down', 'rates-down-stocks-down', 'rates-up-stocks-up', 'oil-up-rates-down', 'oil-down-rates-up'];
const pct = (value) => signedText(value, 1, '%');
// A size beside a verb (올랐다·내렸다) carries no sign.
const size = (value) => `${Math.abs(value).toFixed(1)}%`;
const bpSize = (value) => `${Math.abs(Math.round(value * 100))}bp`;

// The fixed state words of every verdict below.
export const CROSS_ASSET_STATES = Object.freeze({
  'cash-dash': '현금 확보 묶음', 'real-rate': '실질금리 장세',
  'trust-loss': '미국 자산 신뢰 하락형', 'joint-rally': '위험자산 동반 랠리형',
  haven: '피난형', 'growth-scare': '성장 우려형', easing: '완화형',
  'dollar-weak': '달러 약세', 'yen-strong': '엔 강세', 'carry-unwind': '캐리 청산 진행',
  'easing-accepted': '완화 수용', 'trust-steepening': '신뢰 훼손 스티프닝', 'tightening-cycle': '긴축 사이클 시작',
  mixed: '가르지 않음',
});

const CLOSE_FIELDS = ['spx', 'soxx', 'tlt', 'wti', 'gold', 'dxy', 'vix', 'rut', 'rsp'];
export function crossAssetMoves(history = [], { through = null, window = C.window } = {}) {
  const change = (field, points = false) => {
    const series = buildCloseSeries(history, field, { through });
    const last = series.at(-1);
    const back = last ? sessionPointBack(series, window) : null;
    if (!back?.value) return null;
    return { value: points ? last.value - back.value : (last.value / back.value - 1) * 100, from: back.date, to: last.date };
  };
  return { window, ...Object.fromEntries(CLOSE_FIELDS.map((field) => [field, change(field)])), tnx: change('tnx', true) };
}

// A FRED daily leg (percent levels) as a bp change over `window` sessions ending on its last observation on or before
// `through`; a window that ends before `after` (the S&P 500 window's start) is not the same period and is left out.
function fredMove(macroHistory, key, { through = null, after = null, window = C.window } = {}) {
  const series = (macroHistory?.series?.[key]?.observations || []).filter(([date, value]) => Number.isFinite(value) && (!through || date <= through)).map(([date, value]) => ({ date, value }));
  const last = series.at(-1);
  const back = last ? sessionPointBack(series, window) : null;
  if (!back || (after && last.date < after)) return null;
  return { value: Math.round((last.value - back.value) * 100), from: back.date, to: last.date };
}

// The moves on the S&P 500's window: a move whose window ends on another session (an asset whose record stopped
// earlier) is left out, not compared with it.
function anchoredMoves(history, options) {
  const raw = crossAssetMoves(history, options);
  const anchor = raw.spx?.to || null;
  return Object.fromEntries(Object.entries(raw).map(([key, move]) => [key, key === 'window' || move == null || move.to === anchor ? move : null]));
}

// The CLEAR sentence names the assets in this order.
const CLEAR_NAMES = [['wti', '유가'], ['tnx', '금리'], ['spx', '주식'], ['tlt', '장기채'], ['gold', '금'], ['dxy', '달러']];

export function buildCrossAssetRelations(history = [], options = {}) {
  const m = anchoredMoves(history, options);
  const v = (key) => m[key]?.value ?? null;
  const spx = v('spx'), soxx = v('soxx'), tnx = v('tnx'), tlt = v('tlt'), wti = v('wti'), gold = v('gold'), dxy = v('dxy'), vix = v('vix');
  const known = (...values) => values.every((value) => value != null);
  const breaks = [];
  const add = (id, text) => breaks.push({ id, text });
  // Oil feeds inflation expectations, so oil and yields usually move together.
  if (known(wti, tnx) && wti >= C.oil20dPct && tnx * 100 <= -C.rate20dBp) add('oil-up-rates-down', `유가가 ${size(wti)} 올랐는데 10년물 금리는 ${bpSize(tnx)} 내렸습니다 — 물가보다 성장 걱정이 금리를 이끕니다.`);
  else if (known(wti, tnx) && wti <= -C.oil20dPct && tnx * 100 >= C.rate20dBp) add('oil-down-rates-up', `유가가 ${size(wti)} 내렸는데 10년물 금리는 ${bpSize(tnx)} 올랐습니다 — 국채 공급·기간 프리미엄 같은 물가 밖 요인 쪽입니다.`);
  // Lower yields usually support stock valuations; higher yields weigh on them. Which kind of fall it was is rateFallKind's.
  if (known(tnx, spx) && tnx * 100 <= -C.rate20dBp && spx <= -C.stock20dPct) add('rates-down-stocks-down', `금리가 내렸는데도 S&P 500은 ${size(spx)} 내렸습니다.`);
  else if (known(tnx, spx) && tnx * 100 >= C.rate20dBp && spx >= C.stock20dPct) add('rates-up-stocks-up', `금리가 ${bpSize(tnx)} 올랐는데도 S&P 500은 ${size(spx)} 올랐습니다 — 금리 부담보다 성장 기대가 큽니다.`);
  // Long bonds usually cushion a stock fall; falling together means the cushion failed. Cash dash or real-rate move is
  // cashOrRealRate's verdict.
  const stocksDown = known(spx) && spx <= -C.stock20dPct;
  const riskOff = stocksDown || (known(vix) && vix >= C.vixRise20dPct);
  if (stocksDown && known(tlt) && tlt <= -C.bond20dPct) add('stocks-bonds-down', `주식과 장기채가 함께 내렸습니다(장기채 ${pct(tlt)}).`);
  // Risk-off usually lifts the havens; a falling haven narrows where the money went.
  const bondHaven = stocksDown && known(tlt) && tlt >= C.bond20dPct;
  if (riskOff && known(gold) && gold <= -C.gold20dPct) add('risk-off-gold-down', `그런데 금은 ${size(gold)} 내렸습니다 — ${bondHaven ? '안전자산 가운데 미국 국채만 올랐습니다' : '안전자산 가격이 함께 오르지는 않았습니다'}.`);
  if (riskOff && known(dxy) && dxy <= -C.dollar20dPct) add('risk-off-dollar-down', `위험 회피인데 달러는 ${size(dxy)} 약해졌습니다 — 미국 안의 걱정이 더 큰 쪽일 수 있습니다.`);

  const driver = known(soxx, spx) && spx < 0 && soxx - spx <= -C.semisLeadPp ? `하락은 반도체가 이끌었습니다(반도체 ETF ${pct(soxx)}, S&P 500 ${pct(spx)})`
    : known(soxx, spx) && spx > 0 && soxx - spx >= C.semisLeadPp ? `상승은 반도체가 이끌었습니다(반도체 ETF ${pct(soxx)}, S&P 500 ${pct(spx)})` : null;
  const flow = bondHaven ? `주식이 내리는 동안 장기채는 ${size(tlt)} 올라 분산 투자에서 완충 역할을 했습니다` : null;
  const lead = [driver, flow].filter(Boolean).join('. ');
  const asOf = m.spx?.to || m.tnx?.to || null;
  const available = known(spx, tnx);
  const reading = !available ? null
    : breaks.length ? `최근 ${m.window}거래일 ${lead ? `${lead}. ` : ''}${[...breaks].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)).slice(0, 3).map((item) => item.text).join(' ')}`
      : `최근 ${m.window}거래일 ${lead ? `${lead}. ` : ''}${clearSentence(m)}`;
  return { available, asOf, window: m.window, moves: m, driver, flow, breaks, reading };
}

// Only the assets actually checked are said to be within their usual relations; the unchecked are named as such.
function clearSentence(m) {
  const checked = CLEAR_NAMES.filter(([key]) => m[key]?.value != null).map(([, name]) => name);
  const missing = CLEAR_NAMES.filter(([key]) => m[key]?.value == null).map(([, name]) => name);
  return `${checked.join('·')}${missing.length ? '' : '는'}${missing.length ? ` 사이에서는 평소 관계에서 크게 벗어난 곳이 없습니다(${missing.join('·')}는 같은 기간 기록이 없어 확인하지 못함).` : ' 평소 관계에서 크게 벗어나지 않았습니다.'}`;
}

const verdict = (id, state, legs) => ({ id, state, label: state ? CROSS_ASSET_STATES[state] : null, legs });
const side = (value, line) => (value == null ? null : value >= line ? 'up' : value <= -line ? 'down' : 'flat');

// Stocks, gold and long bonds down with only the dollar up is the dash for cash — unless the 10-year real yield rose by
// the rate line over the same weeks, which makes the same shape a real-rate (oil → inflation → real yield) market.
export function cashOrRealRate(m, real) {
  const bundle = side(m.spx?.value, C.stock20dPct) === 'down' && side(m.gold?.value, C.gold20dPct) === 'down' && side(m.tlt?.value, C.bond20dPct) === 'down' && side(m.dxy?.value, C.dollar20dPct) === 'up';
  const state = !bundle || real == null ? null : real.value >= C.rate20dBp ? 'real-rate' : 'cash-dash';
  return { ...verdict('cash-or-real-rate', state, { spx: m.spx, gold: m.gold, tlt: m.tlt, dxy: m.dxy, realYield10: real }), bundle };
}

// Long yields and the dollar over the same weeks: yields up with the dollar down is the loss-of-trust-in-US-assets shape,
// yields down with the dollar down the everything-rally shape. The dollar-up cells carry no named shape.
export function ratesDollarKind(m) {
  const rate = side(m.tnx?.value == null ? null : m.tnx.value * 100, C.rate20dBp);
  const dollar = side(m.dxy?.value, C.dollar20dPct);
  const state = dollar !== 'down' ? null : rate === 'up' ? 'trust-loss' : rate === 'down' ? 'joint-rally' : null;
  return { ...verdict('rates-dollar', state, { tnx: m.tnx, dxy: m.dxy }), rate, dollar };
}

// Which kind of fall in the 10-year: a haven fall when HY spreads widened by the credit line over the same weeks (yields
// down, funding costs not), a growth scare when small caps and the equal-weight index fell with the VIX rising, an easing
// fall when both rose with the VIX lower. Null when the 10-year did not fall by the rate line.
export function rateFallKind(m, hy) {
  if (!(m.tnx?.value != null && m.tnx.value * 100 <= -C.rate20dBp)) return verdict('rate-fall', null, { tnx: m.tnx });
  const rut = m.rut?.value ?? null, rsp = m.rsp?.value ?? null, vix = m.vix?.value ?? null;
  const smallUp = side(rut, C.stock20dPct) === 'up' && side(rsp, C.stock20dPct) === 'up';
  const smallDown = side(rut, C.stock20dPct) === 'down' && side(rsp, C.stock20dPct) === 'down';
  const state = hy && hy.value >= RULES.credit.widen20dBp ? 'haven'
    : smallDown && vix != null && vix >= C.vixRise20dPct ? 'growth-scare'
      : smallUp && vix != null && vix < 0 ? 'easing' : 'mixed';
  return verdict('rate-fall', state, { tnx: m.tnx, rut: m.rut, rsp: m.rsp, vix: m.vix, hyOas: hy });
}

// A USD/JPY fall split by the crosses. EUR/JPY and AUD/JPY are products of two closes on the same date; a cross whose leg
// is missing on the USD/JPY close date is missing. EUR/USD up = the dollar weakening; EUR/JPY down too = the yen itself
// strong; AUD/JPY down as well = the carry trade unwinding. Pair moves are read on the cross-asset dollar line.
export function yenDecomposition(history = [], { through = null, window = C.window } = {}) {
  const series = (field) => buildCloseSeries(history, field, { through });
  const usdjpy = series('usdjpy');
  const anchor = usdjpy.at(-1)?.date || null;
  const cross = (field) => {
    const other = new Map(series(field).map((point) => [point.date, point.value]));
    return usdjpy.filter((point) => other.has(point.date)).map((point) => ({ date: point.date, value: point.value * other.get(point.date) }));
  };
  const change = (rows) => {
    const last = rows.at(-1);
    const back = last && last.date === anchor ? sessionPointBack(rows, window) : null;
    return back?.value ? { value: (last.value / back.value - 1) * 100, from: back.date, to: last.date } : null;
  };
  const legs = { usdjpy: change(usdjpy), eurusd: change(series('eurusd')), eurjpy: change(cross('eurusd')), audjpy: change(cross('audusd')), audusd: change(series('audusd')) };
  const s = (key) => side(legs[key]?.value ?? null, C.dollar20dPct);
  const state = s('usdjpy') !== 'down' || !s('eurusd') ? null
    : s('eurusd') === 'up' ? 'dollar-weak'
      : !s('eurjpy') ? null : s('eurjpy') === 'down' ? (s('audjpy') === 'down' ? 'carry-unwind' : 'yen-strong') : 'mixed';
  return { ...verdict('yen', state, legs), asOf: anchor, riskFxWeak: s('audusd') === 'down' };
}

/** Every rule verdict between assets on one basis: the S&P 500's 20 sessions, FRED legs on their own last observation. */
export function crossAssetVerdicts(history = [], macroHistory = null, { through = null } = {}) {
  const m = anchoredMoves(history, { through });
  const fred = (key) => fredMove(macroHistory, key, { through: m.spx?.to || through, after: m.spx?.from || null });
  return {
    asOf: m.spx?.to || null, window: m.window,
    cashOrRealRate: cashOrRealRate(m, fred('realYield10')),
    ratesDollar: ratesDollarKind(m),
    rateFall: rateFallKind(m, fred('hyOas')),
    yen: yenDecomposition(history, { through }),
  };
}

// After a release: the bond, credit and dollar response from the base close to the end close (signed bp; the dollar in %),
// read by sign as shown (whole bp, 0.1%). 2Y·10Y·BEI down with OAS tighter and the broad market up = easing accepted;
// 2Y down while 10Y and BEI rise = a steepening that doubts the Fed; 2Y·10Y·BEI·real·dollar all up = a tightening cycle.
export function eventRateResponse(legs = {}) {
  const sign = (key, digits = 0) => (legs[key] == null ? null : Math.sign(Math.round(legs[key] * 10 ** digits)));
  const all = (pairs) => pairs.every(([key, want, digits]) => sign(key, digits) === want);
  const state = all([['dgs2', -1], ['dgs10', -1], ['breakeven10', -1], ['hyOas', -1], ['broad', 1, 1]]) ? 'easing-accepted'
    : all([['dgs2', -1], ['dgs10', 1], ['breakeven10', 1]]) ? 'trust-steepening'
      : all([['dgs2', 1], ['dgs10', 1], ['breakeven10', 1], ['realYield10', 1], ['dxy', 1, 1]]) ? 'tightening-cycle' : null;
  return verdict('event-rates', state, legs);
}
