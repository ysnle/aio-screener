import { evaluateEvidenceUse } from './policy.js';
import { createAIContextManifest } from './context/manifest.js';

export function buildEvidenceContext({ evidenceStore, retriever = null, metrics = [] } = {}) {
  const requestedMetrics = Array.isArray(metrics) ? metrics : [];
  const retrieved = retriever?.retrieve ? retriever.retrieve(requestedMetrics) : requestedMetrics.map((metric) => evidenceStore?.get(metric)).filter(Boolean);
  const evidence = (Array.isArray(retrieved) ? retrieved : []).map((entry) => Object.freeze({ ...entry }));
  const context = Object.freeze({
    evidence: Object.freeze(evidence),
    policy: Object.freeze(evidence.map((entry) => Object.freeze({ metric: entry.metric, ...evaluateEvidenceUse(entry) })))
  });
  return Object.freeze({ ...context, manifest: createAIContextManifest({ evidence, dataRevision: null }) });
}
