export const AI_BENCHMARK_CONTRACT_VERSION = 'ai-benchmark.v1';

function finite(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

export function createBenchmarkManifest({ snapshotRevision = null, modelVersion = null, promptVersion = null, retrieverVersion = null, validatorVersion = null, costLimitUsd = null } = {}) {
  return Object.freeze({
    schemaVersion: AI_BENCHMARK_CONTRACT_VERSION,
    snapshotRevision,
    modelVersion,
    promptVersion,
    retrieverVersion,
    validatorVersion,
    costLimitUsd: finite(costLimitUsd),
    reproducible: Boolean(snapshotRevision && modelVersion && promptVersion && retrieverVersion && validatorVersion),
    status: snapshotRevision && modelVersion ? 'configured' : 'operator-required'
  });
}

export function evaluateRoutingCorpus({ cases = [], planner } = {}) {
  const rows = (Array.isArray(cases) ? cases : []).map((testCase) => {
    const plan = typeof planner === 'function' ? planner(testCase.query) : null;
    const actual = plan?.intent?.primary || null;
    return Object.freeze({ id: testCase.id || testCase.query, expected: testCase.expectedIntent || null, actual, pass: actual === testCase.expectedIntent });
  });
  const passed = rows.filter((row) => row.pass).length;
  const total = rows.length;
  return Object.freeze({ schemaVersion: AI_BENCHMARK_CONTRACT_VERSION, status: total ? 'measured' : 'empty', passed, total, accuracy: total ? passed / total : null, rows: Object.freeze(rows) });
}

export function assertBenchmarkReady(manifest = {}) {
  const missing = ['snapshotRevision', 'modelVersion', 'promptVersion', 'retrieverVersion', 'validatorVersion'].filter((key) => !manifest[key]);
  return Object.freeze({ ok: missing.length === 0, missing, status: missing.length ? 'operator-required' : 'ready' });
}
