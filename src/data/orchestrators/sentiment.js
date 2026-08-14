import { applyFreshness } from '../quality/freshness.js';
import { normalizeSentiment, sentimentFieldDefinitions } from '../normalize/sentiment.js';

export function createSentimentOrchestrator({ provider, evidenceStore, store, commands, snapshotEvidence, clock } = {}) {
  if (!provider?.readCurrent || !evidenceStore?.ingest || (!store?.dispatch && !commands?.setData)) throw new Error('SENTIMENT_ORCHESTRATOR_DEPENDENCY_INVALID');

  function sync(patch = null) {
    const provided = patch && typeof patch === 'object' ? patch : {};
    const raw = normalizeSentiment({ ...provider.readCurrent(), ...provided });
    const sentiment = { ...raw };
    for (const field of sentimentFieldDefinitions()) {
      const value = sentiment[field.metric];
      const snapshot = snapshotEvidence?.get?.(field.metric);
      const hasProvidedValue = Object.prototype.hasOwnProperty.call(provided, field.metric);
      if (snapshot && !hasProvidedValue) {
        sentiment[field.metric] = snapshot.value;
        continue;
      }
      const sourceKind = raw[`${field.metric}SourceKind`] || field.sourceKind;
      const source = raw[`${field.metric}Source`] || sourceKind;
      const observedAt = field.observedAt ? raw[field.observedAt] || null : null;
      const referenceOnly = sourceKind === 'snapshot' || sourceKind === 'delayed' || sourceKind === 'reference';
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
        allowedUse: value == null ? 'none' : referenceOnly ? 'reference' : undefined
      };
      const evidence = sourceKind === 'snapshot'
        ? input
        : { ...applyFreshness(input, { now: clock?.now?.() || Date.now(), maxAgeMs: field.maxAgeMs || 86_400_000 }), ...(referenceOnly ? { allowedUse: 'reference' } : {}) };
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
