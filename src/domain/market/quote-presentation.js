export const QUOTE_DISPLAY_STATES = Object.freeze(['current', 'delayed', 'stale-reference', 'missing', 'disputed']);

const CURRENT_QUALITY = new Set(['CURRENT', 'CLOSED_CURRENT', 'LIVE', 'FRESH', 'VERIFIED_CURRENT']);
const DELAYED_QUALITY = new Set(['DELAYED']);

function finite(value) {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoOrNull(value) {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function qualityKey(envelope) {
  const raw = envelope?.quality;
  const nested = raw && typeof raw === 'object' ? (raw.status || raw.freshness) : null;
  return String(envelope?.qualityStatus || nested || (typeof raw === 'string' ? raw : '') || '').trim().toUpperCase() || null;
}

function allowedUseOf(envelope) {
  const key = String(envelope?.allowedUse ?? '').trim().toLowerCase();
  if (key === 'decision' || key === 'trading') return 'decision';
  return key ? 'reference' : 'none';
}

/**
 * W03-B/P1145: one value carries its market observation time, receipt time, source,
 * revision, freshness, allowed use, and display role together. Freshness comes only
 * from the envelope's declared quality — never from a source-name pattern — and
 * receivedAt can never freshen an old observedAt. When a producer supplies an
 * envelope, the numeric value is read from that envelope only, so a stale raw copy
 * cannot masquerade as the same observation.
 */
export function deriveQuotePresentation(row, { symbol = null } = {}) {
  const quote = row && typeof row === 'object' ? row : {};
  const hasEnvelope = !!quote.quoteEnvelope && typeof quote.quoteEnvelope === 'object';
  const envelope = hasEnvelope ? quote.quoteEnvelope : quote;
  const rawPrice = finite(quote.price ?? quote.regularMarketPrice);
  const envelopePrice = finite(envelope.price ?? envelope.value ?? envelope.regularMarketPrice);
  const value = hasEnvelope ? envelopePrice : (envelopePrice ?? rawPrice);
  const pct = finite(envelope.pct ?? envelope.regularMarketChangePercent ?? envelope.directionValue);
  const changeBasis = String(envelope.changeBasis || envelope.valueBasis || 'unknown');
  const quality = qualityKey(envelope);
  const identityDisputed = hasEnvelope && rawPrice != null && envelopePrice != null && rawPrice !== envelopePrice;
  let displayState = 'missing';
  if (value != null) {
    if (identityDisputed) displayState = 'disputed';
    else if (CURRENT_QUALITY.has(quality)) displayState = 'current';
    else if (DELAYED_QUALITY.has(quality)) displayState = 'delayed';
    // No declared current/delayed quality means the value cannot be promoted to a
    // current observation, whatever its source label says.
    else displayState = 'stale-reference';
  }
  return Object.freeze({
    symbol: symbol || null,
    value,
    unit: String(envelope.unit || envelope.valueUnit || '').trim() || null,
    observedAt: isoOrNull(envelope.observedAt),
    receivedAt: isoOrNull(envelope.fetchedAt ?? envelope.receivedAt),
    sourceId: String(envelope.source || envelope._source || envelope.provider || 'unknown'),
    sourceKind: envelope.sourceKind ? String(envelope.sourceKind) : null,
    revision: envelope.revision ?? envelope.revisionId ?? null,
    quality,
    session: String(envelope.marketState || envelope.session || '').trim() || null,
    changeBasis,
    changePct: pct,
    // A change whose previous-close basis is unknown is not a coherent change and
    // must not be presented as if the price and its baseline shared one observation.
    changeCoherent: pct != null && changeBasis !== 'unknown',
    allowedUse: allowedUseOf(envelope),
    displayState
  });
}

export function quoteDisplayKind(displayState) {
  if (displayState === 'current' || displayState === 'delayed') return 'observed';
  if (displayState === 'missing') return 'unavailable';
  return 'reference';
}
