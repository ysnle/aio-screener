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

const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path).replace(/^\uFEFF/, ''));
const readIf = (path) => (existsSync(path) ? json(path) : null);

const errors = [];
const check = (label, ok, detail = '') => { if (!ok) errors.push(detail ? `${label}: ${detail}` : label); };

const fetchData = read('scripts/fetch-data.mjs');
const history = readIf('public-data/history.json');
const data = readIf('public-data/data.json');
const snapshot = readIf('public-data/market-snapshot.json');
const operations = readIf('public-data/operations-status.json');

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
  if (!publishedObserved) {
    console.log('[artifact-semantics] transition: macro freshness markers predate P1090; artifact assertions apply after the next refresh.');
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
  if (!anyRelation) {
    console.log('[artifact-semantics] transition: history rows predate P1095; vintage assertions apply after the next refresh.');
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
  const undeclared = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'status' && typeof value === 'string' && !statuses.has(value)) undeclared.push(`${path}.status=${value}`);
      if (key === 'statusCode' && typeof value === 'string' && !statusCodes.has(value)) undeclared.push(`${path}.statusCode=${value}`);
      walk(value, `${path}.${key}`);
    }
  };
  walk({ overall: operations.overall, planes: operations.planes, ai: operations.ai }, 'operations');
  check('every published status value is declared by the same artifact', undeclared.length === 0, undeclared.join(', '));
  check('frozen freshness judgement names its evaluation instant',
    typeof operations.planes?.durable?.freshness?.evaluatedAt === 'string' && !Number.isNaN(Date.parse(operations.planes.durable.freshness.evaluatedAt)));
  check('frozen freshness judgement is point-in-time, not a live claim',
    typeof operations.planes?.durable?.freshness?.generatedAt === 'string'
    && Date.parse(operations.planes.durable.freshness.evaluatedAt) >= Date.parse(operations.planes.durable.freshness.generatedAt));
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
  }
  check('published total equals its declared terms for every golden fixture', broken.length === 0, broken.slice(0, 4).join(' | '));
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
