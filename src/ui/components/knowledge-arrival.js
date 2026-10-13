import { parseKnowledgeTargetContext } from '../../app/knowledge-route-state.js';

// v57.50 I05: research documents link 227 times into analysis screens, but only four pages read what the reader came
// to check. Any page can call this on mount: it shows "what you came here to check" and a way back, or removes the
// note when the URL carries no knowledge context.
// The note belongs to the arrival, not to the page: every route change (showPage and back/forward both publish
// aio:knowledgeRouteContext) re-evaluates the notes on screen, so a note never outlives the link that brought it.
const PERIOD_LABELS = Object.freeze({ TTM_3Y: '최근 12개월과 3년', '5Y': '5년', '3Y_5Y': '3~5년' });
const NOTE_SELECTOR = '.aio-knowledge-arrival';

function installArrivalSync({ documentRef, root }) {
  if (!root || typeof root.addEventListener !== 'function' || root._aioKnowledgeArrivalSync) return;
  root._aioKnowledgeArrivalSync = true;
  root.addEventListener('aio:knowledgeRouteContext', (event) => {
    const routes = new Set();
    for (const note of documentRef?.querySelectorAll?.(NOTE_SELECTOR) || []) {
      const routeId = String(note.parentNode?.id || '').replace(/^page-/, '');
      if (routeId) routes.add(routeId); else note.remove();
    }
    // A context that targets a page already mounted (same-route arrival) is shown without waiting for a remount.
    const target = event?.detail?.active ? event.detail.routeId : null;
    if (target && root._aioKnowledgeArrivalRoutes?.has(target)) routes.add(target);
    for (const routeId of routes) renderKnowledgeArrival({ documentRef, root, routeId });
  });
}

export function clearKnowledgeArrival({ documentRef = globalThis.document, routeId } = {}) {
  documentRef?.getElementById?.(`page-${routeId}`)?.querySelector?.(`:scope > ${NOTE_SELECTOR}`)?.remove?.();
}

export function renderKnowledgeArrival({ documentRef = globalThis.document, root = globalThis, routeId, locationLike } = {}) {
  installArrivalSync({ documentRef, root });
  if (root && routeId) {
    if (!(root._aioKnowledgeArrivalRoutes instanceof Set)) root._aioKnowledgeArrivalRoutes = new Set();
    root._aioKnowledgeArrivalRoutes.add(routeId);
  }
  const page = documentRef?.getElementById?.(`page-${routeId}`);
  if (!page) return null;
  const existing = page.querySelector?.(`:scope > ${NOTE_SELECTOR}`);
  const context = parseKnowledgeTargetContext({ root, ...(locationLike ? { locationLike } : {}) });
  if (!context || context.routeId !== routeId || !(context.metric || context.knowledgeNode)) {
    existing?.remove?.();
    return null;
  }
  const note = existing || documentRef.createElement('p');
  note.className = 'aio-knowledge-arrival';
  note.setAttribute('role', 'note');
  note.style.cssText = 'font-size:11px;color:var(--accent);line-height:1.6;margin:0 0 8px;'; // same look as #fund-arrival-question
  note.textContent = '';
  const period = context.timeframe ? PERIOD_LABELS[context.timeframe] || context.timeframe : null;
  note.append(documentRef.createTextNode(`리서치 문서에서 넘어온 확인 대상: ${context.metric || context.knowledgeNode}${period ? ` · 볼 기간 ${period}` : ''}`));
  if (context.returnContext?.route) {
    const back = documentRef.createElement('button');
    back.type = 'button';
    back.className = 'aio-btn-table aio-knowledge-arrival-return';
    back.textContent = '읽던 문서로 돌아가기';
    back.addEventListener('click', () => { if (typeof root?.history?.back === 'function' && root.history.length > 1) root.history.back(); else root?.showPage?.(context.returnContext.route); });
    note.append(documentRef.createTextNode(' '), back);
  }
  if (!existing) {
    const heading = page.querySelector?.('h1, h2, .page-title');
    if (heading?.parentNode === page) heading.after(note); else page.prepend(note);
  }
  return note;
}
