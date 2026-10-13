#!/usr/bin/env node
// P1734: automated official-reference lane, run by refresh-data.yml every cycle.
// It replaced the operator-captured WebSearch snapshot (CHECKED_AT 2026-08-21) that wrote frozen
// NAAIM / Korea-export values into data.json and could only be refreshed by a person. The lane now
// writes public-data/official-references.json only; data.json marketSurveys (AAII) stays owned by
// fetch-data.mjs and structural-data-research.json is left untouched.
// Each item calls the shared Worker's hosted search only when due (release passed, backoff, or idle
// recheck; at most once per KST day per item, bounded by a monthly lane cap), and publishes a value only
// after scripts/lib/web-reference-verify.mjs finds it on the official page itself.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile, atomicWriteJsonSync } from './lib/atomic-write.mjs';
import { refreshOfficialReferences, validateOfficialReferences } from './lib/web-reference-verify.mjs';

const OUT_PATH = fileURLToPath(new URL('../public-data/official-references.json', import.meta.url));
// Call ledger outside public-data (gitignored .cache/), carried between runs by actions/cache in refresh-data.yml,
// so calls from runs whose data commit never landed still count toward the daily/monthly caps.
const LEDGER_PATH = fileURLToPath(new URL('../.cache/official-references/ledger.json', import.meta.url));

async function main() {
  let previous = null;
  let ledger = null;
  try { previous = JSON.parse(await readFile(OUT_PATH, 'utf8')); } catch { previous = null; }
  try { ledger = JSON.parse(await readFile(LEDGER_PATH, 'utf8')); } catch { ledger = null; }
  const now = Date.now();
  const persistLedger = (value) => atomicWriteJsonSync(LEDGER_PATH, value);
  const result = await refreshOfficialReferences({ previous, ledger, persistLedger, now });
  const { artifact, write, decisions } = result;
  persistLedger(result.ledger);
  const problems = validateOfficialReferences(artifact, { now });
  if (problems.length) {
    // Fail closed: never publish an artifact the contract gate would reject; the previous file stays.
    console.error(`[official-references] contract problems, artifact not written: ${problems.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  if (write) await atomicWriteFile(OUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, written: write, checkedAt: artifact.checkedAt, lane: artifact.lane, decisions,
    statuses: Object.fromEntries(Object.entries(artifact.items).map(([id, item]) => [id, item.status])) }));
}

await main();
