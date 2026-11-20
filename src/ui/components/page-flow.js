// P1431: the two connective pieces every analysis page uses — a section lead (what this section
// adds to the page's conclusion) and "이어서 볼 곳" (where the same reading continues, and why).

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
// and hidden. 연결해서 보면 (market-synthesis.js) is gone from 시장 상태 — its branches repeated the 시나리오
// section, its chain the 지금 view, and its lean/avoid lists moved to 오늘의 가이드.
export function renderNextSteps(doc, host) {
  if (!host) return null;
  host.replaceChildren();
  host.hidden = true;
  return host;
}
