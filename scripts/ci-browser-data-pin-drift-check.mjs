#!/usr/bin/env node
// v59.70 (integration review 89e8c881): live data against the pinned browser snapshot (architecture/browser-data-fixture.json).
// When a producer starts writing a new structure (history.v2, putCall removed, rotation-detail.json added, market-day
// headlineTranslation), the pinned snapshot no longer looks like production and needs a re-pin. That is a live-data
// judgement, not a source defect (R634 / I8, scripts/lib/qa-live-data.mjs): this gate declares liveData: "content", so
// a ci.yml contract shard reports it (ADVISORY) and the source push stays green, while its watchdog-local twin fails the
// data watchdog — operations-alert opens the issue carrying the re-pin command below — and a local run fails.
// Producer pre-push (refresh-data runs --group data) does not run it on purpose: the new structure has to land before
// any commit can be pinned on it, so blocking the producer would block its own fix.
import { checkFixture, formatCheckFailure, readManifest } from './browser-data-fixture.mjs';

const manifest = readManifest();
const problems = checkFixture({ manifest });
if (problems.length) {
  console.error(formatCheckFailure(manifest, problems));
  process.exit(1);
}
console.log(`browser data pin drift OK: live public-data has the structures pinned at ${manifest.sha.slice(0, 12)} (${manifest.committedAt}), ${Object.keys(manifest.files).length} files`);
