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
import { signedText } from '../shared/number.js';

/** |distance to the 50-day line| below this many average daily ranges = 부근 (neither side). v57.84: RULES constant. */
export const NEAR_LINE_ADR = RULES.technical.nearLineAdr;
/** A five-session return below -(this × ADR) = 단기 급락. */
export const RECENT_DROP_ADR = RULES.technical.recentDropAdr;
/** Entry-ready needs the price at least this many daily ranges over its 50-day line (just past the 부근 band). */
export const ENTRY_MIN_ADR_OVER_50 = NEAR_LINE_ADR;

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
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
 */
export function bufferedTrend(row) {
  const s50 = finite(row?.pctSma50);
  const s200 = finite(row?.pctSma200);
  if (s50 == null || s200 == null) return null;
  const adr = finite(row?.adrPct);
  const drop = recentDrop(row);
  const line200 = s200 >= 0 ? `200일선 위(${signed(s200)})` : `200일선 아래(${signed(s200)})`;
  if (adr == null || !(adr > 0) || drop == null) {
    if (s50 >= 0 && s200 >= 0) return { id: 'unconfirmed', tone: 'neutral', label: '50·200일선 위', drop, text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 위 — 일평균 변동폭 또는 최근 5거래일 자료가 없어 50일선과의 여유와 단기 낙폭은 판단하지 않습니다` };
  } else if (Math.abs(s50) < NEAR_LINE_ADR * adr) {
    return { id: 'near50', tone: 'neutral', label: '50일선 부근', drop,
      text: `50일선과 ${signed(s50)} 차이로 일평균 변동폭(${adr.toFixed(1)}%)의 ${NEAR_LINE_ADR}배 안 — 50일선 위인지 아래인지 아직 가를 수 없는 자리이고, ${line200}입니다${drop.broken ? `. ${recentDropText(drop)}` : ''}` };
  } else if (s50 >= 0 && s200 >= 0 && drop.broken) {
    return { id: 'up-shaken', tone: 'neutral', label: '상승 추세 속 단기 급락', drop,
      text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 위지만 ${recentDropText(drop)} — 이동평균 위치는 위쪽이어도 최근 한 주의 낙폭이 이 종목의 보통 움직임보다 큽니다` };
  }
  if (s50 >= 0 && s200 >= 0) return { id: 'up', tone: 'favorable', label: '상승 추세', drop, text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 위 — 단기·장기 추세가 모두 위쪽입니다` };
  if (s50 < 0 && s200 >= 0) return { id: 'pullback', tone: 'neutral', label: '장기 추세 속 조정', drop, text: `200일선 위(${signed(s200)})지만 50일선 아래(${signed(s50)}) — 장기 추세 안에서 쉬는 구간입니다${drop?.broken ? `. ${recentDropText(drop)}` : ''}` };
  if (s50 >= 0 && s200 < 0) return { id: 'rebound', tone: 'neutral', label: '장기 추세 아래 반등', drop, text: `50일선은 회복(${signed(s50)})했지만 200일선 아래(${signed(s200)}) — 반등이 장기 추세를 되돌릴지는 아직입니다` };
  return { id: 'down', tone: 'burden', label: '하락 추세', drop, text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 아래 — 단기·장기 추세가 모두 아래쪽입니다` };
}

/** Entry-ready trend part: above the 50-day line by ENTRY_MIN_ADR_OVER_50 ranges, above the 200-day line, no break. */
export function trendHeldWithMargin(row) {
  const trend = bufferedTrend(row);
  const margin = adrMultiple(row?.pctSma50, row?.adrPct);
  return trend?.id === 'up' && margin != null && margin >= ENTRY_MIN_ADR_OVER_50 && finite(row?.pctSma200) > 0;
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
    const value = finite(row?.[key]);
    if (value == null) unchecked.push(label);
    else if (value < 0) hits.push(`${label} 아래(${signed(value)})`);
  }
  const rsi = finite(row?.rsi);
  const { overbought, oversold } = RULES.technical.rsi;
  if (rsi == null) unchecked.push('RSI');
  else if (rsi >= overbought) hits.push(`RSI ${rsi.toFixed(1)} 과열권(${overbought} 이상)`);
  else if (rsi <= oversold) hits.push(`RSI ${rsi.toFixed(1)} 과매도권(${oversold} 이하)`);
  return Object.freeze({ hits, unchecked });
}

export { EXTENSION_BANDS };
