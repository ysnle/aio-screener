// v57.62 structure: the classic-shell window.* bridge, moved out of src/app/bootstrap.js unchanged. bootstrap calls
// installCompatibilityGlobals(window) at the same point of boot; `window`/`document` below are the passed root so the
// assignments read exactly as they did in bootstrap (gates match these lines).
import { installGlossaryBridge } from '../ui/knowledge/glossary-bridge.js';
import { createPersonalProviderTransport } from '../data/providers/personal-transport.js';
import { describeSharedConnection } from '../domain/connections/shared.js';
import { formatSecResearchEvidence } from '../ai/context/sec-fundamentals.js';
import { parseSecStatements } from '../domain/fundamental/sec-statements.js';
import { buildMarketContentContext, buildQuestionDomainContext } from '../ai/context/market-content.js';
import { chooseAnswerVisuals } from '../ai/response/answer-visual-choice.js';
import { chooseAnswerMode, answerModeGuide } from '../ai/response/answer-modes.js';
import { buildAnswerPrinciples, describeAnswerVisuals, promptWithoutWebSearch } from '../ai/response/answer-principles.js';
import { buildChatPolicyLines } from '../ai/context/policy-lines.js';
import { resolveChatTickers } from '../ai/entity/chat-tickers.js';
import { portfolioRowsLine } from '../ai/context/portfolio-rows.js'; // v58.75: redacted holdings line (workbench + AI panel)
import { selectNativeSearch, attachNativeSearch, hasInternalCurrentEvidence } from '../ai/research/native-search.js';
import { isKnownSymbol, resolveHoldingInput, resolveRegisteredName, searchCandidates } from '../domain/ticker/resolve-name.js';
import { hasFinalConsonant } from '../domain/content/korean-particle.js';
import { isListedUsSymbol, usListingSymbol } from '../data/us-listings.js';
import { stripEvidenceIds } from '../domain/briefing/evidence-text.js';
import { releaseAtMs, formatKstWhen } from '../domain/briefing/schedule.js';
import { groupNewsStories, isNewsRevision, newsArticleKey, resolveNewsIssuers } from '../domain/news/stories.js';
// Portfolio statistics/backtest is a native ESM module; importing it during
// bootstrap keeps the classic regression surface available before lazy route
// navigation while leaving the implementation out of aio-core.js.
import { _statMean, _statStdDev, _calcDailyReturns, _quantileR7, _calcSharpe, _calcMaxDrawdown, _pearsonCorr, _calcCorrelationMatrix } from '../domain/portfolio/return-stats.js';
import { assessAccountPerformance } from '../domain/portfolio/risk.js';
import { PORTFOLIO_ASSUMPTION_KEYS, EXPOSURE_PATHS, REBALANCE_POLICIES, normalizeCurrencyCode, normalizeAnnualRate, normalizeExposurePath, normalizeRebalancePolicy, readPortfolioAssumptions } from '../data/portfolio-assumptions.js';
import { LEDGER_COVERAGE_INPUTS, appendLedgerTransaction, appendLedgerValuation, ledgerCoverageState, normalizeLedger, removeLedgerEntry as removeLedgerEntryFromLedger, setLedgerCoverage as setLedgerCoverageOnLedger, setLedgerFlowTiming as setLedgerFlowTimingOnLedger } from '../data/portfolio-ledger.js';
import { FX_LEG_MAX_AGE_MS, appendFxLeg, fxLegsState, normalizeFxLegs, removeFxLeg } from '../domain/portfolio/fx.js';
import { applyFxPanel, applyLedgerPanel, clearDeclaredFields, readDeclaredFields, showDeclarationStatus } from '../ui/panels/portfolio-declarations.js';
import { assembleRiskEstimateInput } from '../ui/panels/portfolio-risk-input.js';
import { baseValueRows, baseValueNote } from '../ui/panels/portfolio-base-values.js';
import { createDeclarationsStore } from '../data/portfolio-declarations-store.js';
import { BACKUP_SECTIONS, buildPortfolioBackup, describeBackupCounts, parsePortfolioBackup } from '../data/portfolio-backup.js';
import { readWatchlistSymbols, toggleWatchlistSymbol } from '../data/watchlist-store.js';
import { CASH_INPUT_CURRENCIES, PORTFOLIO_CASH_KEY, LEGACY_CASH_KEY, readCashBalances, setCashBalance, writeCashBalances } from '../data/portfolio-cash.js';
import { appUsdKrwClose } from '../domain/portfolio/cash.js';
import { normalizeTickerInput, tickerDisplayName } from '../domain/entity/ticker-symbol.js';
import { describeQuoteCurrentness } from '../domain/market/quote-currentness.js';
import { KR_THEME_LABELS } from '../domain/themes/kr-themes.js';
import { MA_STRUCTURE_LABELS } from '../domain/technical/stage.js';
import { completedBars } from '../ui/components/chart-bars.js';
import { keywordMayMatch, textPairs } from '../domain/news/keyword-prefilter.js';
import { readScreenerBreadth } from '../domain/market/screener-breadth.js';
import { installPageCompleteness } from '../data/page-completeness.js';
import { fetchServerData, buildServerDataMeta } from '../data/server-data.js';
import { takeBootPrefetch } from '../data/boot-prefetch.js';
import { applyServerMacro } from '../data/server-macro.js';
import { verifyServerMarketAnalysis } from '../data/server-market-analysis.js';
import { buildScreenerAiContext, detectSectorQuery, formatScreenerResultPrompt, runScreenerQuery } from '../ai/context/screener-query.js';

export function installCompatibilityGlobals(root = globalThis) {
  const window = root;
  const document = root.document;
  window._aioPersonalProviderTransport = createPersonalProviderTransport({ fetch: (...args) => window.fetch(...args) });
  window._aioCompletedBars = completedBars; // v57.92 A04: the AI trend line reads completed sessions only, like the chart
  window._statMean = _statMean;
  window._statStdDev = _statStdDev;
  window._calcDailyReturns = _calcDailyReturns;
  window._quantileR7 = _quantileR7;
  window._calcSharpe = _calcSharpe;
  window._calcMaxDrawdown = _calcMaxDrawdown;
  window._pearsonCorr = _pearsonCorr;
  window._calcCorrelationMatrix = _calcCorrelationMatrix;
  window._aioTextPairs = textPairs; // v57.91 (P1901): news keyword prefilter read by js/aio-data.js scoreItem
  window._aioKwMay = keywordMayMatch;
  // Legacy unification (2026-10-17): the chat's screener query engine moved here from js/aio-data.js. Every call reads
  // the canonical rows the native screener orchestrator ranked (no second ranking run) and the producer's factor date.
  const screenerState = (path) => { try { return window.AIO_ARCH?.getScreenerState?.(path) ?? null; } catch (_) { return null; } };
  // Screener-universe breadth, checked once (legacy unification 2026-10-17: replaces the projected breadth globals).
  window._aioScreenerBreadth = (breadth = screenerState('metadata.breadth'), now = Date.now()) => readScreenerBreadth(breadth, now);
  // Per-screen data completeness reads the native screener slice (legacy unification 2026-10-17).
  installPageCompleteness(window, {
    readScreener: () => {
      const metadata = {};
      for (const key of ['universeFreshnessStatus', 'backtest', 'detail']) { const value = screenerState(`metadata.${key}`); if (value != null) metadata[key] = key === 'backtest' ? true : value; }
      return { status: screenerState('status'), revision: screenerState('revision'), updatedAt: screenerState('updatedAt'), metadata };
    }
  });
  // The legacy data.json loader fetches and gates the server artifact here (legacy unification 2026-10-17).
  // 2026-10-19: the six-hour market slots (data.json marketTimeline) are kept for the briefing's 시간대별 시황.
  window._aioFetchServerData = () => fetchServerData({ fetch: (...args) => window.fetch(...args), prefetched: takeBootPrefetch(window, 'data') }).then((result) => {
    if (result?.ok) window._serverMarketTimeline = result.data.marketTimeline?.schemaVersion === 'market-timeline.v1' ? result.data.marketTimeline : null;
    return result;
  });
  window._aioBuildServerDataMeta = (data, reconciliation) => buildServerDataMeta(data, { reconciliation });
  window._aioApplyServerMacro = (data, snapshot, evidence, serverMeta) => applyServerMacro({ data, snapshot, evidence, serverMeta });
  window._aioVerifyServerMarketAnalysis = verifyServerMarketAnalysis;
  const screenerFactorAsOf = () => screenerState('metadata.asOf') || screenerState('revision') || null;
  const screenerQueryInput = () => ({
    rows: (typeof window._aioGetCanonicalScreenerRows === 'function' ? window._aioGetCanonicalScreenerRows() : null) || [],
    live: window._liveData || {},
    aliases: window.SCR_KEYWORD_ALIASES || {},
    rankAsOf: screenerFactorAsOf()
  });
  window._aioRunScreenerQuery = (query, opts) => runScreenerQuery(query, { ...screenerQueryInput(), recentTickers: opts?.recentTickers || [] });
  window._formatScreenerResultPrompt = (result) => formatScreenerResultPrompt(result, { rankAsOf: screenerFactorAsOf() });
  window._aioBuildScreenerAiContext = (query, messages, logger) => buildScreenerAiContext(query, messages, { ...screenerQueryInput(), logger });
  window._detectSectorQuery = (text) => detectSectorQuery(text, { rows: screenerQueryInput().rows });
  window.AIO = window.AIO || {};
  window.AIO.describeSharedConnection = describeSharedConnection;
  window.AIO.formatSecResearchEvidence = formatSecResearchEvidence;
  // v58.71: research-channel numbers in the chat context; loaded after boot (the chat checks that it exists).
  import('../ai/context/channel-signals.js').then((module) => { window.AIO.formatChannelSignalEvidence = module.formatChannelSignalEvidence; }).catch(() => {});
  window.AIO.parseSecStatements = parseSecStatements; // 2026-10-17 D8: replaces js/aio-chat.js _parseSECFinancials
  window.AIO.buildMarketContentContext = buildMarketContentContext;
  window.AIO.buildQuestionDomainContext = buildQuestionDomainContext;
  // P1741: data-drawn figures under an AI answer. v58.80 (bundle 4): the builders load with the first answer (both are async).
  const answerVisuals = () => import('../ui/components/ai-answer-visuals.js');
  window.AIO.renderAnswerVisuals = (options) => answerVisuals().then((module) => module.renderAnswerVisuals(options));
  window.AIO.chooseAnswerVisuals = chooseAnswerVisuals;
  window.AIO.attachAnswerVisuals = (options) => answerVisuals().then((module) => module.attachAnswerVisuals(options));
// P1740: chat prompt pieces moved out of js/aio-chat.js (answer shape, principles, policy lines, ticker resolver).
Object.assign(window.AIO, { chooseAnswerMode, answerModeGuide, buildAnswerPrinciples, describeAnswerVisuals, promptWithoutWebSearch, buildChatPolicyLines, resolveChatTickers, portfolioRowsLine });
  window.AIO.selectNativeSearch = selectNativeSearch;
  window.AIO.attachNativeSearch = attachNativeSearch;
  window.AIO.hasInternalCurrentEvidence = hasInternalCurrentEvidence;
  // v58.80 (boot budget): the backtest engine loads on demand — when 포트폴리오 opens, when the form is read, or when the
  // browser is idle after boot — and installs the same synchronous AIO.buildPortfolioBacktestLab the shell calls.
  const backtestLab = () => import('../domain/portfolio/backtest.js').then((module) => { window.AIO.buildPortfolioBacktestLab = module.buildPortfolioBacktestLab; return module; });
  window._aioLoadBacktestLab = backtestLab;
  const warmBacktestLab = () => { backtestLab().catch(() => {}); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warmBacktestLab);
  else globalThis.setTimeout?.(warmBacktestLab, 4000)?.unref?.();
  // P1258: 위험 입력 조립(스냅샷·returnsMap·estimate 호출)의 단일 소유자 — 셸은 이 브리지를
  // 호출해 결과를 그대로 렌더한다.
  window._pfAssembleRiskEstimateInput = assembleRiskEstimateInput;
  window._pfBaseValues = (positions) => baseValueRows(window._aioPortfolioSurface || null, positions); // P1445
  installGlossaryBridge({ root: window, documentRef: window.document }); // P1472/P1474: one concept source + cross-surface search
  window._pfBaseNote = baseValueNote;
  window._pfAssessAccountPerformance = assessAccountPerformance;
  // E3/P1188: the classic-shell form is the writer for the declared currency /
  // cash-return / RF inputs; it consumes the same keys and normalizers the
  // reader uses, so the two ends cannot drift (R632).
  window._pfPortfolioAssumptions = { keys: PORTFOLIO_ASSUMPTION_KEYS, exposurePaths: EXPOSURE_PATHS, rebalancePolicies: REBALANCE_POLICIES, normalizeCurrencyCode, normalizeAnnualRate, normalizeExposurePath, normalizeRebalancePolicy, read: readPortfolioAssumptions };
  // E4/P1191: 원장의 유효성·병합은 ESM 모듈이 소유하고, 셸은 DOM과 Vault 쓰기만 맡는다.
  window._pfPortfolioLedger = {
    inputs: LEDGER_COVERAGE_INPUTS,
    normalize: normalizeLedger,
    appendTransaction: appendLedgerTransaction,
    appendValuation: appendLedgerValuation,
    remove: removeLedgerEntryFromLedger,
    setCoverage: setLedgerCoverageOnLedger,
    setFlowTiming: setLedgerFlowTimingOnLedger,
    coverageState: ledgerCoverageState
  };
  // E3/P1194 (11 §23): 선언된 FX leg의 유효성·환산 근거는 도메인 모듈이 소유하고, 셸은 DOM과 저장만 맡는다.
  window._pfPortfolioFx = { maxAgeMs: FX_LEG_MAX_AGE_MS, normalize: normalizeFxLegs, appendLeg: appendFxLeg, removeLeg: removeFxLeg, legsState: fxLegsState };
  // P1195: 선언 패널의 마크업·ack 문구는 네이티브가 소유한다 — 셸은 저장 경로와 순서만 남긴다.
  // P1199: 선언 저장소의 *형태*(읽기 규칙·ack 분리)는 네이티브가 소유하고, 셸이 저장 정책(경로)을 주입한다.
  window._pfDeclarationsStore = { create: createDeclarationsStore };
  window._pfDeclarationPanels = { applyLedgerPanel, applyFxPanel, showDeclarationStatus, readDeclaredFields, clearDeclaredFields };
  // P1316/R661: 전체 개인 데이터 백업 묶음의 형태·검증은 네이티브가 소유하고, 셸은 스냅샷 수집과
  // 저장(ack) 순서만 맡는다. 섹션 정규화는 각 섹션의 기존 소유자(원장·FX·가정)를 그대로 쓴다.
  const backupDeps = {
    normalizeLedger,
    normalizeFxLegs,
    assumptionKinds: { baseCurrency: 'currency', cashCurrency: 'currency', cashReturn: 'rate', riskFreeRate: 'rate', exposurePath: 'path', rebalancePolicy: 'policy' },
    assumptionNormalizers: { currency: normalizeCurrencyCode, rate: normalizeAnnualRate, path: normalizeExposurePath, policy: normalizeRebalancePolicy }
  };
  window._pfPortfolioBackup = {
    sections: BACKUP_SECTIONS,
    build: buildPortfolioBackup,
    describe: describeBackupCounts,
    parse: (text) => parsePortfolioBackup(text, backupDeps)
  };
  // P1317/R663: the ticker route, quote request and screener lookup share one canonical symbol —
  // a bare KRX code or registered Korean name resolves to `005930.KS`-style keys.
  // P1339: registered company names (엔비디아 / nvidia / 퀄컴) resolve by exact registry match when the KRX
  // normalizer left the input unchanged — no fuzzy guessing.
  window._aioNormalizeTickerInput = (raw) => {
    const rows = typeof window._aioGetCanonicalScreenerRows === 'function' ? window._aioGetCanonicalScreenerRows() || [] : [];
    const isListed = (symbol) => rows.some((row) => (row?.sym || row?.symbol) === symbol);
    const normalized = normalizeTickerInput(raw, { krStockDb: window.KR_STOCK_DB, krToYahoo: window.krTickerToYahoo, isListed });
    if (normalized !== String(raw || '').trim().toUpperCase()) return normalized;
    return resolveRegisteredName(raw, window.AIO_TICKER_NAME_REGISTRY?.entries) || normalized;
  };
  window._aioResolveRegisteredName = (raw) => resolveRegisteredName(raw, window.AIO_TICKER_NAME_REGISTRY?.entries);
  // v57.54 review: a search with no exact match keeps a message under the box with candidates to pick (no auto-open).
  // v57.81: a symbol the US listing directory confirmed this session is known as well (it is a real listing, not a typo).
  const listedSeen = new Set();
  window._aioIsKnownTicker = (symbol) => isKnownSymbol(symbol, { entries: window.AIO_TICKER_NAME_REGISTRY?.entries, krStockDb: window.KR_STOCK_DB,
    universe: typeof window._aioGetCanonicalScreenerRows === 'function' ? window._aioGetCanonicalScreenerRows() || [] : [] }) || listedSeen.has(String(symbol || '').trim().toUpperCase());
  // v57.81 (owner 2026-10-15): a US-listed symbol outside the published universe is read on demand with the producer's
  // own functions (src/data/on-demand-symbol.js). Nothing loads at boot — the reader, the listing directory and a
  // symbol's chart/filings load only when a screen asks for that one symbol (session cache, two symbols at a time).
  const checkListed = (symbol) => import('../data/us-listings.js').then((module) => module.isListedUsSymbol(symbol))
    .then((listing) => { if (listing?.listed) listedSeen.add(String(symbol || '').trim().toUpperCase()); return listing || { listed: false }; })
    .catch(() => ({ listed: false, directoryAvailable: false }));
  let onDemandReader = null;
  const onDemandReady = () => (onDemandReader ? Promise.resolve(onDemandReader) : import('../data/on-demand-symbol.js').then((module) => (onDemandReader ||= module.createOnDemandSymbolReader({
    fetchChart: (id) => (typeof window._fetchYahooChartData === 'function' ? window._fetchYahooChartData(id, '1y', '1d') : null),
    fetchJson: (url) => (typeof window.fetchViaProxy === 'function' ? window.fetchViaProxy(url, { parseJson: true, timeout: 12000 }) : null),
    isListed: checkListed,
    isKnown: (id) => window._aioIsKnownTicker?.(id) === true,
    universeRows: () => window._aioGetCanonicalScreenerRows?.() || [],
    // The inputs the native screener's ranking run uses.
    rankInputs: () => {
      const weights = typeof window._aioFactorWeights === 'function' ? window._aioFactorWeights(window.AIO?.marketState) : null;
      return { weights: weights?.weights || null, weightsPolicy: weights?.source === 'explicit-user-profile' ? 'explicit' : 'model-default',
        regimeLabel: weights?.regimeLabel || null, fundamentalCoveragePct: Number(screenerState('metadata.fundamentalCoveragePct') || 0), fmpOk: !!screenerState('metadata.fmpOk') };
    },
    readLiveData: () => window._liveData || {},
    onRecord: (record) => {
      if (record?.status === 'ready') window.AIO?.registerLiveSymbol?.(record.symbol, { reason: 'on-demand-symbol' });
      try {
        document?.dispatchEvent?.(new CustomEvent('aio:onDemandSymbol', { detail: { symbol: record?.symbol, status: record?.status } }));
        if (String(window._currentTickerId || '').toUpperCase() === record?.symbol) document?.dispatchEvent?.(new CustomEvent('aio:entityChanged', { detail: { id: record.symbol, source: 'on-demand-symbol' } }));
      } catch (_) { /* event construction unavailable */ }
    }
  }))));
  window._aioRequestOnDemandSymbol = (symbol) => onDemandReady().then((reader) => reader.load(symbol)).catch(() => null);
  window._aioOnDemandSymbol = (symbol) => onDemandReader?.peek(symbol) || null;
  // v57.81: the chat's per-symbol data block carries the on-demand placement text (empty for universe/unlisted symbols).
  window._aioOnDemandChatContext = (symbol) => window._aioRequestOnDemandSymbol(symbol)
    .then((record) => (record?.status === 'ready' ? import('../domain/entity/out-of-universe-read.js').then((module) => module.outOfUniverseContext(record)) : ''))
    .catch(() => '');
  // v57.81: a watchlist or alert symbol is accepted when AIO knows it or the US listing directory lists it, and an
  // accepted symbol joins the live-quote request set (the next scheduled quote refresh fetches it).
  window._aioAcceptSymbol = (raw) => {
    const id = typeof window._aioNormalizeTickerInput === 'function' ? window._aioNormalizeTickerInput(raw) : String(raw || '').trim().toUpperCase();
    if (!/^[A-Z0-9.^=\-]{1,12}$/.test(id)) return Promise.resolve({ ok: false, id, reason: 'shape' });
    const accept = (basis) => { window.AIO?.registerLiveSymbol?.(id, { reason: `accepted:${basis}` }); return { ok: true, id, basis }; };
    if (window._aioIsKnownTicker?.(id)) return Promise.resolve(accept('known'));
    return checkListed(id).then((listing) => (listing?.listed ? accept('us-listing')
      : { ok: false, id, reason: listing?.directoryAvailable === false ? 'listing-unavailable' : 'not-listed' }));
  };
  // v57.81: the portfolio entry box shares this owner — it had its own narrower hand list and rejected universe symbols (SPCX).
  window._aioResolveHoldingInput = (raw) => resolveHoldingInput(raw, { entries: window.AIO_TICKER_NAME_REGISTRY?.entries, krStockDb: window.KR_STOCK_DB,
    universe: typeof window._aioGetCanonicalScreenerRows === 'function' ? window._aioGetCanonicalScreenerRows() || [] : [] });
  // v57.81: cash is one balance per currency (원화 현금 · 달러 현금). Storage shape and the legacy single-value migration are
  // owned by src/data/portfolio-cash.js; the shell reads, writes and re-renders through this one bridge.
  window._pfPortfolioCash = {
    key: PORTFOLIO_CASH_KEY,
    legacyKey: LEGACY_CASH_KEY,
    currencies: CASH_INPUT_CURRENCIES,
    read: () => readCashBalances(window.localStorage),
    write: (balances) => writeCashBalances(window.localStorage, balances),
    appFx: () => appUsdKrwClose(window._aioHistory || [])
  };
  // v58.80 (first-users F29): the screener star and 포트폴리오 관심 종목 share one store.
  window._aioWatchlistGet = () => readWatchlistSymbols(window.localStorage);
  window._aioWLToggle = (sym) => {
    const result = toggleWatchlistSymbol(window.localStorage, sym);
    if (result.added && result.listName) window.showToast?.(`${sym}: "${result.listName}" 목록에 추가했습니다.`);
    try { window.dispatchEvent(new CustomEvent('aio:screener:watchlist', { detail: { symbol: sym, watchlist: result.watchlist } })); } catch (_) {}
    return result;
  };
  // v58.80 (first-users bundle 6): typed numbers go through one reader (loaded on first use, outside the boot set).
  const inputCheck = () => import('../ui/components/input-check.js');
  window._aioReadBacktestInputs = () => Promise.all([inputCheck(), backtestLab()]).then(([{ readBacktestInputs }]) => readBacktestInputs(document));
  // The values are taken synchronously, before the lazy import, so the form can be refilled while the check loads.
  window._aioReadHoldingInputs = () => {
    const snapshot = Object.fromEntries(['pf-add-ticker', 'pf-add-qty', 'pf-add-cost'].map((id) => { const input = document.getElementById(id); return [id, { value: input?.value ?? '', badInput: !!input?.validity?.badInput }]; }));
    return inputCheck().then(({ readHoldingInputs }) => readHoldingInputs(document, snapshot));
  };
  // v58.80 run-5 (breaker #5): a refused ticker or currency is marked beside its field like a refused number, not only in a toast.
  const fieldRefusals = { ticker: '종목 목록에 없는 심볼입니다 — 거래소 심볼(예: AAPL, 005930)이나 회사 이름으로 입력하세요.', currency: '3자리 통화 코드(예: USD, KRW)로 입력하거나 비워 두세요.' };
  window._aioMarkField = (id, refusal = '') => inputCheck().then(({ markField }) => markField(document.getElementById(id), refusal ? { ok: false, reason: fieldRefusals[refusal] || refusal } : { ok: true })).catch(() => null);
  window._aioSaveCashBalance = async (el) => {
    const currency = el?.dataset?.currency;
    if (!currency) return;
    // -100 and 1e309 emptied the field to $0 without a word, and twenty digits were kept.
    const { checkNumericField, NUMERIC_LIMITS } = await inputCheck();
    const read = checkNumericField(el, { label: currency === 'KRW' ? '원화 현금' : '달러 현금', min: 0, max: NUMERIC_LIMITS.cash[currency] ?? NUMERIC_LIMITS.amount });
    if (!read.ok) return;
    const next = setCashBalance(readCashBalances(window.localStorage).balances, currency, read.empty ? '' : String(read.value));
    const ack = writeCashBalances(window.localStorage, next);
    if (!ack.ok) window.showToast?.('현금을 저장하지 못했습니다 — 이전 금액이 그대로 남아 있습니다.');
    try { document.dispatchEvent(new CustomEvent('aio:portfolioChanged')); } catch (_) {}
    try { window.renderPortfolio?.(); } catch (_) {}
  };
  // v57.81: the official US listing (public-data/us-listings.json) is fetched only when a symbol is unknown to the
  // registries above — never at boot. Exact symbol only; listed:null means it could not be checked (never accept).
  window._aioCheckUsListing = (symbol) => isListedUsSymbol(symbol);
  // P1847 / P1844 (codex F11/F07): the legacy analysis sink and macro calendar read these native rules (one owner each).
  window._aioStripEvidenceIds = stripEvidenceIds;
  window._aioMacroReleaseNotYet = (key, date, nowMs, today) => {
    const at = releaseAtMs(key, date);
    return Number.isFinite(at) ? at > nowMs : date >= today;
  };
  // v58.80 (first-users F09): the 거시 header named FOMC by its US date (10/28(수)) beside the body's 10/29(목) 03:00 KST.
  window._aioReleaseKstLabel = (key, date) => { const at = releaseAtMs(key, date); return Number.isFinite(at) ? formatKstWhen(at).label : null; };
  // v58.85: names kept for tests after the 거시 renderers left aio-core.js (lazy, outside the boot set).
  import('../ui/components/macro-next-release.js').then((m) => {
    const at = { documentRef: document, root: window };
    if (window.AIO) window.AIO.renderMacroNextRelease = () => m.renderMacroNextRelease(at);
    window._aioRenderKrMacroFreshnessBadges = () => m.renderKrMacroFreshnessBadges(at);
  }).catch(() => {});
  window._aioUsListingSymbol = (symbol) => usListingSymbol(symbol);
  const universeSymbols = () => new Set((typeof window._aioGetCanonicalScreenerRows === 'function' ? window._aioGetCanonicalScreenerRows() || [] : [])
    .map((row) => String(row?.sym || row?.symbol || '').toUpperCase()).filter(Boolean));
  // 2026-10-17: the watchlist, price-alert and holding boxes accept symbols only; when a typed company name is refused,
  // the refusal names the listing candidates (registry names first, then the US listing) for the reader to type.
  // First-users F22 (newcomer, runs 1-4): typing 애플 showed nothing until Enter. v58.80 run-5 (impatient #5, skeptic #10):
  // the native datalist filtered its options by their value (the symbol), so a Korean name hid every candidate. The
  // candidates are buttons under the box instead (the same chips as the no-match hint); Enter still opens the typed name.
  const tickerSearch = document?.querySelector?.('#ticker-direct-search');
  if (tickerSearch && !document.querySelector('#ticker-suggest')) {
    const list = document.createElement('div');
    list.id = 'ticker-suggest';
    list.className = 'ticker-search-picks';
    list.setAttribute('aria-label', '입력한 이름과 맞는 종목');
    (tickerSearch.parentElement || tickerSearch).insertAdjacentElement('afterend', list);
    let suggestTimer = null;
    tickerSearch.addEventListener('input', () => {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(() => {
        const query = tickerSearch.value.trim();
        const picks = query ? searchCandidates(query, { entries: window.AIO_TICKER_NAME_REGISTRY?.entries, krStockDb: window.KR_STOCK_DB, krToYahoo: window.krTickerToYahoo }).slice(0, 6) : [];
        list.replaceChildren(...picks.map((pick) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'q-chip';
          button.textContent = `${pick.label} · ${pick.symbol}`;
          button.addEventListener('click', () => { list.replaceChildren(); window.showTicker?.(pick.symbol); });
          return button;
        }));
      }, 120);
    });
    // A selection made within the 120 ms wait (typing, then Enter) also cancels the pending refill, which put the chosen
    // company's own candidate back under the box.
    for (const type of ['aio:tickerViewReset', 'aio:entityChanged']) document.addEventListener(type, () => { clearTimeout(suggestTimer); list.replaceChildren(); });
  }
  window._aioListingNameSuggestion = (raw) => {
    const query = String(raw || '').trim();
    if (query.length < 2) return Promise.resolve('');
    const picks = searchCandidates(query, { entries: window.AIO_TICKER_NAME_REGISTRY?.entries, krStockDb: window.KR_STOCK_DB, krToYahoo: window.krTickerToYahoo }).slice(0, 3);
    const listed = query.length >= 3 && /[A-Za-z]/.test(query) && picks.length < 3
      ? import('../data/us-listings.js').then(async (module) => module.searchUsListingNames(await module.loadUsListings(), query, { limit: 3 - picks.length, exclude: picks.map((pick) => pick.symbol), prefer: universeSymbols() })).catch(() => [])
      : Promise.resolve([]);
    // The refusal is not held for a slow listing download: after 3 seconds it shows without listing candidates.
    const timeout = new Promise((resolve) => setTimeout(() => resolve([]), 3000));
    return Promise.race([listed, timeout]).then((extra) => {
      const all = [...picks, ...extra];
      return all.length ? `회사명으로 찾은 후보: ${all.map((pick) => `${pick.symbol}(${pick.label})`).join(', ')}` : '';
    });
  };
  window._aioToastWithNameHint = (raw, message) => window._aioListingNameSuggestion(raw).catch(() => '')
    .then((hint) => window.showToast?.(hint ? `${message} ${hint}` : message));
  window._aioTickerSearchMiss = (raw) => {
    const input = document.getElementById('ticker-direct-search');
    const row = input?.parentElement;
    if (!row) { window.showToast?.('올바른 티커를 입력하세요.'); return; }
    let hint = document.getElementById('ticker-search-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'ticker-search-hint';
      hint.className = 'ticker-search-hint'; // src/ui/styles/entity-quality.css
      hint.setAttribute('role', 'status');
      row.insertAdjacentElement('afterend', hint);
      // v58.63 (architecture audit C01): clearing also retires the pending listing lookup, or a late answer for the
      // cleared query re-attached its candidates under an empty box.
      const clear = () => { hint.replaceChildren(); delete hint.dataset.listingQuery; };
      input.addEventListener('input', clear);
      document.addEventListener('aio:tickerViewReset', clear);
    }
    const query = String(raw || '').trim();
    const picks = searchCandidates(query, { entries: window.AIO_TICKER_NAME_REGISTRY?.entries, krStockDb: window.KR_STOCK_DB, krToYahoo: window.krTickerToYahoo });
    const lead = document.createElement('p');
    lead.textContent = query
      ? `'${query.slice(0, 40)}'${hasFinalConsonant(query.slice(0, 40)) ? '과' : '와'} 정확히 일치하는 종목이 없습니다. ${picks.length ? '아래에서 고르거나 티커·종목코드로 검색해 주세요.' : '티커(예: NVDA)·종목코드(예: 005930)·정확한 회사명으로 검색해 주세요.'}`
      : '티커·종목코드·회사명을 입력해 주세요.';
    // v58.80 (first-users F17 residual): the refusal sat above the previous stock's full analysis, which read as the
    // analysis of the typed symbol. The line now names whose analysis is still shown below.
    const shown = window._currentTickerId;
    if (shown && document.getElementById('page-ticker')?.classList.contains('active')) lead.textContent += ` 아래는 직전에 보던 ${window._currentTickerName && window._currentTickerName !== shown ? `${window._currentTickerName}(${shown})` : shown} 분석 그대로입니다.`;
    const list = document.createElement('div');
    list.className = 'ticker-search-picks';
    const addPick = (pick) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'q-chip';
      button.textContent = `${pick.label} · ${pick.symbol}${pick.exchange ? ` (${pick.exchange}${pick.etf ? ' ETF' : ''})` : ''}`;
      button.addEventListener('click', () => window.showTicker?.(pick.symbol));
      list.append(button);
    };
    picks.forEach(addPick);
    hint.replaceChildren(lead, ...(picks.length ? [list] : []));
    // v57.83 (owner 2026-10-16): a company name outside the name registry is searched in the US listing directory and
    // offered as candidates — the reader chooses; nothing is resolved automatically (R663). Loaded only on a miss.
    if (query.length >= 3 && /[A-Za-z]/.test(query) && picks.length < 6) {
      const token = (hint.dataset.listingQuery = query);
      import('../data/us-listings.js').then(async (module) => {
        const extra = module.searchUsListingNames(await module.loadUsListings(), query, { limit: 6 - picks.length, exclude: picks.map((pick) => pick.symbol), prefer: universeSymbols() });
        if (!extra.length || hint.dataset.listingQuery !== token || !hint.isConnected) return;
        extra.forEach(addPick);
        if (!picks.length) {
          lead.textContent = `'${query.slice(0, 40)}'${hasFinalConsonant(query.slice(0, 40)) ? '과' : '와'} 정확히 일치하는 종목은 없지만, 미국 상장 목록에서 이름이 비슷한 종목이 있습니다. 맞는 종목을 골라 주세요.`;
          hint.append(list);
        }
      }).catch(() => {});
    }
  };
  window._aioNewsStories = { key: newsArticleKey, group: groupNewsStories, isRevision: isNewsRevision,
    issuers: (row, candidates) => resolveNewsIssuers(row, candidates, window.AIO_TICKER_NAME_REGISTRY?.entries) };
  window._aioTickerDisplayName = (symbol) => tickerDisplayName(symbol, { krStockDb: window.KR_STOCK_DB });
  // P1326/R671: one currentness vocabulary (실시간/지연/종가/지난 시세) from observation times + US calendar.
  window._aioDescribeQuoteCurrentness = describeQuoteCurrentness;
  // P1327/R672: Korean theme names and ticker → theme membership have one owner; a KRX stock's theme links open the
  // Korean theme detail through src/ui/navigation/theme-detail.js.
  window.AIO_KR_THEME_LABELS = KR_THEME_LABELS;
  window.AIO_MA_STRUCTURE_LABELS = MA_STRUCTURE_LABELS; // v57.55 (C19 wiring): the legacy SPY card reads the same moving-average order names
  window.openKrThemeDetail = (themeId, { settle = false } = {}) => {
    if (!window.KR_THEME_MAP?.[themeId]) return false;
    // Screen audit 2026-10-20: from a stock page the detail was filled before the 테마 route mounted, and the mount closed
    // the fold around it — the reader landed at the top of 테마 with nothing open. Off the route, the id waits for the
    // themes page to mount (src/ui/pages/themes.js) and that page opens it.
    if (!document.getElementById('page-themes')?.classList.contains('active') && typeof window.showPage === 'function') {
      window._aioOpenKrThemeDetailOnThemes = themeId;
      window.showPage('themes');
      return true;
    }
    const section = document.getElementById('kr-integrated-themes');
    const details = section?.closest('details');
    if (details) details.open = true;
    if (typeof window.showKrThemeDetail === 'function') window.showKrThemeDetail(themeId);
    const panel = document.getElementById('kr-theme-detail-panel');
    const panelFold = panel?.closest('details'); // the detail sits in the live-quote fold (#kr-themes-live), not the list's
    if (panelFold) panelFold.open = true;
    if (panel) panel.scrollIntoView({ block: 'start', behavior: settle ? 'auto' : 'smooth' });
    // Right after the themes mount the sections above keep filling and push the panel down; place it once more.
    if (panel && settle) setTimeout(() => { if (document.getElementById('page-themes')?.classList.contains('active')) panel.scrollIntoView({ block: 'start' }); }, 700);
    return true;
  };
}
