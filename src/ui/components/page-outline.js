// Long screens get a row of section jumps under the page title: one button per visible section heading, the current
// section marked as the page scrolls. The row's height is reserved the moment the route commits, so filling it in
// never moves the content.
export const OUTLINE_ROUTES = Object.freeze(['signal', 'themes', 'fxbond', 'market-news', 'macro', 'sentiment', 'charts', 'ticker', 'fundamental']);
export const OUTLINE_MIN_SECTIONS = 3;
const LABEL_MAX = 16;

// "미 국채 수익률 곡선 공식 — 11/12" reads as "미 국채 수익률 곡선 공식" in a jump button.
export function outlineLabel(text) {
  const head = String(text || '').replace(/\s+/g, ' ').trim().split(/\s[—–-]\s|[:,(]/)[0].trim();
  return head.length > LABEL_MAX ? `${head.slice(0, LABEL_MAX - 1).trim()}…` : head;
}

// The section a reader is in: the last heading that has passed the top band of the scroller.
export function currentSection(tops, band = 140) {
  let current = -1;
  tops.forEach((top, index) => { if (top <= band) current = index; });
  return current < 0 && tops.length ? 0 : current;
}

export function installPageOutline({ root = globalThis, documentRef = root?.document } = {}) {
  if (!documentRef?.addEventListener) return () => {};
  let nav = null;
  let headings = [];
  let timers = [];
  const activeRoute = () => String(root.AIO?.getActivePage?.() || documentRef.querySelector('.page.active')?.id?.replace(/^page-/, '') || '');
  const visible = (node) => node.getClientRects().length > 0 || node.classList.contains('sr-only');
  const clear = () => { timers.forEach((id) => root.clearTimeout(id)); timers = []; };
  const mark = () => {
    if (!nav || nav.hidden) return;
    const at = currentSection(headings.map((heading) => heading.getBoundingClientRect().top));
    const bar = nav.firstElementChild;
    nav.querySelectorAll('button').forEach((button, index) => {
      if (index !== at) { button.removeAttribute('aria-current'); return; }
      if (button.getAttribute('aria-current') === 'true') return;
      button.setAttribute('aria-current', 'true');
      // On a phone the row scrolls sideways: a current button that is out of view is brought in (a scroll event closes
      // open value cards, so the row never scrolls when the button is already visible).
      const left = button.offsetLeft - bar.offsetLeft;
      if (left < bar.scrollLeft || left + button.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = Math.max(0, left - 16);
    });
  };
  const fill = () => {
    if (!nav?.isConnected) return;
    const page = nav.closest('.page');
    headings = [...page.querySelectorAll('h2')].filter((heading) => visible(heading) && !heading.closest('details:not([open]), [hidden], dialog, .page-outline') && outlineLabel(heading.textContent));
    const bar = nav.firstElementChild;
    if (headings.length < OUTLINE_MIN_SECTIONS) { bar.replaceChildren(); return; }
    const labels = headings.map((heading) => outlineLabel(heading.textContent));
    if (labels.join('|') === bar.dataset.labels) { mark(); return; }
    bar.dataset.labels = labels.join('|');
    bar.replaceChildren(...headings.map((heading, index) => {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'page-outline__jump';
      button.textContent = labels[index];
      button.addEventListener('click', () => {
        if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        (heading.closest('section, .sx-card, .aio-card') || heading).scrollIntoView({ block: 'start' });
      });
      return button;
    }));
    mark();
  };
  const mount = () => {
    clear();
    const page = documentRef.querySelector('.page.active');
    const wanted = page && OUTLINE_ROUTES.includes(activeRoute());
    if (nav && (!wanted || nav.closest('.page') !== page)) { nav.remove(); nav = null; headings = []; }
    if (!wanted) return;
    if (!nav) {
      nav = documentRef.createElement('nav');
      nav.className = 'page-outline';
      nav.setAttribute('aria-label', '이 화면의 섹션');
      const bar = documentRef.createElement('div');
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', '섹션으로 이동');
      nav.append(bar);
      const head = page.querySelector(':scope > .page-head');
      if (head) head.after(nav); else page.prepend(nav);
    }
    fill();
    // Sections draw as their data lands; the row follows without a watcher on every render.
    timers = [600, 2000, 5000].map((delay) => root.setTimeout(fill, delay));
  };
  let frame = 0;
  const onScroll = () => { if (!frame) frame = root.requestAnimationFrame(() => { frame = 0; mark(); }); };
  const onToggle = (event) => { if (nav && event.target?.closest?.('.page.active')) fill(); };
  documentRef.addEventListener('aio:navigationCommitted', mount);
  root.addEventListener?.('aio:navigationCommitted', mount);
  documentRef.addEventListener('scroll', onScroll, { capture: true, passive: true });
  documentRef.addEventListener('toggle', onToggle, true);
  mount();
  return () => {
    clear();
    documentRef.removeEventListener('aio:navigationCommitted', mount);
    root.removeEventListener?.('aio:navigationCommitted', mount);
    documentRef.removeEventListener('scroll', onScroll, { capture: true });
    documentRef.removeEventListener('toggle', onToggle, true);
    nav?.remove();
  };
}
