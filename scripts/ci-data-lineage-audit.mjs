// Reproducible data lineage/freshness audit for every tracked public-data artifact.
//
// This is intentionally policy-aware: a daily research history, an editorial
// operator note, and a live quote artifact do not share the same freshness SLA.
// A timestamp is never inferred from another timestamp (for example, fetchedAt
// is not promoted to releaseAt).  The report is evidence for local CI only; it
// does not certify provider rights, factual correctness, or human/legal approval.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)));
const DATA_DIR = join(ROOT, 'public-data');
const NOW = process.env.AIO_LINEAGE_AS_OF ? new Date(process.env.AIO_LINEAGE_AS_OF) : new Date();
const FUTURE_TOLERANCE_MINUTES = 15;

function readJsonIfPresent(file) {
  try { return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')); } catch { return null; }
}

const MARKET_SNAPSHOT_CONTEXT = readJsonIfPresent('market-snapshot.json');

function marketClosedGraceEligible(name) {
  if (name !== 'data.json' && name !== 'market-snapshot.json') return false;
  const day = NOW.getUTCDay();
  if (day !== 0 && day !== 6) return false;
  const snapshot = MARKET_SNAPSHOT_CONTEXT;
  const coverage = snapshot?.coverage;
  const quality = snapshot?.quality;
  if (!coverage || coverage.tier0Observed !== coverage.tier0Required || quality?.gate !== 'QG-01_PASS') return false;
  if (Array.isArray(snapshot.errors) && snapshot.errors.length) return false;
  return true;
}

const fail = (message, detail = '') => ({ status: 'FAIL', message, detail });
const warn = (message, detail = '') => ({ status: 'WARN', message, detail });
const info = (message, detail = '') => ({ status: 'INFO', message, detail });

function getPath(value, path) {
  return path.split('.').reduce((current, key) => current == null ? undefined : current[key], value);
}

function firstPresent(value, paths) {
  for (const path of paths) {
    const candidate = getPath(value, path);
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      return { path, value: candidate };
    }
  }
  return { path: null, value: null };
}

function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursSince(date) {
  return (NOW.getTime() - date.getTime()) / 3600000;
}

function ageDetail(date) {
  const age = hoursSince(date);
  return {
    ageHours: Number(age.toFixed(2)),
    ageDays: Number((age / 24).toFixed(2)),
    future: age < -(FUTURE_TOLERANCE_MINUTES / 60)
  };
}

function gitRevision(file) {
  try {
    const output = execFileSync('git', ['log', '-1', '--format=%H%x09%cI', '--', relative(ROOT, file)], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    const [sha, committedAt] = output.split('\t');
    return { sha: sha || null, committedAt: committedAt || null };
  } catch {
    return { sha: null, committedAt: null };
  }
}

function sourceOf(data) {
  return firstPresent(data, [
    'meta.source', 'meta.sourceKind', 'source', 'sourceKind', 'metadata.source',
    'lineage.source', 'provenance.source'
  ]).value ?? null;
}

function failuresOf(data) {
  const result = firstPresent(data, ['meta.failures', 'failures', 'metadata.failures']);
  return Array.isArray(result.value) ? result.value : [];
}

const POLICIES = {
  'backtest-history.json': { kind: 'research-history', timestamp: ['12.asOf', 'generatedAt'], maxAgeHours: 24 * 14 },
  'data.json': { kind: 'live-core', timestamp: ['meta.generatedAt'], maxAgeHours: 12 },
  'factor-backtest-longrun.json': { kind: 'research-horizon', timestamp: ['generatedAt', 'meta.generatedAt'] },
  'history.json': { kind: 'daily-history', custom: 'history-date', maxAgeHours: 24 * 3 },
  'market-snapshot.json': { kind: 'live-core', timestamp: ['generatedAt', 'lastSuccessfulAt', 'attemptedAt'], maxAgeHours: 24 },
  'market-snapshot-status.json': { kind: 'operational-status', timestamp: ['updatedAt', 'lastSuccessfulAt', 'attemptedAt'], maxAgeHours: 24 },
  'operator-note.json': { kind: 'editorial-reference', custom: 'operator-updated', maxAgeHours: 24 * 30 },
  'operations-status.json': { kind: 'operational-status', timestamp: ['generatedAt'], maxAgeHours: 24 },
  'reconciliation-status.json': { kind: 'operational-status', timestamp: ['generatedAt'], maxAgeHours: 24 },
  'score-backtest-history.json': { kind: 'research-history', timestamp: ['generatedAt', 'meta.generatedAt'], maxAgeHours: 24 * 14 },
  'score-backtest-longrun.json': { kind: 'research-horizon', timestamp: ['generatedAt', 'meta.generatedAt'] },
  'screener-universe.json': { kind: 'universe-reference', custom: 'universe-bulk-update' },
  'screener.json': { kind: 'research-screener', timestamp: ['asOf', 'meta.asOf'], maxAgeHours: 48 },
  'screener-validation-gate.json': { kind: 'research-validation-gate', timestamp: ['observedAt', 'generatedAt'], maxAgeHours: 24 * 90 },
  'sec-fundamentals.json': { kind: 'incremental-official-reference', timestamp: ['generatedAt', 'meta.generatedAt'], maxAgeHours: 48 },
  'telegram-digest.json': { kind: 'reference-digest', timestamp: ['generatedAt', 'lastSuccessfulAt', 'meta.generatedAt'], maxAgeHours: 12 },
  'telegram-reference-window.json': { kind: 'research-reference', timestamp: ['reviewedAt', 'generatedAt', 'meta.generatedAt'], maxAgeHours: 24 * 90 },
  'user-research-digest.json': { kind: 'research-reference', timestamp: ['generatedAt', 'meta.generatedAt'], maxAgeHours: 24 * 90 },
  'model-validation-status.json': { kind: 'research-horizon', timestamp: ['observedAt', 'generatedAt'], maxAgeHours: 24 * 90 },
  'operations-slo-window.json': { kind: 'operational-status', timestamp: ['observedAt', 'generatedAt'], maxAgeHours: 24 }
};

function extractTimestamp(data, policy) {
  if (policy.custom === 'history-date') {
    const rows = Array.isArray(data) ? data : Array.isArray(data.history) ? data.history : [];
    const dated = rows.map(row => row?.date).filter(Boolean).sort();
    return dated.length ? { path: 'last row.date', value: dated.at(-1) } : { path: null, value: null };
  }
  if (policy.custom === 'operator-updated') return { path: 'updated', value: data.updated };
  if (policy.custom === 'universe-bulk-update') return { path: 'meta.lastBulkUpdate', value: data.meta?.lastBulkUpdate };
  return firstPresent(data, policy.timestamp ?? []);
}

function evaluateArtifact(name, data) {
  const policy = POLICIES[name];
  if (!policy) return { artifact: name, policy: 'unregistered', status: 'FAIL', checks: [fail('tracked artifact has no lineage policy')] };

  const timestamp = extractTimestamp(data, policy);
  const date = parseDate(timestamp.value);
  const results = [];
  const age = date ? ageDetail(date) : null;
  const source = sourceOf(data);
  const failures = failuresOf(data);

  if (!timestamp.value) results.push(fail('required lineage timestamp is missing', policy.custom ?? policy.timestamp?.join(', ')));
  else if (!date) results.push(fail('lineage timestamp is not parseable', `${timestamp.path}=${timestamp.value}`));
  else if (age.future) results.push(fail('lineage timestamp is unexpectedly in the future', `${timestamp.path}=${timestamp.value}`));
  else if (policy.maxAgeHours != null && age.ageHours > policy.maxAgeHours && marketClosedGraceEligible(name)) {
    results.push(info('artifact freshness evaluated under market-closed grace', `${age.ageHours}h old; Tier-0 snapshot coverage is complete`));
  } else if (policy.maxAgeHours != null && age.ageHours > policy.maxAgeHours) {
    const severity = policy.kind === 'live-core' ? 'FAIL' : 'WARN';
    results.push(severity === 'FAIL'
      ? fail('artifact exceeded freshness SLA', `${age.ageHours}h > ${policy.maxAgeHours}h`)
      : warn('artifact is older than its reference freshness window', `${age.ageHours}h > ${policy.maxAgeHours}h`));
  } else if (date) results.push(info('timestamp is within policy window', `${age.ageHours}h old`));

  if (failures.length) results.push(policy.kind === 'live-core'
    ? fail('producer reported failures', JSON.stringify(failures))
    : warn('producer reported failures', JSON.stringify(failures)));

  if (policy.custom === 'universe-bulk-update') {
    const staleAfterDays = Number(data.meta?.staleAfterDays ?? 7);
    if (date && age.ageDays > staleAfterDays) {
      results.push(warn('universe reference exceeded its declared staleAfterDays', `${age.ageDays}d > ${staleAfterDays}d`));
    } else if (date) {
      results.push(info('universe reference is inside its declared staleAfterDays', `${age.ageDays}d <= ${staleAfterDays}d`));
    }
  }

  if (name === 'sec-fundamentals.json') {
    const stored = Number(data.meta?.stored ?? data.stored ?? 0);
    const eligible = Number(data.meta?.eligible ?? data.eligible ?? 0);
    const coverage = eligible > 0 ? stored / eligible : null;
    if (coverage !== null && coverage < 0.8) {
      results.push(warn('SEC coverage remains below the 80% decision-use gate', `${stored}/${eligible} (${(coverage * 100).toFixed(1)}%)`));
    } else if (coverage !== null) {
      results.push(info('SEC coverage meets the 80% decision-use gate', `${stored}/${eligible}`));
    }
  }

  const status = results.some(result => result.status === 'FAIL') ? 'FAIL'
    : results.some(result => result.status === 'WARN') ? 'WARN' : 'PASS';
  const revision = gitRevision(join(DATA_DIR, name));
  return {
    artifact: name,
    policy: policy.kind,
    status,
    timestampField: timestamp.path,
    timestamp: date?.toISOString() ?? timestamp.value ?? null,
    ...(age ?? {}),
    source,
    producerFailures: failures.length,
    lastCommit: revision,
    checks: results
  };
}

function runContractSelfTests() {
  const fixture = { meta: { generatedAt: '2026-07-15T00:00:00Z', releaseAt: '2026-07-01T00:00:00Z' } };
  const selected = extractTimestamp(fixture, POLICIES['data.json']);
  if (selected.path !== 'meta.generatedAt') throw new Error('self-test: generatedAt selector drifted');
  const releaseOnly = extractTimestamp({ meta: { releaseAt: '2026-07-01T00:00:00Z' } }, POLICIES['data.json']);
  if (releaseOnly.value !== null) throw new Error('self-test: releaseAt was promoted to generatedAt');
  const history = extractTimestamp([{ date: '2026-07-14' }, { date: '2026-07-15' }], POLICIES['history.json']);
  if (history.value !== '2026-07-15') throw new Error('self-test: history last date selector drifted');
}

runContractSelfTests();

if (!existsSync(DATA_DIR)) {
  console.error(`Data lineage audit failed: missing ${DATA_DIR}`);
  process.exit(1);
}

const files = readdirSync(DATA_DIR).filter(file => file.endsWith('.json')).sort();
const artifacts = files.map(file => {
  try {
    return evaluateArtifact(file, JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')));
  } catch (error) {
    return { artifact: file, policy: POLICIES[file]?.kind ?? 'unregistered', status: 'FAIL', checks: [fail('JSON artifact could not be read or parsed', error.message)] };
  }
});

const failures = artifacts.filter(artifact => artifact.status === 'FAIL');
const warnings = artifacts.filter(artifact => artifact.status === 'WARN');
const report = {
  schemaVersion: 'data-lineage-audit-v1',
  asOf: NOW.toISOString(),
  trackedArtifacts: artifacts.length,
  pass: artifacts.filter(artifact => artifact.status === 'PASS').length,
  warnings: warnings.length,
  failures: failures.length,
  contractSelfTests: 'PASS',
  artifacts
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Data lineage audit: ${report.trackedArtifacts} artifacts | PASS=${report.pass} WARN=${report.warnings} FAIL=${report.failures}`);
  for (const artifact of artifacts) {
    const age = artifact.ageHours == null ? 'n/a' : `${artifact.ageHours}h`;
    const commit = artifact.lastCommit?.sha ? artifact.lastCommit.sha.slice(0, 8) : 'no-git-revision';
    console.log(`${artifact.status.padEnd(4)} ${artifact.artifact.padEnd(32)} policy=${artifact.policy.padEnd(30)} timestamp=${artifact.timestamp ?? 'MISSING'} age=${age} commit=${commit}`);
    for (const check of artifact.checks ?? []) {
      if (check.status !== 'INFO') console.log(`     ${check.status}: ${check.message}${check.detail ? ` (${check.detail})` : ''}`);
    }
  }
  console.log(`As of ${report.asOf}. This audit does not certify provider rights, factual truth, or human/legal approval.`);
}

if (failures.length) process.exit(1);
