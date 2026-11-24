import { renderHomeVix } from '../ui/components/home-vix.js';
import { renderNewsProgress } from '../ui/components/news-progress.js';
import * as newsControls from '../ui/components/news-controls.js';
import { setSectorPerfView } from '../ui/components/sector-perf-view.js';
import { setRRGView } from '../ui/components/rrg-view.js';
import { ensureKrThemeProgressive } from '../ui/components/kr-theme-progressive.js';
import { renderScreenerFmpStatus } from '../ui/components/screener-fmp-status.js';
import { organizeGuideChapters } from '../ui/components/guide-chapters.js';
import { createFundamentalSearch } from '../ui/components/fundamental-search.js';
import { installGlossaryModal } from '../ui/knowledge/glossary-modal.js';
import { bindRefreshProgress, createGlobalRefresh } from '../ui/components/refresh-progress.js';
import { createEarningsCalendar } from '../ui/components/earnings-calendar.js';
import { renderPipelineStatus, renderPublicReadiness } from '../ui/components/pipeline-status.js';

export function installLegacyScreenBridges(root, documentRef) {
  // The 한국 거시 기준일 badges (_aioRenderKrMacroFreshnessBadges) left with the 한국 거시 fold.
  const at = { documentRef, root };
  // 오늘: home VIX card (legacy snapshot apply and home refresh call this name).
  root._aioRenderHomeVix = (quote) => renderHomeVix({ documentRef, root, quote });
  root._aioRenderHomeVix();
  // 뉴스: collection progress; the last step fetchAllNews reported is painted now.
  root._aioRenderNewsProgress = (state, d) => renderNewsProgress({ documentRef: d || documentRef, state });
  root._aioRenderNewsProgress(root._aioNewsProgressState);
  // 뉴스: country/topic/telegram chips and the sort buttons.
  root.AIO = root.AIO || {};
  root.AIO.getNewsSurfaceControls = newsControls.getNewsSurfaceControls;
  root.filterNewsByCountry = (filter, el) => newsControls.filterNewsByCountry(filter, el, at);
  root.filterNewsByTopic = (filter, el) => newsControls.filterNewsByTopic(filter, el, at);
  root.filterNewsByTelegramOnly = (el) => newsControls.filterNewsByTelegramOnly(el, at);
  root.setNewsSortMode = (mode, el) => newsControls.setNewsSortMode(mode, el, at);
  // 테마 · 섹터: the 11섹터 / +세부 업종 toggle (themes.js draws the bars).
  root.setSectorPerfView = (view, el) => setSectorPerfView(view, el, at);
  // 테마 · 섹터: the RRG view pills (themes.js draws the scatter).
  root.setRRGView = (mode, el) => setRRGView(mode, el, at);
  // 테마 · 섹터: the 한국 테마 '테마 더 보기' toggle (initKoreaThemes calls it; idempotent).
  root._aioEnsureKrThemeProgressive = () => ensureKrThemeProgressive(at);
  root._aioEnsureKrThemeProgressive();
  // 포트폴리오 (백테스트 랩, 리스크 지표, 익스포저·스트레스, 관심 종목): only that route draws them, so their renderers (with
  // the risk readout and the return statistics) install from their own chunk when it is shown, or at once for automated
  // browsers, as the AI panel and the glossary do. A refresh asked before that is marked pending and repeated on install.
  let portfolioBridges = null;
  const loadPortfolioBridges = () => (portfolioBridges ||= import('./portfolio-screen-bridges.js')
    .then((m) => m.installPortfolioScreenBridges(root, documentRef))
    .catch(() => { portfolioBridges = null; }));
  if ((root.navigator?.webdriver && !root.__aioUserBoot) || documentRef.getElementById('page-portfolio')?.classList?.contains('active')) loadPortfolioBridges();
  // 도움말: the chapter layout (guide.js runs it on mount; the headless T869 test calls this name).
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
  // showPage dispatches aio:pageShown on the document without bubbling (js/aio-core.js), so a window listener never ran.
  documentRef.addEventListener?.('aio:pageShown', (e) => {
    const detail = e && e.detail;
    const pageId = typeof detail === 'string' ? detail : detail && (detail.pageId || detail.id || detail.route);
    if (pageId === 'home') root._aioSchedulePublicReadiness(100);
    if (pageId === 'portfolio') { loadPortfolioBridges(); root._aioLoadTechnicalEngine?.().catch(() => {}); } // its renderers and the risk engine load as 포트폴리오 opens
  });
  if (root._serverDataMeta) root._aioRenderPipelineStatus();
  root._aioSchedulePublicReadiness(1500);
  // 스크리너: the 재무 팩터 coverage note (_aioRenderPipelineStatus calls it; the last meta is painted now).
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
