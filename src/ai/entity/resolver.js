// P1406 (Codex review 2026-10-03): candidate extraction and identity confirmation are separate.
// v1 matched names by substring ('애플리케이션' → AAPL, 'pineapple' → AAPL, '메타버스' → META),
// split 'BRK.B' and missed lowercase 'nvda'. A name now matches only as a whole word (English) or as
// the whole token / token + a Korean particle (Korean); a symbol is confirmed through the same
// registry functions the ticker screen uses (normalizeTickerInput, resolveRegisteredName). An
// all-caps symbol the registries do not know stays an entity but carries verified:false.
import { normalizeTickerInput } from '../../domain/entity/ticker-symbol.js';
import { resolveRegisteredName } from '../../domain/ticker/resolve-name.js';

export const AI_ENTITY_RESOLUTION_VERSION = 'ai-entity-resolution.v2';

// Used when the page registry is absent (Node tests, early boot). The registry wins when present.
const FALLBACK_NAMES = Object.freeze({
  엔비디아: 'NVDA', nvidia: 'NVDA', 애플: 'AAPL', apple: 'AAPL', 마이크로소프트: 'MSFT', microsoft: 'MSFT',
  테슬라: 'TSLA', tesla: 'TSLA', 아마존: 'AMZN', amazon: 'AMZN', 구글: 'GOOGL', 알파벳: 'GOOGL', alphabet: 'GOOGL',
  메타: 'META', 브로드컴: 'AVGO', broadcom: 'AVGO', 팔란티어: 'PLTR', palantir: 'PLTR',
  삼성전자: '005930.KS', sk하이닉스: '000660.KS', 현대차: '005380.KS'
});

// Sector and index words are topics, not company names; they keep prefix matching ('반도체주').
const MARKET_TERMS = Object.freeze({
  반도체: 'SMH', semiconductor: 'SMH', 소프트웨어: 'IGV', software: 'IGV', 나스닥: '^IXIC', nasdaq: '^IXIC',
  에스앤피: '^GSPC', 's&p': '^GSPC', sp500: '^GSPC', 달러인덱스: 'DX-Y.NYB', dxy: 'DX-Y.NYB',
  코스피: '^KS11', 코스닥: '^KQ11', krx: '^KS11'
});

const NON_TICKER_SYMBOLS = new Set([
  'AI', 'API', 'SEC', 'FOMC', 'FED', 'PER', 'PBR', 'PSR', 'PEG', 'ROE', 'ROA', 'IT', 'IPO', 'ESG', 'CEO', 'CFO',
  'RSI', 'MACD', 'CPI', 'PCE', 'NFP', 'GDP', 'VIX', 'ETF', 'FX', 'USD', 'KRW', 'JPY', 'EUR', 'US', 'KR', 'UK', 'EU',
  'DCF', 'TAM', 'CAGR', 'FCF', 'EPS', 'EBIT', 'EBITDA', 'IV', 'GEX', 'ATM', 'OTM', 'HBM', 'GPU', 'CPU', 'OK'
]);

// Lowercase words that are also listed symbols ('now' = ServiceNow, 'all' = Allstate). A lowercase
// token is a symbol only when it is a registry key and not one of these words.
const COMMON_WORDS = new Set(['now', 'all', 'are', 'see', 'key', 'low', 'big', 'car', 'fun', 'net', 'one', 'two', 'new', 'for', 'and',
  'the', 'has', 'was', 'can', 'coin', 'gold', 'cash', 'open', 'well', 'good', 'next', 'real', 'main', 'fast', 'live', 'peak', 'life',
  'what', 'why', 'how', 'when', 'who', 'is', 'it', 'on', 'in', 'at', 'to', 'of', 'or', 'by', 'up', 'me', 'my', 'we', 'so', 'go', 'do', 'be']);

const KOREAN_PARTICLES = ['', '은', '는', '이', '가', '을', '를', '의', '와', '과', '도', '에', '에서', '로', '으로', '랑', '이랑', '하고', '만', '주', '까지', '보다', '처럼'];

function text(value) { return String(value == null ? '' : value).trim(); }
const HANGUL = /[가-힣]/;
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function registryEntries(root) {
  const entries = root?.AIO_TICKER_NAME_REGISTRY?.entries;
  return entries && typeof entries === 'object' ? entries : null;
}

function knownSymbol(symbol, root, entries) {
  const upper = symbol.toUpperCase();
  const variants = [upper, upper.replace('.', '-'), upper.replace('-', '.')];
  if (entries && variants.some((variant) => entries[variant])) return variants.find((variant) => entries[variant]);
  const screener = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : [];
  const row = screener.find((item) => variants.includes(String(item?.sym || '').toUpperCase()));
  return row ? String(row.sym).toUpperCase() : null;
}

// A Korean name matches a token that is the name itself or the name plus a particle.
function koreanTokenMatches(token, name) {
  if (!token.startsWith(name)) return false;
  return KOREAN_PARTICLES.includes(token.slice(name.length));
}

function englishPhraseMatches(lower, name) {
  return new RegExp(`(^|[^a-z0-9])${escape(name)}(?=$|[^a-z0-9])`).test(lower);
}

export function resolveEntities(query, { root = globalThis, route = null } = {}) {
  const source = text(query);
  const lower = source.toLowerCase();
  const entries = registryEntries(root);
  const krStockDb = root?.KR_STOCK_DB && typeof root.KR_STOCK_DB === 'object' ? root.KR_STOCK_DB : {};
  const found = new Map();
  const add = (symbol, alias = null, kind = 'ticker', verified = true) => {
    const normalized = text(symbol).toUpperCase();
    if (!normalized || NON_TICKER_SYMBOLS.has(normalized) || found.has(normalized)) return;
    const isKr = /\.KS$|\.KQ$/.test(normalized) || /^\^(?:KS11|KQ11)$/i.test(normalized);
    found.set(normalized, Object.freeze({ symbol: normalized, alias: alias || normalized, kind, verified, market: isKr ? 'KR' : normalized.startsWith('^') ? 'INDEX' : 'US' }));
  };
  const tokens = source.split(/[\s,;!?·/()\[\]"“”]+/).map((token) => token.replace(/^[.'’]+|[.'’]+$/g, '')).filter(Boolean);

  // 1. Symbol-shaped tokens: KRX codes, Yahoo-style suffixes, BRK.B-style classes, index carets.
  for (const token of tokens) {
    const krx = token.match(/^(\d{6})(?:\.(KS|KQ))?/i);
    if (krx) { add(normalizeTickerInput(krx[0], { krStockDb, krToYahoo: root?.krTickerToYahoo }), krx[0], 'ticker'); continue; }
    const shaped = token.match(/^(\^?[A-Za-z]{1,6}(?:[.-][A-Za-z]{1,2})?)(?=$|[가-힣])/);
    if (!shaped) continue;
    const raw = shaped[1];
    const upper = raw.toUpperCase();
    if (NON_TICKER_SYMBOLS.has(upper)) continue;
    const confirmed = knownSymbol(upper, root, entries);
    if (raw === upper) {
      // Typed in capitals: a deliberate symbol. Unknown ones stay, marked unverified.
      if (confirmed) add(confirmed, raw, 'ticker');
      else if (upper.length >= 2 || upper.startsWith('^')) add(upper, raw, 'ticker', false);
    } else if (confirmed && upper.length >= 3 && !COMMON_WORDS.has(raw.toLowerCase()) && entries?.[confirmed]) {
      add(confirmed, raw, 'ticker');
    }
  }

  // 2. Company names through the registry (exact word / token + particle), then the fallback list.
  const nameMatches = [];
  const consider = (name, symbol) => {
    const value = text(name);
    if (!value || value.length < 2) return;
    const hit = HANGUL.test(value)
      ? tokens.some((token) => koreanTokenMatches(token, value))
      // A name spelled like its own symbol ('aapl', 'coin', 'meta') is handled as a symbol in step 1.
      : value.length >= 3 && value.toLowerCase() !== String(symbol).toLowerCase() && !COMMON_WORDS.has(value.toLowerCase()) && englishPhraseMatches(lower, value.toLowerCase());
    if (hit) nameMatches.push([value, symbol]);
  };
  if (entries) {
    for (const [symbol, entry] of Object.entries(entries)) {
      [entry?.en, entry?.kr, ...(Array.isArray(entry?.alt) ? entry.alt : [])].forEach((name) => consider(name, symbol));
    }
  }
  Object.entries(FALLBACK_NAMES).forEach(([name, symbol]) => consider(name, symbol));
  for (const [code, info] of Object.entries(krStockDb)) {
    if (info?.name && HANGUL.test(info.name) && tokens.some((token) => koreanTokenMatches(token, String(info.name).replace(/\s+/g, '')))) {
      nameMatches.push([info.name, normalizeTickerInput(code, { krStockDb, krToYahoo: root?.krTickerToYahoo })]);
    }
  }
  for (const [name, symbol] of nameMatches) {
    const resolved = entries ? (resolveRegisteredName(symbol, entries) || symbol) : symbol;
    add(resolved, name, 'alias');
  }

  // 3. Sector / index topics.
  Object.entries(MARKET_TERMS).forEach(([term, symbol]) => {
    if (HANGUL.test(term) ? tokens.some((token) => token.startsWith(term)) : englishPhraseMatches(lower, term)) add(symbol, term, 'alias');
  });

  const sectorTerms = ['반도체', '소프트웨어', 'software', 'semiconductor', '섹터', 'sector', '환율', 'fx'];
  const resolvedAliases = new Set([...found.values()].map((entity) => text(entity.alias).toLowerCase()).filter(Boolean));
  const unresolvedTerms = tokens
    .map((term) => term.replace(/[.()\[\]]/g, ''))
    .filter((term) => term.length >= 2 && !/^\d+$/.test(term) && !sectorTerms.includes(term.toLowerCase()))
    .filter((term) => !found.has(term.toUpperCase()))
    .filter((term) => ![...resolvedAliases].some((alias) => term.toLowerCase().startsWith(alias)))
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
