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
const CLASS_SHARE_RE = /^([A-Z]{1,5})[./]([A-Z])$/;

function compact(value) {
  return String(value == null ? '' : value).replace(/\s+/g, '');
}

export function normalizeTickerInput(raw, { krStockDb = {}, krToYahoo = null, isListed = null } = {}) {
  // v58.82: NFKC folds a full-width or IME-typed ticker (ＡＡＰＬ → AAPL) to ASCII; it changes the characters' form, not the symbol.
  const text = String(raw == null ? '' : raw).normalize('NFKC').trim();
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
    // P1345: even a unique prefix is not an exact registered company name.
  }
  // v57.55 review (8p): BRK.B · BRK/B · BRK-B are one class share; the AIO universe lists it with a dash, so 'BRK.B' opened a page
  // with no name or rows. Only the separator changes, and only when the dash form is listed and the typed form is not.
  const share = upper.match(CLASS_SHARE_RE);
  if (share && typeof isListed === 'function' && !isListed(upper) && isListed(`${share[1]}-${share[2]}`)) return `${share[1]}-${share[2]}`;
  return upper;
}

export function tickerDisplayName(symbol, { krStockDb = {} } = {}) {
  const match = String(symbol == null ? '' : symbol).toUpperCase().match(KR_CODE_RE);
  if (!match) return null;
  const info = krStockDb && typeof krStockDb === 'object' ? krStockDb[match[1]] : null;
  return info && info.name ? String(info.name) : null;
}
