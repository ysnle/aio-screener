// 종목 머리의 한 줄: the stock's last session placed in the market's — its move against its primary theme's median move
// and against its market's centre index (Nasdaq-100 for a US listing, 코스피 for a KRX one) on that same session, and,
// while the opening reads a rebound, what the stock did from the rebound's low: how far it rose to its highest close
// since and what share of that it has given back. A value of another session is never compared: a member's return, the
// index close and the stock's bars count only when they are of the stock's own session. Pure: the caller passes the
// rows, the history, the rebound low and the bars it already holds.
import { claim, say, sayJoin, NOTHING } from '../shared/claim.js';
import { median } from '../themes/theme-medians.js';
import { buildCloseSeries } from '../market/session/close-series.js';
import { countOpenSessionsBetween } from '../market/session/market-calendar.js';
import { shortDate } from '../content/date-labels.js';
import { readNumber } from '../shared/number.js';
import { themeMarketOf } from '../scenarios/theme-stage.js';

/** A theme's median is read from at least this many members with a return of the same session. */
export const TIE_MIN_MEMBERS = 3;
/** The index each market's stock is set against, by its history.json field. */
export const TIE_INDEX = Object.freeze({ US: Object.freeze({ id: 'ndx', label: '나스닥 100' }), KR: Object.freeze({ id: 'kospi', label: '코스피' }) });

const day = (value) => String(value || '').slice(0, 10);
const round1 = (value) => Math.round(value * 10) / 10;

/**
 * The median one-session return of a theme's members on `session`: the theme's `leaders` (the members the day ledger
 * reads), else its sub-themes' tickers (the Korean groups). Null below TIE_MIN_MEMBERS returns of that session.
 * @returns {{ id: string, label: string, change: number, count: number }|null}
 */
export function themeSessionMove(theme, rows, session) {
  if (!theme?.id || !session) return null;
  const members = new Set((Array.isArray(theme.leaders) && theme.leaders.length ? theme.leaders : (theme.subThemes || []).flatMap((sub) => sub?.tickers || []))
    .map((sym) => String(sym || '').toUpperCase()).filter(Boolean));
  const values = (Array.isArray(rows) ? rows : []).filter((row) => members.has(String(row?.sym || '').toUpperCase()) && day(row.factorSessionDate) === session)
    .map((row) => readNumber(row.ret1d)).filter((value) => value != null);
  if (values.length < TIE_MIN_MEMBERS) return null;
  return { id: theme.id, label: theme.nameKr || theme.label || theme.id, change: median(values), count: values.length };
}

/**
 * The index's change on `session` from history.json's closes: its close of that date over the previous session's close of
 * its own market. Null when the index has no close of that date or the close before it is not the previous session.
 * @returns {{ id: string, label: string, change: number }|null}
 */
export function indexSessionMove(history, market, session) {
  const index = TIE_INDEX[market];
  if (!index || !session) return null;
  const series = buildCloseSeries(history, index.id, { through: session });
  const last = series.at(-1), prior = series.at(-2);
  if (!last || !prior || last.date !== session || countOpenSessionsBetween(prior.date, last.date, market) !== 1) return null;
  return { id: index.id, label: index.label, change: (last.value / prior.value - 1) * 100 };
}

/**
 * The stock from the rebound's low (`low.date`) through `session`, on its completed daily closes: its close on the low's
 * date (`base`), its highest close since (`peak`) and the session's close. Null without a close on either date, or when
 * the session is the low's own.
 *   kind 'new-high'  the session closed at the highest close since the low;
 *   kind 'gave-back' it closed under that peak (`share`: the part of base → peak given back, 100 or more when it is all gone);
 *   kind 'no-rise'   no close since has been over the low day's close.
 * @param {Array<{time:string, close:number}>} bars ascending completed daily bars
 */
export function reboundFromLow(bars, low, session) {
  if (!low?.date || !session || session <= low.date) return null;
  const closes = (Array.isArray(bars) ? bars : []).map((bar) => ({ date: day(bar?.time ?? bar?.date), value: Number(bar?.close) }))
    .filter((bar) => bar.date && Number.isFinite(bar.value) && bar.value > 0 && bar.date >= low.date && bar.date <= session);
  const base = closes[0];
  const close = closes.at(-1);
  if (!base || base.date !== low.date || !close || close.date !== session) return null;
  const peak = closes.reduce((best, bar) => (bar.value > best.value ? bar : best), base);
  if (!(peak.value > base.value)) return { kind: 'no-rise', lowDate: low.date, session };
  const rise = (peak.value / base.value - 1) * 100;
  if (peak.date === session) return { kind: 'new-high', lowDate: low.date, session, rise };
  return { kind: 'gave-back', lowDate: low.date, session, rise, peakDate: peak.date, share: (peak.value - close.value) / (peak.value - base.value) * 100 };
}

const pctClaim = (subject, measure, value, asOf, label) => claim({ subject, measure, asOf, figures: [{ value, unit: 'pct', basis: measure, label }] });

// How the stock's move stands to another of the same session, on the values as printed (one decimal).
function relationStem(stock, other) {
  const s = round1(stock), o = round1(other);
  if (s === o) return '와 같은 폭으로 움직였';
  if (s < 0 && o < 0) return s > o ? '보다 덜 내렸' : '보다 더 내렸';
  if (s > 0 && o > 0) return s > o ? '보다 더 올랐' : '보다 덜 올랐';
  if (s > 0) return '와 달리 올랐';
  if (s < 0) return '와 달리 내렸';
  return s > o ? '보다 강했' : '보다 약했';
}

function compareSaid(stock, other, subject, measure, session) {
  return say(`{lab} {m}${relationStem(stock, other.change)}`, { lab: other.label, m: pctClaim(subject, measure, other.change, session, other.label) });
}

function reboundSaid(read, symbol) {
  if (!read) return NOTHING;
  const slots = { d: shortDate(read.lowDate) };
  if (read.kind === 'no-rise') return say('{d} 저점 뒤로는 그날 종가를 넘어 마감한 적이 없습니다.', slots);
  const rise = pctClaim(`stock:${symbol}`, 'reboundRise', read.rise, read.session, symbol);
  if (read.kind === 'new-high') return say('{d} 저점 뒤 {r} 올라 그 뒤 가장 높은 종가로 마감했습니다.', { ...slots, r: rise });
  if (read.share >= 100) return say('{d} 저점 뒤 {r} 올랐다가 그 폭을 모두 되돌렸습니다.', { ...slots, r: rise });
  const share = claim({ subject: `stock:${symbol}`, measure: 'reboundGivenBack', asOf: read.session, figures: [{ value: read.share, unit: 'share', digits: 0, basis: 'reboundGivenBack', label: symbol }] });
  return say('{d} 저점 뒤 {r} 올랐다가 그 가운데 {g}를 되돌렸습니다.', { ...slots, r: rise, g: share });
}

/**
 * The line, or null when there is nothing to place the move against.
 * @param {{ symbol: string, row: object, themes?: object[], themeId?: string|null, rows?: object[], history?: object[],
 *   low?: {date:string}|null, bars?: object[]|null }} input
 *   `row`: the stock's screener row (ret1d, factorSessionDate); `themes`: the catalog the stock is read against
 *   (primary-theme.js themeCatalogFor) and `themeId` its primary theme; `low`: the active rebound's low (the opening's
 *   rebound unless it failed), else null; `bars`: the stock's completed daily bars once loaded.
 * @returns {{ text: string, claims: object[], parts: { theme: object|null, index: object|null, rebound: object|null } }|null}
 */
export function stockSessionTie({ symbol, row, themes = [], themeId = null, rows = [], history = [], low = null, bars = null } = {}) {
  const sym = String(symbol || '').toUpperCase();
  const session = day(row?.factorSessionDate);
  const change = readNumber(row?.ret1d);
  if (!sym || !session || change == null) return null;
  const market = themeMarketOf(sym) === 'KR' ? 'KR' : 'US';
  const theme = themeId ? themeSessionMove((Array.isArray(themes) ? themes : []).find((item) => item?.id === themeId), rows, session) : null;
  const index = indexSessionMove(history, market, session);
  const rebound = low ? reboundFromLow(bars, low, session) : null;
  const pieces = [theme ? compareSaid(change, { ...theme, label: `${theme.label} 테마` }, `theme:${theme.id}`, 'groupChange1d', session) : null,
    index ? compareSaid(change, index, index.id, 'change1d', session) : null].filter(Boolean);
  if (!pieces.length && !rebound) return null;
  const head = pieces.length ? say('{list}습니다.', { list: sayJoin(pieces, '고 ') }) : NOTHING;
  const said = sayJoin([head, reboundSaid(rebound, sym)], ' ');
  return said.text ? { ...said, parts: { theme, index, rebound } } : null;
}
