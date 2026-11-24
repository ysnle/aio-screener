// scripts/fixtures/pipeline-semantics/portfolio.mjs — v59.45 pipeline review regressions (포트폴리오 통화·현금·위험·원장·백테스트·스트레스·분해, 개인 데이터 저장·백업·복원)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const coverageAll = (ids) => Object.fromEntries(ids.map((id) => [id, true]));
const LEDGER_IDS = ['trades', 'deposits-withdrawals', 'dividends-splits', 'fees-taxes', 'fx', 'valuation-cuts'];
const NOW = Date.parse('2026-10-30T00:00:00Z');

// Memory storage only — never the user's localStorage or Vault.
function memoryStorage(seed = {}, { dropWrites = false } = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { if (!dropWrites) map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    dump: () => Object.fromEntries(map)
  };
}

export const cases = [
  { id: 'v59.53', name: 'sector ETFs contribute to their actual sector without turning a broad ETF into a sector', run: async ({ load }) => {
    const { renderPortfolioExposure } = await load('src/ui/components/portfolio-exposure.js');
    const panel = { innerHTML: '', insertAdjacentHTML(_position, text) { this.innerHTML += text; } };
    const root = { _aioGetCanonicalScreenerRows: () => [{ sym: 'XLE', index: 'ETF', sector: 'Energy' }, { sym: 'SPY', index: 'ETF', sector: 'ETF' }],
      _pfBaseValues: () => ({ rows: [{ sym: 'XLE', value: 100 }, { sym: 'SPY', value: 100 }] }),
      _aioPortfolioSurface: { totalAssets: 200 }, _aioPortfolioSectorLabel: (sector) => sector === 'Energy' ? '에너지' : sector, _pfBaseNote: () => '' };
    renderPortfolioExposure([{ ticker: 'XLE' }, { ticker: 'SPY' }], {}, { documentRef: { getElementById: () => panel }, root });
    assert.match(panel.innerHTML, /에너지 섹터 50% 집중/);
    assert.doesNotMatch(panel.innerHTML, /ETF[^<]*섹터 100% 집중/);
  } },
  { id: 'v59.53', name: 'registered bare Korean holdings retain their quote listing and currency through valuation', run: async ({ load }) => {
    const { createRuntimeReaders } = await load('src/data/runtime-readers.js');
    const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
    const { resolveHoldingInput } = await load('src/domain/instruments/resolve-name.js');
    const { listingCurrency } = await load('src/domain/portfolio/fx.js');
    const universe = [{ sym: '005930.KS' }, { sym: '035900.KQ' }, { sym: 'AAPL' }];
    const root = { getPortfolioData: () => [{ ticker: '005930', qty: 1, cost: 70000, costCurrency: 'KRW' }, { ticker: 'AAPL', qty: 1, cost: 100, costCurrency: 'USD' }],
      _aioGetCanonicalScreenerRows: () => universe, _liveData: { '005930.KS': { price: 100000, currency: 'KRW' }, AAPL: { price: 200, currency: 'USD' } } };
    const read = createRuntimeReaders({ root, now: () => NOW }).readPortfolio();
    assert.equal(read.holdings[0].currency, 'KRW');
    assert.equal(read.holdings[0].listingSymbol, '005930.KS');
    assert.equal(resolveHoldingInput('035900', { universe }).listingSymbol, '035900.KQ');
    assert.equal(resolveHoldingInput('999999', { universe }).listingSymbol, null);
    assert.equal(listingCurrency('999999'), null);
    const result = derivePortfolioSurface({ state: { ...read, readState: 'ready', cashKnown: true, cash: 0 }, now: NOW,
      closeOf: (symbol) => ({ price: symbol === '005930.KS' ? 100000 : 200, date: '2026-10-29' }) });
    assert.equal(result.positionValue, null, 'won and dollars cannot be added without a declared conversion');
    assert.equal(result.currencyState, 'mixed-without-conversion');
    const converted = derivePortfolioSurface({ state: { ...read, readState: 'ready', baseCurrency: 'USD', cashKnown: true, cash: 0,
      fxLegs: [{ from: 'KRW', to: 'USD', rate: 0.001, observedAt: '2026-10-29T00:00:00Z', source: 'fixture-declared' }] }, now: NOW,
      closeOf: (symbol) => ({ price: symbol === '005930.KS' ? 100000 : 200, date: '2026-10-29' }) });
    assert.equal(converted.positionValue, 300, 'a declared rate converts units before adding them');
    assert.equal(converted.baseCurrency, 'USD');
    const unknown = derivePortfolioSurface({ state: { readState: 'ready', holdings: [{ symbol: '999999', shares: 1 }], cashKnown: true, cash: 0 }, now: NOW,
      closeOf: () => ({ price: 100000, date: '2026-10-29' }) });
    assert.equal(unknown.positionValue, null, 'a lone unknown currency is also held');
    // v59.54: the hold names its own reason, so no reader says "currencies mixed" or "declare a rate" for it.
    assert.equal(unknown.currencyHeldReason, 'unknown-unit');
    assert.equal(result.currencyHeldReason, 'mixed');
    const { buildPortfolioRead } = await load('src/domain/portfolio/portfolio-read.js');
    assert.match(buildPortfolioRead({ surface: unknown }).reason, /시세 통화를 알 수 없는/);
    assert.doesNotMatch(buildPortfolioRead({ surface: unknown }).reason, /환율을 선언/);
    const known = derivePortfolioSurface({ state: { readState: 'ready', holdings: [{ symbol: '005930.KS', shares: 1 }], cashKnown: true, cash: 0 }, now: NOW,
      closeOf: () => ({ price: 100000, date: '2026-10-29' }) });
    assert.equal(known.valuationCurrency, 'KRW', 'an undeclared but known listing unit must not be displayed as USD');
    assert.equal(known.baseCurrency, null, 'an assumed unit is not a declared base currency');
  } },
  { id: 'v59.52', name: 'sector attribution obeys the same return-readiness contract as the holding', run: async ({ load }) => {
    const { buildAttribution } = await load('src/domain/portfolio/attribution.js');
    const run = (status) => buildAttribution({ holdings: [{ symbol: 'AAPL', value: 110 }], cash: 0,
      rowFor: (symbol) => symbol === 'AAPL' ? { ret3m: 10, sector: 'Technology', factorSessionDate: '2026-10-23' }
        : { ret3m: 50, factorSessionDate: '2026-10-23', fieldReadiness: { fields: { 'price.ret3m': { status } } } },
      marketReturnFor: () => ({ ret3m: 5, label: 'SPY', asOf: '2026-10-23' }) });
    assert.equal(run('CURRENT').sectorMappedPct, 100);
    for (const status of ['MISSING', 'BLOCKED_RIGHTS', 'STALE', 'LAST_GOOD', 'CONFLICT']) {
      const result = run(status);
      assert.equal(result.sectorMappedPct, 0, status);
      assert.equal(result.components.find((row) => row.id === 'sector').pct, 0, status);
    }
  } },
  { id: 'v59.52', name: 'a nonzero trend share never reads as no holdings, including a tiny near-line share', run: async ({ load }) => {
    const { buildPortfolioRead } = await load('src/domain/portfolio/portfolio-read.js');
    for (const state of ['up', 'down', 'near', 'pullback']) {
      const signs = { up: [10, 20], down: [-10, -20], near: [0, 0], pullback: [-10, 20] };
      const [pctSma50, pctSma200] = signs[state];
      const read = buildPortfolioRead({ surface: { rows: [{ symbol: 'LARGE', value: 9999 }, { symbol: 'SMALL', value: 1 }] },
        rows: [{ sym: 'LARGE', pctSma50: -10, pctSma200: -20 }, { sym: 'SMALL', pctSma50, pctSma200 }] });
      if (state !== 'down') assert.match(read.headline, /1% 미만/, state);
    }
    const tinyDown = buildPortfolioRead({ surface: { rows: [{ symbol: 'LARGE', value: 9999 }, { symbol: 'SMALL', value: 1 }] },
      rows: [{ sym: 'LARGE', pctSma50: 10, pctSma200: 20 }, { sym: 'SMALL', pctSma50: -10, pctSma200: -20 }] });
    assert.match(tinyDown.headline, /1% 미만/);
    assert.doesNotMatch(tinyDown.headline, /내리는 흐름인 종목은 없습니다/);
    const zero = buildPortfolioRead({ surface: { rows: [{ symbol: 'UP', value: 1 }] }, rows: [{ sym: 'UP', pctSma50: 10, pctSma200: 20 }] });
    assert.match(zero.headline, /내리는 흐름인 종목은 없습니다/);
    // v59.86: with neither an up nor a down share the line leads with the holdings' own state, not two empty clauses.
    const flat = buildPortfolioRead({ surface: { rows: [{ symbol: 'FLAT', value: 1 }] }, rows: [{ sym: 'FLAT', pctSma50: 1, pctSma200: 15 }] });
    assert.match(flat.headline, /100%는 아직 방향이 뚜렷하지 않고, 오르거나 내리는 흐름인 종목은 없습니다/);
    assert.doesNotMatch(flat.headline, /오르는 흐름에 있는 종목은 없고/);
  } },
  { id: 'P22-LEDGER-01', name: '읽을 수 없는 입출금 행은 버리지 않고 계좌 성과를 보류한다', run: async ({ load }) => {
    const { assessAccountPerformance } = await load('src/domain/portfolio/risk.js');
    const ledger = (tx) => ({ coverage: coverageAll(LEDGER_IDS), currency: 'USD', dayCount: 'actual-365', flowTiming: 'end-of-period',
      valuations: [{ date: '2025-01-01', amount: 100 }, { date: '2026-01-01', amount: 200 }], transactions: [tx] });
    for (const tx of [{ date: '2025-06-01', kind: 'deposit', amount: 'bad' }, { date: '2025-06-01', kind: 'deposit', amount: null },
      { date: '2025-06-01', kind: 'withdrawal', amount: -5 }, { date: '2025-02-30', kind: 'deposit', amount: 10 }, { kind: 'deposit', amount: 10 }]) {
      const out = assessAccountPerformance({ ledger: ledger(tx) });
      assert.equal(out.status, 'blocked', JSON.stringify(tx));
      assert.equal(out.code, 'account-flow-invalid');
    }
    const fine = assessAccountPerformance({ ledger: ledger({ date: '2025-06-01', kind: 'deposit', amount: 0 }) });
    assert.equal(fine.status, 'ready');
  } },
  { id: 'P22-RISK-01', name: '유한하지 않거나 -100% 이하인 수익률이 있으면 위험 추정을 ready로 내지 않는다', run: async ({ load }) => {
    const { createCompositionSnapshot, deriveRiskEstimate } = await load('src/domain/portfolio/risk.js');
    const snapshot = createCompositionSnapshot({ members: [{ ticker: 'X', qty: 1, price: 100 }], cash: { amount: 0, currency: 'USD' }, baseCurrency: 'USD' });
    for (const bad of [[NaN, 0.1], [Infinity, 0.1], [-1.2, 0.1]]) {
      const out = deriveRiskEstimate({ snapshot, exposureHistoryMode: 'current_composition_retrospective', returnsMap: { X: bad } });
      assert.equal(out.status, 'blocked');
      assert.equal(out.code, 'member-return-series-invalid');
    }
  } },
  { id: 'P22-CASH-01', name: '읽을 수 없는 현금 잔액이 있으면 현금 합계를 확정하지 않는다', run: async ({ load }) => {
    const { convertCashBalances } = await load('src/domain/portfolio/cash.js');
    for (const amount of ['bad', null, -1]) {
      const out = convertCashBalances({ balances: [{ currency: 'USD', amount: 100 }, { currency: 'KRW', amount }], target: 'USD' });
      assert.equal(out.ok, false);
      assert.equal(out.total, null);
      assert.equal(out.invalid, 1);
    }
  } },
  { id: 'P22-FX-01', name: '오래된 정방향 환율이 최신 역방향 환율을 가리지 않는다', run: async ({ load }) => {
    const { resolveFxRate } = await load('src/domain/portfolio/fx.js');
    const legs = [{ from: 'USD', to: 'KRW', rate: 1200, observedAt: '2020-01-01', source: 'old' }, { from: 'KRW', to: 'USD', rate: 1 / 1400, observedAt: '2026-10-29', source: 'new' }];
    const out = resolveFxRate(legs, { from: 'USD', to: 'KRW', asOfMs: NOW });
    assert.equal(out.ok, true);
    assert.equal(out.inverted, true);
    assert.ok(Math.abs(out.rate - 1400) < 1e-6);
    // Two legs in one direction: the latest usable one, not the first row.
    const dup = resolveFxRate([{ from: 'USD', to: 'KRW', rate: 1300, observedAt: '2026-10-27' }, { from: 'USD', to: 'KRW', rate: 1410, observedAt: '2026-10-29' }], { from: 'USD', to: 'KRW', asOfMs: NOW });
    assert.equal(dup.rate, 1410);
  } },
  { id: 'P22-STATS-01', name: '결측 시각은 순서 검증이 아니고 Infinity는 가격이 아니다', run: async ({ load }) => {
    const { _btVarOrderAudit, _calcDailyReturns } = await load('src/domain/portfolio/return-stats.js');
    assert.notEqual(_btVarOrderAudit([0.1, 0.2], 'unspecified', [null, null]).state, 'verified');
    assert.ok(_calcDailyReturns([100, Infinity, 110]).every(Number.isFinite));
  } },
  { id: 'P22-LOOKTHROUGH-01', name: '보유 입력 순서가 바뀌어도 ETF 펼침 섹터가 같다', run: async ({ load }) => {
    const { lookThrough } = await load('src/domain/portfolio/look-through.js');
    const sp500 = { rows: [{ sym: 'NVDA', weight: 100, sector: 'Technology' }], asOf: '2026-10-29' };
    const holdings = [{ symbol: 'NVDA', value: 100, sector: null }, { symbol: 'SPY', value: 100 }];
    const a = lookThrough({ rows: holdings, sp500 });
    const b = lookThrough({ rows: holdings.slice().reverse(), sp500 });
    assert.equal(a.exposures[0].sector, b.exposures[0].sector);
    assert.notEqual(a.exposures[0].sector, 'Unclassified');
  } },
  { id: 'P22-ASSET-01', name: '원화·달러 외 상장 통화는 달러로 환산하지 않고 상관을 보류한다', run: async ({ load }) => {
    const { stockBondCorrelation } = await load('src/domain/portfolio/asset-class.js');
    const out = stockBondCorrelation({ historyMap: { '7203.T': {}, TLT: {} }, commonDates: [], bondWeights: { TLT: 0.5 }, stockWeights: { '7203.T': 0.5 }, baseCurrency: 'USD' });
    assert.equal(out.available, false);
    assert.equal(out.reason, 'currency-unsupported');
  } },
  { id: 'P22-JOURNAL-01', name: '읽을 수 없는 수수료·통화·없는 날짜는 0·USD·다음 날로 바꾸지 않는다', run: async ({ load }) => {
    const { normalizeTrade, calendarDate } = await load('src/domain/portfolio/trade-journal.js');
    const base = { symbol: 'AAPL', date: '2026-10-01', side: 'buy', qty: 1, price: 100 };
    assert.equal(normalizeTrade({ ...base, fee: 'abc' }).error, 'fee');
    assert.equal(normalizeTrade({ ...base, currency: 'XYZ' }).error, 'currency');
    assert.equal(normalizeTrade({ ...base, date: '2026-02-30' }).error, 'date');
    assert.equal(normalizeTrade({ ...base, fee: '' }).fee, 0);
    assert.equal(calendarDate('2026-02-30'), null);
    assert.equal(calendarDate('2024-02-29'), '2024-02-29');
  } },
  { id: 'P23-CUT-01', name: '과거 기준일 백테스트는 기준일 이후 관측을 쓰지 않는다', run: async ({ load }) => {
    const { buildPortfolioBacktestLab } = await load('src/domain/portfolio/backtest.js');
    const dates = Array.from({ length: 25 }, (_, i) => Date.UTC(2024, i + 1, 0));
    const series = { timestamps: dates, adjustedCloses: dates.map((_, i) => 100 + i), backtestEligible: true, backtestPriceBasis: 'adjusted-close' };
    const out = buildPortfolioBacktestLab({ X: series, SPY: series }, [{ ticker: 'X', qty: 1, currency: 'USD' }], { startYear: 2024, asOfMs: Date.parse('2025-06-15'), baseCurrency: 'USD' });
    assert.ok(!out.ok || out.settings.endMonth <= '2025-06', JSON.stringify(out.settings || out.reason));
    const reversed = { ...series, timestamps: series.timestamps.slice().reverse(), adjustedCloses: series.adjustedCloses.slice().reverse() };
    const back = buildPortfolioBacktestLab({ X: reversed, SPY: reversed }, [{ ticker: 'X', qty: 1, currency: 'USD' }], { startYear: 2024, asOfMs: Date.parse('2025-06-15'), baseCurrency: 'USD' });
    assert.equal(JSON.stringify(back.settings), JSON.stringify(out.settings));
    const unknown = buildPortfolioBacktestLab({ X: series, SPY: series }, [{ ticker: 'X', qty: 1, currency: 'USD' }], { startYear: 2024, rebalanceType: 'weekly', baseCurrency: 'USD' });
    assert.equal(unknown.ok, false);
  } },
  { id: 'P23-CURRENCY-01', name: '통화를 알 수 없는 해외 상장 종목을 기준 통화로 합산하지 않는다', run: async ({ load }) => {
    const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
    const lone = derivePortfolioSurface({ state: { readState: 'ready', baseCurrency: 'USD', holdings: [{ symbol: 'ABC.L', shares: 1, price: 100 }], cashKnown: true, cash: 0 }, now: NOW });
    assert.equal(lone.positionValue, null);
    const mixed = derivePortfolioSurface({ state: { readState: 'ready', holdings: [{ symbol: 'ABC.L', shares: 1, price: 100 }, { symbol: 'AAPL', shares: 1, price: 100 }], cashKnown: true, cash: 0 }, now: NOW });
    assert.equal(mixed.positionValue, null);
    assert.equal(mixed.currencyState, 'mixed-without-conversion');
    // v59.86: an unconverted USD/KRW mix keeps each row's P&L in its own unit (the table printed a won gain with $).
    const krMix = derivePortfolioSurface({ state: { readState: 'ready', holdings: [{ symbol: 'AAPL', shares: 1, price: 200, avgCost: 180, currency: 'USD' }, { symbol: '005930.KS', shares: 10, price: 100000, avgCost: 55000, currency: 'KRW' }], cashKnown: true, cash: 0 }, now: NOW });
    assert.equal(krMix.currencyState, 'mixed-without-conversion');
    assert.deepEqual(krMix.rows.map((row) => [row.valueUnit, row.costUnit]), [['USD', 'USD'], ['KRW', 'KRW']]);
  } },
  { id: 'P23-FX-01', name: '평가 화면이 쓰는 앱 원/달러 종가를 위험 입력도 받아들인다', run: async ({ load }) => {
    const { assembleRiskEstimateInput } = await load('src/ui/panels/portfolio-risk-input.js');
    const commonDates = Array.from({ length: 6 }, (_, i) => `2026-10-${20 + i}`);
    const out = assembleRiskEstimateInput({ positions: [{ ticker: 'X', qty: 1, currency: 'USD' }], priceEvidenceMap: { X: { allowedUse: true, value: 100, ts: NOW } },
      historyMap: { X: Object.fromEntries(commonDates.map((d, i) => [d, 100 + i])) }, validTickers: ['X'], commonDates, cashValue: 0,
      declarations: { baseCurrency: 'KRW' }, cashFx: { rate: 1400, date: '2026-10-29', label: '종가' }, nowIso: new Date(NOW).toISOString() });
    assert.notEqual(out.code, 'currency-unconverted');
    assert.equal(out.ok, true);
    assert.ok(Math.abs(out.snapshot.members[0].price - 140000) < 1e-6);
  } },
  { id: 'P23-CASH-01', name: '읽을 수 없는 현금 행은 총자산에서 지우지도 0으로 읽지도 않는다', run: async ({ load }) => {
    const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
    const state = { readState: 'ready', baseCurrency: 'USD', holdings: [{ symbol: 'X', shares: 1, price: 100, avgCost: 90, currency: 'USD' }], cashKnown: true };
    const mixed = derivePortfolioSurface({ state: { ...state, cashBalances: [{ currency: 'USD', amount: 10 }, { currency: 'KRW', amount: 'bad' }] }, now: NOW });
    assert.equal(mixed.totalAssets, null);
    assert.equal(mixed.cashHeld, true);
    const only = derivePortfolioSurface({ state: { ...state, cashBalances: [{ currency: 'KRW', amount: 'bad' }] }, now: NOW });
    assert.notEqual(only.cash, 0);
    assert.equal(only.cashInvalidCount, 1);
  } },
  { id: 'P23-FRESHNESS-01', name: '오래된 종가 평가는 오래됐다고 세고 관측 시각은 저장 시각이 아니다', run: async ({ load }) => {
    const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
    const out = derivePortfolioSurface({ state: { readState: 'ready', baseCurrency: 'USD', holdings: [{ symbol: 'X', shares: 1, currency: 'USD' }], cashKnown: true, cashBalances: [{ currency: 'USD', amount: 0 }], updatedAt: '2026-10-30T00:00:00Z' },
      now: NOW, closeOf: () => ({ price: 100, date: '1990-01-01' }) });
    assert.equal(out.staleCloseCount, 1);
    assert.equal(out.oldestCloseDate, '1990-01-01');
    assert.equal(String(out.observedAt).slice(0, 10), '1990-01-01');
  } },
  { id: 'P23-STRESS-01', name: '같은 종목의 여러 lot은 하나의 비중으로 합산한다', run: async ({ load }) => {
    const { bookWeights } = await load('src/domain/portfolio/stress-sensitivity.js');
    const weights = bookWeights([{ sym: 'AAPL', value: 10 }, { sym: 'AAPL', value: 90 }, { sym: 'MSFT', value: 100 }]);
    assert.equal(weights.length, 2);
    assert.equal(weights.find((w) => w.symbol === 'AAPL').w, 0.5);
    const { portfolioStressHtml } = await load('src/ui/panels/portfolio-stress.js');
    assert.doesNotMatch(portfolioStressHtml({ base: { rows: [{ sym: 'AAPL', value: 10 }] } }), /내 계좌의 과거 주간 움직임/);
  } },
  { id: 'P27-RESTORE-01', name: '관심목록 저장 실패가 있으면 전체 복원 성공으로 보고하지 않는다', run: async () => {
    const source = readFileSync(new URL('../../../js/aio-workspace.js', import.meta.url), 'utf8');
    const start = source.indexOf('function _pfRestoreBackupSections(');
    const end = source.indexOf('\nfunction importPortfolio', start);
    assert.ok(start >= 0 && end > start);
    const box = { _pfAssumptionApi: () => ({ keys: {} }), localStorage: { setItem() {}, removeItem() {} }, window: {}, PF_JOURNAL_KEY: 'journal', saveWatchlists: () => false,
      setActiveWatchlistId: () => true, savePortfolioLedger: async () => ({ ok: true }), savePortfolioFxLegs: async () => ({ ok: true }), renderPortfolioLedger() {}, renderPortfolioFxLegs() {},
      document: { dispatchEvent() {} }, CustomEvent: class {} };
    vm.runInNewContext(source.slice(start, end), box);
    const acks = await box._pfRestoreBackupSections({ assumptions: {}, cashBalances: null, journal: [], watchlists: [], ledger: null, fxLegs: [] });
    assert.equal(acks.every((ack) => ack.ok), false);
    assert.ok(acks.some((ack) => !ack.ok && ack.section === 'watchlists'));
    assert.ok(acks.every((ack) => typeof ack.section === 'string'));
  } },
  { id: 'P27-IMPORT-01', name: '가져오기는 잘못된 원가를 0으로, 없는 날짜를 유효로, 범위 밖 시각을 예외로 만들지 않는다', run: async ({ load }) => {
    const { sanitizePositions, parsePortfolioBackup } = await load('src/data/portfolio-backup.js');
    const { normalizeLedger, ledgerCoverageState } = await load('src/data/portfolio-ledger.js');
    const positions = sanitizePositions([{ ticker: 'TEST', qty: 1, cost: 'nonsense' }, { ticker: 'ZERO', qty: 1, cost: 0 }, { ticker: 'NEG', qty: 1, cost: -1 }]);
    assert.equal(positions.length, 2);
    assert.equal('cost' in positions[0], false);
    assert.equal(positions[1].cost, 0);
    const ledger = normalizeLedger({ coverage: coverageAll(LEDGER_IDS), transactions: [{ date: '2026-02-30', kind: 'deposit', amount: 100 }, { date: '2026-10-30', kind: 'deposit', amount: 'bad' }], valuations: [] });
    assert.equal(ledger.transactions.length, 0);
    assert.equal(ledgerCoverageState(ledger).complete, false);
    const clean = normalizeLedger({ coverage: coverageAll(LEDGER_IDS), transactions: [{ date: '2026-10-01', kind: 'deposit', amount: 100 }], valuations: [] });
    assert.equal(ledgerCoverageState(clean).complete, true);
    const parsed = parsePortfolioBackup({ format: 'aio-backup', version: 1, contents: { journal: [{ note: 'note', ts: 1e20 }] } });
    assert.equal(parsed.ok, false);
    const bundle = parsePortfolioBackup({ format: 'aio-backup', version: 1, contents: { positions: [{ ticker: 'TEST', qty: 1, cost: 'x' }, { ticker: '', qty: 1 }] } }, { normalizeLedger });
    assert.equal(bundle.adjustments.positionsCostUnknown, 1);
    assert.equal(bundle.adjustments.positionsDropped, 1);
  } },
  { id: 'P27-LEDGER-01', name: '같은 날 같은 종류 입금 두 건은 대체되지 않고 둘 다 남는다', run: async ({ load }) => {
    const { appendLedgerTransaction, removeLedgerEntry } = await load('src/data/portfolio-ledger.js');
    const first = appendLedgerTransaction(null, { date: '2026-10-30', kind: 'deposit', amount: 100 }).ledger;
    const twice = appendLedgerTransaction(first, { date: '2026-10-30', kind: 'deposit', amount: 200 }).ledger;
    assert.equal(twice.transactions.length, 2);
    assert.deepEqual(twice.transactions.map((row) => row.amount), [100, 200]);
    assert.equal(removeLedgerEntry(twice, 'mystery', 0).ok, false);
  } },
  { id: 'P27-WATCHLIST-01', name: '저장소가 없으면 저장 성공이 아니고 불량 목록 형태에서 예외가 나지 않는다', run: async ({ load }) => {
    const { toggleWatchlistSymbol, readWatchlists, writeWatchlists, LEGACY_STAR_KEY, WATCHLISTS_KEY } = await load('src/data/watchlist-store.js');
    assert.equal(toggleWatchlistSymbol(null, 'TEST').ok, false);
    assert.equal(writeWatchlists(memoryStorage({}, { dropWrites: true }), [{ id: 'a', name: 'a', tickers: [] }]), false);
    const malformed = memoryStorage({ [LEGACY_STAR_KEY]: '["TEST"]', [WATCHLISTS_KEY]: '[{"id":"x","name":"x","tickers":{}}]' });
    const lists = readWatchlists(malformed);
    assert.ok(Array.isArray(lists[0].tickers));
    assert.ok(lists[0].tickers.some((t) => t.sym === 'TEST'));
    const broken = memoryStorage({ [LEGACY_STAR_KEY]: '{not json' });
    readWatchlists(broken);
    assert.equal(broken.getItem(LEGACY_STAR_KEY), '{not json');
  } },
  { id: 'P27-CASH-01', name: '현금 쓰기가 다시 읽히지 않으면 이전 저장값을 되돌린다', run: async ({ load }) => {
    const { writeCashBalances, PORTFOLIO_CASH_KEY } = await load('src/data/portfolio-cash.js');
    const map = new Map([[PORTFOLIO_CASH_KEY, '[{"currency":"USD","amount":5}]']]);
    let writes = 0;
    const storage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { writes += 1; map.set(k, writes === 1 ? 'garbled' : v); }, removeItem: (k) => map.delete(k) };
    const out = writeCashBalances(storage, [{ currency: 'USD', amount: 9 }]);
    assert.equal(out.ok, false);
    assert.equal(map.get(PORTFOLIO_CASH_KEY), '[{"currency":"USD","amount":5}]');
  } },
  { id: 'P3-PF-01', name: '다른 날짜에 끝난 섹터 ETF 수익률로 섹터·종목 효과를 나누지 않는다', run: async ({ load }) => {
    const { buildAttribution } = await load('src/domain/portfolio/attribution.js');
    const make = (sectorDate, sectorReturn) => buildAttribution({ holdings: [{ symbol: 'AAPL', value: 110 }], cash: 0, baseCurrency: 'USD',
      rowFor: (symbol) => (symbol === 'AAPL' ? { ret3m: 10, sector: 'Technology', factorSessionDate: '2026-10-23' } : symbol === 'XLK' ? { ret3m: sectorReturn, factorSessionDate: sectorDate } : null),
      marketReturnFor: () => ({ ret3m: 5, label: 'SPY', asOf: '2026-10-23' }) });
    const other = make('2026-09-01', 50);
    assert.equal(other.components.find((x) => x.id === 'sector').pct, 0);
    assert.equal(other.sectorMappedPct, 0);
    assert.equal(other.sectorBasisHeld.length, 1);
    const aligned = make('2026-10-23', 8);
    assert.equal(aligned.sectorMappedPct, 100);
    assert.equal(aligned.sectorBasisHeld.length, 0);
  } },
  { id: 'P10-PF-02', name: '검사할 자료가 없는 보유 종목을 신호 없음으로 표시하지 않는다', run: async ({ load }) => {
    const { thesisRows } = await load('src/ui/components/portfolio-checklist.js');
    const [row] = thesisRows({ surface: { rows: [{ symbol: 'AUDIT', value: 100 }] }, root: {} });
    assert.deepEqual(row.signals, []);
    assert.equal(row.checked, 0);
    assert.equal(row.unknown.length, 4);
    const [seen] = thesisRows({ surface: { rows: [{ symbol: 'AUDIT', value: 100 }] }, root: {}, bySymbol: new Map([['AUDIT', { pctSma50: 2 }]]) });
    assert.equal(seen.checked, 1);
    const [nullSma] = thesisRows({ surface: { rows: [{ symbol: 'AUDIT', value: 100 }] }, root: {}, bySymbol: new Map([['AUDIT', { pctSma50: null }]]) });
    assert.equal(nullSma.checked, 0);
    // A pending scenario state is not a theme stage: no 'weak' signal from it, and the check is unknown.
    const pendingRoot = { THEME_MAP: [{ id: 'audit', leaders: ['AUDIT'] }], _aioScenarioState: { schemaVersion: 'scenario-state.v1', status: 'pending', generatedAt: '2026-10-30T00:00:00Z', themes: [{ market: 'US', id: 'audit', label: 'Audit', state: 'weak' }] } };
    const [pending] = thesisRows({ surface: { rows: [{ symbol: 'AUDIT', value: 100 }] }, root: pendingRoot });
    assert.equal(pending.signals.length, 0);
    assert.ok(pending.unknown.includes('테마 단계'));
  } },
  { id: 'R1-03', name: '광범위 ETF와 미분류 종목을 섹터로 세어 집중 경고하지 않는다', run: async ({ load }) => {
    const { renderPortfolioExposure } = await load('src/ui/components/portfolio-exposure.js');
    const { portfolioSectorLabel } = await load('src/domain/portfolio/portfolio-read.js');
    const node = { innerHTML: '', insertAdjacentHTML(_, html) { this.innerHTML += html; } };
    const db = [{ sym: 'SPY', sector: 'ETF', rank: 10 }, { sym: 'QQQ', sector: 'ETF', rank: 12 }, { sym: 'NVDA', sector: 'Technology', rank: 1 }];
    const root = { _aioGetCanonicalScreenerRows: () => db, _pfBaseValues: (p) => ({ blocked: false, rows: p.map((x) => ({ sym: x.sym, value: x.value })) }),
      _pfBaseNote: () => '',_aioPortfolioSurface: { totalAssets: 100 }, _aioPortfolioSectorLabel: portfolioSectorLabel };
    renderPortfolioExposure([{ sym: 'SPY', value: 40 }, { sym: 'QQQ', value: 25 }, { sym: 'NVDA', value: 10 }, { sym: 'XYZW', value: 25 }], {}, { documentRef: { getElementById: () => node }, root });
    const text = node.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.doesNotMatch(text, /ETF\(여러 업종 묶음\) 섹터 \d+% 집중/);
    assert.match(text, /종목\/섹터 수 4\/1/);
    assert.match(text, /ETF 2개 포함/);
    assert.match(text, /랭크 확인 75%/);
  } },
  // ---- v60.28 portfolio review (holding resolver, merge, MA band, backtest words, RF fill, copy) --------------------------
  { id: 'v60.28', name: 'a Korean holding stored as its code reads its listing row in the thesis check and on 오늘 내 종목', run: async ({ load }) => {
    const { thesisRows } = await load('src/ui/components/portfolio-checklist.js');
    const { buildMyNames } = await load('src/domain/briefing/daily-diff.js');
    const { derivePortfolioChecks } = await load('src/domain/portfolio/checks.js');
    const krRow = { sym: '005930.KS', name: '삼성전자', pctSma50: -17.85, sector: 'Technology' };
    const bySymbol = new Map([['005930.KS', krRow], ['NVDA', { sym: 'NVDA', pctSma50: 3 }]]);
    const surface = { rows: [{ symbol: '005930', listingSymbol: '005930.KS', value: 7_000_000 }, { symbol: 'NVDA', listingSymbol: 'NVDA', value: 2_000_000 }] };
    const [kr] = thesisRows({ surface, root: {}, bySymbol });
    assert.equal(kr.symbol, '005930', 'the row is still named by the stored code');
    assert.ok(!kr.unknown.includes('50일선'), `the 50-day line is read from 005930.KS, got unknown ${kr.unknown.join(',')}`);
    assert.ok(kr.signals.some((signal) => signal.startsWith('50일선 아래(-17.9%')), kr.signals.join(','));
    // With the earnings calendar loaded (the sample preview and any real book once it arrives) the earnings date is read by the same listing key.
    const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const [, withCalendar] = thesisRows({ surface, root: { _aioEarningsCalendarArtifact: { upcoming: { NVDA: soon }, earnings: [] } }, bySymbol });
    assert.ok(withCalendar.signals.some((signal) => signal.startsWith('실적 발표')), `v60.28 the thesis check reads the earnings calendar by listing key: ${withCalendar.signals.join(',')}`);
    const names = buildMyNames({ holdings: [{ symbol: '005930', listingSymbol: '005930.KS' }], symbols: ['005930.KS'], rows: [krRow] });
    assert.equal(names.names.length, 1, 'the held code and the watched listing are one name');
    assert.equal(names.names[0].name, '삼성전자');
    assert.equal(names.names[0].held, true);
    assert.ok(names.names[0].notes.some((note) => note.startsWith('50일선 아래')), names.names[0].notes.join(','));
    const checks = derivePortfolioChecks({ surface: { rows: [{ symbol: '005930', listingSymbol: '005930.KS', value: 100, currency: 'KRW' }] },
      assetTypeOf: (symbol) => (symbol === '005930.KS' ? '개별 주식' : null), sectorOf: (symbol) => (symbol === '005930.KS' ? 'Technology' : null) });
    assert.equal(checks.breakdowns.types[0].name, '개별 주식', 'the type is looked up by the listing');
    assert.equal(checks.breakdowns.sectors[0].name, '기술');
    assert.equal(checks.breakdowns.holdings[0].name, '005930', 'the holding keeps its stored name');
  } },
  { id: 'v60.28', name: 'a second buy merges into one row by weighted price; a currency mix is refused; imports merge duplicates', run: async ({ load }) => {
    const { mergeHoldingPair, mergeDuplicatePositions } = await load('src/domain/portfolio/holding-merge.js');
    const { parsePortfolioBackup } = await load('src/data/portfolio-backup.js');
    const held = { ticker: 'NVDA', qty: 10, cost: 150, costCurrency: null, sector: 'Technology', targetWeight: 40, memo: 'AI', addedAt: 1 };
    const merged = mergeHoldingPair(held, { ticker: 'NVDA', qty: 10, cost: 200, costCurrency: null, target: null, memo: '' }, { now: 5 });
    assert.equal(merged.ok, true);
    assert.equal(merged.position.qty, 20);
    assert.equal(merged.position.cost, 175);
    assert.equal(merged.position.sector, 'Technology', 'fields the form does not own are kept');
    assert.equal(merged.position.memo, 'AI', 'a blank memo does not erase the stored one');
    const refused = mergeHoldingPair({ ticker: 'AAPL', qty: 5, cost: 200, costCurrency: 'USD' }, { ticker: 'AAPL', qty: 1, cost: 280000, costCurrency: 'KRW' });
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'cost-currency-differs');
    const book = mergeDuplicatePositions([{ ticker: 'A', qty: 1, cost: 10, targetWeight: 40 }, { ticker: 'B', qty: 1, cost: 5 }, { ticker: 'A', qty: 3, cost: 20, targetWeight: 60 }]);
    assert.deepEqual(book.positions.map((p) => p.ticker), ['A', 'B']);
    assert.equal(book.positions[0].qty, 4);
    assert.equal(book.positions[0].cost, 17.5);
    assert.equal(book.positions[0].targetWeight, 100, 'target weights add, so the backtest and the risk estimate read one row');
    const zero = mergeDuplicatePositions([{ ticker: 'A', qty: 1, cost: 1, targetWeight: 0 }, { ticker: 'A', qty: 1, cost: 1 }]);
    assert.equal(zero.positions[0].targetWeight, 0, 'an explicit 0% stays a weight; a blank stays blank');
    const mixed = mergeDuplicatePositions([{ ticker: 'A', qty: 1, cost: 1, costCurrency: 'USD' }, { ticker: 'A', qty: 2, cost: 1500, costCurrency: 'KRW' }]);
    assert.equal(mixed.positions[0].qty, 3);
    assert.ok(!('cost' in mixed.positions[0]), 'no average across currencies');
    assert.equal(mixed.notes[0].priced, false);
    const { duplicateHoldingDialog, mergedImportText } = await load('src/ui/panels/portfolio-duplicate-holding.js');
    const dialog = duplicateHoldingDialog(held, { ticker: 'NVDA', qty: 10, cost: 200, costCurrency: null });
    assert.equal(dialog.merged.cost, 175);
    assert.match(dialog.message, /합치면 수량 20주, 매수 단가 175\(/);
    const refusedDialog = duplicateHoldingDialog({ ticker: 'AAPL', qty: 5, cost: 200, costCurrency: 'USD' }, { ticker: 'AAPL', qty: 1, cost: 280000, costCurrency: 'KRW' });
    assert.equal(refusedDialog.merged, null);
    assert.match(refusedDialog.message, /통화가 달라\(보유 달러, 입력 원\)/);
    assert.match(mergedImportText(book.notes), /^같은 종목이 여러 줄이라 한 줄로 합침: A 2줄/);
    const file = JSON.stringify([{ ticker: 'NVDA', qty: 10, cost: 150 }, { ticker: 'NVDA', qty: 10, cost: 200 }]);
    const parsed = parsePortfolioBackup(file, { mergePositions: mergeDuplicatePositions });
    assert.equal(parsed.contents.positions.length, 1);
    assert.equal(parsed.adjustments.positionsMerged[0].ticker, 'NVDA');
  } },
  { id: 'v60.30', name: 'holdings valued on a close say the count once and show that close\'s change with its date in 오늘', run: async ({ load }) => {
    const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
    const { createFakeDocument, shellIds } = await load('scripts/lib/fake-dom.mjs');
    const { createStore } = await load('src/state/store.js');
    const { createPortfolioPage } = await load('src/ui/pages/portfolio.js');
    const doc = createFakeDocument({ ids: shellIds(html) });
    doc.getElementById('page-portfolio').appendChild(doc.getElementById('pf-positions-tbody'));
    const holdings = [{ symbol: 'NVDA', shares: 10, avgCost: 150 }, { symbol: 'AAPL', shares: 5, avgCost: 200 }];
    // The close is two days before the run: the page reads the wall clock, and a fixed date turned stale a week later.
    const closeDay = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const md = String.raw`${Number(closeDay.slice(5, 7))}/${Number(closeDay.slice(8, 10))}`;
    const store = createStore({ initialState: { portfolio: { status: 'ready', readState: 'ready', holdings, holdingsKnown: true } } });
    const root = { _liveData: {}, fetch: () => Promise.reject(new Error('offline')),
      SCREENER_DB: [{ sym: 'NVDA', sector: 'Technology', valuationPrice: 180, factorSessionDate: closeDay, ret1d: -1.2 }, { sym: 'AAPL', sector: 'Technology', valuationPrice: 230, factorSessionDate: closeDay, ret1d: 0.5 }] };
    createPortfolioPage({ root, documentRef: doc, store }).mount();
    const status = String(doc.getElementById('pf-analysis-status').textContent || '');
    assert.ok(status.startsWith('2종목 평가 완료') && status.endsWith(`, 모두 ${md} 종가 기준`), `v60.30 every holding on the close says so once: ${status}`);
    assert.doesNotMatch(status, /2종목은/, `v60.30 the count is not repeated: ${status}`);
    const rows = [...doc.getElementById('pf-positions-tbody').children].filter((tr) => tr.children?.length > 3);
    const day = rows.map((tr) => String(tr.children.find((td) => td.dataset?.label === '오늘' || /pf-th-day/.test(td.getAttribute?.('headers') || ''))?.textContent ?? tr.children[6]?.textContent));
    assert.deepEqual(day, [`-1.20% (${md})`, `+0.50% (${md})`], `v60.30 오늘 shows the close's own change, dated: ${JSON.stringify(day)}`);
  } },
  { id: 'v60.30', name: 'the duplicate-holding dialog reads as plain Korean and names a currency only when it is not the listing\'s', run: async ({ load }) => {
    const { duplicateHoldingDialog } = await load('src/ui/panels/portfolio-duplicate-holding.js');
    const plain = duplicateHoldingDialog({ ticker: 'NVDA', qty: 10, cost: 150, costCurrency: null }, { ticker: 'NVDA', qty: 5, cost: 160, costCurrency: 'USD' });
    assert.ok(plain.merged, 'v60.30 a price with no currency entered is the listing currency, so it averages with an explicit USD price on a US listing');
    assert.match(plain.message, /보유 수량 10주, 매수 단가 150\)/, `v60.30 a lot reads 수량·매수 단가: ${plain.message}`);
    assert.doesNotMatch(plain.message, /@|통화 미입력|달러|USD/, `v60.30 no '@', no '통화 미입력', no listing currency: ${plain.message}`);
    const foreign = duplicateHoldingDialog({ ticker: 'NVDA', qty: 1, cost: 200000, costCurrency: 'KRW' }, { ticker: 'NVDA', qty: 1, cost: 210000, costCurrency: 'KRW' });
    assert.match(foreign.message, /매수 단가 200,000원/, `v60.30 a won price on a US listing names the currency: ${foreign.message}`);
  } },
  { id: 'v60.28', name: 'a close inside the near-line band is not a moving-average break on 기술 리스크; past it, it is', run: async ({ load }) => {
    const { sellPressure } = await load('src/domain/portfolio/technical-risk.js');
    const snap = (price) => ({ ok: true, price, adr20Pct: 1.5, sma50: 100, ema10: 100.2, ema21: 100.1, dist50Pct: (price / 100 - 1) * 100, above10EMA: price >= 100.2, above21EMA: price >= 100.1, above50SMA: price >= 100, rsi14: 50, dayGainPct: 0, dist21Atr: 0 });
    const near = sellPressure(snap(99.74));
    assert.ok(!near.flags.some((flag) => flag.startsWith('CLOSE_BELOW')), `-0.26% under the 50-day line with a 1.5% daily range is 선 근처: ${near.flags.join(',')}`);
    assert.equal(near.score, 0);
    const broken = sellPressure(snap(97));
    assert.deepEqual(broken.flags.filter((flag) => flag.startsWith('CLOSE_BELOW')).length, 3, '-3% is past one daily range under every line');
    const noRange = sellPressure({ ...snap(99.74), adr20Pct: null });
    assert.ok(noRange.flags.includes('CLOSE_BELOW_50SMA_SWING_THESIS_DAMAGED'), 'without a daily range the line alone decides');
  } },
  { id: 'v60.28', name: 'the backtest result is in Korean, fills the benchmark column and states the start weights', run: async ({ load }) => {
    const { renderPortfolioBacktestLab } = await load('src/ui/components/portfolio-backtest-lab.js');
    const out = {};
    renderPortfolioBacktestLab({ ok: true, weights: { XOM: 0.52, JPM: 0.3, MSFT: 0.18 }, settings: { startMonth: '2016-12', endMonth: '2026-10', rebalanceType: 'annual', benchmarkSymbol: 'SPY', targetWeightBasis: 'start-date-adjusted-close-market-value', rfAnnual: null },
      performance: { startBalance: 10000, endBalance: 20000, benchmarkEndBalance: 25000, cagr: 0.07, benchmarkCagr: 0.1, stdev: 0.15, benchmarkStdev: 0.14, bestYear: 0.3, worstYear: -0.1, benchmarkBestYear: 0.28, benchmarkWorstYear: -0.18, maxDrawdown: 0.25, benchmarkMaxDrawdown: 0.24, trackingError: 0.05, activeReturn: -0.03 },
      drawdowns: [{ start: '2020-01', end: '2020-03', recoveryBy: 'Unrecovered', recoveryMonths: null, underwaterMonths: 5, drawdown: 0.25 }], components: [{ ticker: 'XOM', weight: 0.52, standaloneReturn: 0.5, returnContribution: 100, riskContribution: 0.6 }],
      warnings: ['첫 문장입니다.', '둘째 문장입니다.'] }, { root: {}, documentRef: { getElementById: () => out } });
    const text = String(out.innerHTML).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const word of ['REFERENCE-ONLY', 'Performance Summary', 'Metric', 'Start Balance', 'Stdev', 'Best Year', 'underwater', 'Annual Returns', 'Worst Drawdowns', 'Standalone', 'annual', 'start-date-adjusted', 'Unrecovered']) assert.ok(!text.includes(word), `English/internal word left: ${word}`);
    assert.match(text, /최고 연도 \+30\.00% \+28\.00%/);
    assert.match(text, /최저 연도 -10\.00% -18\.00%/);
    assert.match(text, /최대 낙폭 -25\.00% -24\.00%/);
    assert.match(text, /연 표준편차 15\.00% 14\.00%/, 'a standard deviation has no plus sign');
    assert.match(text, /시작 비중: XOM 52%, JPM 30%, MSFT 18% — 지금 보유 수량을 2016-12 가격으로 평가/);
    assert.match(text, /리밸런싱 매년/);
    assert.ok(!/\.,/.test(text) && !/\.\./.test(text), 'sentences are joined without ".," or ".."');
  } },
  { id: 'v60.28', name: 'the held backtest names the holdings without a price record in one sentence', run: async ({ load }) => {
    const { buildPortfolioBacktestLab } = await load('src/domain/portfolio/backtest.js');
    const model = buildPortfolioBacktestLab({}, [{ ticker: 'NVDA', qty: 10, cost: 150 }, { ticker: '005930.KS', qty: 100, cost: 70000, costCurrency: 'KRW' }], { benchmarkSymbol: 'SPY' });
    assert.equal(model.ok, false);
    assert.equal(model.warnings.length, 1);
    assert.match(model.warnings[0], /^가격 기록을 받지 못한 종목\(NVDA, 005930\.KS\)이 있어 실행하지 않았습니다 — .*실행됩니다\.$/);
    assert.equal(model.allocationBlocked.code, 'member-price-series-missing', 'the coverage rule stays in the model');
  } },
  { id: 'v60.28', name: 'copy: one share figure when the denominators match; SOFR one-click fill label', run: async ({ load }) => {
    const { buildPortfolioRead } = await load('src/domain/portfolio/portfolio-read.js');
    const { riskFreeFill } = await load('src/ui/panels/portfolio-rf-fill.js');
    const read = buildPortfolioRead({ surface: { rows: [{ symbol: 'NVDA', value: 13 }, { symbol: 'AAPL', value: 87 }] },
      rows: [{ sym: 'NVDA', pctSma50: -8, pctSma200: -5, adrPct: 2 }, { sym: 'AAPL', pctSma50: 6, pctSma200: 9, adrPct: 2 }] });
    const trend = (read.points || []).find((point) => point.id === 'trend');
    assert.ok(trend, 'trend point present');
    assert.match(trend.text, /NVDA\(13%\)/);
    assert.doesNotMatch(trend.text, /NVDA\(13%, 평가액의 13%\)/);
    assert.deepEqual(riskFreeFill({ value: 3.9, date: '2026-11-17' }), { value: '3.90', date: '2026-11-17', label: 'SOFR 3.90%(11/17) 넣기' });
    assert.equal(riskFreeFill(null), null, 'no published rate, no button');
  } },
  { id: 'v60.30', name: 'backtest and risk hold messages say what is missing and what makes them available, with no internal jargon', run: async ({ load }) => {
    const { buildPortfolioBacktestLab } = await load('src/domain/portfolio/backtest.js');
    const { assessAccountPerformance } = await load('src/domain/portfolio/risk.js');
    const { renderPortfolioRiskMetrics } = await load('src/ui/components/portfolio-risk-metrics.js');
    const lab = await load('src/ui/components/portfolio-backtest-lab.js');
    const jargon = /보류|인증|leg\b|targetWeight|adjusted close|raw close|승격|dayCount|valuation marks|잔여비중|전액투자|[a-z]+-[a-z]+-[a-z]+/;
    const months = Array.from({ length: 15 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
    const series = (fn) => ({ timestamps: months.map((key) => `${key}-28T00:00:00Z`), adjustedCloses: months.map((_, i) => fn(i)), backtestEligible: true, backtestPriceBasis: 'adjusted-close' });
    const prices = (drop = []) => { const map = { AAA: series((i) => 100 + i * 10), BBB: series((i) => 100 - i), SPY: series(() => 100) }; drop.forEach((t) => delete map[t]); return map; };
    const positions = (a, b) => [{ ticker: 'AAA', qty: 1, cost: 100, ...(a !== undefined ? { targetWeight: a } : {}) }, { ticker: 'BBB', qty: 1, cost: 100, ...(b !== undefined ? { targetWeight: b } : {}) }];
    const holds = {
      partial: buildPortfolioBacktestLab(prices(), positions(0, null), {}),
      zero: buildPortfolioBacktestLab(prices(), positions(0, 0), {}),
      over: buildPortfolioBacktestLab(prices(), positions(60, 60), {}),
      under: buildPortfolioBacktestLab(prices(), positions(30, 30), {}),
      benchmark: buildPortfolioBacktestLab(prices(['SPY']), positions(), {}),
      rebalance: buildPortfolioBacktestLab(prices(), positions(), { rebalanceType: 'weekly' })
    };
    for (const [name, model] of Object.entries(holds)) {
      assert.equal(model.ok, false, `${name} is held`);
      const text = model.warnings.join(' ');
      assert.doesNotMatch(text, jargon, `${name}: the hold names no internal term (${text})`);
      assert.match(text, /실행하지 않았습니다 — .*실행됩니다\.$/, `${name}: one sentence, what is missing — what makes it run (${text})`);
      assert.doesNotMatch(text, /하세요|고르세요/, `${name}: the condition is stated, not ordered (${text})`);
    }
    assert.match(holds.partial.warnings[0], /BBB/, 'the empty target weight is named by its ticker');
    // The account performance holds and the risk panel's account-view hold.
    const ledger = { currency: 'USD', dayCount: 'actual-365', flowTiming: 'end-of-period', transactions: [{ date: '2026-06-30', kind: 'deposit', amount: 50 }], valuations: [{ date: '2026-01-01', amount: 100 }] };
    for (const input of [{ ledger: null }, { ledger: { ...ledger, coverage: {} } }, { ledger: { ...ledger, coverage: coverageAll(LEDGER_IDS), currency: null } }, { ledger: { ...ledger, coverage: coverageAll(LEDGER_IDS) } }]) {
      const perf = assessAccountPerformance(input);
      assert.equal(perf.status, 'blocked');
      assert.doesNotMatch(perf.message, jargon, `account hold ${perf.code} uses plain words (${perf.message})`);
      assert.match(perf.message, /계산하지 않았습니다 — .*계산합니다\.$/, `account hold ${perf.code} says what makes it available`);
    }
    const out = { innerHTML: '', insertAdjacentHTML() {} };
    const est = { publishedScope: 'invested_sleeve', exposureHistoryMode: 'current_composition_retrospective', rf: { status: 'missing' }, sample: { n: 30 }, compositionSnapshotId: 'pfcomp-x', valuationCut: '2026-11-17', wholeAccountHold: 'cash-return-unresolved', pathLineage: 'retrospective' };
    renderPortfolioRiskMetrics({ estimate: est, snapshot: null, returnsMap: {}, rfAnnual: null }, { documentRef: { getElementById: () => out }, root: {} });
    const html = String(out.innerHTML);
    const fold = (html.match(/<details>[\s\S]*?<\/details>/) || [''])[0];
    const face = html.replace(fold, '');
    assert.match(face, /현금 연수익률을 넣으면 계좌 전체로 계산합니다/, 'the account-view hold says which input makes it available');
    assert.match(face, /무위험 수익률 미입력\(넣으면 샤프 지수 계산\)/, 'the scope line says which input gives the Sharpe ratio');
    assert.match(face, /250거래일\(약 1년\)이 쌓이면 표시합니다/, 'a short sample says when the Sharpe ratio appears');
    assert.doesNotMatch(face.replace(/<[^>]+>/g, ' '), /보류|cash-return-unresolved|RF 미입력/, 'no hold jargon on the face');
    assert.match(fold, /account-hold cash-return-unresolved/, 'the hold code stays in the existing 계산 식별자 fold');
    assert.doesNotMatch(lab.varCertLabel({ certification: 'held', certificationReasons: ['sample-below-declared-minimum'] }), jargon, 'the VaR reference label is plain');
  } }
];
