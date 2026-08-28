import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA_PATH = resolve(ROOT, 'public-data/data.json');
const EVIDENCE_PATH = resolve(ROOT, 'public-data/structural-data-research.json');
const MAX_AGE_DAYS = 180;
const REQUIRED_IDS = [
  'aaii',
  'naaim',
  'investors-intelligence',
  'historical-universe-and-corporate-actions',
  'independent-quote-reconciliation',
  'official-exchange-breadth',
  'earnings-revisions-and-guidance',
  'short-interest-and-options-flow',
  'kr-macro-vkospi-supply',
  'kr-export-reference'
];

function fail(message) {
  throw new Error(message);
}

function parseDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) fail(`${label} is missing or invalid: ${value}`);
  return date;
}

function assertOfficialUrl(value, label) {
  if (!/^https:\/\//.test(String(value || ''))) fail(`${label} must be an HTTPS official source URL`);
}

const [data, evidence] = await Promise.all([
  readFile(DATA_PATH, 'utf8').then(JSON.parse),
  readFile(EVIDENCE_PATH, 'utf8').then(JSON.parse)
]);

if (evidence.schemaVersion !== 'structural-data-research.v1') fail(`unexpected evidence schema: ${evidence.schemaVersion}`);
if (evidence.source !== 'official-web-research') fail(`unexpected evidence source: ${evidence.source}`);
const checkedAt = parseDate(evidence.checkedAt, 'evidence.checkedAt');
const ageDays = (Date.now() - checkedAt.getTime()) / 86400000;
if (ageDays < -1) fail(`evidence.checkedAt is in the future: ${evidence.checkedAt}`);
if (ageDays > MAX_AGE_DAYS) fail(`official WebSearch evidence is stale: ${ageDays.toFixed(1)}d > ${MAX_AGE_DAYS}d`);

const entries = Array.isArray(evidence.entries) ? evidence.entries : [];
const ids = entries.map(row => row && row.id).filter(Boolean);
if (ids.length !== REQUIRED_IDS.length || REQUIRED_IDS.some(id => !ids.includes(id))) {
  fail(`evidence entry coverage drifted: expected ${REQUIRED_IDS.length} ids, got ${ids.join(',')}`);
}
for (const row of entries) {
  if (!['CURRENT_REFERENCE', 'STALE_REFERENCE', 'PARTIAL_SOURCE_FOUND', 'BLOCKED'].includes(row.status)) {
    fail(`unsupported evidence status for ${row.id}: ${row.status}`);
  }
  const urls = row.sourceUrls || (row.sourceUrl ? [row.sourceUrl] : []);
  if (!urls.length) fail(`missing official source URL for ${row.id}`);
  urls.forEach((url, index) => assertOfficialUrl(url, `${row.id}.sourceUrls[${index}]`));
  if (!row.detail) fail(`missing operator-readable detail for ${row.id}`);
  if (row.status === 'BLOCKED' && row.valueArtifact) fail(`blocked evidence cannot expose a value artifact: ${row.id}`);
}

const surveys = data.marketSurveys || {};
if (data.meta?.marketSurveysCheckedAt !== evidence.checkedAt) {
  fail(`data.meta.marketSurveysCheckedAt does not match evidence.checkedAt: ${data.meta?.marketSurveysCheckedAt}`);
}
if (data.meta?.marketSurveysStatus !== 'web-research-captured-reference') {
  fail(`unexpected market survey policy status: ${data.meta?.marketSurveysStatus}`);
}
const aaii = surveys.aaii;
if (!aaii || aaii.status !== 'current-reference') fail('AAII current reference is missing');
for (const field of ['bullish', 'neutral', 'bearish', 'spread']) {
  if (!Number.isFinite(Number(aaii[field]))) fail(`AAII ${field} is not numeric`);
}
if (Math.abs((Number(aaii.bullish) + Number(aaii.neutral) + Number(aaii.bearish)) - 100) > 0.2) {
  fail('AAII percentages do not sum to 100 within tolerance');
}
parseDate(aaii.observedAt, 'AAII observedAt');
assertOfficialUrl(aaii.sourceUrl, 'AAII sourceUrl');
if (aaii.allowedUse !== 'reference-only') fail('AAII must remain reference-only');
const aaiiAgeDays = (Date.now() - parseDate(aaii.observedAt, 'AAII observedAt').getTime()) / 86400000;
if (aaiiAgeDays > 9) fail(`AAII automated reference is stale: ${aaiiAgeDays.toFixed(1)}d > 9d`);
if (!aaii.fetchedAt || Date.now() - parseDate(aaii.fetchedAt, 'AAII fetchedAt').getTime() > 12 * 60 * 60 * 1000) {
  fail(`AAII automated collection has not succeeded within 12h: ${aaii.fetchedAt || 'missing'}`);
}
if (aaii.relayUrl && aaii.sourceKind !== 'publisher-public-web-via-reader-relay') fail('AAII relay lineage is not explicit');

const naaim = surveys.naaim;
if (!naaim || naaim.status !== 'stale-reference' || !Number.isFinite(Number(naaim.exposure))) {
  fail('NAAIM last public reference is missing or incorrectly promoted');
}
parseDate(naaim.observedAt, 'NAAIM observedAt');
assertOfficialUrl(naaim.sourceUrl, 'NAAIM sourceUrl');
if (naaim.allowedUse !== 'reference-only') fail('NAAIM must remain reference-only');

if (surveys.investorsIntelligence?.status !== 'blocked-no-public-numeric') {
  fail('Investors Intelligence must remain blocked without a public numeric reading');
}

const krExports = data.officialWebReferences?.krExports;
if (!krExports || !['latest-public-found', 'stale-reference'].includes(krExports.status) || krExports.allowedUse !== 'reference-only') {
  fail('Korea customs reference is missing or incorrectly promoted');
}
for (const field of ['exportsBillionUsd', 'importsBillionUsd', 'tradeBalanceBillionUsd', 'exportsYoyPct', 'importsYoyPct']) {
  if (!Number.isFinite(Number(krExports[field]))) fail(`Korea customs ${field} is not numeric`);
}
parseDate(krExports.observedAt, 'Korea customs observedAt');
assertOfficialUrl(krExports.sourceUrl, 'Korea customs sourceUrl');

console.log(JSON.stringify({
  ok: true,
  checkedAt: evidence.checkedAt,
  ageDays: Number(ageDays.toFixed(2)),
  evidenceEntries: entries.length,
  marketSurveys: { aaii: aaii.status, naaim: naaim.status, investorsIntelligence: surveys.investorsIntelligence.status },
  policy: 'official-source-only; reference-only; no synthesis'
}));
