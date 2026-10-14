// P1757: public-data/sec-fundamentals.json (~67 MB canonical SEC ledger) is producer-only. The browser reads the
// bounded projection (sec-fundamentals-summary.json + sec-fiscal-history.json); the ledger itself lives on the orphan
// `data-store` branch as one force-pushed commit (no history growth on main) and is restored at the start of each
// producer run by scripts/sec-fundamentals-store.mjs. Gates that need the full ledger read it through here and degrade
// to a labelled skip when a checkout does not carry it (CI restores it only when its digest matches main's manifest).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SEC_LEDGER_PATH = 'public-data/sec-fundamentals.json';
export const SEC_LEDGER_MANIFEST_PATH = 'public-data/sec-fundamentals-summary.manifest.json';
export const SEC_LEDGER_SUMMARY_PATH = 'public-data/sec-fundamentals-summary.json';
export const SEC_STORE_BRANCH = 'data-store';
export const SEC_STORE_FILE = 'sec-fundamentals.json';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const repoPath = (file) => `${ROOT}${file}`;

// Same digest the projection manifest records (CRLF-normalized, so a Windows checkout and a runner agree).
export const canonicalText = (value) => String(value).replace(/\r\n?/g, '\n');
export const canonicalSha256 = (value) => createHash('sha256').update(canonicalText(value)).digest('hex');

const manifestSourceSha256 = () => {
  try { return JSON.parse(readFileSync(repoPath(SEC_LEDGER_MANIFEST_PATH), 'utf8')).sourceSha256 || null; } catch { return null; }
};

// A local copy is only the canonical source when its digest is the one the committed manifest records. A git-ignored
// leftover from an earlier download describes a different projection, so it counts as absent (labelled stale), the
// same rule `restore --match-manifest` applies in CI. The producer path writes the manifest from the ledger it just
// produced, so a fresh ledger always matches and stays fully checked.
export function readSecLedger() {
  const path = repoPath(SEC_LEDGER_PATH);
  if (!existsSync(path)) return { present: false, path };
  const text = readFileSync(path, 'utf8');
  const digest = canonicalSha256(text);
  const expected = manifestSourceSha256();
  if (expected && digest !== expected) return { present: false, stale: true, path, digest, expected };
  return { present: true, path, text, data: JSON.parse(text) };
}

export function secLedgerSkipNote(gate, what, ledger = null) {
  if (ledger?.stale) {
    return `[${gate}] P1757 SKIP ${what}: stale local ledger ${SEC_LEDGER_PATH} (sha256 ${ledger.digest.slice(0, 12)}...) does not match `
      + `${SEC_LEDGER_MANIFEST_PATH} sourceSha256 ${ledger.expected.slice(0, 12)}..., so it is ignored; `
      + 'run `node scripts/sec-fundamentals-store.mjs restore --match-manifest` to fetch the matching copy.';
  }
  return `[${gate}] P1757 SKIP ${what}: ${SEC_LEDGER_PATH} is producer-only (branch ${SEC_STORE_BRANCH}) and absent from this checkout; `
    + 'restore it with `node scripts/sec-fundamentals-store.mjs restore` to run the full-ledger checks.';
}
