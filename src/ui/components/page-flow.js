// P1431: the two connective pieces every analysis page uses — a section lead (what this section
// adds to the page's conclusion) and "이어서 볼 곳" (where the same reading continues, and why).
import { setResearchHandoff } from '../../app/research-handoff.js';

// v59.55 (owner 11/1): the screens that end with 연결해서 보면 (market-synthesis.js), by their 이어서 볼 곳 nav id.
const SYNTHESIS_PAGES = Object.freeze({
  'regime-next': 'signal', 'breadth-next': 'breadth', 'sentiment-next': 'sentiment', 'macro-next': 'macro',
  'fxbond-next': 'fxbond', 'themes-next': 'themes', 'briefing-next': 'briefing', 'news-next': 'news'
});

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

export function renderNextSteps(doc, host, items = []) {
  if (!host) return null;
  // v59.55 (owner 11/1): every market screen ends with 연결해서 보면 just above this nav (a lazy chunk).
  if (SYNTHESIS_PAGES[host.id]) import('./market-synthesis.js').then(({ renderMarketSynthesis }) => renderMarketSynthesis({ documentRef: doc, host, page: SYNTHESIS_PAGES[host.id] })).catch(() => {});
  const wasOpen = !!host.querySelector?.('.flow-next-fold')?.open;
  host.replaceChildren();
  host.hidden = !items.length;
  if (!items.length) return host;
  host.classList.add('flow-next');
  const head = doc.createElement('h2');
  head.className = 'flow-next-title';
  head.textContent = '이어서 볼 곳';
  const list = doc.createElement('ul');
  list.className = 'flow-next-list';
  const root = doc?.defaultView || globalThis;
  for (const item of items) {
    const li = doc.createElement('li');
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'flow-next-link';
    button.dataset.action = item.action || 'showPage';
    button.dataset.arg = item.arg || item.route;
    button.textContent = `${item.label} →`;
    // P1449: a link that names its own 조사 맥락 (종목·검색어·질문) carries it as a typed
    // handoff the destination route consumes once — not as the previous screen's leftovers.
    if (item.ctx && item.route) {
      button.dataset.hasCtx = '1';
      button.addEventListener('click', () => {
        setResearchHandoff({ root, routeId: item.route, context: item.ctx, label: item.label });
      });
    }
    // v58.79 (layout over captions): the link names its destination; why to go there is its hover (and stays for
    // screen readers), not a second line under every link.
    const why = doc.createElement('span');
    why.className = 'flow-next-why sr-only';
    why.textContent = item.why || '';
    if (item.why) button.title = item.why;
    li.append(button, why);
    list.append(li);
  }
  // v58.56 (re-audit #16): on the long market screens (host data-fold) the list is a one-line disclosure whose summary
  // names the destinations, so the page ends on one line instead of a ~220-320px block; the links are unchanged.
  if (host.dataset.fold != null) {
    const fold = doc.createElement('details');
    fold.className = 'sx-disclosure flow-next-fold';
    fold.open = wasOpen; // v58.56 review: a data refresh repaints the list without closing a fold the reader opened
    const summary = doc.createElement('summary');
    summary.className = 'flow-next-summary';
    const label = doc.createElement('span');
    label.className = 'flow-next-title';
    label.textContent = '이어서 볼 곳';
    const names = doc.createElement('span');
    names.className = 'flow-next-names';
    names.textContent = items.map((item) => item.label).join(', ');
    summary.append(label, names);
    fold.append(summary, list);
    host.append(fold);
    return host;
  }
  host.append(head, list);
  return host;
}
