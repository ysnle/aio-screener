#!/usr/bin/env node
// v59.70: writes public-data/freshness/<workflow>.json, the one freshness record the lineage audit, the watchdog and the
// screens read (schema in src/data/contracts/artifact-freshness.js). Run by a producing workflow after its producers and
// before its validation gates and release-manifest sync, so the gates see exactly what will be committed.
//
//   node scripts/write-freshness-ledger.mjs --workflow refresh-data.yml --run-started <ISO>
//
// For each artifact this workflow owns:
//   - written by this run (mtime at or after --run-started): checkedAt = now. When the artifact is skipUnchanged and differs
//     from HEAD only in its volatile keys, the HEAD bytes are put back so the commit carries no timestamp-only change
//     (data audit R3); lastAttempt.status = 'unchanged', else 'updated'.
//   - not written (a failed or throttled lane kept the previous file): checkedAt stays what the previous ledger said, so
//     the age keeps counting and the watchdog names the lane once it passes staleAfterMinutes.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  ARTIFACT_FRESHNESS, FRESHNESS_SCHEMA, freshnessLedgerPath, artifactProducedAt, artifactBasisSession, sameExceptVolatile,
} from '../src/data/contracts/artifact-freshness.js';

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };

function headBytes(path) {
  const shown = spawnSync('git', ['show', `HEAD:${path}`], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
  return shown.status === 0 ? shown.stdout : null;
}

export function buildLedger({ workflow, runStartedMs, nowIso = new Date().toISOString(), previous = null, readArtifact, writeArtifact, wasWritten, headArtifact }) {
  const artifacts = {};
  for (const [file, entry] of Object.entries(ARTIFACT_FRESHNESS)) {
    if (entry.workflow !== workflow || entry.ledger === false) continue;
    const base = { expectedEveryMinutes: entry.expectedEveryMinutes, staleAfterMinutes: entry.staleAfterMinutes, workflow, producer: entry.producer };
    const prior = previous?.artifacts?.[file] || null;
    const current = readArtifact(file);
    if (!current) {
      artifacts[file] = { ...base, producedAt: null, checkedAt: prior?.checkedAt || null, basisSession: null, lastAttempt: { at: nowIso, status: 'missing' } };
      continue;
    }
    let payload = current.payload;
    let status = 'not-written';
    if (wasWritten(file, runStartedMs)) {
      status = 'updated';
      const head = entry.skipUnchanged ? headArtifact(file) : null;
      if (head && sameExceptVolatile(head.payload, payload, entry.volatileKeys)) {
        writeArtifact(file, head.bytes);
        payload = head.payload;
        status = 'unchanged';
      }
    }
    artifacts[file] = {
      ...base,
      producedAt: artifactProducedAt(file, payload),
      checkedAt: status === 'not-written' ? (prior?.checkedAt || artifactProducedAt(file, payload)) : nowIso,
      basisSession: artifactBasisSession(file, payload),
      lastAttempt: { at: nowIso, status },
    };
  }
  return { schemaVersion: FRESHNESS_SCHEMA, workflow, writtenAt: nowIso, artifacts };
}

const entryPath = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (entryPath.endsWith('scripts/write-freshness-ledger.mjs')) {
  const workflow = arg('--workflow');
  const runStartedMs = Date.parse(arg('--run-started') || '');
  if (!workflow || !Object.values(ARTIFACT_FRESHNESS).some((entry) => entry.workflow === workflow && entry.ledger !== false)) {
    console.error(`[freshness] unknown workflow ${workflow}`); process.exit(2);
  }
  if (!Number.isFinite(runStartedMs)) { console.error('[freshness] --run-started <ISO> is required'); process.exit(2); }
  const ledgerPath = freshnessLedgerPath(workflow);
  let previous = null;
  try { previous = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { previous = null; }
  const ledger = buildLedger({
    workflow, runStartedMs, previous,
    readArtifact: (file) => {
      const path = `public-data/${file}`;
      if (!existsSync(path)) return null;
      try { return { payload: JSON.parse(readFileSync(path, 'utf8')) }; } catch { return null; }
    },
    // The workflow takes the marker a moment after checkout, so checked-out files are always older than it.
    wasWritten: (file, startedMs) => statSync(`public-data/${file}`).mtimeMs >= startedMs,
    headArtifact: (file) => {
      const bytes = headBytes(`public-data/${file}`);
      if (!bytes) return null;
      try { return { bytes, payload: JSON.parse(bytes.toString('utf8')) }; } catch { return null; }
    },
    writeArtifact: (file, bytes) => writeFileSync(`public-data/${file}`, bytes),
  });
  mkdirSync(dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 1)}\n`);
  const counts = Object.values(ledger.artifacts).reduce((acc, row) => ({ ...acc, [row.lastAttempt.status]: (acc[row.lastAttempt.status] || 0) + 1 }), {});
  const kept = Object.entries(ledger.artifacts).filter(([, row]) => row.lastAttempt.status === 'unchanged').map(([file]) => file);
  console.log(`[freshness] ${ledgerPath} ${JSON.stringify(counts)}${kept.length ? ` timestamp-only (kept published bytes): ${kept.join(', ')}` : ''}`);
}
