import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildDomainReceipt } from './fetch-sec-fundamentals.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const sourceText = read('public-data/sec-fundamentals.json');
const runtimeText = read('public-data/sec-fundamentals-summary.json');
const source = JSON.parse(sourceText);
const runtime = JSON.parse(runtimeText);
const manifest = JSON.parse(read('public-data/sec-fundamentals-summary.manifest.json'));
const canonicalText = (value) => value.replace(/\r\n?/g, '\n');
const sha256 = (value) => createHash('sha256').update(canonicalText(value)).digest('hex');
const canonicalBytes = (value) => Buffer.byteLength(canonicalText(value));
const fail = (message) => { throw new Error(`[sec-runtime-projection] ${message}`); };

if (sha256('alpha\nbeta\n') !== sha256('alpha\r\nbeta\r\n') || canonicalBytes('alpha\nbeta\n') !== canonicalBytes('alpha\r\nbeta\r\n')) fail('projection digest accounting is checkout-newline dependent');

if (runtime.schemaVersion !== 'sec-fundamentals-runtime-summary.v1' || runtime.artifactRole !== 'BOUNDED_PAGE_PROJECTION') fail('runtime projection identity is invalid');
if (canonicalBytes(runtimeText) > 1024 * 1024) fail(`runtime projection exceeds 1 MiB: ${canonicalBytes(runtimeText)}`);
const sourceSymbols = Object.keys(source.data || {});
const runtimeSymbols = Object.keys(runtime.data || {});
if (sourceSymbols.length !== runtimeSymbols.length || sourceSymbols.some((symbol) => !runtime.data[symbol])) fail('runtime symbol coverage differs from canonical source');
for (const symbol of sourceSymbols) {
  const canonical = source.data[symbol];
  const projected = runtime.data[symbol];
  for (const field of ['symbol', 'cik', 'observedAt', 'filedAt', 'accession', 'revenue', 'netIncome']) {
    if (projected?.[field] !== canonical?.[field]) fail(`${symbol} field drift: ${field}`);
  }
  if (projected?.pit?.observations) fail(`${symbol} leaked append-only PIT observations into the page projection`);
  if ((projected?.pit?.observationCount || 0) !== (canonical?.pit?.observationCount || 0)) fail(`${symbol} PIT coverage count drifted`);
}
if (manifest.sourceSha256 !== sha256(sourceText) || manifest.runtimeSha256 !== sha256(runtimeText)) fail('projection digest manifest drifted');
if (manifest.sourceBytes !== canonicalBytes(sourceText) || manifest.runtimeBytes !== canonicalBytes(runtimeText) || manifest.records !== runtimeSymbols.length) fail('projection byte/count manifest drifted');

// ── P1169 (17 작업 단위 1 / 06 O06): domain receipt ────────────────────────────────────────────
// A SEC batch records per-symbol errors, keeps going and returns normally, so the job's exit code
// is not evidence that the domain was collected. The receipt must separate "this batch updated
// rows" from "previously stored rows stayed published", and it must not treat the file's
// generatedAt as freshness. These fixtures drive the producer's own pure builder.
const batchAt = '2026-09-22T00:00:00.000Z';
const priorReceipt = { lastSuccessfulObservation: '2026-09-19T00:00:00.000Z' };
const row = (symbol, status, attemptedAt = batchAt) => ({ symbol, ...(status ? { status } : {}), attemptedAt });
const rows = (count, status) => Array.from({ length: count }, (unused, index) => row(`${status || 'LEGACY'}-${index}`, status));
const base = { domain: 'sec-fundamentals', attemptedAt: batchAt, priorReceipt, eligible: 655, batchLimit: 24 };

const allFailed = buildDomainReceipt({ ...base, attempted: 24, updated: 0, stored: 562, failures: rows(24, 'TRANSIENT_PROVIDER_FAILURE') });
if (allFailed.publication.status !== 'NO_REFRESH_RETAINED') fail(`a batch whose every attempt failed must not read as collection success: ${allFailed.publication.status}`);
if (allFailed.counts.retained !== 562 || allFailed.counts.retained !== allFailed.counts.eligible - allFailed.counts.pendingEligible - allFailed.counts.updated) fail('a total-failure batch must report the retained rows it kept publishing');
if (allFailed.lastSuccessfulObservation !== priorReceipt.lastSuccessfulObservation) fail('lastSuccessfulObservation advanced without a single updated row');
if (allFailed.thisBatch.transientFailed !== 24 || allFailed.thisBatch.updated !== 0) fail('a total-failure batch must record 24 transient failures and 0 updates');

const partial = buildDomainReceipt({ ...base, attempted: 24, updated: 10, stored: 562, failures: rows(14, 'TRANSIENT_PROVIDER_FAILURE') });
if (partial.publication.status !== 'PARTIAL') fail(`a partially collected batch must not read as either success or total failure: ${partial.publication.status}`);
if (partial.lastSuccessfulObservation !== batchAt) fail('a batch that updated rows must advance lastSuccessfulObservation');
if (partial.counts.updated + partial.counts.retained !== 562) fail('updated + retained must reconcile with stored');

const terminal = buildDomainReceipt({ ...base, attempted: 5, updated: 0, stored: 100, failures: rows(5, 'TERMINAL_UNSUPPORTED') });
if (terminal.thisBatch.terminalUnsupported !== 5 || terminal.thisBatch.transientFailed !== 0) fail('a terminal taxonomy exclusion must not be counted as a transient failure');
if (terminal.publication.status !== 'NO_REFRESH_RETAINED') fail(`an all-terminal batch still collected nothing and must not read as success: ${terminal.publication.status}`);

// status 없는 구형 원장 기록은 이번 batch 실패도 terminal도 아니다.
const legacy = buildDomainReceipt({ ...base, attempted: 0, updated: 0, stored: 562, failures: rows(24, null) });
if (legacy.ledger.legacyUnknown !== 24 || legacy.ledger.transientFailed !== 0 || legacy.ledger.terminalUnsupported !== 0) fail('legacy ledger rows without a status must stay in their own class');
if (legacy.publication.status !== 'NOT_ATTEMPTED') fail(`a batch with nothing due is not a collection result: ${legacy.publication.status}`);

// 발행된 원장 그대로의 성격 구분(문서 17의 terminal 68 / transient 3 / status 없는 구형 24).
const publishedLedger = buildDomainReceipt({
  ...base,
  attempted: source.attempted || 0,
  updated: source.updated || 0,
  stored: source.stored || 0,
  eligible: source.eligible || 0,
  failures: source.failures || []
});
if (publishedLedger.ledger.total !== (source.failures || []).length) fail('receipt ledger total drifted from the published failure ledger');
if (publishedLedger.ledger.terminalUnsupported + publishedLedger.ledger.transientFailed + publishedLedger.ledger.legacyUnknown !== publishedLedger.ledger.total) fail('every published ledger row must fall into exactly one receipt class');

// 배선: 생산자가 receipt를 발행하고 projection이 소비자에게 넘긴다.
// P1256: 계약의 정본 구현은 scripts/lib/domain-receipt.mjs로 이전했다 — 본체 토큰은 정본에서,
// SEC 발행 배선 토큰은 생산자 소스에서 검사한다.
const receiptImplSource = read('scripts/lib/domain-receipt.mjs');
for (const token of ['buildDomainReceipt', 'lastSuccessfulObservation', 'NO_REFRESH_RETAINED', 'legacyUnknown', 'generatedAtIsNotFreshness']) {
  if (!receiptImplSource.includes(token)) fail(`the canonical domain-receipt builder must keep its contract (${token} missing)`);
}
const producerSource = read('scripts/fetch-sec-fundamentals.mjs');
for (const token of ['buildDomainReceipt', 'domainReceipt:']) {
  if (!producerSource.includes(token)) fail(`the SEC producer must publish the domain receipt (${token} missing)`);
}
if (!read('scripts/build-sec-runtime-projection.mjs').includes('domainReceipt')) fail('the runtime projection must forward the domain receipt instead of dropping it with the failure ledger');

if (source.domainReceipt) {
  const receipt = source.domainReceipt;
  if (receipt.schemaVersion !== 'domain-receipt.v1' || receipt.domain !== 'sec-fundamentals') fail('the published receipt identity is invalid');
  if (receipt.counts.updated !== source.updated || receipt.counts.attempted !== source.attempted) fail('the published receipt does not reconcile with the artifact counters');
  if (receipt.counts.retained !== Math.max(0, (source.stored || 0) - (source.updated || 0))) fail('the published receipt retained count does not reconcile with stored - updated');
  if (receipt.counts.updated === 0 && receipt.publication.status === 'SUCCESS') fail('the published receipt claims success for a batch that updated nothing');
} else {
  console.log('[sec-runtime-projection] domain receipt not yet published in the checked-in artifact; it is written by the next SEC producer run.');
}

console.log(JSON.stringify({ ok: true, records: runtimeSymbols.length, sourceBytes: manifest.sourceBytes, runtimeBytes: manifest.runtimeBytes, reductionPct: Math.round((1 - manifest.runtimeBytes / manifest.sourceBytes) * 1000) / 10, receiptFixtures: 5 }));
