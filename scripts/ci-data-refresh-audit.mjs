// Executable /data-refresh closure: 22 durable snapshot categories plus the
// separately reported Korean dynamic pipeline checks. This is a freshness and
// lineage audit, not a claim that unavailable/licensed data exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const now = Date.now();
const data = json('public-data/data.json');
const snapshot = json('public-data/market-snapshot.json');
const screener = json('public-data/screener.json');
const rows = [];

function ageDays(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? Math.max(0, (now - ms) / 86400000) : null;
}

function statusFor(observedAt, cadence, forced = null) {
  if (forced) return forced;
  const age = ageDays(observedAt);
  if (age == null) return 'SKIPPED';
  const limit = cadence === 'daily' ? 2 : cadence === 'weekly' ? 8 : cadence === 'monthly' ? 35 : 120;
  return age <= limit ? 'OK' : age <= limit * 2 ? 'STALE' : 'CRITICAL';
}

function add(id, category, observedAt, cadence, detail, forced = null) {
  rows.push({ id, category, observedAt: observedAt || null, ageDays: ageDays(observedAt), cadence, status: statusFor(observedAt, cadence, forced), detail });
}

const quote = (symbol) => (snapshot.quotes || []).find((row) => row.instrumentId === symbol) || null;
const macro = data.macro || {};

// The 22 durable categories defined by the data-refresh contract.
add('A1', 'DATA_SNAPSHOT / durable market artifact', data.meta?.generatedAt, 'daily', `revision=${data.meta?.marketSnapshotRevision || snapshot.revision}`);
add('A2', 'Fear & Greed', data.fearGreed?.asOf || data.meta?.generatedAt, 'daily', `score=${data.fearGreed?.score ?? '—'} source=${data.fearGreed?._source || 'unknown'}`);
add('A3', 'VIX + HY OAS shared evidence', quote('^VIX')?.observedAt || macro._asOf_hyOAS, 'daily', `vix=${quote('^VIX')?.value ?? '—'} hyOAS=${macro.hyOAS ?? '—'} hyAsOf=${macro._asOf_hyOAS || '—'}; session=${quote('^VIX')?.session || 'missing'}`, ageDays(macro._asOf_hyOAS) != null && ageDays(macro._asOf_hyOAS) > 2 ? 'STALE' : null);
add('B1', 'AAII sentiment', null, 'weekly', 'SKIPPED: current licensed/direct value unavailable; exact percentage synthesis forbidden', 'SKIPPED');
add('B2', 'NAAIM exposure', null, 'weekly', 'SKIPPED: current licensed/direct value unavailable; bounded inference only', 'SKIPPED');
add('B3', 'Investor Intelligence bull/bear', null, 'weekly', 'SKIPPED: subscriber value unavailable; no extrapolated value promoted', 'SKIPPED');
add('B4', 'Put/Call ratio', data.putCall?.asOf || data.meta?.putCallAsOf, 'daily', `total=${data.putCall?.totalPutCall ?? '—'} equity=${data.putCall?.equityPutCall ?? '—'} source=${data.putCall?._source || 'Cboe Daily Market Statistics'}`, Number.isFinite(Number(data.putCall?.totalPutCall)) ? null : 'SKIPPED');
add('C1', 'US breadth / labels', screener.breadth?.segments?.us?.observedAt || screener.factorObservedAt, 'daily', `coverage=${screener.breadth?.segments?.us?.coveragePct ?? '—'}%`);
add('C2', 'NDX breadth', screener.breadth?.segments?.us?.observedAt || screener.factorObservedAt, 'daily', 'uses AIO universe contract; official exchange breadth remains separate');
add('C3', 'McClellan / NYSE A-D', null, 'daily', 'SKIPPED: durable official A/D series unavailable; UI remains explicit unavailable', 'SKIPPED');
add('C4', 'Weinstein stage', null, 'daily', 'DYNAMIC: derived from runtime price history; no hardcoded current claim');
add('D1', 'HY OAS', macro._asOf_hyOAS || quote('HYG')?.observedAt, 'daily', `value=${macro.hyOAS ?? '—'} observed=${macro._asOf_hyOAS || '—'}; stale points remain reference-only`, Number.isFinite(Number(macro.hyOAS)) ? null : 'SKIPPED');
add('D2', 'Treasury yield fallback', quote('^TNX')?.observedAt, 'daily', `10Y=${quote('^TNX')?.value ?? '—'} session=${quote('^TNX')?.session || 'missing'}`);
add('D3', '10Y-2Y spread', macro._asOf_t10y2y || quote('^TNX')?.observedAt, 'daily', `SKIPPED: spread value=${macro.t10y2y ?? '—'} is unavailable; do not infer from a single 10Y quote`, 'SKIPPED');
const officialMacroFetchAt = data.meta?.blsLastSuccessfulAt || data.meta?.generatedAt;
const bea = macro._bea || {};
const pceReleaseAt = bea.releasedAt || data.meta?.beaReleaseAt || null;
const pceForced = bea.status === 'ok' && macro._source_pce === 'bea-official-primary'
  ? null
  : (pceReleaseAt && ageDays(pceReleaseAt) <= 35 ? 'CRITICAL' : 'SKIPPED');
add('E1', 'CPI / PCE', pceReleaseAt, 'monthly', `CPI=${macro.cpi ?? '—'} (obs ${macro._asOf_cpi || '—'}) PCE=${macro.pce ?? '—'} (obs ${macro._asOf_pce || '—'}) corePCE=${macro.corePce ?? '—'} BEA=${bea.status || 'unavailable'} source=${macro._source_pce || macro._source || 'unknown'}`, pceForced);
add('E2', 'Employment / wages / retail / housing', officialMacroFetchAt, 'monthly', `unemployment=${macro.unemployment ?? '—'} wage=${macro.usWageGrowth ?? '—'}; observation period is retained separately from fetch freshness`);
add('E3', 'FOMC calendar', '2026-07-29', 'monthly', 'official result reconciled 2026-07-29; next meeting 2026-09-15~16');
add('E4', 'Central-bank policy rates', '2026-07-29', 'monthly', 'Fed 2026-07-29 official reference; BOK retains its own observation date');
add('F1', '24h news / HOME_WEEKLY_NEWS', data.meta?.generatedAt, 'daily', `count=${data.meta?.newsCount ?? data.news?.length ?? 0} cycle=${data.meta?.newsCyclePolicy || 'unknown'}`);
add('G1', 'Commodities / FX', quote('CL=F')?.observedAt || quote('DX-Y.NYB')?.observedAt, 'daily', `WTI=${quote('CL=F')?.value ?? '—'} DXY=${quote('DX-Y.NYB')?.value ?? '—'}`);
add('G2', 'Global indices', quote('^GSPC')?.observedAt, 'daily', `SPX=${quote('^GSPC')?.value ?? '—'}; global non-tier history remains reference-only`);
add('G3', 'Crypto', quote('BTC-USD')?.observedAt, 'daily', `BTC=${quote('BTC-USD')?.value ?? '—'} ETH=${quote('ETH-USD')?.value ?? '—'}`);

const sourceChecks = {
  fetchKrSupplyData: /fetchKrSupplyData/.test(read('index.html')),
  fetchKrNaverQuotes: /fetchKrNaverQuotes/.test(read('index.html')),
  renderKrThemePerfBars: /renderKrThemePerfBars/.test(read('index.html')),
  themeCatalystRetired: /KR_THEME_CATALYSTS_META[\s\S]{0,120}status:'unavailable'/.test(read('index.html'))
};
const unknownSessions = (snapshot.quotes || []).filter((row) => !row.session || row.session === 'UNKNOWN');
const dynamicOk = Object.values(sourceChecks).every(Boolean);
const structuralOk = rows.length === 22 && snapshot.status === 'published' && Number(snapshot.coverage?.observed) >= Number(snapshot.coverage?.required) && unknownSessions.length === 0;

console.log('| # | Category | Observed | Age(d) | Cadence | Status | Detail |');
console.log('|---|---|---|---:|---|---|---|');
for (const row of rows) console.log(`| ${row.id} | ${row.category} | ${row.observedAt || '—'} | ${row.ageDays == null ? '—' : row.ageDays.toFixed(2)} | ${row.cadence} | ${row.status} | ${row.detail} |`);
console.log(`H-dynamic | ${dynamicOk ? 'PASS' : 'FAIL'} | ${JSON.stringify(sourceChecks)}`);
console.log(`D1-structural | ${structuralOk ? 'yes' : 'no'} | rows=${rows.length} unknownSessions=${unknownSessions.length} tier0=${snapshot.coverage?.observed}/${snapshot.coverage?.required}`);

if (!structuralOk || !dynamicOk) process.exit(1);
