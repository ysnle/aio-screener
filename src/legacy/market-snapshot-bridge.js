// This is the only bridge allowed to project the new canonical snapshot into
// the legacy renderer during the strangler migration. Snapshot values are
// explicitly reference-only and never masquerade as live provider quotes.
export function applyMarketSnapshotToLegacy(root = globalThis, snapshot) {
  const setLiveData = root?._aioSetLiveData;
  if (!snapshot || snapshot.status !== 'published' || typeof setLiveData !== 'function') {
    return Object.freeze({ applied: 0, skipped: true, reason: 'legacy_bridge_unavailable_or_snapshot_blocked' });
  }
  let applied = 0;
  for (const quote of snapshot.quotes || []) {
    if (setLiveData(quote.instrumentId, {
      price: quote.value,
      pct: quote.changePct,
      regularMarketPreviousClose: quote.previousValue,
      changeBasis: quote.changeBasis || quote.valueBasis || 'unknown',
      valueBasis: quote.valueBasis || quote.changeBasis || 'unknown',
      revision: snapshot.revision,
      observedAt: quote.observedAt,
      fetchedAt: quote.fetchedAt,
      marketState: quote.session,
      venue: quote.venue
    }, {
      source: 'snapshot:market-snapshot',
      ts: quote.observedAt || quote.fetchedAt || snapshot.generatedAt,
      policyKey: 'static_snapshot',
      reason: 'market-snapshot-fallback',
      delayed: true,
      revision: snapshot.revision
    })) applied += 1;
  }
  const observedTimes = (snapshot.quotes || [])
    .map((quote) => Date.parse(quote?.observedAt || quote?.fetchedAt || ''))
    .filter(Number.isFinite);
  const latestObservedAt = observedTimes.length
    ? new Date(Math.max(...observedTimes)).toISOString()
    : (snapshot.generatedAt || null);
  const detail = Object.freeze({
    revision: snapshot.revision,
    count: applied,
    generatedAt: snapshot.generatedAt || null,
    latestObservedAt,
    sourceKind: 'REFERENCE'
  });
  try {
    root.document?.dispatchEvent?.(new CustomEvent('aio:marketSnapshot', { detail }));
    root.dispatchEvent?.(new CustomEvent('aio:marketSnapshot', { detail }));
  } catch (_) {}
  return Object.freeze({ applied, skipped: false, revision: snapshot.revision, latestObservedAt });
}
