export const AI_ENTITY_RESOLUTION_VERSION = 'ai-entity-resolution.v1';

const ALIASES = Object.freeze({
  엔비디아: 'NVDA', nvidia: 'NVDA', 애플: 'AAPL', apple: 'AAPL', 마이크로소프트: 'MSFT', microsoft: 'MSFT',
  테슬라: 'TSLA', tesla: 'TSLA', 아마존: 'AMZN', amazon: 'AMZN', 구글: 'GOOGL', 알파벳: 'GOOGL', alphabet: 'GOOGL',
  메타: 'META', meta: 'META', 브로드컴: 'AVGO', broadcom: 'AVGO', 팔란티어: 'PLTR', palantir: 'PLTR',
  반도체: 'SMH', semiconductor: 'SMH', 소프트웨어: 'IGV', software: 'IGV', 나스닥: '^IXIC', nasdaq: '^IXIC',
  에스앤피: '^GSPC', 's&p': '^GSPC', sp500: '^GSPC', 달러인덱스: 'DX-Y.NYB', dxy: 'DX-Y.NYB',
  삼성전자: '005930.KS', sk하이닉스: '000660.KS', 현대차: '005380.KS',
  코스피: '^KS11', 코스닥: '^KQ11', krx: '^KS11'
});

function text(value) { return String(value == null ? '' : value).trim(); }

function registrySymbols(root) {
  const entries = root?.AIO_TICKER_NAME_REGISTRY?.entries;
  return new Set(Object.keys(entries || {}).map((symbol) => symbol.toUpperCase()));
}

export function resolveEntities(query, { root = globalThis, route = null } = {}) {
  const source = text(query);
  const lower = source.toLowerCase();
  const known = registrySymbols(root);
  const found = new Map();
  const add = (symbol, alias = null, kind = 'ticker') => {
    const normalized = text(symbol).toUpperCase();
    if (!normalized || found.has(normalized)) return;
    const isKr = /\.KS$|\.KQ$/.test(normalized) || /^\^(?:KS11|KQ11)$/i.test(normalized);
    found.set(normalized, { symbol: normalized, alias: alias || normalized, kind, market: isKr ? 'KR' : normalized.startsWith('^') ? 'INDEX' : 'US' });
  };
  const tickerPattern = /\b(?:[A-Z]{1,6}(?:\.(?:KS|KQ|T|TW|HK))?|\^?[A-Z]{2,6}|\d{6}\.(?:KS|KQ))\b/g;
  (source.match(tickerPattern) || []).forEach((symbol) => {
    const upper = symbol.toUpperCase();
    if (known.size === 0 || known.has(upper) || /^\^|\.|^[A-Z]{2,6}$/.test(upper)) add(upper, symbol, 'ticker');
  });
  Object.entries(ALIASES).forEach(([alias, symbol]) => {
    if (lower.includes(alias.toLowerCase())) add(symbol, alias, alias === symbol.toLowerCase() ? 'ticker' : 'alias');
  });
  const sectorTerms = ['반도체', '소프트웨어', 'software', 'semiconductor', '섹터', 'sector', '환율', 'fx'];
  const unresolvedTerms = source
    .split(/[\s,;!?·]+/)
    .map((term) => term.replace(/[.()\[\]]/g, ''))
    .filter((term) => term.length >= 2 && !/^\d+$/.test(term) && !sectorTerms.includes(term.toLowerCase()))
    .filter((term) => !found.has(term.toUpperCase()))
    .filter((term) => !/^(현재|지금|오늘|분석|알려줘|왜|어때|해줘|please|what|why|is|the)$/i.test(term))
    .slice(0, 8);
  return Object.freeze({
    resolutionVersion: AI_ENTITY_RESOLUTION_VERSION,
    entities: Object.freeze([...found.values()]),
    unresolvedTerms: Object.freeze(unresolvedTerms),
    ambiguous: found.size === 0 && /종목|기업|주식|티커|stock|company/i.test(source),
    route: route || null
  });
}
