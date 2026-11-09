// Roadmap item 11 (legacy decomposition): screen code moved from js/aio-*.js to src/ keeps the window names that the
// legacy callers and js/aio-tests.js use. src/app/compatibility-globals.js loads this module lazily (outside the boot
// set) and installs them here; each renderer paints once on install for the calls that ran before it loaded.
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
import { createFundamentalSearch } from '../ui/components/fundamental-search.js';
import { installGlossaryModal } from '../ui/knowledge/glossary-modal.js';
import { bindRefreshProgress, createGlobalRefresh } from '../ui/components/refresh-progress.js';
import { createEarningsCalendar } from '../ui/components/earnings-calendar.js';
import { renderPortfolioBacktestLab, renderPortfolioBacktestStatus, varCertLabel } from '../ui/components/portfolio-backtest-lab.js';
import * as returnStats from '../domain/portfolio/return-stats.js';
import { technicalSnapshot, extensionHeat } from '../domain/technical/snapshot.js';
import { sellPressure, positionTechnicalRisk, portfolioTechnicalRisk } from '../domain/portfolio/technical-risk.js';
import { renderPipelineStatus, renderPublicReadiness } from '../ui/components/pipeline-status.js';

export function installLegacyScreenBridges(root, documentRef) {
  // v59.70 (D5): the 한국 거시 기준일 badges (_aioRenderKrMacroFreshnessBadges) left with the 한국 거시 fold.
  const at = { documentRef, root };
  // 포트폴리오: the return statistics (refreshPortfolioRisk) and the technical engine
  // (refreshPortfolioTechnicalRisk, js/aio-tests.js) that js/aio-core.js used to keep as copies. Both callers run after a
  // network wait, long after this module has loaded; before it the names are absent and the callers' typeof guards hold.
  for (const name of ['_statMean', '_statStdDev', '_calcDailyReturns', '_quantileR7', '_calcPortfolioVaR', '_calcSharpe', '_calcMaxDrawdown', '_pearsonCorr', '_calcCorrelationMatrix']) root[name] = returnStats[name];
  Object.assign(root, {
    calcTechnicalSnapshot: technicalSnapshot,
    calcExtensionHeat: extensionHeat,
    calcSellPressure: sellPressure,
    calcPositionTechnicalRisk: positionTechnicalRisk,
    calcPortfolioTechnicalRisk: portfolioTechnicalRisk
  });
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
  root._aioRenderPortfolioExposure = (positions, returnsMap, corrRes = null) => renderPortfolioExposure(positions, returnsMap, { ...at, corrRes });
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
  // 오늘: the 데이터 파이프라인 상태 bar and the developer-mode 공개 준비 panel (src/ui/components/pipeline-status.js).
  // The server data loader calls _aioRenderPipelineStatus after each data.json apply; a load before this install is
  // painted now from the stored meta.
  const staleDaysFallback = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  root._aioRenderPipelineStatus = () => {
    const meta = root._serverDataMeta || null;
    let universeStale = false;
    try { universeStale = root.AIO_ARCH?.getScreenerState?.('metadata.universeFreshnessStatus') === 'stale'; } catch (_) { universeStale = false; }
    renderPipelineStatus({
      documentRef, meta, universeStale,
      fieldTs: root.DATA_SNAPSHOT?._fieldTs || null,
      staleDays: typeof root._aioStaleDays === 'function' ? root._aioStaleDays : staleDaysFallback,
      log: typeof root._aioLog === 'function' ? root._aioLog : null
    });
    if (meta) {
      // The 스크리너 재무 팩터 coverage note reads the same meta.
      root._aioScreenerFmpMeta = meta;
      root._aioRenderScreenerFmpStatus?.(meta);
      root._aioSchedulePublicReadiness(250);
    }
  };
  root._aioRenderPublicReadiness = () => {
    if (typeof root._aioBuildPublicShareReadiness !== 'function') return;
    try { renderPublicReadiness({ documentRef, readiness: root._aioBuildPublicShareReadiness, pageText: root._aioPublicReadinessPageText, sourceText: root._aioPublicReadinessSourceText }); } catch (_) { /* a diagnostics panel never breaks a page */ }
  };
  let readinessTimer = 0;
  root._aioSchedulePublicReadiness = (delay) => {
    root.clearTimeout(readinessTimer);
    readinessTimer = root.setTimeout(() => { readinessTimer = 0; root._aioRenderPublicReadiness(); }, Math.max(0, Number(delay) || 0));
  };
  root.addEventListener?.('aio:liveQuotes', () => root._aioSchedulePublicReadiness(250));
  root.addEventListener?.('aio:pageShown', (e) => {
    const detail = e && e.detail;
    const pageId = typeof detail === 'string' ? detail : detail && (detail.pageId || detail.id || detail.route);
    if (pageId === 'home') root._aioSchedulePublicReadiness(100);
  });
  if (root._serverDataMeta) root._aioRenderPipelineStatus();
  root._aioSchedulePublicReadiness(1500);
  // v59.08 스크리너: the 재무 팩터 coverage note (_aioRenderPipelineStatus calls it; the last meta is painted now).
  root._aioRenderScreenerFmpStatus = (meta) => renderScreenerFmpStatus(meta, at);
  if (root._aioScreenerFmpMeta) root._aioRenderScreenerFmpStatus(root._aioScreenerFmpMeta);
  // v59.12 → v59.52: the native entity slice consumes this selection hand-off; a request made before loading runs now.
  root.fundamentalSearch = createFundamentalSearch(at);
  if (root._aioFundSearchPending) { root._aioFundSearchPending = false; root.fundamentalSearch(); }
  // Roadmap 11 용어 사전: the modal opener, its renderers and the close/category/search handlers (js/aio-ui.js, js/aio-core.js).
  installGlossaryModal(root, documentRef);
  // Roadmap 11 shell: the refresh progress panel and topbar button text (js/aio-ui.js); every scheduler event carries the
  // whole run state, so events before this install are not needed.
  bindRefreshProgress({ root, documentRef });
  root.globalRefresh = createGlobalRefresh({ root, documentRef });
  // Roadmap 11 종목 · 실적 일정: the weekly earnings calendar and its 이전/이번주/다음 buttons (js/aio-pages.js).
  const earningsCalendar = createEarningsCalendar({ root, documentRef });
  root.loadEarningsCalendar = earningsCalendar.load;
  root._aioEarnCalWeekShift = earningsCalendar.shiftWeek;
  if (root._aioEarnCalPending) { root._aioEarnCalPending = false; earningsCalendar.load(); }
}
