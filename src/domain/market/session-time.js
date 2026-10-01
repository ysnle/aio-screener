// P1170 (15 D04): 관측 시각의 의미 계약.
//
// 공급자의 일봉 timestamp는 그 세션 **바의 시작**이며, 종가로 계산한 팩터의 관측시각이 아니다.
// 이 구분이 없으면 "그날 개장 시점에 이미 종가 기반 결과를 알 수 있었다"는 의미가 만들어진다.
// 세션 날짜는 거래소 현지 시간대로 계산하고(DST 포함), 해석할 시각이 없으면 null로 닫는다 —
// 날짜만 주는 공급자를 가짜 정밀 timestamp로 승격하지 않는다.
export const MARKET_TIME_ZONE = Object.freeze({ US: 'America/New_York', KR: 'Asia/Seoul' });

export function marketOfSymbol(symbol) {
  return /\.(KS|KQ)$/i.test(String(symbol || '')) ? 'KR' : 'US';
}

export function timeZoneForMarket(market) {
  return MARKET_TIME_ZONE[String(market || '').toUpperCase()] || 'UTC';
}

// 세션 날짜 = 주어진 시각이 속한, 해당 시장의 달력상 날짜. 시각이 없으면 null.
export function isValidMarketDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const ms = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function sessionDateInMarket(isoTimestamp, market) {
  // P1349: Date.parse normalizes impossible dates instead of rejecting them.
  if (!isValidMarketDate(String(isoTimestamp || '').slice(0, 10))) return null;
  const ms = Date.parse(isoTimestamp || '');
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZoneForMarket(market),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(ms));
  } catch (_) {
    return null;
  }
}

// 시장별 관측 범위. 혼합 시장의 전역 max 하나는 개별 종목의 최신성을 대표하지 못한다.
export function factorScopesByMarket(rows) {
  const scopes = {};
  for (const [symbol, row] of Object.entries(rows || {})) {
    const barStart = row && row.factorBarStart;
    if (!barStart) continue;
    const market = marketOfSymbol(symbol);
    const scope = scopes[market] || (scopes[market] = { timezone: timeZoneForMarket(market), rows: 0, barStart: null, sessionDate: null });
    scope.rows += 1;
    if (!scope.barStart || barStart > scope.barStart) scope.barStart = barStart;
    if (row.factorSessionDate && (!scope.sessionDate || row.factorSessionDate > scope.sessionDate)) scope.sessionDate = row.factorSessionDate;
  }
  return scopes;
}
