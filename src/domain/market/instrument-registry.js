// P1171 (15 D05): instrument registry adapter.
//
// The published universe carries sym/name/sector/index/memo and nothing else, so the required
// instrument identity fields (MIC, assetType, share class, validity window) have no source in the
// artifacts we collect. A name-substring heuristic is not a substitute — "Netflix" contains "etf"
// and "Northern Trust" contains "trust", so a pattern match misclassifies common stock as a fund.
//
// This adapter therefore resolves identity only from declared entries that carry a source, keeps
// the inference axes explicitly marked as inferred, and returns UNKNOWN rather than a guess. It
// also decides per-type analysis eligibility so a fund is never fed into an issuer-ratio model.

export const INSTRUMENT_VERIFICATION = Object.freeze(['VERIFIED', 'INFERRED', 'UNKNOWN']);

// Declared instrument metadata. This is the single source of truth: a second JSON copy would drift.
//
// MIC is intentionally unpopulated — the published universe, the screener artifact and the SEC facts
// carry no listing venue, and a US symbol does not determine Nasdaq vs NYSE vs Arca, so an exchange
// code here would be invented. Share-class (ADR/ordinary) and validity windows need a
// corporate-action/membership source that is not collected yet. Entries are added incrementally.
export const DECLARED_INSTRUMENT_ENTRIES = Object.freeze([
  Object.freeze({ symbol: 'SPY', market: 'US', assetType: 'ETF', currency: 'USD', source: 'public-data/screener-universe.json#name', evidence: Object.freeze({ basis: 'published-name', name: 'SPDR S&P 500 ETF' }), verifiedAt: '2026-09-22' }),
  Object.freeze({ symbol: 'QQQ', market: 'US', assetType: 'ETF', currency: 'USD', source: 'public-data/screener-universe.json#name', evidence: Object.freeze({ basis: 'published-name', name: 'Invesco QQQ Trust' }), verifiedAt: '2026-09-22' }),
  Object.freeze({ symbol: 'IWM', market: 'US', assetType: 'ETF', currency: 'USD', source: 'public-data/screener-universe.json#name', evidence: Object.freeze({ basis: 'published-name', name: 'iShares Russell 2000 ETF' }), verifiedAt: '2026-09-22' }),
  Object.freeze({ symbol: 'DIA', market: 'US', assetType: 'ETF', currency: 'USD', source: 'public-data/screener-universe.json#name', evidence: Object.freeze({ basis: 'published-name', name: 'SPDR Dow Jones ETF' }), verifiedAt: '2026-09-22' })
]);

export function parseInstrumentRegistry(input = {}) {
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const byKey = new Map();
  for (const entry of entries) {
    const symbol = String(entry?.symbol || '').trim().toUpperCase();
    if (!symbol) continue;
    const market = String(entry?.market || '').trim().toUpperCase() || null;
    byKey.set(`${market || '*'}:${symbol}`, Object.freeze({
      symbol,
      market,
      assetType: entry?.assetType ? String(entry.assetType).toUpperCase() : null,
      mic: entry?.mic ? String(entry.mic).toUpperCase() : null,
      currency: entry?.currency ? String(entry.currency).toUpperCase() : null,
      shareClass: entry?.shareClass ? String(entry.shareClass).toUpperCase() : null,
      validFrom: entry?.validFrom || null,
      validTo: entry?.validTo || null,
      source: entry?.source ? String(entry.source) : null,
      evidence: entry?.evidence && typeof entry.evidence === 'object' ? { ...entry.evidence } : null,
      verifiedAt: entry?.verifiedAt || null
    }));
  }
  return Object.freeze({
    schemaVersion: String(input.schemaVersion || 'instrument-registry.v1'),
    size: byKey.size,
    get: (symbol, market = null) => byKey.get(`${String(market || '').toUpperCase() || '*'}:${String(symbol || '').trim().toUpperCase()}`) || byKey.get(`*:${String(symbol || '').trim().toUpperCase()}`) || null
  });
}

// A declared entry is only usable while the evidence it was declared against still holds. Today the
// only declared basis is the published name, so a renamed symbol falls back to UNKNOWN instead of
// silently keeping a stale classification.
function declarationHolds(entry, publishedName) {
  if (!entry) return false;
  if (entry.evidence?.basis === 'published-name') {
    const claimed = String(entry.evidence.name || '').trim();
    const actual = String(publishedName || '').trim();
    return claimed.length > 0 && claimed === actual;
  }
  return entry.evidence == null ? entry.source != null : true;
}

export function resolveInstrument({ symbol, market = null, publishedName = null, registry } = {}) {
  const parsed = registry && typeof registry.get === 'function' ? registry : parseInstrumentRegistry(registry);
  const resolvedMarket = String(market || '').trim().toUpperCase() || null;
  const entry = parsed.get(symbol, resolvedMarket);
  const holds = declarationHolds(entry, publishedName);
  const suffixCurrency = /\.K[QS]$/i.test(String(symbol || '')) ? 'KRW' : (/^[A-Z][A-Z.\-]{0,6}$/.test(String(symbol || '')) ? 'USD' : null);
  return Object.freeze({
    symbol: String(symbol || '').trim().toUpperCase(),
    market: resolvedMarket,
    // Only a declared, still-holding entry is VERIFIED. The market/currency derived from the listing
    // suffix stays INFERRED — it is a naming convention, not a listing record.
    mic: holds ? entry.mic : null,
    assetType: holds ? entry.assetType : null,
    currency: holds && entry.currency ? entry.currency : suffixCurrency,
    shareClass: holds ? entry.shareClass : null,
    validFrom: holds ? entry.validFrom : null,
    validTo: holds ? entry.validTo : null,
    verification: holds ? 'VERIFIED' : 'UNKNOWN',
    verificationDetail: holds
      ? { assetType: 'VERIFIED', mic: entry.mic ? 'VERIFIED' : 'UNKNOWN', currency: entry.currency ? 'VERIFIED' : 'INFERRED' }
      : { assetType: 'UNKNOWN', mic: 'UNKNOWN', currency: suffixCurrency ? 'INFERRED' : 'UNKNOWN' },
    source: holds ? entry.source : null,
    note: holds ? null : 'no declared instrument identity for this symbol; a successful price fetch is not identity verification'
  });
}

// 15 D05: eligibility is per asset type. A fund has no issuer-level statement, so it must not enter
// an issuer-ratio model; an unverified type must not be assumed to be an issuer either.
export function analysisEligibilityFor(assetType) {
  const type = String(assetType || '').trim().toUpperCase();
  if (type === 'EQUITY') return Object.freeze({ assetType: type, financialRatios: 'ELIGIBLE', reason: 'issuer statements describe the instrument' });
  if (type === 'ETF') return Object.freeze({ assetType: type, financialRatios: 'NOT_APPLICABLE', reason: 'a fund has no issuer-level statement; ratio screens must exclude it' });
  return Object.freeze({ assetType: type || null, financialRatios: 'UNKNOWN', reason: 'asset type is not verified; ratio screens must not assume an issuer' });
}

// Consumers that do not inject a registry get the declared set. Nothing is inferred at import time.
export const INSTRUMENT_REGISTRY = parseInstrumentRegistry({ entries: DECLARED_INSTRUMENT_ENTRIES });
