import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dedupeNewsArticles, groupNewsStories, resolveNewsIssuers, newsArticleKey } from '../src/domain/news/stories.js';
import { normalizeNews } from '../src/data/normalize/news.js';
import { buildMarketRead } from '../src/domain/briefing/market-read.js';
import { buildBriefingSchedule } from '../src/domain/briefing/schedule.js';
import { secFilingUrl } from '../src/domain/fundamental/sec-report.js';
import { createResearchSnapshots, projectResearchSnapshot } from '../src/data/research-snapshots.js';
import { ROUTE_HUBS } from '../src/ui/navigation/route-hubs.js';
import { evidenceDigest, validateBrowserEvidence, compareBrowserEvidence } from './lib/browser-evidence.mjs';

const row = { source: 'fixture-wire', sourceStoryId: 'story-1', issuerSymbol: 'NVDA', id: 'one', title: 'NVIDIA reports revenue', link: 'https://example.test/article?id=1', pubDate: '2026-10-09T18:00:00Z', score: 90 };
const correction = { ...row, id: 'two', title: 'Correction: NVIDIA revenue', correctionOf: 'one', pubDate: '2026-10-09T19:00:00Z', score: 1 };
const other = { ...row, issuerSymbol: 'AAPL', id: 'three', link: 'https://example.test/article?id=2' };
assert.equal(dedupeNewsArticles([row, { ...row }, correction, other]).length, 3, 'P1601: exact repeats only');
const stories = groupNewsStories([row, correction, other]);
assert.equal(stories.length, 2, 'P1601: source story ids cannot merge different issuers');
assert.equal(stories[0].title, correction.title, 'P1601: low-score correction represents the event');
assert.equal(stories[0].storyArticles.length, 2, 'P1601: original article remains reachable');
assert.notEqual(newsArticleKey(row), newsArticleKey({ ...row, link: 'https://example.test/article?id=2' }), 'P1601: query identity survives');
assert.equal(groupNewsStories([{ ...row, sourceStoryId: null }, { ...other, sourceStoryId: null }]).length, 2, 'P1601: identical title is insufficient');
assert.equal(groupNewsStories([row, { ...correction, source: 'another-wire' }]).length, 2, 'P1601: correction is source-scoped');
const entries = { NVDA: { en: 'NVIDIA', kr: '엔비디아' }, MSFT: { en: 'Microsoft', kr: '마이크로소프트', alt: ['MS'] }, '005930.KS': { en: 'Samsung Electronics', kr: '삼성전자' }, COO: { en: 'CooperCompanies', kr: '쿠퍼' } };
entries.TGT = { en: 'Target', kr: '타깃' };
for (const [symbol, en] of [['TSLA', 'Tesla'], ['AAPL', 'Apple'], ['META', 'Meta'], ['NKE', 'Nike']]) {
  assert.deepEqual(resolveNewsIssuers({ title: `${en} reports earnings revenue` }, [symbol], { [symbol]: { en } }), [symbol], 'P1601: short canonical company name is not ticker alias');
}
assert.deepEqual(resolveNewsIssuers({ title: 'UBS raises Helen of Troy stock price target' }, ['$TGT'], entries), [], 'P1601: financial target noun is not Target issuer');
assert.deepEqual(resolveNewsIssuers({ title: 'Target Corporation reports sales' }, [], entries), ['TGT'], 'P1601: unambiguous issuer remains available');
assert.deepEqual(resolveNewsIssuers({ title: '$TGT reports sales' }, [], entries), ['TGT'], 'P1601: explicit registered ticker remains available');
assert.deepEqual(resolveNewsIssuers(row, ['$ZZZZ', '$MSFT'], entries), ['NVDA'], 'P1601: AI cache cannot introduce absent company');
assert.deepEqual(resolveNewsIssuers({ title: 'Former FTX COO resigns' }, ['$COO'], entries), [], 'P1601: officer acronym not issuer');
assert.deepEqual(resolveNewsIssuers({ title: '삼성전자 실적 발표' }, ['$삼성전자'], entries), ['005930.KS'], 'P1601: exact Korean registry issuer');
assert.deepEqual(resolveNewsIssuers({ title: '삼성전자가 실적을 발표했다' }, [], entries), ['005930.KS'], 'P1601: Korean particle does not alter exact issuer name');
assert.deepEqual(resolveNewsIssuers({ title: '$MS shares fall' }, ['MS'], entries), [], 'P1601: ticker-shaped alias never rewrites');
assert.equal(normalizeNews({ fetchedAt: '2026-10-10T00:00:00Z', items: [{ ...row, publishedAt: row.pubDate }] }).items[0].fetchedAt, '2026-10-10T00:00:00Z', 'P1601: collection distinct from publication');
const core = readFileSync('js/aio-core.js', 'utf8');
const storeSource = core.slice(core.indexOf('const NewsStore ='), core.indexOf('// ── DataHealth'));
const context = vm.createContext({ window: {}, Date, Set, JSON });
vm.runInContext(storeSource + '\nglobalThis.testStore = NewsStore;', context);
assert.equal(context.testStore.filter([{ ...row }, { ...row, link: 'https://example.test/article?id=2' }, correction]).length, 3, 'P1601: legacy early boot retains query ids and changed versions');

const schedule = buildBriefingSchedule({ nowMs: Date.parse('2026-10-09T00:00:00Z'), names: { NVDA: 'NVIDIA' }, earningsMeta: { source: 'fixture-calendar' },
  earnings: [{ symbol: 'NVDA', date: '2026-10-09', hour: 'amc', epsEstimate: 1 }, { symbol: 'NVDA', date: '2026-10-09', hour: 'amc', epsActual: 1.2, epsEstimate: 1 }, { symbol: 'NVDA', date: '2026-10-12', hour: 'bmo' }] });
assert.equal(schedule.length, 2, 'P1602: event id dedupes same issuer/date/session only');
assert.equal(schedule[0].status, 'received', 'P1602: received actual supersedes pending duplicate');
assert.notEqual(schedule[0].id, schedule[1].id, 'P1602: event ids contain date');
// T15 (expert review 2026-10-13): the estimate source moves to the hover; a missing period is omitted, not printed as '미제공'.
assert.match(schedule[0].sourceTitle || '', /fixture-calendar/, 'P1602/T15: estimate source stays attached (hover)');
assert.doesNotMatch(schedule[0].last, /fixture-calendar|미제공/, 'T15: no provider name or 미제공 in the line');
assert.equal(secFilingUrl('0001045810', '0001045810-26-000001'), 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000001/0001045810-26-000001-index.html', 'P1602: official SEC index');
assert.equal(secFilingUrl('../1', 'bad'), null, 'P1602: invalid filing identity creates no link');
let saved = null;
const digest = async (value) => createHash('sha256').update(value).digest('hex');
const snapshots = createResearchSnapshots({ storage: { getItem: () => saved, setItem: (_key, value) => { saved = value; } }, digest });
const content = { kind: 'stock', symbol: 'NVDA', name: 'NVIDIA', note: 'fixture note', shares: 100, avgCost: 90, quote: { value: 123, observedAt: row.pubDate, source: 'fixture', basis: 'regular-session-close' } };
const first = await snapshots.capture(content);
content.quote.value = 999;
assert.equal(snapshots.list('stock')[0].content.quote.value, 123, 'P1602: refreshed values cannot rewrite snapshot');
assert.ok(!saved.includes('shares') && !saved.includes('avgCost'), 'P1602: personal holdings excluded');
assert.equal((await snapshots.capture(first.content)).id, first.id, 'P1602: save clock not part of content digest');
assert.ok(snapshots.remove(first.id), 'P1602: user can explicitly free archive space');
assert.equal(snapshots.list().length, 0, 'P1602: removal applies locally');
assert.ok(snapshots.undoRemove(), 'P1602: user can undo removal in this app session');
assert.equal(snapshots.list()[0].savedAt, first.savedAt, 'P1602: undo preserves original observation and save metadata');
const unreadable = createResearchSnapshots({ storage: { getItem: () => '{bad', setItem: () => { throw Error('must not overwrite'); } }, digest });
await assert.rejects(unreadable.capture(first.content), /기존 자료/, 'P1602: corrupt archive preserved');
const memory = createResearchSnapshots({ storage: { getItem: () => null, setItem: () => { throw Error('quota'); } }, digest });
await memory.capture(first.content);
assert.equal(memory.status(), 'memory', 'P1602: quota failure is not persistent success');
assert.throws(() => projectResearchSnapshot({ kind: 'briefing', sessionDate: null }), /기준일/, 'P1602: missing US basis cannot be archived');
const read = buildMarketRead({ history: [{ date: '2026-10-08', spx: 100, tnx: 4, fg: 35, fieldMeta: { tnx: { observedAt: '2026-10-08', source: 'valid-source' } } },
  { date: '2026-10-09', spx: 101, tnx: 9, fieldMeta: { tnx: { observedAt: '2026-10-10', source: 'future-source' } } }], credit: { fg: 99, fgAsOf: '2026-10-10', fgSource: 'future-source' } });
assert.equal(read.facts.find((fact) => fact.label === '미 10년물').observedAt, '2026-10-08', 'P1602: archive provenance follows selected observation, not future row');
assert.equal(read.facts.find((fact) => fact.label === '미 10년물').source, 'valid-source', 'P1602: value and source must be selected together');
assert.equal(read.facts.find((fact) => fact.label === 'F&G').observedAt, '2026-10-08', 'P1602: history F&G cannot borrow current snapshot date');
assert.equal((await snapshots.capture({ ...first.content, publishedAt: '2030-01-01', sourceRevision: 'changed-build' })).id, first.id, 'P1602: build clocks outside content identity');

const step = { stepId: 'news-ready', screenId: 'today', route: 'market-news', stateId: 'fixture', entity: null,
  initialCondition: 'empty test profile', action: { type: 'navigate', target: '#market-news' }, readyCondition: 'native renderer plus fixture article', readyObserved: true,
  status: 'observed', authority: 'headless-fixture', claimType: 'text', captureSelection: ['dom'], expected: 'fixture visible', actual: 'fixture visible',
  evidence: [{ kind: 'dom', locator: '.news-item-card', digest: evidenceDigest('fixture visible') }], limitations: ['fixture only'] };
const evidence = { schemaVersion: 'aio-browser-evidence.v1', runId: 'fixture', observedAt: '2026-10-10T00:00:00Z',
  target: { gitHead: 'fixture-sha', version: 'fixture', contentDigest: evidenceDigest('target'), digestScope: 'fixture only' }, provider: { name: 'playwright', version: 'fixture', operation: 'test' },
  environment: { mode: 'headless-fixture', fixtureDigest: evidenceDigest('fixture'), initialStateId: 'empty', viewport: { width: 1440, height: 900 }, timezone: 'Asia/Seoul', networkPolicy: 'local-only' },
  normalization: { policyId: 'none', policyHash: evidenceDigest({ policyId: 'none', rules: [] }), rules: [] },
  coverage: ROUTE_HUBS.map((hub) => ({ screenId: hub.id, route: hub.routes[0].id, stateId: 'representative', status: 'unverified', reason: 'not exercised', stepIds: [] })),
  steps: [step], semanticReview: { status: 'unverified', reason: 'machine only' }, limitations: ['fixture'] };
assert.deepEqual(validateBrowserEvidence(evidence), [], 'P1603: complete evidence contract');
assert.equal(compareBrowserEvidence(evidence, structuredClone(evidence))[0].status, 'equal', 'P1603: complete matching selected observations');
for (const mutate of [r => { r.steps = []; }, r => { r.provider.version = 'different'; }, r => { r.steps[0].action.target = '#ticker'; }, r => { r.environment.viewport.width = 1920; }, r => { r.steps[0].captureSelection = ['screenshot']; }, r => { r.steps[0].readyObserved = false; }, r => { r.steps[0].status = 'blocked'; r.steps[0].reason = 'provider unavailable'; }]) {
  const changed = structuredClone(evidence); mutate(changed);
  assert.equal(compareBrowserEvidence(evidence, changed)[0].status, 'unknown', 'P1603: incomplete or incompatible comparison cannot claim equality/change');
}
for (const mutate of [r => { r.steps.push(r.steps[0]); }, r => { r.steps[0].evidence[0].path = '../secret.txt'; }, r => { r.cookies = 'private'; }, r => { r.semanticReview.status = 'pass'; }]) {
  const invalid = structuredClone(evidence); mutate(invalid);
  assert.ok(validateBrowserEvidence(invalid).length, 'P1603: unsafe evidence must fail');
}
assert.ok(validateBrowserEvidence(evidence, { secrets: ['fixture visible'] }).length, 'P1603: declared secrets cannot be retained');
console.log('Reference adoption contract PASS (P1601/P1602/P1603): news identity/issuer, schedule/SEC, local snapshots and bounded browser evidence.');
