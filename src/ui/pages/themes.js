// v59.70: the page is the lifecycle; the RRG view, the sector board and the theme detail live in src/ui/pages/themes/.
import { createResourceBag } from '../../app/lifecycle.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { renderKnowledgeArrival } from '../components/knowledge-arrival.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { renderThemeStrength } from '../components/theme-strength.js';
import { renderThemePlaybook, renderThemeDetailPlaybook } from '../components/theme-playbook-view.js';
import { renderSectorMap } from '../components/sector-map.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { applyLegacyThemeDetailAddress } from '../navigation/theme-detail.js';
import { renderRRGStatus, renderRRGCanvas, syncVerdictView } from './themes/rrg.js';
import { renderThemeDaySplits, renderKrThemeArtifact, krDetailPanelOf, syncKrLiveBlocks, renderKrCloseDetail, renderThemePerformanceBars, themeDetailDeepLink, renderThemes } from './themes/sectors.js';
import { themeCriteriaSummary, renderThemeDetailTeach, renderThemeDetailSummary, renderThemeDetailComposition, renderThemeDetailLeaders, renderThemeDetailTemperature, renderThemeDetailSpread, renderThemeDetailBreadthHealth, renderThemeDetailSubthemeGap, renderThemeDetailBenchmark, syncThemeDetailDayFold, renderThemeDetailInsights } from './themes/detail.js';

export { themeDayLine } from './themes/detail.js';

export function createThemesPage({ root = globalThis, documentRef, store, route = 'themes' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      const suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
        routeId: route,
        heading: route === 'theme-detail' ? '테마 상세, AI 수요·운영·현금 전환' : '테마, AI 가치사슬·qualification·운영 검증'
      });
      page.appendChild(suppliedMaterialBridge);
      bag.add(() => suppliedMaterialBridge.remove());
      page.dataset.aioArchitectureRoute = route;
      page.dataset.aioArchitectureSlice = 'themes';
      // v57.50 I05: what a research document sent the reader here to check, and the way back.
      renderKnowledgeArrival({ documentRef, root, routeId: route });
      if (route === 'themes') {
        page.dataset.aioArchitectureRenderer = 'native';
        const container = documentRef.getElementById('rrg-quadrant-cards');
        const rrgStatusHost = documentRef.getElementById('rrg-chart-status');
        const rrgCanvasHost = documentRef.getElementById('rrg-canvas');
         const performanceBarsHost = documentRef.getElementById('sector-perf-bars');
         const detailPanel = documentRef.getElementById('theme-detail-panel');
        // Every native host in the panel (the summary, composition, the day hosts, insights and the closing links) empties
        // and hides on close and on unmount.
        const clearDetailHosts = () => {
          for (const node of detailPanel?.querySelectorAll?.('[data-aio-theme-detail-surface], #theme-detail-native-next') || []) { node.replaceChildren(); node.hidden = true; }
        };
         const requestThemeDetail = (themeId) => {
           const id = String(themeId || '').trim();
           if (!id) return;
           root._currentThemeId = id;
           if (typeof root.showThemeDetail === 'function') {
             root.showThemeDetail(id);
             return;
           }
           eventTarget?.dispatchEvent?.(new CustomEvent('aio:themeDetailShown', { detail: { themeId: id } }));
         };
        if (container) container.dataset.aioThemesRenderer = 'native';
        if (rrgStatusHost) rrgStatusHost.dataset.aioRrgStatusRenderer = 'native';
        if (rrgCanvasHost) rrgCanvasHost.dataset.aioRrgChartRenderer = 'native';
         if (performanceBarsHost) performanceBarsHost.dataset.aioThemePerformanceBarsRenderer = 'native';
         if (detailPanel) detailPanel.dataset.aioThemeDetailPanelRenderer = 'native';
        // v57.54 (CI flake, 1 in ~12 under 4x CPU): a refresh/store re-render right after the detail panel closes can
        // replace the trigger the close handler just focused, dropping focus to <body>. Re-focus its replacement after render.
        let restoreDetailFocus = null;
        let stopCloseFollow = null; // one at a time; ends when focus moves on, on reopen, after 60s, or on unmount
        bag.add(() => stopCloseFollow?.());
        // v59.51 (content audit): an open theme is a view of its own. The page carries data-theme-detail="open" while the
        // panel shows a theme, and themes-page.css steps the list sections aside (the list stayed rendered around the panel:
        // ~25,600 px on a phone).
        const syncStandalone = () => {
          const open = !!detailPanel && detailPanel.style.display === 'block' && !!detailPanel.dataset.currentTheme;
          if (open) page.dataset.themeDetail = 'open'; else delete page.dataset.themeDetail;
        };
        bag.add(() => { delete page.dataset.themeDetail; });
        const verdictTabs = documentRef.getElementById('themes-verdict-tabs');
        const onVerdictTab = (event) => {
          const view = event.target?.closest?.('button[data-view]')?.dataset.view;
          if (!view) return;
          root._aioThemesVerdictView = view;
          syncVerdictView(documentRef, root);
          // v59.70: the scatter was sized while hidden; redraw it at the visible frame width.
          if (view === 'rrg') { renderRRGStatus({ documentRef, root, store, route }); renderRRGCanvas({ documentRef, root, store, route }); }
        };
        verdictTabs?.addEventListener('click', onVerdictTab);
        bag.add(() => verdictTabs?.removeEventListener('click', onVerdictTab));
        // v57.61 (perf): the nine detail renderers only fill hosts inside #theme-detail-panel. While the panel is
        // closed the close handler has emptied them, so they are skipped; opening the panel renders them once.
        const renderDetail = () => {
          if (detailPanel && detailPanel.style.display !== 'block') return;
          renderThemeDetailSummary({ documentRef, root, store });
          renderThemeDetailComposition({ documentRef, root, store });
          renderThemeDetailLeaders({ documentRef, root, store });
          renderThemeDetailTemperature({ documentRef, root, store });
          renderThemeDetailSpread({ documentRef, root, store });
          renderThemeDetailBreadthHealth({ documentRef, root, store });
          renderThemeDetailSubthemeGap({ documentRef, root, store });
          renderThemeDetailBenchmark({ documentRef, root, store });
          renderThemeDetailInsights({ documentRef, root, store });
          syncThemeDetailDayFold(documentRef, store); // v58.75
          renderThemeDetailTeach({ documentRef, root, store }); // v58.75 (persona review, A-3·4·6)
        };
        // v57.61 (perf): event-driven renders coalesce into one per animation frame (one aio:liveQuotes tick used to
        // render here and again after bootstrap's syncThemes store update). Store-slice renders stay synchronous and
        // cancel a pending frame, so the store path remains the single renderer for that tick.
        let pendingFrame = null;
        const cancelScheduledRender = () => {
          if (!pendingFrame) return;
          const view = documentRef.defaultView;
          if (pendingFrame.raf != null) view?.cancelAnimationFrame?.(pendingFrame.raf);
          if (pendingFrame.timer != null) view?.clearTimeout?.(pendingFrame.timer);
          pendingFrame = null;
        };
        const renderNow = () => {
          cancelScheduledRender();
           renderThemes({ documentRef, root, store, route });
          renderRRGStatus({ documentRef, root, store, route });
          renderRRGCanvas({ documentRef, root, store, route });
           renderThemePerformanceBars({ documentRef, root, store, route });
           renderKrThemeArtifact({ documentRef, root, store });
          renderDetail();
           renderThemeStrength({ documentRef, root, store }); // P1417
          // v59.44 (owner 2026-10-30): the AI supply chain by group (a lazy chunk). v59.51: it paints into its static slot
          // after #themes-verdict; creating the host here raced aio-core's 2.3 s verdict-after-header reorder.
          if (route === 'themes') import('../components/ai-chain-flow.js').then(({ paintThemesAiChain }) => paintThemesAiChain(documentRef, root)).catch(() => {});
           try { renderThemePlaybook({ documentRef, root, store }); renderThemeDetailPlaybook({ documentRef, root }); if (detailPanel?.style.display === 'block') renderThemeDetailTeach({ documentRef, root, store }); } catch (_) { /* the forward read never takes the themes route down */ } // P1743; v58.75 the teach block reads the playbook just built
           try { renderSectorMap({ documentRef, root, store }); renderThemeDaySplits({ documentRef, root, store }); } catch (_) { /* the map never takes the themes route down */ } // 2026-10-13 S&P 500 map; v59.51 day splits
           // v59.51 (content audit): S&P 500 이익 전망 (index-earnings.js) moved to 거시 — it says nothing about themes.
           syncVerdictView(documentRef, root);
           syncStandalone();
           restoreDetailFocus?.();
         };
        const scheduleRender = () => {
          if (pendingFrame) return;
          const view = documentRef.defaultView;
          const run = () => { if (pendingFrame) renderNow(); };
          pendingFrame = {};
          // A hidden tab never runs rAF; the timer bounds the wait so a background refresh still lands.
          if (typeof view?.requestAnimationFrame === 'function') pendingFrame.raf = view.requestAnimationFrame(run);
          pendingFrame.timer = typeof view?.setTimeout === 'function' ? view.setTimeout(run, 250) : null;
          if (pendingFrame.raf == null && pendingFrame.timer == null) { pendingFrame = null; renderNow(); }
        };
        bag.add(() => cancelScheduledRender());
        // v58.75 (persona review): the AI chat reads one theme's criteria, reasons, roles and scenarios through this global
        // ({ headline, items: [{ label, met, value, principle }], ... }). It stays after unmount — the store is the app's one.
        root._aioThemeCriteriaFor = (themeId) => { try { return themeCriteriaSummary(root, store, themeId); } catch (_) { return null; } };
        renderNow();
        // v57.76: the scatter redraws when its frame changes width (rotation, sidebar, window resize). Height changes
        // from the redraw itself are ignored, so the observer cannot loop.
        const rrgFrame = documentRef.getElementById('rrg-canvas-frame');
        const FrameObserver = documentRef.defaultView?.ResizeObserver;
        if (rrgFrame && typeof FrameObserver === 'function') {
          let lastFrameWidth = rrgFrame.clientWidth;
          const frameObserver = new FrameObserver(() => {
            const frameWidth = rrgFrame.clientWidth;
            if (!frameWidth || frameWidth === lastFrameWidth) return;
            lastFrameWidth = frameWidth;
            renderRRGCanvas({ documentRef, root, store, route });
          });
          frameObserver.observe(rrgFrame);
          bag.add(() => frameObserver.disconnect());
        }
        // v57.50 I22: a link that asked for a section (국내 테마 from the KR screener) opens and shows it once.
        const handoff = consumeResearchHandoff({ root, routeId: 'themes' });
        const anchorId = handoff?.context?.anchor ? String(handoff.context.anchor) : '';
        if (/^[a-z0-9-]+$/i.test(anchorId)) {
          const section = documentRef.getElementById(anchorId);
          const fold = section?.closest?.('details');
          if (fold) fold.open = true;
          section?.scrollIntoView?.({ block: 'start' });
        }
        const unsubscribe = store && subscribeToSlices(store, ['themes', 'screener'], renderNow);
        if (unsubscribe) bag.add(unsubscribe);
        const eventTarget = documentRef || root;
        ['aio:themesViewChanged', 'aio:rotationDetailLoaded', 'aio:historyLoaded', 'aio:refresh:done', 'aio:liveQuotes', 'aio:sectorPerfChanged', 'aio:colorThemeChanged'].forEach((eventName) => {
          eventTarget?.addEventListener?.(eventName, scheduleRender);
          bag.add(() => eventTarget?.removeEventListener?.(eventName, scheduleRender));
        });
        // The refresh scheduler announces on window; the document registration above stays.
        if (typeof root?.addEventListener === 'function' && root !== eventTarget) {
          root.addEventListener('aio:refresh:done', scheduleRender);
          bag.add(() => root.removeEventListener?.('aio:refresh:done', scheduleRender));
        }
        // P1417: history.json announces itself on window (js/aio-data.js), not on document.
        const windowTarget = root && root !== eventTarget ? root : null;
        if (windowTarget?.addEventListener) {
          windowTarget.addEventListener('aio:historyLoaded', scheduleRender);
          bag.add(() => windowTarget.removeEventListener?.('aio:historyLoaded', scheduleRender));
        }
        const onThemeDetailShown = (event) => {
          // P800: the native detail surfaces consume the normalized store selection;
          // the legacy event payload remains a compatibility notification only.
          if (deepLinkHint) deepLinkHint.hidden = true;
          stopCloseFollow?.(); // a reopened detail ends the close-focus follow
          if (detailPanel) {
            detailPanel.style.display = 'block';
            if (event?.detail?.themeId) detailPanel.dataset.currentTheme = String(event.detail.themeId);
          }
          syncStandalone();
          renderDetail(); // v57.61: detail renderers skip while closed, so the opening render happens here
          // Needs the theme id set above; each render has its own guard so a failure in one still draws the other.
          try { renderThemeDetailPlaybook({ documentRef, root }); } catch (error) { root?._aioLog?.('warn', 'themes', `테마 상세 플레이북 렌더 실패: ${error?.message || error}`); }
          try { renderThemeDetailTeach({ documentRef, root, store }); } catch (error) { root?._aioLog?.('warn', 'themes', `테마 상세 읽기 렌더 실패: ${error?.message || error}`); }
          // The architecture listener synchronously refreshes the store before this
          // compatibility event reaches the mounted page. The store subscription is
          // the sole detail renderer; this listener owns visibility only.
        };
        // v57.76: a quadrant chip can sit in the 사분면별 섹터 fold, which closes itself once quadrants render; returning
        // focus opens the fold first, since a node inside a closed <details> cannot take focus.
        const revealTrigger = (node) => { const fold = node?.closest?.('details'); if (fold && !fold.open) fold.open = true; };
        const onThemeDetailClosed = () => {
          delete page.dataset.themeDetail; // the list comes back first, so the trigger can take focus and be scrolled to
          const trigger = currentDetailTrigger();
          revealTrigger(trigger);
          trigger?.setAttribute?.('aria-expanded', 'false');
          trigger?.scrollIntoView?.({ block: 'center' });
          trigger?.focus?.({ preventScroll: true });
          const closedAt = Date.now();
          // v57.59: CI still lost focus when the replacing render came from a host outside renderNow (or after 3s under
          // CPU throttling), so a short-lived observer on the page also retries.
          // 2026-10-19: it stopped after the first successful re-focus and after 10s, so a second replacing render (or
          // one after 10s under 4x CPU) still dropped focus to <body> (main CI, #62, #73). It now follows the focused
          // trigger: whenever that node is removed while focus sits on <body>, the current trigger for the same theme
          // takes focus. It stops once the reader moves focus elsewhere (a blur onto <body> while the trigger is still
          // mounted is the reader's own click), when a detail opens again, or after 60s.
          stopCloseFollow?.();
          let observer = null;
          let focused = documentRef.activeElement === trigger ? trigger : null;
          // A blur of a still-mounted trigger (checked after the event, since a removal may also report focusout) is
          // the reader leaving; a later replacing render must not pull focus back.
          const onFocusOut = (event) => {
            if (event.target !== focused) return;
            documentRef.defaultView?.queueMicrotask?.(() => { if (focused?.isConnected && documentRef.activeElement !== focused) stop(); });
          };
          const stop = () => { restoreDetailFocus = null; observer?.disconnect?.(); observer = null; stopCloseFollow = null; documentRef.removeEventListener?.('focusout', onFocusOut, true); };
          stopCloseFollow = stop;
          documentRef.addEventListener?.('focusout', onFocusOut, true);
          restoreDetailFocus = () => {
            if (Date.now() - closedAt > 60000) { stop(); return; }
            const active = documentRef.activeElement;
            // The panel's own close button keeps focus while hidden until something else takes it; that is not the reader moving on.
            if (active && active !== documentRef.body && !detailPanel?.contains?.(active)) {
              const id = active.dataset?.arg || active.dataset?.themeId;
              if (active === focused || (id && id === detailTriggerId && page?.contains?.(active))) { focused = active; return; }
              stop(); // focus moved to something else: the reader has gone on
              return;
            }
            if (focused && documentRef.contains(focused) && !detailPanel?.contains?.(active)) { stop(); return; } // the reader blurred a still-mounted trigger
            const next = currentDetailTrigger();
            if (!next) return;
            revealTrigger(next);
            next.setAttribute?.('aria-expanded', 'false');
            next.focus?.({ preventScroll: true });
            // v57.64: a replacement still hidden mid-render refuses focus; keep watching until focus actually lands.
            if (documentRef.activeElement === next) focused = next;
          };
          const Observer = documentRef.defaultView?.MutationObserver;
          if (Observer && page) { observer = new Observer(() => restoreDetailFocus?.()); observer.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'open', 'class'] }); }
          documentRef.defaultView?.setTimeout?.(() => { if (stopCloseFollow === stop) stop(); }, 60500);
          if (detailPanel) {
            detailPanel.style.display = 'none';
            delete detailPanel.dataset.currentTheme;
          }
          clearDetailHosts();
          syncThemeDetailDayFold(documentRef, store);
        };
        // P1599 (T04): the trigger the reader clicked (sector cards, sub-theme ranking, CAPEX flow, stage table) is kept so
        // closing the detail returns to that row. v59.51: the detail is a view of its own, so the panel no longer moves
        // under the clicked section.
        let detailTrigger = null;
        let detailTriggerKey = null;
        let detailTriggerId = '';
        let deepLinkHint = null;
        const currentDetailTrigger = () => detailTrigger && documentRef.contains(detailTrigger) ? detailTrigger
          : [...(page?.querySelectorAll?.('[data-action="showThemeDetail"], [data-theme-id], .capex-flow-theme') || [])]
            .find((node) => !detailPanel?.contains?.(node) && JSON.stringify([node.dataset.action, node.dataset.arg, node.dataset.themeId, node.getAttribute('aria-label')]) === detailTriggerKey)
          // A re-render may refresh the label (numbers in it); the theme id alone still names the same trigger.
          || (detailTriggerId ? [...(page?.querySelectorAll?.('[data-action="showThemeDetail"], [data-theme-id]') || [])]
            .find((node) => !detailPanel?.contains?.(node) && (node.dataset.arg || node.dataset.themeId) === detailTriggerId) : null);
        const onThemeTriggerClick = (event) => {
          const trigger = event?.target?.closest?.('[data-action="showThemeDetail"], [data-theme-id], .capex-flow-theme');
          if (!trigger || !page?.contains?.(trigger) || detailPanel?.contains?.(trigger)) return;
          detailTrigger = trigger;
          detailTriggerKey = JSON.stringify([trigger.dataset.action, trigger.dataset.arg, trigger.dataset.themeId, trigger.getAttribute('aria-label')]);
          detailTriggerId = trigger.dataset.arg || trigger.dataset.themeId || '';
          trigger.setAttribute('aria-controls', 'theme-detail-panel');
          trigger.setAttribute('aria-expanded', 'true');
        };
        documentRef?.addEventListener?.('click', onThemeTriggerClick, true);
        bag.add(() => documentRef?.removeEventListener?.('click', onThemeTriggerClick, true));
        const ensureReturnButton = () => {
          if (!detailPanel || detailPanel.querySelector('.theme-detail-return')) return;
          const back = documentRef.createElement('button');
          back.type = 'button';
          back.className = 'flow-next-link theme-detail-return';
          back.textContent = '← 테마 목록으로';
          // v59.51: the way back closes the detail; the close handler reopens the trigger's fold, scrolls to it and focuses it.
          back.addEventListener('click', () => {
            if (typeof root.closeThemeDetail === 'function') root.closeThemeDetail();
            else eventTarget?.dispatchEvent?.(new CustomEvent('aio:themeDetailClosed'));
          });
          detailPanel.prepend(back);
        };
        const onDetailShownPlacement = () => {
          ensureReturnButton();
          const trigger = currentDetailTrigger(); trigger?.setAttribute?.('aria-controls', 'theme-detail-panel'); trigger?.setAttribute?.('aria-expanded', 'true');
          detailPanel?.scrollIntoView?.({ block: 'start' });
        };
        eventTarget?.addEventListener?.('aio:themeDetailShown', onDetailShownPlacement);
        bag.add(() => eventTarget?.removeEventListener?.('aio:themeDetailShown', onDetailShownPlacement));
        eventTarget?.addEventListener?.('aio:themeDetailShown', onThemeDetailShown);
        eventTarget?.addEventListener?.('aio:themeDetailClosed', onThemeDetailClosed);
        bag.add(() => eventTarget?.removeEventListener?.('aio:themeDetailShown', onThemeDetailShown));
        bag.add(() => eventTarget?.removeEventListener?.('aio:themeDetailClosed', onThemeDetailClosed));
        const legacyAddress = applyLegacyThemeDetailAddress(root); // v59.70: an old #theme-detail/<id> keeps its id
        const pendingThemeId = String(root?._aioOpenThemeDetailOnThemes || '').trim();
        if (pendingThemeId) {
          delete root._aioOpenThemeDetailOnThemes;
          queueMicrotask(() => requestThemeDetail(pendingThemeId));
        }
        // v58.75 (persona review): every way into the Korean theme detail (artifact rows, legacy cards, other screens via
        // openKrThemeDetail) goes through window.showKrThemeDetail; while 테마 is mounted it also fills the completed-close
        // member table and keeps the (otherwise hidden) live fold visible around the open panel.
        const originalShowKr = typeof root?.showKrThemeDetail === 'function' && !root.showKrThemeDetail.__aioCloseDetail ? root.showKrThemeDetail : null;
        if (originalShowKr) {
          const wrappedShowKr = function showKrThemeDetailWithClose(themeId, ...rest) {
            const liveFold = documentRef.getElementById('kr-themes-live');
            if (liveFold) liveFold.hidden = false;
            const out = originalShowKr.call(this, themeId, ...rest);
            try { renderKrCloseDetail({ documentRef, root, store, themeId }); } catch (_) { /* the close table never blocks the live detail */ }
            return out;
          };
          wrappedShowKr.__aioCloseDetail = true;
          root.showKrThemeDetail = wrappedShowKr;
          bag.add(() => { if (root.showKrThemeDetail === wrappedShowKr) root.showKrThemeDetail = originalShowKr; });
        }
        const krPanel = krDetailPanelOf(documentRef);
        const PanelObserver = documentRef.defaultView?.MutationObserver;
        if (krPanel && typeof PanelObserver === 'function') {
          const panelObserver = new PanelObserver(() => syncKrLiveBlocks(documentRef, root));
          panelObserver.observe(krPanel, { attributes: true, attributeFilter: ['style'] });
          bag.add(() => panelObserver.disconnect());
        }
        const pendingKrThemeId = String(root?._aioOpenKrThemeDetailOnThemes || '').trim();
        if (pendingKrThemeId) {
          delete root._aioOpenKrThemeDetailOnThemes;
          // After this mount's own renders (they reset the Korean theme fold), so the opened detail stays open.
          const openTimer = root?.setTimeout?.(() => root.openKrThemeDetail?.(pendingKrThemeId, { settle: true }), 0);
          bag.add(() => root?.clearTimeout?.(openTimer));
        }
        const deepLink = legacyAddress?.named ? { ...legacyAddress, themeId: null } : themeDetailDeepLink(root?.location?.hash, root); // a named id already opened above
        const deepLinkId = String(deepLink?.themeId || '').trim();
        if (deepLinkId) queueMicrotask(() => requestThemeDetail(deepLinkId));
        if (deepLink?.requested && !deepLink.unknown && !store?.getState?.()?.themes?.selectedDetail && detailPanel) {
          deepLinkHint = documentRef.createElement('p');
          deepLinkHint.className = 'theme-detail-deep-link-hint';
          deepLinkHint.textContent = deepLinkId
            ? '주소의 테마 상세를 열지 못하면 위 섹터 카드나 세부 테마 순위에서 같은 테마를 골라 주세요.'
            : '테마 상세 — 주소에 테마가 지정되지 않았습니다. 위 섹터 카드나 세부 테마 순위에서 테마를 고르면 여기에 상세가 열립니다.';
          detailPanel.appendChild(deepLinkHint);
          detailPanel.style.display = 'block';
          bag.add(() => deepLinkHint?.remove?.());
        }
        bag.add(() => {
          if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
          if (container?.dataset.aioThemesRenderer === 'native') delete container.dataset.aioThemesRenderer;
          if (rrgStatusHost?.dataset.aioRrgStatusRenderer === 'native') delete rrgStatusHost.dataset.aioRrgStatusRenderer;
          if (rrgCanvasHost?.dataset.aioRrgChartRenderer === 'native') delete rrgCanvasHost.dataset.aioRrgChartRenderer;
            if (performanceBarsHost?.dataset.aioThemePerformanceBarsRenderer === 'native') delete performanceBarsHost.dataset.aioThemePerformanceBarsRenderer;
           if (detailPanel?.dataset.aioThemeDetailPanelRenderer === 'native') {
             detailPanel.style.display = 'none';
             delete detailPanel.dataset.aioThemeDetailPanelRenderer;
             delete detailPanel.dataset.currentTheme;
           }
          clearDetailHosts();
        });
      }
      bag.add(() => {
        if (page.dataset.aioArchitectureRoute === route) delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'themes') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
