// SCR-OS-01/02/05/07/09: the screener workbench contract is intentionally
// dependency-free so providers, the browser engine, AI adapters and scripts
// can consume the same immutable shapes without importing the legacy shell.
export const SCREENER_CONTRACT_VERSION = 'screener-workbench.v1';
export const FIELD_STATUS = Object.freeze([
  'CURRENT', 'DELAYED', 'STALE', 'MISSING', 'UNSUPPORTED',
  'BLOCKED_RIGHTS', 'CONFLICT', 'INFERRED', 'LAST_GOOD'
]);
export const OBSERVATION_SOURCES = Object.freeze(['T1_OFFICIAL', 'T2_LICENSED', 'T3_PUBLIC_DELAYED', 'T4_REFERENCE']);
export const SCREEN_NODE_TYPES = Object.freeze(['and', 'or', 'not', 'range', 'enum', 'exists']);
export const NULL_POLICIES = Object.freeze(['reject', 'pass', 'unknown']);
export const RUN_STATUSES = Object.freeze(['completed', 'partial', 'blocked', 'unavailable']);
export const OUTCOME_HORIZONS = Object.freeze(['T+1', 'T+5', 'T+21', 'T+63']);

const DAY = 86_400_000;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) Object.freeze(value);
  return value;
}

function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

// A stable, browser-safe hash is enough for snapshot/result parity. It is not
// a cryptographic signature and must never be used for credentials or auth.
export function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

export function stableHash(value) {
  const input = stableSerialize(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const FIELD_ROWS = [
  ['identity.symbol', '종목 코드', 'string', 'text', 'symbol', 30],
  ['identity.name', '기업명', 'string', 'text', 'name', 30],
  ['identity.market', '시장', 'enum', 'market', 'market', 30],
  ['identity.mic', 'MIC', 'string', 'code', 'mic', 30],
  ['identity.currency', '통화', 'enum', 'currency', 'currency', 30],
  ['identity.assetType', '자산 유형', 'enum', 'asset', 'assetType', 30],
  ['price.close', '종가', 'number', 'currency', 'price', 2],
  ['price.ret1m', '1개월 수익률', 'number', 'percent', 'ret1m', 3],
  ['price.ret3m', '3개월 수익률', 'number', 'percent', 'ret3m', 3],
  ['price.ret6m', '6개월 수익률', 'number', 'percent', 'ret6m', 3],
  ['price.volatility', '실현 변동성', 'number', 'percent', 'vol', 3],
  ['price.rsi14', 'RSI(14)', 'number', 'score', 'rsi', 3],
  ['price.pctSma50', '50일선 대비', 'number', 'percent', 'pctSma50', 3],
  ['price.pctSma200', '200일선 대비', 'number', 'percent', 'pctSma200', 3],
  ['price.rvol20', '20일 상대 거래량', 'number', 'ratio', 'rvol20', 3],
  ['price.dollarVolume30d', '30일 달러 거래대금', 'number', 'USD', 'dollarVolume30d', 3],
  ['technical.kalmanVelocity', 'Kalman 속도', 'number', 'score', 'kalmanVel', 3],
  ['technical.kalmanConfidence', 'Kalman 신뢰도', 'number', 'score', 'kalmanVelConf', 3],
  ['technical.vcpScore', 'VCP 점수', 'number', 'score', 'vcpScore', 3],
  ['technical.vcpStage', 'VCP 단계', 'enum', 'stage', 'vcpStage', 3],
  ['technical.ema8', 'EMA8', 'number', 'currency', 'ema8', 3],
  ['technical.ema21', 'EMA21', 'number', 'currency', 'ema21', 3],
  ['technical.ema60', 'EMA60', 'number', 'currency', 'ema60', 3],
  ['valuation.marketCap', '시가총액', 'number', 'USD_bn', 'mcap', 7],
  ['valuation.pe', 'PER', 'number', 'multiple', 'pe', 30],
  ['valuation.pb', 'PBR', 'number', 'multiple', 'pb', 30],
  ['valuation.evEbitda', 'EV/EBITDA', 'number', 'multiple', 'evEbitda', 30],
  ['quality.roe', 'ROE', 'number', 'percent', 'roe', 90],
  ['quality.margin', '영업/순이익률', 'number', 'percent', 'margin', 90],
  ['quality.revGrowth', '매출 성장률', 'number', 'percent', 'revGrowth', 90],
  ['fundamental.filedAt', '재무 보고일', 'date', 'date', '_fundamentalFiledAt', 365],
  ['fundamental.availableAt', '재무 이용 가능일', 'date', 'date', '_fundamentalObservedAt', 365],
  ['fundamental.source', '재무 출처', 'string', 'source', '_fundamentalSource', 365],
  ['news.latest', '최신 뉴스 요약', 'string', 'text', 'newsMemo', 2],
  ['news.observedAt', '뉴스 관측시각', 'date', 'date', 'newsTs', 2],
  ['breadth.marketAdvanceRatio', '시장 상승비율', 'number', 'ratio', 'advanceRatio', 2],
  ['regime.label', '시장 레짐', 'enum', 'regime', 'regimeLabel', 2]
];

const IDENTITY_KEYS = new Set(['symbol', 'name', 'market', 'mic', 'currency', 'assetType']);
const DEFAULT_FIELD_DEFINITIONS = FIELD_ROWS.map(([fieldId, label, type, unit, rowKey, freshnessDays]) => Object.freeze({
  fieldId,
  label,
  type,
  unit,
  rowKey,
  supportedMarkets: Object.freeze(['US', 'KR']),
  cadence: freshnessDays <= 3 ? 'session/eod' : 'filing/reconciliation',
  freshnessBudgetMs: freshnessDays == null ? null : freshnessDays * DAY,
  requiredCapabilities: Object.freeze([fieldId.split('.')[0]]),
  missingPolicy: type === 'number' ? 'unknown' : 'reject',
  reconciliationPolicy: type === 'number' ? 'tolerance' : 'source-priority',
  allowedUse: fieldId.startsWith('news.') ? 'reference' : 'research-relative-ranking-only'
}));

export function createFieldRegistry(definitions = DEFAULT_FIELD_DEFINITIONS) {
  const fields = (Array.isArray(definitions) ? definitions : []).map((definition) => Object.freeze({
    ...definition,
    fieldId: String(definition?.fieldId || ''),
    supportedMarkets: Object.freeze(Array.isArray(definition?.supportedMarkets) ? [...definition.supportedMarkets] : []),
    requiredCapabilities: Object.freeze(Array.isArray(definition?.requiredCapabilities) ? [...definition.requiredCapabilities] : [])
  })).filter((definition) => definition.fieldId);
  const byId = new Map(fields.map((field) => [field.fieldId, field]));
  return Object.freeze({
    version: SCREENER_CONTRACT_VERSION,
    fields: Object.freeze(fields),
    size: fields.length,
    get: (fieldId) => byId.get(String(fieldId || '')) || null,
    has: (fieldId) => byId.has(String(fieldId || ''))
  });
}

export const SCREENER_FIELD_REGISTRY = createFieldRegistry();

export function createInstrumentRef(input = {}) {
  const symbol = String(input.symbol || input.sym || '').trim().toUpperCase();
  const market = String(input.market || input.index || '').toUpperCase();
  const assetType = String(input.assetType || 'EQUITY').toUpperCase();
  const currency = String(input.currency || (market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ' ? 'KRW' : 'USD')).toUpperCase();
  return Object.freeze({
    instrumentId: String(input.instrumentId || `${market || 'UNKNOWN'}:${symbol}`),
    symbol,
    mic: String(input.mic || (currency === 'KRW' ? 'XKRX' : 'XNAS')),
    assetType,
    currency,
    market: market || (currency === 'KRW' ? 'KR' : 'US'),
    validFrom: iso(input.validFrom) || null,
    validTo: iso(input.validTo) || null
  });
}

export function validateInstrumentRef(ref) {
  const errors = [];
  if (!ref?.instrumentId) errors.push('instrument_id_missing');
  if (!ref?.symbol) errors.push('symbol_missing');
  if (!ref?.mic) errors.push('mic_missing');
  if (!ref?.assetType) errors.push('asset_type_missing');
  if (!ref?.currency) errors.push('currency_missing');
  if (!ref?.market) errors.push('market_missing');
  if (ref?.validFrom && ref?.validTo && Date.parse(ref.validFrom) > Date.parse(ref.validTo)) errors.push('valid_range_inverted');
  return Object.freeze({ ok: errors.length === 0, errors });
}

export function createObservationEnvelope(input = {}) {
  const status = FIELD_STATUS.includes(input.qualityStatus) ? input.qualityStatus : 'MISSING';
  const sourceKind = OBSERVATION_SOURCES.includes(input.sourceKind) ? input.sourceKind : 'T3_PUBLIC_DELAYED';
  return Object.freeze({
    observationId: String(input.observationId || `${input.instrumentId || 'unknown'}:${input.fieldId || 'unknown'}:${stableHash({ value: input.value, observedAt: input.observedAt, sourceId: input.sourceId })}`),
    instrumentId: String(input.instrumentId || ''),
    fieldId: String(input.fieldId || ''),
    value: input.value ?? null,
    unit: String(input.unit || 'unitless'),
    sourceId: String(input.sourceId || 'unknown'),
    observedAt: iso(input.observedAt),
    filedAt: iso(input.filedAt),
    fetchedAt: iso(input.fetchedAt),
    effectiveAt: iso(input.effectiveAt || input.observedAt),
    revisionId: String(input.revisionId || 'unpublished'),
    sourceKind,
    rightsId: String(input.rightsId || 'unknown'),
    qualityStatus: status,
    allowedUse: String(input.allowedUse || (status === 'CURRENT' ? 'research-relative-ranking-only' : 'reference-only')),
    evidenceId: String(input.evidenceId || ''),
    note: String(input.note || '')
  });
}

export function validateObservationEnvelope(observation) {
  const errors = [];
  if (!observation || typeof observation !== 'object') errors.push('observation_not_object');
  for (const field of ['instrumentId', 'fieldId', 'unit', 'sourceId', 'revisionId', 'rightsId', 'allowedUse']) if (!observation?.[field]) errors.push(`${field}_missing`);
  if (!FIELD_STATUS.includes(observation?.qualityStatus)) errors.push('quality_status_invalid');
  if (!OBSERVATION_SOURCES.includes(observation?.sourceKind)) errors.push('source_kind_invalid');
  if (observation?.qualityStatus === 'CURRENT' && observation.value == null) errors.push('current_value_missing');
  if (observation?.qualityStatus === 'CURRENT' && observation.rightsId !== 'VERIFIED') errors.push('current_rights_unverified');
  for (const field of ['observedAt', 'filedAt', 'fetchedAt', 'effectiveAt']) if (observation?.[field] && Number.isNaN(Date.parse(observation[field]))) errors.push(`${field}_invalid`);
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}

function rowValue(row, definition) {
  if (IDENTITY_KEYS.has(definition.rowKey)) return row?.[definition.rowKey] ?? row?.instrumentRef?.[definition.rowKey] ?? null;
  return definition.rowKey ? row?.[definition.rowKey] ?? null : null;
}

function fieldObservationContext(row, definition) {
  const fieldId = String(definition?.fieldId || '');
  const rowKey = String(definition?.rowKey || '');
  if (fieldId.startsWith('identity.')) {
    return { observedAt: row.identityObservedAt || null, fetchedAt: row.identityFetchedAt || row.fetchedAt || null, sourceId: row.identitySource || 'screener-universe' };
  }
  if (fieldId === 'price.close') {
    return { observedAt: row.priceObservedAt || null, fetchedAt: row.priceFetchedAt || null, sourceId: row.priceSource || 'runtime-quote', revisionId: row.priceRevision || null };
  }
  if (fieldId === 'valuation.marketCap') {
    return { observedAt: row._mcapObservedAt || null, fetchedAt: row._mcapFetchedAt || null, sourceId: row._mcapSource || 'runtime-quote', revisionId: row._mcapRevision || null };
  }
  if (fieldId.startsWith('valuation.') || fieldId.startsWith('quality.') || fieldId.startsWith('fundamental.')) {
    return { observedAt: row._fundamentalObservedAt || null, filedAt: row._fundamentalFiledAt || null, fetchedAt: row._fundamentalFetchedAt || null, sourceId: row._fundamentalSource || 'fundamental-artifact' };
  }
  if (fieldId.startsWith('news.')) {
    return { observedAt: row.newsObservedAt || row.newsTs || null, fetchedAt: row.newsFetchedAt || row.fetchedAt || null, sourceId: row.newsSource || 'ticker-news-artifact' };
  }
  if (fieldId.startsWith('breadth.')) {
    return { observedAt: row.breadthObservedAt || null, fetchedAt: row.breadthFetchedAt || row.fetchedAt || null, sourceId: row.breadthSource || 'screener-breadth-artifact' };
  }
  if (fieldId.startsWith('regime.')) {
    return { observedAt: row.regimeObservedAt || null, fetchedAt: row.regimeFetchedAt || row.fetchedAt || null, sourceId: row.regimeSource || 'ranking-regime' };
  }
  return {
    observedAt: row[`${rowKey}ObservedAt`] || row.observedAt || null,
    filedAt: null,
    fetchedAt: row[`${rowKey}FetchedAt`] || row.fetchedAt || null,
    sourceId: row[`${rowKey}Source`] || row.source || 'screener-artifact'
  };
}

export function classifyFieldStatus({ value, observedAt, now = Date.now(), freshnessBudgetMs = null, supported = true, rights = 'UNKNOWN', conflict = false, sourceKind = 'T3_PUBLIC_DELAYED', lastGood = false } = {}) {
  if (!supported) return 'UNSUPPORTED';
  if (String(rights) !== 'VERIFIED') return 'BLOCKED_RIGHTS';
  if (conflict) return 'CONFLICT';
  if (value == null || value === '') return lastGood ? 'LAST_GOOD' : 'MISSING';
  const observedMs = observedAt ? Date.parse(observedAt) : NaN;
  if (Number.isNaN(observedMs)) return 'STALE';
  if (freshnessBudgetMs != null && Math.max(0, now - observedMs) > freshnessBudgetMs) return lastGood ? 'LAST_GOOD' : 'STALE';
  return String(sourceKind) === 'T3_PUBLIC_DELAYED' ? 'DELAYED' : 'CURRENT';
}

export function buildFieldReadiness(row = {}, { registry = SCREENER_FIELD_REGISTRY, now = Date.now(), revisionId = 'unpublished', supportedFields = null, rightsByField = {}, conflictFields = [], sourceId = 'screener-artifact', sourceKind = 'T3_PUBLIC_DELAYED' } = {}) {
  const supported = supportedFields instanceof Set ? supportedFields : null;
  const conflicts = new Set(conflictFields);
  const instrumentRef = row.instrumentRef || createInstrumentRef(row);
  const observations = [];
  const readiness = {};
  for (const definition of registry.fields) {
    const value = rowValue(row, definition);
    const context = fieldObservationContext(row, definition);
    const observedAt = context.observedAt;
    const filedAt = context.filedAt || null;
    const fetchedAt = context.fetchedAt || null;
    const fieldSourceId = context.sourceId || sourceId;
    const fieldRevisionId = context.revisionId || revisionId;
    const status = classifyFieldStatus({
      value,
      observedAt,
      now,
      freshnessBudgetMs: definition.freshnessBudgetMs,
      supported: supported ? supported.has(definition.fieldId) : !row._unsupportedFields?.includes?.(definition.fieldId),
      rights: rightsByField[definition.fieldId] || 'UNKNOWN',
      conflict: conflicts.has(definition.fieldId),
      sourceKind,
      lastGood: row._lastGoodFields?.includes?.(definition.fieldId)
    });
    const observation = createObservationEnvelope({ instrumentId: instrumentRef.instrumentId, fieldId: definition.fieldId, value, unit: definition.unit, sourceId: fieldSourceId, observedAt, filedAt, fetchedAt, revisionId: fieldRevisionId, sourceKind, rightsId: rightsByField[definition.fieldId] || 'unknown', qualityStatus: status, allowedUse: definition.allowedUse, evidenceId: row[`${definition.rowKey}EvidenceId`] || '' });
    observations.push(observation);
    readiness[definition.fieldId] = Object.freeze({ status, value: value ?? null, unit: definition.unit, sourceId: fieldSourceId, observedAt: observation.observedAt, filedAt: observation.filedAt, fetchedAt: observation.fetchedAt, revisionId: observation.revisionId, allowedUse: observation.allowedUse, evidenceId: observation.evidenceId });
  }
  return Object.freeze({ instrumentRef, observations: Object.freeze(observations), fields: Object.freeze(readiness), coverage: summarizeFieldReadiness(readiness) });
}

export function summarizeFieldReadiness(readiness = {}) {
  const values = Object.values(readiness);
  const counts = Object.fromEntries(FIELD_STATUS.map((status) => [status, 0]));
  values.forEach((field) => { if (counts[field?.status] != null) counts[field.status] += 1; });
  const usable = counts.CURRENT + counts.DELAYED + counts.LAST_GOOD + counts.INFERRED;
  return Object.freeze({ total: values.length, usable, coveragePct: values.length ? Math.round(usable / values.length * 1000) / 10 : 0, counts: Object.freeze(counts) });
}

export function createScreenDefinition(input = {}) {
  const definition = {
    schemaVersion: SCREENER_CONTRACT_VERSION,
    screenId: String(input.screenId || `screen-${stableHash(input)}`),
    version: Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
    name: String(input.name || 'Unnamed screen'),
    objective: String(input.objective || 'research-relative-ranking'),
    horizon: String(input.horizon || 'T+21'),
    universeRef: String(input.universeRef || 'aio-screener-universe'),
    filtersAST: input.filtersAST || { type: 'and', children: [] },
    hardGates: Array.isArray(input.hardGates) ? input.hardGates : [],
    ranking: input.ranking && typeof input.ranking === 'object' ? { ...input.ranking } : { field: 'rank', direction: 'desc' },
    columns: Array.isArray(input.columns) ? [...input.columns] : ['identity.symbol', 'identity.name', 'rank'],
    requiredFields: Array.isArray(input.requiredFields) ? [...new Set(input.requiredFields.map(String))] : [],
    minCoverage: Number.isFinite(input.minCoverage) ? Math.max(0, Math.min(1, input.minCoverage)) : 0.8,
    nullPolicy: NULL_POLICIES.includes(input.nullPolicy) ? input.nullPolicy : 'unknown',
    regimePolicy: input.regimePolicy && typeof input.regimePolicy === 'object' ? { ...input.regimePolicy } : { mode: 'fixed', autoPromote: false },
    createdAt: iso(input.createdAt) || new Date(0).toISOString(),
    createdBy: String(input.createdBy || 'local')
  };
  definition.definitionHash = stableHash({ ...definition, definitionHash: undefined });
  return Object.freeze(definition);
}

function validateNode(node, path = 'filtersAST') {
  const errors = [];
  if (!node || typeof node !== 'object' || !SCREEN_NODE_TYPES.includes(node.type)) return [`${path}:node_invalid`];
  if (node.type === 'and' || node.type === 'or') {
    if (!Array.isArray(node.children)) errors.push(`${path}:children_missing`);
    (node.children || []).forEach((child, index) => errors.push(...validateNode(child, `${path}.${index}`)));
  } else if (node.type === 'not') {
    errors.push(...validateNode(node.child, `${path}.child`));
  } else {
    if (!node.field) errors.push(`${path}:field_missing`);
    if (node.field && !SCREENER_FIELD_REGISTRY.has(node.field) && !['rank', 'score', 'symbol', 'sym'].includes(node.field)) errors.push(`${path}:field_unknown`);
    if (!NULL_POLICIES.includes(node.nullPolicy || 'unknown')) errors.push(`${path}:null_policy_invalid`);
    if (node.type === 'range' && node.min == null && node.max == null) errors.push(`${path}:range_missing`);
    if (node.type === 'enum' && (!Array.isArray(node.values) || !node.values.length)) errors.push(`${path}:values_missing`);
  }
  return errors;
}

export function validateScreenDefinition(definition) {
  const errors = [];
  if (!definition || definition.schemaVersion !== SCREENER_CONTRACT_VERSION) errors.push('schema_version_invalid');
  if (!definition?.screenId) errors.push('screen_id_missing');
  if (!Number.isInteger(definition?.version) || definition.version < 1) errors.push('version_invalid');
  if (!definition?.name) errors.push('name_missing');
  if (!OUTCOME_HORIZONS.includes(definition?.horizon)) errors.push('horizon_invalid');
  errors.push(...validateNode(definition?.filtersAST));
  (definition?.hardGates || []).forEach((gate, index) => errors.push(...validateNode(gate, `hardGates.${index}`)));
  const rankingFields = Array.isArray(definition?.ranking?.fields) ? definition.ranking.fields : [definition?.ranking?.field];
  rankingFields.filter(Boolean).forEach((field) => { if (!SCREENER_FIELD_REGISTRY.has(field) && !['rank', 'score', 'symbol', 'sym'].includes(field)) errors.push(`ranking_field_unknown:${field}`); });
  (definition?.requiredFields || []).forEach((field) => { if (!SCREENER_FIELD_REGISTRY.has(field)) errors.push(`required_field_unknown:${field}`); });
  if (!['asc', 'desc'].includes(definition?.ranking?.direction)) errors.push('ranking_direction_invalid');
  if (definition?.minCoverage < 0 || definition?.minCoverage > 1) errors.push('min_coverage_invalid');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}

export function createRankExplanation(input = {}) {
  return Object.freeze({
    instrumentId: String(input.instrumentId || ''),
    totalScore: finite(input.totalScore),
    contributions: Object.freeze({ ...(input.contributions || {}) }),
    passedGates: Object.freeze(Array.isArray(input.passedGates) ? [...input.passedGates] : []),
    failedGates: Object.freeze(Array.isArray(input.failedGates) ? [...input.failedGates] : []),
    missingEvidence: Object.freeze(Array.isArray(input.missingEvidence) ? [...input.missingEvidence] : []),
    contraryEvidence: Object.freeze(Array.isArray(input.contraryEvidence) ? [...input.contraryEvidence] : []),
    factorPeers: Object.freeze({ ...(input.factorPeers || {}) }),
    confidence: finite(input.confidence),
    status: input.status || (input.missingEvidence?.length ? 'unavailable' : 'explained')
  });
}

export function validateRankExplanation(explanation) {
  const errors = [];
  if (!explanation?.instrumentId) errors.push('instrument_id_missing');
  if (!Array.isArray(explanation?.passedGates) || !Array.isArray(explanation?.failedGates)) errors.push('gate_arrays_missing');
  if (!Array.isArray(explanation?.missingEvidence) || !Array.isArray(explanation?.contraryEvidence)) errors.push('evidence_arrays_missing');
  if (explanation?.status !== 'unavailable' && explanation?.status !== 'explained') errors.push('status_invalid');
  return Object.freeze({ ok: errors.length === 0, errors });
}

export function createScreenRun(input = {}) {
  const run = {
    schemaVersion: SCREENER_CONTRACT_VERSION,
    runId: String(input.runId || `run-${stableHash(input)}`),
    screenId: String(input.screenId || ''),
    screenVersion: Number(input.screenVersion || 1),
    definitionHash: String(input.definitionHash || ''),
    snapshotId: String(input.snapshotId || ''),
    startedAt: iso(input.startedAt) || new Date(0).toISOString(),
    completedAt: iso(input.completedAt) || null,
    status: RUN_STATUSES.includes(input.status) ? input.status : 'unavailable',
    eligibleCount: Number.isInteger(input.eligibleCount) ? input.eligibleCount : 0,
    passed: Number.isInteger(input.passed) ? input.passed : 0,
    rejected: Number.isInteger(input.rejected) ? input.rejected : 0,
    unavailable: Number.isInteger(input.unavailable) ? input.unavailable : 0,
    providerSet: Object.freeze(Array.isArray(input.providerSet) ? [...input.providerSet] : []),
    engineVersion: String(input.engineVersion || 'screen-engine.v1'),
    explanationsHash: String(input.explanationsHash || ''),
    resultHash: String(input.resultHash || ''),
    allowedUse: 'research-relative-ranking-only'
  };
  return Object.freeze(run);
}

export function validateScreenRun(run) {
  const errors = [];
  for (const field of ['runId', 'screenId', 'definitionHash', 'snapshotId', 'engineVersion']) if (!run?.[field]) errors.push(`${field}_missing`);
  if (!RUN_STATUSES.includes(run?.status)) errors.push('status_invalid');
  if (run?.passed + run?.rejected + run?.unavailable > run?.eligibleCount) errors.push('counts_exceed_eligible');
  if (run?.completedAt && Date.parse(run.completedAt) < Date.parse(run.startedAt)) errors.push('completion_before_start');
  return Object.freeze({ ok: errors.length === 0, errors });
}

export function createOutcomeObservation(input = {}) {
  const horizon = OUTCOME_HORIZONS.includes(input.horizon) ? input.horizon : 'T+21';
  return Object.freeze({
    schemaVersion: SCREENER_CONTRACT_VERSION,
    outcomeId: String(input.outcomeId || `outcome-${stableHash(input)}`),
    runId: String(input.runId || ''),
    instrumentId: String(input.instrumentId || ''),
    horizon,
    entryConvention: String(input.entryConvention || 'next-completed-close'),
    entryObservedAt: iso(input.entryObservedAt),
    exitObservedAt: iso(input.exitObservedAt),
    rawReturn: finite(input.rawReturn),
    benchmarkReturn: finite(input.benchmarkReturn),
    maxDrawdown: finite(input.maxDrawdown),
    liquidityFlags: Object.freeze(Array.isArray(input.liquidityFlags) ? [...input.liquidityFlags] : []),
    costsApplied: input.costsApplied === true,
    costBps: finite(input.costBps),
    status: input.status || (input.rawReturn == null ? 'unavailable' : 'observed'),
    observedAt: iso(input.observedAt) || null,
    allowedUse: 'research-relative-ranking-only'
  });
}

export function validateOutcomeObservation(outcome) {
  const errors = [];
  for (const field of ['outcomeId', 'runId', 'instrumentId', 'horizon', 'entryConvention']) if (!outcome?.[field]) errors.push(`${field}_missing`);
  if (!OUTCOME_HORIZONS.includes(outcome?.horizon)) errors.push('horizon_invalid');
  if (outcome?.status === 'observed' && (outcome.rawReturn == null || !outcome.entryObservedAt || !outcome.exitObservedAt)) errors.push('observed_outcome_incomplete');
  if (!outcome?.costsApplied && outcome?.status === 'observed') errors.push('costs_not_applied');
  return Object.freeze({ ok: errors.length === 0, errors });
}

export function createRegimeState(input = {}) {
  return Object.freeze({
    schemaVersion: SCREENER_CONTRACT_VERSION,
    regimeId: String(input.regimeId || `regime-${stableHash(input)}`),
    observedAt: iso(input.observedAt),
    inputs: Object.freeze({ ...(input.inputs || {}) }),
    state: String(input.state || 'UNKNOWN'),
    confidence: finite(input.confidence),
    missingInputs: Object.freeze(Array.isArray(input.missingInputs) ? [...input.missingInputs] : []),
    transitionReason: String(input.transitionReason || ''),
    hysteresisState: String(input.hysteresisState || 'stable'),
    allowedUse: input.allowedUse || 'reference-only',
    liveBacktestParity: input.liveBacktestParity === true
  });
}

export function createProviderCapability(input = {}) {
  return Object.freeze({
    providerId: String(input.providerId || ''),
    independenceGroup: String(input.independenceGroup || input.providerId || 'unknown'),
    tier: String(input.tier || 'T3_PUBLIC_DELAYED'),
    markets: Object.freeze(Array.isArray(input.markets) ? [...input.markets] : []),
    fields: Object.freeze(Array.isArray(input.fields) ? [...input.fields] : []),
    cadence: String(input.cadence || 'unknown'),
    revisionPolicy: String(input.revisionPolicy || 'unknown'),
    rights: String(input.rights || 'UNKNOWN'),
    cost: String(input.cost || 'unknown'),
    quota: input.quota && typeof input.quota === 'object' ? Object.freeze({ ...input.quota }) : Object.freeze({}),
    fallbackProviderIds: Object.freeze(Array.isArray(input.fallbackProviderIds) ? [...input.fallbackProviderIds] : []),
    divergenceTolerance: finite(input.divergenceTolerance)
  });
}

export function createRefreshDemand(input = {}) {
  return Object.freeze({
    demandId: String(input.demandId || `refresh-${stableHash(input)}`),
    instrumentId: String(input.instrumentId || ''),
    fieldGroup: String(input.fieldGroup || ''),
    asOfBucket: String(input.asOfBucket || 'unknown'),
    priority: Number.isFinite(input.priority) ? input.priority : 50,
    reason: String(input.reason || 'field_not_ready'),
    attempts: Number.isInteger(input.attempts) ? input.attempts : 0,
    nextRetryAt: iso(input.nextRetryAt),
    lkgObservedAt: iso(input.lkgObservedAt),
    status: String(input.status || 'queued')
  });
}

export function validateFieldRegistry(registry = SCREENER_FIELD_REGISTRY) {
  const errors = [];
  const seen = new Set();
  for (const field of registry?.fields || []) {
    if (!field.fieldId || seen.has(field.fieldId)) errors.push(`field_identity:${field.fieldId || 'missing'}`);
    seen.add(field.fieldId);
    if (!field.unit || !field.rowKey && !field.fieldId.startsWith('identity.')) errors.push(`field_shape:${field.fieldId || 'missing'}`);
    if (!Array.isArray(field.supportedMarkets) || !field.supportedMarkets.includes('US') || !field.supportedMarkets.includes('KR')) errors.push(`field_market_coverage:${field.fieldId || 'missing'}`);
  }
  if ((registry?.fields?.length || 0) < 30) errors.push('field_registry_under_30');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)], size: registry?.fields?.length || 0 });
}
