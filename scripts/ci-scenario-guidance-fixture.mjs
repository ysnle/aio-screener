import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMarketRegime, movingAverageStructure } from '../src/domain/briefing/market-read.js';
import { buildMarketScenarios } from '../src/domain/market/regime-scenarios.js';
import { buildScenarioOutlook, renderScenarioOutlookContext } from '../src/domain/market/scenario-outlook.js';
import { CHART_INTERVALS, intervalBars, intervalSpec, intervalStructure } from '../src/ui/components/stock-chart.js';
import { buildMarketAnalysisRegimeContext } from './fetch-data.mjs';
import { readProducerSource } from './lib/producer-source.mjs'; // v57.62: fetch-data.mjs + the lib modules split out of it
import { liveCurrentObservations } from '../src/ui/knowledge/current-observations.js';

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
  assert.match(item.fit, /^(조건 부합 \d+\/\d+|판단 보류)$/, 'T06 fit is the met-condition count (one notation with the branches, P1745)');
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
assert.match(context, /현재 조건 부합/, 'P1635/T06: scenario condition count present');

// P1636: research-page observations that the site refreshes are replaced by the latest values.
const artifact = { observations: [
  { id: 'market-spx-20260814', label: 'S&P 500 종가', value: 1, displayValue: '1', unit: 'index', observedAt: '2026-08-14', sourceId: 'x', sourceKind: 'PUBLIC_INFORMATION_SERVICE', allowedUse: 'reference-only', pageTargets: ['principles'] },
  { id: 'sndk-target', label: 'target', value: 50, displayValue: '50%', unit: 'percent', observedAt: '2026-08-13', sourceId: 'y', sourceKind: 'COMPANY_IR_FORWARD_LOOKING', allowedUse: 'reference-only', pageTargets: ['principles'] }
] };
const live = liveCurrentObservations(artifact, { _aioHistory: [{ date: '2026-10-09', spx: 7811.54 }], DATA_SNAPSHOT: {} });
assert.equal(live.observations[0].value, 7811.54, 'P1636: market rows follow the latest close');
assert.equal(live.observations[0].live, true);
assert.equal(live.observations[1].value, 50, 'P1636: dated company targets stay dated references');

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
assert.match(readProducerSource(), /cccOas:\s+\{ id: 'BAMLH0A3HYC'/, 'P1638: producer requests the CCC series');

// P1639: chart evidence adds ATR extension, distance from the 52-week low and the 5/20 EMA order.
const { analyzeChart } = await import('../src/domain/technical/chart-analysis.js');
let level = 100; const daily = [];
for (let i = 0; i < 300; i += 1) { const open = level; level *= 1 + Math.sin(i / 9) * 0.01 + 0.002; daily.push({ time: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10), open, high: Math.max(open, level) * 1.01, low: Math.min(open, level) * 0.99, close: level, volume: 1e6 }); }
const labels = analyzeChart(daily).evidence.map(([label]) => label);
for (const label of ['50일선 대비 ATR 배수', '5일·20일 EMA']) assert.ok(labels.includes(label), `P1639: ${label}`);
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
const validRotation = { schemaVersion: 'rotation-history.v1', modelVersion: 'rrg.v2', benchmark: 'SPY', timeframe: '1d', priceBasis: 'adjusted-close', decisionUse: false, allowedUseCeiling: 'reference', latestCompletedSession: session.date,
  items: { XLK: rrgRow('XLK', 0.5, 101, 101, 'Leading'), XLU: rrgRow('XLU', -1.2, 99, 99, 'Lagging'), XLE: rrgRow('XLE', 1.4, 99, 101, 'Improving'), XLF: { ...rrgRow('XLF', 3, 101, 99, 'Weakening'), status: 'STALE' } } };
const moves = sectorMoves(validRotation, fixtureNow);
assert.deepEqual(moves.rows.map((row) => row.symbol), ['XLE', 'XLK', 'XLU'], 'P1641/M13: exact current rows, strongest first; the stale XLF row is left out');
assert.equal(moves.session, session.date);
assert.equal(sectorMoves(rotation, fixtureNow).rows.length, 0, 'M13: a non-schema artifact yields no rows');

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
const bootstrapSource = readFileSync(new URL('../src/app/bootstrap.js', import.meta.url), 'utf8');
assert.match(bootstrapSource, /installValueBasis\(documentRef/, 'P1643: the basis card is installed at boot');
console.log('scenario guidance fixture (basis card): PASS');

// P1742/P1743 (owner 2026-10-13): forward branches as a registry — chain, dated triggers, three likelihood lines, choices
// with opportunity cost — plus every theme by one rule, scored releases and the automated transition log.
{
  const { buildMacroCrossroads, upcomingMacroEvents, renderMacroCrossroadsContext, releaseActuals, scoreRelease, BRANCHES, CHOICES } = await import('../src/domain/market/macro-crossroads.js');
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
  }
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
    assert.match(item.fit, /^(조건 부합 \d\/\d( · 확인 가능 \d개)?|판단 보류)$/, `P1742 ${item.id}: likelihood is a met-condition count`);
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
  if (model.tiedIds.length >= 2) assert.match(model.headline, /조건 부합이 같은.*길이 (둘|셋|넷|다섯|여섯|일곱|여덟)/, 'audit 1: a tie is said as a tie');
  else if (!model.held) assert.match(model.headline, /가장 많이 맞는 갈림길/);
  // v57.69: a tie keeps the previous refresh's lead; 물가 둔화 needs core PCE and core CPI both at or below their 1-year pace.
  if (model.tiedIds.length >= 2) assert.equal(buildMacroCrossroads({ read, macroHistory, history: rows, events, previousLeadId: model.tiedIds[1] }).leadId, model.tiedIds[1], 'v57.69 a tied lead does not flip away from the previous one');
  const easing = BRANCHES.find((branch) => branch.id === 'softland').conditions[0][1];
  assert.equal(easing({ corePace: 2.5, coreYoy: 3, coreCpiPace: 3.6, coreCpiYoy: 2.6 }), false, 'v57.69 a hot core CPI pace is not disinflation');
  assert.equal(easing({ corePace: 2.5, coreYoy: 3, coreCpiPace: null, coreCpiYoy: null }), true, 'v57.69 PCE alone still counts when CPI is unavailable');
  // Audit 4: a past sample pointing opposite to the favoured choice carries one bridging sentence (no invented %).
  const bridged = buildMacroCrossroads({ read, macroHistory, history: rows, events, outcomes: { sourceLabel: '장기 일봉 기록', branches: { reheat: { n: 4, up: 4, median: 1.2, from: '1990-01-02', to: '2026-10-09', horizon: 20 } } } }).items.find((item) => item.id === 'reheat');
  assert.match(bridged.pastBridge, /^과거 표본에서는 이후 주가가 대체로 올랐습니다 — 이 길의 결론\(기다림·방어 전환\)은 '금리가 더 오르는 길'이 실제로 이어질 때의 비용 기준이며, 표본이 작습니다\.$/, 'audit 4: the bridge sentence');
  assert.doesNotMatch(bridged.pastBridge, /\d+(\.\d+)?%/, 'audit 4: the bridge invents no percentage');
  // Audit 5: a split exposure (달러) is named instead of "no beneficiary".
  const dollar = model.items.find((item) => item.id === 'dollarsurge');
  assert.ok(dollar.impact.mixed && !/수혜 영역 없음/.test(dollar.impact.firmer), 'audit 5: the mixed exposure is rendered, not "수혜 영역 없음"');
  // Audit 6: WTI and Brent 20-session moves in opposite directions are 엇갈림, not "유가 하락 진행 중".
  const wtiDown = /WTI 20거래일 −/.test(model.rateHub.pathsDown.find((path) => path.id === 'oil').evidence);
  const split = buildMacroCrossroads({ read: { ...read, oil: { brent20: wtiDown ? 0.9 : -0.9, basis: 'futures', abnormal: false } }, macroHistory, history: rows, events }).rateHub.pathsDown.find((path) => path.id === 'oil');
  if (/WTI 20거래일 [+−]/.test(split.evidence)) assert.ok(split.stateText === '엇갈림' && split.ok == null && /브렌트 [+−]0\.9%/.test(split.evidence), 'audit 6: the WTI/Brent split is labelled 엇갈림 with both moves');
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
  const playbook = buildThemePlaybook({ usGroups: groups, krThemes, crossroads: fakeCross, credit: 'favorable', labels: { semiconductor: '반도체', software: '소프트웨어', energy: '에너지' } });
  const semi = playbook.themes.find((row) => row.market === 'US' && row.id === 'semiconductor');
  assert.equal(semi.state, 'pullback', 'P1743: a long uptrend with a 1-month drop is read as a pullback inside the trend');
  assert.equal(semi.wind.lead, 'tail', 'P1743: semiconductors get the soft-landing tailwind through their exposure tags');
  assert.deepEqual(semi.favored, ['stage'], 'P1743: pullback × tailwind favours staging in');
  assert.ok(semi.thesis && semi.breaks.length, 'P1743: the structural hypothesis and its break conditions travel with the theme');
  assert.match(semi.fit, /^조건 부합 \d\/5$/, 'P1743: a pullback adds the depth condition');
  const deepPlay = buildThemePlaybook({ usGroups: [{ themeId: 'energy', ret1m: -25, ret3m: 5, ret6m: 8, above50Pct: 35, basis: '2026-10-12', current: true }], crossroads: fakeCross, credit: 'favorable' });
  assert.deepEqual(deepPlay.themes[0].favored, ['wait'], 'P1743: a drop that took back over half the prior gain is not read as a pause to stage into');
  assert.equal(deepPlay.highlights.structuralPullbacks.length, 0, 'P1743: a deep drop is not surfaced as a structural pullback');
  assert.ok(!playbook.themes.some((row) => row.id === 'stale'), 'P1743: a theme off the latest session is not read as current');
  assert.ok(!playbook.themes.some((row) => row.id === 'shipbuilding'), 'P1743: a KR theme with fewer than three priced members is not read');
  assert.ok(playbook.highlights.structuralPullbacks.some((row) => row.id === 'semiconductor'), 'P1743: structural pullbacks are surfaced generically');
  assert.equal(playbook.themes.find((row) => row.id === 'energy').favored[0], 'wait', 'P1743: weak × headwind favours waiting');
  assert.match(rotationOf(playbook.themes).text, /힘이 옮겨 갔습니다|뚜렷한 가격 기준 강약 이동은|부족해/, 'P1743: rotation is read from exposure tags across all themes');
  assert.doesNotMatch(rotationOf(playbook.themes).text, /자금 이동/, 'audit 15: a price-only rotation is not called a money move');
  {
    const mk = (market, id, ret1m) => ({ market, id, label: id, ret1m, tags: ['growth'] });
    const krHeavy = rotationOf([mk('KR', 'a', 12), mk('KR', 'b', 10), mk('KR', 'c', 9), mk('US', 'd', 8), mk('KR', 'e', -9), mk('KR', 'f', -10), mk('KR', 'g', -11), mk('KR', 'h', -12)].map((row, i) => ({ ...row, tags: [i < 4 ? 'growth' : 'energy'] })));
    // v57.54: one US theme is too thin for a US read, so the sentence mixes markets and every name carries its market word.
    assert.match(krHeavy.text, /미국·한국 테마는/, 'v57.54: a thin US set falls back to all themes and says so');
    assert.match(krHeavy.text, /강한 쪽 한국 a\(\+12\.0%\)/, 'audit 15: in a mixed sentence every named theme carries its market');
    assert.doesNotMatch(krHeavy.text, /국내/, "v57.54: the market word is '한국', not the ambiguous '국내'");
    const krOnly = rotationOf([mk('KR', 'a', 12), mk('KR', 'b', 10), mk('KR', 'e', -9), mk('KR', 'f', -10)].map((row, i) => ({ ...row, tags: [i < 2 ? 'growth' : 'defensive'] })));
    assert.ok(krOnly.market === '한국' && /^최근 1개월 한국 테마는/.test(krOnly.text) && !/미국·한국/.test(krOnly.text), `v57.54 review: with no US rows the read says '한국', not '미국·한국' (${krOnly.text})`);
    const usFirst = rotationOf([mk('US', 'u1', 9), mk('US', 'u2', 7), mk('US', 'u3', -6), mk('US', 'u4', -8), mk('KR', 'k1', 20), mk('KR', 'k2', 12), mk('KR', 'k3', -15), mk('KR', 'k4', -23)].map((row, i) => ({ ...row, tags: [i % 4 < 2 ? 'growth' : 'energy'] })));
    assert.match(usFirst.text, /^최근 1개월 미국 테마는/, 'v57.54: with enough US themes the rotation is read on the US set first');
    assert.match(usFirst.text, /강한 쪽 u1\(\+9\.0%\)/, 'v57.54: US names lead without a market word');
    assert.match(usFirst.text, / 한국은 강한 쪽 k1\(\+20\.0%\)·k2\(\+12\.0%\), 약한 쪽 k4\(−?-?23\.0%\)/, 'v57.54: Korea follows as one short secondary line');
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
  const state2 = buildScenarioState({ data, history: rows, macroHistory, calendar, screener, themeMaps: maps, previous: state1, nowMs: now + 3600000 });
  assert.equal(state2.transitions.length, state1.transitions.length, 'P1743: an unchanged market adds no transitions');
  assert.equal(state2.eventOutcomes.length, state1.eventOutcomes.length, 'P1743: releases are not re-scored');
  const moved = JSON.parse(JSON.stringify(state1));
  moved.crossroads.leadId = moved.crossroads.items.find((item) => item.id !== state1.crossroads.leadId).id;
  moved.themes[0].state = moved.themes[0].state === 'leading' ? 'weak' : 'leading';
  const diffs = diffSnapshots(moved, state1, 'T');
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
  assert.match(buildMarketAnalysisRegimeContext(data, rows), /【앞으로의 갈림길/, 'P1742: the narrative producer gets the forward branches');
  const { chooseAnswerMode } = await import('../src/ai/response/answer-modes.js');
  assert.equal(chooseAnswerMode({ intent: { canonical: ['OUTLOOK'] } }), 'outlook', 'P1742: a market outlook question is answered as branches');
  assert.equal(chooseAnswerMode({ asksDecision: true, hasTicker: true, intent: { canonical: ['OUTLOOK'] } }), 'decision', 'P1742: a single-company decision stays a decision');
  const component = readFileSync(new URL('../src/ui/components/macro-crossroads.js', import.meta.url), 'utf8');
  assert.match(component, /if \(alt\) cards\.append\(pathCard\(doc, root, alt, \{ kicker: '함께 볼 길'/, 'P1742: the compact block never shows one path alone (v57.54: as the second path card)');
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
