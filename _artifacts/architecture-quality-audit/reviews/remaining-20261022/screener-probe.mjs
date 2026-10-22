// Audit-only: pinned pure ESM, synthetic inputs, no producers/browser/paid AI.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const root = process.cwd();
const output = path.join(root, '_artifacts/architecture-quality-audit/reviews/remaining-20261022');
const temp = path.join(root, '.cache/audit-remaining-20261022/pinned-screener');
fs.mkdirSync(temp, { recursive: true });
fs.writeFileSync(path.join(temp, 'package.json'), '{"type":"module"}\n');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const dependencies = new Map();
function pin(relative) {
  if (dependencies.has(relative)) return;
  const bytes = execFileSync('git', ['show', `${ref}:${relative}`], { maxBuffer: 8 * 1024 * 1024 });
  dependencies.set(relative, { path: relative, fixedSha256: sha(bytes), currentSha256: sha(fs.readFileSync(path.join(root, relative))) });
  const dest = path.join(temp, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  for (const match of bytes.toString('utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    pin(path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1])));
  }
}
const files = ['src/domain/screener/screen-engine.js', 'src/data/contracts/screener.js', 'src/domain/screener/factor-overlap.js', 'src/data/normalize/screener.js', 'src/domain/fundamental/consensus-read.js', 'src/domain/screener/custom-conditions.js', 'src/domain/screener/conditional-evidence.js'];
files.forEach(pin);
globalThis.fetch = () => { throw new Error('AUDIT_NETWORK_FORBIDDEN'); };
const load = name => import(pathToFileURL(path.join(temp, name)));
const { runScreen } = await load(files[0]);
const { createScreenDefinition } = await load(files[1]);
const { measureFactorOverlap, overlapSentence } = await load(files[2]);
const { normalizeScreener } = await load(files[3]);
const { consensusView } = await load(files[4]);
const { parseConditionText, matchesConditions } = await load(files[5]);
const { evaluateConditionalEvidence } = await load(files[6]);
const range = { type: 'range', field: 'price.close', min: 50 };
const define = filtersAST => createScreenDefinition({ name: 'Audit fixture', filtersAST, ranking: { field: 'rank', direction: 'asc' } });
const run = (definition, price) => runScreen({ definition, rows: [{ symbol: 'AUDIT', price, rank: 1 }], snapshotId: 'fixed-observation' });
const low = run(define({ type: 'not', child: range }), 40), high = run(define({ type: 'not', child: range }), 60);
const directLow = run(define(range), 40), directHigh = run(define(range), 60);
const unreferencedLow = run(define({ type: 'range', field: 'rank', min: 0 }), 40), unreferencedHigh = run(define({ type: 'range', field: 'rank', min: 0 }), 60);
const constant = measureFactorOverlap(Array.from({ length: 30 }, () => ({ _z_momentum: 0, _z_trend: 0 })), ['momentum', 'trend']);
const varying = measureFactorOverlap(Array.from({ length: 30 }, (_, i) => ({ _z_momentum: i, _z_trend: i })), ['momentum', 'trend']);
const mixed = measureFactorOverlap(Array.from({ length: 30 }, (_, i) => ({ _z_momentum: 0, _z_trend: i })), ['momentum', 'trend']);
const row = { symbol: 'AUDIT', _valuationPrice: 100, factorSessionDate: '2026-10-16' };
const estimate = { asOf: '2026-10-16', fwd: { eps: 5 }, trailing: { eps: -1 } };
const options = { now: Date.parse('2026-10-17T00:00:00Z') };
const normalizeView = row => consensusView(normalizeScreener({ rows: [row] }).rows[0], estimate, options);
const parseCases = ['PER 20 이하 또는 ROE 15% 이상', 'PER 20 이하 ROE 15% 이상', 'PER 20 미만', 'ROE 15% 초과', 'PER 20 이상'];
const parsed = parseCases.map(text => {
  const result = parseConditionText(text);
  return { text, ...result, rowPe10Roe5Passes: matchesConditions({ pe: 10, roe: 5 }, result.conditions, (r, key) => r[key]), rowPe20Roe15Passes: matchesConditions({ pe: 20, roe: 15 }, result.conditions, (r, key) => r[key]) };
});
// Deliberately duplicate one valid historical observation: admission/aggregation boundary,
// not a claim that this dormant evaluator is called by a live product surface.
const observation = { sessionId: '2026-10-01', symbol: 'AUDIT', eligible: true, success: true, value: 1,
  sourceId: 'audit', sourceKind: 'OWNED', rightsId: 'audit', rightsStatus: 'OWNED', calendarId: 'audit', calendarStatus: 'VERIFIED',
  observedAt: '2026-10-01T20:00:00Z', availableAt: '2026-10-01T20:01:00Z', fetchedAt: '2026-10-01T20:02:00Z',
  revisionId: '1', watermark: '1', timezone: 'America/New_York' };
const evidence = observations => evaluateConditionalEvidence({ observations, now: options.now });
const duplicate = evidence(Array.from({ length: 30 }, () => ({ ...observation })));
const single = evidence([observation]);
const result = { observedAt: new Date().toISOString(), fixedRef: ref, boundary: 'Pinned pure-module execution with synthetic inputs only. Dependency traversal/copy is not full semantic reading. No browser/live/provider/paid AI.',
  notIdentity: { before: low.rows[0].screenStatus, after: high.rows[0].screenStatus, sameCalculationInputId: low.run.calculationInputId === high.run.calculationInputId, resultChanged: low.resultHash !== high.resultHash,
    directPriceControlChangesId: directLow.run.calculationInputId !== directHigh.run.calculationInputId, unreferencedPriceControlKeepsId: unreferencedLow.run.calculationInputId === unreferencedHigh.run.calculationInputId },
  overlap: { constant, constantSentence: overlapSentence(constant), identicalVaryingControl: varying, mixed },
  valuation: { before: consensusView(row, estimate, options), after: normalizeView(row), peFallbackControl: normalizeView({ ...row, _valuationPePrice: 100 }), missingPriceControl: consensusView({ symbol: 'AUDIT', factorSessionDate: row.factorSessionDate }, estimate, options) },
  parseCases: parsed,
  dormantConditionalEvidence: { duplicate: { status: duplicate.status, sample: duplicate.sample, lineage: duplicate.lineage, distribution: duplicate.distribution }, singleControl: { status: single.status, sample: single.sample } },
  dependencies: [...dependencies.values()] };
fs.writeFileSync(path.join(output, 'screener-probe-result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, dependencies: { count: dependencies.size, currentDrift: [...dependencies.values()].filter(r => r.currentSha256 !== r.fixedSha256) } }, null, 2));
