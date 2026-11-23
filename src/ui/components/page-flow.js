export function sectionLead(doc, text) {
  const node = doc.createElement('p');
  node.className = 'flow-lead';
  node.textContent = text || '';
  return node;
}

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

export function renderNextSteps(doc, host) {
  if (!host) return null;
  host.replaceChildren();
  host.hidden = true;
  return host;
}
