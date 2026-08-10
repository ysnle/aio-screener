import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const readCurrent = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const current = readCurrent('public-data/data.json');
let previous = null;
try {
  previous = JSON.parse(execFileSync('git', ['show', 'HEAD^:public-data/data.json'], { encoding: 'utf8' }));
} catch (_) {
  // Initial history or a shallow checkout has no parent artifact; there is no
  // prior quality claim to compare against.
}
const currentMeta = current.meta || {};
const previousMeta = previous?.meta || {};
const explicitFredLkgBoundary = currentMeta.fredHasKey !== true
  && currentMeta.fredFetchOk !== true
  && currentMeta.fredLkgUsed === true
  && typeof currentMeta.fredLkgSource === 'string'
  && currentMeta.fredLkgSource.length > 0;
const degradedFred = previousMeta.fredFetchOk === true
  && currentMeta.fredFetchOk !== true
  && !explicitFredLkgBoundary;
const degradedQuote = Number(previousMeta.symbolsOk) >= 70 && Number(currentMeta.symbolsOk) < 70;
if (degradedFred) {
  console.error('refresh artifact integrity failed: FRED success regressed; an LKG payload may be consumed locally but cannot be committed as the new public cycle');
  process.exit(1);
}
if (degradedQuote) {
  console.error(`refresh artifact integrity failed: quote coverage regressed ${previousMeta.symbolsOk} -> ${currentMeta.symbolsOk}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, fred: { previous: previousMeta.fredFetchOk ?? null, current: currentMeta.fredFetchOk ?? null, lkg: currentMeta.fredLkgUsed === true, explicitLkgBoundary: explicitFredLkgBoundary }, quotes: { previous: previousMeta.symbolsOk ?? null, current: currentMeta.symbolsOk ?? null } }));
