export const AI_EVIDENCE_GRAPH_VERSION = 'evidence-graph.v1';

function clean(value) { return value == null ? null : String(value).trim() || null; }

export function createEvidenceGraph({ questionPlan = null, nodes = [], edges = [] } = {}) {
  const normalizedNodes = (Array.isArray(nodes) ? nodes : []).map((node, index) => Object.freeze({
    evidenceId: clean(node?.evidenceId) || `evidence:${index + 1}`,
    type: clean(node?.type) || 'unknown',
    metricId: clean(node?.metricId || node?.metric),
    value: node?.value ?? null,
    unit: clean(node?.unit),
    asOf: clean(node?.asOf || node?.observedAt),
    source: clean(node?.source),
    sourceKind: clean(node?.sourceKind) || 'unknown',
    allowedUse: clean(node?.allowedUse) || 'reference',
    status: clean(node?.status) || 'unknown'
  }));
  const ids = new Set(normalizedNodes.map((node) => node.evidenceId));
  const normalizedEdges = (Array.isArray(edges) ? edges : []).filter((edge) => ids.has(edge?.from) && ids.has(edge?.to)).map((edge) => Object.freeze({ from: edge.from, to: edge.to, relation: clean(edge.relation) || 'supports' }));
  return Object.freeze({ schemaVersion: AI_EVIDENCE_GRAPH_VERSION, queryId: questionPlan?.queryId || null, nodes: Object.freeze(normalizedNodes), edges: Object.freeze(normalizedEdges) });
}

export function evaluateEvidenceCompleteness(graph, requiredEvidence = []) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const present = new Set(nodes.filter((node) => node.status !== 'missing' && node.status !== 'failed').map((node) => node.type || node.metricId));
  const missing = (Array.isArray(requiredEvidence) ? requiredEvidence : []).filter((required) => !present.has(required));
  return Object.freeze({ ok: missing.length === 0, required: [...requiredEvidence], present: [...present], missing, status: missing.length === 0 ? 'complete' : present.size ? 'partial' : 'missing' });
}
