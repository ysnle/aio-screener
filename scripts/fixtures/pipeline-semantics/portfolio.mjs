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
      _pfBaseNote: () => '', _pfPearson: () => null, _aioPortfolioSurface: { totalAssets: 100 }, _aioPortfolioSectorLabel: portfolioSectorLabel };
    renderPortfolioExposure([{ sym: 'SPY', value: 40 }, { sym: 'QQQ', value: 25 }, { sym: 'NVDA', value: 10 }, { sym: 'XYZW', value: 25 }], {}, { documentRef: { getElementById: () => node }, root });
    const text = node.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.doesNotMatch(text, /ETF\(여러 업종 묶음\) 섹터 \d+% 집중/);
    assert.match(text, /종목\/섹터 수 4\/1/);
    assert.match(text, /ETF 2개 포함/);
    assert.match(text, /랭크 확인 75%/);
  } }
];
