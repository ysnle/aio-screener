// Static-database expiry gate (R605/P1081).
// Hand-curated configuration (universe membership, theme constituents, official
// calendars, manual policy references) never refreshes itself. This gate fails
// when the declared review windows lapse so the data-refresh run is forced to
// review them on cadence instead of relying on memory.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const errors = [];
const warnings = [];
const check = (label, condition, detail = '') => { if (!condition) errors.push(label + (detail ? `: ${detail}` : '')); };
const warn = (label, condition, detail = '') => { if (!condition) warnings.push(label + (detail ? `: ${detail}` : '')); };

const nowMs = Date.now();
const ageDays = (iso) => {
  const ms = Date.parse(String(iso || ''));
  return Number.isFinite(ms) ? (nowMs - ms) / 86400000 : null;
};

const core = read('js/aio-core.js');
const index = read('index.html');
const universe = JSON.parse(read('public-data/screener-universe.json'));
const meta = universe.meta || {};

// S1: SCREENER_DB universe review window. staleAfterDays lapses to a warning
// (lineage already warns); replaceAfterDays lapses to a hard failure.
const lastBulk = meta.lastBulkUpdate || null;
const staleAfter = Number(meta.staleAfterDays ?? 30);
const replaceAfter = Number(meta.replaceAfterDays ?? 90);
const bulkAge = ageDays(lastBulk ? `${lastBulk}T00:00:00Z` : null);
check('static-db:universe-lastBulkUpdate-parseable', bulkAge != null, `lastBulkUpdate=${lastBulk}`);
if (bulkAge != null) {
  warn('static-db:universe-within-staleAfterDays', !(Number.isFinite(staleAfter) && bulkAge > staleAfter), `age=${bulkAge.toFixed(1)}d > staleAfterDays=${staleAfter} (R605: review membership)`);
  check('static-db:universe-within-replaceAfterDays', !(Number.isFinite(replaceAfter) && bulkAge > replaceAfter), `age=${bulkAge.toFixed(1)}d > replaceAfterDays=${replaceAfter} (R605: hard limit)`);
}

// S1 mirror: generated mirror must match the hand-curated source (R271).
check('static-db:universe-meta-present', typeof meta.source === 'string' && meta.source.length > 0, 'screener-universe.json meta.source missing');
check('static-db:universe-record-count', Number(meta.recordCount) >= 100, `recordCount=${meta.recordCount}`);

// S4: official calendar entries must not linger on a past meeting as next.
// Expired nextRelease auto-nulls at runtime, but the registry itself must be
// promoted (lastRelease advance) in the same data-refresh change.
const todayIso = new Date(nowMs).toISOString().slice(0, 10);
const calBlock = core.match(/window\.AIO_MACRO_CALENDAR = \{[\s\S]*?\n\};/)?.[0] || '';
const staleNext = [...calBlock.matchAll(/'([^']+)':\s*\{[^}]*?nextRelease:\s*'(\d{4}-\d{2}-\d{2})'/g)]
  .filter(([, , date]) => date < todayIso)
  .map(([full, key, date]) => `${key}=${date}`);
check('static-db:calendar-no-past-nextRelease', staleNext.length === 0, `past nextRelease still registered: ${staleNext.join(', ')} (R605: promote lastRelease after each release)`);

// Expired events: the freshness registry keeps decided events as historical
// context (getEventClaimState → historicalOnly), but entries past their claim
// window + 60d interest window must be explicitly removed by data-refresh —
// never silently auto-deleted (past decisions answer "what was decided?").
const eventRegistry = core.match(/window\.AIO_EVENT_FRESHNESS_REGISTRY = \{[\s\S]*?\n\};/)?.[0] || '';
const staleEvents = [...eventRegistry.matchAll(/(\w+):\s*\{[^}]*?eventDate:\s*'(\d{4}-\d{2}-\d{2})'[^}]*?maxClaimAgeDays:\s*(\d+)/g)]
  .map(([, id, date, maxAge]) => ({ id, ageDays: (nowMs - Date.parse(`${date}T00:00:00+09:00`)) / 86400000, maxAge: Number(maxAge) }))
  .filter((row) => Number.isFinite(row.ageDays) && row.ageDays > row.maxAge + 60)
  .map((row) => `${row.id}(${Math.floor(row.ageDays)}d > claim ${row.maxAge}d + 60d window)`);
check('static-db:events-beyond-interest-window-removed', staleEvents.length === 0, `expired events still registered: ${staleEvents.join(', ')} (R605: remove explicitly in data-refresh)`);

// S5: manual policy references must carry observation + publication + source.
for (const key of ['fedPolicy', 'bokPolicy', 'krInflation']) {
  const block = core.match(new RegExp(`${key}: Object\\.freeze\\(\\{[\\s\\S]*?\\}\\)`))?.[0] || '';
  check(`static-db:manual-ref-${key}-has-asOf`, /(asOf|observation|publishedAt):/.test(block), `${key} provenance missing`);
  check(`static-db:manual-ref-${key}-has-sourceUrl`, /sourceUrl:\s*'https?:\/\//.test(block), `${key} sourceUrl missing`);
}

// S3: theme map carries constituents only — no point-in-time figures (R604).
const themeBlock = index.match(/var KR_THEME_MAP = \{[\s\S]*?\n\};/)?.[0] || '';
check('static-db:theme-map-present', themeBlock.length > 0, 'KR_THEME_MAP block missing');
check('static-db:theme-map-no-market-cap-annotation', !/시총 ~[\d.]+조/.test(themeBlock), 'point-in-time market-cap annotation in KR_THEME_MAP (R604)');

if (warnings.length) {
  console.warn('Static-db expiry warnings:');
  warnings.forEach((warning) => console.warn(` - ${warning}`));
}
if (errors.length) {
  console.error('Static-db expiry check failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Static-db expiry OK: universe age=${bulkAge == null ? 'unknown' : bulkAge.toFixed(1) + 'd'}, past-nextRelease=${staleNext.length}, warnings=${warnings.length}.`);
