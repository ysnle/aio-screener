// v57.48 expert review #4 (2026-10-13): the chat's "X% 추가" simulation summed native price × quantity across
// currencies (₩1,000,000 and $1,000 read as 99.9 : 0.1) and always printed "현재 총 가치: $…". It now reads the
// portfolio surface's base-currency values (P1407/P1445 — the same values the portfolio screen shows), holds the
// simulation when the currencies are mixed without declared rates or a holding has no base value, and labels every
// amount with the base currency. Pure: the legacy chat adapter passes positions, the surface and the target quote.

const SYMBOLS = Object.freeze({ USD: '$', KRW: '₩', EUR: '€', JPY: '¥' });

export function currencySymbol(code) {
  const key = String(code || '').toUpperCase();
  return SYMBOLS[key] || (key ? `${key} ` : '');
}

/** "AAPL 10% 추가하면" -> 10. Returns null when the question is not an addition simulation. */
export function additionPercent(query) {
  const match = String(query || '').toLowerCase().match(/(\d+\.?\d*)\s*(%|퍼센트|percent)\s*(추가|매수|늘리|increase|add|buy)/i);
  const value = match ? Number(match[1]) : null;
  return value && value > 0 && value <= 100 ? value : null;
}

function quoteCurrency(target, quote) {
  const declared = String(quote?.currency || quote?.quoteEnvelope?.currency || '').trim().toUpperCase();
  if (declared && declared !== 'UNKNOWN') return declared;
  return /\.(KS|KQ)$/i.test(String(target || '')) ? 'KRW' : null;
}

export function simulatePortfolioAddition({ query, target, positions = [], surface = null, targetQuote = null } = {}) {
  const percentToAdd = additionPercent(query);
  const symbol = String(target || '').toUpperCase();
  if (!percentToAdd || !symbol) return null;
  const held = (reason) => ({ target: symbol, percentToAdd, available: false, reason, note: reason });
  // One row per symbol: two lots of the same ticker are one holding for weights.
  const qtyBySymbol = new Map();
  for (const position of Array.isArray(positions) ? positions : []) {
    const key = String(position?.ticker || '').toUpperCase();
    const qty = Number(position?.qty) || 0;
    if (key && qty > 0) qtyBySymbol.set(key, (qtyBySymbol.get(key) || 0) + qty);
  }
  if (!qtyBySymbol.size) return held('포트폴리오 비어 있음 — 보유 종목 추가 후 시뮬레이션 가능 (PIN 잠금 상태도 대상으로 계산하지 않는다)');
  if (!surface || !Array.isArray(surface.rows)) return held('포트폴리오 평가액(기준 통화)이 아직 계산되지 않아 시뮬레이션을 보류합니다');
  if (surface.currencyState === 'mixed-without-conversion') return held('통화가 다른 종목이 섞여 있고 환율이 선언되지 않아 시뮬레이션을 보류합니다');
  const rowCurrencies = [...new Set(surface.rows.map((row) => row?.currency || row?.listingCurrency).filter(Boolean))];
  const currency = surface.baseCurrency || surface.declaredBaseCurrency || (rowCurrencies.length === 1 ? rowCurrencies[0] : null);
  if (!currency) return held('기준 통화를 확인할 수 없어 시뮬레이션을 보류합니다');
  const valueBySymbol = new Map();
  for (const row of surface.rows) {
    const key = String(row?.symbol || row?.ticker || '').toUpperCase();
    const value = Number(row?.value);
    if (!key) continue;
    valueBySymbol.set(key, Number.isFinite(value) && value > 0 && valueBySymbol.get(key) !== null ? (valueBySymbol.get(key) || 0) + value : null);
  }
  const missing = [...qtyBySymbol.keys()].filter((key) => valueBySymbol.get(key) == null);
  if (missing.length) return held(`평가액(기준 통화) 미확인 보유 종목: ${missing.join(', ')} — 0으로 보지 않고 보류합니다`);
  const currentTotal = [...qtyBySymbol.keys()].reduce((sum, key) => sum + valueBySymbol.get(key), 0);
  if (!(currentTotal > 0)) return null;
  // The unit price must be in the base currency too: a holding's base value per share, or a new ticker's quote only
  // when its currency is the base currency (no silent FX).
  const heldQty = qtyBySymbol.get(symbol) || 0;
  const livePrice = Number(targetQuote?.price);
  const targetPrice = heldQty ? valueBySymbol.get(symbol) / heldQty
    : Number.isFinite(livePrice) && livePrice > 0 && quoteCurrency(symbol, targetQuote) === currency ? livePrice : null;
  if (!targetPrice) return held(heldQty || !(livePrice > 0) ? '시세 미수신(대상 종목)' : `대상 종목의 시세 통화가 기준 통화(${currency})와 달라 시뮬레이션을 보류합니다`);
  const addAmount = currentTotal * (percentToAdd / 100);
  const addQty = Math.floor(addAmount / targetPrice);
  const addValue = addQty * targetPrice;
  const newTotal = currentTotal + addValue;
  const pct = (value, total) => +(value / total * 100).toFixed(2);
  const weights = [...qtyBySymbol.keys()].map((key) => {
    const current = valueBySymbol.get(key);
    const next = key === symbol ? current + addValue : current;
    return { symbol: key, currentPct: pct(current, currentTotal), newPct: pct(next, newTotal), change: +((next / newTotal - current / currentTotal) * 100).toFixed(2) };
  });
  if (!heldQty) weights.push({ symbol, currentPct: 0, newPct: pct(addValue, newTotal), change: pct(addValue, newTotal) });
  return {
    target: symbol, percentToAdd, available: true, currency, currencySymbol: currencySymbol(currency),
    targetPrice, addAmount: Math.round(addAmount), addQty, currentTotal: Math.round(currentTotal), newTotal: Math.round(newTotal), weights,
    note: `기준 통화 ${currency} 평가액 기준. currentPct → newPct 가중치 변화. addQty = floor(addAmount / targetPrice)로 정수 주식 수만 시뮬레이션.`
  };
}
