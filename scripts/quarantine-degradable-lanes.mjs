#!/usr/bin/env node
// v58.70 (owner 2026-10-23): refresh-data step between the producers and the validation gates. It runs the artifact
// semantics check once in report mode; when every failure is tagged with a degradable lane (scripts/lib/lane-quarantine.mjs),
// those lanes go back to the last published data.json (main HEAD) or are flagged, and data.meta.laneQuarantine says so.
// Any untagged failure leaves data.json untouched, so the validation step below still refuses the whole refresh.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyLaneQuarantine } from './lib/lane-quarantine.mjs';
import { retainVerifiedMarketAnalysis } from './lib/market-analysis-validate.mjs';

const DATA = 'public-data/data.json';
const write = (value) => writeFileSync(DATA, JSON.stringify(value, null, 1)); // the producer's format (fetch-data.mjs)

function probe() {
  const report = join(mkdtempSync(join(tmpdir(), 'aio-lanes-')), 'report.json');
  try { execFileSync(process.execPath, ['scripts/ci-artifact-semantics-check.mjs'], { env: { ...process.env, AIO_LANE_REPORT: report }, stdio: ['ignore', 'ignore', 'inherit'] }); } catch (_) { /* the report carries the failures */ }
  return JSON.parse(readFileSync(report, 'utf8'));
}

const produced = JSON.parse(readFileSync(DATA, 'utf8'));
// The quarantine is decided fresh every run: a lane that passes again leaves quarantine on this publish.
if (produced.meta?.laneQuarantine) { delete produced.meta.laneQuarantine; write(produced); }
const report = probe();
const blocking = report.errors.length - report.laneFailures.length;
if (!report.errors.length) {
  console.log('[lane-quarantine] every lane passed; nothing quarantined');
} else if (blocking > 0) {
  console.log(`[lane-quarantine] ${blocking} untagged failure(s); no lane is quarantined and the validation gate decides`);
} else {
  let previous = null;
  try { previous = JSON.parse(execFileSync('git', ['show', `HEAD:${DATA}`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })); } catch (_) { previous = null; }
  const next = applyLaneQuarantine(produced, previous, report.laneFailures, {
    retainNarrative: (analysis) => retainVerifiedMarketAnalysis(analysis, { reason: `lane-quarantine: ${report.laneFailures.find((row) => row.lane === 'narrative')?.check || ''}` }),
  });
  write(next);
  // v58.71 (pipeline audit): nothing limited how long a lane could stay quarantined. Past a day the run still publishes
  // the rest, but the lane is marked overdue and raised as an Actions error so it is fixed, not left to age.
  const OVERDUE_MS = 24 * 3600 * 1000;
  for (const entry of next.meta.laneQuarantine || []) {
    const overdue = Date.now() - Date.parse(entry.since) > OVERDUE_MS;
    if (overdue) entry.overdue = true;
    console.log(`::${overdue ? 'error' : 'warning'}::[lane-quarantine] ${entry.lane} (${entry.remedy}, since ${entry.since}${overdue ? ', over 24 h' : ''}): ${entry.check}`);
  }
  write(next);
  const after = probe();
  if (after.errors.length) console.log(`[lane-quarantine] ${after.errors.length} failure(s) remain after quarantine; the validation gate decides`);
}
