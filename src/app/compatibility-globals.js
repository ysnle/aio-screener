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
import { isKnownSymbol, resolveRegisteredName, searchCandidates } from '../domain/ticker/resolve-name.js';
import { hasFinalConsonant } from '../domain/content/korean-particle.js';
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
import { normalizeTickerInput, tickerDisplayName } from '../domain/entity/ticker-symbol.js';
import { describeQuoteCurrentness } from '../domain/market/quote-currentness.js';
import { KR_THEME_LABELS, krThemesForSymbol } from '../domain/themes/kr-themes.js';
import { MA_STRUCTURE_LABELS } from '../domain/technical/stage.js';

export function installCompatibilityGlobals(root = globalThis) {
  const window = root;
  const document = root.document;
  window._aioPersonalProviderTransport = createPersonalProviderTransport({ fetch: (...args) => window.fetch(...args), localStorage: window.localStorage, _isQuotaExceeded: (...args) => window._isQuotaExceeded(...args), _bumpApiCounter: (...args) => window._bumpApiCounter(...args), _QUOTA_LIMITS: window._QUOTA_LIMITS });
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
  window._aioIsKnownTicker = (symbol) => isKnownSymbol(symbol, { entries: window.AIO_TICKER_NAME_REGISTRY?.entries, krStockDb: window.KR_STOCK_DB,
    universe: typeof window._aioGetCanonicalScreenerRows === 'function' ? window._aioGetCanonicalScreenerRows() || [] : [] });
  // v57.55 review (B4-F3): the cash box had a fixed "$" — a won amount read as dollars. The quick picker writes the same
  // cash-currency declaration as the settings field (one writer: savePortfolioAssumption).
  window._aioSaveCashCurrencyQuick = (el) => {
    const twin = document.getElementById('pf-cash-currency-input');
    if (twin) twin.value = el?.value || '';
    window.savePortfolioAssumption?.('pf-cash-currency-input', el?.value || '');
  };
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
    for (const pick of picks) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'q-chip';
      button.textContent = `${pick.label} · ${pick.symbol}`;
      button.addEventListener('click', () => window.showTicker?.(pick.symbol));
      list.append(button);
    }
    hint.replaceChildren(lead, ...(picks.length ? [list] : []));
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
