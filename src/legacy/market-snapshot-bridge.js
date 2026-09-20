// This is the only bridge allowed to project the new canonical snapshot into
// the legacy renderer during the strangler migration. Snapshot values are
// explicitly reference-only and never masquerade as live provider quotes.
export function applyMarketSnapshotToLegacy(root = globalThis, snapshot, { sourceId = 'durable-snapshot' } = {}) {
  const setLiveData = root?._aioSetLiveData;
  if (!snapshot || snapshot.status !== 'published' || typeof setLiveData !== 'function') {
    return Object.freeze({ applied: 0, skipped: true, reason: 'legacy_bridge_unavailable_or_snapshot_blocked' });
  }
  // Provenance must name the actual producer. The fast plane is a live worker read, so
  // labelling it `static_snapshot` would hide where the number came from; it is still
  // not a streaming tick, so it stays REFERENCE rather than being promoted to live.
  const fromFastPlane = sourceId === 'fast-plane';
  const provenance = fromFastPlane
    ? { source: 'snapshot:fast-plane', policyKey: 'fast_plane', reason: 'market-snapshot-fast-plane', delayed: false }
    : { source: 'snapshot:market-snapshot', policyKey: 'static_snapshot', reason: 'market-snapshot-fallback', delayed: true };
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
      ...provenance,
      ts: quote.observedAt || quote.fetchedAt || snapshot.generatedAt,
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
    status: snapshot.status,
    marketSnapshotPublished: snapshot.status === 'published',
    coverage: snapshot.coverage || null,
    sourceKind: 'REFERENCE',
    sourceId
  });
  try {
    root.document?.dispatchEvent?.(new CustomEvent('aio:marketSnapshot', { detail }));
    root.dispatchEvent?.(new CustomEvent('aio:marketSnapshot', { detail }));
  } catch (_) {}
  return Object.freeze({ applied, skipped: false, revision: snapshot.revision, latestObservedAt });
}
