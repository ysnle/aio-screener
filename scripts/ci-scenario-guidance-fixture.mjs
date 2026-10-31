#!/usr/bin/env node
// Scenario guidance and the shared market guide. v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('scenario-guidance-fixture', [
// ── section scenario-guidance (was ci-scenario-guidance-fixture.mjs) ──
['scenario-guidance', async () => {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { buildMarketRegime, movingAverageStructure } = await import('../src/domain/briefing/market-read.js');
const { buildMarketScenarios } = await import('../src/domain/market/regime-scenarios.js');
const { buildScenarioOutlook, renderScenarioOutlookContext } = await import('../src/domain/market/scenario-outlook.js');
const { CHART_INTERVALS, intervalBars, intervalSpec, intervalStructure } = await import('../src/ui/components/stock-chart.js');
const { buildMarketAnalysisRegimeContext } = await import('./fetch-data.mjs');
const { readProducerSource } = await import('./lib/producer-source.mjs'); // v57.62: fetch-data.mjs + the lib modules split out of it
const { liveCurrentObservations } = await import('../src/ui/knowledge/current-observations.js');

// P1633: short (close>5>10>20) and long (20>50>100>200) moving-average order.
assert.equal(movingAverageStructure({ value: 110, ma5: 108, ma10: 106, ma20: 104, ma50: 100, ma100: 96, ma200: 90 }).shortLabel, '정배열');
assert.equal(movingAverageStructure({ value: 80, ma5: 84, ma10: 88, ma20: 92, ma50: 96, ma100: 100, ma200: 104 }).longLabel, '역배열');

const history = JSON.parse(readFileSync(new URL('../public-data/history.json', import.meta.url), 'utf8'));
const rows = Array.isArray(history) ? history : history.rows || [];
const input = { history: rows, credit: { hyBp: 315, hyDelta5Bp: -9 }, rates: {} };
const regime = buildMarketRegime(input);
assert.ok(regime.available, 'P1633: regime builds from the published history');
const breadth = regime.axes.find((axis) => axis.id === 'breadth');
assert.ok(breadth.evidence.some(([label]) => /20일선 위 종목/.test(label)), 'P1633: breadth shows the 20-day participation next to 50/200');
const trend = regime.axes.find((axis) => axis.id === 'trend');
assert.ok(trend.evidence.some(([label]) => /단기 추세/.test(label)) && trend.evidence.some(([label]) => /장기 추세/.test(label)), 'P1633: trend shows short and long order');

// P1633: each path carries a likelihood from met conditions, posture, opportunity, check/caution/ignore.
const scenarios = buildMarketScenarios(input, { regime });
const outlook = buildScenarioOutlook({ scenarios, regime, sectors: [{ symbol: 'XLK', label: '기술', quadrant: 'Leading' }, { symbol: 'XLV', label: '헬스케어', quadrant: 'Improving' }], themes: [{ name: '광통신', ret3m: 40 }] });
assert.ok(outlook.available && outlook.items.length === 3);
for (const item of outlook.items) {
  assert.ok(['높음', '중간', '낮음', '판단 보류'].includes(item.likelihood), 'likelihood is a count-based label');
  assert.ok(item.posture && item.opportunity && item.check.length && item.caution.length && item.ignore.length, `P1633: ${item.id} has posture, opportunity, check, caution, ignore`);
  assert.doesNotMatch(`${item.posture} ${item.opportunity}`, /\d+(?:\.\d+)?\s*%\s*(?:확률|가능성)|매수하세요|매도하세요|목표가/, 'no probability percentages or trade instructions');
  // T06 (expert review 2026-10-13): a count of met conditions, never a likelihood grade; no allocation or timing advice.
  assert.match(item.fit, /^(조건 충족 \d+\/\d+|판단 보류)$/, 'T06 fit is the met-condition count (one notation with the branches, P1745)');
  assert.doesNotMatch(item.posture, /현금|단기채|비중|기다리는 쪽|유리할 가능성|기회비용/, `T06 ${item.id} posture carries no allocation/timing advice`);
  assert.match(item.posture, /반증/, `T06 ${item.id} posture names what would refute it`);
}
assert.doesNotMatch(outlook.headline, /개연성/, 'T06 headline drops the likelihood grade');
assert.match(renderScenarioOutlookContext(outlook), /매매 지시/, 'AI context restates the no-instruction boundary');

// P1634: eight intervals; 4-hour bars combine at most four 1-hour bars of one exchange day.
assert.deepEqual(CHART_INTERVALS.map((spec) => spec.id), ['5m', '15m', '30m', '1h', '4h', '1d', '1wk', '1mo']);
assert.ok(CHART_INTERVALS.every((spec) => spec.interval !== '60m'), 'P1634: the relay rejects 60m; 1h is used');
const start = Date.UTC(2026, 9, 5, 13, 30) / 1000;
const payload = { timestamps: [], opens: [], highs: [], lows: [], closes: [], volumes: [], meta: { exchangeTimezoneName: 'America/New_York' } };
for (let day = 0; day < 2; day += 1) for (let hour = 0; hour < 7; hour += 1) {
  payload.timestamps.push(start + day * 86400 + hour * 3600); payload.opens.push(10 + hour); payload.highs.push(11 + hour); payload.lows.push(9 + hour); payload.closes.push(10.5 + hour); payload.volumes.push(100);
}
const four = intervalBars(payload, intervalSpec('4h'));
assert.equal(four.length, 4, 'P1634: 7 hourly bars a day -> 2 four-hour bars a day');
assert.deepEqual([four[0].open, four[0].high, four[0].low, four[0].close, four[0].volume], [10, 14, 9, 13.5, 400]);
const hourly = intervalBars(payload, intervalSpec('1h'));
assert.equal(new Date(hourly[0].time * 1000).toISOString().slice(11, 16), '09:30', 'P1634: intraday time is exchange-local wall time');
assert.equal(intervalStructure(hourly).long, null, 'P1634: too few bars leaves the long order uncomputed');

// P1635: the server narrative receives the same regime and scenario reading as the screen.
const data = { macro: { hyOAS: 3.15, hyOASDelta5: -0.09 }, fearGreed: { score: 45 } };
const context = buildMarketAnalysisRegimeContext(data, rows);
assert.match(context, /종합:/, 'P1635: regime summary present');
assert.match(context, /현재 조건 충족/, 'P1635/T06: scenario condition count present');

// P1636: research-page observations that the site refreshes are replaced by the latest values.
const artifact = { observations: [
  { id: 'market-spx-20260814', label: 'S&P 500 종가', value: 1, displayValue: '1', unit: 'index', observedAt: '2026-08-14', sourceId: 'x', sourceKind: 'PUBLIC_INFORMATION_SERVICE', allowedUse: 'reference-only', pageTargets: ['principles'] },
  { id: 'sndk-target', label: 'target', value: 50, displayValue: '50%', unit: 'percent', observedAt: '2026-08-13', sourceId: 'y', sourceKind: 'COMPANY_IR_FORWARD_LOOKING', allowedUse: 'reference-only', pageTargets: ['principles'] }
] };
const live = liveCurrentObservations(artifact, { _aioHistory: [{ date: '2026-10-09', spx: 7811.54 }], DATA_SNAPSHOT: {} });
assert.equal(live.observations[0].value, 7811.54, 'P1636: market rows follow the latest close');
assert.equal(live.observations[0].live, true);
assert.equal(live.observations[1].value, 50, 'P1636: dated company targets stay dated references');
// v58.77 pipeline audit KNOW-01: a last-known-good CPI (the server marks it reference-only) is not promoted to an
// auto-updated current value; a fresh official CPI is.
{
  const cpiArtifact = { observations: [{ id: 'bls-cpi-2025', label: 'CPI', value: 1, displayValue: '1', unit: 'percent', observedAt: '2025-01', sourceId: 'bls-cpi', sourceKind: 'OFFICIAL_STATISTICS', allowedUse: 'reference-only', pageTargets: ['principles'] }] };
  const lkg = liveCurrentObservations(cpiArtifact, { DATA_SNAPSHOT: { cpi: 2.9, _cpi_src: 'last-known-good', _fieldTs: { macro_cpi: '2025-01-01' } } }).observations[0];
  const fresh = liveCurrentObservations(cpiArtifact, { DATA_SNAPSHOT: { cpi: 2.9, _cpi_src: 'bls-official-primary', _fieldTs: { macro_cpi: '2026-09-01' } } }).observations[0];
  assert.ok(lkg.allowedUse === 'reference-only' && lkg.live === false && /2025-01/.test(lkg.observedAt), `P2055 LKG CPI stays a dated reference: ${JSON.stringify(lkg)}`);
  assert.ok(fresh.allowedUse === 'current-context' && fresh.live === true, 'P2055 a fresh official CPI is current');
}

console.log('scenario guidance fixture: PASS');

// P1637: regime radar — one-year positions, today vs 5/20 sessions, no composite.
const { buildRegimeRadar } = await import('../src/domain/market/regime-radar.js');
const macroHistory = JSON.parse(readFileSync(new URL('../public-data/macro-history.json', import.meta.url), 'utf8'));
const radar = buildRegimeRadar({ history: rows }, { macroHistory });
assert.ok(radar.available && radar.axes.length === 6, 'P1637: six radar axes');
assert.ok(radar.axes.every((axis) => axis.now == null || (axis.now >= 0 && axis.now <= 100)), 'P1637: positions are 0-100');
assert.equal(radar.dates.length, 3, 'P1637: today, 5 and 20 sessions ago');
assert.ok(!('composite' in radar) && !('score' in radar), 'P1637: no composite score');

// P1638: CCC minus B gap from rating-tier OAS.
const { buildRegimeAxisHistory } = await import('../src/domain/market/regime-scenarios.js');
const tierMacro = { series: { cccOas: { observations: rows.slice(-130).map((row) => [row.date, 12]) }, bOas: { observations: rows.slice(-130).map((row) => [row.date, 3]) } } };
const tiers = buildRegimeAxisHistory({ history: rows, credit: {}, rates: {} }, { macroHistory: tierMacro });
const gap = tiers.axes.credit.find((item) => item.id === 'ccc-b');
assert.ok(gap && gap.series.every((point) => point.value === 900), 'P1638: CCC-B gap in bp');
assert.match(readProducerSource(), /cccOas:\s+\x7b id: 'BAMLH0A3HYC'/, 'P1638: producer requests the CCC series');

// P1639: chart evidence adds ATR extension, distance from the 52-week low and the 5/20 EMA order.
const { analyzeChart } = await import('../src/domain/technical/chart-analysis.js');
let level = 100; const daily = [];
for (let i = 0; i < 300; i += 1) { const open = level; level *= 1 + Math.sin(i / 9) * 0.01 + 0.002; daily.push({ time: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10), open, high: Math.max(open, level) * 1.01, low: Math.min(open, level) * 0.99, close: level, volume: 1e6 }); }
const labels = analyzeChart(daily).evidence.map(([label]) => label);
for (const label of ['50일선 대비 일평균 변동폭 배수', '5일·20일 EMA']) assert.ok(labels.includes(label), `P1639: ${label}`);
assert.ok(labels.some((label) => /저점 대비/.test(label)), 'P1639: distance from the low');

// P1641: sector moves come only from current produced rotation rows.
const { sectorMoves } = await import('../src/ui/components/sector-moves.js');
const rotation = { latestCompletedSession: '2026-10-09', items: { XLK: { status: 'CURRENT', symbol: 'XLK', sessionDate: '2026-10-09', dailyPct: 0.5, quadrant: 'Leading' }, XLU: { status: 'CURRENT', symbol: 'XLU', sessionDate: '2026-10-09', dailyPct: -1.2, quadrant: 'Lagging' } } };
// M13 (Codex review): the old fixture's rows failed the strict selector and an empty result passed. Use a
// schema-valid artifact and assert the exact rows, then a stale row that must be left out.
const { latestCompletedUsSession } = await import('../src/domain/market/market-calendar.js');
const fixtureNow = Date.parse('2026-10-10T12:00:00Z');
const session = latestCompletedUsSession(fixtureNow - 5 * 60000);
const rrgRow = (symbol, dailyPct, rsRatio, rsMomentum, quadrant, sessionDate = session.date) => ({ status: 'CURRENT', symbol, sessionDate, dailyPct, weeklyPct: dailyPct * 2, rsRatio, rsMomentum, quadrant, alignedSessionCount: 60, observedAt: new Date(session.closeMs).toISOString(), fetchedAt: '2026-10-10T01:00:00Z' });
const validRotation = { schemaVersion: 'rotation-history.v1', modelVersion: 'rrg.v3', benchmark: 'SPY', timeframe: '1d', priceBasis: 'adjusted-close', decisionUse: false, allowedUseCeiling: 'reference', latestCompletedSession: session.date,
  items: { XLK: rrgRow('XLK', 0.5, 101, 101, 'Leading'), XLU: rrgRow('XLU', -1.2, 99, 99, 'Lagging'), XLE: rrgRow('XLE', 1.4, 99, 101, 'Improving'), XLF: { ...rrgRow('XLF', 3, 101, 99, 'Weakening'), status: 'STALE' } } };
const moves = sectorMoves(validRotation, fixtureNow);
assert.deepEqual(moves.rows.map((row) => row.symbol), ['XLE', 'XLK', 'XLU'], 'P1641/M13: exact current rows, strongest first; the stale XLF row is left out');
assert.equal(moves.session, session.date);
assert.equal(sectorMoves(rotation, fixtureNow).rows.length, 0, 'M13: a non-schema artifact yields no rows');
// XLB·XLY (UI review 2026-10-18): 오늘 섹터 등락 reads the settled quadrant from the row's trail, as 테마·섹터 does — a fixed ±1
// band on the last point alone read 기준선 부근 for a sector the themes screen showed as 개선.
{
  const { rrgSettledQuadrant } = await import('../src/domain/themes/recent-check.js');
  const trail = Array.from({ length: 20 }, (_, i) => ({ rsRatio: 97 + (2.43 * i) / 19, rsMomentum: 104 }));
  const xly = { ...rrgRow('XLY', 0.8, trail.at(-1).rsRatio, 104, 'Improving'), trail };
  assert.equal(rrgSettledQuadrant(xly), 'Improving', 'XLY fixture settles in 개선 on its own trail band');
  const settled = sectorMoves({ ...validRotation, items: { ...validRotation.items, XLY: xly } }, fixtureNow).rows.find((row) => row.symbol === 'XLY');
  assert.equal(settled.quadrant, '개선', '오늘 섹터 등락 shows the settled quadrant (테마·섹터), not the fixed-band 기준선 부근');
}

console.log('scenario guidance fixture (radar, credit tiers, chart evidence, sectors): PASS');

// P1643: the basis card dates every explained number; a date-only basis reads as that session's close.
const { basisAge } = await import('../src/ui/components/value-basis.js');
const age = basisAge('2026-10-09', Date.parse('2026-10-12T06:00:00Z'));
assert.equal(age.label, '2026-10-09 기준');
assert.equal(age.age, '최신 거래일', 'U03: a date-only basis is aged in sessions against the latest completed one');
assert.equal(basisAge('2026-10-05', Date.parse('2026-10-12T06:00:00Z')).stale, true, 'U02: more than two sessions behind reads as 갱신 지연');
assert.equal(basisAge('2026-10-12T03:00:00Z', Date.parse('2026-10-12T06:30:00Z')).age, '3시간 전');
assert.match(basisAge('2026-10-12T03:00:00Z', Date.parse('2026-10-12T06:30:00Z')).label, /KST/, 'U03: timestamps carry their zone');
assert.equal(basisAge('', 0), null);
// v57.83 codex audit F16: freshness follows the source's cadence — an undeclared old timestamp claims neither fresh nor
// late, a declared intraday one is late after a day, a fiscal-year-end date is judged on the annual cadence, and a
// consumer's own freshness verdict wins.
{
  const at = Date.parse('2026-10-15T13:00:00Z');
  assert.equal(basisAge('2020-01-01T00:00:00Z', at).stale, null, 'v57.83: an undeclared 2020 timestamp is not "fresh"');
  assert.equal(basisAge('2020-01-01T00:00:00Z', at, { cadence: 'intraday' }).stale, true);
  assert.equal(basisAge('2026-01-25', at, { cadence: 'annual' }).stale, false, 'v57.83: a fiscal-year end nine months ago is not 갱신 지연');
  assert.equal(basisAge('2025-01-25', at, { cadence: 'annual' }).stale, true);
  assert.equal(basisAge('2026-10-01', at, { freshness: 'current' }).stale, false, 'v57.83: the consumer freshness verdict wins');
  assert.ok(/data-cadence\x27, \x27annual\x27/.test(readFileSync(new URL('../src/ui/pages/entity.js', import.meta.url), 'utf8')), 'v57.83: SEC fiscal-year dates declare the annual cadence');
}
const bootstrapSource = readFileSync(new URL('../src/app/bootstrap.js', import.meta.url), 'utf8');
assert.match(bootstrapSource, /installValueBasis\(documentRef/, 'P1643: the basis card is installed at boot');
console.log('scenario guidance fixture (basis card): PASS');

// P1742/P1743 (owner 2026-10-13): forward branches as a registry — chain, dated triggers, three likelihood lines, choices
// with opportunity cost — plus every theme by one rule, scored releases and the automated transition log.
{
  const { buildMacroCrossroads, upcomingMacroEvents, renderMacroCrossroadsContext, releaseActuals, scoreRelease, BRANCHES, CHOICES, BRANCH_NOTES } = await import('../src/domain/market/macro-crossroads.js');
  const { BRANCH_ANALOGS, analogOutcome, themeStateOutcomes, themeStateOf, THEME_STATES } = await import('../src/domain/scenarios/analogs.js');
  const { EXPOSURE_TAGS, US_THEME_PROFILES, KR_THEME_PROFILES, windFor } = await import('../src/domain/scenarios/exposures.js');
  const { buildThemePlaybook, renderThemePlaybookContext, rotationOf } = await import('../src/domain/scenarios/theme-playbook.js');
  const { buildMacroRead } = await import('../src/domain/macro/macro-read.js');
  const { loadThemeMaps, buildScenarioState, diffSnapshots, scoreNewReleases } = await import('./build-scenario-state.mjs');
  const { buildScenarioOutcomes } = await import('./build-scenario-outcomes.mjs');
  const now = Date.parse('2026-10-13T03:00:00Z');
  const events = upcomingMacroEvents({ schedules: { 'us-cpi': ['2026-09-11', '2026-10-14'], 'us-fomc': ['2026-10-28'], 'us-nfp': ['2026-11-06'], 'us-pce': ['2027-01-30'] }, releases: { 'us-fed-rate': { nextRelease: '2026-12-09' } }, nowMs: now });
  assert.deepEqual(events.map((e) => `${e.id}@${e.date}`), ['us-cpi@2026-10-14', 'us-fed-rate@2026-10-28', 'us-nfp@2026-11-06'], 'P1742: next dates only, FOMC page aliases the policy-rate release, beyond the horizon dropped');
  // Registry integrity: every branch is complete data, every tag it names exists, every branch has a past analog.
  assert.ok(BRANCHES.length >= 8, 'P1743: the branch registry covers more than the owner examples');
  for (const branch of BRANCHES) {
    assert.ok(BRANCH_ANALOGS[branch.id], `P1743 ${branch.id}: has a past-frequency analog`);
    for (const tag of [...branch.firmer, ...branch.weaker, ...(branch.mixed || [])]) assert.ok(EXPOSURE_TAGS[tag], `P1743 ${branch.id}: exposure tag ${tag} defined`);
    assert.deepEqual(Object.keys(branch.choices), Object.keys(CHOICES), `P1743 ${branch.id}: all four choices`);
    for (const [eventId] of branch.triggers) assert.ok(['us-cpi', 'us-nfp', 'us-pce', 'us-retail', 'us-fed-rate', 'us-ism-mfg'].includes(eventId), `P1743 ${branch.id}: trigger on a known release`);
    // v57.91 (bookmark item pass): every branch names what to check next and what would show the reading is wrong.
    assert.ok(BRANCH_NOTES[branch.id]?.checks?.length && BRANCH_NOTES[branch.id]?.invalidation?.length, `v57.91 ${branch.id}: reference checks and invalidation`);
  }
  assert.deepEqual(Object.keys(BRANCH_NOTES).sort(), BRANCHES.map((branch) => branch.id).sort(), 'v57.91 branch notes cover exactly the registered branches');
  // Every curated theme (US THEME_MAP, KR_THEME_MAP) has a structural profile, so no theme is left out of the rule.
  const maps = loadThemeMaps();
  assert.ok(maps.usThemes.length >= 15 && Object.keys(maps.krThemeMap).length >= 20, 'P1743: theme maps load from the classic scripts');
  for (const theme of maps.usThemes) assert.ok(US_THEME_PROFILES[theme.id]?.tags?.length && US_THEME_PROFILES[theme.id].breaks?.length, `P1743: US theme ${theme.id} has tags and break conditions`);
  for (const id of Object.keys(maps.krThemeMap)) assert.ok(KR_THEME_PROFILES[id]?.tags?.length && KR_THEME_PROFILES[id].breaks?.length, `P1743: KR theme ${id} has tags and break conditions`);
  const macroHistory = JSON.parse(readFileSync(new URL('../public-data/macro-history.json', import.meta.url), 'utf8'));
  const data = JSON.parse(readFileSync(new URL('../public-data/data.json', import.meta.url), 'utf8'));
  const read = buildMacroRead({ macro: data.macro, macroHistory, history: rows });
  const model = buildMacroCrossroads({ read, macroHistory, history: rows, events });
  assert.equal(model.items.length, BRANCHES.length, 'P1743: one item per registered branch');
  for (const item of model.items) {
    assert.match(item.fit, /^(조건 충족 \d\/\d(, 확인 가능 \d개)?|판단 보류)$/, `P1742 ${item.id}: likelihood is a met-condition count`);
    assert.ok(item.chain.length >= 4, `P1742 ${item.id}: cause→effect chain`);
    assert.ok(item.favored.length && item.favored.every((key) => CHOICES[key]) && item.favoredWhy, `P1742 ${item.id}: names the relatively favoured choice and why`);
    assert.ok(['same', 'against', 'neutral', 'unknown'].includes(item.pricing.tone), `P1742 ${item.id}: market-pricing line`);
    // Audit 3: the 2-year proxy caveat (P1449) is said once in the rate hub; each branch keeps one short line.
    if (['reheat', 'softland', 'slowdown', 'dollarsurge'].includes(item.id) && item.pricing.tone !== 'unknown') {
      assert.match(model.rateHub.pricingNote, /프리미엄/, `P1742 ${item.id}: the 2-year proxy states its premium caveat in the hub (P1449)`);
      assert.match(item.pricing.text, /^2년물−기준금리 [+−±]\d+\.\d{2}%p \(금리 (상단|하단) 쪽|^2년물−기준금리 [+−±]\d+\.\d{2}%p \(동결 부근/, `audit 3 ${item.id}: one short market-price line`);
      assert.doesNotMatch(item.pricing.text, /프리미엄/, `audit 3 ${item.id}: the caveat is not repeated per branch`);
    }
    assert.match(item.past.text, /AIO 종가 기록|장기 일봉 기록|빈도를 계산하지|빈도로 말하지/, `P1742 ${item.id}: past-frequency line with its record span`);
  }
  if (!model.held) assert.notEqual(model.altId, model.leadId, 'P1743: the alternative branch is a different path');
  const noProbability = /\d+(?:\.\d+)?\s*%\s*(?:의\s*)?(?:확률|가능성)|확률\s*\d/;
  const noInstruction = /(?:사세요|파세요|비중을\s*(?:늘리|줄이)세요|목표\s*가)/;
  const text = renderMacroCrossroadsContext(model, { state: { transitions: [{ at: '2026-10-13T00:00:00Z', text: '테스트 전환' }], eventOutcomes: [{ name: 'CPI', period: '2026-09-01', actualText: 'x', matched: [] }] } });
  assert.doesNotMatch(text, noProbability, 'P1742: no probability percentage');
  assert.doesNotMatch(text, noInstruction, 'P1742: no trade instruction');
  assert.match(text, /금리가 내려가려면/, 'P1742: the rate hub names what would lower rates');
  if (!model.held) assert.match(text, /이 읽기가 빗나가는 조건/, 'v57.91: the detailed branches carry their invalidation to the AI');
  assert.match(text, /최근 변화\(자동 기록\)/, 'P1743: the AI gets the automated transition log');
  assert.match(text, /지난 발표 판정\(자동\)/, 'P1743: the AI gets the scored releases');
  // Past frequency: non-overlapping episodes, long-history artifact preferred when it has a sample.
  const synthetic = Array.from({ length: 200 }, (_, i) => ({ date: new Date(Date.UTC(2000, 0, 1) + i * 86400000).toISOString().slice(0, 10), spx: 100 + i, tnx: 4 + (i >= 30 ? 0.5 : 0) + (i >= 120 ? 0.5 : 0), vix: 15, wti: 70, dxy: 100 }));
  const freq = analogOutcome(synthetic, BRANCH_ANALOGS.reheat);
  assert.ok(freq.n >= 1 && freq.n <= 3, `P1743: overlapping windows are counted once per episode (n=${freq.n})`);
  const longModel = buildMacroCrossroads({ read, macroHistory, history: rows, events, outcomes: { sourceLabel: '장기 일봉 기록', branches: { reheat: { n: 41, up: 22, median: 0.4, p25: -2.1, p75: 2.9, from: '1990-01-02', to: '2026-10-09', horizon: 20 } } } });
  assert.match(longModel.items.find((item) => item.id === 'reheat').past.text, /장기 일봉 기록\(1990~2026-10\)의 겹치지 않는 41번 중 22번/, 'P1743: long-history outcomes replace the one-year record');
  const held = buildMacroCrossroads({ read: null, macroHistory: null, history: [], events: [] });
  assert.equal(held.leadId, null, 'P1742: no lead without observations');
  // Audit 1: branches level on met conditions are named as a tie, and the next release is what separates them.
  if (model.tiedIds.length >= 2) assert.match(model.headline, /조건 충족이 같은.*시나리오가 (둘|셋|넷|다섯|여섯|일곱|여덟)/, 'audit 1: a tie is said as a tie');
  else if (!model.held) assert.match(model.headline, /가장 많이 맞는 시나리오/);
  // v57.69: a tie keeps the previous refresh's lead; 물가 둔화 needs core PCE and core CPI both at or below their 1-year pace.
  if (model.tiedIds.length >= 2) assert.equal(buildMacroCrossroads({ read, macroHistory, history: rows, events, previousLeadId: model.tiedIds[1] }).leadId, model.tiedIds[1], 'v57.69 a tied lead does not flip away from the previous one');
  const easing = BRANCHES.find((branch) => branch.id === 'softland').conditions[0][1];
  assert.equal(easing({ corePace: 2.5, coreYoy: 3, coreCpiPace: 3.6, coreCpiYoy: 2.6 }), false, 'v57.69 a hot core CPI pace is not disinflation');
  assert.equal(easing({ corePace: 2.5, coreYoy: 3, coreCpiPace: null, coreCpiYoy: null }), true, 'v57.69 PCE alone still counts when CPI is unavailable');
  // P1928 (v58.26): the AI 투자 꺾임 gate also opens on semis (SMH) lagging the S&P 500, not only the Nasdaq-100.
  const aiLag = BRANCHES.find((branch) => branch.id === 'aibust').conditions[0][1];
  assert.equal(aiLag({ ndxRel20: -1, smhRel20: -9 }), true, 'P1928 SMH 9pp behind the S&P 500 over 20 sessions opens the AI 투자 꺾임 gate');
  assert.equal(aiLag({ ndxRel20: -1, smhRel20: -2 }), false, 'P1928 small NDX and SMH lags keep the gate closed');
  assert.equal(aiLag({ ndxRel20: null, smhRel20: null }), null, 'P1928 with neither series the gate is 확인 불가');
  // Screen audit 2026-10-19: the regime's leadership break opens it too, so the scenario card cannot lead with oil (2/4)
  // while 오늘 and 브리핑 name the AI-leader correction (10/16: SMH -5.9pp over 20 sessions, under the 8pp lag).
  assert.equal(aiLag({ ndxRel20: -1.7, smhRel20: -5.9, leadershipBreak: true }), true, '2026-10-19 the regime leadership break opens the AI 투자 꺾임 gate');
  assert.equal(aiLag({ ndxRel20: -1.7, smhRel20: -5.9, leadershipBreak: false }), false, '2026-10-19 no break and small lags keep it closed');
  assert.equal(aiLag({ ndxRel20: null, smhRel20: null, leadershipBreak: false }), false, '2026-10-19 a measured holding leadership answers the gate when the lags are missing');
  const oct16 = { ndxRel20: -1.7, smhRel20: -5.9, leadershipBreak: true, payroll3: 51, payrollPrior3: 80, hy20: 53, oilSurging: true, sentimentRank: { percentile: 13, month: '8월', value: 51.7 }, wtiPosition: 0.8 };
  assert.equal(buildMacroCrossroads({ signals: oct16 }).leadId, 'aibust', '2026-10-19 with the leadership break the 10/16 tape leads with AI 투자 꺾임, not 유가 충격');
  // Audit 4: a past sample pointing opposite to the favoured choice carries one bridging sentence (no invented %).
  const bridged = buildMacroCrossroads({ read, macroHistory, history: rows, events, outcomes: { sourceLabel: '장기 일봉 기록', branches: { reheat: { n: 20, up: 19, median: 1.2, from: '1990-01-02', to: '2026-10-09', horizon: 20, baseUpPct: 64 } } } }).items.find((item) => item.id === 'reheat');
  const thin = buildMacroCrossroads({ read, macroHistory, history: rows, events, outcomes: { sourceLabel: '장기 일봉 기록', branches: { reheat: { n: 4, up: 4, median: 1.2, from: '1990-01-02', to: '2026-10-09', horizon: 20 } } } }).items.find((item) => item.id === 'reheat');
  assert.ok(!thin.pastBridge && !/비슷한 때 \d+%/.test(thin.past?.text || ''), 'v57.79 fewer than 10 cases make no "mostly" claim and no hit-rate percentage');
  assert.match(bridged.pastBridge, /^과거 표본과 어긋남 — 비슷한 때 이후 20거래일 주가가 오른 비율이 같은 기록 전체 거래일보다 높았습니다\. 이 시나리오의 결론\(관망·방어 전환\)은 '금리가 더 오르는 시나리오'가 실제로 이어질 때의 비용 기준이며, 표본이 작습니다\.$/, 'v57.84 (audit 4, v57.79 small-sample note): the conflict bridge sentence');
  assert.ok(bridged.pastConflict?.lean === 'defensive', 'v57.84 favored wait/defend with 95% up against a 64% base (n 20) is a past-sample conflict');
  // Audit D1 (owner 2026-10-17): two standard errors, shared with frequencyText — 10/12 against 64% is sampling noise now.
  const noisy = buildMacroCrossroads({ read, macroHistory, history: rows, events, outcomes: { sourceLabel: '장기 일봉 기록', branches: { reheat: { n: 12, up: 10, median: 1.2, from: '1990-01-02', to: '2026-10-09', horizon: 20, baseUpPct: 64 } } } }).items.find((item) => item.id === 'reheat');
  // v58.3x (macro audit D2/D7, owner 2026-10-19): within 2 SE the line gives the counts and the base, no share or median to anchor on.
  assert.ok(!noisy.pastConflict && !noisy.pastBridge && /표본 오차 안에서 구별되지 않았습니다/.test(noisy.past.text) && !/비슷한 때 \d+%|중앙값/.test(noisy.past.text) && /비슷한 시장 움직임으로 고른 비교/.test(readFileSync(new URL('../src/ui/components/macro-crossroads.js', import.meta.url), 'utf8')), 'audit D1/D2 (v58.74: the market-move basis is said once in the section lead): within 2 SE the frequency line says sampling noise');
  {
    // v57.84 (owner 2026-10-16): favored stays; audit D1 (owner 2026-10-17): a conflict needs the up-share past the base rate by two binomial standard errors.
    const { pastConflict } = await import('../src/domain/market/macro-crossroads.js');
    const branch = (favored) => ({ favored, title: 'x — y' });
    assert.equal(pastConflict(branch(['defend', 'wait']), { n: 94, up: 61, baseUpPct: 64 }), null, 'v57.84 65% against a 64% base is the base rate, not a conflict');
    assert.equal(pastConflict(branch(['hold', 'stage']), { n: 73, up: 41, baseUpPct: 64 }), null, 'audit D1: hold/stage with 56% against 64% (n 73) is inside 2 SE');
    assert.equal(pastConflict(branch(['hold', 'stage']), { n: 73, up: 33, baseUpPct: 64 })?.lean, 'risky', 'audit D1: hold/stage with 45% against 64% (n 73) conflicts');
    assert.equal(pastConflict(branch(['stage', 'wait']), { n: 69, up: 30, baseUpPct: 64 }), null, 'v57.84 a mixed pair leans neither way');
    assert.equal(pastConflict(branch(['wait']), { n: 9, up: 9, baseUpPct: 64 }), null, 'v57.84 under 10 cases names no conflict');
    assert.equal(pastConflict(branch(['wait']), { n: 40, up: 39 }), null, 'v57.84 no base rate, no conflict');
  }
  assert.doesNotMatch(bridged.pastBridge, /\d+(\.\d+)?%/, 'audit 4: the bridge invents no percentage');
  // Audit 5: a split exposure (달러) is named instead of "no beneficiary".
  const dollar = model.items.find((item) => item.id === 'dollarsurge');
  assert.ok(dollar.impact.mixed && !/수혜 영역 없음/.test(dollar.impact.firmer), 'audit 5: the mixed exposure is rendered, not "수혜 영역 없음"');
  // Audit 6: WTI and Brent 20-session moves in opposite directions are 엇갈림, not "유가 하락 진행 중".
  const wtiDown = /WTI 20거래일 -/.test(model.rateHub.pathsDown.find((path) => path.id === 'oil').evidence);
  const split = buildMacroCrossroads({ read: { ...read, oil: { brent20: wtiDown ? 0.9 : -0.9, basis: 'futures', abnormal: false } }, macroHistory, history: rows, events }).rateHub.pathsDown.find((path) => path.id === 'oil');
  if (/WTI 20거래일 [+-]/.test(split.evidence)) assert.ok(split.stateText === '혼재' && split.ok == null && /브렌트 [+-]0\.9%/.test(split.evidence), 'audit 6: the WTI/Brent split is labelled 혼재 with both moves');
  // Audit D4 (owner 2026-10-17): the rate hub's "유가 하락" path uses the chain's -5% line, not any decline below zero.
  {
    const withWti = (pct) => { const out = rows.map((row) => ({ ...row })); const idx = out.map((row, i) => (Number(row.wti) > 0 ? i : -1)).filter((i) => i >= 0); const tail = idx.slice(-21); idx.forEach((i) => { out[i].wti = 70; }); tail.forEach((i, k) => { out[i].wti = 70 * (1 + pct / 100 * k / 20); }); return out; };
    const oilPath = (pct) => buildMacroCrossroads({ read: { ...read, oil: { brent20: pct, basis: 'futures', abnormal: false } }, macroHistory, history: withWti(pct), events }).rateHub.pathsDown.find((path) => path.id === 'oil');
    const mild = oilPath(-2);
    assert.ok(mild.ok === false && mild.stateText === '뚜렷한 하락 아님' && /전달 경로 기준\(-5%\)/.test(mild.evidence), `audit D4: WTI −2% is not "유가 하락 진행 중": ${JSON.stringify(mild)}`);
    const deep = oilPath(-7);
    assert.ok(deep.ok === true || deep.stateText === '내려도 높은 수준', `audit D4: WTI −7% is a falling-oil path: ${JSON.stringify(deep)}`);
  }
  // Audit 7/10: every branch names the 거시 axes it tests; the oil-shock branch no longer links to its own screen.
  for (const branch of BRANCHES) assert.ok(branch.axes?.length, `audit 7 ${branch.id}: axes for the six-axis card links`);
  assert.ok(!BRANCHES.find((branch) => branch.id === 'oilshock').explore.some(([route]) => route === 'macro'), 'audit 10: 거시 does not link to itself');
  // Releases: the latest published value is scored against every branch rule; the daily policy rate counts its last change.
  const actuals = releaseActuals(macroHistory);
  assert.ok(actuals['us-cpi']?.period && typeof actuals['us-cpi'].coreMoM === 'number', 'P1743: CPI actual from the published index');
  if (actuals['us-fed-rate']) assert.ok(actuals['us-fed-rate'].upperDelta !== 0, 'P1743: the policy-rate "release" is its last change, not every daily print');
  assert.deepEqual(scoreRelease('us-cpi', { coreMoM: 0.5, headMoM: 0.5 }).map((m) => m.branchId).sort(), ['dollarsurge', 'reheat'], 'P1743: a hot core CPI matches the reheat and dollar rules');
  assert.deepEqual(scoreRelease('us-cpi', { coreMoM: 0.15, headMoM: 0.1 }).map((m) => m.branchId), ['softland'], 'P1743: a soft core CPI matches the soft-landing rule');
  assert.deepEqual(scoreRelease('us-nfp', { payroll: 20, unempDelta: 0.3, wageMoM: 0.2 }).map((m) => m.branchId), ['slowdown'], 'P1743: a weak jobs report matches the slowdown rule');
  const first = scoreNewReleases(macroHistory, {}, 'T1');
  assert.ok(first.scored.length >= 3, 'P1743: the first run scores the latest of each release');
  assert.equal(scoreNewReleases(macroHistory, first.lastScored, 'T2').scored.length, 0, 'P1743: a release is scored once');
  // Themes: one rule for every theme; state × wind decide the choices; rotation reads exposure tags.
  assert.equal(themeStateOf(20, -5), 'pullback'); assert.equal(themeStateOf(-10, 4), 'rebound'); assert.equal(themeStateOf(null, 3), null);
  assert.equal(windFor(['growth', 'aicapex'], { firmer: ['growth'], weaker: [] }), 'tail');
  assert.equal(windFor(['energy'], { firmer: ['growth'], weaker: ['energy'] }), 'head');
  const fakeCross = { leadId: 'softland', altId: 'reheat', items: [{ id: 'softland', title: '물가 둔화 — x', firmer: ['growth', 'aicapex'], weaker: ['energy'] }, { id: 'reheat', title: '물가 재가속 — x', firmer: ['energy'], weaker: ['growth'] }] };
  const groups = [
    { themeId: 'semiconductor', themeName: '반도체', name: 'A', ret1m: -8, ret3m: 5, ret6m: 30, above50Pct: 40, basis: '2026-10-12', current: true },
    { themeId: 'semiconductor', themeName: '반도체', name: 'B', ret1m: -6, ret3m: 4, ret6m: 25, above50Pct: 45, basis: '2026-10-12', current: true },
    { themeId: 'software', themeName: '소프트웨어', name: 'C', ret1m: 9, ret3m: 12, ret6m: 18, above50Pct: 80, basis: '2026-10-12', current: true },
    { themeId: 'energy', themeName: '에너지', name: 'D', ret1m: -4, ret3m: -9, ret6m: -12, above50Pct: 20, basis: '2026-10-12', current: true },
    { themeId: 'stale', themeName: '옛것', name: 'E', ret1m: 50, ret3m: 50, ret6m: 50, basis: '2026-10-01', current: false }
  ];
  const krThemes = [{ id: 'semiconductor', label: '반도체', covered: 5, ret1m: 3, ret3m: 20, above50Pct: 60 }, { id: 'shipbuilding', label: '조선', covered: 2, ret1m: -20, ret3m: -5 }];
  // v57.84 (owner decision 3-2): a stage needs the index on the theme's date — a flat index keeps these cases on their own returns.
  const flatBench = (asOf) => ({ asOf, ret5d: 0, ret1m: 0, ret3m: 0, ret6m: 0, from: {} });
  const playbook = buildThemePlaybook({ usGroups: groups, krThemes, crossroads: fakeCross, credit: 'favorable', benchmarks: { US: flatBench('2026-10-12') }, labels: { semiconductor: '반도체', software: '소프트웨어', energy: '에너지' } });
  assert.ok(buildThemePlaybook({ usGroups: groups, crossroads: fakeCross }).themes.every((row) => row.state === null && /^판정 보류 \(S&P 500 동일가중 종가가 테마 기준일과 맞지 않음\)$/.test(row.stateLabel)), 'v57.84 no index close on the theme date withholds the stage (no absolute fallback)');
  const semi = playbook.themes.find((row) => row.market === 'US' && row.id === 'semiconductor');
  assert.equal(semi.state, 'pullback', 'P1743: a long uptrend with a 1-month drop is read as a pullback inside the trend');
  assert.equal(semi.wind.lead, 'tail', 'P1743: semiconductors get the soft-landing tailwind through their exposure tags');
  assert.deepEqual(semi.favored, ['stage'], 'P1743: pullback × tailwind favours staging in');
  assert.ok(semi.thesis && semi.breaks.length, 'P1743: the structural hypothesis and its break conditions travel with the theme');
  assert.match(semi.fit, /^조건 충족 \d\/5$/, 'P1743: a pullback adds the depth condition');
  const deepPlay = buildThemePlaybook({ usGroups: [{ themeId: 'energy', ret1m: -25, ret3m: 5, ret6m: 8, above50Pct: 35, basis: '2026-10-12', current: true }], crossroads: fakeCross, credit: 'favorable', benchmarks: { US: flatBench('2026-10-12') } });
  assert.deepEqual(deepPlay.themes[0].favored, ['wait'], 'P1743: a drop that took back over half the prior gain is not read as a pause to stage into');
  assert.equal(deepPlay.highlights.structuralPullbacks.length, 0, 'P1743: a deep drop is not surfaced as a structural pullback');
  assert.ok(!playbook.themes.some((row) => row.id === 'stale'), 'P1743: a theme off the latest session is not read as current');
  assert.ok(!playbook.themes.some((row) => row.id === 'shipbuilding'), 'P1743: a KR theme with fewer than three priced members is not read');
  assert.ok(playbook.highlights.structuralPullbacks.some((row) => row.id === 'semiconductor'), 'P1743: structural pullbacks are surfaced generically');
  assert.equal(playbook.themes.find((row) => row.id === 'energy').favored[0], 'wait', 'P1743: weak × headwind favours waiting');
  assert.match(rotationOf(playbook.themes).text, /힘이 옮겨 갔습니다|뚜렷한 가격 기준 강약 이동은|부족해|옮겨 갔는지는 판단하지 않습니다/, 'P1743: rotation is read from exposure tags across all themes');
  assert.doesNotMatch(rotationOf(playbook.themes).text, /자금 이동/, 'audit 15: a price-only rotation is not called a money move');
  {
    const mk = (market, id, ret1m) => ({ market, id, label: id, ret1m, tags: ['growth'] });
    const krHeavy = rotationOf([mk('KR', 'a', 12), mk('KR', 'b', 10), mk('KR', 'c', 9), mk('US', 'd', 8), mk('KR', 'e', -9), mk('KR', 'f', -10), mk('KR', 'g', -11), mk('KR', 'h', -12)].map((row, i) => ({ ...row, tags: [i < 4 ? 'growth' : 'energy'] })));
    // v57.54: one US theme is too thin for a US read, so the sentence mixes markets and every name carries its market word.
    assert.match(krHeavy.text, /미국·한국 테마는/, 'v57.54: a thin US set falls back to all themes and says so');
    assert.match(krHeavy.text, /상위 한국 a\(\+12\.0%\)/, 'audit 15: in a mixed sentence every named theme carries its market');
    assert.doesNotMatch(krHeavy.text, /국내/, "v57.54: the market word is '한국', not the ambiguous '국내'");
    const krOnly = rotationOf([mk('KR', 'a', 12), mk('KR', 'b', 10), mk('KR', 'e', -9), mk('KR', 'f', -10)].map((row, i) => ({ ...row, tags: [i < 2 ? 'growth' : 'defensive'] })));
    assert.ok(krOnly.market === '한국' && /^최근 1개월 한국 테마는/.test(krOnly.text) && !/미국·한국/.test(krOnly.text), `v57.54 review: with no US rows the read says '한국', not '미국·한국' (${krOnly.text})`);
    const usFirst = rotationOf([mk('US', 'u1', 9), mk('US', 'u2', 7), mk('US', 'u3', -6), mk('US', 'u4', -8), mk('KR', 'k1', 20), mk('KR', 'k2', 12), mk('KR', 'k3', -15), mk('KR', 'k4', -23)].map((row, i) => ({ ...row, tags: [i % 4 < 2 ? 'growth' : 'energy'] })));
    assert.match(usFirst.text, /^최근 1개월 미국 테마는/, 'v57.54: with enough US themes the rotation is read on the US set first');
    assert.match(usFirst.text, /상위 u1\(\+9\.0%\)/, 'v57.54: US names lead without a market word');
    assert.match(usFirst.text, / 한국은 1개월 상위 k1\(\+20\.0%\), k2\(\+12\.0%\), 하위 k4\(-23\.0%\)/, 'v57.54: Korea follows as one short secondary line');
  }
  const themeText = renderThemePlaybookContext(playbook, { query: '반도체 지금 분할로 들어가도 돼?' });
  assert.match(themeText, /반도체: 추세 속 조정/, 'P1743: a named theme is always in the AI block');
  assert.match(themeText, /가설이 깨지는 신호/);
  assert.doesNotMatch(themeText, noProbability); assert.doesNotMatch(themeText, noInstruction);
  assert.match(themeText, /레버리지·포지션 쏠림은 직접 자료가 없다/, 'P1743: positioning claims need a web source');
  // Producers: per-refresh state (no network) with diff + scoring + snapshots; weekly long history is a pure function.
  const screener = JSON.parse(readFileSync(new URL('../public-data/screener.json', import.meta.url), 'utf8'));
  const calendar = JSON.parse(readFileSync(new URL('../public-data/macro-calendar.json', import.meta.url), 'utf8'));
  const state1 = buildScenarioState({ data, history: rows, macroHistory, calendar, screener, themeMaps: maps, previous: null, nowMs: now });
  assert.equal(state1.schemaVersion, 'scenario-state.v1');
  assert.equal(state1.crossroads.items.length, BRANCHES.length, 'P1743: the state carries every branch');
  assert.ok(state1.themes.length >= 20, `P1743: the state reads every measured theme (${state1.themes.length})`);
  assert.ok(state1.eventOutcomes.length >= 3 && state1.eventOutcomes.every((row) => row.actualText && Array.isArray(row.matched)), 'P1743: releases scored on the first run');
  // v58.75 (persona review): 거시 printed scenario-state.json's rotation (written by the group-median rule, 크립토 -25.1%) while
  // 테마 recomputed it with pooled members (-44.7%). The state stamps its playbook version, every reader goes through
  // themeRotationRead (live first, a mismatched artifact never), and a same-version artifact on the same US close must
  // carry the numbers the live pipeline computes from the same files.
  {
    const { themeRotationRead, THEME_PLAYBOOK_VERSION } = await import('../src/domain/scenarios/theme-playbook.js');
    assert.equal(state1.playbookVersion, THEME_PLAYBOOK_VERSION, 'v58.75: the state stamps the playbook version of its theme rows');
    const liveModel = { available: true, rotation: { text: 'LIVE' }, highlights: { structuralPullbacks: [{ market: 'US', id: 'a', label: 'A', ret1m: -1 }] } };
    const sameVersion = { playbookVersion: THEME_PLAYBOOK_VERSION, rotation: { text: 'ART' }, themes: [{ market: 'US', id: 'b', label: 'B', ret1m: 2 }], highlights: { structuralPullbacks: ['US:b'] } };
    assert.equal(themeRotationRead({ live: liveModel, artifact: sameVersion }).text, 'LIVE', 'v58.75: the live playbook wins over the artifact');
    assert.deepEqual(themeRotationRead({ artifact: sameVersion }).pullbacks.map((row) => row.id), ['b'], 'v58.75: a same-version artifact stands in before the live read exists');
    assert.equal(themeRotationRead({ artifact: { ...sameVersion, playbookVersion: undefined } }).source, null, 'v58.75: an artifact without the current version is not printed');
    const published = JSON.parse(readFileSync(new URL('../public-data/scenario-state.json', import.meta.url), 'utf8'));
    if (published.playbookVersion === THEME_PLAYBOOK_VERSION && published.basis?.themeAsOfByMarket?.US && published.basis.themeAsOfByMarket.US === state1.basis.themeAsOfByMarket?.US) {
      const recomputed = new Map(state1.themes.filter((row) => row.market === 'US').map((row) => [row.id, row.ret1m]));
      const drift = published.themes.filter((row) => row.market === 'US' && recomputed.has(row.id) && row.ret1m != null && recomputed.get(row.id) != null && Math.abs(row.ret1m - recomputed.get(row.id)) > 0.2);
      assert.equal(drift.length, 0, `v58.75: scenario-state.json US theme 1-month values match the live pipeline on the same close (${drift.map((row) => row.id + ' ' + row.ret1m + ' vs ' + recomputed.get(row.id)?.toFixed(2)).join(', ')})`);
    } else console.log(`scenario-state.json playbook ${published.playbookVersion || 'unstamped'} / US ${published.basis?.themeAsOfByMarket?.US || '?'}: same-close comparison waits for the next refresh`);
  }
  const state2 = buildScenarioState({ data, history: rows, macroHistory, calendar, screener, themeMaps: maps, previous: state1, nowMs: now + 3600000 });
  assert.equal(state2.transitions.length, state1.transitions.length, 'P1743: an unchanged market adds no transitions');
  assert.equal(state2.eventOutcomes.length, state1.eventOutcomes.length, 'P1743: releases are not re-scored');
  // Live 2026-10-21: a held theme (state null, 판정 보류) is not a stage move by design, and the first live theme was one;
  // the fixture moves the first theme that has a stage. v59.49 (CI 10-30 07:37Z): on a day every live theme was held there
  // was none and the gate failed on the market, so the baseline gives the first theme a stage when none has one.
  const baseline = JSON.parse(JSON.stringify(state1));
  assert.ok(baseline.themes.length > 0, 'P1743: the state carries theme rows');
  if (!baseline.themes.some((row) => row.state)) baseline.themes[0].state = 'leading';
  const moved = JSON.parse(JSON.stringify(baseline));
  moved.crossroads.leadId = moved.crossroads.items.find((item) => item.id !== baseline.crossroads.leadId).id;
  const stagedTheme = moved.themes.find((row) => row.state);
  stagedTheme.state = stagedTheme.state === 'leading' ? 'weak' : 'leading';
  const diffs = diffSnapshots(moved, baseline, 'T');
  assert.ok(diffs.some((row) => row.kind === 'lead') && diffs.some((row) => row.kind === 'theme'), 'P1743: lead and theme-stage changes are logged');
  const rotationNow = { rotation: { top: { strong: 'a', weak: 'b', scope: '미국' } } };
  assert.ok(!diffSnapshots({ rotation: { top: { strong: 'c', weak: 'b' } } }, rotationNow, 'T').some((row) => row.kind === 'rotation'), 'v57.54: a theme-scope change (all themes to US-only) is not logged as a rotation');
  assert.ok(diffSnapshots({ rotation: { top: { strong: 'c', weak: 'b', scope: '미국' } } }, rotationNow, 'T').some((row) => row.kind === 'rotation'), 'v57.54: a rotation within the same scope is logged');
  const series = (n, f) => Array.from({ length: n }, (_, i) => [new Date(Date.UTC(1990, 0, 1) + i * 86400000).toISOString().slice(0, 10), f(i)]);
  const outcomes = buildScenarioOutcomes({ market: { spx: series(3000, (i) => 100 + i * 0.05 + 10 * Math.sin(i / 40)), tnx: series(3000, (i) => 5 + Math.sin(i / 30)), vix: series(3000, (i) => 18 + 12 * Math.sin(i / 25)), wti: series(3000, (i) => 50 + 20 * Math.sin(i / 35)), dxy: series(3000, (i) => 95 + 5 * Math.sin(i / 50)) }, proxies: { SMH: series(3000, (i) => 50 + i * 0.02 + 8 * Math.sin(i / 20)) }, themeProxy: { semiconductor: 'SMH' } });
  assert.ok(Object.keys(outcomes.branches).length >= 6 && outcomes.branches.reheat.n > 0 && outcomes.branches.reheat.h63, 'P1743: weekly producer computes 20/63-session branch outcomes');
  assert.ok(Object.keys(THEME_STATES).every((stage) => outcomes.themes.semiconductor[stage]?.n != null) && outcomes.themes.semiconductor.symbol === 'SMH', 'P1743: theme-stage outcomes per proxy ETF');
  assert.ok(themeStateOutcomes([]).leading.n === 0);
  // Wiring: the narrative producer, the screens and the workflow.
  assert.match(buildMarketAnalysisRegimeContext(data, rows), /【향후 시나리오/, 'P1742: the narrative producer gets the forward branches');
  const { chooseAnswerMode } = await import('../src/ai/response/answer-modes.js');
  assert.equal(chooseAnswerMode({ intent: { canonical: ['OUTLOOK'] } }), 'outlook', 'P1742: a market outlook question is answered as branches');
  assert.equal(chooseAnswerMode({ asksDecision: true, hasTicker: true, intent: { canonical: ['OUTLOOK'] } }), 'decision', 'P1742: a single-company decision stays a decision');
  const component = readFileSync(new URL('../src/ui/components/macro-crossroads.js', import.meta.url), 'utf8');
  assert.match(component, /if \(alt\) cards\.append\(pathCard\(doc, root, alt, \{ kicker: '대안 시나리오'/, 'P1742: the compact block never shows one path alone (v57.54: as the second path card)');
  assert.match(component, /refreshScenarioArtifacts/, 'P1743: screens load the long-history outcomes and the per-refresh state');
  const themesPage = readFileSync(new URL('../src/ui/pages/themes.js', import.meta.url), 'utf8');
  assert.match(themesPage, /renderThemePlaybook\(/, 'P1743: 테마 renders the theme playbook');
  const marketContent = readFileSync(new URL('../src/ai/context/market-content.js', import.meta.url), 'utf8');
  assert.match(marketContent, /renderThemePlaybookContext/, 'P1743: the chat gets the theme playbook');
  const workflow = readFileSync(new URL('../.github/workflows/refresh-data.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node scripts\/build-scenario-state\.mjs/, 'P1743: the state recomputes every refresh');
  assert.match(workflow, /node scripts\/build-scenario-outcomes\.mjs/, 'P1743: long history refreshes weekly');
  assert.match(workflow, /stage_if_exists public-data\/scenario-state\.json/);
  assert.match(workflow, /stage_if_exists public-data\/scenario-outcomes\.json/);
  assert.ok(workflow.indexOf('build-scenario-state.mjs') < workflow.indexOf('sync-data-release-manifests.mjs'), 'P1743: state is built before the release is promoted');
  const { chooseAnswerVisuals } = await import('../src/ui/components/ai-answer-visuals.js');
  assert.deepEqual(chooseAnswerVisuals({ query: '앞으로 시장 어떻게 대응해야 돼?', mode: 'outlook' }).map((p) => p.kind), ['crossroads'], 'P1743: a market outlook answer carries the branch table');
  assert.deepEqual(chooseAnswerVisuals({ query: '반도체 조정인데 분할로 들어갈까?', mode: 'outlook' }).map((p) => p.kind), ['crossroads', 'themes'], 'P1743: a theme outlook answer also carries the theme stages');
  assert.match(readFileSync(new URL('../src/ai/response/answer-modes.js', import.meta.url), 'utf8'), /거시 전략가·업종 애널리스트·위험 관리자/, 'P1743: outlook answers contrast expert lenses');
  console.log('scenario guidance fixture (macro crossroads + theme playbook + scenario producers): PASS');
}

// v57.81 (owner 2026-10-15): "지금 추세가 양호가 맞아? 이번주는 반도체와 러셀이 같이 떨어지는데" — the trend axis needs a 1%
// buffer over a rising 50-day line, the Nasdaq-100 / Russell 2000 cap it at 중립 when they break together, and 소수 종목 주도
// needs the leaders to be holding (leadershipBreak). Synthetic closes shaped like 10/14 (S&P 500 +0.15% over its 50-day
// line, Nasdaq-100 -3.9% in five sessions, Russell 2000 under its 200-day line, new lows 40 > new highs 28, 39% advancing,
// 7 distribution days), a clean uptrend and an intact narrow tape.
{
  const { resolveMarketCalendarSession } = await import('../src/domain/market/market-calendar.js');
  const { leadershipBreakOf } = await import('../src/domain/briefing/market-read.js');
  const { TRANSITION_TITLE, renderMarketScenarioContext } = await import('../src/domain/market/regime-scenarios.js');
  const { leadershipClaimIssues } = await import('./lib/market-analysis-validate.mjs');
  const days = [];
  for (let t = Date.parse('2025-07-01T12:00:00Z'); t <= Date.parse('2026-10-14T12:00:00Z'); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10), weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && resolveMarketCalendarSession({ market: 'US', date }).status !== 'closed') days.push(date);
  }
  const n = days.length;
  // spxGap: the last close's distance above its own 50-day average; ndxDrop5: the last five sessions' Nasdaq-100 move.
  const make = ({ spxGap, ndxDrop5, rutBelow200, breadth50, breadth200, adv, highs, lows, dist }) => {
    const spx = days.map((_, i) => 6000 + i * 6);
    const sum49 = spx.slice(n - 50, n - 1).reduce((a, b) => a + b, 0);
    spx[n - 1] = (1 + spxGap / 100) * sum49 / (50 - (1 + spxGap / 100));
    const ndx = days.map((_, i) => 20000 + i * 30);
    const base = ndx[n - 6];
    for (let k = 1; k <= 5; k += 1) ndx[n - 6 + k] = base * (1 + ndxDrop5 / 100 * k / 5);
    const rut = days.map((_, i) => rutBelow200 ? (i < n - 40 ? 2800 : 2800 - (i - (n - 40)) * 3) : 2000 + i * 3);
    return days.map((date, i) => ({ date, spx: spx[i], ndx: ndx[i], nasdaq: ndx[i] * 0.9, rut: rut[i], vix: 16.87, vix3m: 19.5, tnx: 4.1, wti: 80, dxy: 100, gold: 2000,
      breadth50, breadth200, breadth20: breadth50 + 10, advanceRatio: i >= n - 5 ? adv : 0.55 /* audit 2026-10-17 D1: the advance confirmation is the 5-session mean */, breadthNewHighs: highs, breadthNewLows: lows, distributionDays: dist }));
  };
  const asOf = days[n - 1];
  const calmCredit = { hyBp: 290, hyAsOf: asOf, hyDelta5Bp: -4, hyDelta20Bp: 5 };
  const run = (history, credit = calmCredit) => {
    const input = { history, credit, rates: {} };
    const regime = buildMarketRegime(input);
    const scenarios = buildMarketScenarios(input, { regime });
    return { input, regime, scenarios, outlook: buildScenarioOutlook({ scenarios, regime }), trend: regime.axes.find((axis) => axis.id === 'trend') };
  };

  // 10/14 shape (HY 316bp, +13bp in five sessions, +40bp in twenty: credit 중립).
  const oct14 = run(make({ spxGap: 0.15, ndxDrop5: -3.9, rutBelow200: true, breadth50: 33.6, breadth200: 48.9, adv: 0.39, highs: 28, lows: 40, dist: 7 }), { hyBp: 316, hyAsOf: asOf, hyDelta5Bp: 13, hyDelta20Bp: 40 });
  assert.equal(oct14.trend.state, 'neutral', `v57.81 a close 0.15% over the 50-day line is 중립, not 양호 (${oct14.trend.read})`);
  assert.ok(oct14.trend.testing && /50일선보다 0\.\d% 위 — 50일선 근처에서 버티는 구간/.test(oct14.trend.read), 'v57.81 inside ±1% the trend read says the index is testing the 50-day line');
  assert.ok(oct14.trend.capped && /나스닥 100이 5거래일 -3\.9%/.test(oct14.trend.read) && /러셀 2000은 200일선 아래/.test(oct14.trend.read), `v57.81 the cross-index cap is named in plain Korean (${oct14.trend.read})`);
  const labels = oct14.trend.evidence.map(([label]) => label);
  assert.ok(labels.includes('나스닥 100') && labels.includes('러셀 2000') && labels.includes('50일선 대비'), `v57.81 trend evidence carries the Nasdaq-100 and Russell 2000 rows (${labels})`);
  assert.match(oct14.trend.evidence.find(([label]) => label === '러셀 2000')[1], /50일선 -\d+\.\d%, 200일선 -\d+\.\d%, 1년 고점 대비 -\d+\.\d%/, 'v57.81 the Russell 2000 row shows its 50/200-day and one-year-high distances');
  assert.equal(oct14.regime.leadershipBreak, true, 'v57.81 leaders -3.9% with four market-wide confirmations is a leadership break');
  assert.equal(oct14.regime.leadership.met, 4);
  { // P1927 (v58.23): the briefing reads the same leadership-break verdict as 시장 상태 and leads with it.
    const { buildMarketRead } = await import('../src/domain/briefing/market-read.js');
    const read = buildMarketRead(oct14.input);
    const ids = [...(read.lead || []), ...(read.statements || []), ...(read.drivers || [])].map((row) => row.id);
    assert.ok(ids.includes('leadership-break'), `P1927 a leadership break in 시장 상태 must appear as the briefing's leadership-break statement (${ids})`);
  }
  assert.equal(oct14.scenarios.scenarios.find((item) => item.id === 'concentration').confirmed, false, 'v57.81 소수 종목 주도 is not confirmed during a leadership break');
  assert.notEqual(oct14.outlook.leadId, 'concentration', 'v57.81 소수 종목 주도 is not the selected flow on 10/14 numbers');
  // Audit 2026-10-17 (owner D2): after weeks above +1%, a close +0.5% over the rising 50-day line holds 양호; under the line it is 중립.
  const calmShape = { ndxDrop5: 0.5, rutBelow200: false, breadth50: 62, breadth200: 64, adv: 0.55, highs: 40, lows: 10, dist: 2 };
  const held = run(make({ ...calmShape, spxGap: 0.5 }));
  assert.equal(held.trend.state, 'favorable', `D2 +0.5% after a +1% run holds 양호 (${held.trend.read})`);
  assert.match(held.trend.read, /50일선 아래로 마감하기 전까지 유지/, 'D2 the held 양호 says what ends it');
  assert.equal(run(make({ ...calmShape, spxGap: -0.3 })).trend.state, 'neutral', 'D2 a close under the 50-day line ends the hold');
  // D1: one weak session in five no longer confirms — the 5-session mean of 0.55 x4 and 0.39 is 0.52.
  const oneWeak = make({ spxGap: 0.15, ndxDrop5: -3.9, rutBelow200: true, breadth50: 33.6, breadth200: 48.9, adv: 0.39, highs: 28, lows: 40, dist: 7 }).map((row, i, rows) => i >= rows.length - 5 && i < rows.length - 1 ? { ...row, advanceRatio: 0.55 } : row);
  const advance = run(oneWeak, { hyBp: 316, hyAsOf: asOf, hyDelta5Bp: 13, hyDelta20Bp: 40 }).regime.leadership.confirmations.find((item) => item.id === 'advance');
  assert.equal(advance.ok, false, `D1 one session under 45% in five is not the advance confirmation (${advance.value})`);
  assert.match(advance.value, /5거래일 평균 51\.8%/, 'D1 the confirmation names the 5-session mean');
  const conc = oct14.outlook.items.find((item) => item.id === 'concentration');
  assert.ok(conc.total === 5 && /주도 영역 유지 미충족\(주도 영역 이탈\)/.test(conc.basis), `v57.81 concentration lists 주도 영역 유지 as its 5th check (${conc.basis})`);
  const weak = oct14.outlook.items.find((item) => item.id === 'weakness');
  assert.ok(oct14.outlook.leadId === 'weakness' && weak.transition && weak.title === TRANSITION_TITLE, `v57.81 the transition branch leads (${oct14.outlook.headline})`);
  assert.ok(/확인:/.test(weak.posture) && /반증:/.test(weak.posture) && /다음 확인: 10\/15 미국 확정 종가/.test(weak.posture), `v57.81 the transition names what confirms, what refutes and the next checkpoint (${weak.posture})`);
  assert.doesNotMatch(`${weak.posture} ${oct14.outlook.headline}`, /가능성|확률|매수|매도|비중/, 'v57.81 the transition is descriptive: no likelihood, no trade instruction (R706)');
  assert.ok(!JSON.stringify(oct14.regime.axes).includes('추세는 양호') && !oct14.regime.conflicts.some((line) => line.includes('추세는 양호')), 'v57.81 no 추세 양호 wording anywhere while the axis is neutral');
  const context = renderMarketScenarioContext(oct14.input, { regime: oct14.regime });
  assert.match(context, /주도 영역 이탈\(leadershipBreak\): 예/, 'v57.81 the AI scenario context carries the leadership-break flag');
  // The AI narrative: "semis lead" while the flag is on is rejected unless the sentence names the recent drop.
  assert.deepEqual(leadershipClaimIssues('미국은 인공지능 인프라·반도체가 거시 부담에도 주도했습니다.', { context }), ['leadership-claim-during-break'], 'v57.81 the 10/15 sentence is rejected under the flag');
  assert.deepEqual(leadershipClaimIssues('반도체가 그동안 주도했지만 나스닥 100은 5거래일 -3.9% 밀렸습니다.', { context }), [], 'v57.81 naming the drop passes');
  assert.deepEqual(leadershipClaimIssues('반도체가 다시 주도하는지 다음 종가에서 확인합니다.', { context }), [], 'v57.81 a conditional is not a claim');
  assert.deepEqual(leadershipClaimIssues('미국은 인공지능 인프라·반도체가 주도했습니다.', { context: '주도 영역 이탈(leadershipBreak): 아니오.' }), [], 'v57.81 without the flag the rule is silent');

  // The cap alone: S&P 500 3% over its rising 50-day line, but leaders -4% in five sessions and small caps under the 200-day line.
  const capped = run(make({ spxGap: 3, ndxDrop5: -4, rutBelow200: true, breadth50: 45, breadth200: 52, adv: 0.5, highs: 30, lows: 20, dist: 4 }));
  assert.ok(capped.trend.state === 'neutral' && capped.trend.capped && !capped.trend.testing, 'v57.81 the Nasdaq-100 / Russell 2000 cap holds the trend at 중립 above the buffer');

  // Clean uptrend: S&P 500 3% over a rising 50-day line, broad participation, leaders rising.
  const clean = run(make({ spxGap: 3, ndxDrop5: 1.5, rutBelow200: false, breadth50: 66, breadth200: 70, adv: 0.62, highs: 80, lows: 5, dist: 2 }));
  assert.equal(clean.trend.state, 'favorable', `v57.81 a clean uptrend stays 양호 (${clean.trend.read})`);
  assert.ok(clean.regime.leadership.state === 'holding' && !clean.regime.leadershipBreak);
  assert.ok(clean.scenarios.scenarios.find((item) => item.id === 'expansion').confirmed && clean.outlook.leadId === 'expansion', 'v57.81 a clean uptrend stays 고른 상승');

  // Narrow but intact leadership: Nasdaq-100 rising, breadth weak, no new-low excess.
  const narrow = run(make({ spxGap: 3, ndxDrop5: 1.2, rutBelow200: false, breadth50: 34, breadth200: 38, adv: 0.52, highs: 40, lows: 12, dist: 3 }));
  assert.equal(narrow.trend.state, 'favorable');
  assert.ok(narrow.regime.leadership.state === 'holding' && narrow.scenarios.scenarios.find((item) => item.id === 'concentration').confirmed && narrow.outlook.leadId === 'concentration', 'v57.81 narrow but intact leadership stays 소수 종목 주도');
  assert.ok(!narrow.outlook.items.some((item) => item.transition), 'v57.81 no transition without a break');

  // A single bad week in the leaders with no market-wide confirmation is not a break.
  const oneWeek = run(make({ spxGap: 3, ndxDrop5: -3.5, rutBelow200: false, breadth50: 34, breadth200: 38, adv: 0.5, highs: 40, lows: 12, dist: 3 }));
  assert.ok(oneWeek.regime.leadership.proxyWeak && !oneWeek.regime.leadershipBreak, 'v57.81 the leaders falling alone (0 of 4 confirmations) is not a leadership break');
  assert.equal(leadershipBreakOf({}, asOf).state, 'unknown', 'v57.81 a missing proxy is 확인 불가, never holding');
  // v57.83 crash replay (2026-07-28: Nasdaq-100 -9.5% from its high read 'holding'): weak leaders without the confirmations
  // are 'weak', which the scenario cards, the AI packet and the claim validator all treat as not holding.
  assert.equal(oneWeek.regime.leadership.state, 'weak', 'v57.83 the leaders falling alone read 주도주 약세, not 유지');
  assert.ok(oneWeek.regime.conflicts.some((text) => /^주도주 약세 — 나스닥 100 5거래일 -3\.5%/.test(text)), 'v57.83 the weak leaders are named among the conflicts');
  const weakContext = renderMarketScenarioContext(oneWeek.input, { regime: oneWeek.regime });
  assert.match(weakContext, /주도 영역 이탈\(leadershipBreak\): 확산 미확인/, 'v57.83 the AI scenario context does not say 아니오 for weak leaders');
  assert.deepEqual(leadershipClaimIssues('반도체가 시장을 주도했습니다.', { context: weakContext }), ['leadership-claim-during-break'], 'v57.83 "semis lead" is rejected while the leaders are weak');
  assert.notEqual(oneWeek.scenarios.scenarios.find((item) => item.id === 'concentration').confirmed, true, 'v57.83 소수 종목 주도 is not confirmed with weak leaders');
  // R707: "under the 50-day line" needs the 1% buffer (2026-08-06 read a break at -0.0% in a +4.5% week).
  const atLine = { ndx: { value: 99.5, ma50: 100, d5: 95, yearMax: 104, date: asOf } };
  assert.ok(!leadershipBreakOf(atLine, asOf).belowMa50 && leadershipBreakOf(atLine, asOf).state === 'holding', 'v57.83 0.5% under the 50-day line is inside the buffer');
  const under = { ndx: { value: 95, ma50: 100, d5: 96, yearMax: 105, date: asOf } };
  assert.ok(leadershipBreakOf(under, asOf).belowMa50 && leadershipBreakOf(under, asOf).state !== 'holding' && /1년 고점 대비 -9\.5%/.test(leadershipBreakOf(under, asOf).summary), 'v57.83 5% under the line is weak and names the drawdown');
  console.log('scenario guidance fixture (v57.81 trend buffer, cross-index cap, leadership break, transition, AI claim rule): PASS');
}

// v57.81 (home/market audit GROUP M + portfolio/KR audit): the other axes had the same defect classes — a 20-session HY
// widening that could never reach 부담, rates flipping on one week's sign, VIX 양호 1pt off its edge after a +12% week,
// "회복 중" on a reversal day, a +1.2pp "함께 넓어짐", two different won windows, an unnamed F&G -14, lagging RRG shown as
// current leadership, a 0.23pp dollar call, and narrative state words that contradict the packet.
{
  const { latchedState, recoveryCheck, usdKrwWindow, hyWidening20Record, creditState, buildMarketRead } = await import('../src/domain/briefing/market-read.js');
  const { breadthFlow } = await import('../src/domain/market/page-flow.js');
  const { buildKoreaRegimeObservations } = await import('../src/domain/market/regime-scenarios.js');
  const { buildSentimentModel } = await import('../src/ui/components/sentiment-board.js');
  const { sectorRecentCheck, leaderFading, rrgBorder } = await import('../src/domain/market/scenario-outlook.js');
  const { axisStateClaimIssues, crossMarketDateIssues } = await import('./lib/market-analysis-validate.mjs');
  const { resolveMarketCalendarSession } = await import('../src/domain/market/market-calendar.js');
  const days = [];
  for (let t = Date.parse('2025-07-01T12:00:00Z'); t <= Date.parse('2026-10-14T12:00:00Z'); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10), weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && resolveMarketCalendarSession({ market: 'US', date }).status !== 'closed') days.push(date);
  }
  const n = days.length;
  const now = Date.parse('2026-10-15T09:00:00Z');
  const build = (patch = () => ({})) => days.map((date, i) => ({ date, spx: 6000 + i * 6, vix: 15, vix3m: 19.5, tnx: 4.2, dxy: 100, wti: 80, gold: 2000, usdkrw: 1400, breadth50: 50, breadth200: 55, ...patch(i) }));
  const axisOf = (history, id, extra = {}) => buildMarketRegime({ history, now, ...extra }).axes.find((axis) => axis.id === id);

  // Credit: a +40bp 20-session widening at the top of its own record is 부담; hysteresis holds it until under +25bp.
  const hyObs = (tail) => days.map((date, i) => [date, 3 + 0.04 * Math.sin(i / 3) + (i >= n - tail.length ? tail[i - (n - tail.length)] : 0)]);
  const rise = Array.from({ length: 20 }, (_, k) => 0.4 * (k + 1) / 20);
  const record = hyWidening20Record({ series: { hyOas: { observations: hyObs(rise) } } }, days.at(-1));
  assert.ok(record.stress && record.value >= 35 && record.pct >= 90, `v57.81 HY +40bp in 20 sessions at the top of its record enters 부담 (${JSON.stringify(record)})`);
  const credit = axisOf(build(), 'credit', { credit: { hyBp: 340, hyAsOf: days.at(-1), hyDelta5Bp: 8 }, macroHistory: { series: { hyOas: { observations: hyObs(rise) } } } });
  assert.ok(credit.state === 'burden' && /20거래일 동안 \+\d+bp 넓어졌습니다\(지난 \d+번의 20거래일 변화 중 (가장 큰 폭|상위 \d+%)/.test(credit.read), `v57.81 (v57.91 rank words) the credit axis says the 20-session condition fired (${credit.read})`);
  assert.equal(creditState({ hyBp: 316, hy5: 13, hy20: 40 }), 'neutral', 'v57.81 without the record flag a +40bp month stays 중립 (the record decides)');
  assert.equal(creditState({ hyBp: 316, hy5: 13, hy20: 40, hy20Stress: true }), 'burden');
  {
    // v57.83 codex audit F06: the macro chain and gauge name the 20-session record as the cause, never "수준이 부담".
    const { buildMacroRead } = await import('../src/domain/macro/macro-read.js');
    const mh = { schemaVersion: 'macro-history.v1', series: { hyOas: { observations: hyObs(rise) } } };
    const macroRead = buildMacroRead({ macro: { hyOAS: 3.16, hyOASDelta5: 0.13 }, macroHistory: mh, regime: { axes: [{ id: 'credit', state: 'burden' }] } });
    const branch = macroRead.chain.branches.find((b) => b.id === 'credit');
    assert.ok(/20거래일 \+\d+bp 확대/.test(branch.effect) && !/수준이 부담/.test(branch.effect), `v57.83 the credit chain names the 20-session widening (${branch.effect})`);
    assert.match(macroRead.sharedGauges.credit.gauge.label, /20거래일 변화/, 'v57.83 the credit gauge draws the input that decided the burden');
    const levelRead = buildMacroRead({ macro: { hyOAS: 4.8, hyOASDelta5: 0.02 }, macroHistory: mh, regime: { axes: [{ id: 'credit', state: 'burden' }] } });
    assert.match(levelRead.chain.branches.find((b) => b.id === 'credit').effect, /스프레드 수준\(480bp\)이 부담 구간/, 'v57.83 a level burden still says the level');
  }
  const latch = latchedState([{ date: 'a', value: 40 }, { date: 'b', value: 30 }, { date: 'c', value: 26 }], (p) => p.value >= 35, (p) => p.value < 25);
  const released = latchedState([{ date: 'a', value: 40 }, { date: 'b', value: 30 }, { date: 'c', value: 20 }], (p) => p.value >= 35, (p) => p.value < 25);
  assert.ok(latch.on && latch.since === 'a' && !released.on, 'v57.81 hysteresis: entered at 40, held at 30/26, released under 25');

  // Rates: at 91% of the one-year range, 20 sessions +18bp and 5 sessions -9bp stays 부담 (held), and leaves under 80%.
  const tail = [4.68, 4.64, 4.7, 4.72, 4.71, 4.65, 4.7, 4.74, 4.7, 4.64, 4.66, 4.67, 4.72, 4.76, 4.8, 4.8, 4.76, 4.78, 4.81, 4.84, 4.94, 4.97, 4.96, 5, 5.01, 4.95, 5, 4.96, 4.97, 5.11, 5.16, 5.18, 5.24, 5.26, 5.29, 5.24, 5.28, 5.31, 5.27, 5.28, 5.23, 5.24, 5.24, 5.22, 5.19];
  const tnxAt = (i, last = 5.19) => i < n - tail.length ? 4 + 0.6 * i / (n - tail.length) : i === n - 1 ? last : tail[i - (n - tail.length)];
  const rates = axisOf(build((i) => ({ tnx: tnxAt(i) })), 'rates');
  assert.ok(rates.state === 'burden' && /되돌렸지만/.test(rates.read) && /부터(\)| 이어지고)/.test(rates.read) /* v57.91 wording: "부담 판정은 8/31부터 이어지고 있습니다" */, `v57.81 a 5-day dip at the top of the range does not flip 부담 to 중립 (${rates.state}: ${rates.read})`);
  assert.notEqual(axisOf(build((i) => ({ tnx: tnxAt(i, 4.95) })), 'rates').state, 'burden', 'v57.81 falling under 80% of the range releases the rates 부담');

  // Volatility: VIX 16.87 after +11.9% in five sessions is 중립 and the read names the rise; a quiet 15 is 양호.
  const vixLast = (prev5, last) => build((i) => ({ vix: i === n - 1 ? last : i === n - 6 ? prev5 : 15 }));
  const rising = axisOf(vixLast(15.07, 16.87), 'volatility');
  assert.ok(rising.state === 'neutral' && /5일 \+12% 올라/.test(rising.read), `v57.81 VIX 16.87 after a +12% week is not 양호 (${rising.read})`);
  assert.equal(axisOf(build(), 'volatility').state, 'favorable', 'v57.81 a quiet VIX 15 stays 양호');
  assert.equal(axisOf(vixLast(17.2, 17.5), 'volatility').state, 'neutral', 'v57.81 within 1pt of 18 and rising is 중립');
  assert.equal(axisOf(vixLast(17.8, 17.5), 'volatility').state, 'favorable', 'v57.81 within 1pt of 18 but falling stays 양호');

  // Dollar: +2.2% in 20 sessions mid-range is named but not 부담; +2.6%, or +2.2% at the top of its range, is 부담.
  const dxyRun = (last, earlyHigh) => build((i) => ({ dxy: i === n - 1 ? last : i < n - 120 && earlyHigh ? 104 : 100 }));
  const edge = axisOf(dxyRun(102.2, true), 'commodities');
  assert.ok(edge.state === 'neutral' && /기준\(\+2%\)을 조금 넘었지만/.test(edge.read), `v57.81 DXY +2.2% mid-range is not 부담 (${edge.read})`);
  assert.equal(axisOf(dxyRun(102.6, true), 'commodities').state, 'burden', 'v57.81 DXY past the buffer is 부담');
  assert.equal(axisOf(dxyRun(102.2, false), 'commodities').state, 'burden', 'v57.81 DXY past the line at the top of its range is 부담');

  // Won: one 20-session window for the axis and the card; a base on a one-day spike is not a direction; won strength
  // beside a KOSPI fall of 5%+ is 혼조, not 양호.
  const spike = build((i) => ({ usdkrw: i === n - 21 ? 1376.6 : 1340 }));
  const krwAxis = axisOf(spike, 'korea');
  const card = buildKoreaRegimeObservations({ history: spike }, { nowMs: now, through: days.at(-1) }).cards.find((item) => item.id === 'usdkrw');
  const window = usdKrwWindow(spike.map((row) => ({ date: row.date, value: row.usdkrw })));
  assert.ok(window && !window.agrees && window.direction === null && krwAxis.state === 'neutral', `v57.81 a one-day spike at the base is not a won direction (${JSON.stringify(window && { change: window.change, meanShift: window.meanShift })})`);
  assert.ok(Math.abs(card.change - window.change) < 1e-9 && krwAxis.evidence.find(([label]) => label === '원/달러')[1].includes(`20거래일 ${window.change.toFixed(1)}%`), 'v57.81 the 원/달러 card and the 환율 axis quote the same 20-session change');
  const glide = build((i) => ({ usdkrw: i >= n - 20 ? 1400 - 60 * (i - (n - 21)) / 20 : 1400, kospi: i >= n - 21 ? 4000 * (1 - 0.2 * (i - (n - 21)) / 20) : 4000 }));
  const mixed = axisOf(glide, 'korea');
  assert.ok(mixed.state === 'neutral' && /^혼조/.test(mixed.read), `v57.81 won strength beside a 20% KOSPI fall reads 혼조 (${mixed.state}: ${mixed.read})`);
  assert.equal(axisOf(build((i) => ({ usdkrw: i >= n - 20 ? 1400 - 60 * (i - (n - 21)) / 20 : 1400 })), 'korea').state, 'favorable', 'v57.81 a won that strengthened across the window with no KOSPI contradiction stays 양호');

  // Breadth: a 5-day bounce that gave half back on the last close is 되밀림, not 반등 진행 중; a +1.2pp month is flat.
  assert.equal(recoveryCheck(33.6, 37.6, 29.6), 'reversed');
  assert.equal(recoveryCheck(36.6, 37.6, 29.6), 'holding');
  const b50 = days.map((date, i) => ({ date, value: i === n - 1 ? 33.6 : i === n - 2 ? 37.6 : i === n - 6 ? 29.6 : i === n - 21 ? 32.4 : 35 }));
  const spxSeries = days.map((date, i) => ({ date, value: i === n - 1 ? 102 : 100 }));
  const flow = breadthFlow({ cards: [{ id: 'b50', series: b50 }, { id: 'b200', series: b50.map((p) => ({ ...p, value: 48.9 })) }, { id: 'b20', series: b50.map((p) => ({ ...p, value: 34 })) }, { id: 'spx', series: spxSeries }] });
  assert.ok(/되밀려/.test(flow.leads.participation) && !/반등이 진행 중/.test(flow.leads.participation), `v57.81 the reversal day is named (${flow.leads.participation})`);
  assert.ok(/±3%p 안/.test(flow.leads.index) && !/함께 넓어/.test(flow.leads.index), `v57.81 a +1.2pp month is inside the dead zone (${flow.leads.index})`);

  // F&G: 44 -> 30 on the last session is named even when the 20-session change is small.
  const fgHist = build((i) => ({ fg: i === n - 1 ? 30 : i === n - 2 ? 44 : 27 }));
  const mood = buildSentimentModel({ history: fgHist });
  assert.ok(/직전 기록보다 14 낮아져/.test(mood.synthesis), `v57.81 a -14 F&G day is named (${mood.synthesis})`);

  // RRG: a 선도 sector whose relative-strength line fell more than twice its own typical five-session move in the last
  // five sessions (the themes screen's rsRecentCheck) is not shown as leading now.
  const quiet = Array.from({ length: 40 }, (_, k) => 100 + 0.3 * Math.sin(k));
  const line = (values) => values.map((value, k) => ({ sessionDate: days[n - values.length + k], value }));
  const xlkLine = line([...quiet, 99.5, 98.8, 97.6, 96.4, 95.4]);
  const xlk = { quadrant: 'Leading', sessionDate: days.at(-1), relativeStrength: xlkLine };
  const recent = sectorRecentCheck(xlk);
  assert.ok(recent?.fell && recent.rel5 < -4 && leaderFading({ ...xlk, ...recent }) && !leaderFading({ quadrant: 'Leading', ...sectorRecentCheck({ ...xlk, relativeStrength: line([...quiet, 100.2]) }) }), `v57.81 five-session relative check ${JSON.stringify(recent)}`);
  const xlkItem = validRotation.items.XLK;
  const fadingMoves = sectorMoves({ ...validRotation, items: { ...validRotation.items, XLK: { ...xlkItem, relativeStrength: xlkLine.map((p, k, all) => ({ ...p, sessionDate: k === all.length - 1 ? xlkItem.sessionDate : p.sessionDate })) } } }, fixtureNow);
  const xlkMove = fadingMoves.rows.find((row) => row.symbol === 'XLK');
  assert.ok(xlkMove.fading && /^상대강도 5일 -/.test(xlkMove.quadrant), `v57.81 the home sector badge drops 선도 for a fading leader (${JSON.stringify(xlkMove)})`);
  const fadingOutlook = buildScenarioOutlook({ scenarios: buildMarketScenarios({ history: build(), now }), regime: buildMarketRegime({ history: build(), now }), sectors: [{ symbol: 'XLK', label: '기술', quadrant: 'Leading', ...recent }, { symbol: 'XLE', label: '에너지', quadrant: 'Leading' }, { symbol: 'XLU', label: '유틸리티', quadrant: 'Weakening' }] });
  const concentrationView = fadingOutlook.items.find((item) => item.id === 'concentration');
  assert.ok(/상대강도 선도\(RRG·약 50일 기준\): 에너지/.test(concentrationView.opportunity) && !/선도\(RRG·약 50일 기준\): [^.·]*기술/.test(concentrationView.opportunity) && /선도였지만 최근 5거래일 상대강도가 꺾인 업종: 기술/.test(concentrationView.opportunity), `v57.81 a fading 선도 is listed apart (${concentrationView.opportunity})`);
  // v58.80 (first-users bundle 1): the linked form keeps the fading leader, so the parts add up to every Leading sector.
  const expansionLinks = fadingOutlook.items.find((item) => item.id === 'expansion')?.opportunityLinks || [];
  const linked = expansionLinks.filter((part) => /선도/.test(part.label)).flatMap((part) => part.links.map((link) => link.label));
  assert.ok(linked.includes('기술') && linked.includes('에너지'), `v58.80 linked leaders keep the fading one (${JSON.stringify(expansionLinks)})`);
  // The themes screen's RRG neutral band: XLK at RS-Ratio 100.33 is 경계, not 선도.
  assert.ok(rrgBorder({ rsRatio: 100.33, rsMomentum: 102.02 }) && !rrgBorder({ rsRatio: 105, rsMomentum: 103.6 }), 'v57.81 RRG neutral band (shared with 테마·섹터)');
  const banded = buildScenarioOutlook({ scenarios: buildMarketScenarios({ history: build(), now }), regime: buildMarketRegime({ history: build(), now }), sectors: [{ symbol: 'XLK', label: '기술', quadrant: 'Leading', rsRatio: 100.33, rsMomentum: 102.02 }, { symbol: 'XLV', label: '헬스케어', quadrant: 'Leading', rsRatio: 105, rsMomentum: 103.6 }] });
  assert.ok(banded.rotation.Leading.map((row) => row.symbol).join() === 'XLV', 'v57.81 a 경계 point is not quoted as 선도');
  assert.ok(!/버티는 방어 섹터: [^.]*유틸리티/.test(fadingOutlook.items.find((item) => item.id === 'weakness').opportunity) && fadingOutlook.rotation.Leading.every((row) => row.symbol !== 'XLK'), 'v57.81 약화 is not "버티는", and the rotation links quote only holding leaders');

  // Narrative: state words follow the packet; a Korea-vs-US sentence across different sessions names both dates.
  const packet = 'credit: neutral — 수준은 낮지만\nvolatility: neutral — VIX\ntrend: neutral — 시험';
  assert.deepEqual(axisStateClaimIssues('신용 스프레드 확대가 부담입니다.', { context: packet }), ['axis-state-contradiction:credit'], 'v57.81 "신용 … 부담" against a 중립 credit axis is rejected');
  assert.deepEqual(axisStateClaimIssues('신용 스프레드 확대가 부담입니다.', { context: packet.replace('credit: neutral', 'credit: burden') }), [], 'v57.81 the same words pass when the packet says 부담');
  assert.deepEqual(axisStateClaimIssues('신용 스프레드가 더 벌어지면 부담이 될 수 있습니다.', { context: packet }), [], 'v57.81 a conditional is not a state claim');
  assert.deepEqual(axisStateClaimIssues('추세는 양호합니다.', { context: packet }), ['axis-state-contradiction:trend']);
  const kr = { krDate: '2026-10-15', usDate: '2026-10-14' };
  assert.deepEqual(crossMarketDateIssues('코스피 -7.56%, 미국 주가지수 -1.11%로 마감했습니다.', kr), ['cross-market-session-dates-missing'], 'v57.81 an undated KOSPI/S&P comparison across sessions is rejected');
  assert.deepEqual(crossMarketDateIssues('코스피(10/15) -7.56%, 미국 주가지수(10/14) -1.11%로 마감했습니다.', kr), []);
  assert.deepEqual(crossMarketDateIssues('코스피 -1%, S&P 500 -1%입니다.', { krDate: '2026-10-14', usDate: '2026-10-14' }), [], 'v57.81 the same session needs no dates');
  // One oil rule and one dollar rule with 거시: WTI -7% while Brent is flat is not 완화, WTI +12% while Brent falls is no
  // oil-only 부담, and 달러 급등 uses the same buffered dollar test as the axis.
  const { dollarRiseBurden } = await import('../src/domain/briefing/market-read.js');
  assert.ok(dollarRiseBurden(2.23) === false && dollarRiseBurden(2.6) === true && dollarRiseBurden(2.23, 0.9) === true && dollarRiseBurden(null) === null, 'v57.81 the shared dollar rule: +2.23% mid-range is not 부담');
  {
    // v57.84 R713 (threshold consolidation): the 달러 gauge band starts on the axis rule, and its falling band is favourable only
    // when the axis is — a neutral axis never pins a gauge band of another tone.
    const { buildMacroRead } = await import('../src/domain/macro/macro-read.js');
    const bandAt = (read, value) => read.sharedGauges.commodities.gauge.bands.find((band) => value >= band.from && value < band.to)?.tone;
    const mid = buildMacroRead({ macro: {}, rateFx: { dxy20: 2.2, dxyPosition: 0.5 }, regime: { axes: [{ id: 'commodities', state: 'neutral' }] } });
    assert.equal(bandAt(mid, 2.2), 'neutral', 'v57.84 DXY +2.2% mid-range: 중립 axis, 중립 band');
    assert.equal(bandAt(mid, 2.6), 'burden', 'v57.84 the band turns at rise20dPct + bufferPct');
    assert.equal(bandAt(mid, -1), 'neutral', 'v57.84 a falling dollar alone is not 양호 (oil must fall too)');
    const top = buildMacroRead({ macro: {}, rateFx: { dxy20: 2.2, dxyPosition: 0.9 }, regime: { axes: [{ id: 'commodities', state: 'burden' }] } });
    assert.ok(top.sharedGauges.commodities.gauge.label.includes('달러') && bandAt(top, 2.2) === 'burden', 'v57.84 at the top of its range the line is rise20dPct');
    const { BRANCHES } = await import('../src/domain/market/macro-crossroads.js');
    const { RULES } = await import('../src/domain/rules/thresholds.js');
    const labels = BRANCHES.flatMap((branch) => branch.conditions.map(([label]) => (typeof label === 'string' ? label : '')));
    assert.ok(labels.some((label) => label.includes(`+${RULES.oil.rise20dPct}% 이상 또는 1년 평균 대비 +${RULES.oil.aboveYearAvgPct}%`)), 'v57.84 the 유가 급등 label prints its RULES values');
    assert.ok(labels.some((label) => label.includes(`${RULES.growth.claimsRiseAbovePct}% 이상 높음`)) && labels.some((label) => label.includes(`${RULES.growth.claimsWatchAbovePct}% 이상 높음`)), 'v57.84 claims watch/rise levels come from RULES.growth');
  }
  const oilRun = (wtiLast, brentLast) => build((i) => ({ dxy: i === n - 1 ? 99 : 100, wti: i === n - 1 ? wtiLast : 80, brent: i === n - 1 ? brentLast : 84 }));
  const wtiOnlyFall = axisOf(oilRun(74.2, 84.2), 'commodities');
  assert.ok(wtiOnlyFall.state !== 'favorable' && /두 유가의 20일 방향이 달라/.test(wtiOnlyFall.read), `v57.81 a WTI-only fall is not 완화 (${wtiOnlyFall.state}: ${wtiOnlyFall.read})`);
  assert.equal(axisOf(oilRun(74.2, 78), 'commodities').state, 'favorable', 'v57.81 WTI and Brent falling together with a softer dollar stays 완화');
  assert.notEqual(axisOf(oilRun(89.6, 83), 'commodities').state, 'burden', 'v57.81 a WTI-only rise against a falling Brent fires no oil 부담');
  const oilRead = buildMarketRead({ history: oilRun(74.2, 84.2), now });
  assert.ok(oilRead.statements.some((row) => row.id === 'oil-held') && !oilRead.statements.some((row) => /^oil-(rates-inflation|high)$/.test(row.id)), 'v57.81 the briefing oil sentence follows the same hold');
  console.log('scenario guidance fixture (v57.81 credit/rates hysteresis, VIX and dollar buffers, won window, breadth reversal and dead zone, F&G move, RRG fading, narrative state/date rules): PASS');
}

// v57.81 (거시 analysis audit, group X; 10/14–10/15 numbers): every branch has a core condition (gate) before it can lead,
// conditions and '시장 가격' count only past a dead zone, the inflation direction needs PCE and CPI to agree, one Brent/WTI rule.
{
  const { buildMacroCrossroads, buildScenarioSignals, BRANCHES, COUNT_WORDS } = await import('../src/domain/market/macro-crossroads.js');
  const { buildMacroRead } = await import('../src/domain/macro/macro-read.js');
  const { buildLiquidityGrowthGroups } = await import('../src/domain/macro/liquidity-growth.js');
  const mhOf = (series) => ({ schemaVersion: 'macro-history.v1', series: Object.fromEntries(Object.entries(series).map(([key, observations]) => [key, { observations }])) });
  const sessions = [];
  for (let t = Date.UTC(2025, 6, 1); sessions.length < 320; t += 86400000) { const day = new Date(t).getUTCDay(); if (day && day !== 6) sessions.push(new Date(t).toISOString().slice(0, 10)); }
  const N = sessions.length;
  for (const branch of BRANCHES) assert.ok(branch.gate?.length && branch.gate.every((index) => branch.conditions[index]), `v57.81 ${branch.id}: names its core condition`);

  // 10/14: WTI 20일 -7.2%, breakeven +2bp (sd 7.9bp), UMich 51.7 (8월), dollar +2.23%, 10년물 +18bp, 2년물 − 기준금리 +0.95%p.
  const oct14 = { oil20: -7.2, oilVsYear: 21, oilSurging: false, oilHeld: false, wtiPosition: 0.45, breakeven20: 0.02, sentimentRank: { value: 51.7, date: '2026-08-01', month: '8월', percentile: 13 },
    commodities: 'burden', dxy20: 2.23, krw20: -1.6, lean: 'hike', pricing: 0.95, tnx20: 0.18, termPremium20: 0.2, curve2s10s20: 0.15, realYield20: 0.26,
    policy: { upper: 4, change: 0.25, changeDate: '2026-09-17', bill: null }, hy20: 40, cccGap20: 1.5, nfci4: 0.051, credit: 'neutral',
    bands: { breakeven20: 0.5 * 0.079, tnx20: 0.1, termPremium20: 0.05, curve2s10s20: 0.07, realYield20: 0.06, hy20: 12, cccGap20: 0.5, nfci4: 0.015 } };
  const m14 = buildMacroCrossroads({ signals: oct14 });
  const shock = m14.items.find((item) => item.id === 'oilshock');
  assert.ok(m14.leadId !== 'oilshock' && shock.gate.met === false && /^조건 충족 [1-9]\d*\/\d+.*, 핵심 조건 미충족$/.test(shock.status), `v57.81 '유가 충격' is not first while WTI 20일 is -7.2% (${m14.headline}; ${shock.status})`);
  assert.ok(/10년 기대인플레이션 20회 관측 상승 \(평소 변동 범위 밖\) 미충족/.test(shock.basis.join(' · ')) && shock.pricing.tone === 'neutral' && /평소 변동\(±4bp\) 안/.test(shock.pricing.text), `v57.81 breakeven +2bp (sd 7.9) counts neither as a condition nor as the market-price tag (${shock.pricing.text})`);
  assert.ok(/8월 51\.7/.test(shock.basis.join(' ')), 'v57.81 the monthly survey carries its month inline');
  assert.ok(!shock.basis.some((text) => /유가·달러 지표 부담/.test(text)), 'v57.81 the shared oil/dollar state (fired by the dollar) is not an oil condition');
  const steep = m14.items.find((item) => item.id === 'fiscalsteep');
  assert.ok(steep.gate.met === false && /\+25bp 이상\(시장 상태 금리 기준\)/.test(steep.basis[0]), 'v57.81 10년물 +18bp is below the 시장 상태 rates threshold (RULES.rates 25bp) here too');
  const lead14 = m14.items.find((item) => item.id === m14.leadId);
  assert.ok(!lead14 || lead14.gate.met === true, 'v57.81 only a branch whose core condition is met can lead');
  assert.ok(m14.items.filter((item) => item.id === m14.altId || m14.tiedIds.includes(item.id)).every((item) => item.gate.met === true), 'v57.81 the alternative and tied branches pass their gate too');

  // Three branches level at 3/4 read "셋" (home and 거시 share COUNT_WORDS and tiedIds).
  // v57.81: 달러 급등 uses the 시장 axis's buffered dollar rule — DXY +2.23% (0.23pp past the line) no longer counts, +2.6% does.
  const surge = buildMacroCrossroads({ signals: oct14 }).items.find((item) => item.id === 'dollarsurge');
  assert.ok(/달러 인덱스 20거래일 \+2\.5% 이상 미충족/.test(surge.basis.join(' · ')), `v57.81 DXY +2.23% does not meet 달러 급등's dollar condition (${surge.basis.join(' · ')})`);
  const three = buildMacroCrossroads({ signals: { ...oct14, oilSurging: true, wtiPosition: 0.9, tnx20: 0.3, dxy20: 2.6 } });
  assert.ok(three.tiedIds.length === 3 && /시나리오가 셋입니다/.test(three.headline) && COUNT_WORDS[three.tiedIds.length] === '셋', `v57.81 three tied branches read "셋" (${three.headline})`);
  const homeSource = readFileSync(new URL('../src/ui/components/macro-crossroads.js', import.meta.url), 'utf8');
  assert.ok(!/달린'\} 두 시나리오/.test(homeSource) && /COUNT_WORDS\[tiedItems\.length\]/.test(homeSource), 'v57.81 the home tie line counts tiedIds instead of a hard-coded "두"'); // text-pin-ok: retirement absence

  // Clean oil shock from series: WTI +15% in 20 sessions, breakevens +20bp → '유가 충격' ranks first.
  const wave = (i, amp, period) => amp * Math.sin(i / period);
  const cleanHistory = sessions.map((date, i) => ({ date, spx: 6000 + wave(i, 40, 9), wti: i < N - 21 ? 70 + wave(i, 2, 7) : (70 + wave(N - 21, 2, 7)) * (1 + 0.15 * (i - (N - 21)) / 20) }));
  const cleanMh = mhOf({ breakeven10: sessions.map((date, i) => [date, Number((i < N - 21 ? 2.3 + wave(i, 0.03, 5) : 2.3 + wave(N - 21, 0.03, 5) + 0.2 * (i - (N - 21)) / 20).toFixed(4))]) });
  const cleanRead = buildMacroRead({ macroHistory: cleanMh, history: cleanHistory });
  const clean = buildMacroCrossroads({ read: cleanRead, macroHistory: cleanMh, history: cleanHistory });
  const cleanShock = clean.items.find((item) => item.id === 'oilshock');
  assert.ok(clean.leadId === 'oilshock' && cleanShock.gate.met === true && cleanShock.pricing.tone === 'same', `v57.81 a real oil shock (WTI +15%, breakevens +20bp) ranks 유가 충격 first (${clean.headline}; ${cleanShock.basis.join(' · ')})`);

  // Inflation: core PCE (8월) slowing and core CPI (9월) re-accelerating is 엇갈림 — quadrant and both branches read one flag.
  const monthly = (startYear, startMonth, count, yoyRate, lastRate) => Array.from({ length: count }, (_, i) => i).reduce((rows, i) => {
    const date = new Date(Date.UTC(startYear, startMonth - 1 + i, 1)).toISOString().slice(0, 10);
    const rate = i >= count - 3 ? lastRate : yoyRate;
    rows.push([date, i ? rows[i - 1][1] * (1 + rate / 100) ** (1 / 12) : 100]);
    return rows;
  }, []);
  const inflMh = mhOf({ corePceIndex: monthly(2024, 5, 28, 3.33, 2.05), coreCpiIndex: monthly(2024, 6, 28, 2.3, 3.41) });
  const inflRead = buildMacroRead({ macro: { corePce: 3.0076 }, macroHistory: inflMh });
  const inflAxis = inflRead.axes.find((axis) => axis.id === 'inflation');
  assert.ok(inflAxis.detail.direction.state === 'mixed' && inflRead.regime.held.inflation === '엇갈림' && !inflRead.regime.inflationDir, `v57.81 PCE slowing plus CPI re-accelerating gives 엇갈림 (${inflRead.regime.reading})`);
  assert.ok(/근원 PCE 8월 둔화, 근원 CPI 9월 재가속/.test(inflRead.regime.reading) && !/정해진 쪽은 물가 속도 둔화/.test(inflRead.regime.reading), 'v57.81 the held quadrant names each series with its month, never a settled disinflation');
  const inflModel = buildMacroCrossroads({ read: inflRead, macroHistory: inflMh });
  const condition = (id) => inflModel.items.find((item) => item.id === id).conditions[0][1];
  assert.ok(condition('reheat') === false && condition('softland') === false, 'v57.81 the reheat and softland branches read the same flag as the quadrant');
  assert.ok(inflAxis.state === 'neutral' && /근원 CPI\(9월\)만 빨라지고/.test(inflAxis.read) && /두 지표가 함께 가리키는 재가속은 아닙니다/.test(inflAxis.read), `v57.84 one measure re-accelerating against the other is not 부담 on the 물가 axis; the read names it (${inflAxis.state}: ${inflAxis.read})`);
  // PCE 3.0076% vs the 3.0% line, no re-acceleration: not 부담 by the level alone; 3.2% is.
  const flatMh = mhOf({ corePceIndex: monthly(2024, 5, 28, 3.0, 3.0) });
  const edge = buildMacroRead({ macro: { corePce: 3.0076 }, macroHistory: flatMh }).axes.find((axis) => axis.id === 'inflation');
  assert.ok(edge.state !== 'burden' && /수준만으로 부담으로 보지 않습니다/.test(edge.read), `v57.81 PCE 3.0076% vs missPct 3.0 is not 부담 by the level alone (${edge.state}: ${edge.read})`);
  assert.equal(buildMacroRead({ macro: { corePce: 3.2 }, macroHistory: flatMh }).axes.find((axis) => axis.id === 'inflation').detail.firedBy, 'level', 'v57.81 past the 0.1pp buffer the level fires');

  // One oil read when the Brent−WTI spread breaks ($3.4 → $11, Brent +0.2%, WTI -7.2%).
  const oilHistory = sessions.map((date, i) => {
    const k = i < N - 21 ? 0 : (i - (N - 21)) / 20;
    const wti = (95 + wave(i < N - 21 ? i : N - 21, 1, 11)) * (1 - 0.072 * k);
    const brent0 = 95 + wave(N - 21, 1, 11) + 3.4;
    return { date, spx: 6000 + wave(i, 40, 9), wti, brent: i < N - 21 ? wti + 3.4 : brent0 * (1 + 0.002 * k) };
  });
  const oilRead = buildMacroRead({ history: oilHistory });
  const oilNode = oilRead.chain.nodes.find((node) => node.id === 'oil');
  const oilModel = buildMacroCrossroads({ read: oilRead, history: oilHistory });
  const hubOil = oilModel.rateHub.pathsDown.find((path) => path.id === 'oil');
  assert.ok(oilRead.oil.held && oilNode.held && oilNode.impact === 'unknown' && hubOil.stateText === '혼재' && hubOil.ok == null
    // v57.86 (live review): both moves sit below the 유가 안정 line, so the held pair still answers it; a split answer stays null.
    && oilModel.items.find((item) => item.id === 'softland').conditions[2][1] === true && oilRead.axes.find((axis) => axis.id === 'commodities').caveat,
    `v57.81 one oil read when the Brent−WTI spread breaks (node ${oilNode.value}; hub ${hubOil.stateText}; ${oilRead.oil.sentence})`);

  const splitOil = buildMacroCrossroads({ read: oilRead, history: oilHistory, signals: { oil20: 6, brent20: 1, oilHeld: true } });
  assert.equal(splitOil.items.find((item) => item.id === 'softland').conditions[2][1], null, 'v57.86 a held pair whose moves answer 유가 안정 differently stays 확인 불가');
  // v57.86: the credit-stress gate is the level — a fast widening at 325bp (axis 부담, level below 350bp, NFCI < 0) cannot lead.
  const fastWiden = buildMacroCrossroads({ read: oilRead, history: oilHistory, signals: { credit: 'burden', hyBp: 325, nfci: -0.5 } }).items.find((item) => item.id === 'creditstress');
  assert.ok(fastWiden.gate.met === false && /핵심 조건 미충족/.test(fastWiden.status), `v57.86 credit-stress gate is the spread level (${fastWiden.status})`);

  // NFCI: the credit-stress condition and the 거시 card read the same 4-week window (a session count read one week).
  const nfciObs = Array.from({ length: 30 }, (_, i) => [new Date(Date.UTC(2026, 2, 6) + i * 7 * 86400000).toISOString().slice(0, 10), Number((-0.6 + 0.0125 * i).toFixed(4))]);
  const nfciMh = mhOf({ financialConditions: nfciObs });
  const card = buildLiquidityGrowthGroups(nfciMh, { referenceMs: Date.parse(nfciObs.at(-1)[0]) }).flatMap((group) => group.items).find((item) => item.id === 'nfci');
  assert.ok(card.changeText === '4주 +0.05' && Math.abs(buildScenarioSignals({ macroHistory: nfciMh }).nfci4 - 0.05) < 1e-9, `v57.81 the NFCI card and the credit-stress condition share one 4-week window (${card.changeText})`);
  console.log('scenario guidance fixture (v57.81 macro gates, dead zones, PCE·CPI direction, one oil rule, ties, NFCI window): PASS');
}

// v57.81 (themes audit, 10/14 closes): theme stages and sector rotation read against the S&P 500 over the same window
// with a band, slow-window labels name their window, and a five-session break beyond the series' own noise holds the
// month's verdict. Numbers below are the 10/14 values the audit quoted.
{
  const { buildThemePlaybook, renderThemePlaybookContext, rotationOf } = await import('../src/domain/scenarios/theme-playbook.js');
  const { rrgRecentReading, rrgZone, rsRecentCheck, relativeBand, weeklyNoiseFromVol, recentMove } = await import('../src/domain/themes/recent-check.js');
  const { themeStagesFor, SCENARIO_STATE_CURRENT } = await import('../src/domain/scenarios/theme-stage.js');
  const { themeStrengthLead, themeDetailFlow, rotationFlow } = await import('../src/domain/market/page-flow.js');
  const { themeLeadClaimIssues } = await import('./lib/market-analysis-validate.mjs');
  const spx = { field: 'spx', name: 'S&P 500', asOf: '2026-10-14', ret5d: -1.06, ret1m: 1.76, ret3m: 2.46, ret6m: 9.91, from: { ret1m: '2026-09-15' } };
  const kospi = { asOf: '2026-10-15', ret5d: -18.4, ret1m: -21.0, ret3m: -25.7, ret6m: -5.4, from: { ret1m: '2026-09-10' } };
  const g = (themeId, name, values) => ({ themeId, themeName: themeId, name, basis: '2026-10-14', current: true, members: 10, vol: 50, ...values });
  const usGroups = [
    g('semiconductor', 'S1', { ret1m: 4.5, ret3m: -2.0, ret6m: 31.0, ret5d: -12.6, above50Pct: 22.5 }),
    g('ai_infra', 'A1', { ret1m: 3.0, ret3m: 4.0, ret6m: 40.0, ret5d: -12.7, above50Pct: 25 }),
    g('industrials', 'I1', { ret1m: 2.4, ret3m: -5.1, ret6m: 4.7, ret5d: 0.1, above50Pct: 55 }),
    g('staples', 'P1', { ret1m: 4.2, ret3m: 0.0, ret6m: 3.0, ret5d: 5.4, above50Pct: 70 }),
    g('software', 'W1', { ret1m: 6.0, ret3m: 9.0, ret6m: 24.0, ret5d: 1.0, above50Pct: 65 })
  ];
  const krThemes = [{ id: 'semi', label: '반도체', covered: 12, ret1m: 3.0, ret3m: 20.0, ret5d: -23.9, vol: 60, above50Pct: 13, basis: '2026-10-15' }];
  const cross = { leadId: 'reheat', altId: 'softland', items: [{ id: 'reheat', title: '물가 재가속 — x', firmer: ['energy'], weaker: ['growth', 'aicapex'] }, { id: 'softland', title: '물가 둔화 — x', firmer: ['growth', 'aicapex'], weaker: ['energy'] }] };
  const pb = buildThemePlaybook({ usGroups, krThemes, crossroads: cross, credit: 'neutral', benchmarks: { US: spx, KR: kospi }, labels: { semiconductor: '반도체', ai_infra: 'AI 인프라/데이터센터', industrials: '산업재/물류', staples: '필수소비재', software: '소프트웨어/클라우드' } });
  const row = (id, market = 'US') => pb.themes.find((item) => item.id === id && item.market === market);
  for (const id of ['semiconductor', 'ai_infra']) {
    assert.notEqual(row(id).state, 'leading', `v57.81 ${id} is not 주도 지속 during a -12.6% week with 50일선 위 ${row(id).above50}% (${row(id).stateLabel})`);
    assert.equal(row(id).state, 'fading', `v57.81 ${id} reads 추세 약화 확인 중`);
    assert.match(row(id).stateLabel, /^추세 약화 확인 중 \(6개월·1개월, S&P 500 대비/, 'v57.81 the slow verdict names its windows and its index');
    assert.match(row(id).stateLabel, /최근 5거래일 -12\.\d%\(S&P 500 대비 -11\.\d%p\).*1개월 판정 보류/, `v57.81 the week that contradicts the month is printed (${row(id).stateLabel})`);
    assert.ok(!row(id).favored.includes('hold'), 'v57.81 보유 유지 is not favoured once the stage does not hold');
  }
  assert.ok(!pb.highlights.headwindLeaders.some((item) => ['semiconductor', 'ai_infra'].includes(item.id)), 'v57.81 headwindLeaders only list themes that pass the corrected stage');
  assert.notEqual(row('industrials').state, 'leading', 'v57.81 산업재 6m +4.7% against the S&P 500 +9.9% is not 주도');
  assert.notEqual(row('staples').state, 'leading', 'v57.81 필수소비재 6m +3.0% against +9.9% is not 주도');
  // v57.84: a group row is read on the same index-relative, banded rule as its theme (it used the bare sign).
  assert.notEqual(row('staples').groups[0].state, 'leading', 'v57.84 group P1 (6m +3.0% vs +9.9%) is not 주도 inside a theme that is not');
  assert.equal(row('software').groups[0].state, 'leading', 'v57.84 a confirmed group reads the same stage as its one-group theme');
  {
    // v57.84 (owner decision, TECHNICAL-DEFINITIONS 3-1/3-2 안 A) on the 10/15 rows: in line with the index is 동행, ahead
    // of a falling index with a negative own trend is 상대 방어, and a 동행 row names its 1-month drift.
    const { themeStateOf: stateOf, themeStateOutcomes: outcomesOf } = await import('../src/domain/scenarios/analogs.js');
    const live = buildThemePlaybook({ usGroups: [g('energy', 'E1', { ret1m: 1.5, ret3m: 11.1, ret6m: 9.03, ret5d: 1.5, above50Pct: 71 }), g('staples', 'P2', { ret1m: 7.0 /* audit 2026-10-17 D4: beyond the 4.3%p 1-month band */, ret3m: 2, ret6m: 10.1, ret5d: 0.5, above50Pct: 83 })],
      krThemes: [{ id: 'battery', label: '2차전지', covered: 10, ret1m: -10.1, ret3m: -2.6, ret5d: -3, vol: 50, above50Pct: 30, basis: '2026-10-15' }],
      crossroads: cross, credit: 'neutral', benchmarks: { US: spx, KR: kospi } });
    const at = (id) => live.themes.find((item) => item.id === id);
    assert.equal(at('energy').state, 'inline', `v57.84 energy 6m +9.0% against the S&P 500 +9.9% is 동행, not 약세 지속 (${at('energy').stateLabel})`);
    assert.match(at('energy').stateLabel, /^동행 \(6개월·1개월, S&P 500 대비\)/, 'v57.84 동행 with no 1-month drift carries no qualifier');
    assert.match(at('staples').stateLabel, /^동행, 1개월 앞서기 시작 /, `v57.84 동행 + 1-month lead reads 앞서기 시작, not 반등 시도 (${at('staples').stateLabel})`);
    assert.equal(at('battery').state, 'defensive', `v57.84 batteries -2.6% against KOSPI -25.7% are 상대 방어, not 주도 (${at('battery').stateLabel})`);
    assert.ok(!/주도/.test(at('battery').stateLabel) && at('battery').favored.every((key) => key === 'wait'), 'v57.84 상대 방어 never uses leadership words or favours holding as a leader');
    assert.equal(stateOf(8, -10.9, { band: 3.7, recentBand: 1.5, absolute: -4 }), 'pullback', 'v57.86 a theme 10.9%p behind the index over a month is not 상대 방어');
    assert.equal(stateOf(8, 2, { band: 3.7, recentBand: 1.5, absolute: -4 }), 'defensive', 'v57.86 상대 방어 holds when the month does not lag');
    assert.equal(stateOf(-5, 3, { band: 3.7, recentBand: 1.5 }), 'rebound', 'v57.84 반등 시도 needs the long trend beyond the band behind');
    assert.equal(stateOf(-2, -3, { band: 3.7, recentBand: 1.5 }), 'inline', 'v57.84 inside the band is 동행 whatever the month');
    // Proxy outcomes on the live rule against ^GSPC; an absolute-basis artifact is not compared with a relative stage.
    const days = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10));
    const etf = days.map((date, i) => [date, 100 * (1 + 0.001 * i)]); const gspc = days.map((date, i) => [date, 100 * (1 + 0.0012 * i)]);
    assert.equal(outcomesOf(etf, { benchmark: gspc }).basis, 'relative-banded', 'v57.84 proxy outcomes with ^GSPC use the live relative rule');
    assert.equal(outcomesOf(etf).basis, 'absolute', 'v57.84 without the index the outcome basis says absolute');
    const absPast = buildThemePlaybook({ usGroups: [g('software', 'W1', { ret1m: 6.0, ret3m: 9.0, ret6m: 24.0, ret5d: 1.0, above50Pct: 65 })], crossroads: cross, credit: 'neutral', benchmarks: { US: spx },
      outcomes: { themes: { software: { symbol: 'IGV', basis: 'absolute', leading: { n: 20, up: 12, median: 3, horizon: 63 } } } } }).themes[0];
    assert.match(absPast.past, /다른 기준\(절대 수익률이거나/, 'v57.84 an absolute-basis proxy record is not compared with the relative stage');
    // Audit 2026-10-17 (owner D5): with RSP on record the US stage reads against the equal-weight S&P 500 and names the
    // cap-weighted index beside it; without RSP on the theme's date it stays on the S&P 500.
    {
      const sessions = [];
      for (let t = Date.parse('2026-01-02T12:00:00Z'); sessions.length < 160; t += 86400000) { const day = new Date(t).getUTCDay(); if (day && day !== 6) sessions.push(new Date(t).toISOString().slice(0, 10)); }
      const hist = sessions.map((date, i) => ({ date, spx: 6000 * (1 + 0.0008 * i), rsp: 180 * (1 + 0.0002 * i) }));
      const theme = [g('software', 'W1', { basis: sessions.at(-1), ret1m: 6.0, ret3m: 9.0, ret6m: 24.0, ret5d: 1.0, above50Pct: 65 })];
      const ew = buildThemePlaybook({ usGroups: theme, crossroads: cross, credit: 'neutral', history: hist }).themes[0];
      assert.equal(ew.relative?.field, 'rsp', `D5 the US stage reads against RSP when it has the theme's date (${ew.stateLabel})`);
      assert.match(ew.stateLabel, /S&P 500 동일가중 대비, 참고: S&P 500 대비 6개월 [+-]\d+\.\d%p/, `D5 the cap-weighted index is named beside it (${ew.stateLabel})`);
      const capOnly = buildThemePlaybook({ usGroups: theme, crossroads: cross, credit: 'neutral', history: hist.map(({ rsp, ...row }) => row) }).themes[0];
      assert.ok(capOnly.relative?.field === 'spx' && /S&P 500 대비\)/.test(capOnly.stateLabel), `D5 without RSP the stage stays on the S&P 500 (${capOnly.stateLabel})`);
      const oldRule = buildThemePlaybook({ usGroups: theme, crossroads: cross, credit: 'neutral', history: hist,
        outcomes: { themes: { software: { symbol: 'IGV', basis: 'relative-banded', leading: { n: 20, up: 12, median: 3, horizon: 63 } } } } }).themes[0];
      assert.match(oldRule.past, /다른 기준/, 'D4/D5 a past-stage count without the current rule stamp is not compared');
    }
    // v57.87 (10/16 market-screen re-check): heavyweights that fell more than KOSPI withhold an ahead-of-index Korean stage;
    // a 추세 속 조정 with a broken week or a non-positive own long return favours waiting, not 분할.
    const heavy = buildThemePlaybook({ krThemes: [{ id: 'semiconductor', label: '반도체', covered: 12, ret1m: -4.5, ret3m: 2, ret5d: -3, vol: 50, above50Pct: 20, basis: '2026-10-15',
      heavyweights: [{ sym: '000660.KS', name: 'SK하이닉스', ret1m: -29.8 }, { sym: '005930.KS', name: '삼성전자', ret1m: -26.4 }, { sym: '042700.KS', name: '한미반도체', ret1m: -25 }], heavyweightNote: '거래대금 상위 3종목 중앙값 -26.4%' }],
    crossroads: cross, credit: 'neutral', benchmarks: { KR: kospi } }).themes[0];
    assert.ok(heavy.state === null && /^판정 보류 — 거래대금 상위 종목이 코스피보다 더 빠져/.test(heavy.stateLabel), `v57.87 heavyweights below KOSPI withhold the stage (${heavy.state}: ${heavy.stateLabel})`);
    const shaky = buildThemePlaybook({ usGroups: [g('aicapex', 'A1', { ret1m: -4.0, ret3m: 8.0, ret6m: 24.0 /* audit 2026-10-17 D4: beyond the 10.6%p band */, ret5d: -12.2, above50Pct: 0 })], crossroads: cross, credit: 'neutral', benchmarks: { US: spx } }).themes[0];
    {
      const { BRANCHES: branchList } = await import('../src/domain/market/macro-crossroads.js');
      const oilCalm = branchList.find((item) => item.id === 'softland').conditions.find(([label]) => /유가 안정/.test(label))[1];
      assert.ok(oilCalm({ oil20: -3.9, oilVsYear: 24, oilHeld: false }) === false && oilCalm({ oil20: -3.9, oilVsYear: 5, oilHeld: false }) === true, 'v57.87 WTI 24% above its year average is not 유가 안정 off a 20-session start on a spike');
    }
    assert.ok(shaky.state === 'pullback' && shaky.favored.length === 1 && shaky.favored[0] === 'wait' && /5거래일/.test(shaky.favoredWhy), `v57.87 a broken-week pullback favours waiting (${shaky.state}: ${shaky.favored} · ${shaky.favoredWhy})`);
  }
  assert.ok(relativeBand('ret1m') === 4.3 && relativeBand('ret6m') === 10.6, 'audit 2026-10-17 D4: the band scales with the window (15%/yr tracking error ≈ 4.3%p a month)');
  // Clean case: ahead of the S&P on both windows, a positive week and most members above the 50-day line stays 주도.
  assert.equal(row('software').state, 'leading', `v57.81 a confirmed index-relative leader stays 주도 지속 (${row('software').stateLabel})`);
  assert.match(row('software').stateLabel, /^주도 지속 \(6개월·1개월, S&P 500 대비\)$/);
  assert.match(row('software').choices.stage, /65%가 50일선 위/, 'v57.81 the stage choice text follows above50');
  assert.match(row('semiconductor').basisText.find((text) => text.startsWith('신용 안정')), /미충족$/, 'v57.81 neutral, widening credit does not meet 신용 안정 (shared creditStable rule)');
  assert.match(buildThemePlaybook({ usGroups: usGroups.slice(4), crossroads: cross, credit: 'favorable', benchmarks: { US: spx } }).themes[0].basisText.find((text) => text.startsWith('신용 안정')), /충족$/);
  assert.equal(pb.asOfText, '미국 10/14, 한국 10/15 확정 종가', 'v57.81 KR rows carry their own session date');
  assert.equal(row('semi', 'KR').basis, '2026-10-15');
  assert.match(row('semi', 'KR').stateLabel, /코스피 대비/, 'v57.81 KR themes are read against KOSPI');
  const ai = renderThemePlaybookContext(pb, { query: '반도체' });
  assert.match(ai, /미국 10\/14, 한국 10\/15 확정 종가/);
  assert.match(ai, /\[US\] 반도체: 추세 약화 확인 중[^\n]*\(5거래일 -12\.6%/, 'v57.81 the AI line names the window and the five-session move');
  assert.doesNotMatch(ai, /거시 부담에도 주도: [^\n]*반도체/, 'v57.81 the AI cannot be told semis lead during the break');
  // Rotation headline: dated window, no tag claim on thin tags, a broken strong side carries its week.
  assert.match(pb.rotation.text, /^최근 1개월\(9\/15~10\/14\) 미국 테마/, `v57.81 the rotation names its window (${pb.rotation.text})`);
  const thin = rotationOf([1, 2, 3, 4].flatMap((i) => [{ market: 'US', id: `g${i}`, label: `g${i}`, ret1m: 9 - i, tags: ['growth'] }, { market: 'US', id: `e${i}`, label: `e${i}`, ret1m: -9 + i, tags: ['energy'] }]));
  assert.ok(!/힘이 옮겨 갔습니다/.test(thin.text) && /개 미만이라 한 달 동안 힘이 어느 묶음으로 옮겨 갔는지는 판단하지 않습니다/.test(thin.text), 'v57.81 four themes per tag do not make a rotation claim (v58.74 wording: 묶음)');
  // RRG: neutral band and the five-session reversal against the series' own noise.
  const wiggle = Array.from({ length: 95 }, (_, i) => 100 + Math.sin(i / 2) * 0.8);
  const xlkLine = [...wiggle, ...[0.991, 0.982, 0.973, 0.964, 0.955].map((f) => wiggle.at(-1) * f)];
  assert.ok(rsRecentCheck(xlkLine).fell, 'v57.81 a -4.5% five-session RS move beyond twice the median weekly move is a reversal');
  assert.match(rrgRecentReading({ rsRatio: 104, rsMomentum: 102.0 }, xlkLine).label, /^선도\(약 50일 기준\), 최근 5거래일 상대강도 -4\.5%로 반락$/, 'v57.81 XLK reads 선도(약 50일 기준) with the 반락 clause');
  assert.ok(rrgZone(100.33, 102.02).border && /^기준선 부근\(선도\/개선 사이\)/.test(rrgRecentReading({ rsRatio: 100.33, rsMomentum: 102.02 }, xlkLine).label), 'v57.81 XLK at rsRatio 100.33 is 경계');
  assert.equal(rrgRecentReading({ rsRatio: 104, rsMomentum: 102 }, wiggle).reversal, null, 'v57.81 an ordinary week adds no clause');
  const flow = rotationFlow({ groups: { Leading: [{ symbol: 'XLE', label: '에너지' }], Improving: [{ symbol: 'SMH', label: '반도체', recentReversal: '상대강도 -8.8% 반락' }], Weakening: [], Lagging: [], Border: [{ symbol: 'XLK', label: '기술' }] } });
  assert.match(flow.read, /^약 50일 상대강도 기준 선도 에너지, 개선 반도체\(최근 5거래일 상대강도 -8\.8% 반락\)/, `v57.81 the verdict names the window and the reversal (${flow.read})`);
  assert.ok(/기술은 100 근처\(기준선 부근\)라 사분면을 정하지 않았습니다/.test(flow.read) && !/선도 [^.]*기술/.test(flow.read), 'v57.81 (v57.91 wording) 기준선 부근 sectors stay out of the verdict leaders');
  // Sub-theme lead: a rank gain with a broken week is not "최근 강해지는".
  const noise = weeklyNoiseFromVol(50, { members: 8 });
  const sub = (id, name, ret5d, direction) => ({ id, name, direction, above50Pct: 40, recent: recentMove({ ret5d, noise }) });
  const lead = themeStrengthLead({ windowLabel: '3개월', groups: [sub('a', '정유', 1, 'steady'), sub('b', '서버', 1, 'steady'), sub('c', '소프트', 1, 'steady'), sub('d', '네트워킹', -13.8, 'improving'), sub('e', '전력장비', 1.0, 'improving')] });
  assert.ok(/전력장비는 1개월 순위가 크게 올라 최근 강해지는 곳입니다/.test(lead) && /네트워킹\(최근 5거래일 -13\.8%\)은 1개월 순위는 올랐지만/.test(lead), `v57.81 sub-theme lead (${lead})`);
  assert.ok(!/상위는/.test(lead), `v58.75 the sub-theme lead does not repeat the top names the table shows (${lead})`);
  {
    // v58.75 (persona review, teach-and-check A-4·5): six criteria as a count with values, roles by the theme medians,
    // and the theme→screener link searched by the theme name.
    const { themeCriteria, memberRoles } = await import('../src/domain/scenarios/theme-criteria.js');
    const m = (sym, ret1m, ret3m, pctSma50, pctFrom52wHigh) => ({ sym, row: { ret1m, ret3m, ret5d: 1, pctSma50, adrPct: 2, pctFrom52wHigh, dollarVolume30d: sym === 'D' ? 5e6 : 5e8 } });
    const members = [m('A', 10, 30, 8, -3), m('B', 5, 20, 4, -10), m('C', 2, 5, 2, -20), m('D', -8, -15, -6, -40), m('E', 1, 6, 1, -18)];
    const criteria = themeCriteria({ row: { ret1m: 5, ret3m: 12, ret6m: 20, above50: 80, wind: { lead: 'head' } }, members, benchmark: { ret1m: 1, ret3m: 2, ret6m: 5, name: '지수' },
      consensus: { rows: { A: { fwd: { up4w: 3, down4w: 0 } }, B: { fwd: { up4w: 2, down4w: 1 } }, C: { fwd: { up4w: 0, down4w: 1 } } } }, calendar: null, lead: { title: '시나리오 — 설명' } });
    assert.equal(criteria.items.length, 6, 'v58.75 six theme criteria');
    assert.ok(criteria.items.every((item) => typeof item.label === 'string' && typeof item.value === 'string' && typeof item.principle === 'string' && [true, false, null].includes(item.met)), 'v58.75 criteria item shape');
    assert.deepEqual(criteria.items.map((item) => item.met), [true, true, true, null, true, false], 'v58.75 criteria results (calendar missing = null)');
    assert.match(criteria.headline, /^6개 중 4개 충족\(가능성 아님\), 확인 가능 5개 — 미충족: 시황·선두 시나리오 적합$/, 'v58.75 criteria headline is a met count, never a likelihood');
    const { roles } = memberRoles(members);
    assert.deepEqual(['A', 'B', 'C', 'D', 'E'].map((sym) => roles.get(sym).role), ['leader', 'leader', 'laggard', 'dropout', null], 'v58.75 member roles (E sits at the 3개월 median: middle)');
    assert.equal(roles.get('D').thin, true, 'v58.75 thin liquidity flag');
    const linked = themeDetailFlow({ themeId: 't', themeName: '반도체', groups: [{ ...sub('x', '장비', 1, 'steady'), themeId: 't', ret3m: 5 }] });
    assert.deepEqual(linked.next[0].ctx, { q: '반도체' }, 'v58.75 theme detail opens the screener searched by the theme name');
  }
  const detail = themeDetailFlow({ themeId: 't', groups: [{ ...sub('x', '장비/소재', -12.9, 'improving'), themeId: 't', ret3m: -14.6 },{ ...sub('y', '테스트', 1, 'steady'), themeId: 't', ret3m: 11.6 }] });
  assert.ok(/1개월 순위는 장비\/소재가 올랐지만 최근 5거래일 -12\.9%로 크게 밀렸습니다/.test(detail.read) && !/옮겨 가는 중/.test(detail.read), `v57.81 theme detail (${detail.read})`);
  // Stage chips: the producer's 'current' status renders them.
  const state = { status: SCENARIO_STATE_CURRENT, themes: [{ market: 'US', id: 'semiconductor', label: '반도체', state: 'fading', windLead: 'head', favored: ['wait'] }] };
  assert.equal(themeStagesFor({ _aioScenarioState: state }, { symbol: 'NVDA', themeIds: ['semiconductor'] })[0]?.stateLabel, '추세 약화 확인 중', "v57.81 stage chips render with status 'current'");
  assert.deepEqual(themeStagesFor({ _aioScenarioState: { ...state, status: 'pending' } }, { symbol: 'NVDA', themeIds: ['semiconductor'] }), []);
  assert.match(readFileSync(new URL('./build-scenario-state.mjs', import.meta.url), 'utf8'), /status: SCENARIO_STATE_CURRENT/, 'v57.81 the producer writes the same constant the readers check');
  // Narrative: no "주도" for a theme/sector the packet shows down 3%+ over five sessions.
  const packetData = { rotationHistory: { items: { SMH: { weeklyPct: -9.65 }, XLE: { weeklyPct: 6.7 } } } };
  const themeCtx = '- [US] AI 인프라/데이터센터: 추세 약화 확인 중 (5거래일 -12.7% · 1개월 +3.0%)';
  assert.deepEqual(themeLeadClaimIssues('미국은 인공지능 인프라·반도체가 거시 부담에도 주도했습니다.', { context: themeCtx, data: packetData }).sort(), ['theme-lead-claim-after-5d-drop:반도체', 'theme-lead-claim-after-5d-drop:인공지능 인프라'], 'v57.81 the published 10/15 sentence is rejected');
  assert.deepEqual(themeLeadClaimIssues('반도체는 6개월 기준으로 앞서 있지만 최근 5거래일 -9.7% 급락했습니다.', { context: themeCtx, data: packetData }), [], 'v57.81 naming the drop passes');
  assert.deepEqual(themeLeadClaimIssues('에너지가 시장을 주도했습니다.', { context: themeCtx, data: packetData }), [], 'v57.81 a theme up over five sessions may lead');
  assert.deepEqual(themeLeadClaimIssues('반도체가 다시 주도한다면 금리가 먼저 내려야 합니다.', { context: themeCtx, data: packetData }), [], 'v57.81 a conditional is not a claim');
  console.log('scenario guidance fixture (v57.81 theme stage vs S&P 500 with band, five-session hold, RRG 경계 and reversal, credit rule, KR basis, stage chip status, narrative 주도 rule): PASS');
}

// v57.81 (themes audit): the published packet's theme lines carry each market's date, the stage window and the 5-session
// move, so the narrative validator can see a broken week in the same packet.
{
  const { scenarioStateThemeLines } = await import('./fetch-data.mjs');
  const { themeLeadClaimIssues } = await import('./lib/market-analysis-validate.mjs');
  const packetState = { basis: { themeAsOf: '2026-10-14', macroAsOf: '2026-10-14', themeAsOfByMarket: { US: '2026-10-14', KR: '2026-10-15' } },
    themes: [{ market: 'US', id: 'semiconductor', label: '반도체', ret1m: 3.5, ret5d: -12.6 }, { market: 'KR', id: 'battery', label: '2차전지', ret1m: -10.1, ret5d: -10.2 }],
    highlights: { headwindLeaders: ['US:semiconductor', 'KR:battery'] } };
  const lines = scenarioStateThemeLines(packetState);
  assert.match(lines, /미국 2026-10-14 · 한국 2026-10-15 확정 종가/, 'v57.81 the packet prints both markets\' theme dates');
  assert.match(lines, /반도체\(6개월·1개월 기준 · 1개월 \+3\.5% · 5거래일 -12\.6%\)/, 'v57.81 a named theme carries its window and five-session move');
  assert.match(lines, /2차전지\(3개월·1개월 기준/, 'v57.81 KR themes name their 3-month window');
  assert.ok(themeLeadClaimIssues('반도체가 시장을 주도했습니다.', { context: lines }).length === 1, 'v57.81 the validator reads the five-session move from the same packet');
  console.log('scenario guidance fixture (v57.81 packet theme lines with window and 5-session move): PASS');
}

// v57.83 codex audit F09 + R706: a frequency sentence carries the small-sample note for 10-29 cases, shows no rate
// below 10, and drops the note from 30 cases.
{
  const { frequencyText } = await import('../src/domain/scenarios/analogs.js');
  // v58.3x: a share is stated only beyond the base rate, so the note checks use a share that is (95% against 57%).
  const line = (n, share = 0.95) => frequencyText({ n, up: Math.round(n * share), median: 1.2, p25: -2, p75: 3, horizon: 63, from: '2015-01-02', to: '2026-10-14', baseUpPct: 57 }, '조건');
  for (const n of [10, 29, 30]) assert.ok(!/비슷한 때 \d+%|중앙값/.test(line(n, 0.6)) && /구별되지 않았습니다/.test(line(n, 0.6)), `v58.3x ${n} cases at 60% against 57%: no share, the base rate says it`);
  assert.ok(!/비슷한 때/.test(line(9)) && /표본이 작아/.test(line(9)), 'v57.83 below 10 cases: counts only');
  for (const n of [10, 29]) assert.ok(/비슷한 때/.test(line(n)) && /작은 표본/.test(line(n)), `v57.83 ${n} cases carry the small-sample note`);
  assert.ok(/비슷한 때/.test(line(30)) && !/작은 표본|표본이 작아/.test(line(30)), 'v57.83 30 cases need no small-sample note');
  console.log('scenario guidance fixture (v57.83 R706 small-sample note at n 9/10/29/30): PASS');
}

// v57.83 codex audit F07: a release later today is still next; once its release time passes it is not, and an
// indicator card whose value came from that release points at the following date. Legacy clocks mirror the ESM ones.
{
  const { upcomingMacroEvents } = await import('../src/domain/market/macro-crossroads.js');
  const { RELEASE_CLOCKS } = await import('../src/domain/briefing/schedule.js');
  const schedules = { 'us-retail': ['2026-10-15', '2026-11-17'] };
  const at = (iso) => upcomingMacroEvents({ schedules, nowMs: Date.parse(iso) }).find((e) => e.id === 'us-retail')?.date;
  assert.equal(at('2026-10-15T12:29:00Z'), '2026-10-15', 'v57.83 before 08:30 ET the same-day release is next');
  assert.equal(at('2026-10-15T12:31:00Z'), '2026-11-17', 'v57.83 after 08:30 ET the next release moves on');
  assert.equal(at('2026-03-09T12:31:00Z') ?? null, null, 'v57.83 (DST week) no retail date in range is not invented');
  const core = readFileSync(new URL('../js/aio-core.js', import.meta.url), 'utf8');
  // P1844: the legacy calendar, run with the native clock the compatibility layer installs, moves on after 08:30 ET.
  const { releaseAtMs } = await import('../src/domain/briefing/schedule.js');
  const { runInNewContext } = await import('node:vm');
  const start = core.indexOf('window.AIO.refreshMacroCalendarFromOfficialSchedule = function(now) {');
  const legacyNext = (iso, withClock = true) => {
    const context = {
      window: { AIO: {}, AIO_MACRO_CALENDAR: { releases: { 'us-retail': { lastRelease: '2026-09-16', nextRelease: '2026-10-15' } } }, AIO_MACRO_OFFICIAL_SCHEDULES: { 'us-retail': ['2026-10-15', '2026-11-17'] },
        _aioMacroReleaseNotYet: withClock ? (key, date, nowMs, today) => { const t = releaseAtMs(key, date); return Number.isFinite(t) ? t > nowMs : date >= today; } : undefined },
      _aioMacroTodayIso: (now) => now.toISOString().slice(0, 10),
      _aioMacroIsoDate: (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : null
    };
    runInNewContext(core.slice(start, core.indexOf('\n};', start) + 3), context, { timeout: 1000 });
    context.window.AIO.refreshMacroCalendarFromOfficialSchedule(new Date(iso));
    return context.window.AIO_MACRO_CALENDAR.releases['us-retail'].nextRelease;
  };
  assert.equal(legacyNext('2026-10-15T12:29:00Z'), '2026-10-15', 'v57.83 legacy calendar: before 08:30 ET the same-day release is next');
  assert.equal(legacyNext('2026-10-15T12:31:00Z'), '2026-11-17', 'v57.83 legacy calendar: after 08:30 ET it moves on (native clock)');
  assert.equal(legacyNext('2026-10-15T12:31:00Z', false), '2026-10-15', 'v57.83 without the native clock the legacy date rule is unchanged');
  assert.ok(Object.keys(RELEASE_CLOCKS).includes('us-retail'));
  console.log('scenario guidance fixture (v57.83 release clock decides "다음 발표"): PASS');
}

// v57.83 codex audit F10: fixed market-reading copy states what to check, not an unbacked qualitative probability
// ("가능성이 높습니다/커집니다/큽니다") — a probability needs its non-overlapping sample (R706).
{
  const { readdirSync } = await import('node:fs');
  const dirs = ['src/domain/market', 'src/domain/briefing', 'src/domain/macro'];
  const files = [...dirs.flatMap((dir) => readdirSync(new URL(`../${dir}/`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`)), 'js/aio-kr-data.js'];
  const hits = files.flatMap((file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n').map((line, i) => [file, i + 1, line]).filter(([, , line]) => /가능성이 (높|커|큽|크)/.test(line)).map(([f, n]) => `${f}:${n}`));
  assert.deepEqual(hits, [], `v57.83 unbacked qualitative probability in market copy: ${hits.join(', ')}`);
  console.log('scenario guidance fixture (v57.83 no unbacked probability in market copy): PASS');
}

// v58.80 (owner 2026-10-25): the 거시 asset card reads cross-asset relations on the same 20 sessions. On the 10/23 close
// (10Y −19bp, S&P 500 −1.5%, SMH −13.1%, TLT +2.5%, WTI up, gold down) the reading names the semiconductor lead, the bond
// flight, gold falling, falling rates not lifting stocks and rising oil with falling rates — in story order, at most three.
{
  const { buildCrossAssetRelations } = await import('../src/domain/macro/cross-asset-relations.js');
  const oct = buildCrossAssetRelations(rows, { through: '2026-10-23' });
  assert.equal(oct.asOf, '2026-10-23', 'v58.80 relations read on the asked close');
  assert.deepEqual(oct.breaks.map((item) => item.id).sort(), ['oil-up-rates-down', 'rates-down-stocks-down', 'risk-off-gold-down'], 'v58.80 10/23 relations against the usual direction');
  assert.ok(oct.driver?.startsWith('하락은 반도체가 이끌었습니다') && /장기채가 2\.5% 올라/.test(oct.flow || ''), 'v58.80 driver and bond flow named');
  assert.ok(oct.reading.indexOf('금은') < oct.reading.indexOf('금리가 내렸는데도') && oct.reading.indexOf('금리가 내렸는데도') < oct.reading.indexOf('유가가'), 'v58.80 story order: havens, rates→stocks, oil→rates');
  assert.ok(!/[+-]\d[\d.]*%\s*(올|내)/.test(oct.reading), 'v58.80 a size beside a verb carries no sign');
  const sep = buildCrossAssetRelations(rows, { through: '2026-09-30' });
  assert.deepEqual(sep.breaks, [], 'v58.80 a month that kept the usual relations names none');
  assert.match(sep.reading, /평소 관계에서 크게 벗어나지 않았습니다/, 'v58.80 a quiet month says so');
  const board = readFileSync(new URL('../src/ui/components/macro-board.js', import.meta.url), 'utf8');
  assert.match(board, /buildCrossAssetRelations\(root\._aioHistory \|\| \[\], \{ through: model\.basis \|\| null \}\)/, 'v58.80 the asset card reading uses the card basis');
  console.log('scenario guidance fixture (v58.80 cross-asset relations on the asset card): PASS');
}
}],
// ── section market-guide (was ci-market-guide-fixture.mjs) ──
['market-guide', async () => {
// Owner 2026-10-19 ("시나리오·대응 가이드와 학습"): the shared market guide — one synthesis for 오늘, the AI chat, the server
// narrative and the scenario-state producer. Behaviour checks on fixtures (no text pins on product copy beyond the
// boundary words): the choice tally counts favored/costly across live branches only, the opportunity cost comes from a
// watch branch that names the robust choice costly, lessons are selected by today's state and every lesson links to a
// principles lesson that exists, and no surface turns the count into a probability or an instruction.
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { BRANCHES, CHOICES } = await import('../src/domain/market/macro-crossroads.js');
const { buildMarketGuide, buildDirection, renderMarketGuideContext, CHOICE_KEYS } = await import('../src/domain/guide/market-guide.js');
const { pastEvidence, ANALOG_METHOD } = await import('../src/domain/scenarios/analogs.js');
const { ALL_LESSONS, LESSON_BY_ID, LESSON_KINDS, SCREEN_LESSON_IDS, selectLessons, selectScreenLessons } = await import('../src/domain/guide/lessons.js');

const label = 'v58.31 market guide';
const choiceKeys = new Set(Object.keys(CHOICES));

// Every branch names its costly choices, from the shared four, never overlapping its favoured ones.
for (const branch of BRANCHES) {
  assert.ok(Array.isArray(branch.costly) && branch.costly.length, `${label}: ${branch.id} names costly choices`);
  for (const key of [...branch.favored, ...branch.costly]) assert.ok(choiceKeys.has(key), `${label}: ${branch.id} uses a shared choice key (${key})`);
  assert.ok(!branch.costly.some((key) => branch.favored.includes(key)), `${label}: ${branch.id} costly and favored are disjoint`);
}

// Every lesson links to a principles lesson that exists, has a known kind and a principle and a mechanism.
const library = JSON.parse(readFileSync(new URL('../public-data/principles/lesson-library.json', import.meta.url), 'utf8'));
const lessonIds = new Set((library.lessons || []).map((row) => row.id));
for (const lesson of ALL_LESSONS) {
  assert.ok(lessonIds.has(lesson.concept), `${label}: ${lesson.id} concept ${lesson.concept} exists in the principles library`);
  assert.ok(LESSON_KINDS[lesson.kind] && lesson.principle && lesson.why, `${label}: ${lesson.id} is complete`);
}
assert.equal(new Set(ALL_LESSONS.map((row) => row.id)).size, ALL_LESSONS.length, `${label}: lesson ids are unique`);

// The tally: favoured somewhere, costly nowhere wins; a watch branch that names it costly becomes the opportunity cost.
const path = (id, favored, costly, extra = {}) => ({ id, short: id, title: `${id} — 테스트`, fit: '조건 충족 2/4', favored, costly, choices: Object.fromEntries(CHOICE_KEYS.map((key) => [key, `${id}:${key}`])), triggers: [{ id: 'us-cpi', when: '11/10 CPI', text: '근원 둔화' }], ...extra });
const d = buildDirection([path('a', ['wait', 'defend'], ['stage']), path('b', ['wait'], ['stage'])], [path('w', ['stage', 'hold'], ['wait', 'defend'])]);
assert.equal(d.robust, 'wait', `${label}: the choice favoured in both live branches and costly in none is the robust one`);
assert.equal(d.tally.find((row) => row.key === 'stage').costlyIn.length, 2, `${label}: costly counts come from live branches only`);
assert.equal(d.costIfWrong[0]?.id, 'w', `${label}: the opportunity cost names the watch branch that makes the robust choice costly`);
assert.match(d.costIfWrong[0].text, /w:wait/, `${label}: the opportunity cost quotes that branch's own text for the choice`);
assert.equal(buildDirection([], []).robust, null, `${label}: no live branch means no tally winner`);

// End to end on the published artifacts: a guide is built, its lessons belong to today's state, the AI block holds the boundary.
const history = JSON.parse(readFileSync(new URL('../public-data/history.json', import.meta.url), 'utf8'));
const rows = Array.isArray(history) ? history : history.rows || [];
const { buildMarketRegime } = await import('../src/domain/briefing/market-read.js');
const regime = buildMarketRegime({ history: rows, credit: { hyBp: 315, hyDelta5Bp: -9 }, rates: {} });
const guide = buildMarketGuide({ regime, outlook: null, crossroads: null, nowMs: Date.now() });
assert.ok(guide.available && guide.situation.length === 4, `${label}: the guide builds from the regime alone`);
assert.equal(guide.direction.robust, null, `${label}: without the crossroads nothing is counted`);
const kinds = new Set(guide.lessons.map((row) => row.kind));
assert.ok(Object.keys(LESSON_KINDS).every((kind) => kinds.has(kind)), `${label}: every lesson kind is represented`);
assert.ok(guide.lessons.every((row) => !row.scope || row.scope === 'market'), `${label}: home shows market-scope lessons only`);
const burdened = selectLessons({ regime: { counts: { burden: 5, favorable: 0 }, axes: [{ id: 'trend', state: 'burden' }] } });
assert.ok(burdened.some((row) => row.id === 'survive-first' && row.reason) && burdened.some((row) => row.id === 'cheap-after-fall' && row.reason), `${label}: a burdened tape raises survive-first and the cheap-after-fall trap`);
const calm = selectLessons({ regime: { counts: { burden: 0, favorable: 5 }, axes: [{ id: 'trend', state: 'favorable' }] } });
assert.ok(!calm.some((row) => row.id === 'cheap-after-fall') && calm.some((row) => row.id === 'no-chasing' && row.reason), `${label}: a strong tape raises no-chasing, not the falling-price trap`);
const text = [guide.headline, ...guide.situation.map((row) => row.text), guide.direction.text, ...guide.stance.pursue, ...guide.stance.avoid, ...ALL_LESSONS.map((row) => `${row.principle} ${row.why}`)].join('\n');
assert.doesNotMatch(text, /\d+(?:\.\d+)?\s*%\s*(?:확률|가능성)|매수하세요|매도하세요|목표가|손절가/, `${label}: no probability percentage or trade instruction`);
assert.match(renderMarketGuideContext(guide), /확률로 바꾸지 말고/, `${label}: the AI block restates the boundary`);

// Per-screen lessons: every listed id exists; stock screens never borrow a market-state reason.
const routes = JSON.parse(readFileSync(new URL('../architecture/route-owners.json', import.meta.url), 'utf8'));
const routeIds = new Set(Object.keys(routes.routes));
for (const [route, ids] of Object.entries(SCREEN_LESSON_IDS)) {
  assert.ok(routeIds.has(route), `${label}: screen lessons target a registered route (${route})`);
  for (const id of ids) assert.ok(LESSON_BY_ID[id], `${label}: ${route} lesson ${id} exists`);
}
const burdenCtx = { regime: { counts: { burden: 5, favorable: 0 }, axes: [{ id: 'trend', state: 'burden' }] } };
for (const route of ['technical', 'ticker', 'fundamental', 'screener']) {
  const picked = selectScreenLessons(route, burdenCtx);
  assert.ok(picked.length && picked.every((row) => !row.reason), `${label}: ${route} shows the mechanism, not a market reason`);
}
assert.ok(selectScreenLessons('portfolio', burdenCtx).some((row) => row.id === 'survive-first' && row.reason), `${label}: a market screen ties its lesson to today's state`);
assert.deepEqual(selectScreenLessons('no-such-route', burdenCtx), [], `${label}: an unknown screen shows nothing`);

// Curve and index-earnings lessons (interpretation stages curve / indexEarnings) speak only from their stage output.
const curveCtx = { curve: { kind: 'bull-steepening', fact: '9/19→10/17 20거래일: 2년 -30bp.', label: '불 스티프닝 — 단기 주도 하락', reading: '인하 기대가 앞섭니다.' } };
const curveLesson = LESSON_BY_ID['read-the-curve'];
assert.match(curveLesson.live(curveCtx), /^9\/19→10\/17 20거래일: 2년 -30bp\. 불 스티프닝: 인하 기대가 앞섭니다\.$/, `${label}: the curve lesson quotes the measured move and its reading`);
assert.equal(curveLesson.live({ curve: { kind: null, uninverted: true, uninversionReading: 'U' } }), 'U', `${label}: no direction but a recent un-inversion speaks to the un-inversion`);
assert.equal(curveLesson.live({ curve: { kind: null, uninverted: false } }), null, `${label}: a flat move without un-inversion stays silent`);
assert.equal(selectScreenLessons('macro', curveCtx)[0]?.id, 'read-the-curve', `${label}: the macro screen leads with the live curve lesson`);
const earningsLesson = LESSON_BY_ID['earnings-revisions'];
assert.match(earningsLesson.live({ indexEarnings: { available: true, breadth: 0.5, up: 300, down: 100 } }), /상향 300건, 하향 100건 — 올리는 쪽이 우세합니다/, `${label}: the earnings lesson counts revisions with the card's ±0.1 tilt`);
assert.equal(earningsLesson.live({ indexEarnings: { available: true, breadth: null, up: 3, down: 1 } }), null, `${label}: under-covered index breadth stays silent`);
assert.equal(earningsLesson.live({ indexEarnings: { available: false } }), null, `${label}: no consensus, no sentence`);
assert.equal(selectScreenLessons('fundamental', { indexEarnings: { available: true, breadth: 0.5, up: 3, down: 1 } }).some((row) => row.reason), false, `${label}: a stock screen keeps the earnings lesson as a principle`);
assert.doesNotMatch([curveLesson.live(curveCtx), earningsLesson.live({ indexEarnings: { available: true, breadth: -0.4, up: 10, down: 30 } })].join('\n'), /\d+(?:\.\d+)?\s*%\s*(?:확률|가능성)|매수하세요|매도하세요/, `${label}: live curve/earnings sentences carry no probability or instruction`);

// The ranking lesson states only what the forward record has reached, and keeps that reason on the screener (screen-wide).
const rankLesson = LESSON_BY_ID['rank-is-not-edge'];
assert.doesNotMatch(rankLesson.principle, /확인되지 않았습니다|확인됐습니다/, `${label}: the ranking principle carries no fixed verdict`);
assert.match(rankLesson.live({ rankEvidence: { decision: 'insufficient', n: 4, min: 12 } }), /4개뿐이라\(12개부터 판단\).*아직 모릅니다/, `${label}: an insufficient record says it cannot judge yet`);
assert.match(rankLesson.live({ rankEvidence: { decision: 'not-supported', n: 14, min: 12, icUS: { n: 14, mean: 0.01, t: 0.4 } } }), /우연과 구분되지 않습니다/, `${label}: a not-supported record says so`);
assert.match(rankLesson.live({ rankEvidence: { decision: 'not-supported', n: 14, min: 12, icUS: { n: 14, mean: -0.08, t: -3 } } }), /반대 방향/, `${label}: a significant negative IC is not read as chance`);
assert.match(rankLesson.live({ rankEvidence: { decision: 'insufficient', n: 14, min: 12, icUS: { n: 8 } } }), /8개뿐이라/, `${label}: the count shown is the one the decision used`);
for (const decision of ['insufficient', 'not-supported', 'supported']) assert.match(rankLesson.live({ rankEvidence: { decision, n: 14, min: 12, icUS: { n: 14 } } }), /기본 가중치 미국 순위/, `${label}: ${decision} names the tested scope`);
assert.match(rankLesson.live({ rankEvidence: { decision: 'supported', n: 14, min: 12 } }), /같은 방향이었습니다.*손실 한도/, `${label}: a supported record still keeps the rank a filter`);
assert.match(rankLesson.live({ rankEvidence: { decision: 'insufficient', n: 0, min: 12 } }), /결과가 아직 없어/, `${label}: an empty record does not say "0개뿐"`);
assert.equal(rankLesson.live({}), null, `${label}: no record, no sentence`);
assert.ok(selectScreenLessons('screener', { rankEvidence: { decision: 'insufficient', n: 4, min: 12 } })[0]?.reason, `${label}: the screener shows the record's reason first`);

// Past-frequency evidence (analogs ${ANALOG_METHOD}): a share is informative only beyond 2 standard errors of the base rate.
assert.equal(pastEvidence({ n: 40, up: 22, baseUpPct: 55 }).informative, false, `${label}: a share at the base rate carries no information`);
assert.equal(pastEvidence({ n: 40, up: 38, baseUpPct: 55 }).informative, true, `${label}: a share far beyond the base rate is informative`);
assert.equal(pastEvidence({ n: 5, up: 5, baseUpPct: 55 }).informative, null, `${label}: under 10 cases nothing is tested`);
assert.equal(pastEvidence(null).n, 0, `${label}: no record, no evidence`);
assert.equal(pastEvidence({ n: 40, up: 22, baseUpPct: 55 }).method, ANALOG_METHOD, `${label}: evidence carries its method label`);

console.log(`market guide fixture OK: ${BRANCHES.length} branches tagged, ${ALL_LESSONS.length} lessons linked, ${guide.lessons.length} selected today`);
}],
]);
