export function createEvidenceRetriever({ evidenceStore } = {}) {
  return Object.freeze({
    retrieve(metrics = []) {
      return Object.freeze((Array.isArray(metrics) ? metrics : []).map((metric) => evidenceStore?.get(metric)).filter(Boolean).map((entry) => Object.freeze({ ...entry })));
    }
  });
}
