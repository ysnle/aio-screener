// Read-only source fixtures: no external calls and no public-data writes.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { planeFresh } from '../../scripts/producer/source-planes.mjs';
import { buildDomainReceipts } from '../../scripts/producer/receipts.mjs';
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const attemptedAt = '2026-10-24T08:00:00.000Z';
const old = { totalPutCall: 0.8, asOf: '2026-10-22', fetchedAt: '2026-10-23T01:00:00.000Z', status: 'current-reference' };
// Exact retention expression from sourcePlanes, executed with a failed response.
const planeSource = read('scripts/producer/source-planes.mjs');
const expr = planeSource.match(/\.then\(\(value\) => (\(value\?\.error[\s\S]*?: value\))\),/)[1];
const retained = vm.runInNewContext(expr, { value: { error: 'fixture-provider-failure' }, prior: { putCall: old }, attemptedAt });
const receipt = buildDomainReceipts({ previousMeta: {}, attemptedAt, generatedAt: attemptedAt, symbolCount: 0, quotes: [], failed: [], news: [], previousNews: [], fredSeriesIds: [], fredFetchedKeys: [], fredFailedSeries: [], planes: { putCall: retained } })['options-put-call'];
assert.equal(planeFresh('putCall', retained), true);
assert.equal(receipt.publication.status, 'SUCCESS');

const screener = read('scripts/producer/screener.mjs');
const enrich = screener.slice(screener.indexOf('const _fmpSym'), screener.indexOf('export async function enrichSecFundamentals'));
const urls = [];
const fmp = await vm.runInNewContext(`${enrich}\nenrichFundamentals(['AAPL'])`, {
  process: { env: { FMP_API_KEY: 'fixture-key' } }, console: { log() {}, warn() {} },
  fetchJSON: async url => { urls.push(url); return []; },
  mapLimit: async (items, limit, fn) => Promise.all(items.map(fn)), round: (n) => n
});
const growth = new URL(urls.find(u => u.includes('financial-growth')));
assert.equal(growth.searchParams.get('apikey'), null);
assert.equal(growth.searchParams.get('limit'), '1?apikey=fixture-key');

// Execute the actual dossier transform in an isolated VM. Writes are captured in memory.
const output = new Map();
const source = read('scripts/build-knowledge-research-dossiers.mjs')
  .replace(/^#!.*\n/, '').replace(/^import .*;\r?\n/gm, '')
  .replaceAll('import.meta.url', 'scriptUrl');
vm.runInNewContext(source, { fs: { readFileSync: fs.readFileSync }, path, fileURLToPath,
  scriptUrl: new URL('../../scripts/build-knowledge-research-dossiers.mjs', import.meta.url).href,
  process: { env: {} }, console: { log() {} }, atomicWriteJsonSync: (target, value) => output.set(target, value)
});
const bundle = [...output.values()].find(v => v.schemaVersion === 'knowledge-research-dossiers.v1');
const facts = JSON.parse(read('public-data/knowledge/research-facts.json')).facts;
const units = JSON.parse(read('public-data/knowledge/coverage-matrix.json')).units;
const suspicious = [];
for (const unit of units) {
  const haystack = `${unit.unitId} ${unit.title} ${(unit.sourceIds || []).join(' ')}`.toLowerCase();
  const words = new Set(haystack.split(/[^a-z0-9&\-]+/).filter(Boolean));
  const dossier = bundle.dossiers.find(d => d.contentUnitId === unit.unitId);
  for (const fact of facts) {
    const tokens = (fact.appliesTo || []).filter(t => haystack.includes(String(t).toLowerCase()) && !words.has(String(t).toLowerCase()));
    if (tokens.length && dossier.researchFactIds.includes(fact.factId)) suspicious.push({ unitId: unit.unitId, factId: fact.factId, tokens, status: dossier.status });
  }
}
assert.ok(suspicious.length > 0);
const result = { evidence: 'isolated source execution; no network; no producer outputs written', putCall: { retained, fresh: planeFresh('putCall', retained), receipt }, fmp: { requestedUrl: growth.href, parsedApiKey: growth.searchParams.get('apikey'), parsedLimit: growth.searchParams.get('limit'), result: fmp }, dossier: { count: bundle.dossiers.length, substringCandidateCount: suspicious.length, examples: suspicious.slice(0, 25), boundary: 'Substring attachments reproduced; semantic validity requires individual review, not all candidates are errors.' } };
fs.writeFileSync(new URL('./pass2-reproductions.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
