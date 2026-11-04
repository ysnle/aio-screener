// Screener views: 순위 / 사후 검증, weight profiles and visible columns.
import { PROFILE_DESCRIPTIONS, SCREENER_COLUMN_REGISTRY } from './model.js';
import { getVisibleColumns } from './table.js';
function renderColumnChooser(documentRef, page, columnPreset, customColumns, onChange) {
  const chooser = documentRef.getElementById('scr-column-chooser');
  if (!chooser) return;
  const list = documentRef.getElementById('scr-column-chooser-list');
  if (!list) return;
  list.replaceChildren();
  SCREENER_COLUMN_REGISTRY.forEach((column) => {
    const label = documentRef.createElement('label');
    label.className = 'scr-column-choice';
    const checkbox = documentRef.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = (columnPreset === 'custom' ? customColumns : getVisibleColumns(columnPreset).map((item) => item.key)).includes(column.key);
    checkbox.dataset.aioScreenerColumn = column.key;
    checkbox.addEventListener('change', () => {
      const next = new Set(columnPreset === 'custom' ? customColumns : getVisibleColumns(columnPreset).map((item) => item.key));
      if (checkbox.checked) next.add(column.key); else next.delete(column.key);
      if (!next.has('sym')) next.add('sym');
      onChange?.([...next]);
    });
    const name = documentRef.createElement('span');
    name.textContent = column.label;
    label.append(checkbox, name);
    list.appendChild(label);
  });
  if (chooser.dataset.aioInitialized !== 'true') {
    chooser.hidden = true;
    chooser.dataset.aioInitialized = 'true';
  }
}

/** The 순위 / 사후 검증 views, weight profile and visible columns. */
export function createViewsController(ctx) {
  const { documentRef, root, store, page, bag, workbench, sortState, visibleLimit, columnState, selectedSymbols, compareSymbols, liveReader, watchlistReader, profileReader, onWatchlistToggle, onProfileChange, onUniverseScopeChange } = ctx;
       // 개편 v2: one route, three views (순위 · 사후 검증 · 맞춤 조건) on #page-screener[data-scr-view]. The tab panels keep
       // their ids and hidden state, so a link to 과거 검증 or 조건별 과거 통계 still lands on its panel.
       const VIEW_PANELS = Object.freeze({ rank: ['ranking'], validation: ['factors', 'backtest', 'evidence'], custom: [] });
       const VIEW_TABS = [['scr-tab-button-ranking', 'rank'], ['scr-tab-button-backtest', 'validation'], ['scr-view-button-custom', 'custom']];
       ctx.setView = (view, { focusTab = false } = {}) => {
         const next = VIEW_PANELS[view] ? view : 'rank';
         page.dataset.scrView = next;
         ['ranking', 'factors', 'backtest', 'evidence'].forEach((tab) => {
           const panel = documentRef.getElementById(`scr-tab-${tab}`);
           if (panel) panel.hidden = !VIEW_PANELS[next].includes(tab);
         });
         const workbenchNode = documentRef.getElementById('screener-workbench');
         if (workbenchNode) workbenchNode.hidden = next !== 'custom';
         for (const [id, value] of VIEW_TABS) {
           const button = documentRef.getElementById(id);
           if (!button) continue;
           const on = value === next;
           button.setAttribute('aria-selected', on ? 'true' : 'false');
           button.tabIndex = on ? 0 : -1;
           button.classList.toggle('is-active', on);
           if (on && focusTab) button.focus();
         }
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
       // The folded builder (조건 직접 조합 · 실행 기록) belongs to 맞춤 조건; opening it from anywhere shows that view.
       const onFoldToggle = (event) => {
         if (event.target?.id === 'scr-workbench-advanced' && event.target.open && page.dataset.scrView !== 'custom') ctx.setView('custom');
       };
       page.addEventListener('keydown', onViewKeydown);
       page.addEventListener('toggle', onFoldToggle, true);
       bag.add(() => { page.removeEventListener('keydown', onViewKeydown); page.removeEventListener('toggle', onFoldToggle, true); });
       ctx.scrollToTop = () => {
         const content = documentRef.querySelector('.content');
         if (content && typeof content.scrollTo === 'function') content.scrollTo({ top: 0 });
         else if (content) content.scrollTop = 0;
         if (typeof root?.scrollTo === 'function' && (root.scrollY || 0) > 0) root.scrollTo(0, 0);
       };
       ctx.setProfileButtons = () => {
        const active = profileReader();
        page.querySelectorAll('[data-aio-screener-action="profile"]').forEach((button) => {
          button.classList.toggle('active', button.dataset.aioScreenerArg === active);
        });
        const description = documentRef.getElementById('scr-profile-desc');
        if (description) description.textContent = PROFILE_DESCRIPTIONS[active] || PROFILE_DESCRIPTIONS.balanced;
      };
       // P1592 (F09): the preset select, the column checklist and the table read one state. The checklist
       // used to be drawn only on the slow path, so after a preset change it still showed the old columns
       // and one tick rebuilt the table from the stale set. Custom picks name themselves in the select.
       ctx.syncColumnControls = function syncColumnControls() {
         const presetSelect = documentRef.getElementById('scr-column-preset');
         if (presetSelect) {
           let customOption = presetSelect.querySelector('option[value="custom"]');
           if (columnState.preset === 'custom' && !customOption) {
             customOption = documentRef.createElement('option');
             customOption.value = 'custom';
             customOption.textContent = '직접 선택';
             presetSelect.appendChild(customOption);
           }
           if (customOption) customOption.hidden = columnState.preset !== 'custom';
           presetSelect.value = columnState.preset;
         }
         renderColumnChooser(documentRef, page, columnState.preset, columnState.custom, (columns) => {
           columnState.preset = 'custom';
           columnState.custom = columns;
           ctx.renderNow();
         });
       }
  ctx.actions.push((action, argument, actionNode) => {
    if (action === 'profile') {
          ++ctx.runGeneration; ctx.activeResult = null; ctx.activeRows = null; ctx.activePreview = null; ctx.activePreviewKey = null;
          root?._aioSetProfile?.(argument);
          Promise.resolve(onProfileChange?.(argument)).finally(ctx.rerender);
    } else if (action === 'toggle-columns') {
           columnState.preset = columnState.preset === 'all' ? 'discovery' : 'all';
           const presetSelect = documentRef.getElementById('scr-column-preset');
           if (presetSelect) presetSelect.value = columnState.preset;
           ctx.renderNow();
    } else if (action === 'column-preset') {
           columnState.preset = argument || 'discovery';
           columnState.custom = [];
           ctx.renderNow();
    } else if (action === 'column-chooser') {
           const chooser = documentRef.getElementById('scr-column-chooser');
           if (chooser) chooser.hidden = !chooser.hidden;
    } else if (action === 'tab') {
           // 개편 v2: 랭킹 is the 순위 view; 팩터·과거 검증·조건별 통계 are sections of the one 사후 검증 view.
           const fromSeg = !!actionNode.closest('.scr-view-seg');
           ctx.setView(argument === 'ranking' ? 'rank' : 'validation', { focusTab: fromSeg });
           if (argument === 'factors' || argument === 'evidence') {
             const smooth = !root?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
             documentRef.getElementById(`scr-tab-${argument}`)?.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
           } else if (!fromSeg) ctx.scrollToTop();
    } else if (action === 'view') {
           const fromSeg = !!actionNode.closest('.scr-view-seg');
           // v58.80 run-5 (breaker #1): 결과 보기 under the 맞춤 조건 count shows that count — the conditions search every stock,
           // as a theme handoff does (v58.75), instead of only the last run's passed set.
           if (actionNode.classList.contains('scr-custom-go')) { const passedOnly = documentRef.getElementById('scr-passed-only'); if (passedOnly) passedOnly.checked = false; visibleLimit.value = 12; ctx.renderNow(); }
           ctx.setView(argument, { focusTab: fromSeg });
           if (!fromSeg) ctx.scrollToTop();
           if (argument === 'custom' && !fromSeg) documentRef.querySelector('#scr-custom select')?.focus?.({ preventScroll: true });
    } else if (action === 'focus-mode') {
           documentRef.body.classList.toggle('aio-screener-focus');
           actionNode.setAttribute('aria-pressed', documentRef.body.classList.contains('aio-screener-focus') ? 'true' : 'false');
    } else return false;
    return true;
  });
  ctx.inputs.push((event) => {
    if (event.target.matches?.('#scr-column-preset')) {
           columnState.preset = event.target.value || 'discovery';
           columnState.custom = [];
           ctx.renderNow();
    } else return false;
    return true;
  });
}
