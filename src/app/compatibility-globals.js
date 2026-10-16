// v57.62 structure: the classic-shell window.* bridge, moved out of src/app/bootstrap.js unchanged. bootstrap calls
// installCompatibilityGlobals(window) at the same point of boot; `window`/`document` below are the passed root so the
// assignments read exactly as they did in bootstrap (gates match these lines).
import { installGlossaryBridge } from '../ui/knowledge/glossary-bridge.js';
import { createPersonalProviderTransport } from '../data/providers/personal-transport.js';
import { describeSharedConnection } from '../domain/connections/shared.js';
import { formatSecResearchEvidence } from '../ai/context/sec-fundamentals.js';
import { buildMarketContentContext, buildQuestionDomainContext } from '../ai/context/market-content.js';
import { renderAnswerVisuals, chooseAnswerVisuals, attachAnswerVisuals } from '../ui/components/ai-answer-visuals.js';
import { chooseAnswerMode, answerModeGuide } from '../ai/response/answer-modes.js';
import { buildAnswerPrinciples, describeAnswerVisuals, promptWithoutWebSearch } from '../ai/response/answer-principles.js';
import { buildChatPolicyLines } from '../ai/context/policy-lines.js';
import { resolveChatTickers } from '../ai/entity/chat-tickers.js';
import { selectNativeSearch, attachNativeSearch, hasInternalCurrentEvidence } from '../ai/research/native-search.js';
import { isKnownSymbol, resolveHoldingInput, resolveRegisteredName, searchCandidates } from '../domain/ticker/resolve-name.js';
import { hasFinalConsonant } from '../domain/content/korean-particle.js';
import { isListedUsSymbol, usListingSymbol } from '../data/us-listings.js';
import { stripEvidenceIds } from '../domain/briefing/evidence-text.js';
import { releaseAtMs } from '../domain/briefing/schedule.js';
import { groupNewsStories, isNewsRevision, newsArticleKey, resolveNewsIssuers } from '../domain/news/stories.js';
// Portfolio statistics/backtest is a native ESM module; importing it during
// bootstrap keeps the classic regression surface available before lazy route
// navigation while leaving the implementation out of aio-core.js.
import { buildPortfolioBacktestLab, _statMean, _statStdDev, _calcDailyReturns, _quantileR7, _calcSharpe, _calcMaxDrawdown, _pearsonCorr, _calcCorrelationMatrix } from '../domain/portfolio/backtest.js';
import { createCompositionSnapshot, deriveRiskEstimate, assessAccountPerformance } from '../domain/portfolio/risk.js';
import { PORTFOLIO_ASSUMPTION_KEYS, EXPOSURE_PATHS, REBALANCE_POLICIES, normalizeCurrencyCode, normalizeAnnualRate, normalizeExposurePath, normalizeRebalancePolicy, readPortfolioAssumptions } from '../data/portfolio-assumptions.js';
import { LEDGER_COVERAGE_INPUTS, appendLedgerTransaction, appendLedgerValuation, ledgerCoverageState, normalizeLedger, removeLedgerEntry as removeLedgerEntryFromLedger, setLedgerCoverage as setLedgerCoverageOnLedger, setLedgerFlowTiming as setLedgerFlowTimingOnLedger } from '../data/portfolio-ledger.js';
import { FX_LEG_MAX_AGE_MS, appendFxLeg, fxLegsState, normalizeFxLegs, removeFxLeg } from '../domain/portfolio/fx.js';
import { applyFxPanel, applyLedgerPanel, clearDeclaredFields, readDeclaredFields, showDeclarationStatus } from '../ui/panels/portfolio-declarations.js';
import { assembleRiskEstimateInput } from '../ui/panels/portfolio-risk-input.js';
import { baseValueRows, baseValueNote } from '../ui/panels/portfolio-base-values.js';
import { createDeclarationsStore } from '../data/portfolio-declarations-store.js';
import { BACKUP_SECTIONS, buildPortfolioBackup, describeBackupCounts, parsePortfolioBackup } from '../data/portfolio-backup.js';
import { CASH_INPUT_CURRENCIES, PORTFOLIO_CASH_KEY, LEGACY_CASH_KEY, readCashBalances, setCashBalance, writeCashBalances } from '../data/portfolio-cash.js';
import { appUsdKrwClose } from '../domain/portfolio/cash.js';
import { normalizeTickerInput, tickerDisplayName } from '../domain/entity/ticker-symbol.js';
import { describeQuoteCurrentness } from '../domain/market/quote-currentness.js';
import { KR_THEME_LABELS, krThemesForSymbol } from '../domain/themes/kr-themes.js';
import { MA_STRUCTURE_LABELS } from '../domain/technical/stage.js';

export function installCompatibilityGlobals(root = globalThis) {
  const window = root;
  const document = root.document;
  window._aioPersonalProviderTransport = createPersonalProviderTransport({ fetch: (...args) => window.fetch(...args) });
  window._statMean = _statMean;
  window._statStdDev = _statStdDev;
  window._calcDailyReturns = _calcDailyReturns;
  window._quantileR7 = _quantileR7;
  window._calcSharpe = _calcSharpe;
  window._calcMaxDrawdown = _calcMaxDrawdown;
  window._pearsonCorr = _pearsonCorr;
  window._calcCorrelationMatrix = _calcCorrelationMatrix;
  window.AIO = window.AIO || {};
  window.AIO.describeSharedConnection = describeSharedConnection;
  window.AIO.formatSecResearchEvidence = formatSecResearchEvidence;
  window.AIO.buildMarketContentContext = buildMarketContentContext;
  window.AIO.buildQuestionDomainContext = buildQuestionDomainContext;
  window.AIO.renderAnswerVisuals = renderAnswerVisuals; // P1741: data-drawn figures under an AI answer
  window.AIO.chooseAnswerVisuals = chooseAnswerVisuals;
window.AIO.attachAnswerVisuals = attachAnswerVisuals;
// P1740: chat prompt pieces moved out of js/aio-chat.js (answer shape, principles, policy lines, ticker resolver).
Object.assign(window.AIO, { chooseAnswerMode, answerModeGuide, buildAnswerPrinciples, describeAnswerVisuals, promptWithoutWebSearch, buildChatPolicyLines, resolveChatTickers });
  window.AIO.selectNativeSearch = selectNativeSearch;
  window.AIO.attachNativeSearch = attachNativeSearch;
  window.AIO.hasInternalCurrentEvidence = hasInternalCurrentEvidence;
  window.AIO.buildPortfolioBacktestLab = buildPortfolioBacktestLab;
  window._aioBuildPortfolioBacktestLab = buildPortfolioBacktestLab;
  // 22 W22-I/W22-J (E4): the risk/performance surfaces consume the declared
  // domain contract — composition snapshot, risk path, account-performance hold.
  window._pfCreateCompositionSnapshot = createCompositionSnapshot;
  window._pfDeriveRiskEstimate = deriveRiskEstimate;
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
    // The inputs the screener's own ranking run uses (js/aio-data.js _aioComputeFactorRanks).
    rankInputs: () => {
      const weights = typeof window._aioFactorWeights === 'function' ? window._aioFactorWeights(window.AIO?.marketState) : null;
      const server = window._aioServerScreener || {};
      return { weights: weights?.weights || null, weightsPolicy: weights?.source === 'explicit-user-profile' ? 'explicit' : 'model-default',
        regimeLabel: weights?.regimeLabel || null, fundamentalCoveragePct: Number(server.fundamentalCoveragePct || 0), fmpOk: !!server.fmpOk };
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
  window._aioCheckListedSymbol = checkListed;
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
  window._aioSaveCashBalance = (el) => {
    const currency = el?.dataset?.currency;
    if (!currency) return;
    const next = setCashBalance(readCashBalances(window.localStorage).balances, currency, el.value);
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
  window._aioUsListingSymbol = (symbol) => usListingSymbol(symbol);
  window._aioTickerSearchMiss = (raw) => {
    const input = document.getElementById('ticker-direct-search');
    const row = input?.parentElement;
    if (!row) { window.showToast?.('올바른 티커를 입력하세요.'); return; }
    let hint = document.getElementById('ticker-search-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'ticker-search-hint';
      hint.className = 'ticker-search-hint';
      hint.style.cssText = 'margin:-4px 0 12px;font-size:13px;line-height:1.6;color:var(--text-secondary);display:grid;gap:6px;';
      hint.setAttribute('role', 'status');
      row.insertAdjacentElement('afterend', hint);
      const clear = () => hint.replaceChildren();
      input.addEventListener('input', clear);
      document.addEventListener('aio:tickerViewReset', clear);
    }
    const query = String(raw || '').trim();
    const picks = searchCandidates(query, { entries: window.AIO_TICKER_NAME_REGISTRY?.entries, krStockDb: window.KR_STOCK_DB, krToYahoo: window.krTickerToYahoo });
    const lead = document.createElement('p');
    lead.textContent = query
      ? `'${query.slice(0, 40)}'${hasFinalConsonant(query.slice(0, 40)) ? '과' : '와'} 정확히 일치하는 종목이 없습니다. ${picks.length ? '아래에서 고르거나 티커·종목코드로 검색해 주세요.' : '티커(예: NVDA)·종목코드(예: 005930)·정확한 회사명으로 검색해 주세요.'}`
      : '티커·종목코드·회사명을 입력해 주세요.';
    const list = document.createElement('div');
    list.className = 'ticker-search-picks';
    list.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
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
        const extra = module.searchUsListingNames(await module.loadUsListings(), query, { limit: 6 - picks.length, exclude: picks.map((pick) => pick.symbol) });
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
  // P1327/R672: Korean theme names and ticker → theme membership have one owner; the ticker
  // overview links a KRX stock to its themes and opens the theme detail on the themes page.
  window.AIO_KR_THEME_LABELS = KR_THEME_LABELS;
  window.AIO_MA_STRUCTURE_LABELS = MA_STRUCTURE_LABELS; // v57.55 (C19 wiring): the legacy SPY card reads the same moving-average order names
  window._aioKrThemesForSymbol = (symbol) => krThemesForSymbol(symbol, window.KR_THEME_MAP);
  window.openKrThemeDetail = (themeId) => {
    if (!window.KR_THEME_MAP?.[themeId]) return false;
    if (typeof window.showPage === 'function') window.showPage('themes');
    const section = document.getElementById('kr-integrated-themes');
    const details = section?.closest('details');
    if (details) details.open = true;
    if (typeof window.showKrThemeDetail === 'function') window.showKrThemeDetail(themeId);
    const panel = document.getElementById('kr-theme-detail-panel');
    if (panel) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return true;
  };
}
