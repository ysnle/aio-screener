// P1544: ticker symbols in Telegram posts are matched case-sensitively; only company/product names are
// case-insensitive. The previous /i flag on `\bBE\b|\bMU\b|\bCAT\b|\bMETA\b|\bLITE\b` tagged ordinary
// English ("to be", "mu", "cat", "meta", "lite") with tickers, which the digest then counted as catalysts.
const SYMBOL_PART = /^(?:\\b)?[A-Z][A-Z0-9]{1,5}(?:\\b)?$/;

const TICKER_PATTERNS = [
  ['NVDA', /\bNVDA\b|nvidia/i], ['AMD', /\bAMD\b|Advanced Micro|MI450/i],
  ['TSLA', /\bTSLA\b|Tesla/i], ['CAT', /\bCAT\b|Caterpillar/i], ['AMAT', /\bAMAT\b|Applied Materials/i],
  ['AAPL', /\bAAPL\b|\bApple\b/i], ['MSFT', /\bMSFT\b|\bMicrosoft\b|Azure|Copilot/i],
  ['GOOG', /\bGOOG\b|\bGOOGL\b|Google|Alphabet|Gemini/i], ['META', /\bMETA\b|Meta Platforms/i],
  ['AVGO', /\bAVGO\b|Broadcom|TPU/i], ['AMZN', /\bAMZN\b|Amazon|AWS|Trainium/i],
  ['MU', /\bMU\b|Micron/i], ['TSM', /\bTSM\b|TSMC|Taiwan Semiconductor/i],
  ['MRVL', /\bMRVL\b|Marvell/i], ['ALAB', /\bALAB\b|Astera/i],
  ['LITE', /\bLITE\b|Lumentum/i], ['COHR', /\bCOHR\b|Coherent/i],
  ['AAOI', /\bAAOI\b|Applied Optoelectronics/i], ['MTSI', /\bMTSI\b|MACOM/i],
  ['ORCL', /\bORCL\b|Oracle/i], ['BE', /\bBE\b|Bloom Energy|SOFC/i],
  ['PLTR', /\bPLTR\b|Palantir/i], ['BMY', /\bBMY\b|Bristol[- ]Myers/i],
  ['SNDK', /\bSNDK\b|SanDisk/i], ['WDC', /\bWDC\b|Western Digital/i], ['STX', /\bSTX\b|Seagate/i],
  ['MTK', /\bMTK\b|MediaTek/i], ['PWR', /\bPWR\b|Quanta Services/i],
  ['ADBE', /\bADBE\b|Adobe/i], ['SMCI', /\bSMCI\b|Super Micro/i], ['RKLB', /\bRKLB\b|Rocket Lab/i],
  ['6600.T', /Kioxia/i], ['6981.T', /Murata/i],
  ['005930.KS', /Samsung Electronics|삼성전자/i], ['009150.KS', /Samsung Electro|삼성전기/i], ['000660.KS', /SK\s*Hynix|SK하이닉스/i],
  ['042660.KS', /Hanwha Ocean|한화오션/i], ['039030.KQ', /EO Technics|이오테크닉스/i],
  ['247540.KQ', /EcoPro BM|에코프로비엠/i], ['003670.KQ', /POSCO Future M|포스코퓨처엠/i],
];

// Company names that are also ordinary English words ("coherent", "oracle", "apple", "azure", "gemini").
// They only count when written as a proper noun (Capitalized or UPPERCASE).
const COMMON_WORD_NAMES = new Set(['Coherent', 'Oracle', 'Apple', 'Azure', 'Gemini', 'Copilot', 'Astera', 'Adobe']);
const commonWordName = (part) => {
  const word = part.replace(/^\\b|\\b$/g, '');
  return COMMON_WORD_NAMES.has(word) ? word : null;
};

// Split each alternation: all-caps symbol/acronym parts keep their case, common-word names need a capital,
// remaining distinctive names stay case-insensitive.
export const COMPILED_TICKER_PATTERNS = TICKER_PATTERNS.map(([ticker, re]) => {
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
