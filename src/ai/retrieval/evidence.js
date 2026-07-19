export function createEvidenceRetriever({ evidenceStore } = {}) {
  return Object.freeze({
    retrieve(metrics = []) {
      return metrics.map((metric) => evidenceStore?.get(metric)).filter(Boolean).map((entry) => ({ ...entry }));
    }
  });
}
