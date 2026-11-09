// ADR-0003 S2 (data boundary): where every public-data artifact the browser reads lives, and how it is loaded.
// Before this table the same location and load budget were written in each reader — 60 './public-data/' strings in
// src/ui, src/domain and src/ai, the earnings calendar descriptor twice (src/data/event-artifacts.js and
// src/ui/components/theme-playbook-view.js, same key) — so a renamed file or a tighter byte budget had to be found by
// grep. Now a screen names an artifact by its file id (the path under public-data/, the same id the freshness registry
// src/data/contracts/artifact-freshness.js keys by) and the data layer owns the URL, the fetch, the cache and the budget.
//
//   artifactUrl(id)                    './public-data/<id>'; a malformed id throws, CI checks each literal id exists
//   loadArtifact(root, id, options)    loadJsonArtifact through the root's stable fetch, with the entry's budget
//   loadArtifactUrl(root, url, opts)   the same for a URL an artifact itself declares (a manifest row, a shard)
//   <NAME> descriptors                 { key, url, schemas, maxAgeMs, maxBytes }: refreshSharedArtifact(root, D) keeps
//                                      the payload on root[D.key] for every screen that joins on it
//
// Each entry keeps the reader's previous values exactly (maxAgeMs is the browser cache age, not the freshness grade:
// the grade comes from the producer ledger). scripts/ci-artifact-refresh-path-check.mjs reads the 'public-data/<file>'
// strings below as the runtime reader list, so every path stays written out here.
import { loadJsonArtifact, stableFetcher } from './artifact-cache.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const KB = 1024;
const MB = 1024 * KB;

const PREFIX = './public-data/';
const at = (url, options = {}) => Object.freeze({ url, ...options });
// A shared descriptor; the schema defaults to '<file name>.v1' and maxBytes is left out when 0.
const shared = (id, key, maxAgeMs, maxBytes = 0, schemas = `${id.slice(0, -5)}.v1`) =>
  at(PREFIX + id, { key, schemas: [].concat(schemas), maxAgeMs, ...(maxBytes ? { maxBytes } : {}) });

/** Shared copies: refreshSharedArtifact(root, D) keeps the payload on root[D.key] for every screen that joins on it. */
export const STRESS_OUTCOMES = shared('stress-outcomes.json', '_aioStressOutcomes', 12 * HOUR, 256 * KB);
export const SCENARIO_OUTCOMES = shared('scenario-outcomes.json', '_aioScenarioOutcomes', 12 * HOUR, 256 * KB); // weekly long-history analogs
export const SCENARIO_STATE = shared('scenario-state.json', '_aioScenarioState', 30 * MIN, 1 * MB); // per-refresh branch/theme state
export const MARKET_TEMPERATURE = shared('market-temperature.json', '_aioMarketTemperature', HOUR, 256 * KB); // per-market price temperature
export const BIGTECH_CASHFLOW = shared('bigtech-cashflow.json', '_aioBigtechCashflow', 6 * HOUR, 256 * KB); // SEC quarterly cash flow
export const TREASURY_AUCTIONS = shared('treasury-auctions.json', '_aioTreasuryAuctions', 6 * HOUR, 256 * KB); // TreasuryDirect results
export const MARKET_DAY = shared('market-day.json', '_aioMarketDay', 30 * MIN, 512 * KB); // build-market-day
export const ROTATION_DETAIL = shared('rotation-detail.json', '_aioRotationDetail', 30 * MIN, 1 * MB); // the rotationHistory series
export const MACRO_HISTORY = shared('macro-history.json', '_aioMacroHistory', HOUR);
export const BREADTH_CONTRIBUTORS = shared('breadth-contributors.json', '_aioBreadthContributors', 30 * MIN, 1 * MB, ['breadth-contributors.v1', 'breadth-contributors.v2']);
export const KR_INDEX_WEIGHTS = shared('kr-index-weights.json', '_aioKrIndexWeights', HOUR, 64 * KB); // KOSPI/KOSDAQ top-name weight proxies
export const EVENT_BRIEFS = shared('event-briefs.json', '_aioEventBriefs', 20 * MIN, 1 * MB); // FOMC and mover earnings briefs
// The provider earnings calendar (week rows + the six-week `upcoming` map): the company summary, the chart coach,
// 테마 detail and 시장 상태's week-ahead list.
export const EARNINGS_CALENDAR = shared('earnings-calendar.json', '_aioEarningsCalendarArtifact', 6 * HOUR, 512 * KB);
export const TW_MONTHLY_REVENUE = shared('tw-monthly-revenue.json', '_aioTwMonthlyRevenue', 6 * HOUR, 256 * KB);
export const KR_FUNDAMENTALS = shared('kr-fundamentals.json', '_aioKrFundamentals', 12 * HOUR, 1 * MB); // OpenDART
export const KR_INVESTOR_FLOWS = shared('kr-investor-flows.json', '_aioKrInvestorFlows', 3 * HOUR, 256 * KB);
export const MACRO_CALENDAR = shared('macro-calendar.json', '_aioMacroCalendar', 6 * HOUR, 256 * KB);
export const CONSENSUS_ESTIMATES = shared('consensus-estimates.json', '_aioConsensusEstimates', 6 * HOUR, 1 * MB);
export const COMPANY_PROFILE_INDEX = shared('company-profiles/index.json', '_aioCompanyProfileIndex', 12 * HOUR, 256 * KB, 'company-profiles-index.v1');

const SHARED = [STRESS_OUTCOMES, SCENARIO_OUTCOMES, SCENARIO_STATE, MARKET_TEMPERATURE, BIGTECH_CASHFLOW, TREASURY_AUCTIONS, MARKET_DAY,
  ROTATION_DETAIL, MACRO_HISTORY, BREADTH_CONTRIBUTORS, KR_INDEX_WEIGHTS, EVENT_BRIEFS, EARNINGS_CALENDAR, TW_MONTHLY_REVENUE,
  KR_FUNDAMENTALS, KR_INVESTOR_FLOWS, MACRO_CALENDAR, CONSENSUS_ESTIMATES, COMPANY_PROFILE_INDEX];

// Read directly (loadArtifact or a data-layer provider) with the readers' previous load budgets, unchanged. Any other
// id loads with loadJsonArtifact's defaults. The ids are not listed here because this module is in the boot set
// (architecture/boot-budget.json): scripts/ci-data-boundary-fixture.mjs checks that every literal id a reader passes
// (artifactUrl / loadArtifact) names a file in public-data/, and ci-artifact-refresh-path-check reads the same calls.
const BUDGETS = {
  'sec-fundamentals-summary.manifest.json': { maxAgeMs: 6 * HOUR, maxBytes: 64 * KB },
  'sec-fiscal-history.json': { maxAgeMs: 6 * HOUR, maxBytes: 1 * MB },
  'sp500-weights.json': { maxAgeMs: 6 * HOUR, maxBytes: 512 * KB },
  'company-profiles/graph.json': { maxBytes: 512 * KB },
  'backtest-history.json': { maxAgeMs: HOUR, maxBytes: 2 * MB },
  'model-validation-status.json': { maxAgeMs: HOUR, maxBytes: 256 * KB },
  'factor-backtest-longrun.json': { maxAgeMs: 6 * HOUR, maxBytes: 2 * MB },
  'screener-candidate-archive.json': { maxAgeMs: HOUR, maxBytes: 2 * MB },
  'screener-validation-gate.json': { maxAgeMs: 6 * HOUR, maxBytes: 64 * KB },
  'masters/ticker-index-reference.json': { timeoutMs: 8000 },
};

const idOf = (url) => url.slice(PREFIX.length);
/** Artifacts with a descriptor or a load budget, by file id (path under public-data/). */
export const ARTIFACTS = Object.freeze(Object.fromEntries([
  ...SHARED.map((entry) => [idOf(entry.url), entry]),
  ...Object.entries(BUDGETS).map(([id, budget]) => [id, at(PREFIX + id, budget)]),
]));

// A file id: lower-case path segments under public-data/, ending in .json; no '..', no leading slash, no query.
const ID = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9.-]*)*\.json$/;

/** Artifact families whose file name is data (a lesson id, a profile file); the folder is registered here. */
const FAMILIES = Object.freeze({
  'knowledge-article': (collection, id) => `${PREFIX}knowledge/articles/${collection}/${encodeURIComponent(id)}.json`,
  'company-profile': (file) => `${PREFIX}company-profiles/${encodeURIComponent(file)}`,
  ledger: (path) => `./${path}`, // freshnessLedgerPath() already starts at public-data/
});

export function artifactEntry(id) {
  const entry = ARTIFACTS[id];
  if (entry) return entry;
  if (!ID.test(String(id)) || String(id).includes('..')) throw new Error(`not an artifact id: ${id}`);
  return at(PREFIX + id);
}

export const artifactUrl = (id) => artifactEntry(id).url;

export function artifactFamilyUrl(family, ...parts) {
  const build = FAMILIES[family];
  if (!build) throw new Error(`artifact family not registered: ${family}`);
  return build(...parts);
}

const budgetOf = ({ maxAgeMs, maxBytes, timeoutMs }) => Object.fromEntries(Object.entries({ maxAgeMs, maxBytes, timeoutMs }).filter(([, value]) => value != null));

/** The root's one bound fetch, for loaders that take a fetch function (the knowledge capability loader). */
export const artifactFetcher = (root) => stableFetcher(root || globalThis);

/** loadJsonArtifact for a URL an artifact declares; the screen never handles the fetch function. */
export function loadArtifactUrl(root, url, options = {}) {
  return loadJsonArtifact(stableFetcher(root || globalThis), url, options);
}

/** A registered artifact with its budget; caller options (signal, force, a different budget) win. */
export function loadArtifact(root, id, options = {}) {
  const entry = artifactEntry(id);
  return loadArtifactUrl(root, entry.url, { ...budgetOf(entry), ...options });
}
