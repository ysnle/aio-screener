// Codex structure review 2026-10-12 (_artifacts/codex-claude-structure-review-20261012/reproduce.mjs): the offline
// counterexamples ported to synthetic assertions so the fixed behaviour cannot silently regress. Read-only, no network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load as loadYaml } from 'js-yaml';
import { buildMarketRegime, movingAverageStructure } from '../src/domain/briefing/market-read.js';
import { buildDailyChanges } from '../src/domain/briefing/daily-diff.js';
import { resolveEntities } from '../src/ai/entity/resolver.js';
import { buildPortfolioRead } from '../src/domain/portfolio/portfolio-read.js';
import { intervalStructure } from '../src/ui/components/stock-chart.js';
import { analyzeChart } from '../src/domain/technical/chart-analysis.js';
import { buildStockRead } from '../src/domain/entity/stock-read.js';
import { requestFiscalHistory } from '../src/ui/components/fiscal-read.js';
import { refreshSharedArtifact, sharedArtifactIsStale } from '../src/data/shared-artifacts.js';
import { describeRankingHold, factorSessionLag } from '../src/ui/pages/screener.js';
import { alignMarketInputs } from '../src/domain/briefing/market-read.js';
import { fundamentalPeriodTooOld } from '../src/data/providers/screener.js';
import { validateAnalysisAdmission, scoreServerNewsItem, serverNewsHeadlineMonthStale, newsHeadlineSignature, newsSameEvent } from './fetch-data.mjs';

const day = (i) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);

// M14/E09: equal moving averages are not an order.
assert.notEqual(movingAverageStructure({ value: 100, ma5: 100, ma10: 100, ma20: 100, ma50: 100, ma100: 100, ma200: 100 }).shortLabel, '정배열', 'M14: flat MAs are not 정배열');
assert.ok(!/정배열|역배열/.test(JSON.stringify(intervalStructure(Array.from({ length: 250 }, () => ({ close: 100 }))))), 'E09: flat chart interval is not ordered');

// M05: a regime whose latest close is more than two sessions old is held, not read.
const oldHistory = Array.from({ length: 400 }, (_, i) => ({ date: day(i), spx: 5000 + i, vix: 15, breadth50: 0.5, breadth200: 0.5 })).filter((row) => ![0, 6].includes(new Date(`${row.date}T12:00:00Z`).getUTCDay()));
const held = buildMarketRegime({ history: oldHistory, now: Date.parse('2026-10-12T12:00:00Z') });
assert.ok(held.staleBasis && held.staleBasis.lag > 2, 'M05: stale basis is detected');
assert.equal(held.overall, '판정 보류', 'M05: stale regime is held');

// M11/M12: compare only against the exact previous session.
const diff = buildDailyChanges([{ date: '2026-10-07', spx: 100, vix: 10, breadth50: 0.5 }, { date: '2026-10-08', spx: 101, breadth50: 0.5 }, { date: '2026-10-09', spx: 102, vix: 15, breadth50: 0.8 }]);
assert.ok(Array.isArray(diff.notCompared) && diff.notCompared.length > 0, `M11: the VIX gap is listed as not compared (${JSON.stringify(diff)})`);

// M06: AI market text admission rejects impossible counts, implausible moves, instructions and probability claims.
const bad = validateAnalysisAdmission('현재 확산 회복 조건은 99/4개 충족입니다. 오늘 변화율은 +999%입니다. 지금 즉시 매수하세요. 상승 확률은 99%입니다.', { changes: new Map(), context: '' });
assert.ok(bad.length >= 3, `M06: admission issues (${JSON.stringify(bad)})`);

// E01: KRX codes resolve only as exact 6-digit codes present in KR_STOCK_DB.
const resolverRoot = { KR_STOCK_DB: { '005930': { name: '삼성전자' } }, krTickerToYahoo: (code) => `${code}.KS` };
for (const query of ['0059300 분석', '005930.KSXYZ 분석', '20261012 시장 상태']) {
  assert.equal(resolveEntities(query, { root: resolverRoot }).entities.length, 0, `E01: ${query} resolves nothing`);
}
assert.ok(resolveEntities('999999 분석', { root: resolverRoot }).entities.every((entity) => entity.verified === false), 'E01: an unlisted code is never verified');
assert.ok(resolveEntities('005930 분석', { root: resolverRoot }).entities.length > 0, 'E01: a listed code still resolves');

// E03: the rotation share is measured on US holdings only.
const pf = buildPortfolioRead({ surface: { currencyState: 'converted', rows: [{ symbol: 'AAPL', value: 10 }, { symbol: '005930.KS', value: 90 }] }, rows: ['AAPL', '005930.KS'].map((sym) => ({ sym, sector: 'Technology', pctSma50: 1, pctSma200: 2 })), rotation: { XLK: { quadrant: 'Leading' } } });
assert.match(JSON.stringify(pf.points.find((x) => x.id === 'rotation') || {}), /미국 보유분/, 'E03: rotation names the US-holdings basis');

// E08: sparse volume yields no up/down pressure read.
const bars = Array.from({ length: 300 }, (_, i) => ({ time: day(i), open: 100 + i / 10, close: 100 + i / 10, high: 102 + i / 10, low: 98 + i / 10, volume: i >= 285 ? null : 100 }));
assert.ok(!analyzeChart(bars).evidence.some(([label, text]) => /거래량/.test(label) && /우위|압력/.test(String(text))), 'E08: no volume pressure from sparse volume');

// E10: drawdown to the 50-day line uses the price ratio (+100% above -> 50% fall), not 100%.
const stock = JSON.stringify(buildStockRead({ symbol: 'NOT_INDEX', row: { pctSma50: 100, pctSma200: 1, adrPct: 5 }, regime: { available: true, overall: '부담', axes: [{ id: 'breadth', state: 'burden' }], counts: { burden: 1 } } }).points);
assert.ok(!/100(\.0)?% 하락/.test(stock), 'E10: 50-day drawdown is not stated as 100%');

// E05: a failed fiscal load is not cached as data and is not retried immediately.
let calls = 0;
const failing = { fetch: async () => { calls += 1; return { ok: false, status: 503 }; } };
requestFiscalHistory(failing, () => {});
await new Promise((r) => setTimeout(r, 20));
requestFiscalHistory(failing, () => {});
assert.equal(calls, 1, 'E05: immediate retry after failure is throttled');
assert.ok(!failing._aioSecFiscalHistory, 'E05: failure is not cached as data');

// M02/A03: a shared artifact copy becomes stale once the server data is regenerated.
let loads = 0;
const shared = { fetch: async () => { loads += 1; return new Response(JSON.stringify({ schemaVersion: 'x.v1', generatedAt: `g${loads}` }), { headers: { 'content-type': 'application/json' } }); } };
const spec = { key: '_aioFixtureShared', url: './x.json', schemas: ['x.v1'], maxAgeMs: 3600000 };
await refreshSharedArtifact(shared, spec);
assert.equal(sharedArtifactIsStale(shared, spec.key, spec), false, 'M02: fresh copy is not stale');
shared._serverDataMeta = { generatedAt: new Date(Date.now() + 1000).toISOString() };
assert.equal(sharedArtifactIsStale(shared, spec.key, spec), true, 'M02: server regeneration marks the copy stale');

// UI 2026-10-12: the screener names the selected market's own late session.
const afterKrClose = Date.parse('2026-10-12T09:00:00Z');
assert.deepEqual(factorSessionLag('KR', '2026-10-08', afterKrClose), { session: '2026-10-08', latest: '2026-10-12', label: '한국장' });
assert.equal(factorSessionLag('US', '2026-10-09', afterKrClose), null, 'US 10/09 is current before the 10/12 US close');
assert.match(describeRankingHold({ reason: 'eligible-coverage' }, { market: 'KR', factorSessionDate: '2026-10-08', now: afterKrClose }), /10\/12 한국장/);

// News curation (owner 2026-10-12: curate, do not widen to 50).
const now = Date.parse('2026-10-12T00:00:00Z');
assert.equal(scoreServerNewsItem({ title: 'NVIDIA Stock Price, News, Quote & History', source: 'X', scoringNowMs: now }).selectionReason, 'not-article-filter');
assert.equal(scoreServerNewsItem({ title: 'Form 4 filed by director', source: 'X', scoringNowMs: now }).selectionReason, 'not-article-filter');
assert.equal(serverNewsHeadlineMonthStale('Stocks rally on August 14 as Fed signals cut', now), true, 'an August headline in the October cycle is a repost');
assert.equal(serverNewsHeadlineMonthStale('Stocks rally on October 10 as Fed signals cut', now), false);
assert.equal(newsSameEvent(newsHeadlineSignature('Fed holds rates steady at 4.25% - Reuters'), newsHeadlineSignature('Fed holds rates steady at 4.25%, signals patience - CNBC')), true, 'the same event is deduped');
assert.equal(newsSameEvent(newsHeadlineSignature('Oil jumps on Middle East supply fears'), newsHeadlineSignature('Apple unveils new iPhone lineup')), false);

// P1651: a KRX close aligns to the latest completed KRX session, not the US basis (10/12 -3.6% was shown as 10/8).
const krHistory = [
  { date: '2026-10-08', spx: 100, kospi: 6625.93, fieldMeta: { spx: { observedAt: '2026-10-08T20:00:00Z' }, kospi: { observedAt: '2026-10-08T06:30:00Z' } } },
  { date: '2026-10-09', spx: 101, kospi: 6625.93, fieldMeta: { spx: { observedAt: '2026-10-09T20:00:00Z' }, kospi: { observedAt: '2026-10-08T06:30:00Z' } } },
  { date: '2026-10-12', spx: 101, kospi: 6384.24, fieldMeta: { spx: { observedAt: '2026-10-09T20:00:00Z' }, kospi: { observedAt: '2026-10-12T06:30:00Z' } } }
];
const krAligned = alignMarketInputs({ history: krHistory, now: Date.parse('2026-10-12T09:00:00Z') });
assert.equal(krAligned.basis, '2026-10-09');
assert.equal(krAligned.s.kospi?.date, '2026-10-12', 'P1651: KOSPI uses its own completed session');
// P1652: fundamentals whose period ended over 15 months before the session are held.
assert.equal(fundamentalPeriodTooOld('2019-12-31', '2026-10-09'), true);
assert.equal(fundamentalPeriodTooOld('2025-12-31', '2026-10-09'), false);
const chat = fs.readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8');
assert.ok(!/가격·비중·손절·목표 범위도 근거와 사용자 조건이 있으면 분석할 수 있/.test(chat), 'P1652: chat contract forbids trade instructions');
assert.ok(!/v49\.75 구조:/.test(chat), 'P1652: no developer structure badge under answers');
const core = fs.readFileSync(new URL('../js/aio-core.js', import.meta.url), 'utf8');
assert.ok(core.includes('(?:headline:|market-analysis:'), 'P1651: whole citation brackets are stripped from AI text');

// P1653: AI is always on, web search is automatic, one AI panel.
const shell = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(!/id="llm-switch-track"/.test(shell), 'P1653: no AI ON/OFF switch');
assert.ok(!/id="chat-home-inp"|id="chat-theme-detail-inp"/.test(shell), 'P1653: no per-page inline chat inputs');
assert.ok(/data-action="_aioAskInPanel"/.test(shell), 'P1653: page prompts route to the top AI panel');
const connections = fs.readFileSync(new URL('../src/ui/panels/connections.js', import.meta.url), 'utf8');
assert.ok(!/aio-web-search-toggle/.test(connections), 'P1653: no web search toggle');
const shellJs = fs.readFileSync(new URL('../src/ui/components/responsive-shell.js', import.meta.url), 'utf8');
assert.ok(!/documentElement\.style\.setProperty\('--aio-visual/.test(shellJs), 'P1653: keyboard viewport events do not restyle the whole document');

// P1654: free official data lanes.
const { netLiquiditySeries } = await import('../src/domain/macro/liquidity-growth.js');
const week = (i) => new Date(Date.UTC(2026, 0, 7) + i * 7 * 86400000).toISOString().slice(0, 10);
const liq = netLiquiditySeries({ series: { fedBalanceSheet: { observations: [[week(0), 6600000], [week(1), 6610000]] }, treasuryAccount: { observations: [[week(0), 800000], [week(1), 800000]] }, reverseRepo: { observations: [[week(0), 200], [week(1), 200]] } } });
assert.equal(liq.at(-1).value, 6610 - 800 - 200, 'P1654: net liquidity = Fed assets - TGA - RRP in USD billions');
const { mergeMacroSchedules } = await import('../src/data/macro-calendar.js');
assert.deepEqual(mergeMacroSchedules({ 'us-cpi': ['2026-12-10'] }, { 'us-cpi': ['2026-12-10', '2027-01-13', 'bad'] })['us-cpi'], ['2026-12-10', '2027-01-13'], 'P1654: produced release dates extend the schedule');
const { pickAccounts } = await import('./fetch-dart-fundamentals.mjs');
const accounts = pickAccounts([{ fs_div: 'OFS', account_nm: '매출액', thstrm_amount: '1' }, { fs_div: 'CFS', account_nm: '매출액', thstrm_amount: '1,000', frmtrm_amount: '800' }]);
assert.equal(accounts.basis, 'CFS'); assert.equal(accounts.current.revenue, 1000); assert.equal(accounts.prior.revenue, 800);
const { krFundamentalPoints } = await import('../src/domain/entity/kr-fundamentals.js');
assert.match(krFundamentalPoints({ fiscalYear: 2025, basis: 'CFS', current: { revenue: 2e12, operatingIncome: 2e11 }, prior: { revenue: 1e12 } }).points[0].text, /전년 대비 \+100\.0%/);

// P1655: one research transport — the shared Worker web search; no browser-side Google/Perplexity keys.
assert.ok(!/aio_google_cse_key_input/.test(shell) && !/_googleSearch|_aiWebSearch/.test(chat), 'P1655: personal search path removed');
// P1656: history keeps completed-close evidence; pre-open index prints are not closes.
const { usPreOpenIndexPrint } = await import('./fetch-data.mjs');
assert.equal(usPreOpenIndexPrint('^VIX', '2026-10-12T11:01:01Z'), true, 'P1656: Monday 07:01 ET VIX is a pre-open print');
assert.equal(usPreOpenIndexPrint('^VIX', '2026-10-09T20:15:01Z'), false, 'P1656: the 16:15 ET VIX close stays a close');
const producer = fs.readFileSync(new URL('./fetch-data.mjs', import.meta.url), 'utf8');
assert.ok(/existing\.fieldMeta\[f\]\?\.valueBasis\) continue;/.test(producer), 'P1656: backfill does not overwrite completed-close evidence');

// P1660: axis and macro-group folds teach (principle · reading · links) instead of listing sources.
const { AXIS_DEEP_DIVES, MACRO_GROUP_DEEP_DIVES } = await import('../src/domain/content/axis-deep-dives.js');
for (const id of ['trend', 'breadth', 'volatility', 'rates', 'credit', 'commodities']) assert.ok(AXIS_DEEP_DIVES[id]?.blocks.length === 3 && AXIS_DEEP_DIVES[id].related.length, `P1660: ${id} deep dive`);
assert.ok(MACRO_GROUP_DEEP_DIVES.liquidity && MACRO_GROUP_DEEP_DIVES.growth && MACRO_GROUP_DEEP_DIVES['commodities-fx'], 'P1660: macro group deep dives');
assert.ok(!/추가 근거와 출처/.test(fs.readFileSync(new URL('../src/ui/components/market-regime.js', import.meta.url), 'utf8')), 'P1660: no evidence-dump fold title');
// P1661: past outcomes by VIX band replace the failed composite score.
const { buildStressOutcomes, stressBandOf } = await import('../src/domain/signal/stress-outcomes.js');
const days = Array.from({ length: 120 }, (_, i) => new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString().slice(0, 10));
const stress = buildStressOutcomes(days.map((d, i) => [d, 100 + i]), days.map((d, i) => [d, i < 60 ? 35 : 12]), { horizons: [21] });
assert.equal(stressBandOf(14.8).id, 'calm'); assert.equal(stressBandOf(30).id, 'stress');
assert.equal(stress.bands.find((b) => b.id === 'stress').episodes, 1, 'P1661: a run of days in one band is one episode');
assert.equal(stress.bands.find((b) => b.id === 'stress').horizons[21].hitRate, 100, 'P1661: rising series is all up');
assert.equal(stress.bands.find((b) => b.id === 'calm').horizons[21].n, 39, 'P1661: no forward window past the last close');

// P1663: sentiment cards and the breadth page share the deep-dive fold renderer.
const { SENTIMENT_DEEP_DIVES } = await import('../src/domain/content/axis-deep-dives.js');
for (const id of ['fg', 'term', 'hy', 'pcr', 'aaii', 'composite']) assert.ok(SENTIMENT_DEEP_DIVES[id]?.blocks.length >= 2, `P1663: ${id} deep dive`);
for (const file of ['sentiment-board.js', 'breadth-board.js', 'market-regime.js', 'macro-board.js']) assert.ok(/deepDiveFold\(/.test(fs.readFileSync(new URL(`../src/ui/components/${file}`, import.meta.url), 'utf8')), `P1663: ${file} uses the shared fold`);

// P1664: a product-surface edit outside the knowledge routes does not pull the knowledge browser shard; viewport gates run pages together.
const qaManifest = JSON.parse(fs.readFileSync(new URL('../architecture/qa-pipeline.json', import.meta.url), 'utf8'));
const surfaceRule = qaManifest.impactRules.find((rule) => rule.patterns.includes('src/ui/**'));
assert.ok(surfaceRule && !surfaceRule.groups.includes('browser-knowledge') && surfaceRule.groups.includes('browser-viewport'), 'P1664: src/ui edits select viewport but not the knowledge shard');
for (const file of ['ci-responsive-browser-check.mjs', 'ci-viewport-matrix-check.mjs']) assert.ok(/Promise\.all\((RESPONSIVE_QA_VIEWPORTS|VIEWPORTS)\.map/.test(fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')), `P1664: ${file} runs viewports together`);
// P1665: the watchdog's own previous run is a warning, and a missing Worker dispatch token triggers a data-plane redeploy.
assert.ok(/selfObservation = mode === 'watchdog' && id === 'watchdog'/.test(fs.readFileSync(new URL('./ci-external-pipeline-check.mjs', import.meta.url), 'utf8')), 'P1665: watchdog does not latch on its own failure');
assert.ok(/scheduler-dispatch-token-missing/.test(fs.readFileSync(new URL('../.github/workflows/deploy-data-plane.yml', import.meta.url), 'utf8')), 'P1665: missing dispatch token repairs the Worker');
// P1666: the producer job alone holds the refresh lock; waiting for CI/Pages runs in a separate job, and the watchdog follows each Pages deploy.
for (const file of ['refresh-data.yml', 'refresh-screener.yml']) {
  const wf = loadYaml(fs.readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'));
  const producer = Object.entries(wf.jobs).find(([name]) => name !== 'converge');
  assert.ok(!wf.concurrency && producer[1].concurrency?.group === 'refresh-data' && wf.jobs.converge?.concurrency?.group === 'live-convergence', `P1666: ${file} convergence does not hold the refresh lock`);
  assert.ok(!producer[1].steps.some((step) => /ensure-live-convergence/.test(step.run || '')), `P1666: ${file} producer does not wait for Pages`);
}
const watchdogWf = loadYaml(fs.readFileSync(new URL('../.github/workflows/data-watchdog.yml', import.meta.url), 'utf8'));
assert.ok((watchdogWf.on || watchdogWf[true]).workflow_run?.workflows?.includes('Deploy GitHub Pages'), 'P1666: watchdog follows each Pages deploy');

console.log('codex-structure-regression-fixture: OK');
