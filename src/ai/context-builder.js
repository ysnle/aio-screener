import { evaluateEvidenceUse } from './policy.js';
import { createAIContextManifest } from './context/manifest.js';

export function buildEvidenceContext({ evidenceStore, retriever = null, metrics = [] } = {}) {
  const evidence = retriever?.retrieve ? retriever.retrieve(metrics) : metrics.map((metric) => evidenceStore?.get(metric)).filter(Boolean);
  const context = Object.freeze({
    evidence: evidence.map((entry) => ({ ...entry })),
    policy: evidence.map((entry) => ({ metric: entry.metric, ...evaluateEvidenceUse(entry) }))
  });
  return Object.freeze({ ...context, manifest: createAIContextManifest({ evidence, dataRevision: null }) });
}
