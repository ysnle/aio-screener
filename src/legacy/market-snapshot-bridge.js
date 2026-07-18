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
      observedAt: quote.observedAt,
      fetchedAt: quote.fetchedAt,
      marketState: quote.session,
      venue: quote.venue
    }, {
      source: 'snapshot:market-snapshot',
      ts: quote.observedAt || quote.fetchedAt || snapshot.generatedAt,
      policyKey: 'static_snapshot',
      reason: 'market-snapshot-fallback',
      delayed: true
    })) applied += 1;
  }
  try {
    root.dispatchEvent?.(new CustomEvent('aio:marketSnapshot', { detail: { revision: snapshot.revision, count: applied } }));
  } catch (_) {}
  return Object.freeze({ applied, skipped: false, revision: snapshot.revision });
}
