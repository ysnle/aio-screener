#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/ci-artifact-semantics-check.mjs
//
// 발행 산출물의 "의미" 불변식. 구조·스키마·신선도가 아니라 값과 라벨이 실제로
// 그 뜻인지를 검사한다. 2026-09-17 의미·정합성 검토에서 확인된 결함이 대상이다.
//
//   P1090  macro._freshness_* 가 현재 상태를 말해야 한다 (sticky stale 금지)
//   P1091  operations-status 의 status/statusCode 어휘가 실제 값과 일치해야 한다
//   P1092  동결된 freshness 판정에 평가 시각이 있어야 한다
//   P1093  서술 근거(evidenceId/unit/metricId)가 발행 산출물 안에서 해소되어야 한다
//   P1094  표시 배분 + 조정항이 총점을 재구성할 수 있어야 한다
//   P1095  previous-completed-close 값은 현재 관측 시각을 상속하지 않는다
//
// 전환 규칙: P1090/P1093/P1095 는 프로듀서 출력 형식을 바꾼다. 커밋된 산출물은
// 다음 refresh 사이클에야 새 형식이 되므로, 산출물 단언은 "새 형식이 있는 행"에만
// 적용하고 프로듀서 계약은 코드에서 별도로 강제한다. 형식이 전파되면 조건을
// 무조건 단언으로 좁힌다.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { RECONCILIATION_STATUS } from '../src/data/contracts/reconciliation.js';

const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path).replace(/^\uFEFF/, ''));
const readIf = (path) => (existsSync(path) ? json(path) : null);

const errors = [];
const check = (label, ok, detail = '') => { if (!ok) errors.push(detail ? `${label}: ${detail}` : label); };

// A producer fix reaches the published artifact only on the next refresh cycle,
// so the artifact assertions below are gated for one cycle. That gate must
// expire: an unbounded "transition" branch turns into a permanent vacuous pass
// and the defect silently returns (P1099). After the deadline the assertions
// run unconditionally; the refreshed artifact is expected to satisfy them.
const TRANSITION_DEADLINE = '2026-10-18T00:00:00Z';
const inTransition = (label) => {
  if (Date.now() <= Date.parse(TRANSITION_DEADLINE)) {
    console.log(`[artifact-semantics] transition (expires ${TRANSITION_DEADLINE.slice(0, 10)}): ${label}`);
    return true;
  }
  console.log(`[artifact-semantics] transition expired ${TRANSITION_DEADLINE.slice(0, 10)}: ${label}`);
  return false;
};

const fetchData = read('scripts/fetch-data.mjs');
const history = readIf('public-data/history.json');
const data = readIf('public-data/data.json');
const snapshot = readIf('public-data/market-snapshot.json');
const operations = readIf('public-data/operations-status.json');
const reconciliation = readIf('public-data/reconciliation-status.json');

// ── P1090 / P1095 : producer contracts ──────────────────────────────────────
check('macro freshness is refreshed when a field recovers, not only set', /merged\[`_freshness_\$\{field\}`\] = 'observed'/.test(fetchData));
check('history declares the observation relation and timestamp source', /observationRelation:/.test(fetchData) && /observedAtSource:/.test(fetchData));
check('previous-completed-close does not fall back to the current observation time', !/observedAt: usePreviousClose \? \(previousObservedAt \|\|/.test(fetchData));
check('market analysis evidence prefers the canonical snapshot', /buildMarketAnalysisEvidence\(data, \{ snapshot \}\)/.test(fetchData) && /snapshotQuotes/.test(fetchData));

// ── P1090 : published macro freshness must not contradict its own source ─────
// Transition: a committed data.json predates the producer fix and carries only the
// old sticky markers. The producer contract above is enforced unconditionally; the
// artifact assertions below tighten as soon as a refresh publishes the new shape.
if (data?.macro) {
  const publishedObserved = Object.values(data.macro).includes('observed');
  if (!publishedObserved && inTransition('macro freshness markers predate P1090')) {
    // bounded: assertions below run unconditionally after TRANSITION_DEADLINE
  } else {
    const contradictions = [];
    for (const [key, value] of Object.entries(data.macro)) {
      const field = key.replace(/^_freshness_/, '');
      if (field === key) continue;
      if (value !== 'stale-reference') continue;
      const source = data.macro[`_source_${field}`];
      // A last-known-good carry-forward is the ONLY case where the published value is
      // not a fresh observation. Any live primary source beside a stale marker is a lie.
      if (source && source !== 'last-known-good' && source !== 'unknown') contradictions.push(`${field}(source=${source})`);
    }
    check('published _freshness_* never marks a freshly sourced field stale', contradictions.length === 0, contradictions.join(', '));
    check('macro publishes an explicit freshness marker for every sourced field',
      Object.keys(data.macro).filter((k) => /^_source_/.test(k)).every((k) => {
        const field = k.replace(/^_source_/, '');
        if (data.macro[k] === 'last-known-good') return data.macro[`_freshness_${field}`] === 'stale-reference';
        return data.macro[`_freshness_${field}`] === 'observed';
      }), 'source/freshness pairs disagree');
  }
}

// ── P1095 : history vintage timestamps ─────────────────────────────────────
if (Array.isArray(history) && history.length) {
  // `carried-forward` already exists in pre-P1095 rows, so the unambiguous marker of
  // the new producer output is `observedAtSource`.
  const anyRelation = history.some((row) => Object.values(row.fieldMeta || {}).some((meta) => meta?.observedAtSource));
  if (!anyRelation && inTransition('history rows predate P1095')) {
    // bounded: assertions below run unconditionally after TRANSITION_DEADLINE
  } else {
    const latest = history[history.length - 1];
    const marketFields = Object.keys(latest.fieldMeta || {});
    check('latest history row declares an observation relation for every market field',
      marketFields.length > 0 && marketFields.every((field) => typeof latest.fieldMeta[field]?.observationRelation === 'string'),
      `missing on ${marketFields.filter((field) => typeof latest.fieldMeta[field]?.observationRelation !== 'string').join(', ')}`);
    const violations = [];
    for (const row of history) {
      for (const [field, meta] of Object.entries(row.fieldMeta || {})) {
        if (!meta || meta.observationRelation !== 'previous-completed-close') continue;
        if (meta.observedAtSource === 'unavailable' && meta.observedAt != null) violations.push(`${row.date}.${field} claims a timestamp it could not know`);
        if (meta.observedAtSource === 'provider-previous-close' && row.cycleEnd && meta.observedAt && Date.parse(meta.observedAt) > Date.parse(row.cycleEnd)) {
          violations.push(`${row.date}.${field} previous close stamped after the completed cut`);
        }
      }
    }
    check('previous-completed-close timestamps identify a prior observation', violations.length === 0, violations.slice(0, 4).join(' | '));
  }
}

// ── P1091 / P1092 : operational vocabulary and frozen judgement ─────────────
if (operations) {
  const statuses = new Set(operations.statusVocabulary || []);
  const statusCodes = new Set(operations.statusCodeVocabulary || []);
  const declaredRights = new Set(operations.rightsVocabulary || []);
  const readinessKeys = new Set(['secretConfigured', 'workflowWired', 'lastCallSucceeded', 'dataCurrent']);
  const undeclared = [];
  const rightsUndeclared = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') {
        if (key === 'status' && !statuses.has(value)) undeclared.push(`${path}.status=${value}`);
        if (key === 'statusCode' && !statusCodes.has(value)) undeclared.push(`${path}.statusCode=${value}`);
        if ((key === 'rights' || key === 'licensedForUse') && !declaredRights.has(value)) rightsUndeclared.push(`${path}.${key}=${value}`);
        if (readinessKeys.has(key) && !statuses.has(value)) undeclared.push(`${path}.${key}=${value}`);
      }
      walk(value, `${path}.${key}`);
    }
  };
  walk({ overall: operations.overall, planes: operations.planes, ai: operations.ai, providers: operations.providers }, 'operations');
  check('every published status value is declared by the same artifact', undeclared.length === 0, undeclared.join(', '));
  if (!operations.rightsVocabulary && inTransition('operations rights vocabulary predates P1103')) {
    // bounded: assertion below runs unconditionally after TRANSITION_DEADLINE
  } else {
    check('every published rights value is declared by the same artifact', rightsUndeclared.length === 0, rightsUndeclared.join(', '));
  }
  check('frozen freshness judgement names its evaluation instant',
    typeof operations.planes?.durable?.freshness?.evaluatedAt === 'string' && !Number.isNaN(Date.parse(operations.planes.durable.freshness.evaluatedAt)));
  check('frozen freshness judgement is point-in-time, not a live claim',
    typeof operations.planes?.durable?.freshness?.generatedAt === 'string'
    && Date.parse(operations.planes.durable.freshness.evaluatedAt) >= Date.parse(operations.planes.durable.freshness.generatedAt));
}

// ── P1107 : a frozen field must not hide behind a live-sounding name ───────
if (data?.meta) {
  const checkedAt = Date.parse(String(data.meta.marketSurveysCheckedAt || ''));
  const generatedAt = Date.parse(String(data.meta.generatedAt || ''));
  if (data.meta.marketSurveysWebResearchCheckedAt === undefined && inTransition('market survey check timestamps predate P1107')) {
    // bounded: assertions below run unconditionally after TRANSITION_DEADLINE
  } else {
    check('the market survey check time is the automated check, not a carried constant',
      Number.isFinite(checkedAt) && Number.isFinite(generatedAt) && Math.abs(generatedAt - checkedAt) <= 12 * 3600000,
      `marketSurveysCheckedAt=${data.meta.marketSurveysCheckedAt} generatedAt=${data.meta.generatedAt}`);
    check('the carried web-research snapshot time keeps its own field',
      data.meta.marketSurveysWebResearchCheckedAt === (data.marketSurveys?.webResearchCheckedAt ?? null),
      `meta=${data.meta.marketSurveysWebResearchCheckedAt} surveys=${data.marketSurveys?.webResearchCheckedAt}`);
  }
}

// ── P1104 : carried-over worker health must prove it is still reusable ─────
if (operations) {
  const carried = [
    ['planes.fast.health', operations.planes?.fast?.health],
    ['ai.publicChat.health', operations.ai?.publicChat?.health]
  ].filter(([, health]) => health?.observationStatus === 'NOT_ATTEMPTED' && String(health?.status) === 'CURRENT');
  if (operations.planes?.fast?.health?.evidenceFresh === undefined && inTransition('carried worker health predates P1104')) {
    // bounded: assertion below runs unconditionally after TRANSITION_DEADLINE
  } else {
    const unproven = carried.filter(([, health]) => health.evidenceFresh !== true || typeof health.evidenceEvaluatedAt !== 'string');
    check('carried-over worker health declares a fresh, dated reuse decision', unproven.length === 0,
      unproven.map(([path]) => path).join(', '));
  }
}

// ── P1103 : the reconciliation surface must declare the vocabulary it uses ──
if (reconciliation) {
  const declared = new Set(reconciliation.statusVocabulary || []);
  const declaredRights = new Set(reconciliation.rightsVocabulary || []);
  const values = [reconciliation.overall, ...(reconciliation.categories || []).map((category) => category?.status)].filter((value) => typeof value === 'string');
  const rightsValues = (reconciliation.categories || []).map((category) => category?.evidence?.rights).filter((value) => typeof value === 'string');
  const promotable = (reconciliation.categories || []).filter((category) => category?.evidence?.promotable === true);
  const rightsBlocked = (operations?.blockers || []).some((blocker) => /rights/i.test(String(blocker)));
  if (!reconciliation.statusVocabulary && inTransition(`reconciliation vocabulary predates P1103 (${promotable.length} categor${promotable.length === 1 ? 'y' : 'ies'} still claim promotable)`)) {
    // bounded: assertions below run unconditionally after TRANSITION_DEADLINE
  } else {
    const undeclared = values.filter((value) => !declared.has(value));
    check('every published reconciliation status is declared by the same artifact', undeclared.length === 0, [...new Set(undeclared)].join(', '));
    check('the reconciliation vocabulary is complete for the published values',
      RECONCILIATION_STATUS.every((code) => declared.has(code)),
      `missing ${RECONCILIATION_STATUS.filter((code) => !declared.has(code)).join(', ')}`);
    const undeclaredRights = [...new Set(rightsValues.filter((value) => !declaredRights.has(value)))];
    check('every published reconciliation rights value is declared by the same artifact', undeclaredRights.length === 0, undeclaredRights.join(', '));
    check('promotion never exceeds the recorded rights verification',
      !(rightsBlocked && promotable.length > 0),
      `${promotable.map((category) => category.categoryId).join(', ')} promotable while blockers=[${(operations?.blockers || []).join(', ')}]`);
    check('a category is promotable only with verified rights',
      promotable.every((category) => category.evidence.rights === 'VERIFIED'),
      promotable.filter((category) => category.evidence.rights !== 'VERIFIED').map((category) => `${category.categoryId}=${category.evidence.rights}`).join(', '));
  }
  const categoryStatus = reconciliation.counts || {};
  const tally = {};
  for (const category of reconciliation.categories || []) tally[category?.status] = (tally[category?.status] || 0) + 1;
  const drift = Object.keys({ ...categoryStatus, ...tally }).filter((key) => Number(categoryStatus[key] || 0) !== Number(tally[key] || 0));
  check('published reconciliation counts equal the category tally', drift.length === 0, drift.join(', '));
}

// ── P1093 : narrative evidence must resolve inside the published artifacts ──
if (data?.marketAnalysis) {
  const resolvable = new Set();
  for (const row of (snapshot?.quotes || [])) if (row?.evidenceId) resolvable.add(row.evidenceId);
  for (const row of (data.marketAnalysis.metricEvidence || [])) if (row?.evidenceId) resolvable.add(row.evidenceId);
  const legacyNamespace = /^market-analysis:.*:\d{4}-\d{2}-\d{2}T/;
  const unresolved = [];
  for (const claim of (data.marketAnalysis.claims || [])) {
    for (const id of (claim.evidenceIds || [])) {
      if (resolvable.has(id) || legacyNamespace.test(id)) continue;
      unresolved.push(id);
    }
  }
  check('narrative claim evidence resolves in the published artifact set', unresolved.length === 0, unresolved.slice(0, 3).join(', '));

  // Canonical (post-P1093) rows must agree with the snapshot on unit and metricId.
  const snapshotByInstrument = new Map((snapshot?.quotes || []).map((row) => [row.instrumentId, row]));
  const disagreements = [];
  const canonicalRows = (data.marketAnalysis.metricEvidence || []).filter((row) => row?.canonicalMetricId);
  // The legacy-namespace exemption above must expire together with the producer
  // fix. Without this, a published artifact with zero canonical rows passes both
  // canonical assertions vacuously and the unit/metricId drift is invisible
  // (P1108).
  if (canonicalRows.length === 0 && !inTransition('narrative evidence predates P1093 canonical rows')) {
    check('narrative evidence publishes rows that resolve against the snapshot', false,
      `${(data.marketAnalysis.metricEvidence || []).length} metricEvidence rows carry no canonicalMetricId`);
  }
  const unitDefs = new Map();
  for (const [, row] of snapshotByInstrument) unitDefs.set(row.metricId, row.unit);
  for (const row of canonicalRows) {
    const canonical = (snapshot?.quotes || []).find((entry) => entry.metricId === row.canonicalMetricId);
    if (!canonical) { disagreements.push(`${row.canonicalMetricId} not in snapshot`); continue; }
    if (row.unit !== canonical.unit) disagreements.push(`${row.label} unit ${row.unit} != snapshot ${canonical.unit}`);
    if (Number(row.value) !== Number(canonical.value)) disagreements.push(`${row.label} value ${row.value} != snapshot ${canonical.value}`);
  }
  check('canonical narrative evidence agrees with the snapshot row it cites', disagreements.length === 0, disagreements.join(', '));
  check('narrative evidence uses the snapshot unit rather than a duplicated table',
    canonicalRows.every((row) => unitDefs.get(row.canonicalMetricId) === row.unit));
}

// ── P1094 : the visible breakdown must reconstruct the visible total ────────
const domain = await import(pathToFileURL('src/domain/signal/trading-score.js').href).catch(() => null);
check('trading score exposes a reconcilable breakdown', !!domain && /scoreBreakdown/.test(read('src/domain/signal/trading-score.js')));
if (domain) {
  const golden = json('architecture/fixtures/trading-score-golden.json');
  const resolveInputs = (inputs) => {
    const quote = (symbol, key = 'price') => inputs?.liveData?.[symbol]?.[key] ?? null;
    return {
      vix: quote('^VIX'), vvix: quote('^VVIX'), dxy: quote('DX-Y.NYB'), tnx: quote('^TNX'), oilPrice: quote('CL=F'),
      spxPrice: quote('^GSPC'), spx50ma: inputs?.spxMA?.['50'] ?? null, spx200ma: inputs?.spxMA?.['200'] ?? null,
      maCurrent: Number(inputs?.spxMATsFreshMs ?? 0) <= 4 * 86400000 && !!inputs?.spxMA,
      fg: inputs?.fg?.value ?? null, breadthAvailable: !!inputs?.breadth?.available, breadth200: inputs?.breadth?.sma20 ?? null,
      pcr: inputs?.pcr ?? null, hyBp: inputs?.hyBp ?? null,
      newsSentimentScore: inputs?.newsSentimentScore ?? null, newsRiskSignals: inputs?.newsRiskSignals || []
    };
  };
  const broken = [];
  for (const fixture of golden.fixtures) {
    const out = domain.computeTradingScoreModel({ ...resolveInputs(fixture.inputs), mode: fixture.mode });
    const breakdown = out.scoreBreakdown;
    if (out.total == null) { if (breakdown.total != null) broken.push(`${fixture.name}: total null but breakdown not`); continue; }
    const expected = Math.max(5, Math.min(100, Math.round(breakdown.weightedSumRaw / breakdown.availableWeight) + breakdown.adjustmentsTotal));
    if (out.total !== expected) broken.push(`${fixture.name}: total ${out.total} != reconstructed ${expected}`);
    if (breakdown.total !== out.total) broken.push(`${fixture.name}: breakdown.total ${breakdown.total} != total ${out.total}`);
    // P1118: the hero renders from the presentation, not from the score object. If the
    // presentation does not carry the same terms, the visible rows cannot explain the
    // visible total even though the artifact itself reconciles.
    const presentation = domain.deriveTradingScoreDecisionPresentation({ score: out, inputVersion: 'golden' });
    if (presentation.breakdown !== breakdown) broken.push(`${fixture.name}: presentation does not carry the score breakdown the hero must render`);
  }
  check('published total equals its declared terms for every golden fixture', broken.length === 0, broken.slice(0, 4).join(' | '));
}

// ── P1097 : self-reported counts must describe the payload they are attached to
if (data) {
  const news = Array.isArray(data.news) ? data.news : [];
  const publishers = new Set(news.map((item) => item?.source).filter(Boolean));
  const cycle = data.meta?.cycleComponents || {};
  if (data.meta?.newsFeedCount === undefined && inTransition('news counts predate P1097')) {
    // bounded: assertions below run unconditionally after TRANSITION_DEADLINE
  } else {
    check('newsCount matches the published news payload', Number(data.meta?.newsCount) === news.length, `meta=${data.meta?.newsCount} payload=${news.length}`);
    check('newsPublisherCount matches the published outlets', Number(data.meta?.newsPublisherCount) === publishers.size, `meta=${data.meta?.newsPublisherCount} payload=${publishers.size}`);
    check('the feed count is published under a feed name', Number.isFinite(Number(data.meta?.newsFeedCount)) && data.meta?.newsSourceCount === undefined, 'ambiguous newsSourceCount is still published');
  }
  check('reported quote counts reconcile with the cycle manifest',
    Number(data.meta?.symbolsOk) + Number(data.meta?.symbolsFail) === Number(cycle.requiredQuoteCount),
    `symbolsOk+symbolsFail=${Number(data.meta?.symbolsOk) + Number(data.meta?.symbolsFail)} requiredQuoteCount=${cycle.requiredQuoteCount}`);
}

// ── P1100 : the fear-greed daily series must be joinable by calendar day ────
if (data?.fearGreed?.history) {
  const points = data.fearGreed.history;
  const perDay = new Map();
  for (const point of points) {
    const day = String(point?.observedAt || '').slice(0, 10);
    perDay.set(day, (perDay.get(day) || 0) + 1);
  }
  const repeated = [...perDay.entries()].filter(([, count]) => count > 1);
  if (repeated.length && inTransition(`fear-greed history repeats ${repeated.length} calendar day(s)`)) {
    // bounded: assertions below run unconditionally after TRANSITION_DEADLINE
  } else {
    check('fear-greed history carries at most one point per calendar day', repeated.length === 0, repeated.slice(0, 4).map(([day, count]) => `${day}x${count}`).join(', '));
  }
  const last = points[points.length - 1];
  const lastDay = String(last?.observedAt || '').slice(0, 10);
  const headlineDay = String(data.fearGreed.asOf || '').slice(0, 10);
  if (last && lastDay && lastDay === headlineDay) {
    check('the fear-greed headline is the rounding of the latest daily point',
      Math.round(Number(last.score)) === Number(data.fearGreed.score),
      `headline=${data.fearGreed.score} latest=${last.score}`);
  }
}

// ── P1102 : one row shape and one meaning for absence in history.json ──────
if (Array.isArray(history) && history.length) {
  const columns = (row) => Object.keys(row).filter((key) => key !== 'fieldMeta').sort().join(',');
  const expected = columns(history[history.length - 1]);
  const ragged = history.filter((row) => columns(row) !== expected);
  if (ragged.length && inTransition(`history rows have ${ragged.length} different column set(s)`)) {
    // bounded: assertions below run unconditionally after TRANSITION_DEADLINE
  } else {
    check('every history row exposes the same column set', ragged.length === 0, `${ragged.length} rows differ; e.g. ${ragged[0]?.date}`);
  }
  const orphaned = [];
  for (const row of history) {
    for (const [field, meta] of Object.entries(row.fieldMeta || {})) {
      if (!Number.isFinite(Number(row[field]))) orphaned.push(`${row.date}.${field}`);
    }
  }
  check('history fieldMeta always describes a finite value', orphaned.length === 0, orphaned.slice(0, 4).join(' '));
}

// ── P1098 : a coverage ratio cannot exceed its own denominator ─────────────
const telegram = readIf('public-data/telegram-digest.json');
if (telegram?.coverage) {
  const coverage = telegram.coverage;
  const observed = Number(coverage.observedCount);
  const eligible = Number(coverage.eligibleTextCount);
  const selected = Number(coverage.selectedRawCount);
  const selectedEligible = Number(coverage.selectedEligibleCount);
  if (coverage.selectedEligibleCount === undefined && inTransition('telegram coverage funnel predates P1098')) {
    // bounded: assertions below run unconditionally after TRANSITION_DEADLINE
  } else {
    check('selectedEligibleCount stays inside the eligible text window', selectedEligible <= eligible, `${selectedEligible} > ${eligible}`);
    check('selectedRawCoveragePct cannot exceed 100', Number(coverage.selectedRawCoveragePct) <= 100, `${coverage.selectedRawCoveragePct}%`);
    check('selectedOfObservedPct cannot exceed 100', Number(coverage.selectedOfObservedPct) <= 100, `${coverage.selectedOfObservedPct}%`);
  }
  check('the selected set is a subset of the observed window', selected <= observed, `${selected} > ${observed}`);
  check('telegram observed lineage count matches the published payload',
    observed === (Array.isArray(telegram.observedItems) ? telegram.observedItems.length : -1),
    `coverage=${observed} items=${telegram.observedItems?.length ?? 'missing'}`);
}

// ── P1109 : published references must resolve, retired scopes must stay retired
// A curated reference artifact can point at an id that no longer exists. The
// atlas consumer renders an unresolved id as a generic chip with a placeholder
// label, so the defect is user-visible while every structural check passes:
// `relationship-guides.json` published five routeIds (`valuation`, `power-grid`,
// `aidc-power-delivery` x2, `aidc-construction`) that resolve to nothing in the
// corpus. Resolve against the union of identifier surfaces these guides are
// allowed to reference.
const idUniverse = new Set();
const addIds = (node) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(addIds); return; }
  for (const [key, value] of Object.entries(node)) {
    if (/(^id$|Id$|^canonicalId$|^legacyId$|^slug$|^unitId$|^nodeId$|^branchId$|^anchors?$)/.test(key)) {
      if (Array.isArray(value)) value.forEach((item) => { if (typeof item === 'string') idUniverse.add(item); });
      else if (typeof value === 'string') idUniverse.add(value);
    }
    if (key === 'aliases' || key === 'allowedRoutes') {
      if (Array.isArray(value)) value.forEach((item) => { if (typeof item === 'string') idUniverse.add(item); });
    }
    addIds(value);
  }
};
for (const source of ['public-data/knowledge/concepts.json', 'public-data/knowledge/route-targets.json', 'public-data/knowledge/coverage-matrix.json', 'public-data/atlas/taxonomy-node-coverage.json', 'public-data/atlas/deep-taxonomy.json', 'public-data/atlas/source-packets.json', 'public-data/principles/lesson-library.json', 'public-data/principles/node-guides.json', 'public-data/atlas/foundation-lessons.json']) {
  const artifact = readIf(source);
  if (artifact) addIds(artifact);
}
const guides = readIf('public-data/knowledge/relationship-guides.json');
if (guides?.guides) {
  const dangling = [];
  for (const guide of guides.guides) {
    for (const node of guide.nodes || []) {
      for (const routeId of node.routeIds || []) {
        if (typeof routeId === 'string' && !idUniverse.has(routeId)) dangling.push(`${guide.id}/${node.id}=${routeId}`);
      }
    }
  }
  check('every relationship-guide reference resolves to a declared identifier', dangling.length === 0, dangling.join(', '));
}

// ── P1115 : a client fetch path must have a publisher that always publishes
// The earnings panel fetches its keyless snapshot, but the producer returned
// without writing when no API key was configured — its own header claimed an
// "operator-key-required" snapshot was preserved. The path never existed, so every
// keyless client (and the route-soak browser gate) saw a 404. A fetch path with no
// publisher is a defect in the publisher, not in the client.
const earningsCalendar = readIf('public-data/earnings-calendar.json');
const earningsStatuses = new Set(['current-reference', 'operator-key-required']);
check('the keyless earnings snapshot is published under a declared status',
  !!earningsCalendar && earningsStatuses.has(earningsCalendar.status),
  earningsCalendar ? `status=${earningsCalendar.status}` : 'artifact missing');
check('an unavailable earnings snapshot publishes no rows',
  !earningsCalendar || earningsCalendar.status !== 'operator-key-required'
  || ((earningsCalendar.earnings || []).length === 0 && (earningsCalendar.ipos || []).length === 0),
  `earnings=${earningsCalendar?.earnings?.length} ipos=${earningsCalendar?.ipos?.length}`);

// The lab producer declares an excluded product scope and publishes nothing.
// Its previously generated output stayed published for weeks: frozen, unread,
// uncensused, and full of unresolvable ids. A retired scope must stay retired.
for (const retired of ['public-data/knowledge/quantitative-labs.json', 'public-data/knowledge/quantitative-labs']) {
  check(`excluded product scope republishes nothing (${retired})`, !existsSync(retired), 'retired artifact is published again');
}

// A rebase conflict resolved by staging the conflicted file (instead of choosing a
// side) commits `<<<<<<<` markers into JSON, which then breaks every reader with a
// JSON parse error far from the cause. This session shipped exactly that: two
// architecture manifests were committed with markers because the conflict list was
// read from truncated output.
{
  const { execFileSync } = await import('node:child_process');
  let marked = '';
  try {
    marked = execFileSync('git', ['grep', '-l', '-E', '^(<<<<<<<|>>>>>>>)', '--', '.'], { encoding: 'utf8' });
  } catch (error) {
    if (error.status !== 1) marked = String(error.stdout || '');
  }
  const files = marked.split(/\r?\n/).filter(Boolean);
  check('no tracked file contains an unresolved merge-conflict marker', files.length === 0, files.join(', '));
}

if (errors.length) {
  console.error('Artifact semantics check failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log('Artifact semantics OK: macro freshness, history vintage timestamps, operational vocabulary, narrative evidence lineage, and score reconciliation.');
