#!/usr/bin/env node

// Source -> producer -> artifact -> consumer continuity gate.
//
// This is deliberately a local, network-free check.  It validates the
// executable producers and the evidence shape already present in the
// workspace; it does not turn a static artifact into live-source evidence.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_REGISTRY_CATEGORY_IDS, DATA_SOURCE_REGISTRY } from '../src/data/contracts/source-registry.js';
import { derivePublicAiConfig } from './build-operations-status.mjs';
import { deriveFredCycle } from './lib/refresh-continuity.mjs';
import { atomicWriteFile, atomicWriteFileSync } from './lib/atomic-write.mjs';
import { parseFredHyOasCsv, parseTreasuryYieldCurveHtml } from './fetch-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const failures = [];
const warnings = [];
const checks = [];

function check(id, ok, detail) {
  checks.push({ id, ok: Boolean(ok), detail });
  if (!ok) failures.push(`${id}: ${detail}`);
}

function warn(id, detail) {
  warnings.push(`${id}: ${detail}`);
}

function readText(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  try { return fs.readFileSync(absolute, 'utf8'); }
  catch (error) { check(`file:${relativePath}`, false, error.message); return ''; }
}

function readJson(relativePath) {
  const text = readText(relativePath);
  if (!text) return null;
  try { return JSON.parse(text); }
  catch (error) { check(`json:${relativePath}`, false, error.message); return null; }
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function collectEvidence(value, out = { observed: [], collected: [], successful: [] }, key = '') {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const item of value) collectEvidence(item, out, key);
    return out;
  }
  for (const [name, child] of Object.entries(value)) {
    if (typeof child === 'string' && validDate(child)) {
      if (/observ|asof|period|date/i.test(name)) out.observed.push(child);
      if (/fetch|attempt|generated|checked|updated|collection/i.test(name)) out.collected.push(child);
      if (/success|published/i.test(name)) out.successful.push(child);
    } else if (child && typeof child === 'object') {
      collectEvidence(child, out, name);
    }
  }
  return out;
}

function artifactEvidence(relativePath) {
  // Some registry consumers are source-text artifacts (for example the
  // browser data module), not JSON payloads.  Presence is still continuity
  // evidence, but attempting JSON.parse on them would manufacture a gate
  // failure unrelated to the source pipeline.
  if (!relativePath.toLowerCase().endsWith('.json')) {
    const text = readText(relativePath);
    return text ? { status: 'SOURCE_TEXT_PRESENT', observed: [], collected: [], successful: [] }
      : { status: 'MISSING', observed: [], collected: [], successful: [] };
  }
  const value = readJson(relativePath);
  if (value == null) return { status: 'MISSING', observed: [], collected: [], successful: [] };
  const evidence = collectEvidence(value);
  return {
    status: value?.status || value?.meta?.status || value?.collectionStatus || 'PRESENT',
    observed: [...new Set(evidence.observed)].sort(),
    collected: [...new Set(evidence.collected)].sort(),
    successful: [...new Set(evidence.successful)].sort()
  };
}

function runFocusedRegression() {
  // Negative control for the failed/partial-success timestamp class.
  const classify = ({ configured, successful, expected, prior }) => deriveFredCycle({
    configured, expected: Array.from({ length: expected }, (_, index) => String(index)),
    current: Object.fromEntries(Array.from({ length: successful }, (_, index) => [String(index), 1])),
    previousMeta: { fredLastSuccessfulAt: prior }, attemptedAt: '2026-08-30T00:00:00.000Z'
  });
  const partial = classify({ configured: true, successful: 1, expected: 2, prior: '2026-08-29T00:00:00.000Z' });
  check('regression:partial-fred-does-not-refresh-success', partial.status === 'partial' && partial.lastSuccessfulAt === '2026-08-29T00:00:00.000Z', JSON.stringify(partial));
  const unavailable = classify({ configured: true, successful: 0, expected: 2, prior: null });
  check('regression:unavailable-fred-is-explicit', unavailable.status === 'unavailable' && unavailable.lastSuccessfulAt === null, JSON.stringify(unavailable));
  for (const missing of [null, '', undefined, false, NaN]) {
    const result = deriveFredCycle({ configured: true, expected: ['rate'], current: { rate: missing }, previous: { rate: 0 }, previousMeta: { fredLastSuccessfulAt: '2026-08-29T00:00:00Z' } });
    check(`regression:fred-missing-${String(missing)}`, !result.complete && result.lkgUsed && result.lastSuccessfulAt === '2026-08-29T00:00:00Z', 'missing never becomes zero or renews success');
  }

  // Negative control for AI-health coupling: a configured market relay remains
  // reference-configured while AI entitlement is disabled.
  const config = derivePublicAiConfig({}, {
    workerEndpoint: 'https://relay.example.test',
    proxyHealthy: false,
    proxyEvidence: { proxyObservationStatus: 'FAILED', proxyEvidenceFresh: false },
    now: '2026-08-30T00:00:00.000Z'
  });
  check('regression:market-data-independent-of-ai-health', config.marketData?.workerUrl === 'https://relay.example.test'
    && config.marketData?.routeStatus === 'CONFIGURED'
    && config.marketData?.availability === 'verify-per-request'
    && config.ai?.workerUrl === null
    && config.ai?.routeStatus === 'DISABLED', JSON.stringify({ marketData: config.marketData, ai: config.ai }));
  const invalid = derivePublicAiConfig({}, { workerEndpoint: 'http://relay.example.test', proxyHealthy: true });
  check('regression:invalid-relay-is-unavailable', invalid.marketData?.workerUrl === null && invalid.marketData?.routeStatus === 'UNAVAILABLE', JSON.stringify(invalid.marketData));

  // Missing provider fields must survive serialization as unknown, not a
  // fabricated zero used by liquidity and range calculations.
  const unknownVolume = JSON.parse(JSON.stringify({ volume: null }));
  check('regression:unknown-volume-is-not-zero', unknownVolume.volume === null, JSON.stringify(unknownVolume));
}

function runProducerChecks() {
  const fetchData = readText('scripts/fetch-data.mjs');
  const snapshot = readText('scripts/build-market-snapshot.mjs');
  const operations = readText('scripts/build-operations-status.mjs');
  const workflow = readText('.github/workflows/refresh-data.yml');

  check('producer:fetch-data-uses-atomic-writes', fetchData.includes("import { atomicWriteFile } from './lib/atomic-write.mjs';")
    && fetchData.includes('atomicWriteFile(OUT')
    && fetchData.includes('atomicWriteFile(HIST'), 'fetch-data output writers are not all atomic');
  check('producer:fetch-data-no-direct-output-write', !/\bwriteFile\s*\(/.test(fetchData), 'direct writeFile call remains in fetch-data');
  check('producer:market-snapshot-uses-atomic-writes', snapshot.includes("import { atomicWriteFile } from './lib/atomic-write.mjs';")
    && snapshot.includes('atomicWriteFile(MARKET_SNAPSHOT_STATUS_OUT')
    && snapshot.includes('atomicWriteFile(MARKET_SNAPSHOT_OUT'), 'market snapshot can be torn during replacement');
  check('producer:market-snapshot-no-direct-output-write', !/\bwriteFile\s*\(/.test(snapshot), 'direct writeFile call remains in market snapshot builder');
  check('producer:source-failure-isolated', fetchData.includes('Promise.allSettled') && fetchData.includes('settledValue'), 'source planes still share a fail-fast Promise.all');
  check('producer:fred-requires-complete-series', fetchData.includes('deriveFredCycle({')
    && fetchData.includes('fredExpectedSeries.length')
    && fetchData.includes('fredLastSuccessfulAt'), 'FRED aggregate success does not require complete finite series evidence');
  check('producer:fred-yoy-no-period-substitution', !/monthsBetween\([^\n]+\)\s*>=\s*12\)\s*\|\|\s*obs\[obs\.length\s*-\s*1\]/.test(fetchData), 'YoY still substitutes an arbitrary oldest observation');
  check('producer:unknown-ohlcv-preserved', /volume:\s*typeof v === 'number'[^\n]+:\s*null/.test(fetchData)
    && fetchData.includes('volumes:   (rows || []).map(r => (typeof r.volume === \'number\''), 'missing OHLCV fields are coerced to zero/close');
  const gatePosition = fetchData.indexOf('CORE_QUOTE_COVERAGE_FAILED');
  const firstOutWrite = fetchData.indexOf('atomicWriteFile(OUT');
  check('producer:quote-gate-before-public-write', gatePosition >= 0 && firstOutWrite > gatePosition, `gate=${gatePosition}, firstOutWrite=${firstOutWrite}`);
  check('workflow:continuity-gate-wired', workflow.includes('node scripts/ci-data-continuity-check.mjs'), 'refresh workflow does not invoke continuity gate');
  check('operations:market-data-contract-present', operations.includes('marketData:')
    && operations.includes("routeStatus: endpointUsable ? 'CONFIGURED' : 'UNAVAILABLE'")
    && operations.includes("availability: 'verify-per-request'"), 'public-config producer lacks independent marketData contract');
}

function runRegistryChecks() {
  check('registry:22-categories', SOURCE_REGISTRY_CATEGORY_IDS.length === 22, `found ${SOURCE_REGISTRY_CATEGORY_IDS.length}`);
  for (const categoryId of SOURCE_REGISTRY_CATEGORY_IDS) {
    const contract = DATA_SOURCE_REGISTRY[categoryId];
    check(`registry:${categoryId}`, Boolean(contract?.producer)
      && Array.isArray(contract.artifacts) && contract.artifacts.length > 0
      && Array.isArray(contract.consumers) && contract.consumers.length > 0
      && Array.isArray(contract.origins) && contract.origins.length > 0,
    'producer/artifact/consumer/origin contract is incomplete');
  }
}

function runArtifactChecks() {
  const data = readJson('public-data/data.json');
  const snapshot = readJson('public-data/market-snapshot.json');
  const config = readJson('public-config.json');
  check('artifact:data-json-generated-at', validDate(data?.meta?.generatedAt), String(data?.meta?.generatedAt || 'missing'));
  check('artifact:fred-status-not-hidden', data?.meta?.fredFetchOk !== true || (data?.meta?.fredFailedSeries || []).length === 0,
    `fredFetchOk=${data?.meta?.fredFetchOk}, failed=${JSON.stringify(data?.meta?.fredFailedSeries || [])}`);
  check('artifact:failed-snapshot-not-published', snapshot?.status !== 'failed' || snapshot?.generatedAt == null,
    `status=${snapshot?.status}, generatedAt=${snapshot?.generatedAt}`);
  check('artifact:public-config-market-data', config?.marketData && Object.prototype.hasOwnProperty.call(config.marketData, 'workerUrl'), 'marketData producer output is absent; regenerate public-config.json');

  // Emit a compact machine-readable 22-category inventory so a blocked live
  // source is resumable without guessing which artifact was checked.
  const inventory = SOURCE_REGISTRY_CATEGORY_IDS.map((categoryId) => {
    const contract = DATA_SOURCE_REGISTRY[categoryId];
    const evidence = contract.artifacts.map(artifactEvidence);
    const present = evidence.find((row) => row.status !== 'MISSING');
    return {
      categoryId,
      producer: contract.producer,
      artifacts: contract.artifacts,
      consumers: contract.consumers,
      sourceKinds: [...new Set(contract.origins.map((origin) => origin.sourceKind).filter(Boolean))],
      status: present?.status || 'BLOCKED',
      // Shared artifacts include other categories, future calendar events and
      // prose dates. Presence is NOT category-level freshness certification.
      categoryFreshness: 'NOT_EVALUATED_BY_PRESENCE_GATE',
      artifactTimestampCandidates: {
        observationLike: [...new Set(evidence.flatMap((row) => row.observed))].sort().slice(-3),
        collectionLike: [...new Set(evidence.flatMap((row) => row.collected))].sort().slice(-3),
        successLike: [...new Set(evidence.flatMap((row) => row.successful))].sort().slice(-3)
      },
      structuralLimit: contract.structuralLimit?.kind || null
    };
  });
  return inventory;
}

// Execute actual public parsers and URL-backed atomic writers, not replicas.
check('regression:hy-empty-csv-not-zero', parseFredHyOasCsv('DATE,BAMLH0A0HYM2\n2026-08-28,') === null, 'blank HY observation must not be 0%');
check('regression:hy-zero-csv-preserved', parseFredHyOasCsv('DATE,BAMLH0A0HYM2\n2026-08-28,0')?.value === 0, 'numeric zero is an observation');
check('regression:treasury-empty-cells-not-zero', parseTreasuryYieldCurveHtml('<tr><time datetime="2026-08-28T00:00:00Z"></time></tr>') === null, 'missing maturities must not generate a zero yield curve');
const tempParent = path.join(ROOT, '.cache');
fs.mkdirSync(tempParent, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(tempParent, 'continuity-test-'));
const tempFile = path.join(tempDir, 'record.json');
try {
  const { pathToFileURL } = await import('node:url');
  await atomicWriteFile(pathToFileURL(tempFile), '{"revision":1}');
  atomicWriteFileSync(pathToFileURL(tempFile), '{"revision":2}');
  check('regression:atomic-url-and-replacement', JSON.parse(fs.readFileSync(tempFile, 'utf8')).revision === 2 && fs.readdirSync(tempDir).length === 1, 'atomic URL write/read/replace and temporary cleanup');
} finally {
  fs.rmSync(tempFile, { force: true });
  fs.rmdirSync(tempDir);
}
runFocusedRegression();
runProducerChecks();
runRegistryChecks();
const inventory = runArtifactChecks();

const result = {
  schemaVersion: 'data-continuity-check.v1',
  checkedAt: new Date().toISOString(),
  ok: failures.length === 0,
  checks,
  warnings,
  inventory
};

if (args.has('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`[data-continuity] ${result.ok ? 'PASS' : 'FAIL'} checks=${checks.length} failures=${failures.length} warnings=${warnings.length}`);
  if (failures.length) for (const failure of failures) console.error(`- ${failure}`);
  console.log(`[data-continuity] ${inventory.length} category artifact paths present; category freshness requires the dedicated reconciliation gate.`);
}

if (!result.ok) process.exitCode = 1;
