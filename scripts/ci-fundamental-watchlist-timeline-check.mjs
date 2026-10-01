import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEntityProvider } from '../src/data/providers/entity.js';
import { normalizeEntity } from '../src/data/normalize/entity.js';
import { buildRuntimeObservationCatalog } from '../src/data/runtime-readers.js';
import { evaluatePageDataTimeline } from '../src/data/contracts/page-timeline.js';

// P1360: execute the real committed artifact through production provider/catalog.
const artifact = JSON.parse(readFileSync(new URL('../public-data/sec-fundamentals-summary.json', import.meta.url), 'utf8'));
const now = Date.parse(artifact.generatedAt);
async function stateFor(id = null, source = artifact) {
  const provider = createEntityProvider({ read: () => ({ id, history: [] }), now: () => now,
    httpClient: { requestJson: async () => ({ ok: true, data: source }) } });
  return normalizeEntity(await provider.readCurrent());
}
function inspect(entity) {
  const catalog = buildRuntimeObservationCatalog({ root: {}, state: { entity }, now });
  return { catalog, timeline: evaluatePageDataTimeline('fundamental', catalog, { now }) };
}
const normal = inspect(await stateFor());
assert.ok(normal.catalog['fundamental.watchlist'].available && normal.timeline.status === 'CURRENT', 'P1360 dated SEC watchlist is available without selecting an issuer');
assert.equal(normal.catalog['fundamental.referenceScope'].scope, 'watchlist', 'P1360 default page uses the watchlist scope');
assert.equal(normal.catalog['entity.fundamental'].observedAt, null, 'P1360 watchlist never invents selected issuer evidence');
assert.notEqual(normal.catalog['fundamental.watchlist'].observedAt, artifact.generatedAt, 'P1360 fetched/generated time is not an observation date');
const empty = inspect(await stateFor(null, { ...artifact, data: {} }));
assert.equal(empty.timeline.status, 'BLOCKED', 'P1360 empty watchlist stays held');
const undatedData = Object.fromEntries(Object.entries(artifact.data).map(([id, row]) => [id, { ...row, observedAt: null }]));
const undated = inspect(await stateFor(null, { ...artifact, data: undatedData }));
assert.equal(undated.timeline.status, 'BLOCKED', 'P1360 missing period date cannot use filed/fetched/generated dates');
const mixedDates = structuredClone(await stateFor());
mixedDates.fundamentalsWatchlist[0].observedAt = null;
assert.equal(inspect(mixedDates).timeline.status, 'BLOCKED', 'P1360 one missing member date cannot hide behind dated members');
const missingIssuer = inspect(await stateFor('NOT-IN-SEC-ARTIFACT'));
assert.ok(missingIssuer.catalog['fundamental.watchlist'].available && missingIssuer.timeline.status === 'BLOCKED', 'P1360 watchlist does not rescue a selected issuer missing facts');
assert.equal(missingIssuer.catalog['fundamental.referenceScope'].scope, 'selected-company', 'P1360 selected-company scope remains separate');
const issuerId = Object.keys(artifact.data)[0];
const selected = inspect(await stateFor(issuerId));
assert.equal(selected.catalog['fundamental.referenceScope'].observedAt, artifact.data[issuerId].observedAt, 'P1360 selected issuer uses its own dated evidence');
const stale = structuredClone(await stateFor());
stale.fundamentalsWatchlist[0].observedAt = new Date(now - 451 * 86400000).toISOString();
assert.equal(inspect(stale).timeline.checks[0].status, 'STALE', 'P1360 an old watchlist member cannot hide behind a newer member');
console.log('[fundamental-watchlist-timeline] PASS real artifact, empty, missing date, stale and selected-issuer separation');
