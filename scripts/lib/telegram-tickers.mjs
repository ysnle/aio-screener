// P1544: ticker symbols in Telegram posts are matched case-sensitively; only company/product names are
// case-insensitive. The previous /i flag on `\bBE\b|\bMU\b|\bCAT\b|\bMETA\b|\bLITE\b` tagged ordinary
// English ("to be", "mu", "cat", "meta", "lite") with tickers, which the digest then counted as catalysts.
const SYMBOL_PART = /^(?:\\b)?[A-Z][A-Z0-9]{1,5}(?:\\b)?$/;

// 2026-10-13 news audit N16: product names (TPU, Trainium, Gemini, SOFC, MI450, Copilot) say which company a
// post is RELATED to, not who published or is the subject of it; they live in RELATED_PATTERNS and never count
// toward the issuer tally (tickerCounts/catalysts).
// v57.88 (screen audit): Korean company names for posts that never write the English one ('마이크론 타이중 신공장').
const TICKER_PATTERNS = [
  ['NVDA', /\bNVDA\b|nvidia|엔비디아/i], ['AMD', /\bAMD\b|Advanced Micro/i],
  ['TSLA', /\bTSLA\b|Tesla|테슬라/i], ['CAT', /\bCAT\b|Caterpillar/i], ['AMAT', /\bAMAT\b|Applied Materials/i],
  // The companies behind the product names below also carry their Korean names, so a Korean post that names the
  // company ("구글 … Gemini") keeps it as the issuer instead of a product-only relation.
  ['AAPL', /\bAAPL\b|\bApple\b/i], ['MSFT', /\bMSFT\b|\bMicrosoft\b|Azure|마이크로소프트/i],
  ['GOOG', /\bGOOG\b|\bGOOGL\b|Google|Alphabet|구글|알파벳/i], ['META', /\bMETA\b|Meta Platforms/i],
  ['AVGO', /\bAVGO\b|Broadcom|브로드컴/i], ['AMZN', /\bAMZN\b|Amazon|AWS|아마존/i],
  ['MU', /\bMU\b|Micron|마이크론/i], ['TSM', /\bTSM\b|TSMC|Taiwan Semiconductor/i],
  ['MRVL', /\bMRVL\b|Marvell/i], ['ALAB', /\bALAB\b|Astera/i],
  ['LITE', /\bLITE\b|Lumentum/i], ['COHR', /\bCOHR\b|Coherent/i],
  ['AAOI', /\bAAOI\b|Applied Optoelectronics/i], ['MTSI', /\bMTSI\b|MACOM/i],
  ['ORCL', /\bORCL\b|Oracle/i], ['BE', /\bBE\b|Bloom Energy|블룸\s*에너지/i],
  ['PLTR', /\bPLTR\b|Palantir|팔란티어/i], ['BMY', /\bBMY\b|Bristol[- ]Myers/i],
  ['SNDK', /\bSNDK\b|SanDisk/i], ['WDC', /\bWDC\b|Western Digital/i], ['STX', /\bSTX\b|Seagate/i],
  ['2454.TW', /\bMTK\b|MediaTek/i], ['PWR', /\bPWR\b|Quanta Services/i],
  ['ADBE', /\bADBE\b|Adobe/i], ['SMCI', /\bSMCI\b|Super Micro/i], ['RKLB', /\bRKLB\b|Rocket Lab/i],
  ['285A.T', /Kioxia/i], ['6981.T', /Murata/i],
  ['005930.KS', /Samsung Electronics|삼성전자/i], ['009150.KS', /Samsung Electro(?!nics)|삼성전기/i], ['000660.KS', /SK\s*Hynix|SK하이닉스/i],
  ['042660.KS', /Hanwha Ocean|한화오션/i], ['039030.KQ', /EO Technics|이오테크닉스/i],
  ['247540.KQ', /EcoPro BM|에코프로비엠/i], ['003670.KS', /POSCO Future M|포스코퓨처엠/i],
];

// Company names that are also ordinary English words ("coherent", "oracle", "apple", "azure", "gemini").
// They only count when written as a proper noun (Capitalized or UPPERCASE).
// v59.45 (R3-02): 'micron-scale' and 'amazon rainforest' are words too.
const COMMON_WORD_NAMES = new Set(['Coherent', 'Oracle', 'Apple', 'Azure', 'Gemini', 'Copilot', 'Astera', 'Adobe', 'Micron', 'Amazon']);
const commonWordName = (part) => {
  const word = part.replace(/^\\b|\\b$/g, '');
  return COMMON_WORD_NAMES.has(word) ? word : null;
};

const RELATED_PATTERNS = [
  ['AVGO', /\bTPU\b/], ['AMZN', /Trainium/i], ['GOOG', /\bGemini\b/], ['BE', /\bSOFC\b/], ['AMD', /\bMI450\b/],
  ['MSFT', /\bCopilot\b/],
];

// Split each alternation: all-caps symbol/acronym parts keep their case, common-word names need a capital,
// remaining distinctive names stay case-insensitive.
const compilePatterns = (rows) => rows.map(([ticker, re]) => {
  const parts = re.source.split('|');
  const strict = [];
  const names = [];
  for (const p of parts) {
    const common = commonWordName(p);
    if (SYMBOL_PART.test(p)) strict.push(new RegExp(p));
    else if (common) strict.push(new RegExp(`\\b(?:${common}|${common.toUpperCase()})\\b`));
    else names.push(p);
  }
  return [ticker, strict, names.length ? new RegExp(names.join('|'), 'i') : null];
});
export const COMPILED_TICKER_PATTERNS = compilePatterns(TICKER_PATTERNS);
const COMPILED_RELATED_PATTERNS = compilePatterns(RELATED_PATTERNS);

/** Issuer tickers only (named company, symbol or registered alias); product-inferred tickers are excluded. */
export function matchTickers(raw, aliasRows = []) {
  const text = String(raw || '');
  const out = [];
  for (const [ticker, symbols, names] of COMPILED_TICKER_PATTERNS) {
    if (out.includes(ticker)) continue;
    if (symbols.some((re) => re.test(text)) || (names && names.test(text))) out.push(ticker);
  }
  for (const [ticker, re] of aliasRows) {
    if (out.length >= 20) break;
    if (re.test(text) && !out.includes(ticker)) out.push(ticker);
  }
  return out;
}

// N15: a post naming six or more issuers is a list (net-buy TOP 50, sector round-ups, 52-week-high lists); its
// tickers are not each the subject, so the post does not add to any issuer's tally.
export const LIST_POST_TICKER_THRESHOLD = 6;

// P1722 (10/13): "영국 기관: 호르무즈 … 선박 6척 피격" was tagged 한국장·수급 because a bare 기관 matched. 기관 is the
// Korean institutional-investor group only next to a trade/flow word or listed with 외국인·개인 — not any agency.
export const KR_INSTITUTIONAL_FLOW = /기관(?:\s*투자자)?(?:들?[이은의])?[^.\n:]{0,12}?(?:순?매수|순?매도|매매|수급|자금\s*유입|자금\s*유출)|(?:외국인|개인)\s*(?:과|와|·|,|및|\/)\s*기관|기관\s*(?:과|와|·|,|및|\/)\s*(?:외국인|개인)/;

/**
 * { tickers, relatedTickers, listTickers } — `tickers` are the issuers a post is about (empty for a list post,
 * whose names move to `listTickers`); `relatedTickers` are companies inferred from a product name only.
 */
export function classifyPostTickers(raw, aliasRows = []) {
  const text = String(raw || '');
  const issuers = matchTickers(text, aliasRows);
  const related = [];
  for (const [ticker, symbols, names] of COMPILED_RELATED_PATTERNS) {
    if (issuers.includes(ticker) || related.includes(ticker)) continue;
    if (symbols.some((re) => re.test(text)) || (names && names.test(text))) related.push(ticker);
  }
  if (issuers.length >= LIST_POST_TICKER_THRESHOLD) return { tickers: [], relatedTickers: related, listTickers: issuers };
  return { tickers: issuers, relatedTickers: related, listTickers: [] };
}
