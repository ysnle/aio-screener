// Which code wrote public-data/today-verdict.json. The record v60.14 wrote (1/4/1) stood
// beside the v60.16 screen's 1/3/2 with nothing to say they came from different rules, and the Saturday 11/14 count change
// (2/3/1 → 1/4/1, no new session) was the v60.13–14 release, not an input. The producer stamps the record with this
// fingerprint and ci-metric-consistency-check compares it with the live code: a different stamp is a stale-model record
// (named, converges on the next refresh), the same stamp with a different verdict is a defect (same code, same inputs).
//
// The fingerprint is taken over the source text of the verdict's static import closure — the 시장 상태 rules
// (src/domain/briefing/market-read.js) and the producer's input assembly (src/domain/market/interpretation/inputs.js) —
// with line endings normalised, so nothing has to be bumped by hand and a Windows checkout stamps like CI.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { definitionFingerprint } from '../../src/domain/shared/definition-fingerprint.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VERDICT_MODEL_ENTRIES = Object.freeze(['src/domain/briefing/market-read.js', 'src/domain/market/interpretation/inputs.js']);
const IMPORT = /\b(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*['"](\.{1,2}\/[^'"]+)['"]/g;

/** The repo-relative files of the entries' static (relative) import closure, sorted. */
export function verdictModelFiles(root = ROOT, entries = VERDICT_MODEL_ENTRIES) {
  const seen = new Set();
  const visit = (rel) => {
    if (seen.has(rel)) return;
    const abs = path.join(root, rel);
    if (!existsSync(abs)) return;
    seen.add(rel);
    for (const match of readFileSync(abs, 'utf8').matchAll(IMPORT)) visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), match[1] || match[2])));
  };
  entries.forEach(visit);
  return [...seen].sort();
}

const VERDICT_FIELDS = Object.freeze(['asOf', 'overall', 'heroLine', 'counts']);
const verdictView = (row) => `${row?.asOf} ${row?.overall} ${['favorable', 'neutral', 'burden'].map((key) => row?.counts?.[key] ?? '-').join('/')} "${row?.heroLine || ''}"`;
/**
 * Pure: the published record against the live code's regime on the same inputs. 'stale-model' — written by other code
 * (named, converges on the next refresh); 'mismatch' — same model, different verdict (a defect); 'match'; 'missing'.
 * 'input-newer' — same model, different verdict, and an input artifact (`newerInputs`) was published after the record:
 * the record never saw that input, so it is not the same-inputs case. refresh-screener.yml runs this check with the new
 * screener.json in place while today-verdict.json is written only by refresh-data.yml; read as a mismatch, the screener
 * lane could not publish the breadth the verdict was waiting for (2026-11-17 21:33Z onward, five runs).
 */
export function verdictRecordStatus(record, regime, liveModel, { newerInputs = [] } = {}) {
  if (!record) return { status: 'missing', published: null, live: verdictView(regime) };
  const same = VERDICT_FIELDS.every((key) => JSON.stringify(record[key] ?? null) === JSON.stringify((key === 'heroLine' ? regime?.[key] || '' : regime?.[key]) ?? null));
  const status = record.model !== liveModel ? 'stale-model' : same ? 'match' : newerInputs.length ? 'input-newer' : 'mismatch';
  return { status, same, model: record.model || null, liveModel, newerInputs, published: verdictView(record), live: verdictView(regime) };
}

/** Input artifacts published after the record was written, by name ({ name: publishedAt }). */
export function inputsNewerThanRecord(record, publishedAtByInput = {}) {
  const written = Date.parse(record?.generatedAt || '');
  if (!Number.isFinite(written)) return [];
  return Object.entries(publishedAtByInput).filter(([, at]) => Date.parse(at || '') > written).map(([name]) => name);
}

/** `today-verdict:<16 hex>` over the closure's source text. */
export function verdictModelFingerprint(root = ROOT) {
  return definitionFingerprint('today-verdict', Object.fromEntries(verdictModelFiles(root).map((rel) => [rel, readFileSync(path.join(root, rel), 'utf8').replace(/\r\n?/g, '\n')])));
}
