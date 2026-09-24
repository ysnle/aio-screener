import {
  SCREENER_CONTRACT_VERSION,
  SCREENER_FIELD_REGISTRY,
  CALCULABLE_FIELD_STATUSES,
  LIVE_QUOTE_MCAP_INPUT_ROW_KEYS,
  LIVE_QUOTE_PRICE_ROW_KEYS,
  SCREEN_NODE_TYPES,
  createRankExplanation,
  createScreenDefinition,
  createScreenRun,
  immutableCopy,
  stableHash,
  validateScreenDefinition
} from '../../data/contracts/screener.js';

// P1180/R24-04: engine v6 introduces the calculation input identity; screen-engine.v5 records
// keep legacy_identity_semantics in replayScreenRun.
export const SCREEN_ENGINE_VERSION = 'screen-engine.v6';

// P1180/R24-04 (07 W07-G): the factor input policy this engine declares. `live_capture` is
// today's honest behavior — an evidence-eligible live market cap feeds the size factor — so a
// mcap tick mints a new calculationInputId and result while the observation set stays fixed.
// The 07 artifact-fixed default requires the producer's marketCapObservation contract first.
export const FACTOR_INPUT_POLICY = 'live_capture';

const USABLE_REQUIRED_FIELD_STATUSES = new Set(CALCULABLE_FIELD_STATUSES);

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

function valueAt(row, field) {
  if (!field) return null;
  if (field === 'rank' || field === 'score' || field === 'symbol' || field === 'sym') return row?.[field] ?? null;
  const definition = SCREENER_FIELD_REGISTRY.get(field);
  if (definition?.rowKey && row?.[definition.rowKey] != null) return row[definition.rowKey];
  if (row?.fieldReadiness?.fields?.[field]?.value != null) return row.fieldReadiness.fields[field].value;
  return String(field).split('.').reduce((value, key) => value?.[key], row) ?? null;
}

function readinessAt(row, field) {
  return row?.fieldReadiness?.fields?.[field] || null;
}

function auditRequiredFields(row, requiredFields = []) {
  const required = [...new Set(Array.isArray(requiredFields) ? requiredFields : [])];
  const missingFields = required.filter((field) => {
    const readiness = readinessAt(row, field);
    return !readiness || readiness.value == null || readiness.value === '' || (typeof readiness.value === 'number' && !Number.isFinite(readiness.value)) || !USABLE_REQUIRED_FIELD_STATUSES.has(readiness.status);
  });
  return Object.freeze({
    required: required.length,
    ready: required.length - missingFields.length,
    missingFields: Object.freeze(missingFields),
    eligible: missingFields.length === 0
  });
}

function nullResult(node, row, definition) {
  const policy = node?.nullPolicy || definition.nullPolicy || 'unknown';
  if (policy === 'pass') return { state: 'pass', reason: null };
  if (policy === 'reject') return { state: 'fail', reason: `${node?.field || 'field'}:missing` };
  return { state: 'unknown', reason: `${node?.field || 'field'}:missing` };
}

function evaluateNode(node, row, definition) {
  if (!node || typeof node !== 'object' || !SCREEN_NODE_TYPES.includes(node.type)) return { state: 'unknown', reason: 'node:invalid' };
  if (node.type === 'and' || node.type === 'or') {
    const results = (node.children || []).map((child) => evaluateNode(child, row, definition));
    if (!results.length) return { state: node.type === 'and' ? 'pass' : 'unknown', reason: null };
    const states = new Set(results.map((result) => result.state));
    if (node.type === 'and') {
      if (states.has('fail')) return { state: 'fail', reason: results.find((result) => result.state === 'fail')?.reason || 'and:failed' };
      if (states.has('unknown')) return { state: 'unknown', reason: results.find((result) => result.state === 'unknown')?.reason || 'and:unknown' };
      return { state: 'pass', reason: null };
    }
    if (states.has('pass')) return { state: 'pass', reason: null };
    if (states.has('unknown')) return { state: 'unknown', reason: results.find((result) => result.state === 'unknown')?.reason || 'or:unknown' };
    return { state: 'fail', reason: results.map((result) => result.reason).filter(Boolean).join('|') || 'or:failed' };
  }
  if (node.type === 'not') {
    const result = evaluateNode(node.child, row, definition);
    return result.state === 'pass' ? { state: 'fail', reason: 'not:matched' } : result.state === 'fail' ? { state: 'pass', reason: null } : result;
  }
  const value = valueAt(row, node.field);
  const readiness = readinessAt(row, node.field);
  if (value == null || value === '') return nullResult(node, row, definition);
  if (readiness && !USABLE_REQUIRED_FIELD_STATUSES.has(readiness.status)) {
    return { state: 'unknown', reason: `${node.field}:${String(readiness.status || 'unknown').toLowerCase()}` };
  }
  if (node.type === 'exists') return { state: 'pass', reason: null };
  if (node.type === 'enum') return { state: node.values.map(String).includes(String(value)) ? 'pass' : 'fail', reason: node.values.map(String).includes(String(value)) ? null : `${node.field}:enum` };
  if (node.type === 'range') {
    const numeric = finite(value);
    if (numeric == null) return { state: 'unknown', reason: `${node.field}:not_numeric` };
    const lowerOk = node.min == null || (node.inclusive !== false ? numeric >= node.min : numeric > node.min);
    const upperOk = node.max == null || (node.inclusive !== false ? numeric <= node.max : numeric < node.max);
    return lowerOk && upperOk ? { state: 'pass', reason: null } : { state: 'fail', reason: `${node.field}:range` };
  }
  return { state: 'unknown', reason: `${node.type}:unsupported` };
}

function contributionFor(row, ranking) {
  const fields = Array.isArray(ranking?.fields) && ranking.fields.length ? ranking.fields : [ranking?.field || 'rank'];
  const contributions = {};
  let total = 0;
  let observed = 0;
  fields.forEach((field) => {
    const readiness = readinessAt(row, field);
    if (readiness && !USABLE_REQUIRED_FIELD_STATUSES.has(readiness.status)) return;
    const value = finite(valueAt(row, field));
    if (value == null) return;
    contributions[field] = value;
    total += value;
    observed += 1;
  });
  return { fields, contributions, total: observed ? total / observed : null, observed };
}

function makeExplanation(row, definition, gateResults, filterResult, rankingState = null) {
  const rank = contributionFor(row, definition.ranking);
  const missingEvidence = [...auditRequiredFields(row, definition.requiredFields).missingFields];
  // W07-B: a filter-passing row with no usable ranking field must name that field as missing
  // so the surface can read "조건 통과 · 순위 산출 불가" with the exact gap listed.
  if (rankingState === 'unavailable') {
    const rankFields = Array.isArray(definition.ranking?.fields) && definition.ranking.fields.length ? definition.ranking.fields : [definition.ranking?.field || 'rank'];
    rankFields.forEach((field) => { if (!missingEvidence.includes(field)) missingEvidence.push(field); });
  }
  const contraryEvidence = [];
  if (filterResult.state === 'fail' && filterResult.reason) contraryEvidence.push(filterResult.reason);
  return createRankExplanation({
    instrumentId: row.instrumentRef?.instrumentId || row.instrumentId || row.sym || row.symbol,
    totalScore: rank.total,
    contributions: rank.contributions,
    passedGates: gateResults.filter((result) => result.state === 'pass').map((result) => result.reason || 'gate:pass'),
    failedGates: gateResults.filter((result) => result.state === 'fail').map((result) => result.reason || 'gate:fail'),
    missingEvidence,
    contraryEvidence,
    factorPeers: row.factorScores || {},
    confidence: rank.observed ? Math.min(1, rank.observed / Math.max(1, rank.fields.length)) : 0,
    status: filterResult.state === 'unknown' || missingEvidence.length ? 'unavailable' : 'explained'
  });
}

export function compileScreenDefinition(definition) {
  const validation = validateScreenDefinition(definition);
  if (!validation.ok) throw new Error(`SCREEN_DEFINITION_INVALID:${validation.errors.join(',')}`);
  // Compilation is data-only. There is deliberately no eval/new Function path.
  return Object.freeze({
    definition,
    evaluate: (row) => evaluateNode(definition.filtersAST, row, definition),
    evaluateGate: (row, gate) => evaluateNode(gate, row, definition),
    hash: definition.definitionHash || stableHash(definition)
  });
}

// P1180/R24-04: every row key a definition can read — filters, hard gates, ranking and
// required fields, resolved through the registry exactly like valueAt does at evaluation time.
function collectDefinitionRowKeys(definition) {
  const rowKeys = new Set();
  const addField = (field) => {
    if (field == null || field === '') return;
    if (field === 'rank' || field === 'score' || field === 'sym' || field === 'symbol') { rowKeys.add(String(field)); return; }
    const registered = SCREENER_FIELD_REGISTRY.get(field);
    if (registered?.rowKey) rowKeys.add(String(registered.rowKey));
  };
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.field) addField(node.field);
    if (Array.isArray(node.fields)) node.fields.forEach(addField);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(definition?.filtersAST);
  if (Array.isArray(definition?.hardGates)) definition.hardGates.forEach(walk);
  if (definition?.ranking) { addField(definition.ranking.field); if (Array.isArray(definition.ranking.fields)) definition.ranking.fields.forEach(addField); }
  if (Array.isArray(definition?.requiredFields)) definition.requiredFields.forEach(addField);
  return rowKeys;
}

// P1180/R24-04: the live overlay keys this calculation actually consumes. The market-cap family
// is a rank input under the live_capture policy and always belongs to the identity; the price
// family joins only when the definition reads row.price — an unconsumed UI overlay must never
// mint a calculation identity (07 W07-G).
function calculationLiveInputKeys(definition) {
  const referenced = collectDefinitionRowKeys(definition);
  const keys = [...LIVE_QUOTE_MCAP_INPUT_ROW_KEYS];
  if (referenced.has('price')) for (const key of LIVE_QUOTE_PRICE_ROW_KEYS) if (!keys.includes(key)) keys.push(key);
  return keys;
}

export function runScreen({ definition, rows = [], snapshotId = 'unknown', providerSet = [], startedAt = new Date().toISOString(), completedAt = new Date().toISOString(), engineVersion = SCREEN_ENGINE_VERSION, factorInputPolicy = FACTOR_INPUT_POLICY, legacyResultIdentity = false } = {}) {
  const compiled = compileScreenDefinition(definition);
  const entries = (Array.isArray(rows) ? rows : []).map((row, inputIndex) => {
    const gateResults = (definition.hardGates || []).map((gate) => compiled.evaluateGate(row, gate));
    const filterResult = compiled.evaluate(row);
    const hardFail = gateResults.some((result) => result.state === 'fail');
    const hardUnknown = gateResults.some((result) => result.state === 'unknown');
    const requiredAudit = auditRequiredFields(row, definition.requiredFields);
    // W07-B/P1146 (M02): admission and ranking are separate states. A row may satisfy every
    // filter yet have no usable ranking field; it stays visible as passed but must not receive
    // an ordinal rank as if the missing score were the best one.
    const filterState = hardFail || filterResult.state === 'fail' ? 'rejected' : hardUnknown || filterResult.state === 'unknown' || !requiredAudit.eligible ? 'unknown' : 'passed';
    const ranking = contributionFor(row, definition.ranking);
    const rankingState = filterState !== 'passed' ? 'not-requested' : ranking.total == null ? 'unavailable' : 'ranked';
    const explanation = makeExplanation(row, definition, gateResults, filterResult, rankingState);
    return {
      row,
      inputIndex,
      status: filterState,
      score: ranking.total,
      rankingState,
      explanationState: explanation.status === 'explained' ? 'explained' : 'unavailable',
      explanation
    };
  });
  const direction = definition.ranking?.direction === 'asc' ? 1 : -1;
  const sortEntries = entries.slice().sort((left, right) => {
    if (left.status !== right.status) return left.status === 'passed' ? -1 : right.status === 'passed' ? 1 : left.status === 'rejected' ? 1 : right.status === 'rejected' ? -1 : 0;
    if (left.score == null && right.score == null) return left.inputIndex - right.inputIndex;
    if (left.score == null) return 1;
    if (right.score == null) return -1;
    const difference = (left.score - right.score) * direction;
    return difference || left.inputIndex - right.inputIndex;
  });
  // Ranks are assigned only over passed rows with a usable score. Equal scores share one rank
  // and are separated by a stable display order, never by an invented economic tiebreak.
  const rankable = entries
    .filter((entry) => entry.status === 'passed' && finite(entry.score) != null)
    .sort((left, right) => {
      const difference = (left.score - right.score) * direction;
      return difference || left.inputIndex - right.inputIndex;
    });
  const rankByIndex = new Map();
  rankable.forEach((entry, index) => {
    const previous = rankable[index - 1];
    rankByIndex.set(entry.inputIndex, previous && previous.score === entry.score ? rankByIndex.get(previous.inputIndex) : index + 1);
  });
  const rowsWithResults = sortEntries.map((entry, displayOrder) => ({
    ...entry.row,
    // screenStatus stays the compatibility projection of the separated filter/ranking states.
    screenStatus: entry.status === 'unknown' ? 'unavailable' : entry.status,
    screenRank: rankByIndex.has(entry.inputIndex) ? rankByIndex.get(entry.inputIndex) : null,
    screenDisplayOrder: displayOrder + 1,
    screenFilterState: entry.status,
    screenRankingState: entry.rankingState,
    screenExplanationState: entry.explanationState,
    rankExplanation: entry.explanation
  }));
  const passed = entries.filter((entry) => entry.status === 'passed').length;
  const rejected = entries.filter((entry) => entry.status === 'rejected').length;
  const unavailable = entries.filter((entry) => entry.status === 'unknown').length;
  const explanationsHash = stableHash(entries.map((entry) => [entry.row.sym || entry.row.symbol, entry.status, entry.explanation]));
  // P1180/R24-04 (07 W07-G): three separated identities. `snapshotId` (observationSetId)
  // identifies the observation set that arrived; `calculationInputId` identifies what THIS
  // calculation consumed — definition, engine, factor input policy and the live overlay keys
  // the policy/definition actually read; `resultHash` derives from the calculation input plus
  // the ordered outputs. legacyResultIdentity recomputes the screen-engine.v5 formula exactly,
  // so a stored v5 record verifies against its own semantics instead of a re-derived feed.
  const calculationInputId = legacyResultIdentity ? null : stableHash({
    observationSetId: snapshotId,
    definitionHash: compiled.hash,
    engineVersion,
    factorInputPolicy,
    liveInputs: (() => {
      const liveKeys = calculationLiveInputKeys(definition);
      return rows.map((row) => ({
        symbol: row?.sym || row?.symbol || '',
        ...Object.fromEntries(liveKeys.map((key) => [key, row?.[key] ?? null]))
      }));
    })()
  });
  const resultHash = legacyResultIdentity
    ? stableHash({ engineVersion, definitionHash: compiled.hash, snapshotId, rows: entries.map((entry) => [entry.row.sym || entry.row.symbol, entry.status, entry.score]) })
    : stableHash({ calculationInputId, rows: entries.map((entry) => [entry.row.sym || entry.row.symbol, entry.status, entry.score]) });
  const readiness = summarizeScreenReadiness(rowsWithResults, definition.requiredFields || []);
  const run = createScreenRun({ screenId: definition.screenId, screenVersion: definition.version, definitionHash: compiled.hash, snapshotId, startedAt, completedAt, status: unavailable ? (passed || rejected ? 'partial' : 'unavailable') : 'completed', rowCount: entries.length, eligibleCount: readiness.eligibleCount, passed, rejected, unavailable, providerSet, engineVersion, explanationsHash, resultHash, ...(calculationInputId ? { calculationInputId, factorInputPolicy } : {}) });
  return Object.freeze({ run, rows: Object.freeze(rowsWithResults), readiness, rankedCount: rankByIndex.size, passed: Object.freeze(rowsWithResults.filter((row) => row.screenStatus === 'passed')), rejected: Object.freeze(rowsWithResults.filter((row) => row.screenStatus === 'rejected')), unavailable: Object.freeze(rowsWithResults.filter((row) => row.screenStatus === 'unavailable')), explanationsHash, resultHash });
}

export function captureScreenRun(input, result = runScreen(input)) {
  const record = JSON.parse(JSON.stringify({
    schemaVersion: 'screener-run-record.v1',
    definition: input.definition,
    rows: input.rows || [],
    snapshotId: input.snapshotId || 'unknown',
    providerSet: input.providerSet || [],
    metadata: input.metadata || {},
    engineVersion: result.run.engineVersion,
    run: result.run
  }));
  record.contentHash = stableHash(record);
  return immutableCopy(record);
}

export function replayScreenRun(record) {
  // P1180/R24-04: a screen-engine.v5 record predates the calculation input identity. It is
  // verified under legacy_identity_semantics — the stored inputs, hash and result are checked
  // against the v5 formula that produced them, never re-derived from the current live feed.
  const legacyIdentity = record?.run?.calculationInputId == null;
  if (record?.schemaVersion !== 'screener-run-record.v1') throw new Error('SCREEN_REPLAY_VERSION_UNSUPPORTED');
  if (legacyIdentity ? record.engineVersion !== 'screen-engine.v5' : record.engineVersion !== SCREEN_ENGINE_VERSION) throw new Error('SCREEN_REPLAY_VERSION_UNSUPPORTED');
  const { contentHash, ...content } = record;
  if (contentHash !== stableHash(content)) throw new Error('SCREEN_REPLAY_CONTENT_MISMATCH');
  const result = runScreen({ ...record, startedAt: record.run.startedAt, completedAt: record.run.completedAt, legacyResultIdentity: legacyIdentity, ...(record.run?.factorInputPolicy ? { factorInputPolicy: record.run.factorInputPolicy } : {}) });
  if (result.resultHash !== record.run.resultHash || result.explanationsHash !== record.run.explanationsHash) throw new Error('SCREEN_REPLAY_RESULT_MISMATCH');
  if (!legacyIdentity && result.run.calculationInputId !== record.run.calculationInputId) throw new Error('SCREEN_REPLAY_INPUT_MISMATCH');
  return result;
}

export function summarizeScreenReadiness(rows = [], requiredFields = []) {
  const all = Array.isArray(rows) ? rows : [];
  const required = [...new Set(requiredFields)];
  const records = all.map((row) => {
    const audit = auditRequiredFields(row, required);
    return { symbol: row.sym || row.symbol, ready: audit.ready, required: audit.required, eligible: audit.eligible, missingFields: audit.missingFields };
  });
  const eligible = records.filter((record) => record.eligible).length;
  return Object.freeze({ requiredFields: Object.freeze(required), rowCount: all.length, eligibleCount: eligible, coveragePct: all.length ? Math.round(eligible / all.length * 1000) / 10 : 0, records: Object.freeze(records) });
}

const preset = (screenId, name, objective, filtersAST, requiredFields, ranking = { field: 'rank', direction: 'desc' }) => createScreenDefinition({ screenId, version: 1, name, objective, filtersAST, requiredFields, ranking, columns: ['identity.symbol', 'identity.name', 'rank', 'price.ret3m', 'price.rsi14', 'technical.vcpScore'] });

export function createDefaultScreenDefinitions() {
  return Object.freeze([
    preset('preset-balanced', '균형 상대 랭킹', 'balanced-research', { type: 'range', field: 'rank', min: 60, nullPolicy: 'unknown' }, ['price.ret3m', 'price.pctSma200', 'price.rsi14']),
    preset('preset-momentum', '모멘텀 지속', 'momentum-research', { type: 'and', children: [{ type: 'range', field: 'price.ret3m', min: 0, nullPolicy: 'unknown' }, { type: 'range', field: 'rank', min: 60, nullPolicy: 'unknown' }] }, ['price.ret1m', 'price.ret3m', 'technical.kalmanVelocity']),
    preset('preset-trend', '추세 정렬', 'trend-research', { type: 'and', children: [{ type: 'range', field: 'price.pctSma50', min: 0, nullPolicy: 'unknown' }, { type: 'range', field: 'price.pctSma200', min: 0, nullPolicy: 'unknown' }] }, ['price.pctSma50', 'price.pctSma200']),
    preset('preset-lowvol', '저변동 방어', 'low-volatility-research', { type: 'range', field: 'price.volatility', max: 35, nullPolicy: 'unknown' }, ['price.volatility', 'price.rsi14'], { field: 'price.volatility', direction: 'asc' }),
    preset('preset-quality', '퀄리티 결합', 'quality-research', { type: 'and', children: [{ type: 'range', field: 'quality.roe', min: 10, nullPolicy: 'unknown' }, { type: 'range', field: 'quality.margin', min: 5, nullPolicy: 'unknown' }] }, ['quality.roe', 'quality.margin', 'quality.revGrowth']),
    preset('preset-breakout-observation', '돌파 관찰', 'breakout-observation', { type: 'and', children: [{ type: 'range', field: 'technical.vcpScore', min: 50, nullPolicy: 'unknown' }, { type: 'range', field: 'price.rvol20', min: 1, nullPolicy: 'unknown' }] }, ['technical.vcpScore', 'price.rvol20', 'technical.ema8', 'technical.ema21'])
  ]);
}

export function runDefaultScreens({ rows = [], snapshotId = 'unknown', providerSet = [] } = {}) {
  return Object.freeze(createDefaultScreenDefinitions().map((definition) => ({ definition, ...runScreen({ definition, rows, snapshotId, providerSet }) })));
}

export function createExplanationIndex(result) {
  return Object.freeze(Object.fromEntries((result?.rows || []).map((row) => [row.sym || row.symbol, row.rankExplanation])));
}
