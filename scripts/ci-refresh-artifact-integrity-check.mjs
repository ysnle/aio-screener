import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const currentText = fs.readFileSync('public-data/data.json', 'utf8');
const current = JSON.parse(currentText);
const gitShow = (rev) => {
  try {
    return execFileSync('git', ['show', `${rev}:public-data/data.json`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (_) {
    return null;
  }
};
const normalise = (text) => text.replace(/\r\n/g, '\n');
// Before the refresh commit the working tree differs from HEAD, so HEAD is the
// last published artifact. After the commit (or locally) the tree equals HEAD,
// so the previous refresh is HEAD^. A shallow clone or first commit has no
// HEAD^; then there is no prior quality claim to compare against.
let previous = null;
let baseline = 'none';
const headText = gitShow('HEAD');
if (headText !== null && normalise(headText) !== normalise(currentText)) {
  previous = JSON.parse(headText);
  baseline = 'HEAD';
} else {
  const parentText = gitShow('HEAD^');
  if (parentText !== null) {
    previous = JSON.parse(parentText);
    baseline = 'HEAD^';
  }
}
const currentMeta = current.meta || {};
const previousMeta = previous?.meta || {};
// A cycle that kept last-known-good FRED values is explicit when the producer labelled it with its source. With the
// key present, fredFetchOk is true only when every expected series succeeded, so one failed series is a labelled
// partial cycle that still publishes (P1189); a key-present cycle in which no series succeeded is a total loss.
const fredSuccessfulCount = Array.isArray(currentMeta.fredSuccessfulSeries) ? currentMeta.fredSuccessfulSeries.length : null;
const fredFailedCount = Array.isArray(currentMeta.fredFailedSeries) ? currentMeta.fredFailedSeries.length : null;
const explicitFredLkgBoundary = currentMeta.fredFetchOk !== true
  && currentMeta.fredLkgUsed === true
  && typeof currentMeta.fredLkgSource === 'string'
  && currentMeta.fredLkgSource.length > 0
  && (currentMeta.fredHasKey !== true || fredSuccessfulCount > 0);
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
console.log(JSON.stringify({ ok: true, baseline, fred: { previous: previousMeta.fredFetchOk ?? null, current: currentMeta.fredFetchOk ?? null, lkg: currentMeta.fredLkgUsed === true, explicitLkgBoundary: explicitFredLkgBoundary, failed: fredFailedCount, expected: currentMeta.fredExpectedSeriesCount ?? null }, quotes: { previous: previousMeta.symbolsOk ?? null, current: currentMeta.symbolsOk ?? null } }));
