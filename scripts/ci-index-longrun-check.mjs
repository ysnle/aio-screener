#!/usr/bin/env node
// v60.50 (long-run index history): public-data/history.json starts 2025-09-30, so a screen could not say how large the current
// fall is against decades of closes. scripts/build-index-longrun.mjs (refresh-data daily lane, weekly) publishes the derived
// tables (src/domain/market/indices/long-run.js) to public-data/index-longrun.json; readIndexLongrun joins them with the
// live window. Two sections:
//   code — a pinned synthetic series with known peaks and troughs and a 2020-like crash: episodes, n-session tails,
//          declustering, ranks, the reader's "since" answer across the artifact/live boundary, the producer's fallback
//          and its wiring (workflow step, publish set, freshness registry, lineage bound);
//   data — the published artifact's shape, only when the file exists (the producer runs in GitHub Actions; before its
//          first run the file is absent and that is not a failure).
// Fails on the v60.49 code (the module, the producer and the registrations do not exist there).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSections } from './lib/gate-sections.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8');
const load = (file) => import(new URL(`../${file}`, import.meta.url));
const ARTIFACT = 'public-data/index-longrun.json';

// Session i is dated 2000-01-01 + i days (only the order matters); closes are linear between anchors [session, close].
const dayOf = (i) => new Date(Date.UTC(2000, 0, 1) + i * 86400000).toISOString().slice(0, 10);
function pathOf(anchors) {
  const out = [];
  for (let k = 1; k < anchors.length; k += 1) {
    const [i0, v0] = anchors[k - 1];
    const [i1, v1] = anchors[k];
    for (let i = k === 1 ? i0 : i0 + 1; i <= i1; i += 1) out.push([dayOf(i), Math.round((v0 + ((v1 - v0) * (i - i0)) / (i1 - i0)) * 100) / 100]);
  }
  return out;
}
// A: 120 → 96 (-20%), regained at session 25. A -4.96% dip (no episode). Crash: high 150 at 40, -12% the next session,
// -30% over five sessions to 45, trough 99 (-34%) at 63, 23 sessions after the high; 135 at 79 (an open -10% drawdown).
const BASE = pathOf([[0, 100], [10, 120], [15, 96], [25, 121], [30, 115], [40, 150], [41, 132], [45, 105], [63, 99], [70, 140], [79, 135]]);
// The live window after the artifact: a new high of 155 at 90, then -10% in one session at 91.
const LIVE = pathOf([[79, 135], [90, 155], [91, 139.5]]).slice(1);

await runSections('index-longrun', [
  ['v60.50 index-longrun derivation, reader and wiring', async () => {
    const lr = await load('src/domain/market/indices/long-run.js');
    const { LONGRUN_DEFINITION, INDEX_LONGRUN_SCHEMA } = lr;

    assert.deepEqual(lr.drawdownEpisodes(BASE), [
      { peak: dayOf(10), trough: dayOf(15), depth: -20, sessions: 5, regained: dayOf(25) },
      { peak: dayOf(40), trough: dayOf(63), depth: -34, sessions: 23, regained: null },
    ], 'v60.50 drawdown episodes: the 20% fall regained at session 25, the open 34% crash; the 4.96% dip is not an episode');

    const body = lr.summarizeIndexHistory(BASE);
    assert.deepEqual([body.from, body.through, body.sessions], [dayOf(0), dayOf(79), 80], 'v60.50 from, through and session count of the series');
    assert.deepEqual(body.high, { date: dayOf(40), close: 150 }, 'v60.50 the running closing high is the crash peak');
    assert.deepEqual(body.drawdown, { depth: -10, trough: { date: dayOf(63), close: 99 }, troughDepth: -34 }, 'v60.50 the open drawdown and its trough so far');
    assert.deepEqual([body.recent.length, body.recent.at(-1)], [LONGRUN_DEFINITION.recentSessions, [dayOf(79), 135]], 'v60.50 the recent closes end at through');

    const one = body.moves['1'];
    assert.equal(one.observations, 79, 'v60.50 one-session windows: sessions - 1');
    assert.equal(one.cutFall, -6.04, 'v60.50 the worst-2% cut is the 2nd-worst one-session move (k = ceil(79 x 0.02))');
    assert.deepEqual(one.falls, [[dayOf(41), -12], [dayOf(45), -6.04]], 'v60.50 the one-session tail, most extreme first');
    const five = body.moves['5'];
    assert.equal(five.observations, 75, 'v60.50 five-session windows: sessions - 5');
    assert.deepEqual(five.falls[0], [dayOf(45), -30], 'v60.50 the worst five-session move is the crash week');
    assert.ok(five.falls.slice(1).every(([date]) => date <= dayOf(40) || date >= dayOf(50)),
      'v60.50 declustering drops every five-session window that shares a return with the crash week');
    assert.equal(lr.declusterMoves(lr.sessionMoves(BASE, 5), 5, 'fall').filter((move) => move.i > 40 && move.i < 50).length, 1,
      'v60.50 one event per crash week');
    assert.equal(JSON.stringify(lr.summarizeIndexHistory([...BASE].reverse())), JSON.stringify(body), 'v60.50 the tables do not depend on input order (deterministic)');

    const artifact = { schemaVersion: INDEX_LONGRUN_SCHEMA, definition: LONGRUN_DEFINITION, indexes: { spx: { symbol: '^GSPC', ...body } } };
    const read1 = lr.readIndexLongrun(artifact, { index: 'spx', horizon: 1, recent: [...BASE.slice(-30), ...LIVE] });
    assert.equal(read1.liveThrough, dayOf(91), 'v60.50 the reader reads through the last live session');
    assert.deepEqual(read1.move, { date: dayOf(91), from: dayOf(90), pct: -10, side: 'fall', inTail: true, cut: -6.04, rank: 2, events: 2, observations: 79, since: { date: dayOf(41), pct: -12 } },
      'v60.50 a live -10% session ranks 2nd and is the largest one-session fall since the -12% crash day');
    assert.deepEqual(read1.drawdown.high, { date: dayOf(90), close: 155 }, 'v60.50 a live close above the published high is the new high');
    assert.deepEqual([read1.drawdown.depth, read1.drawdown.inRange], [-10, true], 'v60.50 a 10% fall from the live high is inside the stored episode range');
    assert.deepEqual(read1.drawdown.since, { peak: dayOf(40), trough: dayOf(63), depth: -34 }, 'v60.50 the regained crash is now a comparable past episode');
    assert.deepEqual(read1.drawdown.comparable.map((episode) => episode.peak), [dayOf(40), dayOf(10)], 'v60.50 comparable episodes newest first');

    // One live session: the 20-session base close comes from the artifact's own recent closes.
    const read20 = lr.readIndexLongrun(artifact, { index: 'spx', horizon: 20, recent: [[dayOf(80), 134]] });
    assert.deepEqual([read20.move.from, read20.move.pct], [dayOf(60), Math.round((134 / BASE[60][1] - 1) * 10000) / 100],
      'v60.50 a window that crosses the artifact/live boundary takes its base from the published recent closes');

    // The artifact ends on the crash day and nothing is live: the current move is the published event itself, which must
    // not count as an earlier one.
    const crash = lr.summarizeIndexHistory(BASE.slice(0, 42));
    const readCrash = lr.readIndexLongrun({ definition: LONGRUN_DEFINITION, indexes: { spx: crash } }, { index: 'spx', horizon: 1 });
    assert.deepEqual([readCrash.move.pct, readCrash.move.rank, readCrash.move.events, readCrash.move.since], [-12, 1, 0, null],
      'v60.50 the largest move on record has rank 1 and no "since" date');
    const readCalm = lr.readIndexLongrun(artifact, { index: 'spx', horizon: 1, recent: [[dayOf(80), 134]] });
    assert.deepEqual([readCalm.move.inTail, readCalm.move.rank, readCalm.move.since], [false, null, null], 'v60.50 a move inside the body of history has no rank or since');
    assert.equal(lr.readIndexLongrun(artifact, { index: 'kospi', horizon: 1 }), null, 'v60.50 an index the artifact lacks reads null');

    const producer = await load('scripts/build-index-longrun.mjs');
    const previous = { schemaVersion: INDEX_LONGRUN_SCHEMA, definition: LONGRUN_DEFINITION, indexes: { kospi: { symbol: '^KS11', from: 'kept' } } };
    const built = producer.buildIndexes({ spx: [], kospi: [] }, previous);
    assert.deepEqual(Object.keys(built), ['kospi'], 'v60.50 a failed fetch keeps that index\'s previous body and adds nothing');
    assert.deepEqual(Object.keys(producer.LONGRUN_INDEXES), ['spx', 'ndx', 'sox', 'kospi'], 'v60.50 the indexes use history.json field names (one Nasdaq: the Nasdaq-100 the opening reads)');
    assert.equal(producer.skipRebuild({ ...previous, status: 'current', generatedAt: '2026-11-20T00:00:00Z' }, Date.parse('2026-11-23T00:00:00Z')), false, 'v60.50 a copy missing an index is rebuilt');

    const workflow = read('.github/workflows/refresh-data.yml');
    const step = workflow.slice(workflow.indexOf('id: index-longrun'), workflow.indexOf('run: node scripts/build-index-longrun.mjs'));
    assert.ok(step && /steps\.daily-lane\.outputs\.due == 'true'/.test(step) && /continue-on-error: true/.test(step), 'v60.50 refresh-data runs the producer on the daily lane without stopping the data commit');
    const { workflowPublishes, outsideDataRoot } = await import('./lib/data-publish-sets.mjs');
    assert.ok(workflowPublishes('refresh-data.yml', ARTIFACT) && !outsideDataRoot([ARTIFACT]).length, 'v60.50 the refresh-data publish set stages the artifact');
    const { ARTIFACT_FRESHNESS } = await load('src/data/contracts/artifact-freshness.js');
    assert.equal(ARTIFACT_FRESHNESS['index-longrun.json']?.producer, 'scripts/build-index-longrun.mjs', 'v60.50 the freshness registry names the producer');
    assert.ok(read('scripts/ci-data-lineage-audit.mjs').includes("'index-longrun.json': { kind: 'research-reference'"), 'v60.50 the lineage audit dates the artifact');
    console.log('index-longrun code: episodes, tails, reader since/rank across the live boundary, producer fallback and wiring OK');
  }, 'code'],

  ['v60.50 index-longrun published artifact', async () => {
    if (!existsSync(join(root, ARTIFACT))) { console.log(`index-longrun data: ${ARTIFACT} not published yet (first daily-lane run) — nothing to check`); return; }
    const raw = read(ARTIFACT);
    const artifact = JSON.parse(raw);
    const { INDEX_LONGRUN_SCHEMA, LONGRUN_DEFINITION } = await load('src/domain/market/indices/long-run.js');
    const { isIsoDay } = await load('src/domain/shared/session-date.js');
    assert.ok(raw.length < 256 * 1024, `v60.50 the published index-longrun is small (${raw.length} bytes)`);
    assert.ok(artifact.schemaVersion === INDEX_LONGRUN_SCHEMA && Number.isFinite(Date.parse(artifact.generatedAt)) && artifact.basis === 'close',
      'v60.50 the published index-longrun carries its schema, clock and close basis');
    const iso = (value) => isIsoDay(value);
    const horizons = (artifact.definition?.horizons || []).map(String);
    assert.ok(horizons.length, 'v60.50 the published index-longrun names its horizons');
    for (const id of ['spx', 'ndx', 'sox', 'kospi']) {
      const body = artifact.indexes?.[id];
      assert.ok(body && iso(body.from) && iso(body.through) && body.from < body.through && body.sessions > 1000, `v60.50 index-longrun ${id} has from/through/sessions`);
      assert.ok(Array.isArray(body.recent) && body.recent.at(-1)?.[0] === body.through, `v60.50 index-longrun ${id} recent closes end at through`);
      assert.ok(iso(body.high?.date) && body.high.close > 0 && body.drawdown?.depth <= 0, `v60.50 index-longrun ${id} has its running high and drawdown`);
      const minPct = artifact.definition.drawdownMinPct ?? LONGRUN_DEFINITION.drawdownMinPct;
      const bad = (body.drawdowns || []).filter((episode) => !(iso(episode.peak) && iso(episode.trough) && episode.peak < episode.trough && episode.depth <= -minPct && episode.sessions > 0
        && (episode.regained === null || (iso(episode.regained) && episode.regained > episode.trough))));
      assert.deepEqual(bad, [], `v60.50 index-longrun ${id} drawdown episodes are well formed`);
      assert.ok((body.drawdowns || []).every((episode, i, list) => i === 0 || list[i - 1].peak < episode.peak), `v60.50 index-longrun ${id} episodes oldest first`);
      for (const horizon of horizons) {
        const table = body.moves?.[horizon];
        assert.ok(table?.observations > 0 && table.cutFall < 0 && table.cutRise > 0, `v60.50 index-longrun ${id} ${horizon}-session table has observations and cuts`);
        assert.ok(table.falls.every(([date, pct], i) => iso(date) && pct <= table.cutFall && (i === 0 || table.falls[i - 1][1] <= pct)), `v60.50 index-longrun ${id} ${horizon}-session falls sorted inside the cut`);
        assert.ok(table.rises.every(([date, pct], i) => iso(date) && pct >= table.cutRise && (i === 0 || table.rises[i - 1][1] >= pct)), `v60.50 index-longrun ${id} ${horizon}-session rises sorted inside the cut`);
      }
    }
    console.log(`index-longrun data: ${ARTIFACT} ${raw.length} bytes, ${Object.keys(artifact.indexes).length} indexes, generated ${artifact.generatedAt}`);
  }, 'data'],
]);
