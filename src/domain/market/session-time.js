import { isoDay } from '../shared/session-date.js';
// P1170 (15 D04): 관측 시각의 의미 계약.
//
// 공급자의 일봉 timestamp는 그 세션 **바의 시작**이며, 종가로 계산한 팩터의 관측시각이 아니다.
// 이 구분이 없으면 "그날 개장 시점에 이미 종가 기반 결과를 알 수 있었다"는 의미가 만들어진다.
// 세션 날짜는 거래소 현지 시간대로 계산하고(DST 포함), 해석할 시각이 없으면 null로 닫는다 —
// 날짜만 주는 공급자를 가짜 정밀 timestamp로 승격하지 않는다.
export const MARKET_TIME_ZONE = Object.freeze({ US: 'America/New_York', KR: 'Asia/Seoul' });

// 2026-10-13 F07/V04: Tokyo and Taiwan listings (285A.T, 8035.T, 6702.T, 2454.TW) were read as US rows —
// USD currency, New York session date one day behind, inside US breadth. The listing suffix names the
// exchange; its local zone is declared here and the producer prefers the provider's exchange zone.
export const INTL_LISTING_TIME_ZONE = Object.freeze({ T: 'Asia/Tokyo', TW: 'Asia/Taipei', TWO: 'Asia/Taipei' });

function intlSuffixOf(symbol) {
  const match = /\.([A-Z]{1,3})$/i.exec(String(symbol || ''));
  const suffix = match ? match[1].toUpperCase() : null;
  return suffix && Object.prototype.hasOwnProperty.call(INTL_LISTING_TIME_ZONE, suffix) ? suffix : null;
}

// Two-market split kept for callers that bucket only US/KR (candidate archive, ranking anchors).
export function marketOfSymbol(symbol) {
  return /\.(KS|KQ)$/i.test(String(symbol || '')) ? 'KR' : 'US';
}

// Listing market including non-US/KR exchanges. INTL rows are not part of the US population.
export function listingMarketOfSymbol(symbol) {
  if (/\.(KS|KQ)$/i.test(String(symbol || ''))) return 'KR';
  return intlSuffixOf(symbol) ? 'INTL' : 'US';
}

export function timeZoneForSymbol(symbol) {
  const suffix = intlSuffixOf(symbol);
  return suffix ? INTL_LISTING_TIME_ZONE[suffix] : timeZoneForMarket(marketOfSymbol(symbol));
}

// A market key (US/KR) or an IANA zone such as the provider's exchangeTimezoneName.
export function timeZoneForMarket(market) {
  const text = String(market || '');
  if (/^[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(text)) return text;
  return MARKET_TIME_ZONE[text.toUpperCase()] || 'UTC';
}

// 세션 날짜 = 주어진 시각이 속한, 해당 시장의 달력상 날짜. 시각이 없으면 null.
export function isValidMarketDate(value) {
  if (!isoDay(value)) return false;
  const ms = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

// P1755: one formatter per time zone (construction dominated boot self-time, not formatting).
const SESSION_DATE_FORMATTERS = new Map();
function sessionDateFormatter(timeZone) {
  let formatter = SESSION_DATE_FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    SESSION_DATE_FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}

export function sessionDateInMarket(isoTimestamp, market) {
  // P1349: Date.parse normalizes impossible dates instead of rejecting them.
  if (!isValidMarketDate(String(isoTimestamp || '').slice(0, 10))) return null;
  const ms = Date.parse(isoTimestamp || '');
  if (!Number.isFinite(ms)) return null;
  try {
    return sessionDateFormatter(timeZoneForMarket(market)).format(new Date(ms));
  } catch (_) {
    return null;
  }
}

// 시장별 관측 범위. 혼합 시장의 전역 max 하나는 개별 종목의 최신성을 대표하지 못한다.
export function factorScopesByMarket(rows) {
  const scopes = {};
  const byDate = new Map();
  for (const [symbol, row] of Object.entries(rows || {})) {
    const barStart = row && row.factorBarStart;
    if (!barStart) continue;
    // INTL rows keep their own scope: a Tokyo bar must not advance the US session date.
    const market = listingMarketOfSymbol(symbol);
    const scope = scopes[market] || (scopes[market] = { timezone: market === 'INTL' ? 'exchange-local-per-row' : timeZoneForMarket(market), rows: 0, barStart: null, sessionDate: null });
    scope.rows += 1;
    const dates = byDate.get(scope) || byDate.set(scope, new Map()).get(scope);
    const key = row.factorSessionDate || '';
    const held = dates.get(key) || { rows: 0, barStart: null };
    held.rows += 1;
    if (!held.barStart || barStart > held.barStart) held.barStart = barStart;
    dates.set(key, held);
  }
  // v57.70 (2026-10-15 audit): the newest row set the market's session date, so five US names that printed 10/14 made
  // the screener read "미국 팩터 세션 10/14" while 897 of 903 rows (and the ranking) were still 10/13. The session is the
  // latest date that a majority of the market's rows carry, else the date most rows carry; its bar start goes with it.
  for (const scope of Object.values(scopes)) {
    const entries = [...byDate.get(scope).entries()].filter(([date]) => date).sort((a, b) => b[0].localeCompare(a[0]));
    const pick = entries.find(([, held]) => held.rows * 2 > scope.rows) || [...entries].sort((a, b) => b[1].rows - a[1].rows)[0];
    const fallback = [...byDate.get(scope).values()].reduce((latest, held) => (!latest || held.barStart > latest ? held.barStart : latest), null);
    scope.sessionDate = pick ? pick[0] : null;
    scope.barStart = pick ? pick[1].barStart : fallback;
    scope.sessionRows = pick ? pick[1].rows : 0;
  }
  return scopes;
}
