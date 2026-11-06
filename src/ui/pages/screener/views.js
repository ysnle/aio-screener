// Screener views: 순위 / 사후 검증, and 보기 — one choice that sets the ranking weights and the table's columns together.
import { PROFILE_DESCRIPTIONS } from './model.js';

// v59.70 (S12): the five weight profiles and the column presets were two menus; 보기 is one. Each weight view shows the
// columns that weight reads (모멘텀 → the chart-trader columns, 가치 → the filing figures, 저리스크 → range and liquidity).
export const VIEW_PRESETS = Object.freeze({
  balanced: { label: '균형', columns: 'overview' },
  momentum: { label: '모멘텀', columns: 'discovery' },
  swing: { label: '스윙', columns: 'trend' },
  value: { label: '가치', columns: 'fundamentals' },
  lowrisk: { label: '저리스크', columns: 'risk' }
});

/** The 순위 / 사후 검증 views and the 보기 (weights + columns) choice. */
export function createViewsController(ctx) {
  const { documentRef, root, page, bag, visibleLimit, columnState, profileReader, onProfileChange } = ctx;
  // One route, two views (순위 · 사후 검증) on #page-screener[data-scr-view]. The tab panels keep their ids and hidden
  // state, so a link to 과거 검증 or 조건별 과거 통계 still lands on its panel.
  const VIEW_PANELS = Object.freeze({ rank: ['ranking'], validation: ['factors', 'backtest', 'evidence'] });
  const VIEW_TABS = [['scr-tab-button-ranking', 'rank'], ['scr-tab-button-backtest', 'validation']];
  ctx.setView = (view, { focusTab = false } = {}) => {
    const next = VIEW_PANELS[view] ? view : 'rank';
    page.dataset.scrView = next;
    ['ranking', 'factors', 'backtest', 'evidence'].forEach((tab) => {
      const panel = documentRef.getElementById(`scr-tab-${tab}`);
      if (panel) panel.hidden = !VIEW_PANELS[next].includes(tab);
    });
    for (const [id, value] of VIEW_TABS) {
      const button = documentRef.getElementById(id);
      if (!button) continue;
      const on = value === next;
      button.setAttribute('aria-selected', on ? 'true' : 'false');
      button.tabIndex = on ? 0 : -1;
      button.classList.toggle('is-active', on);
      if (on && focusTab) button.focus();
    }
    if (next !== 'rank') ctx.setPanel?.(null, false, { returnFocus: false });
    ctx.syncWhyMode();
  };
  const onViewKeydown = (event) => {
    const current = event.target.closest?.('.scr-view-seg [role="tab"]');
    if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const ids = VIEW_TABS.map(([id]) => id);
    const index = ids.indexOf(current.id);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
    ctx.setView(VIEW_TABS[nextIndex][1], { focusTab: true });
  };
  page.addEventListener('keydown', onViewKeydown);
  bag.add(() => page.removeEventListener('keydown', onViewKeydown));
  ctx.scrollToTop = () => {
    const content = documentRef.querySelector('.content');
    if (content && typeof content.scrollTo === 'function') content.scrollTo({ top: 0 });
    else if (content) content.scrollTop = 0;
    if (typeof root?.scrollTo === 'function' && (root.scrollY || 0) > 0) root.scrollTo(0, 0);
  };
  // The reader's pick holds for this visit even before the weight store answers; a new visit opens on the stored profile.
  let chosenView = null;
  const activeView = () => chosenView || (VIEW_PRESETS[profileReader()] ? profileReader() : 'balanced');
  ctx.setProfileButtons = () => {
    const active = activeView();
    page.querySelectorAll('[data-aio-screener-action="profile"]').forEach((button) => {
      const on = button.dataset.aioScreenerArg === active;
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const description = documentRef.getElementById('scr-profile-desc');
    if (description) description.textContent = PROFILE_DESCRIPTIONS[active] || PROFILE_DESCRIPTIONS.balanced;
    const label = documentRef.getElementById('scr-view-label');
    if (label) label.textContent = VIEW_PRESETS[active].label;
  };
  // The table reads the columns of the current 보기; a stored weight profile opens with its own columns.
  ctx.syncColumnControls = () => { columnState.preset = VIEW_PRESETS[activeView()].columns; columnState.custom = []; };
  ctx.actions.push((action, argument, actionNode) => {
    if (action === 'profile') {
      if (!VIEW_PRESETS[argument] || actionNode.disabled) return true;
      ++ctx.runGeneration; ctx.activeResult = null; ctx.activeRows = null; ctx.activePreview = null; ctx.activePreviewKey = null;
      root?._aioSetProfile?.(argument);
      chosenView = argument;
      columnState.preset = VIEW_PRESETS[argument].columns;
      visibleLimit.value = 12;
      // The columns change at once; the ranking follows when the new weights have been applied.
      ctx.rerender();
      Promise.resolve(onProfileChange?.(argument)).finally(ctx.rerender);
    } else if (action === 'tab') {
      // 랭킹 is the 순위 view; 팩터·과거 검증·조건별 통계 are sections of the one 사후 검증 view.
      const fromSeg = !!actionNode.closest('.scr-view-seg');
      ctx.setView(argument === 'ranking' ? 'rank' : 'validation', { focusTab: fromSeg });
      if (argument === 'factors' || argument === 'evidence') {
        const smooth = !root?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        documentRef.getElementById(`scr-tab-${argument}`)?.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
      } else if (!fromSeg) ctx.scrollToTop();
    } else if (action === 'view') {
      // The retired 맞춤 조건 view opens the + 조건 panel on the 순위 view instead.
      if (argument === 'custom') { ctx.setView('rank'); ctx.setPanel('scr-condition-panel', true); return true; }
      ctx.setView(argument, { focusTab: !!actionNode.closest('.scr-view-seg') });
      if (!actionNode.closest('.scr-view-seg')) ctx.scrollToTop();
    } else return false;
    return true;
  });
}
