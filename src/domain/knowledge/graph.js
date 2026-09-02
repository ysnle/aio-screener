export const EDGE_TYPES = Object.freeze(['CAUSES', 'REQUIRES', 'ENABLES', 'CONSTRAINS', 'FUNDS', 'PRICES', 'MEASURES', 'EVIDENCES', 'EXPOSES_TO', 'RELATES_TO']);
const EDGE_TYPE_SET = new Set(EDGE_TYPES);
const DIRECTIONS = new Set(['DIRECTED', 'BIDIRECTIONAL']);

function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '');
}

function inferEdgeType(relation) {
  const text = String(relation || '').toLowerCase();
  if (/검증|근거|증거|확인|evidence/.test(text)) return 'EVIDENCES';
  if (/측정|지표|kpi|회수|value capture/.test(text)) return 'MEASURES';
  if (/자금|조달|투자|fund|capital/.test(text)) return 'FUNDS';
  if (/가격|할인|valuation|price/.test(text)) return 'PRICES';
  if (/제약|병목|통제|규제|위험|constraint/.test(text)) return 'CONSTRAINS';
  if (/요구|필요|전제|수요|require/.test(text)) return 'REQUIRES';
  if (/구현|연결|적용|통합|공급|enable/.test(text)) return 'ENABLES';
  return 'CAUSES';
}

function edgeKey(from, to) {
  return `${from}->${to}`;
}

export function normalizeKnowledgeEdge(edge, defaults = {}) {
  const from = String(edge?.from || '').trim();
  const to = String(edge?.to || '').trim();
  const explicit = defaults.edgeSemantics?.[edgeKey(from, to)] || null;
  const input = explicit ? { ...edge, ...explicit } : edge;
  const relation = String(input?.relation || '').trim();
  const inferredFields = [];
  const choose = (field, fallback) => {
    if (input?.[field] != null && input[field] !== '') return input[field];
    inferredFields.push(field);
    return fallback;
  };
  const chooseEnum = (field, allowed, fallback) => {
    if (allowed.has(input?.[field])) return input[field];
    inferredFields.push(field);
    return fallback;
  };
  const chooseArray = (field, fallback = []) => {
    if (Array.isArray(input?.[field])) return input[field];
    inferredFields.push(field);
    return Array.isArray(fallback) ? fallback : [];
  };
  const type = chooseEnum('type', EDGE_TYPE_SET, inferEdgeType(relation));
  const direction = chooseEnum('direction', DIRECTIONS, 'DIRECTED');
  const kind = choose('kind', defaults.kind || 'STRUCTURAL');
  const strength = choose('strength', defaults.strength || 'CORE');
  const polarity = choose('polarity', defaults.polarity || 'CONDITIONAL');
  const conditions = chooseArray('conditions', defaults.conditions);
  const sourceIds = chooseArray('sourceIds', defaults.sourceIds);
  const reviewedAt = input?.reviewedAt || choose('reviewedAt', defaults.reviewedAt || null);
  return Object.freeze({
    id: input?.id || `edge-${slug(from)}-${slug(to)}`,
    from,
    to,
    relation,
    type,
    direction,
    kind,
    strength,
    polarity,
    conditions: Object.freeze(conditions.map((value) => String(value || '').trim()).filter(Boolean)),
    sourceIds: Object.freeze(sourceIds.map((value) => String(value || '').trim()).filter(Boolean)),
    reviewedAt,
    reviewStatus: input?.reviewStatus || defaults.reviewStatus || null,
    sourceStatus: input?.sourceStatus || defaults.sourceStatus || null,
    metadataOrigin: explicit || input?.metadataOrigin === 'EXPLICIT_REVIEW' ? 'EXPLICIT_REVIEW' : (input?.metadataOrigin || (inferredFields.length ? 'INFERRED' : 'EXPLICIT')),
    inferredFields: Object.freeze([...new Set(inferredFields)])
  });
}

export function normalizeKnowledgeEdges(edges, defaults = {}) {
  if (!Array.isArray(edges)) throw new Error('KNOWLEDGE_EDGES_INVALID');
  return Object.freeze(edges.map((edge) => normalizeKnowledgeEdge(edge, defaults)));
}

export function inspectKnowledgeGraph({ nodeIds = [], edges = [] } = {}) {
  if (!Array.isArray(nodeIds) || !Array.isArray(edges)) throw new Error('KNOWLEDGE_GRAPH_INPUT_INVALID');
  const ids = new Set(nodeIds);
  const invalidEndpoints = [];
  const duplicateEdges = [];
  const metadataErrors = [];
  const inferredEdges = [];
  const seen = new Set();
  const adjacency = new Map([...ids].map((id) => [id, new Set()]));
  const inDegree = new Map([...ids].map((id) => [id, 0]));
  const outDegree = new Map([...ids].map((id) => [id, 0]));

  for (const rawEdge of edges) {
    const edge = normalizeKnowledgeEdge(rawEdge);
    if (edge.inferredFields.length) inferredEdges.push({ edgeId: edge.id, fields: edge.inferredFields });
    if (!ids.has(edge.from)) invalidEndpoints.push({ edgeId: edge.id, endpoint: 'from', nodeId: edge.from });
    if (!ids.has(edge.to)) invalidEndpoints.push({ edgeId: edge.id, endpoint: 'to', nodeId: edge.to });
    const key = `${edge.from}\u0000${edge.to}\u0000${edge.type}`;
    if (seen.has(key)) duplicateEdges.push(edge.id);
    seen.add(key);
    for (const field of ['id', 'from', 'to', 'relation', 'type', 'direction', 'kind', 'strength', 'polarity', 'reviewedAt']) {
      if (!edge[field]) metadataErrors.push({ edgeId: edge.id, field });
    }
    if (!Array.isArray(edge.conditions)) metadataErrors.push({ edgeId: edge.id, field: 'conditions' });
    if (!Array.isArray(edge.sourceIds)) metadataErrors.push({ edgeId: edge.id, field: 'sourceIds' });
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
    outDegree.set(edge.from, outDegree.get(edge.from) + 1);
    inDegree.set(edge.to, inDegree.get(edge.to) + 1);
    if (edge.direction === 'BIDIRECTIONAL') {
      outDegree.set(edge.to, outDegree.get(edge.to) + 1);
      inDegree.set(edge.from, inDegree.get(edge.from) + 1);
    }
  }

  const visited = new Set();
  const components = [];
  for (const start of ids) {
    if (visited.has(start)) continue;
    const queue = [start];
    const component = [];
    visited.add(start);
    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      for (const next of adjacency.get(current) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(component.sort());
  }
  components.sort((left, right) => right.length - left.length || left[0].localeCompare(right[0]));

  return Object.freeze({
    nodeCount: ids.size,
    edgeCount: edges.length,
    invalidEndpoints: Object.freeze(invalidEndpoints.map((row) => Object.freeze(row))),
    duplicateEdges: Object.freeze(duplicateEdges),
    metadataErrors: Object.freeze(metadataErrors),
    inferredEdges: Object.freeze(inferredEdges.map((row) => Object.freeze({ ...row, fields: Object.freeze([...row.fields]) }))),
    components: Object.freeze(components.map((component) => Object.freeze(component))),
    isolatedNodes: Object.freeze([...ids].filter((id) => (adjacency.get(id)?.size || 0) === 0).sort()),
    sourceNodes: Object.freeze([...ids].filter((id) => inDegree.get(id) === 0).sort()),
    sinkNodes: Object.freeze([...ids].filter((id) => outDegree.get(id) === 0).sort())
  });
}
