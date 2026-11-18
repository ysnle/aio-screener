// 포트폴리오's window names for js/aio-workspace.js (the 백테스트 랩, 리스크 지표, 익스포저·스트레스 and 관심 종목 views, and the
// ledger, declaration, risk-input and backup contracts those panels use).
// Only the portfolio route draws them, so src/app/legacy-screen-bridges.js installs this chunk when that route is shown,
// not in every route's post-boot window (it carried the risk readout and the return statistics with it). The workspace
// callers check for these names and mark a pending refresh; the refreshes that ran before the install are repeated here.
import { renderPortfolioRiskHold, renderPortfolioRiskMetrics, renderPortfolioRiskStatus } from '../ui/components/portfolio-risk-metrics.js';
import { renderWatchlist, readWatchlistSelect, readWatchlistInputs, clearWatchlistInputs } from '../ui/components/portfolio-watchlist.js';
import { renderPortfolioBacktestLab, renderPortfolioBacktestStatus, varCertLabel } from '../ui/components/portfolio-backtest-lab.js';
import { assessAccountPerformance } from '../domain/portfolio/risk.js';
import { normalizeCurrencyCode, normalizeAnnualRate, normalizeExposurePath, normalizeRebalancePolicy } from '../data/portfolio-assumptions.js';
import { LEDGER_COVERAGE_INPUTS, appendLedgerTransaction, appendLedgerValuation, ledgerCoverageState, normalizeLedger, removeLedgerEntry, setLedgerCoverage, setLedgerFlowTiming } from '../data/portfolio-ledger.js';
import { normalizeFxLegs } from '../domain/portfolio/fx.js';
import { mergeDuplicatePositions } from '../domain/portfolio/holding-merge.js';
import { applyFxPanel, applyLedgerPanel, clearDeclaredFields, readDeclaredFields, showDeclarationStatus } from '../ui/panels/portfolio-declarations.js';
import { assembleRiskEstimateInput } from '../ui/panels/portfolio-risk-input.js';
import { baseValueRows, baseValueNote } from '../ui/panels/portfolio-base-values.js';
import { BACKUP_SECTIONS, backupReminder, buildPortfolioBackup, describeBackupCounts, parsePortfolioBackup } from '../data/portfolio-backup.js';

// The 포트폴리오-only contracts js/aio-workspace.js reads by window name: the risk input assembly, the account ledger and its
// performance, the declaration panels, the base-currency values and the personal backup bundle. Each workspace caller
// checks the name first, so a call before this install draws nothing and the install repaints the page
// (installPortfolioScreenBridges below).
function installPortfolioPanelGlobals(root, documentRef) {
  root._pfAssembleRiskEstimateInput = assembleRiskEstimateInput;
  root._pfBaseValues = (positions) => baseValueRows(root._aioPortfolioSurface || null, positions);
  root._pfBaseNote = baseValueNote;
  root._pfAssessAccountPerformance = assessAccountPerformance;
  root._pfPortfolioLedger = {
    inputs: LEDGER_COVERAGE_INPUTS,
    normalize: normalizeLedger,
    appendTransaction: appendLedgerTransaction,
    appendValuation: appendLedgerValuation,
    remove: removeLedgerEntry,
    setCoverage: setLedgerCoverage,
    setFlowTiming: setLedgerFlowTiming,
    coverageState: ledgerCoverageState
  };
  root._pfDeclarationPanels = { applyLedgerPanel, applyFxPanel, showDeclarationStatus, readDeclaredFields, clearDeclaredFields };
  // Section normalisation reuses each section's owner (ledger, FX, assumptions); an import lists each ticker once.
  const backupDeps = {
    normalizeLedger,
    normalizeFxLegs,
    assumptionKinds: { baseCurrency: 'currency', cashCurrency: 'currency', cashReturn: 'rate', riskFreeRate: 'rate', exposurePath: 'path', rebalancePolicy: 'policy' },
    assumptionNormalizers: { currency: normalizeCurrencyCode, rate: normalizeAnnualRate, path: normalizeExposurePath, policy: normalizeRebalancePolicy },
    mergePositions: mergeDuplicatePositions
  };
  root._pfPortfolioBackup = {
    sections: BACKUP_SECTIONS,
    build: buildPortfolioBackup,
    describe: describeBackupCounts,
    renderReminder(holdingCount) {
      const el = documentRef.getElementById('pf-backup-reminder');
      if (!el) return;
      let last = null;
      try { last = root.localStorage.getItem('aio_last_backup_at'); } catch (_) {}
      const reminder = backupReminder({ lastBackupAt: last, holdingCount });
      el.hidden = !reminder;
      el.textContent = reminder ? reminder.text : '';
    },
    parse: (text) => parsePortfolioBackup(text, backupDeps)
  };
}

export function installPortfolioScreenBridges(root, documentRef) {
  const at = { documentRef, root };
  installPortfolioPanelGlobals(root, documentRef);
  // A render that ran before the install left the ledger, FX and backup-reminder panels empty; the page paints them now.
  if (documentRef.getElementById('page-portfolio')?.classList?.contains('active')) { try { root.renderPortfolio?.(); } catch (_) {} }
  // The 백테스트 랩 status line and result (runPortfolioBacktestLab reports after a click), VaR label.
  root._aioRenderPortfolioBacktestLab = (model) => renderPortfolioBacktestLab(model, at);
  root._aioRenderPortfolioBacktestStatus = (text, warn) => renderPortfolioBacktestStatus(text, warn, at);
  root._aioBtVarCertLabel = varCertLabel;
  // The 익스포저·집중도 and stress panels (refreshPortfolioRisk calls them); their renderer and its concentration
  // reading load on the first call.
  const exposure = () => import('../ui/components/portfolio-exposure.js');
  const drawLater = (draw) => { exposure().then(draw).catch(() => {}); };
  root._aioRenderPortfolioExposure = (positions, returnsMap, corrRes = null) => drawLater((m) => m.renderPortfolioExposure(positions, returnsMap, { ...at, corrRes }));
  root._aioRenderPortfolioStress = (positions, historyMap, commonDates) => drawLater((m) => m.renderPortfolioStress(positions, historyMap, commonDates, at));
  // The 리스크 지표 panel and its status lines.
  root._aioRenderPortfolioRiskStatus = (text, warn) => renderPortfolioRiskStatus(text, warn, at);
  root._aioRenderPortfolioRiskHold = (hold) => renderPortfolioRiskHold(hold, at);
  root._aioRenderPortfolioRiskMetrics = (data) => renderPortfolioRiskMetrics(data, at);
  if (root._aioPortfolioRiskPending && typeof root.refreshPortfolioRisk === 'function') { root._aioPortfolioRiskPending = false; root.refreshPortfolioRisk(); }
  // The 관심 종목 리스트 view and the reads of its select and add inputs.
  root._aioRenderWatchlist = (lists, activeId, mode) => renderWatchlist(lists, activeId, mode, at);
  root._aioReadWatchlistSelect = () => readWatchlistSelect(at);
  root._aioReadWatchlistInputs = () => readWatchlistInputs(at);
  root._aioClearWatchlistInputs = (typed) => clearWatchlistInputs(typed, at);
  if (root._aioWatchlistPending && typeof root.refreshWatchlistUI === 'function') { root._aioWatchlistPending = false; root.refreshWatchlistUI(); }
}
