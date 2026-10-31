// scripts/fixtures/pipeline-semantics/screener.mjs — v59.45 pipeline review regressions (스크리너·기술 신호·백테스트·테마 통계·차트·전략 설명)
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const weekdays = (start, count) => {
  const dates = [];
  for (let d = new Date(`${start}T00:00:00Z`); dates.length < count; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
};

const evidenceRow = (i, outcomeEndAt) => ({
  instrumentId: `FIXTURE-${i}`, sessionId: '2026-01-05', eligible: true, success: true,
  sourceId: 'fixture', sourceKind: 'T1_LICENSED', rightsId: 'fixture', rightsStatus: 'LICENSED',
  observedAt: '2026-01-05T21:00:00Z', fetchedAt: '2026-09-11T21:00:00Z', availableAt: '2026-09-11T22:00:00Z',
  revisionId: 'fixture', watermark: '2026-01-05', timezone: 'America/New_York', calendarId: 'fixture',
  calendarStatus: 'EXCHANGE_VERIFIED', outcomeEndAt
});

export const cases = [
  { id: 'P6-STAT-01', name: '평가 시점 뒤에 끝나는 결과나 거꾸로 된 결과 기간은 검증된 표본(READY)이 되지 않는다', run: async ({ load }) => {
    const { evaluateConditionalEvidence } = await load('src/domain/screener/conditional-evidence.js');
    const now = '2026-09-12T00:00:00.000Z';
    const future = evaluateConditionalEvidence({ observations: Array.from({ length: 30 }, (_, i) => evidenceRow(i, '2027-01-05T21:00:00Z')), now });
    const reversed = evaluateConditionalEvidence({ observations: Array.from({ length: 30 }, (_, i) => evidenceRow(i, '2025-01-05T21:00:00Z')), now });
    const closed = evaluateConditionalEvidence({ observations: Array.from({ length: 30 }, (_, i) => evidenceRow(i, '2026-01-06T21:00:00Z')), now });
    assert.notEqual(future.status, 'READY');
    assert.equal(future.independence.openWindows, 30);
    assert.notEqual(reversed.status, 'READY');
    assert.equal(reversed.independence.reversedWindows, 30);
    assert.equal(closed.status, 'READY', 'positive control: closed past windows stay READY');
  } },
  { id: 'P6-RANK-01', name: '이번에 순위를 매길 수 없는 행은 이전 실행의 순위·문구를 남기지 않는다', run: async ({ load }) => {
    const { computeFactorRanks } = await load('src/domain/screener/factor-ranks.js');
    const rows = Array.from({ length: 6 }, (_, i) => ({
      sym: `F${i}`, sector: 'Technology', ret1m: i + 1, ret3m: i + 1, ret6m: i + 1, pctSma50: i + 1, pctSma200: i + 1, vol: i === 5 ? null : 20 + i,
      factorObservedAt: '2026-08-26T00:00:00Z', observedAt: '2026-08-26T00:00:00Z', factorSourceKind: 'T3_PUBLIC_DELAYED',
      factorAllowedUse: 'research-relative-ranking-only', factorQuality: { status: 'CURRENT', stale: false, decisionUse: false },
      rank: 99, quantSignal: 'old fixture rank'
    }));
    const out = computeFactorRanks({ rows, weights: { momentum: 0.5, lowvol: 0.5 }, weightsPolicy: 'explicit', now: Date.parse('2026-08-27T00:00:00Z') });
    const row = out.rows.find((item) => item.sym === 'F5');
    assert.equal(row.rankingEligibility, 'insufficient-row-factor-coverage');
    assert.equal(row.rank, null);
    assert.equal(row.quantSignal, null);
  } },
  { id: 'P7-UI-01', name: '결측·빈 검증 수익률은 추이 그림과 t 통계에서 0이 되지 않는다', run: async ({ load }) => {
    const { summarizeValidation, meanTStat } = await load('src/ui/components/screener-validation.js');
    const summary = summarizeValidation([
      { date: '2026-01-01', modelFingerprint: 'fixture', quantileSpreadNet: null },
      { date: '2026-01-02', modelFingerprint: 'fixture', quantileSpreadNet: '' },
      { date: '2026-01-03', modelFingerprint: 'fixture', quantileSpreadNet: 0 }
    ]);
    assert.deepEqual(summary.series.map((point) => point.value), [0], 'a real 0 stays, null/blank leave the curve');
    assert.equal(meanTStat([1, 2, null, '']), meanTStat([1, 2]));
  } },
  { id: 'P8-UI-02', name: '상위 집단 중 한 종목만 관측돼도 상위권 전체의 100%로 요약하지 않는다', run: async ({ load }) => {
    const { buildScreenerRead } = await load('src/domain/screener/screener-read.js');
    const sparse = buildScreenerRead({ rows: Array.from({ length: 50 }, (_, i) => ({ sym: `F${i}`, sector: 'Technology', screenRank: i + 1,
      pctSma50: i === 0 ? 10 : null, adrPct: i === 0 ? 2 : null, ret5d: i === 0 ? -10 : null })) });
    const health = sparse.points.find((item) => item.id === 'health');
    assert.doesNotMatch(health.text, /100%/);
    assert.match(health.text, /1개뿐/);
    const partial = buildScreenerRead({ rows: Array.from({ length: 50 }, (_, i) => ({ sym: `F${i}`, sector: 'Technology', screenRank: i + 1,
      pctSma50: i < 8 ? 10 : null, adrPct: i < 8 ? 2 : null, ret5d: i < 8 ? 1 : null })) });
    assert.match(partial.points.find((item) => item.id === 'health').text, /자료 있는 8종목 기준/);
  } },
  { id: 'P8-DATA-12', name: '빠진 세션을 건넌 종목 수익률은 지수 하루 수익률과 비교하지 않는다', run: async ({ load }) => {
    const { priceHistoryFromRows, priceFactorRow } = await load('src/domain/screener/price-factors.js');
    const dates = weekdays('2026-01-01', 80);
    const complete = dates.map((date, i) => ({ date, observedAt: `${date}T14:30:00Z`, close: i === 78 ? 200 : 100,
      adjClose: i === 78 ? 200 : 100, high: i === 78 ? 201 : 101, low: i === 78 ? 199 : 99, volume: 1000 }));
    const benchmark = new Map([['us', new Map(dates.slice(-9).map((date) => [date, -1]))]]);
    const make = (input, gaps) => priceFactorRow(priceHistoryFromRows('FIX', input, { nullCloseDates: gaps, nowMs: Date.parse('2026-06-01'), providerMeta: { currency: 'USD' } }),
      { computedAt: '2026-06-01T00:00:00Z', indexReturns: benchmark });
    assert.equal(make(complete, []).downDayHoldPct, 89, 'positive control: nine matched down days');
    const gapped = make(complete.filter((_, i) => i !== 78), [dates[78]]);
    assert.equal(gapped.downDayCount, null, 'seven one-session days remain, under the minimum of eight');
    assert.equal(gapped.downDayHoldPct, null);
  } },
  { id: 'P9-BT-02', name: '점수 입력이 아닌 F&G 결측은 단기 검증 표본을 지우지 않고, VIX 결측은 VIX 5로 채우지 않는다', run: async ({ load }) => {
    const { reconstructScore, runBacktest } = await load('scripts/backtest-trading-score.mjs');
    const base = { spxPrice: 95, spx50ma: 90, spx200ma: 100, dxy: 104, tnx: 4.3, wti: 70, vvix: 100, hyg: 78 };
    assert.equal(reconstructScore({ ...base, vix: null }).volScore, null);
    assert.equal(reconstructScore({ ...base, vix: 20 }).volScore, 62);
    const dir = await mkdtemp(join(tmpdir(), 'aio-score-bt-'));
    try {
      const history = weekdays('2026-01-01', 30).map((date, i) => ({ date, spx: 100 + i, vix: 18, dxy: 104, tnx: 4.3, wti: 70, vvix: 100, fg: i % 2 ? null : 50 }));
      await writeFile(join(dir, 'history.json'), JSON.stringify(history));
      await runBacktest(join(dir, 'history.json'), join(dir, 'out.json'));
      const out = JSON.parse(await readFile(join(dir, 'out.json'), 'utf8'));
      assert.equal(out.records.length, 30);
    } finally { await rm(dir, { recursive: true, force: true }); }
  } },
  { id: 'P24-EARNINGS-01', name: '실적 일정 미확인(목록에 없음)은 발표가 그 뒤라는 충족으로 바꾸지 않고, 확인 불가 템플릿 항목은 충족이 아니다', run: async ({ load }) => {
    const { breakoutChecklist } = await load('src/domain/technical/setup-coach.js');
    const analysis = { available: true, bars: [], last: { close: 100 }, templateChecks: Array.from({ length: 8 }, (_, i) => ['rule', i === 7 ? null : true]),
      templatePass: 7, asOf: '2026-10-01', state: 'none', dryUp: null, adrFrom50: 1 };
    const list = breakoutChecklist(analysis, { earnings: { state: 'unconfirmed', windowEnd: '2026-11-01' } });
    const earnings = list.items.find((item) => item.id === 'earnings');
    assert.equal(earnings.met, null);
    assert.doesNotMatch(earnings.value, /그 뒤 발표/);
    assert.equal(list.items.find((item) => item.id === 'template').met, null);
  } },
  { id: 'P24-SIGNAL-01', name: '과거 신호의 종료 종가가 없으면 -100%로 세지 않는다', run: async ({ load }) => {
    const { signalHistory } = await load('src/domain/technical/signal-history.js');
    const closes = Array(11).fill(100);
    for (let i = 1; i < 11; i += 2) closes[i] = null;
    const out = signalHistory({ events: [0, 2, 4, 6, 8].map((index) => ({ index, kind: 'power-gap' })), closes, horizon: 1 });
    assert.equal(out.kinds['power-gap'].count, 0);
    assert.equal(out.kinds['power-gap'].medianPct, null);
  } },
  { id: 'P24-VWAP-01', name: '60봉 차트의 앵커는 52주 고점이라 부르지 않고, 거래량 결측 봉은 VWAP를 이어 붙이지 않는다', run: async ({ load }) => {
    const { vwapAnchors, anchoredVwap } = await load('src/domain/technical/chart-drawings.js');
    const bars = Array.from({ length: 60 }, (_, i) => ({ time: `d${i}`, open: 100, high: i === 2 ? 120 : 110, low: i === 3 ? 80 : 90, close: 100, volume: 100 }));
    const anchors = vwapAnchors(bars);
    assert(!anchors.some((anchor) => anchor.label === '52주 고점' || anchor.label === '6개월 저점'));
    assert(anchors.some((anchor) => anchor.label === '최근 60거래일 고점'));
    assert.deepEqual(anchoredVwap([{ high: 10, low: 10, close: 10, volume: 100 }, { high: 100, low: 100, close: 100, volume: null }], 0), [10, null]);
    assert.deepEqual(anchoredVwap([{ high: 10, low: 10, close: 10, volume: 100 }, { high: 100, low: 100, close: 100, volume: 0 }], 0), [10, 10], 'a reported zero volume still carries the value');
  } },
  { id: 'P24-DISTANCE-01', name: '회복·약화 기준까지의 거리는 같은 분모(종가)로 이동폭을 말한다', run: async ({ load }) => {
    const { buildChartScenarios } = await load('src/domain/technical/chart-scenarios.js');
    const bars = Array.from({ length: 60 }, (_, i) => ({ time: `d${i}`, open: 100, high: 110, low: 90, close: 100, volume: 100 }));
    const out = buildChartScenarios({ available: true, bars, last: { close: 100 }, asOf: '2026-10-01', pivot: 120, vcp: { contractions: [{ low: 80 }] } });
    assert.match(out.nearest, /20\.0% 하락/);
    assert.match(out.nearest, /20\.0% 상승 거리/);
    assert.doesNotMatch(out.nearest, /20\.0% 아래/);
  } },
  { id: 'R4-02', name: '판정할 자료가 없는 매매 방식 렌즈는 조건이 맞지 않는다고 하지 않는다', run: async ({ load }) => {
    const { strategyLenses } = await load('src/domain/technical/chart-strategies.js');
    const bars = Array.from({ length: 60 }, (_, i) => ({ time: `d${i}`, open: 10, high: 10.5, low: 9.5, close: 10, volume: 0 }));
    const lenses = strategyLenses({ available: true, bars, lines: {}, templateChecks: [], weinstein: null, rs: null, adrPct: null, adrFrom50: null }, null, { rsi: null });
    const pullback = lenses.find((lens) => lens.id === 'pullback');
    assert.equal(pullback.known, 0);
    assert.doesNotMatch(pullback.note, /맞지 않음/);
  } },
  { id: 'P24-PRODUCT-01', name: '매매 방식 렌즈의 손절·목표 칸은 이 종목 가격을 넣지 않고 매도를 지시하지 않는다', run: async ({ load }) => {
    const { strategyLenses } = await load('src/domain/technical/chart-strategies.js');
    const bars = Array.from({ length: 260 }, (_, i) => ({ time: `d${i}`, open: 100 + i, high: 101.5 + i, low: 99 + i, close: 100.75 + i, volume: 1000 }));
    const line = (offset) => bars.map((bar) => bar.close - offset);
    const levels = { available: true, swingLowBelow: { price: 321.5 } };
    const lenses = strategyLenses({ available: true, bars, lines: { ema21: line(3), sma50: line(12), sma200: line(50) }, templateChecks: [], weinstein: { stage: 2 }, rs: 4, adrPct: 2, adrFrom50: 1, pivot: 355.25 }, levels, { rsi: 55 });
    for (const lens of lenses) {
      for (const slot of [lens.stop, lens.target, lens.invalidation]) {
        assert.doesNotMatch(slot, /\d+\.\d{2}/, `${lens.id}: a price inside a rule slot`);
        assert.doesNotMatch(slot, /일부 정리/, `${lens.id}: a sell instruction inside a rule slot`);
      }
    }
  } },
  { id: 'R4-03', name: '5거래일 수익률이 없어도 50일선 0.05% 위 종가를 50일선 회복으로 읽지 않는다', run: async ({ load }) => {
    const { bufferedTrend } = await load('src/domain/technical/bands.js');
    assert.equal(bufferedTrend({ pctSma50: 0.05, pctSma200: -4, adrPct: 3, ret5d: null }).id, 'near50');
    assert.equal(bufferedTrend({ pctSma50: 0.05, pctSma200: -4, adrPct: 3, ret5d: 1 }).id, 'near50');
  } },
  { id: 'R1-02', name: '테마 당일 요약은 0.0%로 표시되는 종목을 상승으로 세지 않는다', run: async ({ load }) => {
    const { themeDayLine } = await load('src/ui/pages/themes.js');
    const line = themeDayLine({ pct: 0.5, leaders: ['A', 'B', 'C'], quotes: { A: { pct: 0.02 }, B: { pct: 1.2 }, C: { pct: -0.8 } } });
    assert.match(line, /3종목 중 1종목 상승/);
  } },
  { id: 'P18-KRTHEME-01', name: '오래된 한국 종목 하나의 수익률을 최신 날짜의 3종목 테마 중앙값으로 쓰지 않는다', run: async ({ load }) => {
    const { krThemeArtifactRead } = await load('src/domain/themes/kr-themes.js');
    const read = krThemeArtifactRead({ themeMap: { semi: [{ code: '000001' }, { code: '000002' }, { code: '000003' }] }, rows: [
      { sym: '000001.KS', ret1m: 50, factorSessionDate: '2026-01-01', factorQuality: { stale: true } },
      { sym: '000002.KS', ret1m: null, factorSessionDate: '2026-10-28' },
      { sym: '000003.KS', ret1m: null, factorSessionDate: '2026-10-28' }
    ] });
    assert.equal(read.usable.length, 0);
    assert.equal(read.themes[0].ret1m, null);
    assert.equal(read.themes[0].covered, 0);
    const ok = krThemeArtifactRead({ themeMap: { semi: [{ code: '000001' }, { code: '000002' }, { code: '000003' }] }, rows: [
      { sym: '000001.KS', ret1m: 5, factorSessionDate: '2026-10-28' }, { sym: '000002.KS', ret1m: 3, factorSessionDate: '2026-10-28' },
      { sym: '000003.KQ', ret1m: 1, factorSessionDate: '2026-10-28' }
    ] });
    assert.equal(ok.usable.length, 1, 'positive control: three current members rank');
    assert.equal(ok.usable[0].ret1m, 3);
    assert.equal(ok.usable[0].basis, '2026-10-28');
  } },
  { id: 'BC-ROWREAD-01', name: '행 숫자는 준비도 계약으로 읽혀, 오래됨·차단 표시가 붙은 값은 계산에서 빠지고 0은 0으로 남는다', run: async ({ load }) => {
    const { readRowNumber } = await load('src/data/contracts/screener.js');
    const readiness = (status) => ({ fields: { 'price.ret1m': { status } } });
    // A row without readiness (older artifacts, fixtures) reads its plain number for display, as row[key] did.
    assert.equal(readRowNumber({ ret1m: 4.2 }, 'ret1m'), 4.2);
    assert.equal(readRowNumber({ ret1m: 4.2 }, 'ret1m', 'calculation'), 4.2, 'a backtest or fixture row without readiness is still ranked');
    assert.equal(readRowNumber({ ret1m: 0 }, 'ret1m'), 0, 'a zero return is a reading');
    for (const empty of [null, '', '  ', false, [], {}]) assert.equal(readRowNumber({ ret1m: empty }, 'ret1m'), null, JSON.stringify(empty));
    assert.equal(readRowNumber({ ret1m: 4.2, fieldReadiness: readiness('CURRENT') }, 'ret1m', 'calculation'), 4.2);
    assert.equal(readRowNumber({ ret1m: 4.2, fieldReadiness: readiness('STALE') }, 'ret1m', 'calculation'), null, 'a stale value is not calculated on');
    assert.equal(readRowNumber({ ret1m: 4.2, fieldReadiness: readiness('STALE') }, 'ret1m', 'display'), 4.2, 'a stale value may still be shown with its date');
    assert.equal(readRowNumber({ ret1m: 4.2, fieldReadiness: readiness('BLOCKED') }, 'ret1m', 'display'), null, 'a blocked value is not shown');
    // A key the registry does not define reads as the plain number it is.
    assert.equal(readRowNumber({ ret5d: -1.5, fieldReadiness: readiness('BLOCKED') }, 'ret5d'), -1.5);
  } },
  { id: 'BC-SESSION-01', name: '가격 팩터의 현재성은 달력일이 아니라 거래소 세션으로 판정한다', run: async ({ load }) => {
    const { isSessionCurrent } = await load('src/domain/market/market-calendar.js');
    const { FRESHNESS_POLICY } = await load('src/domain/shared/freshness-policy.js');
    const current = (args) => isSessionCurrent(args, FRESHNESS_POLICY.factorSession);
    const at = (iso) => Date.parse(iso);
    // Friday's close on Saturday is the latest completed session.
    assert.equal(current({ sessionDate: '2026-10-30', now: at('2026-10-31T12:00:00Z') }), true);
    // Thursday's close read current on Monday night under the 4-day age; Friday and Monday have closed since.
    assert.equal(current({ sessionDate: '2026-10-29', now: at('2026-11-03T02:00:00Z') }), false);
    // One session behind is tolerated only while the newer close is under 12 hours old (the producer has not landed).
    assert.equal(current({ sessionDate: '2026-10-29', now: at('2026-10-30T22:00:00Z') }), true);
    assert.equal(current({ sessionDate: '2026-10-29', now: at('2026-10-31T12:00:00Z') }), false);
    // KRX: Thursday 10/08, Hangul Day 10/09 closed — current through the weekend, stale on Tuesday after Monday closed.
    assert.equal(current({ market: 'KR', sessionDate: '2026-10-08', now: at('2026-10-12T01:00:00Z') }), true);
    assert.equal(current({ market: 'KR', sessionDate: '2026-10-08', now: at('2026-10-13T01:00:00Z') }), false);
    // A year the calendar does not hold cannot be judged; callers fall back to their calendar-day budget.
    assert.equal(current({ sessionDate: '2019-05-01', now: at('2019-05-03T22:00:00Z') }), null);
    // A future observation is not current.
    assert.equal(current({ observedAt: '2026-10-31T13:00:00Z', now: at('2026-10-31T12:00:00Z') }), null);
  } }
];
