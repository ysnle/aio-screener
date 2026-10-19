// v57.62: scripts/fetch-data.mjs was split into pure lib modules. Source-text gates that used to read
// the producer file alone read this concatenation instead, so an assertion keeps its meaning wherever
// the asserted code now lives. fetch-data.mjs comes first: position checks inside main() are unchanged.
import { readFileSync } from 'node:fs';

export const PRODUCER_SOURCE_FILES = Object.freeze([
  'scripts/fetch-data.mjs',
  // 2026-10-19 pipeline redesign: the producer's lanes moved to scripts/producer/* (fetch-data.mjs keeps the run order).
  'scripts/producer/paths.mjs',
  'scripts/producer/quotes.mjs',
  'scripts/producer/fred.mjs',
  'scripts/producer/kr-exchange.mjs',
  'scripts/producer/history.mjs',
  'scripts/producer/screener.mjs',
  'scripts/producer/screener-extended.mjs',
  'scripts/producer/screener-breadth.mjs',
  'scripts/producer/macro-history.mjs',
  'scripts/producer/market-narrative.mjs',
  'scripts/producer/source-planes.mjs',
  'scripts/producer/macro-merge.mjs',
  'scripts/producer/receipts.mjs',
  'scripts/producer/run-meta.mjs',
  'scripts/lib/producer-math.mjs',
  'scripts/lib/producer-http.mjs',
  'scripts/lib/macro-sources.mjs',
  'scripts/lib/news-selection.mjs',
  'scripts/lib/factors.mjs',
  'src/domain/screener/price-factors.js', // v57.81: the per-symbol factor math moved here (shared with the browser)
  'src/domain/fundamental/sec-row-fields.js', // v57.81: the per-symbol SEC row fields moved here (shared with the browser)
  'scripts/lib/market-analysis-validate.mjs',
  'scripts/lib/market-timeline.mjs' // 2026-10-19: six-hour KST market slots
]);

export function readProducerSource() {
  return PRODUCER_SOURCE_FILES.map((file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')).join('\n');
}
