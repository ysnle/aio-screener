// P1465: the candidate archive records the page's own default ranking before outcomes exist and
// measures each stock on its own completed-session calendar. Fixture checks (no network):
//  1. the producer ranks the published artifacts through the page's read path (same identity
//     builder the page uses), and the entry's top fifth is ordered by that ranking;
//  2. an outcome appears only after 21 later sessions exist, and equals the equal-weight mean;
//  3. a stale-feed stock (last bar before the anchor) is not measured, not shifted;
//  4. measured entries are never overwritten by a same-date re-run; old lists are trimmed;
//  5. the summary only averages entries of the latest model identity;
//  6. the published artifact (when present) is the declared schema with a consistent summary.
import { readFile } from 'node:fs/promises';
import {
  CANDIDATE_ARCHIVE_SCHEMA, anchorSessionDates, buildCandidateEntry, emptyCandidateArchive, fillCandidateOutcomes,
  forwardReturn, rankPublishedScreener, summarizeCandidateArchive, upsertCandidateEntry
} from './lib/candidate-archive.mjs';
import { buildRankingIdentity } from '../src/domain/screener/model-fingerprint.js';

const fail = (message) => { throw new Error(`[candidate-archive] ${message}`); };
const root = new URL('../', import.meta.url);

// 1. Page-path ranking on the repository artifacts.
const screener = JSON.parse(await readFile(new URL('public-data/screener.json', root), 'utf8'));
const now = Date.parse(screener.asOf) + 60_000;
const { ranking } = await rankPublishedScreener({ root, now });
if (!ranking?.available || !(ranking.rows || []).some((row) => Number.isFinite(row.rank))) fail('page-path ranking did not produce ranks from the published artifacts');
const identity = buildRankingIdentity({ appliedFactorWeights: ranking.appliedFactorWeights, activeFactors: ranking.activeFactors });
if (!identity) fail('ranking identity missing');

// Synthetic completed-session calendars: 30 sessions; anchor at index 5 → forward index 26.
const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 0, 5 + i)).toISOString().slice(0, 10));
const ranked = ranking.rows.filter((row) => Number.isFinite(row.rank));
const series = new Map(ranked.map((row, i) => {
  const growth = 1 + (i % 7) / 100;
  return [row.sym, { dates: days.slice(0, 6), adjCloses: days.slice(0, 6).map((_, d) => 100 * growth ** d) }];
}));
const anchors = anchorSessionDates(series);
const entry = buildCandidateEntry({ ranking, sessionDates: anchors, recordedAt: '2026-01-10T22:00:00Z' });
if (!entry || entry.identity !== identity) fail('entry identity must be the ranking identity the page builds');
const top = entry.top.split(',');
const rankOf = new Map(ranked.map((row) => [row.sym, row.rank]));
if (top.length !== Math.floor(ranked.length / 5) || top.some((sym, i) => i && rankOf.get(sym) > rankOf.get(top[i - 1]))) fail('top fifth is not ordered by the page rank');
if (entry.date !== days[5]) fail(`anchor session must be the series' common last bar: ${entry.date}`);

// 2. No outcome before 21 later sessions; then the exact equal-weight mean.
const archive = emptyCandidateArchive();
upsertCandidateEntry(archive, entry);
if (fillCandidateOutcomes(archive, series) !== 0 || archive.entries[0].outcome) fail('outcome filled before the forward window closed');
for (const [sym, s] of series) {
  const i = ranked.findIndex((row) => row.sym === sym);
  const growth = 1 + (i % 7) / 100;
  s.dates = days.slice(0, 27);
  s.adjCloses = s.dates.map((_, d) => 100 * growth ** d);
}
// 3. One top stock's feed stopped before the anchor: it must not be measured.
const staleSym = top[0];
series.set(staleSym, { dates: days.slice(0, 4), adjCloses: [1, 1, 1, 1] });
if (fillCandidateOutcomes(archive, series) !== 1) fail('outcome not filled after the forward window closed');
const outcome = archive.entries[0].outcome;
const expectedTop = top.slice(1).map((sym) => forwardReturn(series.get(sym), entry.date).value);
const meanTop = expectedTop.reduce((a, b) => a + b, 0) / expectedTop.length * 100;
if (Math.abs(outcome.topPct - Math.round(meanTop * 1000) / 1000) > 0.0011) fail(`top mean mismatch ${outcome.topPct} vs ${meanTop}`);
if (outcome.measured.top !== top.length - 1 || outcome.listed.top !== top.length) fail('stale-feed stock must be listed but not measured');
if (outcome.forwardDate !== days[26]) fail(`forward date must be 21 sessions after the anchor: ${outcome.forwardDate}`);

// 4. Same-date re-run keeps the measured entry; old lists are trimmed, outcomes stay.
if (upsertCandidateEntry(archive, { ...entry, top: 'X' }) !== 'kept-measured' || archive.entries[0].top === 'X') fail('a measured entry was overwritten');
fillCandidateOutcomes(archive, series, { today: '2026-06-01' });
if (archive.entries[0].top || archive.entries[0].universe || !archive.entries[0].outcome) fail('retention must drop old lists and keep the outcome');

// 5. Summary averages only the latest identity.
const other = { ...entry, date: days[6], identity: 'other-model', outcome: { spreadPct: 99, topVsUniversePct: 99 } };
upsertCandidateEntry(archive, other);
let summary = summarizeCandidateArchive(archive);
if (summary.identity !== 'other-model' || summary.measured !== 1 || summary.meanSpreadPct !== 99) fail('summary must restart at a model change');
archive.entries.pop();
summary = summarizeCandidateArchive(archive);
if (summary.measured !== 1 || summary.identity !== identity) fail('summary identity drifted');

// 6. Published artifact, when the producer has written one.
let published = null;
try { published = JSON.parse(await readFile(new URL('public-data/screener-candidate-archive.json', root), 'utf8')); } catch (_) { /* first producer run pending */ }
if (published) {
  if (published.schemaVersion !== CANDIDATE_ARCHIVE_SCHEMA || !Array.isArray(published.entries)) fail('published archive schema drifted');
  const recomputed = summarizeCandidateArchive(published);
  if (JSON.stringify(recomputed) !== JSON.stringify(published.summary)) fail('published summary does not match its entries');
  if (published.entries.some((item) => item.outcome && item.outcome.costs !== 'not-modelled')) fail('outcome must declare costs not modelled');
}
console.log(JSON.stringify({ ok: true, ranked: ranked.length, quintile: top.length, published: published ? published.entries.length : 'pending-first-run' }));
