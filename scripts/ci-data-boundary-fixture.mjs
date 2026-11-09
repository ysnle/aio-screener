#!/usr/bin/env node
// scripts/ci-data-boundary-fixture.mjs — v59.87 (ADR-0003 S2+S3)
//
// Pins the data-boundary move: every artifact location and load budget now lives in src/data/artifact-registry.js, and
// the session-lag rule is one function (src/domain/market/session/market-calendar.js sessionLagGrade / latestCompletedSession).
// The values below were captured on fed62e1, before the move, from the old owners (shared-artifacts.js,
// event-artifacts.js, theme-playbook-view.js, the three domain read models; artifact-freshness.js' own 12-hour grace;
// the eight `market === 'KR' ? latestCompletedKrSession : latestCompletedUsSession` branches; the 13F and market
// temperature rules in their UI files). A difference means the move changed what a screen loads or how it grades.
//   descriptors  key, url, schemas, maxAgeMs, maxBytes of every shared descriptor, field for field
//   session      525 instants (KR Chuseok 2026-09/10, US Thanksgiving and year end 2026) x 2 markets x 16 session days:
//                isSessionCurrent, sessionLagState, factorSessionLag, usSessionPending, latest completed sessions and a
//                ledger freshnessState — compared as one SHA-256 of the whole table
//   thirteenF    4 quarter ends x 102 days; temperature 53 instants of staleMarketIds
// Also: a malformed id throws, urls are unique, and every id the code names (registry entries and literal
// artifactUrl/loadArtifact ids in src/) exists in public-data/ unless the freshness registry marks it blocked
// (kr-fundamentals.json waits on DART_API_KEY).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { artifactIdLiterals } from './lib/artifact-id-literals.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => import(pathToFileURL(join(root, path)).href);
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const registry = await load('src/data/artifact-registry.js');
const cal = await load('src/domain/market/session/market-calendar.js');
const fr = await load('src/data/contracts/artifact-freshness.js');
const lag = await load('src/ui/components/session-lag.js');
const rp = await load('src/domain/screener/row-presentation.js');
const temperature = await load('src/domain/market/sentiment/market-temperature.js');
const filing = await load('src/domain/masters/filing-deadline.js');

const H = 3600000, KB = 1024, MB = 1024 * KB;
const PINNED_DESCRIPTORS = {
  STRESS_OUTCOMES: ['_aioStressOutcomes', 'stress-outcomes.json', ['stress-outcomes.v1'], 12 * H, 256 * KB],
  SCENARIO_OUTCOMES: ['_aioScenarioOutcomes', 'scenario-outcomes.json', ['scenario-outcomes.v1'], 12 * H, 256 * KB],
  SCENARIO_STATE: ['_aioScenarioState', 'scenario-state.json', ['scenario-state.v1'], 0.5 * H, MB],
  MARKET_TEMPERATURE: ['_aioMarketTemperature', 'market-temperature.json', ['market-temperature.v1'], H, 256 * KB],
  BIGTECH_CASHFLOW: ['_aioBigtechCashflow', 'bigtech-cashflow.json', ['bigtech-cashflow.v1'], 6 * H, 256 * KB],
  TREASURY_AUCTIONS: ['_aioTreasuryAuctions', 'treasury-auctions.json', ['treasury-auctions.v1'], 6 * H, 256 * KB],
  MARKET_DAY: ['_aioMarketDay', 'market-day.json', ['market-day.v1'], 0.5 * H, 512 * KB],
  ROTATION_DETAIL: ['_aioRotationDetail', 'rotation-detail.json', ['rotation-detail.v1'], 0.5 * H, MB],
  MACRO_HISTORY: ['_aioMacroHistory', 'macro-history.json', ['macro-history.v1'], H, undefined],
  BREADTH_CONTRIBUTORS: ['_aioBreadthContributors', 'breadth-contributors.json', ['breadth-contributors.v1', 'breadth-contributors.v2'], 0.5 * H, MB],
  KR_INDEX_WEIGHTS: ['_aioKrIndexWeights', 'kr-index-weights.json', ['kr-index-weights.v1'], H, 64 * KB],
  EVENT_BRIEFS: ['_aioEventBriefs', 'event-briefs.json', ['event-briefs.v1'], H / 3, MB],
  EARNINGS_CALENDAR: ['_aioEarningsCalendarArtifact', 'earnings-calendar.json', ['earnings-calendar.v1'], 6 * H, 512 * KB],
  TW_MONTHLY_REVENUE: ['_aioTwMonthlyRevenue', 'tw-monthly-revenue.json', ['tw-monthly-revenue.v1'], 6 * H, 256 * KB],
  KR_FUNDAMENTALS: ['_aioKrFundamentals', 'kr-fundamentals.json', ['kr-fundamentals.v1'], 12 * H, MB],
  KR_INVESTOR_FLOWS: ['_aioKrInvestorFlows', 'kr-investor-flows.json', ['kr-investor-flows.v1'], 3 * H, 256 * KB],
  MACRO_CALENDAR: ['_aioMacroCalendar', 'macro-calendar.json', ['macro-calendar.v1'], 6 * H, 256 * KB],
  CONSENSUS_ESTIMATES: ['_aioConsensusEstimates', 'consensus-estimates.json', ['consensus-estimates.v1'], 6 * H, MB],
  COMPANY_PROFILE_INDEX: ['_aioCompanyProfileIndex', 'company-profiles/index.json', ['company-profiles-index.v1'], 12 * H, 256 * KB],
};
for (const [name, [key, file, schemas, maxAgeMs, maxBytes]] of Object.entries(PINNED_DESCRIPTORS)) {
  const d = registry[name];
  const want = { key, url: `./public-data/${file}`, schemas, maxAgeMs, ...(maxBytes == null ? {} : { maxBytes }) };
  check(`v59.87 ${name} keeps its pre-move descriptor`, JSON.stringify(d && Object.fromEntries(Object.entries(d).sort())) === JSON.stringify(Object.fromEntries(Object.entries(want).sort())), JSON.stringify(d));
  check(`v59.87 ${name} is the registry entry for ${file}`, registry.ARTIFACTS[file] === d);
}

// Session and freshness grades (generator identical to the capture on fed62e1).
const times = [];
for (let t = Date.parse('2026-09-22T00:00:00Z'); t < Date.parse('2026-10-11T00:00:00Z'); t += 3 * H) times.push(t);
for (let t = Date.parse('2026-11-20T00:00:00Z'); t < Date.parse('2027-01-05T00:00:00Z'); t += 3 * H) times.push(t);
times.push(Date.parse('2026-11-25T21:05:00Z'), Date.parse('2026-11-27T18:30:00Z'), Date.parse('2026-12-24T18:05:00Z'), Date.parse('2026-11-30T06:35:00Z'), Date.parse('2026-11-30T06:55:00Z'));
const days = ['2026-09-21', '2026-09-24', '2026-10-02', '2026-10-08', '2026-11-19', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-04', '2026-12-23', '2026-12-24', '2026-12-28', '2026-12-31'];
const session = times.map((now) => {
  const row = { now, us: cal.latestCompletedUsSession(now, { requirePrevious: false })?.date ?? null, usReq: cal.latestCompletedUsSession(now)?.date ?? null, kr: cal.latestCompletedKrSession(now)?.date ?? null, cases: [] };
  for (const market of ['US', 'KR']) for (const day of days) {
    row.cases.push([market, day,
      cal.isSessionCurrent({ market, sessionDate: day, now }),
      fr.sessionLagState({ basisSession: { [market]: day } }, now)?.state ?? null,
      rp.factorSessionLag(market, day, now)?.latest ?? null,
      market === 'US' ? lag.usSessionPending(day, now) : null,
    ]);
  }
  row.fresh = fr.freshnessState({ checkedAt: new Date(now - 40 * 60000).toISOString(), expectedEveryMinutes: 30, staleAfterMinutes: 720, basisSession: { US: '2026-11-25', KR: '2026-11-27' } }, now);
  return row;
});
check('v59.87 session/freshness grades are unchanged by the single sessionLagGrade', hash(session) === 'cbd4ca6995bb4189f5401c5c8754d730b051d031b904ab537c0424b94ea7c076', hash(session));
for (const row of session) for (const market of ['US', 'KR']) {
  const one = cal.latestCompletedSession(market, row.now)?.date ?? null;
  if (one !== (market === 'KR' ? row.kr : row.us)) { check(`v59.87 latestCompletedSession(${market}) equals the branch it replaced`, false, new Date(row.now).toISOString()); break; }
}

const thirteenF = [];
for (const period of ['2026-03-31', '2026-06-30', '2026-09-30', '2025-12-31']) for (let t = Date.parse('2026-05-01T00:00:00Z'); t < Date.parse('2027-03-01T00:00:00Z'); t += 86400000 * 3) thirteenF.push([period, t, filing.thirteenFStale(period, t)]);
check('v59.87 thirteenFStale (moved to domain/masters/filing-deadline.js) is unchanged', hash(thirteenF) === '5481582e7d074b61f666a77278f38af41eabdda03bea7ce355990ea4150dd6bb', hash(thirteenF));
const tempPayload = { generatedAt: '2026-11-20T00:00:00Z', retained: ['jp'] };
const tempMarkets = [{ id: 'us', asOf: '2026-11-19' }, { id: 'kr', asOf: '2026-11-11' }, { id: 'jp', asOf: '2026-11-19' }, { id: 'tw', asOf: '2026-11-05' }];
const temp = [];
for (let t = Date.parse('2026-11-19T00:00:00Z'); t < Date.parse('2026-12-02T00:00:00Z'); t += 6 * H) temp.push([t, [...temperature.staleMarketIds(tempPayload, tempMarkets, t)].sort()]);
temp.push(['no-gen', [...temperature.staleMarketIds({}, tempMarkets, Date.parse('2026-11-20T00:00:00Z'))].sort()]);
check('v59.87 staleMarketIds (moved to domain/market/sentiment/market-temperature.js) is unchanged', hash(temp) === '09697a06403bb5a705d44a114300662c19e338be3309f2d45b7eb244d09d890b', hash(temp));

// The grade itself, case by case.
const grade = (lagN, sinceMs, policy) => cal.sessionLagGrade({ lag: lagN, sinceLatestCloseMs: sinceMs }, policy);
check('v59.87 sessionLagGrade: lag 0 current, one behind inside 12 h current, after 12 h late, two behind stale, invalid, unknown',
  grade(0, null) === 'current' && grade(1, 11 * H) === 'current' && grade(1, 13 * H) === 'late' && grade(1, null) === 'late' && grade(2, H) === 'stale'
  && cal.sessionLagGrade({ status: 'invalid' }) === 'invalid' && cal.sessionLagGrade(null) === null && grade(2, H, { maxLag: 2, graceMs: 2 * H }) === 'current');

// Registry contract.
const throws = (id) => { try { registry.artifactUrl(id); return false; } catch { return true; } };
check('v59.87 a malformed artifact id throws instead of fetching outside public-data/',
  ['../data.json', '/data.json', 'Data.json', 'data.json?t=1', 'atlas/../x.json', 'data'].every(throws) && !throws('atlas/foundations.json'));
const urls = Object.values(registry.ARTIFACTS).map((entry) => entry.url);
check('v59.87 registry urls are unique', new Set(urls).size === urls.length);
// Every id the code names — registry descriptors and budgets, and each literal artifactUrl/loadArtifact id in src/ — is a
// published file (the registry lists only budgets, so a typo is caught here instead of at runtime).
const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(`${dir}/${entry.name}`) : entry.name.endsWith('.js') ? [`${dir}/${entry.name}`] : []));
const named = new Map(Object.keys(registry.ARTIFACTS).map((id) => [id, 'src/data/artifact-registry.js']));
for (const file of walk('src')) for (const id of artifactIdLiterals(readFileSync(join(root, file), 'utf8'))) if (!named.has(id)) named.set(id, file);
check('v59.87 the literal id scan finds the screens\' artifacts', ['atlas/foundations.json', 'backtest-history.json', 'knowledge/search-index.json', 'data.json'].every((id) => named.has(id)), [...named.keys()].join(' '));
for (const [id, file] of named) {
  if (!existsSync(join(root, 'public-data', id)) && !fr.ARTIFACT_FRESHNESS[id]?.blockedBy) check(`v59.87 artifact id names a published file: public-data/${id} (${file})`, false);
}
check('v59.87 article and profile families keep their published paths',
  registry.artifactFamilyUrl('knowledge-article', 'principles', 'a b') === './public-data/knowledge/articles/principles/a%20b.json'
  && registry.artifactFamilyUrl('company-profile', 'NVDA.json') === './public-data/company-profiles/NVDA.json'
  && registry.artifactFamilyUrl('ledger', fr.freshnessLedgerPath('refresh-data.yml')) === './public-data/freshness/refresh-data.json');

// loadArtifact applies the registry budget and lets the caller's options win.
const seen = [];
const fakeRoot = { fetch: async (url) => { seen.push(url); return { ok: true, headers: { get: () => '10' }, text: async () => '{"ok":1}', json: async () => ({ ok: 1 }) }; } };
const loaded = await registry.loadArtifact(fakeRoot, 'sp500-weights.json');
check('v59.87 loadArtifact reads the registered url through the root fetch', loaded?.ok === 1 && seen[0] === './public-data/sp500-weights.json', JSON.stringify(seen));

if (failures.length) {
  console.error(`FAIL data-boundary fixture (${failures.length})\n${failures.map((line) => `  - ${line}`).join('\n')}`);
  process.exit(1);
}
console.log(`Data boundary fixture OK: ${Object.keys(PINNED_DESCRIPTORS).length} descriptors, ${named.size} artifact ids on disk, ${session.length} instants of session grades, 13F and temperature rules unchanged.`);
