// P1431: the two connective pieces every analysis page uses — a section lead (what this section
// adds to the page's conclusion) and "이어서 볼 곳" (where the same reading continues, and why).

// v59.55 (owner 11/1): 연결해서 보면 (market-synthesis.js), by its 이어서 볼 곳 nav id. v59.68 (owner 11/3, "simple
// architecture"): only 시장 상태, the screen that owns the scenarios; the other screens repeated its card under their own.
const SYNTHESIS_PAGES = Object.freeze({ 'regime-next': 'signal' });

export function sectionLead(doc, text) {
  const node = doc.createElement('p');
  node.className = 'flow-lead';
  node.textContent = text || '';
  return node;
}

// v59.55 (flow review): one owner for "what to watch next" — 브리핑 다음 확인 포인트. 오늘 and 국면 판정 keep one line and
// land here; the section paints after the route renders, so the scroll waits for it (as openSignalAxis does).
export function openRouteSection(doc, root, routeId, sectionId) {
  root?.showPage?.(routeId);
  let tries = 0;
  const land = () => {
    const section = doc?.getElementById?.(sectionId);
    if (!section || section.hidden || !section.querySelector('li')) { if ((tries += 1) < 30) setTimeout(land, 100); return; }
    section.scrollIntoView?.({ block: 'start' });
    // Blocks above (charts, the earnings list) can finish drawing after the first jump and push the section down.
    setTimeout(() => section.scrollIntoView?.({ block: 'start' }), 600);
  };
  setTimeout(land, 60);
}

// v59.68 (owner 2026-11-03, "simple design"): the "이어서 볼 곳" link list under each screen is gone — the sidebar and the
// hub tabs are the navigation, and a link that carries context sits beside the line it continues. The host stays empty
// and hidden; 시장 상태's host still anchors 연결해서 보면 (market-synthesis.js).
export function renderNextSteps(doc, host) {
  if (!host) return null;
  if (SYNTHESIS_PAGES[host.id]) import('./market-synthesis.js').then(({ renderMarketSynthesis }) => renderMarketSynthesis({ documentRef: doc, host, page: SYNTHESIS_PAGES[host.id] })).catch(() => {});
  host.replaceChildren();
  host.hidden = true;
  return host;
}
