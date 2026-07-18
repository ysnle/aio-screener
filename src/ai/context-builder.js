import { evaluateEvidenceUse } from './policy.js';

export function buildEvidenceContext({ evidenceStore, metrics = [] } = {}) {
  const evidence = metrics.map((metric) => evidenceStore?.get(metric)).filter(Boolean);
  return Object.freeze({
    evidence: evidence.map((entry) => ({ ...entry })),
    policy: evidence.map((entry) => ({ metric: entry.metric, ...evaluateEvidenceUse(entry) }))
  });
}
