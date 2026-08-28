import { applyFreshness } from '../quality/freshness.js';
import { normalizeSentiment, sentimentFieldDefinitions } from '../normalize/sentiment.js';

export function createSentimentOrchestrator({ provider, evidenceStore, store, commands, snapshotEvidence, clock } = {}) {
  if (!provider?.readCurrent || !evidenceStore?.ingest || (!store?.dispatch && !commands?.setData)) throw new Error('SENTIMENT_ORCHESTRATOR_DEPENDENCY_INVALID');

  function sync(patch = null) {
    const provided = patch && typeof patch === 'object' ? patch : {};
    const raw = normalizeSentiment({ ...provider.readCurrent(), ...provided });
    const sentiment = { ...raw };
    for (const field of sentimentFieldDefinitions()) {
      let value = sentiment[field.metric];
      const snapshot = snapshotEvidence?.get?.(field.metric);
      const hasProvidedValue = Object.prototype.hasOwnProperty.call(provided, field.metric);
      let sourceKind = raw[`${field.metric}SourceKind`] || field.sourceKind;
      let source = raw[`${field.metric}Source`] || sourceKind;
      let observedAt = field.observedAt ? raw[field.observedAt] || null : null;
      // A snapshot is a reference fallback, not an override for a fresh runtime
      // quote. Keep live/provider observations authoritative when present; use the
      // snapshot only when the runtime field is missing or already reference-only.
      if (snapshot && !hasProvidedValue && (value == null || sourceKind === 'snapshot' || sourceKind === 'reference')) {
        sentiment[field.metric] = snapshot.value;
        value = snapshot.value;
        sourceKind = 'snapshot';
        source = snapshot.source || snapshot.sourceKind || 'market-snapshot';
        observedAt = snapshot.observedAt || observedAt;
      }
      const referenceOnly = sourceKind === 'snapshot' || sourceKind === 'delayed' || sourceKind === 'reference';
      const declaredAllowedUse = raw[`${field.metric}AllowedUse`];
      const allowedUseCeiling = raw[`${field.metric}AllowedUseCeiling`];
      const status = value == null ? 'missing' : sourceKind === 'snapshot' ? 'snapshot' : 'live';
      const input = {
        metric: field.metric,
        value,
        unit: field.unit,
        sourceKind: value == null ? 'unavailable' : sourceKind,
        source: value == null ? 'sentiment-provider' : source,
        observedAt: value == null ? null : observedAt,
        fetchedAt: raw[`${field.metric}FetchedAt`] || raw.fetchedAt || raw.now,
        lastSuccessfulAt: value == null ? null : raw[`${field.metric}FetchedAt`] || observedAt,
        status,
        allowedUse: value == null ? 'none' : declaredAllowedUse || (referenceOnly ? 'reference' : undefined),
        allowedUseCeiling
      };
      const evidence = applyFreshness(input, { now: clock?.now?.() || Date.now(), maxAgeMs: field.maxAgeMs || 86_400_000 });
      evidenceStore.ingest(evidence);
    }
    const observationTimes = sentimentFieldDefinitions().map((field) => Date.parse(raw[field.observedAt] || '')).filter(Number.isFinite);
    const updatedAt = observationTimes.length ? new Date(Math.max(...observationTimes)).toISOString() : null;
    if (commands?.setData) commands.setData(sentiment, { revision: raw.revision || null, updatedAt });
    else store.dispatch({ type: 'data/sentiment', payload: sentiment });
    return sentiment;
  }

  return Object.freeze({ sync });
}
