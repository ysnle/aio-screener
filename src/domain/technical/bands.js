// v57.81 (analysis audit 2026-10-15, screener + stock): one owner for the buffers every trend label passes. A price
// 0.01% over its 50-day line read "상승 추세" and "추세 양호"; MRVL after a 13.8% five-session fall read the same; a
// stock 6.9% under the line was coloured favourable. The buffers are in units of the stock's own average daily range
// (ADR, the published adrPct) so a volatile name needs a larger move to count:
//   - within NEAR_LINE_ADR of the 50-day line, above or below, is "50일선 부근" — the side is not readable yet;
//   - a five-session fall of more than RECENT_DROP_ADR daily ranges is a short-term break that a slow up-trend label
//     must not hide (two full daily ranges in a week is well outside a normal week for that stock).
// A missing input never passes: the favourable states need every value they test.
import { EXTENSION_BANDS } from '../screener/setup-profile.js';
import { RULES } from '../rules/thresholds.js';
import { extensionMultiple, extensionStateFor } from './definitions.js';
import { signedText, readNumber as finite } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';

// v59.46 boundary contract: screener row numbers are read through the readiness contract, not row[key].
const value = (row, key) => readRowNumber(row, key, 'calculation');

/** |distance to the 50-day line| below this many average daily ranges = 부근 (neither side). v57.84: RULES constant. */
export const NEAR_LINE_ADR = RULES.technical.nearLineAdr;
/** A five-session return below -(this × ADR) = 단기 급락. */
export const RECENT_DROP_ADR = RULES.technical.recentDropAdr;
/** Entry-ready needs the price at least this many daily ranges over its 50-day line (just past the 부근 band). */
export const ENTRY_MIN_ADR_OVER_50 = NEAR_LINE_ADR;

const signed = (value, digits = 1, unit = '%') => signedText(value, digits, unit);

/** pct ÷ ADR to one decimal, or null when either is missing or ADR is not positive (technical/definitions.js). */
export const adrMultiple = extensionMultiple;

/** The screener's extension bands with their own state for a price under the line ('below'). */
export function extensionBand(multiple) {
  const value = finite(multiple);
  if (value == null) return 'unavailable';
  return value < 0 ? 'below' : extensionStateFor(value);
}

/** Five-session fall measured in the stock's own daily ranges; null when ret5d or ADR is missing. */
export function recentDrop(row) {
  const ret5d = finite(row?.ret5d);
  const adr = finite(row?.adrPct);
  if (ret5d == null || adr == null || !(adr > 0)) return null;
  const multiple = adrMultiple(ret5d, adr);
  return Object.freeze({ ret5d, adr, multiple, broken: ret5d < -RECENT_DROP_ADR * adr });
}

export const recentDropText = (drop) => (drop ? `최근 5거래일 ${signed(drop.ret5d)}(일평균 변동폭의 ${Math.abs(drop.multiple).toFixed(1)}배 하락)` : '');

/**
 * The 50·200-day trend with the buffers above. id: up (favourable) · up-shaken · near50 · pullback · rebound · down ·
 * unconfirmed (above both lines but the ADR or five-session input is missing, so the buffers cannot be tested).
 *
 * The numeric core every surface shares — the screener row
 * (bufferedTrend), the stock chart's bars and the 기술적 분석 index cards (trend-state.js). Before, the index cards ran their
 * own classifier (market-charts trendOf: 단기 조정 · 추세 이탈 · 하락 속 반등) while the stock table under them and the 종목
 * page used this one (장기 추세 속 조정 · 하락 추세 · 장기 추세 아래 반등), and the chart's trend chips a third rule — so SPY
 * could read 단기 조정, 장기 추세 속 조정 and 하락 추세 on one screen. The 50/200 cross is a `phase` on the same id, read
 * from the two distances alone (ma50 < ma200 exactly when the close is further above the 50-day than above the 200-day):
 *   up + 50-day still under the 200-day → phase 'recovery', 회복 시도 (전환 확인 전);
 *   down + 50-day still over the 200-day → phase 'breakdown', 추세 이탈 (꺾이는 초기).
 * The id (and its tone) is unchanged, so every reader that tests the id keeps working.
 * `positionOnly` (closes without high/low, e.g. index levels) skips the ADR buffers instead of reading 'unconfirmed'.
 */
export const TREND_PHASE_LABELS = Object.freeze({ recovery: '회복 시도', breakdown: '추세 이탈' });
/**
 * The bar unit a trend is read on. The screener row and the daily chart are daily ('day', the words as written); the
 * weekly chart and the multi-timeframe strip read 50·200-week lines, the intraday charts 50·200-bar lines, so their
 * label and sentence name that unit instead of 일선 / 일평균 / 5거래일.
 */
export const TREND_UNITS = Object.freeze({
  day: null,
  week: Object.freeze({ line: '주선', range: '주평균 변동폭', recent: '최근 5주', week: '최근 5주' }),
  month: Object.freeze({ line: '개월선', range: '월평균 변동폭', recent: '최근 5개월', week: '최근 5개월' }),
  bar: Object.freeze({ line: '봉선', range: '봉 평균 변동폭', recent: '최근 5봉', week: '최근 5봉' })
});
function inUnit(trend, unit) {
  const words = TREND_UNITS[unit];
  if (!trend || !words) return trend;
  const swap = (text) => String(text || '').replace(/(\d+)일선/g, `$1${words.line}`).replace(/(\d+)·(\d+)일선/g, `$1·$2${words.line}`)
    .replace(/일평균 변동폭/g, words.range).replace(/최근 5거래일/g, words.recent).replace(/최근 한 주/g, words.week);
  return { ...trend, label: swap(trend.label), text: swap(trend.text), unit };
}

export function classifyTrend({ unit = 'day', ...inputs } = {}) {
  return inUnit(classifyTrendDaily(inputs), unit);
}

function classifyTrendDaily({ s50, s200, adr = null, drop = null, positionOnly = false } = {}) {
  if (s50 == null || s200 == null || !Number.isFinite(s50) || !Number.isFinite(s200)) return null;
  const line200 = s200 >= 0 ? `200일선 위(${signed(s200)})` : `200일선 아래(${signed(s200)})`;
  const hasAdr = adr != null && adr > 0;
  // v59.45 R4-03: the 50-day band needs only the ADR. With the five-session return missing the row skipped it and a close
  // 0.05% over the line read "50일선은 회복(+0.1%)" — the 0.01% call v57.81 removed. The band is tested first.
  if (hasAdr && Math.abs(s50) < NEAR_LINE_ADR * adr) {
    return { id: 'near50', tone: 'neutral', label: '50일선 부근', drop,
      text: `50일선과 ${signed(s50)} 차이로 일평균 변동폭(${adr.toFixed(1)}%)의 ${NEAR_LINE_ADR}배 안 — 50일선 위인지 아래인지 아직 가를 수 없는 자리이고, ${line200}입니다${drop?.broken ? `. ${recentDropText(drop)}` : ''}` };
  }
  if (!positionOnly && (!hasAdr || drop == null)) {
    if (s50 >= 0 && s200 >= 0) return { id: 'unconfirmed', tone: 'neutral', label: '50·200일선 위', drop, text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 위 — 일평균 변동폭 또는 최근 5거래일 자료가 없어 50일선과의 여유와 단기 낙폭은 판단하지 않습니다` };
  } else if (s50 >= 0 && s200 >= 0 && drop?.broken) {
    return { id: 'up-shaken', tone: 'neutral', label: '상승 추세 속 단기 급락', drop,
      text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 위지만 ${recentDropText(drop)} — 이동평균 위치는 위쪽이어도 최근 한 주의 낙폭이 이 종목의 보통 움직임보다 큽니다` };
  }
  if (s50 >= 0 && s200 >= 0) {
    if (s50 > s200) return { id: 'up', phase: 'recovery', tone: 'favorable', label: TREND_PHASE_LABELS.recovery, drop, text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 위로 올라왔지만 50일선이 아직 200일선 아래 — 50일선이 200일선 위로 올라서야(골든크로스) 추세 전환이 확인됩니다` };
    return { id: 'up', tone: 'favorable', label: '상승 추세', drop, text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 위 — 단기·장기 추세가 모두 위쪽입니다` };
  }
  if (s50 < 0 && s200 >= 0) return { id: 'pullback', tone: 'neutral', label: '장기 추세 속 조정', drop, text: `200일선 위(${signed(s200)})지만 50일선 아래(${signed(s50)}) — 장기 추세 안에서 쉬는 구간입니다${drop?.broken ? `. ${recentDropText(drop)}` : ''}` };
  if (s50 >= 0 && s200 < 0) return { id: 'rebound', tone: 'neutral', label: '장기 추세 아래 반등', drop, text: `50일선은 회복(${signed(s50)})했지만 200일선 아래(${signed(s200)}) — 반등이 장기 추세를 되돌릴지는 아직입니다` };
  if (s200 > s50) return { id: 'down', phase: 'breakdown', tone: 'burden', label: TREND_PHASE_LABELS.breakdown, drop, text: `50일선(${signed(s50)})과 200일선(${signed(s200)})을 모두 내줬고 50일선은 아직 200일선 위 — 추세가 꺾이는 초기이며, 50일선이 200일선 아래로 내려가면(데드크로스) 하락 추세로 굳습니다` };
  return { id: 'down', tone: 'burden', label: '하락 추세', drop, text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 아래 — 단기·장기 추세가 모두 아래쪽입니다` };
}

/** The display key of a trend: its phase when it has one, else its id (one word per key on every screen). */
export const trendKey = (trend) => (trend ? trend.phase || trend.id : null);

export function bufferedTrend(row) {
  return classifyTrend({ s50: value(row, 'pctSma50'), s200: value(row, 'pctSma200'), adr: finite(row?.adrPct), drop: recentDrop(row) });
}

// v59.71 (owner 11/07 '가격 움직임과 거래량'): the trend stays a price reading (the three screens share its states), and the
// volume beside it says whether the move carried weight — the screener's own follow-through fields: 50-day-average-plus
// down days of 1%+ in the last 25 sessions (shown from 5, row-presentation.js) and pocket pivots in the last 10.
export const HEAVY_DOWN_NOTICE = 5;
export function trendVolumeNote(row, trend = bufferedTrend(row)) {
  if (!trend) return '';
  const heavy = value(row, 'heavyDownDays25');
  const pockets = value(row, 'pocketPivots10');
  const weak = ['down', 'pullback', 'near50', 'up-shaken'].includes(trend.id);
  if (weak && heavy != null && heavy >= HEAVY_DOWN_NOTICE) return `최근 25거래일 거래량 실린 하락 ${heavy}일 — 밀릴 때 거래가 붙었습니다`;
  if (weak && heavy != null && heavy <= 1) return `최근 25거래일 거래량 실린 하락 ${heavy}일 — 밀렸지만 거래는 크게 붙지 않았습니다`;
  if (!weak && pockets != null && pockets >= 1) return `최근 10거래일 거래량 실린 상승(포켓 피벗) ${pockets}회`;
  if (!weak && heavy != null && heavy >= HEAVY_DOWN_NOTICE) return `위쪽 추세지만 최근 25거래일 거래량 실린 하락 ${heavy}일`;
  return '';
}

/** Entry-ready trend part: above the 50-day line by ENTRY_MIN_ADR_OVER_50 ranges, above the 200-day line, no break. */
export function trendHeldWithMargin(row) {
  const trend = bufferedTrend(row);
  const margin = adrMultiple(value(row, 'pctSma50'), row?.adrPct);
  return trend?.id === 'up' && margin != null && margin >= ENTRY_MIN_ADR_OVER_50 && value(row, 'pctSma200') > 0;
}

/**
 * Model-level contrary evidence for one row, independent of any user filter: a five-session break, the price under the
 * 20-, 50- or 200-day line, and the RSI regime. A missing input is listed as not checked (it never reads as clear).
 */
export function modelContraryEvidence(row) {
  const hits = [];
  const unchecked = [];
  const drop = recentDrop(row);
  if (drop == null) unchecked.push('5거래일 낙폭');
  else if (drop.broken) hits.push(recentDropText(drop));
  for (const [key, label] of [['pctSma20', '20일선'], ['pctSma50', '50일선'], ['pctSma200', '200일선']]) {
    const reading = value(row, key);
    if (reading == null) unchecked.push(label);
    else if (reading < 0) hits.push(`${label} 아래(${signed(reading)})`);
  }
  const rsi = value(row, 'rsi');
  const { overbought, oversold } = RULES.technical.rsi;
  if (rsi == null) unchecked.push('RSI');
  else if (rsi >= overbought) hits.push(`RSI ${rsi.toFixed(1)} 과열권(${overbought} 이상)`);
  else if (rsi <= oversold) hits.push(`RSI ${rsi.toFixed(1)} 과매도권(${oversold} 이하)`);
  return Object.freeze({ hits, unchecked });
}

export { EXTENSION_BANDS };
