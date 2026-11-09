// v58.56 (re-audit #4): 13F rows name a security by CUSIP and the filer's own issuer text ("BANK OF AMER CORP").
// A ticker is attached only where a CUSIP maps to exactly one listed symbol — the curated reference crosswalk
// (public-data/masters/security-master-reference.json) or an OpenFIGI CUSIP lookup collected in Actions
// (scripts/collect-13f-figi-tickers.mjs). Nothing here guesses a ticker from a name. Rows without an exact match
// keep their SEC name, only made readable (case and the standard 13F abbreviations).
//
// Pure: no DOM, no fetch. Used by the runtime builder (Node) and the Masters page (browser).

export const EXACT_TICKER_RE = /^[A-Z]{1,5}(?:-[A-Z]{1,2})?$/;

// Reference records that describe a fund family or a "filing key" rather than one listed security are not a
// ticker mapping (the reference file lists "ETF" as a placeholder and maps Alphabet class C's CUSIP to GOOGL).
const NON_SECURITY_RECORD_RE = /\bfamily\b|filing key/i;
// A preferred share, note, warrant, right or unit under the same issuer is not the common stock's ticker
// (the reference maps Bruker's 6.375% preferred CUSIP to BRKR).
const NON_COMMON_TITLE_RE = /\b(?:PFD|PREF|PREFERRED|PRF|NOTES?|DEBT|DEBENTURES?|BONDS?|CONV|CV|WTS?|WARRANTS?|RIGHTS?|RTS|UNITS?)\b|%|^\s*\d+(?:\.\d+)?\s/i;

export function isNonCommonTitle(titleOfClass) {
  return NON_COMMON_TITLE_RE.test(String(titleOfClass || ''));
}

export function normalizeCusip(value) {
  return String(value || '').trim().toUpperCase();
}

/** The reference crosswalk's ticker for one record, or null when the record is not one exact listed security. */
export function referenceTickerOf(record) {
  if (!record || NON_SECURITY_RECORD_RE.test(String(record.issuerCanonical || ''))) return null;
  const ticker = String(record.tickerReference || '').trim().toUpperCase();
  return EXACT_TICKER_RE.test(ticker) ? ticker : null;
}

/** cusip → { ticker, name } for the reference records that are exact single-security mappings. */
export function buildReferenceTickerMap(referenceMaster) {
  const map = new Map();
  for (const record of referenceMaster?.records || []) {
    const ticker = referenceTickerOf(record);
    const cusip = normalizeCusip(record?.cusipNormalized);
    if (ticker && cusip) map.set(cusip, { ticker, name: record.issuerCanonical || null });
  }
  return map;
}

/**
 * One row's exact ticker, or null. Sources: the reference crosswalk entry (from buildReferenceTickerMap) and an
 * OpenFIGI cache entry ({ s: 'EXACT', t }). When both exist and disagree, neither is used.
 */
export function resolveExactTicker({ titleOfClass = '', reference = null, figi = null } = {}) {
  if (isNonCommonTitle(titleOfClass)) return null;
  const fromReference = reference?.ticker && EXACT_TICKER_RE.test(reference.ticker) ? reference.ticker : null;
  const fromFigi = figi?.s === 'EXACT' && EXACT_TICKER_RE.test(String(figi.t || '')) ? String(figi.t) : null;
  if (fromReference && fromFigi && fromReference !== fromFigi) return null;
  return fromReference || fromFigi || null;
}

const SUFFIX_WORDS = Object.freeze({
  CORP: 'Corp.', CORPORATION: 'Corporation', INC: 'Inc.', INCORPORATED: 'Incorporated', CO: 'Co.', LTD: 'Ltd.', LIMITED: 'Limited',
  PLC: 'plc', COM: 'Com', PAC: 'Pacific', LLC: 'LLC', LP: 'LP', NV: 'N.V.', SA: 'S.A.', AG: 'AG', SE: 'SE',
  HLDGS: 'Holdings', HLDG: 'Holding', HOLDINGS: 'Holdings', INTL: 'International', FINL: 'Financial', SVCS: 'Services',
  SVC: 'Service', GRP: 'Group', MFG: 'Manufacturing', SYS: 'Systems', PETE: 'Petroleum', ENTMT: 'Entertainment',
  NATL: 'National', MATLS: 'Materials', INDS: 'Industries', PRODS: 'Products', MGMT: 'Management', TR: 'Trust',
  FD: 'Fund', FDS: 'Funds', ETF: 'ETF', ADR: 'ADR', ADS: 'ADS', REIT: 'REIT', '&': '&'
});
const SMALL_WORDS = new Set(['OF', 'AND', 'THE', 'FOR', 'IN', 'ON', 'AT', 'BY']);
const TRAILING_NOISE_RE = /\s+(?:COM|NEW|FORMERLY|NYS|SPONSORED)$/;

function caseToken(token, index) {
  if (Object.prototype.hasOwnProperty.call(SUFFIX_WORDS, token)) return SUFFIX_WORDS[token];
  if (index > 0 && SMALL_WORDS.has(token)) return token.toLowerCase();
  if (/\d|&|\./.test(token) || token.length <= 3 || !/[AEIOUY]/.test(token)) return token;
  return token.split('-').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join('-');
}

/** A readable form of an SEC issuer name. Mixed-case names are returned as filed; nothing is translated or guessed. */
export function cleanIssuerName(raw) {
  let name = String(raw || '').replace(/\s*\/[A-Z]{2,3}\/?\s*$/, '').replace(/\s+/g, ' ').trim();
  if (!name || /[a-z]/.test(name)) return name;
  // "AMAZON COM INC COM", "ELEVANCE HEALTH INC FORMERLY": a class word or note copied after the company suffix.
  for (let guard = 0; guard < 3 && TRAILING_NOISE_RE.test(name) && name.split(' ').length > 2; guard += 1) name = name.replace(TRAILING_NOISE_RE, '');
  return name.split(' ').map(caseToken).join(' ');
}
