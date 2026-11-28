// One state per holding, read the same way wherever the portfolio shows it:
//   trend  — technical/bands.js bufferedTrend (the 종목·기술적 분석 trend) mapped to the portfolio's five states. A close
//            within the near-line band of the 50-day line is 판정 보류, never a break; only pullback and down are under
//            the line past that band.
//   thesis — fundamental/priced-in.js, read as it is on 종목: a price far below its high whose estimates were not cut is
//            '논지 유지', one whose estimates are being cut is '논지 훼손'. The words name their basis (estimates only).
//   plan   — each open buy lot's stop price (written at the buy) against the latest close: below it is '계획 무효', and
//            the open move is counted in units of the initial risk (R = (close − entry) ÷ (entry − stop)).
import { bufferedTrend } from '../technical/bands.js';
import { buildPricedInRead } from '../fundamental/priced-in.js';
import { readNumber as finite } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';

const TREND_STATE_OF = Object.freeze({ up: 'up', 'up-shaken': 'near', near50: 'near', pullback: 'pullback', rebound: 'rebound', down: 'down' });
export const TREND_LABEL = Object.freeze({ up: '상승 추세', near: '선 근처(판정 보류)', pullback: '추세 속 조정', rebound: '장기 추세 아래 반등', down: '하락 추세' });
/** The states under the 50-day line past its near-line band. */
export const TREND_BREAK_STATES = Object.freeze(['pullback', 'down']);

/** Screener row → up · near · pullback · rebound · down, or null without both lines. Above both lines with the
 * five-session return missing stays 상승 only when the 50-day band was tested (ADR known); without the ADR it is 판정 보류. */
export function holdingTrendState(row) {
  const trend = bufferedTrend(row);
  if (trend?.id === 'unconfirmed') return readRowNumber(row, 'adrPct', 'calculation') > 0 ? 'up' : 'near';
  return TREND_STATE_OF[trend?.id] || null;
}

export const THESIS_BASIS = '추정치 기준';
export const THESIS_STATES = Object.freeze({ kept: '논지 유지', damaged: '논지 훼손' });
const THESIS_OF_PRICED_IN = Object.freeze({ ahead: 'kept', confirmed: 'damaged' });

/** Screener row + consensus row → { state: kept | damaged | null, label, pricedIn, asOf, priceDate }, or null when the
 * price cannot be read against the estimates. A null state is a price that is not a fall priced-in classifies. */
export function holdingThesis(row, estimate, { now = Date.now() } = {}) {
  if (!row || !estimate) return null;
  const read = buildPricedInRead(row, estimate, { now });
  if (!read) return null;
  const state = THESIS_OF_PRICED_IN[read.state] || null;
  return { state, label: state ? THESIS_STATES[state] : null, pricedIn: read.state, asOf: read.asOf || null, priceDate: read.priceDate || null };
}

export const PLAN_STATES = Object.freeze({ void: '계획 무효', held: '손절 가격 위', 'no-close': '종가 없음', 'no-stop': '손절 가격 미기록' });
// A stop is a price the market can jump over: a gap or a thin book fills below it, so the realised loss can exceed 1R.
export const PLAN_GAP_NOTE = '손절 가격은 갭이나 얇은 거래로 건너뛸 수 있어, 실제 손실이 1R보다 클 수 있습니다.';
const PLAN_ORDER = ['void', 'held', 'no-close', 'no-stop'];

/** One open buy lot against a close { price, date, currency }. A close in another currency than the lot is no close. */
export function lotPlan(lot, close = null) {
  const entry = finite(lot?.price);
  const stop = finite(lot?.stop) > 0 ? finite(lot.stop) : null;
  const base = { id: lot?.id || null, symbol: lot?.symbol || null, date: lot?.date || null, entry, stop, qty: finite(lot?.qty), close: null, closeDate: null, r: null };
  if (stop == null) return { ...base, state: 'no-stop' };
  const price = finite(close?.price);
  if (!(price > 0) || (close.currency && lot.currency && close.currency !== lot.currency)) return { ...base, state: 'no-close' };
  const risk = entry - stop;
  return { ...base, close: price, closeDate: close.date || null, r: risk > 0 ? (price - entry) / risk : null, state: price < stop ? 'void' : 'held' };
}

/** The open lots of one holding → { lots, state, condition }. The state is the first of void · held · no-close · no-stop
 * any lot is in; the condition is the newest lot's note (근거와 깨지는 조건) with its date, or null when none is written. */
export function holdingPlan(lots = [], close = null) {
  if (!lots.length) return null;
  const plans = lots.map((lot) => lotPlan(lot, close));
  const noted = lots.filter((lot) => String(lot.note || '').trim()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
  return { lots: plans, state: PLAN_ORDER.find((state) => plans.some((plan) => plan.state === state)),
    condition: noted ? { text: String(noted.note).trim(), date: noted.date } : null };
}
