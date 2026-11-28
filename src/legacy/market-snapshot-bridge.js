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
  // One day change per index on every surface: the site's own close series decides it where the provider's pair
  // disagrees (quote-basis.js publishedUsChangeOn), as the ledger and the briefing read it.
  const ownChange = (published) => root.AIO?.quoteBasis?.published?.(published) || null;
  const write = (published, own) => {
    const quote = own ? { ...published, changePct: own.pct, previousValue: own.previousClose, changeBasis: own.basis } : published;
    // The published close's change is what a later live quote of the same session must not replace.
    root.PriceStore?.notePublished?.(quote.instrumentId, { pct: quote.changePct, observedAt: quote.observedAt, previousClose: quote.previousValue, changeBasis: quote.changeBasis || quote.valueBasis });
    return setLiveData(quote.instrumentId, {
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
    });
  };
  // Applied before the quote-basis owner or the close history arrived, an index change is still the provider's: the
  // owner calls this when either arrives (quote-basis.js reverify), and only the quotes whose change the close series
  // corrects are written again, and the snapshot readers are told only when one was.
  root._aioReapplyBridgedSnapshot = () => {
    let changed = 0;
    for (const published of snapshot.quotes || []) {
      const own = ownChange(published);
      if (own && root._liveData?.[published.instrumentId]?.revision === snapshot.revision && root._liveData[published.instrumentId].pct !== own.pct && write(published, own)) changed += 1;
    }
    if (changed) announce(applied); // the snapshot's own count: the status line prints it
  };
  for (const published of snapshot.quotes || []) if (write(published, ownChange(published))) applied += 1;
  announce(applied);
  return Object.freeze({ applied, skipped: false, revision: snapshot.revision, latestObservedAt: latestObservedAt() });

  function latestObservedAt() {
    const observedTimes = (snapshot.quotes || []).map((quote) => Date.parse(quote?.observedAt || quote?.fetchedAt || '')).filter(Number.isFinite);
    return observedTimes.length ? new Date(Math.max(...observedTimes)).toISOString() : (snapshot.generatedAt || null);
  }
  function announce(count) {
    const detail = Object.freeze({ revision: snapshot.revision, count, generatedAt: snapshot.generatedAt || null, latestObservedAt: latestObservedAt(),
      status: snapshot.status, marketSnapshotPublished: snapshot.status === 'published', coverage: snapshot.coverage || null, sourceKind: 'REFERENCE', sourceId });
    try {
      root.document?.dispatchEvent?.(new CustomEvent('aio:marketSnapshot', { detail }));
      root.dispatchEvent?.(new CustomEvent('aio:marketSnapshot', { detail }));
    } catch (_) {}
  }
}
