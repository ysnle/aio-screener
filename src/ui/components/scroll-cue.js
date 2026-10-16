// v57.81: one edge cue for every sideways-scrolling table. v57.79 drew it for the theme rank table only; the portfolio
// holdings (680px in a 328px box, 수정/삭제 off-screen), the masters holdings and the screener table gave no sign that
// they scroll. The cue marks the side that has more columns with has-more-left / has-more-right; the CSS draws it
// (responsive.css for .aio-table-scroll, regime-quality.css for the theme rank frame).

/**
 * Keeps has-more-left / has-more-right on `frame` (default: the scroll box) in step with `scroll`.
 * Idempotent: a second call re-observes the current table (renderers replace it) and refreshes the classes.
 * @param {HTMLElement} scroll the element with overflow-x
 * @param {{ frame?: HTMLElement, root?: Window }} [options]
 * @returns {{ update: () => void, disconnect: () => void } | null}
 */
export function attachScrollCue(scroll, { frame = scroll, root = scroll?.ownerDocument?.defaultView } = {}) {
  if (!scroll?.classList) return null;
  const existing = scroll._aioScrollCue;
  // v57.91 (performance audit): responsive-shell re-runs this for every scroll box on every DOM change, and the
  // synchronous update() read scrollWidth (a forced layout) each time — 0.5s of a phone boot. A replaced table is
  // re-observed below and the ResizeObserver's first callback refreshes the classes; scrolling has its own listener.
  if (existing) { existing.observeContent(); return existing; }
  const update = () => {
    const rest = scroll.scrollWidth - scroll.clientWidth - scroll.scrollLeft;
    frame.classList.toggle('has-more-left', scroll.scrollLeft > 2);
    frame.classList.toggle('has-more-right', rest > 2);
  };
  const observer = typeof root?.ResizeObserver === 'function' ? new root.ResizeObserver(update) : null;
  let content = null;
  const observeContent = () => {
    const next = scroll.firstElementChild;
    if (!observer || next === content) return;
    if (content) observer.unobserve(content);
    content = next;
    if (content) observer.observe(content);
  };
  scroll.addEventListener('scroll', update, { passive: true });
  observer?.observe(scroll);
  observeContent();
  const cue = {
    update,
    observeContent,
    disconnect() {
      scroll.removeEventListener('scroll', update);
      observer?.disconnect();
      frame.classList.remove('has-more-left', 'has-more-right');
      delete scroll._aioScrollCue;
    },
  };
  scroll._aioScrollCue = cue;
  update();
  return cue;
}
