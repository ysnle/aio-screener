/**
 * Ticker input normalization (P1317/R663).
 *
 * The ticker route keyed every lookup by the raw upper-cased input, while Korean
 * quotes, screener rows and factor profiles are keyed by the Yahoo-style symbol
 * (`005930.KS`, `247540.KQ`). Typing `005930` — or `삼성전자` — therefore produced
 * an empty page even when the quote was already in memory. One pure mapping turns a
 * six-digit KRX code or a registered Korean name into that canonical symbol, so the
 * page, the quote request and the screener lookup all use the same key.
 *
 * Pure: the KR registry and the KOSPI/KOSDAQ resolver are injected.
 */

const KR_CODE_RE = /^(\d{6})(?:\.(KS|KQ))?$/;
const HANGUL_RE = /[가-힣]/;

function compact(value) {
  return String(value == null ? '' : value).replace(/\s+/g, '');
}

export function normalizeTickerInput(raw, { krStockDb = {}, krToYahoo = null } = {}) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return '';
  const toYahoo = (code) => (typeof krToYahoo === 'function' ? krToYahoo(code) : `${code}.KS`);
  const upper = text.toUpperCase();
  const code = upper.match(KR_CODE_RE);
  // An explicit exchange suffix is the user's declaration; a bare code is resolved.
  if (code) return code[2] ? `${code[1]}.${code[2]}` : toYahoo(code[1]);
  if (HANGUL_RE.test(text)) {
    const wanted = compact(text);
    const entries = Object.entries(krStockDb && typeof krStockDb === 'object' ? krStockDb : {});
    const exact = entries.find(([, info]) => compact(info && info.name) === wanted);
    if (exact) return toYahoo(exact[0]);
    // A partial name resolves only when it is unambiguous — never guess between two issuers.
    const prefixed = entries.filter(([, info]) => compact(info && info.name).startsWith(wanted));
    if (prefixed.length === 1) return toYahoo(prefixed[0][0]);
  }
  return upper;
}

export function tickerDisplayName(symbol, { krStockDb = {} } = {}) {
  const match = String(symbol == null ? '' : symbol).toUpperCase().match(KR_CODE_RE);
  if (!match) return null;
  const info = krStockDb && typeof krStockDb === 'object' ? krStockDb[match[1]] : null;
  return info && info.name ? String(info.name) : null;
}
