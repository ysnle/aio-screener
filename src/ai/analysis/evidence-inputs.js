// Observations cannot establish sector membership, scores or causal edges.
export const AI_EVIDENCE_INPUTS_VERSION = 'analysis-evidence-inputs.v1';
const text = (v) => typeof v === 'string' ? v.trim() : '';
const entityId = (v) => text(typeof v === 'object' ? v?.symbol || v?.ticker : v).toUpperCase();
const technical = new Set(['price', 'sma20', 'sma50', 'rsi14', 'macd', 'signal']);
const macro = /^(?:market\.(?:rates|fx|commodity|volatility)\.|vix$|vix9d$|vix3m$|vix6m$|hySpread$|tnx$|us10y$|usdkrw$|dxy$)/i;
const badSource = /^(?:unknown|missing|reference|untrusted|unavailable|seed|fallback|manual)$/i;
const sourceKinds = new Set(['LIVE', 'SNAPSHOT', 'MARKET-SNAPSHOT', 'LEGACY-RUNTIME', 'LEGACY-PROJECTION']);

export function buildEvidenceAnalysisInputs(plan = {}, { evidence = [], now = Date.now() } = {}) {
  const intent = plan?.intent?.primary || plan?.intent || 'UNKNOWN';
  const rejected = [];
  const reject = (row, reason) => rejected.push(Object.freeze({ evidenceId: text(row?.evidenceId) || null, reason }));
  const rows = [];
  const identities = new Map();
  for (const row of Array.isArray(evidence) ? evidence : []) {
    if (!text(row?.evidenceId)) continue;
    const signature = JSON.stringify([entityId(row.entity || row.entityId || row.symbol || row.ticker || row.metadata?.instrumentId), row.metric || row.metricId, row.value, row.unit, row.asOf || row.observedAt, row.source]);
    if (!identities.has(row.evidenceId)) identities.set(row.evidenceId, new Set());
    identities.get(row.evidenceId).add(signature);
  }
  for (const row of Array.isArray(evidence) ? evidence : []) {
    if (identities.get(row?.evidenceId)?.size > 1) { reject(row, 'evidence-id-conflict'); continue; }
    const entity = entityId(row?.entity || row?.entityId || row?.symbol || row?.ticker || row?.metadata?.instrumentId);
    const metric = text(row?.metric || row?.metricId);
    const asOf = text(row?.asOf || row?.observedAt);
    const source = text(row?.source);
    const unit = text(row?.unit);
    const at = Date.parse(asOf);
    if (!row?.evidenceId || !entity || !metric || !source || badSource.test(source) || !sourceKinds.has(text(row.sourceKind).toUpperCase()) || !unit || !Number.isFinite(at) || at > Number(now) || typeof row.value !== 'number' || !Number.isFinite(row.value)) { reject(row, 'typed-observation-invalid'); continue; }
    if (!['verified', 'live', 'fresh', 'snapshot', 'ok', 'current'].includes(text(row.status || row.truthStatus).toLowerCase()) || row.stale === true || row.future === true || row.allowedUse === 'none' || row.allowedUseCeiling === 'none' || row.operationalUse === 'none') { reject(row, 'observation-not-usable'); continue; }
    if (row.scale && row.scale !== 'raw') { reject(row, 'non-raw-scale'); continue; }
    rows.push(Object.freeze({ evidenceId: String(row.evidenceId), entity, metric, value: row.value, unit, asOf, source, sourceKind: row.sourceKind }));
  }
  const groups = new Map();
  rows.forEach((row) => { const key = `${row.entity}|${row.metric}`; groups.set(key, [...(groups.get(key) || []), row]); });
  const safe = [];
  for (const group of groups.values()) {
    if (new Set(group.map((row) => JSON.stringify([row.value, row.unit, Date.parse(row.asOf)]))).size > 1) group.forEach((row) => reject(row, 'entity-metric-conflict'));
    else safe.push(group[0]);
  }
  const requested = [...new Set((plan?.entities?.entities || []).map((row) => entityId(row.symbol || row.entityId || row.ticker || row.instrumentId)).filter(Boolean))];
  const available = [...new Set(safe.map((row) => row.entity))];
  const target = requested.length === 1 ? requested[0] : !requested.length && available.length === 1 ? available[0] : null;
  const selected = target ? safe.filter((row) => row.entity === target) : [];
  let inputs = {}, used = [], reason = 'unsupported-intent';
  if (intent === 'ENTITY_ANALYSIS' || intent === 'ENTITY_FACT') {
    used = selected;
    inputs = { entity: { symbol: target }, facts: Object.fromEntries(used.map((row) => [row.metric, row])) };
    reason = target ? 'company-facts-only-no-quality-or-valuation-score' : 'single-entity-required';
  } else if (intent === 'TECHNICAL_ANALYSIS' || intent === 'OUTLOOK') {
    const candidates = selected.filter((row) => technical.has(row.metric));
    if (new Set(candidates.map((row) => Date.parse(row.asOf))).size > 1) candidates.forEach((row) => reject(row, 'technical-observation-time-mismatch'));
    else used = candidates;
    if (new Set(used.filter((row) => row.metric !== 'rsi14').map((row) => row.unit)).size > 1) { used.forEach((row) => reject(row, 'technical-unit-mismatch')); used = []; }
    used = used.filter((row) => {
      const valid = row.metric === 'rsi14' ? ['rsi', 'index', 'score', 'unitless'].includes(row.unit) && row.value >= 0 && row.value <= 100 : /^(?:USD|KRW|EUR|GBP|JPY|currency|index)$/.test(row.unit) && (['macd', 'signal'].includes(row.metric) || row.value > 0);
      if (!valid) reject(row, 'technical-value-or-unit-invalid');
      return valid;
    });
    inputs = { symbol: target, indicators: Object.fromEntries(used.map((row) => [row.metric, row.value])), observedAt: used[0]?.asOf || null, source: [...new Set(used.map((row) => row.source))].join('; ') || null };
    reason = 'same-entity-time-unit-technical-observations-only';
  } else if (intent === 'MACRO_ANALYSIS' || intent === 'FX_ANALYSIS') {
    used = safe.filter((row) => macro.test(row.metric));
    const fx = used.filter((row) => /(?:\.fx\.|usdkrw|dxy)/i.test(row.metric));
    inputs = { target: { symbol: target }, macro: Object.fromEntries(used.filter((row) => !fx.includes(row)).map((row) => [`${row.entity}:${row.metric}`, row])), fx: Object.fromEntries(fx.map((row) => [`${row.entity}:${row.metric}`, row])), edges: [] };
    reason = 'observations-only-no-verified-transmission-edges';
  } else if (intent === 'SECTOR_ANALYSIS') reason = 'verified-sector-membership-and-universe-missing';
  else if (intent === 'MARKET_CAUSAL') reason = 'verified-time-aligned-event-links-missing';
  return Object.freeze({ inputs, audit: Object.freeze({ schemaVersion: AI_EVIDENCE_INPUTS_VERSION, intent, reason, inputCount: Array.isArray(evidence) ? evidence.length : 0, usedCount: used.length, evidenceIds: Object.freeze(used.map((row) => row.evidenceId)), rejected: Object.freeze(rejected), allowedUse: 'reference', currentClaimEligible: false }) });
}
