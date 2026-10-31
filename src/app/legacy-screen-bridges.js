// Roadmap item 11 (legacy decomposition): screen code moved from js/aio-*.js to src/ keeps the window names that the
// legacy callers and js/aio-tests.js use. src/app/compatibility-globals.js loads this module lazily (outside the boot
// set) and installs them here; each renderer paints once on install for the calls that ran before it loaded.
import { renderKrMacroFreshnessBadges } from '../ui/components/macro-next-release.js';
import { renderHomeVix } from '../ui/components/home-vix.js';
import { renderNewsProgress } from '../ui/components/news-progress.js';
import * as newsControls from '../ui/components/news-controls.js';
import { setSectorPerfView } from '../ui/components/sector-perf-view.js';
import { setRRGView } from '../ui/components/rrg-view.js';
import { ensureKrThemeProgressive } from '../ui/components/kr-theme-progressive.js';
import { renderPortfolioExposure, renderPortfolioStress } from '../ui/components/portfolio-exposure.js';
import { renderPortfolioRiskMetrics, renderPortfolioRiskStatus } from '../ui/components/portfolio-risk-metrics.js';
import { renderScreenerFmpStatus } from '../ui/components/screener-fmp-status.js';
import { organizeGuideChapters } from '../ui/components/guide-chapters.js';
import { renderWatchlist, readWatchlistSelect, readWatchlistInputs, clearWatchlistInputs } from '../ui/components/portfolio-watchlist.js';
import { createFundamentalSearch, fundSearchQuick, renderFundRecentSearches, resetFundamentalReport } from '../ui/components/fundamental-search.js';
import { renderPortfolioBacktestLab, renderPortfolioBacktestStatus, varCertLabel } from '../ui/components/portfolio-backtest-lab.js';

export function installLegacyScreenBridges(root, documentRef) {
  // v58.85 거시 · 금리: 한국 거시 badges (v59.51: the header next-release line left for the board header).
  const at = { documentRef, root };
  root._aioRenderKrMacroFreshnessBadges = () => renderKrMacroFreshnessBadges(at);
  // v58.91 오늘: home VIX card (legacy snapshot apply and home refresh call this name).
  root._aioRenderHomeVix = (quote) => renderHomeVix({ documentRef, root, quote });
  root._aioRenderHomeVix();
  // v58.93 뉴스: collection progress; the last step fetchAllNews reported is painted now.
  root._aioRenderNewsProgress = (state, d) => renderNewsProgress({ documentRef: d || documentRef, state });
  root._aioRenderNewsProgress(root._aioNewsProgressState);
  // v58.92 뉴스: country/topic/telegram chips and the sort buttons.
  root.AIO = root.AIO || {};
  root.AIO.getNewsSurfaceControls = newsControls.getNewsSurfaceControls;
  root.filterNewsByCountry = (filter, el) => newsControls.filterNewsByCountry(filter, el, at);
  root.filterNewsByTopic = (filter, el) => newsControls.filterNewsByTopic(filter, el, at);
  root.filterNewsByTelegramOnly = (el) => newsControls.filterNewsByTelegramOnly(el, at);
  root.setNewsSortMode = (mode, el) => newsControls.setNewsSortMode(mode, el, at);
  // v58.95 테마 · 섹터: the 11섹터 / +세부 업종 toggle (themes.js draws the bars).
  root.setSectorPerfView = (view, el) => setSectorPerfView(view, el, at);
  // v58.97 테마 · 섹터: the RRG view pills (themes.js draws the scatter).
  root.setRRGView = (mode, el) => setRRGView(mode, el, at);
  // v58.99 테마 · 섹터: the 한국 테마 '테마 더 보기' toggle (initKoreaThemes calls it; idempotent).
  root._aioEnsureKrThemeProgressive = () => ensureKrThemeProgressive(at);
  root._aioEnsureKrThemeProgressive();
  // v59.03 포트폴리오: the 백테스트 랩 status line and result (runPortfolioBacktestLab reports after a click), VaR label.
  root._aioRenderPortfolioBacktestLab = (model) => renderPortfolioBacktestLab(model, at);
  root._aioRenderPortfolioBacktestStatus = (text, warn) => renderPortfolioBacktestStatus(text, warn, at);
  root._aioBtVarCertLabel = varCertLabel;
  // v59.04 포트폴리오: the 익스포저·집중도 and stress panels (refreshPortfolioRisk calls them).
  root._aioRenderPortfolioExposure = (positions, returnsMap) => renderPortfolioExposure(positions, returnsMap, at);
  root._aioRenderPortfolioStress = (positions, historyMap, commonDates) => renderPortfolioStress(positions, historyMap, commonDates, at);
  // v59.05 포트폴리오: the 리스크 지표 panel and its status lines; a refreshPortfolioRisk that ran before this module
  // loaded is repeated now.
  root._aioRenderPortfolioRiskStatus = (text, warn) => renderPortfolioRiskStatus(text, warn, at);
  root._aioRenderPortfolioRiskMetrics = (data) => renderPortfolioRiskMetrics(data, at);
  if (root._aioPortfolioRiskPending && typeof root.refreshPortfolioRisk === 'function') { root._aioPortfolioRiskPending = false; root.refreshPortfolioRisk(); }
  // v59.06 포트폴리오: the 관심 종목 리스트 view and the reads of its select and add inputs; a view refresh that ran
  // before this module loaded is repeated now.
  root._aioRenderWatchlist = (lists, activeId, mode) => renderWatchlist(lists, activeId, mode, at);
  root._aioReadWatchlistSelect = () => readWatchlistSelect(at);
  root._aioReadWatchlistInputs = () => readWatchlistInputs(at);
  root._aioClearWatchlistInputs = (typed) => clearWatchlistInputs(typed, at);
  if (root._aioWatchlistPending && typeof root.refreshWatchlistUI === 'function') { root._aioWatchlistPending = false; root.refreshWatchlistUI(); }
  // v59.07 도움말: the chapter layout (guide.js runs it on mount; the headless T869 test calls this name).
  root._aioOrganizeGuideChapters = () => { const page = documentRef.getElementById('page-guide'); if (page) organizeGuideChapters(documentRef, page); };
  // v59.08 스크리너: the 재무 팩터 coverage note (_aioRenderPipelineStatus calls it; the last meta is painted now).
  root._aioRenderScreenerFmpStatus = (meta) => renderScreenerFmpStatus(meta, at);
  if (root._aioScreenerFmpMeta) root._aioRenderScreenerFmpStatus(root._aioScreenerFmpMeta);
  // v59.12 종목 · 재무 공시: the search, its 최근 검색 chips and the report reset (moved from js/aio-chat.js); the list is
  // painted now and a search asked before this module loaded runs now.
  root.fundamentalSearch = createFundamentalSearch(at);
  root.fundSearchQuick = (ticker) => fundSearchQuick(ticker, root.fundamentalSearch, at);
  root._fundRecentSearches = (ticker) => renderFundRecentSearches(ticker, at);
  root._resetFundamentalReport = (message) => resetFundamentalReport(message, at);
  root._fundRecentSearches();
  if (root._aioFundSearchPending) { root._aioFundSearchPending = false; root.fundamentalSearch(); }
}
