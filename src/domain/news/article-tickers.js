// The issuers a news article names — moved from js/aio-data.js extractTickers(item) with its word
// gates and the broker-attribution rule. The symbol list and the name map are the
// shell's data (js/aio-data.js KNOWN_TICKERS and KR_TICKER_MAP), handed in by src/app/compatibility-globals.js, which
// installs the legacy name extractTickers. A question's tickers are a different reading: src/ai/entity/chat-tickers.js.

// v39.2: symbols that are English words ('ARM', 'KEYS') count only as $TICKER or (TICKER).
const WORD_SYMBOLS = new Set(['ARM', 'ON', 'IT', 'A', 'F', 'V', 'C', 'U', 'X', 'D', 'E', 'K', 'T', 'ALL', 'RUN', 'LOW', 'KEY', 'FAST', 'REAL',
  'PLAY', 'FLEX', 'CAN', 'GE', 'HD', 'DE', 'BE', 'HAS', 'KEYS', 'TEL', 'TER', 'APH', 'CLS', 'JBL', 'DELL', 'AI']);
// Officer titles and agencies are listed symbols too ('Former FTX COO' opened CooperCompanies).
const ROLE_ACRONYM = /^(?:C[A-Z]O|EVP|SVP|VP|GM|IPO|ETF|SEC|FDA|DOJ|FTC|NIH|EPA|ECB|IMF|GDP|CPI)$/;
// v30.12 / v46.6 / v48.20: symbols that need a market word within 80 characters.
const AMBIGUOUS = new Set(['AI', 'META', 'COST', 'SNOW', 'NET', 'PATH', 'APP', 'DASH', 'SHOP', 'SNAP', 'HOOD', 'SOFI', 'WOLF', 'COIN', 'RIOT',
  'HUT', 'GOLD', 'VALE', 'LINK', 'DOT', 'MATIC', 'UNI', 'MS', 'BA', 'MP', 'PL', 'NU', 'NOW', 'BEAM', 'OPEN', 'NEXT', 'SAIL', 'FIVE', 'PLUG',
  'RUN', 'GRAB', 'BILL', 'SPOT', 'FLEX', 'CELL', 'ARE', 'HOLD', 'RARE', 'REAL', 'TRUE', 'LIFE', 'BEST', 'SAFE']);
const MARKET_WORDS = ['stock', 'share price', 'share', 'earnings', 'rally', 'surge', 'ipo', 'm&a', 'analyst', 'quarterly', 'q1 ', 'q2 ', 'q3 ',
  'q4 ', 'revenue', 'eps', 'dividend', 'buyback', 'market cap', 'upgrade', 'downgrade', 'price target', 'valuation', 'pe ratio', 'p/e',
  'guidance', 'outlook', 'margin', 'revenue growth', 'beat', 'miss', 'overweight', 'underweight', 'outperform', 'buy rating', 'sell rating',
  '주가', '주식', '매출', '실적', '급등', '급락', '목표가', '배당', '시가총액', '투자의견', '상향', '하향', '매수', '매도', '비중확대'];

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const marked = (symbol, text) => text.includes(`$${symbol}`) || text.includes(`(${symbol})`);

// v39.2 / P182: one compiled word pattern per symbol, bounded (800+ symbols × 80 articles).
const patterns = new Map();
function wordPattern(word) {
  let re = patterns.get(word);
  if (!re) {
    re = new RegExp(`\\b${escape(word)}\\b`);
    if (patterns.size >= 600) patterns.delete(patterns.keys().next().value);
    patterns.set(word, re);
  }
  return re;
}

/** A symbol that is a word or a title stands only as $TICKER or (TICKER); the translated-ticker cache passes the same gate. */
export function articleSymbolAllowed(symbol, text) {
  return !(WORD_SYMBOLS.has(symbol) || ROLE_ACRONYM.test(symbol)) || marked(symbol, text);
}

function inMarketContext(symbol, text) {
  if (marked(symbol, text) || !AMBIGUOUS.has(symbol)) return true;
  const at = text.indexOf(symbol);
  if (at < 0) return false;
  const context = text.toLowerCase().slice(Math.max(0, at - 80), at + symbol.length + 80);
  return MARKET_WORDS.some((word) => context.includes(word));
}

// A one- or two-syllable Korean alias needs a non-Hangul edge and an end or a particle ('모델'의 '델' is not DELL).
function koreanAliasIn(lowerText, alias) {
  if (!lowerText.includes(alias)) return false;
  if (alias.length >= 3 || !/^[가-힣]+$/.test(alias)) return true;
  return new RegExp(`(?:^|[^가-힣])${escape(alias)}(?:$|[^가-힣]|(?:은|는|이|가|을|를|의|도|와|과|에|로|만)(?:$|[^가-힣]))`).test(lowerText);
}

// A broker cited as the source of a view ("..., Morgan Stanley says") is not the story's subject.
function isAttribution(lowerText, name) {
  if (!/[a-z]/.test(name) || name.length < 4) return false;
  const n = escape(name);
  return new RegExp(`(?:according to|says|said|by|from|at|via|per)\\s+${n}|${n}(?:'s)?\\s+(?:analysts?|strategists?|economists?|says|said|note|notes|sees|expects|upgrades?|downgrades?|raises|cuts|rates|initiates|reiterates)`).test(lowerText);
}

/** Up to five issuers of `item` (title + desc): $TICKER, then listed symbols in market context, then names and aliases. */
export function articleTickers(item, { knownTickers = new Set(), nameMap = {} } = {}) {
  const text = `${item?.title || ''} ${item?.desc || ''}`;
  const found = new Set();
  for (const m of text.match(/\$([A-Z]{1,5})\b/g) || []) if (knownTickers.has(m.slice(1)) && found.size < 5) found.add(m.slice(1));
  for (const symbol of knownTickers) {
    if (found.size >= 5) break;
    // Every word pattern needs this literal substring; absent symbols never touch the pattern cache.
    if (found.has(symbol) || !text.includes(symbol)) continue;
    if (symbol.length <= 2 && !text.includes(`$${symbol}`)) continue;
    if (articleSymbolAllowed(symbol, text) && wordPattern(symbol).test(text) && inMarketContext(symbol, text)) found.add(symbol);
  }
  // An English alias keeps word edges ('Artificial Intelligence' is not INTC); a Korean one uses koreanAliasIn.
  const lowerText = text.toLowerCase();
  for (const [name, symbol] of Object.entries(nameMap)) {
    if (found.size >= 5) break;
    const alias = String(name).toLowerCase();
    if (/[^a-z0-9]/.test(alias)) {
      if (koreanAliasIn(lowerText, alias) && !isAttribution(lowerText, alias)) found.add(symbol);
    } else if (alias.length > 2 && lowerText.includes(alias) && wordPattern(alias).test(lowerText) && !isAttribution(lowerText, alias)) {
      found.add(symbol);
    }
  }
  return [...found];
}
