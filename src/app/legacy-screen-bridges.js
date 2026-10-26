// Roadmap item 11 (legacy decomposition): screen code moved from js/aio-*.js to src/ keeps the window names that the
// legacy callers and js/aio-tests.js use. src/app/compatibility-globals.js loads this module lazily (outside the boot
// set) and installs them here; each renderer paints once on install for the calls that ran before it loaded.
import { renderMacroNextRelease, renderKrMacroFreshnessBadges } from '../ui/components/macro-next-release.js';
import { renderHomeVix } from '../ui/components/home-vix.js';
import { renderHomeActionPlan } from '../ui/components/home-action-plan.js';
import { renderNewsProgress } from '../ui/components/news-progress.js';
import * as newsControls from '../ui/components/news-controls.js';
import { setSectorPerfView } from '../ui/components/sector-perf-view.js';
import { setRRGView } from '../ui/components/rrg-view.js';

export function installLegacyScreenBridges(root, documentRef) {
  // v58.85 거시 · 금리: header next-release line and 한국 거시 badges.
  const at = { documentRef, root };
  if (root.AIO) root.AIO.renderMacroNextRelease = () => renderMacroNextRelease(at);
  root._aioRenderKrMacroFreshnessBadges = () => renderKrMacroFreshnessBadges(at);
  // v58.91 오늘: home VIX card (legacy snapshot apply and home refresh call this name).
  root._aioRenderHomeVix = (quote) => renderHomeVix({ documentRef, root, quote });
  root._aioRenderHomeVix();
  // v58.94 오늘: home 행동 계획 lines; a stub document can be passed (T816).
  root._aioRefreshActionPlan = (d) => renderHomeActionPlan({ documentRef: d?.getElementById ? d : documentRef, root });
  root._aioRefreshActionPlan();
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
  // v58.96 테마 · 섹터: the RRG view pills (themes.js draws the scatter).
  root.setRRGView = (mode, el) => setRRGView(mode, el, at);
}
