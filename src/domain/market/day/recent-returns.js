// How far a stock or a sub-theme rebounded or gave back between two recent sessions, from the screener's per-stock
// daily returns (`rets`: the last RULES.recentReturns.sessions completed sessions in %, oldest first, the last one dated
// by the row's own factorSessionDate) and the artifact's `retDatesByMarket`. Returns only: no close or price level is
// published or rebuilt here, so a span is the compounded product of the daily returns inside it.
//
// The ledger block (market-day.json `recent`) is { dates: { US: [...], KR: [...] }, rows: { SYM: rets[] } }, each row
// already placed on its market's date list. A sentence reads it through returnBetween / medianBetween.
import { RULES } from '../../rules/thresholds.js';
import { finiteNumber } from '../../shared/number.js';
import { isIsoDay } from '../../shared/session-date.js';
import { listingMarketOfSymbol } from '../session/session-time.js';
import { median } from '../../themes/theme-medians.js';
import { expandScreenerArtifact } from '../../../data/screener-extended.js';

const SESSIONS = RULES.recentReturns.sessions;
const round2 = (value) => Math.round(value * 100) / 100;

/** A published `rets` value as an array of SESSIONS finite-or-null numbers; anything else is null (absent field). */
export function readRecentReturns(value) {
  if (!Array.isArray(value) || value.length !== SESSIONS) return null;
  return value.map((item) => finiteNumber(item));
}

/** Problems with one row's `rets` (empty when it keeps the contract or carries none). */
export function recentReturnsRowErrors(row = {}) {
  if (row.rets === undefined) return [];
  if (!Array.isArray(row.rets) || row.rets.length !== SESSIONS) return [`rets must hold ${SESSIONS} values`];
  return row.rets.every((value) => value === null || (typeof value === 'number' && Number.isFinite(value))) ? [] : ['rets values must be finite numbers or null'];
}

/** Problems with the artifact's `retDatesByMarket` (empty when absent or well formed). */
export function recentReturnDatesErrors(retDatesByMarket) {
  if (retDatesByMarket === undefined) return [];
  if (!retDatesByMarket || typeof retDatesByMarket !== 'object' || Array.isArray(retDatesByMarket)) return ['retDatesByMarket must be an object of date lists'];
  const errors = [];
  for (const [market, dates] of Object.entries(retDatesByMarket)) {
    if (!Array.isArray(dates) || dates.length !== SESSIONS) { errors.push(`retDatesByMarket.${market} must hold ${SESSIONS} dates`); continue; }
    if (dates.some((date, index) => !isIsoDay(date) || (index && date <= dates[index - 1]))) errors.push(`retDatesByMarket.${market} must be ascending ISO dates`);
  }
  return errors;
}

/**
 * The row's returns placed on its market's date list: copied as is when the row is on the list's last date, shifted when
 * it is an older (carried) row, with the sessions it has no return for left null. Null when the row's date is not on the
 * list or it carries no returns.
 */
export function alignedReturns(rets, sessionDate, dates) {
  const values = readRecentReturns(rets);
  const at = Array.isArray(dates) ? dates.indexOf(sessionDate) : -1;
  if (!values || at < 0 || dates.length !== SESSIONS) return null;
  const shift = dates.length - 1 - at;
  return dates.map((_, index) => (index <= at ? values[index + shift] : null));
}

// The Korean theme(s) of js/aio-kr-data.js KR_THEME_MAP the story compares with the US chip names (SK hynix, Samsung).
export const KR_RECENT_THEME_IDS = Object.freeze(['semi']);

/**
 * The symbols the story can name: every US theme's leaders and sub-theme tickers, and the Korean semiconductor names
 * (KR_THEME_MAP lists bare codes; the listing is whichever of `.KS` / `.KQ` the screener carries).
 */
export function recentReturnSymbols({ themes = [], krThemeMap = {}, data = {} } = {}) {
  const out = new Set();
  for (const theme of Array.isArray(themes) ? themes : []) {
    for (const sym of theme?.leaders || []) out.add(sym);
    for (const part of theme?.subThemes || []) for (const sym of part?.tickers || []) out.add(sym);
  }
  for (const id of KR_RECENT_THEME_IDS) {
    for (const item of Array.isArray(krThemeMap?.[id]) ? krThemeMap[id] : []) {
      const code = String(item?.code || '');
      const sym = [`${code}.KS`, `${code}.KQ`].find((candidate) => data[candidate]);
      if (code && sym) out.add(sym);
    }
  }
  return [...out];
}

/**
 * The ledger block for the symbols the story can name (recentReturnSymbols of `themes` / `krThemeMap`). Null — the
 * ledger omits it — when the screener publishes no returns. Reads the screener through expandScreenerArtifact: in the
 * row-defaults encoding a factorSessionDate most rows share lives in the defaults, not on the row.
 */
export function recentReturnsLedger(screener, { themes = [], krThemeMap = {} } = {}) {
  const dates = screener?.retDatesByMarket;
  if (!dates || typeof dates !== 'object' || recentReturnDatesErrors(dates).length) return null;
  const data = expandScreenerArtifact(screener)?.data || {};
  const rows = {};
  for (const sym of recentReturnSymbols({ themes, krThemeMap, data })) {
    const row = data[sym];
    const aligned = row ? alignedReturns(row.rets, row.factorSessionDate, dates[listingMarketOfSymbol(sym)]) : null;
    if (aligned) rows[sym] = aligned;
  }
  if (!Object.keys(rows).length) return null;
  return { dates: Object.fromEntries(Object.entries(dates).filter(([market]) => market === 'US' || market === 'KR')), rows };
}

/**
 * The session of `market` that answers a close of `frame` on `date` — the first one whose close comes after it.
 * Same market: the date itself. US date → KR: the first Korean session dated after it (Korea's close dated D comes
 * about 14 hours before the US close of D, so the Korean session dated D is still answering the US session before).
 * KR date → US: the first US session dated on or after it (the US close of D comes after Korea's close of D).
 */
export function answeringSession(dates, market, frame, date) {
  if (!Array.isArray(dates) || !dates.length || !isIsoDay(date)) return null;
  if (market === frame) return dates.includes(date) ? date : null;
  // Before the window, a session between `date` and the window's first date would be unseen.
  if (date < dates[0]) return null;
  const after = market === 'KR' && frame === 'US' ? (day) => day > date : (day) => day >= date;
  return dates.find(after) || null;
}

/**
 * A symbol's compounded return (%, 2 decimals) over the sessions after `fromDate` through `toDate`, both given on the
 * calendar of `frame` ('US' | 'KR'). A symbol of the other market is read on its own sessions that answer those dates
 * (answeringSession); when its market has not yet traded after `toDate`, the span ends on its latest session and
 * `endsBefore` says so. Returns { symbol, market, value, from, to, sessions, endsBefore } — `from`/`to` are the
 * symbol's own session dates, for the sentence to print. Null when a date is outside the window, the span is empty,
 * or any return inside it is missing.
 */
export function returnBetween(recent, symbol, frame, fromDate, toDate) {
  const market = listingMarketOfSymbol(symbol);
  const dates = recent?.dates?.[market];
  const rets = recent?.rows?.[symbol];
  if (!Array.isArray(dates) || !Array.isArray(rets) || rets.length !== dates.length) return null;
  const from = answeringSession(dates, market, frame, fromDate);
  let to = answeringSession(dates, market, frame, toDate);
  let endsBefore = false;
  // Only the end may run past the window, and only for the other market: it has not answered toDate yet.
  if (!to && market !== frame && isIsoDay(toDate) && dates[dates.length - 1] <= toDate) { to = dates[dates.length - 1]; endsBefore = true; }
  if (!from || !to || to <= from) return null;
  const span = rets.slice(dates.indexOf(from) + 1, dates.indexOf(to) + 1);
  if (!span.length || span.some((value) => finiteNumber(value) == null)) return null;
  const growth = span.reduce((product, value) => product * (1 + value / 100), 1);
  return { symbol, market, value: round2((growth - 1) * 100), from, to, sessions: span.length, endsBefore };
}

/**
 * The median of the members' returnBetween values (%, 2 decimals), with each member's own reading. Null below
 * RULES.recentReturns.groupMinMembers members with a value. `from`/`to` are shared dates when every member read the
 * same span, else null (each member keeps its own).
 */
export function medianBetween(recent, symbols, frame, fromDate, toDate) {
  const members = [...new Set(symbols || [])].map((symbol) => returnBetween(recent, symbol, frame, fromDate, toDate)).filter(Boolean);
  const value = median(members.map((member) => member.value), { minCount: RULES.recentReturns.groupMinMembers });
  if (value == null) return null;
  const same = (key) => (members.every((member) => member[key] === members[0][key]) ? members[0][key] : null);
  return { value: round2(value), count: members.length, from: same('from'), to: same('to'), members };
}
