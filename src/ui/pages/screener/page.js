// Screener page lifecycle: state that outlives a visit, the mount, the render pass and event dispatch. The controllers
// (filters, views, workbench, inspector, validation, quotes) each own their nodes and actions; this file only wires them.
import { createResourceBag } from '../../../app/lifecycle.js';
import { consumeResearchHandoff } from '../../../app/research-handoff.js';
import { createSuppliedMaterialBridge } from '../../knowledge/supplied-material-bridge.js';
import { renderKnowledgeArrival } from '../../components/knowledge-arrival.js';
import { selectScreenerState } from '../../../state/selectors/screener.js';
import { subscribeToSlices } from '../../../state/memoize.js';
import { refreshSharedArtifact } from '../../../data/shared-artifacts.js';
import { readUniverseScope } from '../../../data/screener-extended.js';
import { mergeThemeAliases, SCREENER_COLUMN_REGISTRY } from './model.js';
import { syncRankFilterLabels, installCustomConditions, createFiltersController } from './filters.js';
import { render, createQuoteRequester } from './table.js';
import { createValidationController } from './validation-tab.js';
import { createInspectorController } from './inspector.js';
import { createViewsController } from './views.js';
import { createWorkbenchController } from './workbench.js';
import { screenerRuntime } from './model.js';
import { SCENARIO_STATE } from '../../../data/artifact-registry.js';

export function createScreenerPage({ documentRef, store, root = globalThis, workbench = {}, onProfileChange, onUniverseScopeChange, onTicker, onWatchlistToggle, readWatchlist, readAliases, readLiveData } = {}) {
  // P1625: use the selected screen's declared order until the user selects another metric.
  // v57.55 review (8n, 3-person consult): the first view is ordered by market cap. The preset's own rank lost its validation
  // check (GME·AMC led the list), so it is applied when a reader picks a preset, not as the default reading.
  // One object carries what outlives a visit (selection, active screen, the row a reader came back from) and what the
  // controllers share during one; each controller adds its functions to it.
  const ctx = {
    documentRef, store, root, workbench, onProfileChange, onUniverseScopeChange, onWatchlistToggle,
    sortState: { column: 'mcap', ascending: false },
    visibleLimit: { value: 12 },
    columnState: { preset: 'overview', custom: [] },
    selectedSymbols: new Set(),
    compareSymbols: new Set(),
    activeRows: null,
    activeResult: null,
    // P1165: 실행 전 미리보기 결과(선택한 정의, 같은 snapshot). 실행하면 activeResult가 대신한다.
    activePreview: null,
    activePreviewKey: null,
    activeDefinition: null,
    activeScreenId: null,
    activeRow: null,
    returnView: null,
    renderNow: () => {}
  };
  let mounted = false;
  return {
    route: 'screener',
    mount() {
      const bag = createResourceBag();
      ctx.mountActive = true;
      bag.add(() => { ctx.mountActive = false; });
      const page = documentRef?.getElementById('page-screener');
      if (!page) return () => {};
      Object.assign(ctx, { page, bag, actions: [], inputs: [] });
      screenerRuntime.customPanel = installCustomConditions(documentRef);
      bag.add(() => { screenerRuntime.customPanel?.dispose(); screenerRuntime.customPanel = null; });
      ctx.liveReader = readLiveData || (() => root?._liveData || {});
      ctx.watchlistReader = readWatchlist || (() => root?._aioWatchlistGet?.() || []);
      // v57.50 I10: the hand-written keyword aliases plus every THEME_MAP theme's constituents (union, aliases kept).
      let themeAliasCache = { themes: null, aliases: null, merged: {} };
      ctx.aliasReader = readAliases || (() => {
        const aliases = root?.SCR_KEYWORD_ALIASES || {};
        const themes = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
        if (themeAliasCache.themes !== themes || themeAliasCache.aliases !== aliases) themeAliasCache = { themes, aliases, merged: mergeThemeAliases(aliases, themes) };
        return themeAliasCache.merged;
      });
      ctx.profileReader = () => root?._aioGetActiveProfile?.() || 'balanced';
      createFiltersController(ctx);
      // P1449 (검토판 9): a link that came here with its own 조사 맥락 (e.g. 같은 섹터에서 비교)
      // fills the display search/scope from that context once, instead of surfacing whatever
      // query/sector chips the previous visit left behind.
      const handoff = consumeResearchHandoff({ root, routeId: 'screener' });
      // v57.50 I01: a KRX ticker's sector is a Korean-market sector — compare it inside the KR listing.
      if (/\.K[SQ]$/i.test(String(handoff?.context?.ticker || '')) && handoff?.context?.sector) root._aioScreenerListingMarket = 'KR';
      documentRef.getElementById('scr-listing-market').value = root._aioScreenerListingMarket === 'KR' ? 'KR' : 'US';
      // v57.50 I01: the sector arrives as the artifact's own value (Technology) or a sector ETF code (XLK); it is
      // applied to the 섹터 select once that select has been filled with this market's sectors (fillControls).
      ctx.pendingSector = handoff?.context?.sector ? String(handoff.context.sector) : null;
      if (handoff?.context) {
        const value = handoff.context.q;
        const field = value != null && value !== '' ? documentRef?.getElementById('scr-text-search') : null;
        if (field) field.value = String(value);
        // A sector comparison starts from that sector alone, not from the previous visit's search word.
        const search = ctx.pendingSector && handoff.context.q == null ? documentRef.getElementById('scr-text-search') : null;
        if (search) search.value = '';
        // v58.75 (persona review): '이 테마 종목을 스크리너에서 보기' asks for the theme's members — with 실행 통과만 on, 3 of 33
        // semiconductor rows showed. A search handoff opens on every matching row; the status line says how many passed.
        const passedOnly = handoff.context.q ? documentRef.getElementById('scr-passed-only') : null;
        if (passedOnly) passedOnly.checked = false;
      }
      // v57.50 I05: what a research document sent the reader here to check, and the way back.
      renderKnowledgeArrival({ documentRef, root, routeId: 'screener' });
      createValidationController(ctx);
      // 2026-10-14 audit #5: theme stage rows for the reading's "상위권의 테마 단계" (nothing renders until status is ok).
      // v58.75: the table's 테마 단계 column reads the same state, so the table redraws too.
      refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed && ctx.mountActive) { ctx.readSignature = ''; ctx.renderRead(); ctx.renderNow(); } }).catch(() => {});
      let suppliedMaterialBridge = page.querySelector('[data-aio-supplied-material-route="screener"]');
      if (!suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: 'screener',
          heading: '스크리너, 시장 확인·구조·노출·AI 용량 정렬'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
      }
      syncRankFilterLabels(documentRef);
      createQuoteRequester(ctx);
      createWorkbenchController(ctx);
      createInspectorController(ctx);
      createViewsController(ctx);
      ctx.rerender = () => { ctx.setProfileButtons(); ctx.renderNow(); };
      ctx.tickerHandler = (symbol) => {
        ctx.returnView = { symbol, scrollTop: documentRef.querySelector('.content')?.scrollTop || 0 };
        return (onTicker || ((value) => root?.showTicker?.(value)))?.(symbol);
      };
      ctx.renderNow = () => {
        const whyFocus = ctx.whyDrawerNode?.contains(documentRef.activeElement) ? documentRef.activeElement : null;
        const preview = ctx.ensurePreview();
        ctx.syncColumnControls();
        const renderArgs = { documentRef, root, store, readLiveData: ctx.liveReader, readWatchlist: ctx.watchlistReader, readAliases: ctx.aliasReader, sortState: ctx.sortState, visibleLimit: ctx.visibleLimit, onExplain: ctx.explainRow, onCompare: (row) => ctx.toggleCompare(row?.sym || row?.symbol), onVisibleSymbols: ctx.requestVisibleQuotes, selectedSymbols: ctx.selectedSymbols, compareSymbols: ctx.compareSymbols, columnPreset: ctx.columnState.preset, customColumns: ctx.columnState.custom, onWatchlistToggle: (symbol) => { (onWatchlistToggle || root?._aioWLToggle)?.(symbol); ctx.rerender(); ctx.syncWhyWatchlist(ctx.activeRow?.sym || ctx.activeRow?.symbol || ''); }, rowsOverride: ctx.activeRows || preview?.rows || null, workbenchResult: ctx.activeResult, previewResult: preview, onDataChange: () => ctx.renderNow(), onRetry: () => { Promise.resolve(onUniverseScopeChange?.(readUniverseScope(root))).catch(() => {}); } };
        render(renderArgs);
        const released = ctx.refreshInspector();
        // 개편 v2 (3c): the first wide render selects the first row for the inspector, then marks it in the table once.
        if (ctx.autoInspect() || released) render(renderArgs);
        ctx.syncPreviewStatus(preview);
        ctx.renderCompareTray();
        ctx.syncWhyCompare(ctx.activeRow?.sym || ctx.activeRow?.symbol || '');
        ctx.placeWhyDrawer();
        if (whyFocus && documentRef.activeElement !== whyFocus && ctx.whyDrawerNode?.contains(whyFocus)) whyFocus.focus?.({ preventScroll: true });
      };
      const handleClick = (event) => {
        const actionNode = event.target.closest?.('[data-aio-screener-action]');
        const header = event.target.closest?.('[data-scr-sort]');
        if (!actionNode && !header) return;
        event.preventDefault();
        event.stopPropagation();
        if (header) {
          const { sortState } = ctx;
          const column = header.dataset.scrSort;
          if (sortState.column === column) sortState.ascending = !sortState.ascending;
          else { sortState.column = column; sortState.ascending = column === 'sym' || column === 'sector' || column === 'fwdPe'; }
          const orderSelect = documentRef.getElementById('scr-order');
          if (orderSelect) {
            let option = [...orderSelect.options].find(item => item.value === column);
            if (!option) { option = documentRef.createElement('option'); option.value = column; orderSelect.append(option); }
            option.textContent = `${SCREENER_COLUMN_REGISTRY.find(item => item.key === column)?.label || column} ${sortState.ascending ? '오름차순' : '내림차순'}`; orderSelect.value = column;
          }
          // P1592 (F03): sorting reorders the same rows — keep what the reader already expanded.
          ctx.renderNow();
          // v57.61 WCAG 2.4.3: the header row is rebuilt on render — return focus to the same column's sort button.
          [...page.querySelectorAll('[data-scr-sort]')].find((node) => node.dataset.scrSort === column)?.focus?.();
          return;
        }
        const action = actionNode.dataset.aioScreenerAction;
        const argument = actionNode.dataset.aioScreenerArg;
        if (action === 'load-more') { ctx.visibleLimit.value += 12; ctx.renderNow(); return; }
        for (const handle of ctx.actions) if (handle(action, argument, actionNode)) return;
      };
      const handleInput = (event) => {
        if (!event.target.closest?.('#page-screener')) return;
        for (const handle of ctx.inputs) if (handle(event)) return;
      };
      ctx.searchTimer = null;
      bag.add(() => { if (ctx.searchTimer) clearTimeout(ctx.searchTimer); ctx.searchTimer = null; });
      const renderWithControls = () => { ctx.fillControls(); ctx.renderWorkbench(); ctx.rerender(); ctx.renderRead(); };
      page.addEventListener('click', handleClick);
      page.addEventListener('input', handleInput);
      page.addEventListener('change', handleInput);
      bag.add(() => page.removeEventListener('click', handleClick));
      bag.add(() => page.removeEventListener('input', handleInput));
      bag.add(() => page.removeEventListener('change', handleInput));
      bag.add(subscribeToSlices(store, ['screener'], renderWithControls));
      const eventTarget = documentRef || root;
      const onDataEvent = (event) => {
        if (event?.type === 'aio:historyLoaded') ctx.readSignature = '';
        renderWithControls();
      };
      ['aio:refresh:done', 'aio:liveQuotes', 'aio:historyLoaded'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, onDataEvent);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, onDataEvent));
      });
      const windowTarget = root && root !== eventTarget ? root : null;
      if (windowTarget?.addEventListener) {
        windowTarget.addEventListener('aio:historyLoaded', onDataEvent);
        bag.add(() => windowTarget.removeEventListener?.('aio:historyLoaded', onDataEvent));
      }
      mounted = true;
      ctx.setView('rank');
      renderWithControls();
      ctx.renderCompareTray();
      if (ctx.returnView) {
        const view = ctx.returnView;
        ctx.returnView = null;
        const restore = () => {
          if (!mounted) return;
          const row = [...page.querySelectorAll('[data-aio-screener-ticker]')].find((node) => node.dataset.aioScreenerTicker === view.symbol);
          row?.focus?.({ preventScroll: true });
          const content = documentRef.querySelector('.content');
          if (content) content.scrollTop = view.scrollTop;
        };
        if (root?.requestAnimationFrame) {
          const frame = root.requestAnimationFrame(restore);
          bag.add(() => root.cancelAnimationFrame?.(frame));
        } else restore();
      }
      return () => {
        if (!mounted) return;
        mounted = false;
        bag.dispose();
        if (page.dataset.aioArchitectureRoute === 'screener') delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'screener') delete page.dataset.aioArchitectureSlice;
        if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
      };
    }
  };
}
