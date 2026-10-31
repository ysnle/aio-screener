// scripts/fixtures/pipeline-semantics/market.mjs — v59.45 pipeline review regressions (market time·session, market calculations, macro·rates·FX, market producers)
import assert from 'node:assert/strict';

const KR_DAYS = (from, n) => { const out = []; let ms = Date.parse(`${from}T12:00:00Z`); while (out.length < n) { const d = new Date(ms); if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10)); ms += 86400000; } return out; };
const segment = { above5: 50, above20: 50, above50: 50, above200: 50, advanceRatio: 0.5, coveragePct: 95, eligible: 500, observedAt: '2026-10-28T20:00:00Z' };
const rotation = (daily, session = '2026-10-22') => ({ schemaVersion: 'rotation-history.v1', modelVersion: 'rrg.v3', benchmark: 'SPY', timeframe: '1d', priceBasis: 'adjusted-close', decisionUse: false, allowedUseCeiling: 'reference', latestCompletedSession: session,
  items: Object.fromEntries(Object.entries(daily).map(([symbol, pct]) => [symbol, { status: 'CURRENT', sessionDate: session, rsRatio: 101, rsMomentum: 101, quadrant: 'Leading', dailyPct: pct, weeklyPct: pct, alignedSessionCount: 60, observedAt: `${session}T20:00:00.000Z`, fetchedAt: `${session}T20:20:00.000Z` }])) });

// Eleven sector closes for one session (the money-flow line needs eight or more).
const ELEVEN = { XLP: 3.3, XLU: 2.1, XLV: 1.3, XLF: 1.1, XLRE: 1.1, XLB: 0.7, XLY: -0.5, XLE: -0.9, XLI: -1, XLC: -1.4, XLK: -3.3 };

export const cases = [
  { id: 'RUN6-SMH-01', name: 'the money-flow SMH move is the completed history close the 주도 영역 line prints, not a later rotation bar', run: async ({ load }) => {
    const { buildMarketFlow } = await load('src/domain/market/market-flow.js');
    const { sessionMove } = await load('src/domain/market/leadership-verdict.js');
    const history = [{ date: '2026-10-21', smh: 100, tnx: 4.17 }, { date: '2026-10-22', smh: 93, tnx: 4.11 }];
    const flow = buildMarketFlow({ rotationHistory: rotation({ ...ELEVEN, SMH: -8.4 }), history, nowMs: Date.parse('2026-10-23T01:00:00Z') });
    const semis = sessionMove(history, 'smh', '2026-10-22');
    assert.equal(Math.round(semis.change * 10) / 10, -7);
    assert.doesNotMatch(flow.line, /-8\.4%/);
  } },
  { id: 'RUN6-10Y-01', name: 'the money-flow 10-year change is tenYearClose of the same history (one source for the figure)', run: async ({ load }) => {
    const { buildMarketFlow } = await load('src/domain/market/market-flow.js');
    const { tenYearClose } = await load('src/domain/macro/rates-fx.js');
    const history = [{ date: '2026-10-20', spx: 1, tnx: 4.20 }, { date: '2026-10-21', spx: 1, tnx: 4.17 }, { date: '2026-10-22', spx: 1, tnx: 4.11 }];
    const flow = buildMarketFlow({ rotationHistory: rotation(ELEVEN), history, nowMs: Date.parse('2026-10-23T01:00:00Z') });
    assert.equal(flow.tenYearBp, tenYearClose(history).d1Bp);
    assert.equal(flow.tenYearBp, -6);
  } },
  { id: 'RUN6-TIE-02', name: 'a tie in the scenario model reads as a tie everywhere: no single lead, every tied branch named, no alternative', run: async ({ load }) => {
    const { scenarioLead } = await load('src/domain/market/scenario-lead.js');
    const { liveBranches } = await load('src/domain/briefing/event-guide.js');
    const items = [{ id: 'aibust', title: 'AI 투자 꺾임 — x', fit: '조건 충족 2/4' }, { id: 'oilshock', title: '유가 충격 — y', fit: '조건 충족 2/4' }, { id: 'reflation', title: '재가속 — z', fit: '조건 충족 1/4' }];
    const tie = { available: true, leadId: 'oilshock', altId: 'reflation', tiedIds: ['aibust', 'oilshock'], items };
    const read = scenarioLead(tie);
    assert.equal(read.state, 'tie');
    assert.deepEqual(read.ids.sort(), ['aibust', 'oilshock']);
    assert.deepEqual(liveBranches(tie).map((row) => row.role), ['동률', '동률']);
    assert.equal(scenarioLead({ ...tie, tiedIds: [] }).state, 'lead');
    assert.equal(scenarioLead({ ...tie, held: true }).state, 'held');
  } },
  { id: 'P16-TIME-01', name: '특별 개장(10:00) 날 09:30은 정규장이 아니라 개장 전이다', run: async ({ load }) => {
    const { marketClock } = await load('src/domain/market/session-bridge.js');
    assert.equal(marketClock(Date.parse('2026-11-19T09:30:00+09:00')).kr.phase, 'before');
    assert.equal(marketClock(Date.parse('2026-11-19T10:05:00+09:00')).kr.phase, 'regular');
    assert.equal(marketClock(Date.parse('2026-11-18T09:30:00+09:00')).kr.phase, 'regular');
  } },
  { id: 'P16-TIME-02', name: '다른 세션의 코스닥·반도체 ETF는 한국장 원인 비교에 쓰지 않는다', run: async ({ load }) => {
    const { koreaLinks } = await load('src/domain/market/session-bridge.js');
    const common = { kospi: { change: 1, observedAt: '2026-10-28T06:30:00Z' }, nasdaq: { change: 1, observedAt: '2026-10-27T20:00:00Z' } };
    const aligned = koreaLinks({ ...common, kosdaq: { change: 1, observedAt: '2026-10-28T06:30:00Z' } });
    const mixed = koreaLinks({ ...common, kosdaq: { change: -8, observedAt: '2026-10-26T06:30:00Z' }, semis: { change: 20, observedAt: '2026-10-29T20:00:00Z' } });
    assert.equal(mixed.find((row) => row.id === 'local').verdict, aligned.find((row) => row.id === 'local').verdict);
    assert.doesNotMatch(mixed.find((row) => row.id === 'us').evidence, /\+20\.0%/);
    assert.doesNotMatch(mixed.find((row) => row.id === 'local').evidence, /코스닥/);
  } },
  { id: 'P16-TIME-03', name: '현재보다 뒤의 선물 관측은 0분 전이 아니라 시각 확인 안 됨이다', run: async ({ load }) => {
    const { buildSessionBridge } = await load('src/domain/market/session-bridge.js');
    const out = buildSessionBridge({ nowMs: Date.parse('2026-10-28T08:00:00Z'), snapshot: { generatedAt: '2026-10-29T08:00:00Z', quotes: [{ instrumentId: 'NQ=F', value: 22000, changePct: 2, observedAt: '2026-10-29T08:00:00Z' }] } });
    assert.equal(out.readings.nq.ageMin, null);
    assert.equal(out.snapshotAgeMin, null);
    assert.doesNotMatch(out.futuresLine, /0분 전/);
    assert.match(out.futuresLine, /관측 시각 확인 안 됨/);
  } },
  { id: 'P16-RANK-01', name: '표본 밖 최댓값의 백분위는 100을 넘지 않는다', run: async ({ load }) => {
    const { recordPercentile } = await load('src/domain/market/close-series.js');
    const series = Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: i }));
    assert.equal(recordPercentile(series, 99).pct, 100);
    assert.equal(recordPercentile(series).pct, 100);
  } },
  { id: 'P16-USE-01', name: "생산자가 allowedUse 'none'을 주면 reference로 넓히지 않는다", run: async ({ load }) => {
    const { deriveQuotePresentation } = await load('src/domain/market/quote-presentation.js');
    const out = deriveQuotePresentation({ symbol: 'X', price: 10, quoteEnvelope: { value: 10, observedAt: '2026-10-28T20:00:00Z', allowedUse: 'none' } });
    assert.notEqual(out?.allowedUse, 'reference');
  } },
  { id: 'P17-BREADTH-01', name: '관측 시각 없는 한국 시장 폭은 검증 통과가 아니다', run: async ({ load }) => {
    const { readScreenerBreadth } = await load('src/domain/market/screener-breadth.js');
    const out = readScreenerBreadth({ schemaVersion: '1.0', segments: { us: segment, kr: { ...segment, observedAt: undefined } } }, Date.parse('2026-10-29T00:00:00Z'));
    assert.equal(out.kr, null);
    assert.equal(out.krState.status, 'blocked');
    assert.equal(out.state.status, 'verified_current');
  } },
  { id: 'P17-BREADTH-02', name: '오래된 S&P 500 모집단이 최신 미국 모집단을 막지 않는다', run: async ({ load }) => {
    const { readScreenerBreadth } = await load('src/domain/market/screener-breadth.js');
    const out = readScreenerBreadth({ schemaVersion: '1.0', segments: { us: segment, kr: segment, sp500: { ...segment, observedAt: '2026-10-01T20:00:00Z' } } }, Date.parse('2026-10-29T00:00:00Z'));
    assert.equal(out.state.status, 'verified_current');
    assert.equal(out.us.generatedAt, segment.observedAt);
    assert.ok(out.kr);
  } },
  { id: 'P17-MAP-01', name: '거래대금 미확인은 회전율 0으로 시가총액을 버리지 않는다', run: async ({ load }) => {
    const { buildSectorMap } = await load('src/domain/market/sector-map.js');
    const rows = Array.from({ length: 20 }, (_, i) => ({ sym: `TEST${i}`, sector: 'Technology', index: 'SP500', referenceMarketCap: { billions: 1 }, ret1d: 1, factorSessionDate: '2026-10-28' }));
    assert.equal(buildSectorMap({ rows }).available, true);
  } },
  { id: 'P17-CONSENSUS-01', name: '결측 시장 폭 세 개는 강세 합의가 아니다', run: async ({ load }) => {
    const { diagnoseBreadthConsensus } = await load('src/domain/market/breadth-consensus.js');
    const registry = { BREADTH: { getLabel: (v) => ({ signal: v === 0 ? 'capitulation' : 'mixed', label: 'fixture' }) } };
    assert.equal(diagnoseBreadthConsensus({ sma5: null, sma20: null, sma50: '' }, registry).verdict, '—');
    assert.equal(diagnoseBreadthConsensus({ sma5: 0 }, registry).details[0].value, 0);
  } },
  { id: 'P17-EARNINGS-01', name: '미래 날짜 종가는 최신 가격이 아니고, 문자열 비중은 숫자로 더한다', run: async ({ load }) => {
    const { buildIndexEarnings } = await load('src/domain/market/index-earnings.js');
    const now = Date.parse('2026-10-29T00:00:00Z');
    const consensus = { rows: { TEST: { asOf: '2026-10-28', fwd: { eps: 5, up4w: 1, down4w: 0 } }, B: { asOf: '2026-10-28', fwd: { eps: 5, up4w: 1, down4w: 0 } } } };
    const future = buildIndexEarnings({ now, rows: [{ sym: 'TEST', valuationPrice: 100, factorSessionDate: '2099-01-01' }], weights: { rows: [{ sym: 'TEST', weight: 100 }] }, consensus });
    assert.equal(future.forwardPe, null);
    const strings = buildIndexEarnings({ now, rows: [{ sym: 'TEST', valuationPrice: 100, factorSessionDate: '2026-10-28' }, { sym: 'B', valuationPrice: 100, factorSessionDate: '2026-10-28' }], weights: { rows: [{ sym: 'TEST', weight: '50' }, { sym: 'B', weight: '50' }] }, consensus });
    assert.equal(strings.coveragePct, 100);
  } },
  { id: 'P17-RELEASE-01', name: '실업률 미확인·하락은 보합~+0.1%p 조건 충족이 아니고, 부분 공개 고용은 소비하지 않는다', run: async ({ load }) => {
    const { scoreRelease, releaseActuals } = await load('src/domain/market/macro-crossroads.js');
    assert.ok(!scoreRelease('us-nfp', { payroll: 100, unempDelta: null, wageMoM: 0.2 }).some((x) => x.branchId === 'softland'));
    assert.ok(!scoreRelease('us-nfp', { payroll: 100, unempDelta: -0.5, wageMoM: 0.2 }).some((x) => x.branchId === 'softland'));
    assert.ok(scoreRelease('us-nfp', { payroll: 100, unempDelta: 0.1, wageMoM: 0.2 }).some((x) => x.branchId === 'softland'));
    const macroHistory = { series: { payrolls: { observations: [['2026-08-01', 1000], ['2026-09-01', 1100]] }, unemployment: { observations: [['2026-07-01', 4.1], ['2026-08-01', 4.2]] } } };
    assert.deepEqual(releaseActuals(macroHistory)['us-nfp'].missing, ['unemployment', 'hourlyEarnings']);
    const { scoreNewReleases } = await load('scripts/build-scenario-state.mjs');
    const first = scoreNewReleases(macroHistory, {}, 'T1');
    assert.equal(first.lastScored['us-nfp'], undefined);
  } },
  { id: 'P17-OUTLOOK-01', name: 'RRG 경계의 선도 업종은 경계 링크에 나온다', run: async ({ load }) => {
    const { buildScenarioOutlook } = await load('src/domain/market/scenario-outlook.js');
    const border = { symbol: 'XLK', label: '기술', rsRatio: 100.2, rsMomentum: 100.2, quadrant: 'Leading' };
    const out = buildScenarioOutlook({ scenarios: { available: true, asOf: '2026-10-28', scenarios: [{ id: 'expansion' }] }, regime: { available: true, axes: [] }, sectors: [border] });
    assert.ok(out.items[0].opportunityLinks.some((part) => part.links.some((link) => link.label === '기술')));
  } },
  { id: 'P17-FLOW-01', name: '가격 관측만으로 돈이 옮겨갔다고 쓰지 않고 업종 분모는 관측 수다', run: async ({ load }) => {
    const { buildMarketFlow } = await load('src/domain/market/market-flow.js');
    const day = { XLP: 3.3, XLU: 2.1, XLV: 1.3, XLF: 1.1, XLRE: 1.1, XLB: 0.7, XLY: -0.5, XLE: -0.9, XLI: -1, XLC: -1.4, XLK: -3.3, SMH: -6 };
    const nowMs = Date.parse('2026-10-23T01:00:00Z');
    const flow = buildMarketFlow({ rotationHistory: rotation(day), nowMs });
    assert.equal(flow.kind, 'defensive');
    assert.doesNotMatch(flow.read, /돈/);
    const { XLB, XLRE, ...nine } = day;
    assert.match(buildMarketFlow({ rotationHistory: rotation(nine), nowMs }).line, /9개 업종 중/);
  } },
  { id: 'P17-TIMELINE-01', name: '변화가 없는 시간대 항목은 0.00%로 표시하지 않는다', run: async ({ load }) => {
    const { formatSlotMove } = await load('src/domain/market/market-timeline.js');
    assert.equal(formatSlotMove({ label: 'TEST', change: null }), null);
    assert.equal(formatSlotMove({ label: 'TEST', change: 0 }).text, '0.00%');
  } },
  { id: 'P17-FXCARD-01', name: '기준일보다 오래된 원/달러 카드는 stale로 표시한다', run: async ({ load }) => {
    const { buildKoreaRegimeObservations } = await load('src/domain/market/regime-scenarios.js');
    const history = KR_DAYS('2026-08-03', 45).map((date, i) => ({ date, usdkrw: 1300 + i }));
    const out = buildKoreaRegimeObservations({ history }, { nowMs: Date.parse('2026-10-29T00:00:00Z'), through: '2026-10-28' });
    assert.equal(out.cards.find((card) => card.id === 'usdkrw').stale, true);
  } },
  { id: 'P18-INFLATION-01', name: '물가 지표 하나만 공개되면 조건 문구가 두 지표 모두라고 말하지 않는다', run: async ({ load }) => {
    const { inflationDirection } = await load('src/domain/macro/macro-signals.js');
    const { BRANCHES } = await load('src/domain/market/macro-crossroads.js');
    const one = inflationDirection({ pce: { pace: 1, yoy: 3, date: '2026-09-01' } });
    const both = inflationDirection({ pce: { pace: 1, yoy: 3, date: '2026-09-01' }, cpi: { pace: 1, yoy: 3, date: '2026-09-01' } });
    // v57.69 keeps a single published measure deciding; the condition then names that measure instead of "모두".
    const [label, test] = BRANCHES.find((x) => x.id === 'softland').conditions[0];
    assert.equal(test({ inflationDir: one }), true);
    assert.doesNotMatch(label({ inflationDir: one }), /PCE·CPI 모두/);
    assert.match(label({ inflationDir: one }), /근원 PCE만 공개/);
    assert.match(label({ inflationDir: both }), /PCE·CPI 모두/);
  } },
  { id: 'P18-CURVE-01', name: '다른 날짜의 공식 2s10s가 최신 곡선을 역전으로 뒤집지 않는다', run: async ({ load }) => {
    const { buildRatesFx } = await load('src/domain/macro/rates-fx.js');
    const macro = { t10y2y: -1, _asOf_t10y2y: '2026-01-01' };
    for (const [key, value] of Object.entries({ dgs2: 4, dgs5: 4.1, dgs10: 5, dgs20: 5.1, dgs30: 5.2 })) { macro[key] = value; macro[`_asOf_${key}`] = '2026-10-28'; }
    const curve = buildRatesFx({ macro }).treasury;
    assert.equal(curve.curve[0].value, 1);
    assert.doesNotMatch(curve.fact, /역전/);
    const same = buildRatesFx({ macro: { ...macro, t10y2y: 0.98, _asOf_t10y2y: '2026-10-28' } }).treasury;
    assert.equal(same.curve[0].value, 0.98);
    const { dgs5, _asOf_dgs5, ...noFive } = macro;
    assert.equal(buildRatesFx({ macro: { ...noFive, dgs5: 4.1 } }).treasury.sameCut, false);
  } },
  { id: 'P18-RELATIONS-01', name: '관측하지 않은 자산·다른 기간 자산을 평소 관계라고 쓰지 않는다', run: async ({ load }) => {
    const { buildCrossAssetRelations } = await load('src/domain/macro/cross-asset-relations.js');
    const history = KR_DAYS('2026-07-01', 60).map((date, i) => ({ date, spx: 100, tnx: 4, ...(i < 40 ? { gold: 100 } : {}) }));
    const out = buildCrossAssetRelations(history);
    assert.equal(out.moves.gold, null);
    assert.doesNotMatch(out.reading, /유가·금리·주식·장기채·금·달러는/);
    assert.match(out.reading, /확인하지 못함/);
  } },
  { id: 'P18-LONG-01', name: '보존된 오래된 시리즈의 미완성 월을 완성 월평균으로 읽지 않는다', run: async ({ load }) => {
    const { longHistoryRows } = await load('src/domain/macro/long-history.js');
    const observations = Array.from({ length: 129 }, (_, i) => [new Date(Date.UTC(2016, i, 1)).toISOString().slice(0, 7), i]);
    const before = longHistoryRows({ series: { dgs10: { observations, stale: true, fetchedAt: '2026-09-15T00:00:00Z' } }, generatedAt: '2026-09-15' })[0];
    const after = longHistoryRows({ series: { dgs10: { observations, stale: true, fetchedAt: '2026-09-15T00:00:00Z' } }, generatedAt: '2026-10-01' })[0];
    assert.equal(after.last.month, before.last.month);
    assert.equal(longHistoryRows({ series: { dgs10: { observations, stale: true } }, generatedAt: '2026-10-01' })[0].last.month, '2026-08');
    const { collectMacroLongHistory } = await load('scripts/producer/macro-history.mjs');
    const previousLong = { generatedAt: '2026-09-15T00:00:00.000Z', series: { dgs10: { observations } } };
    const kept = await collectMacroLongHistory('k', previousLong, { fetchFn: async () => { throw new Error('offline'); }, nowMs: Date.parse('2026-10-01T00:00:00Z') });
    assert.equal(kept.series.dgs10.fetchedAt, '2026-09-15T00:00:00.000Z');
    assert.equal(kept.series.dgs10.stale, true);
  } },
  { id: 'P18-POLICY-01', name: '정책금리 하단 이력을 생산 목록에 둔다', run: async ({ load }) => {
    const { MACRO_HISTORY_SERIES } = await load('scripts/producer/macro-history.mjs');
    assert.equal(MACRO_HISTORY_SERIES.fedTargetLower?.id, 'DFEDTARL');
  } },
  { id: 'P18-FX-01', name: '엔/달러 하락률을 엔화 가치 수익률이라고 부르지 않는다', run: async ({ load }) => {
    const { buildRatesFx } = await load('src/domain/macro/rates-fx.js');
    const history = KR_DAYS('2026-09-01', 30).map((date, i) => ({ date, spx: 100, usdjpy: 150 - i }));
    const carry = buildRatesFx({ macro: {}, history }).carry;
    if (carry?.available) { assert.doesNotMatch(carry.text, /엔화 가치/); assert.match(carry.text, /엔\/달러 20거래일 -/); }
  } },
  { id: 'P18-CURVE-02', name: '결측 만기는 0% 곡선 점이 되지 않는다', run: async ({ load }) => {
    const { deriveTreasuryCurveEvidence } = await load('src/domain/macro/treasury-curve.js');
    const out = deriveTreasuryCurveEvidence({ treasury: { observedAt: '2026-10-28', values: { dgs2: 4, dgs5: null, dgs10: 4.2, dgs20: null, dgs30: 4.5 } } });
    assert.ok(!out.curve.points.some((point) => point.tenor === '5Y' || point.tenor === '20Y'));
  } },
  { id: 'P18-LIQ-01', name: 'TGA 결측은 0으로 순유동성을 만들지 않는다', run: async ({ load }) => {
    const { netLiquiditySeries } = await load('src/domain/macro/liquidity-growth.js');
    const out = netLiquiditySeries({ series: { fedBalanceSheet: { observations: [['2026-10-28', 7000000]] }, treasuryAccount: { observations: [['2026-10-28', null]] }, reverseRepo: { observations: [['2026-10-28', 100]] } } });
    assert.deepEqual(out, []);
  } },
  { id: 'P8-THEME-01', name: '수익률이 한 종목에만 있으면 테마 역할·과열을 판정하지 않는다', run: async ({ load }) => {
    const { memberRoles, themeCriteria } = await load('src/domain/scenarios/theme-criteria.js');
    const members = [
      { sym: 'A', row: { ret1m: 5, ret3m: 10, pctSma50: 2, adrPct: 2, ret5d: 1, pctFrom52wHigh: -5 } },
      { sym: 'B', row: { ret1m: null, ret3m: null, pctSma50: 2, adrPct: 2, ret5d: null } },
      { sym: 'C', row: { ret1m: null, ret3m: null, pctSma50: 2, adrPct: 2, ret5d: null } }
    ];
    assert.equal(memberRoles(members).measured, false);
    assert.equal(themeCriteria({ row: {}, members }).items.find((item) => item.id === 'heat').met, null);
  } },
  { id: 'P9-THEME-02', name: '테마 기본 빈도는 비교지수가 있는 같은 기간으로 센다', run: async ({ load }) => {
    const { themeStateOutcomes } = await load('src/domain/scenarios/analogs.js');
    const dates = Array.from({ length: 2500 }, (_, i) => new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10));
    const a = dates.map((date, i) => [date, 100 * 1.002 ** i]);
    const b = dates.map((date, i) => [date, i < 1500 ? 10000 - i : 100 * 1.002 ** i]);
    const benchmark = dates.slice(1500).map((date) => [date, 100]);
    const first = themeStateOutcomes(a, { benchmark, benchmarkField: 'rsp' }).leading;
    const second = themeStateOutcomes(b, { benchmark, benchmarkField: 'rsp' }).leading;
    assert.equal(first.baseN, second.baseN);
    assert.equal(first.baseUpPct, second.baseUpPct);
  } },
  { id: 'P10-STATE-01', name: '방금 받은 옛 시나리오 상태는 테마 단계·회전 문장으로 쓰지 않는다', run: async ({ load }) => {
    const { themeStagesFor, scenarioStateCurrent, SCENARIO_STATE_CURRENT } = await load('src/domain/scenarios/theme-stage.js');
    const { themeRotationRead, THEME_PLAYBOOK_VERSION } = await load('src/domain/scenarios/theme-playbook.js');
    const nowMs = Date.parse('2026-10-30T12:00:00Z');
    const state = (asOf, extra = {}) => ({ status: SCENARIO_STATE_CURRENT, playbookVersion: THEME_PLAYBOOK_VERSION, basis: { themeAsOfByMarket: { US: asOf } }, rotation: { text: 'ROT' },
      themes: [{ market: 'US', id: 'audit', label: 'Audit', state: 'weak', basis: asOf }], ...extra });
    const old = state('2020-01-01');
    assert.equal(scenarioStateCurrent(old, { nowMs }), false);
    assert.deepEqual(themeStagesFor({ _aioScenarioState: old }, { themeIds: ['audit'], market: 'US', nowMs }), []);
    assert.equal(themeRotationRead({ artifact: old, nowMs }).source, null);
    const fresh = state('2026-10-29');
    assert.equal(themeStagesFor({ _aioScenarioState: fresh }, { themeIds: ['audit'], market: 'US', nowMs }).length, 1);
    assert.equal(themeRotationRead({ artifact: fresh, nowMs }).asOf, '2026-10-29');
    assert.equal(themeRotationRead({ artifact: { ...fresh, status: 'pending' }, nowMs }).source, null);
    assert.equal(scenarioStateCurrent({ ...fresh, playbookVersion: 'theme-playbook.v1' }, { nowMs }), false);
  } },
  { id: 'R3-04', name: '한국 지수 비중: 빈 시장은 이전 비중을 보존하고, 덜 읽은 시장은 실패한다', run: async ({ load }) => {
    const { buildKrIndexWeights, fetchMarket } = await load('scripts/fetch-kr-index-weights.mjs');
    const row = (code, cap, r) => ({ stockEndType: 'stock', itemCode: code, stockName: code, marketValueRaw: String(cap), fluctuationsRatio: String(r), localTradedAt: '2026-10-30T15:30:00+09:00' });
    const previous = { generatedAt: '2026-10-29T07:20:00Z', markets: { KOSDAQ: { asOf: '2026-10-29', count: 1762, rows: [{ code: '247540', name: 'X', weightPct: 5, ret1dPct: 1 }] } } };
    const out = buildKrIndexWeights({ KOSPI: [row('005930', 500, 1)], KOSDAQ: [] }, '2026-10-30T07:20:00Z', previous);
    assert.deepEqual(Object.keys(out.markets).sort(), ['KOSDAQ', 'KOSPI']);
    assert.equal(out.markets.KOSDAQ.retained, true);
    const pages = { 1: Array.from({ length: 100 }, (_, i) => row(String(100000 + i * 10), 100, 0)), 2: [] };
    const fetchImpl = async (url) => ({ ok: true, json: async () => ({ totalCount: 250, stocks: pages[Number(new URL(url).searchParams.get('page'))] || [] }) });
    await assert.rejects(fetchMarket('KOSPI', fetchImpl, { pauseMs: 0 }), /incomplete/);
    const noTotal = async () => ({ ok: true, json: async () => ({ stocks: pages[1] }) });
    await assert.rejects(fetchMarket('KOSPI', noTotal, { pauseMs: 0 }), /incomplete/);
  } },
  { id: 'R4-04', name: 'VIX 기간구조: VIX=VIX3M은 역전, 9일물만 높으면 앞쪽 역전', run: async ({ load }) => {
    const { vixTermStructure } = await load('src/domain/sentiment/metrics.js');
    assert.equal(vixTermStructure({ vix9d: 19, vix: 20, vix3m: 20, vix6m: 21 }).regime, '백워데이션');
    assert.match(vixTermStructure({ vix9d: 24, vix: 20, vix3m: 21, vix6m: 22 }).regime, /^앞쪽 역전/);
    assert.equal(vixTermStructure({ vix9d: 18, vix: 19, vix3m: 21, vix6m: 22 }).regime, '콘탱고');
  } },
  { id: 'R1-01', name: '시장 상태 5일 변화는 행 수가 아니라 거래일로 거슬러 간다', run: async ({ load }) => {
    const { fiveDayChange } = await load('src/ui/components/market-regime.js');
    const dates = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-29'];
    const values = [100, 90, 100, 101, 101, 101, 105]; // 10/27 is missing: five sessions back is 10/22 (100), the sixth row 10/21 (90)
    const history = dates.map((date, i) => ({ date, dxy: values[i] }));
    assert.equal(fiveDayChange('commodities', { history }, '2026-10-29'), '+5.0%');
  } },
  { id: 'R1-05', name: '반올림해 0인 변화는 오른 섹터·색 방향으로 세지 않는다', run: async ({ load }) => {
    const { sectorMoves } = await load('src/ui/components/sector-moves.js');
    const day = { XLP: 0.003, XLU: 1, XLV: -1, XLF: -1, XLRE: -1, XLB: -1, XLY: -1, XLE: -1, XLI: -1, XLC: -1, XLK: -1 };
    assert.equal(sectorMoves(rotation(day), Date.parse('2026-10-23T01:00:00Z')).upCount, 1);
    const { krIndexTrendFacts } = await load('src/ui/components/kr-index-trend.js');
    const facts = krIndexTrendFacts([{ date: '2026-10-28', kospi: 3000 }, { date: '2026-10-29', kospi: 2999.1 }], 'kospi');
    assert.equal(facts.d1Direction, null);
  } },
  { id: 'P2164-AXIS-01', name: '불안정은 안정이 아니고, 신용융자는 신용 축이 아니며, 완화는 그 상태의 주장이 아니다', run: async ({ load }) => {
    const { axisStateClaimIssues } = await load('scripts/lib/market-analysis-validate.mjs');
    assert.deepEqual(axisStateClaimIssues('신용 시장은 불안정합니다.', { context: 'credit: favorable — 스프레드 낮음' }), ['axis-state-contradiction:credit']);
    assert.deepEqual(axisStateClaimIssues('신용융자 잔고는 부담입니다.', { context: 'credit: favorable — 스프레드 낮음' }), []);
    assert.deepEqual(axisStateClaimIssues('하이일드 스트레스가 완화됐습니다.', { context: 'credit: favorable — 스프레드 낮음' }), []);
    assert.deepEqual(axisStateClaimIssues('하이일드 스프레드와 달리 변동성은 안정입니다.', { context: 'credit: burden — 스프레드 확대' }), []);
  } },
  { id: 'P2164-DATES-01', name: '지수 이름의 숫자(S&P 500)는 수치가 아니고, 0을 붙인 날짜(10/30)도 날짜다', run: async ({ load }) => {
    const { crossMarketDateIssues } = await load('scripts/lib/market-analysis-validate.mjs');
    const dates = { krDate: '2026-10-30', usDate: '2026-10-29' };
    assert.deepEqual(crossMarketDateIssues('코스피와 S&P 500이 함께 약했습니다.', dates), []);
    assert.deepEqual(crossMarketDateIssues('코스피(10/30)는 1.2% 올랐고 S&P 500(10/29)은 0.4% 내렸습니다.', dates), []);
    assert.deepEqual(crossMarketDateIssues('코스피는 1.2% 올랐고 S&P 500은 0.4% 내렸습니다.', dates), ['cross-market-session-dates-missing']);
  } },
  { id: 'P2166-SPREAD-01', name: '다른 날짜의 공식 2s10s 스프레드는 같은 날짜 스프레드로 표시하지 않는다', run: async ({ load }) => {
    const { buildTreasuryCurveSpread } = await load('src/domain/macro/treasury-curve.js');
    const legs = { twoY: { observedAt: '2026-10-30T20:00:00Z', cutId: 'ust-2026-10-30' }, tenY: { observedAt: '2026-10-30T20:00:00Z', cutId: 'ust-2026-10-30' } };
    const stale = buildTreasuryCurveSpread({ twoY: 3.6, tenY: 3.98, officialSpread: 0.30, officialSpreadMeta: { observedAt: '2026-10-29', source: 'FRED' }, legs });
    assert.equal(stale.comparable, false);
    assert.equal(stale.spread, null);
    const same = buildTreasuryCurveSpread({ twoY: 3.6, tenY: 3.98, officialSpread: 0.38, officialSpreadMeta: { observedAt: '2026-10-30', source: 'FRED' }, legs });
    assert.equal(same.spread, 0.38);
  } },
  { id: 'P2166-LONG-01', name: '실업률·근원 CPI의 월 값은 월평균이라 부르지 않는다(일간 평균인 금리는 그대로)', run: async ({ load }) => {
    const { longHistoryRows } = await load('src/domain/macro/long-history.js');
    const months = Array.from({ length: 150 }, (_, i) => [`${2010 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, 4 + (i % 7) / 10]);
    const rows = longHistoryRows({ generatedAt: '2026-10-31T00:00:00Z', series: { unemployment: { unit: 'percent', observations: months }, dgs10: { unit: 'percent', observations: months } } });
    const text = Object.fromEntries(rows.map((row) => [row.field || row.id, row.monthText]));
    const unemployment = rows.find((row) => /실업|unemployment/i.test(`${row.field || ''}${row.id || ''}${row.label || ''}`));
    const dgs10 = rows.find((row) => /10|dgs10/i.test(`${row.field || ''}${row.id || ''}`));
    assert.ok(unemployment && dgs10, `rows found: ${JSON.stringify(text)}`);
    assert.doesNotMatch(unemployment.monthText, /월평균/);
    assert.match(dgs10.monthText, /월평균/);
  } },
  { id: 'P2165-COMPARE-01', name: '비교표 기간 수익률은 이 종목의 날짜로 맞추고, 며칠 전에 끝난 시계열은 비워 둔다', run: async ({ load }) => {
    const { alignedPeriodReturns, periodReturns } = await load('src/domain/technical/chart-compare.js');
    const bars = Array.from({ length: 300 }, (_, i) => ({ time: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10), close: 100 + i }));
    assert.deepEqual(alignedPeriodReturns(bars, bars), periodReturns(bars));
    // The other series is missing a 5-day holiday block: its own session count would start on a different date.
    const holiday = bars.filter((_, i) => i < 285 || i > 289);
    assert.equal(alignedPeriodReturns(bars, holiday)['1개월'], periodReturns(bars)['1개월']);
    assert.notEqual(periodReturns(holiday)['1개월'], periodReturns(bars)['1개월']);
    // A cached series that ended five days ago is not compared as if current.
    assert.equal(alignedPeriodReturns(bars, bars.slice(0, -5))['1개월'], null);
  } },
];
