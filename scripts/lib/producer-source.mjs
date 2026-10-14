// v57.62: scripts/fetch-data.mjs was split into pure lib modules. Source-text gates that used to read
// the producer file alone read this concatenation instead, so an assertion keeps its meaning wherever
// the asserted code now lives. fetch-data.mjs comes first: position checks inside main() are unchanged.
import { readFileSync } from 'node:fs';

export const PRODUCER_SOURCE_FILES = Object.freeze([
  'scripts/fetch-data.mjs',
  'scripts/lib/producer-math.mjs',
  'scripts/lib/producer-http.mjs',
  'scripts/lib/macro-sources.mjs',
  'scripts/lib/news-selection.mjs',
  'scripts/lib/factors.mjs',
  'scripts/lib/market-analysis-validate.mjs'
]);

export function readProducerSource() {
  return PRODUCER_SOURCE_FILES.map((file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')).join('\n');
}
