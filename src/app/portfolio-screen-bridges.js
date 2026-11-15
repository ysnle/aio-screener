// 포트폴리오's window names for js/aio-workspace.js (the 백테스트 랩, 리스크 지표, 익스포저·스트레스 and 관심 종목 views).
// Only the portfolio route draws them, so src/app/legacy-screen-bridges.js installs this chunk when that route is shown,
// not in every route's post-boot window (it carried the risk readout and the return statistics with it). The workspace
// callers check for these names and mark a pending refresh; the refreshes that ran before the install are repeated here.
import { renderPortfolioRiskMetrics, renderPortfolioRiskStatus } from '../ui/components/portfolio-risk-metrics.js';
import { renderWatchlist, readWatchlistSelect, readWatchlistInputs, clearWatchlistInputs } from '../ui/components/portfolio-watchlist.js';
import { renderPortfolioBacktestLab, renderPortfolioBacktestStatus, varCertLabel } from '../ui/components/portfolio-backtest-lab.js';

export function installPortfolioScreenBridges(root, documentRef) {
  const at = { documentRef, root };
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
  root._aioRenderPortfolioRiskMetrics = (data) => renderPortfolioRiskMetrics(data, at);
  if (root._aioPortfolioRiskPending && typeof root.refreshPortfolioRisk === 'function') { root._aioPortfolioRiskPending = false; root.refreshPortfolioRisk(); }
  // The 관심 종목 리스트 view and the reads of its select and add inputs.
  root._aioRenderWatchlist = (lists, activeId, mode) => renderWatchlist(lists, activeId, mode, at);
  root._aioReadWatchlistSelect = () => readWatchlistSelect(at);
  root._aioReadWatchlistInputs = () => readWatchlistInputs(at);
  root._aioClearWatchlistInputs = (typed) => clearWatchlistInputs(typed, at);
  if (root._aioWatchlistPending && typeof root.refreshWatchlistUI === 'function') { root._aioWatchlistPending = false; root.refreshWatchlistUI(); }
}
