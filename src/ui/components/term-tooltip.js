/**
 * Term tooltip behaviour (P1320/R665).
 *
 * `.term-tooltip > .tip-body` opened on CSS :hover only and was positioned 50% left of its
 * icon inside overflow-clipped cards — near the left edge the explanation was cut off, and on
 * phones (no hover) or with a keyboard it never opened at all, so "?" icons read as broken.
 * This module keeps the markup contract, makes each icon a focusable button, opens the body
 * on hover, focus or tap, and places it with fixed coordinates clamped inside the viewport.
 */

const MARGIN = 8;

export function placeTooltipBody(anchorRect, bodySize, viewport) {
  const width = Math.min(bodySize.width, viewport.width - MARGIN * 2);
  const centered = anchorRect.left + anchorRect.width / 2 - width / 2;
  const left = Math.max(MARGIN, Math.min(centered, viewport.width - width - MARGIN));
  const above = anchorRect.top - bodySize.height - 6;
  const top = above >= MARGIN ? above : Math.min(anchorRect.bottom + 6, viewport.height - bodySize.height - MARGIN);
  return { left: Math.round(left), top: Math.round(Math.max(MARGIN, top)), width: Math.round(width) };
}

export function installTermTooltips(documentRef, { root = globalThis } = {}) {
  if (!documentRef || documentRef.__aioTermTooltips) return () => {};
  documentRef.__aioTermTooltips = true;
  let openTip = null;

  const prepare = (scope = documentRef) => {
    scope.querySelectorAll?.('.term-tooltip').forEach((tip) => {
      const icon = tip.querySelector('.tip-icon');
      const body = tip.querySelector('.tip-body');
      if (!icon || !body || icon.dataset.aioTooltipReady) return;
      icon.dataset.aioTooltipReady = '1';
      icon.setAttribute('role', 'button');
      icon.setAttribute('tabindex', '0');
      const label = (tip.childNodes[0]?.textContent || '').trim();
      icon.setAttribute('aria-label', `${label || '용어'} 설명`);
      if (!body.id) body.id = `aio-tip-${Math.random().toString(36).slice(2, 9)}`;
      icon.setAttribute('aria-describedby', body.id);
      body.setAttribute('role', 'tooltip');
    });
  };

  const close = () => {
    if (!openTip) return;
    const body = openTip.querySelector('.tip-body');
    if (body) body.removeAttribute('style');
    openTip.classList.remove('is-open');
    openTip = null;
  };

  const open = (tip) => {
    if (openTip && openTip !== tip) close();
    const body = tip.querySelector('.tip-body');
    const icon = tip.querySelector('.tip-icon') || tip;
    if (!body) return;
    // Measure while displayed but invisible, then pin to the viewport so no card can clip it.
    body.style.cssText = 'display:block;visibility:hidden;position:fixed;left:0;top:0;transform:none;';
    const size = { width: body.offsetWidth || 260, height: body.offsetHeight || 60 };
    const viewport = { width: root.innerWidth || 1024, height: root.innerHeight || 768 };
    const place = placeTooltipBody(icon.getBoundingClientRect(), size, viewport);
    body.style.cssText = `display:block;position:fixed;left:${place.left}px;top:${place.top}px;width:${place.width}px;transform:none;z-index:1000;`;
    tip.classList.add('is-open');
    openTip = tip;
  };

  const tipFrom = (event) => event.target?.closest?.('.term-tooltip');
  const onOver = (event) => { const tip = tipFrom(event); if (tip) open(tip); };
  const onOut = (event) => {
    const tip = tipFrom(event);
    if (tip && tip === openTip && !tip.contains(event.relatedTarget) && !tip.contains(documentRef.activeElement)) close();
  };
  const onClick = (event) => {
    const tip = tipFrom(event);
    if (!tip) { close(); return; }
    if (event.target.closest('.tip-icon')) { event.preventDefault(); if (openTip === tip) close(); else open(tip); }
  };
  const onFocusIn = (event) => { const tip = tipFrom(event); if (tip) open(tip); };
  const onFocusOut = (event) => { const tip = tipFrom(event); if (tip && !tip.contains(event.relatedTarget)) close(); };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
    else if ((event.key === 'Enter' || event.key === ' ') && event.target?.classList?.contains('tip-icon')) { event.preventDefault(); const tip = tipFrom(event); if (tip) (openTip === tip ? close() : open(tip)); }
  };
  const onScroll = () => close();

  prepare();
  documentRef.addEventListener('mouseover', onOver);
  documentRef.addEventListener('mouseout', onOut);
  documentRef.addEventListener('click', onClick, true);
  documentRef.addEventListener('focusin', onFocusIn);
  documentRef.addEventListener('focusout', onFocusOut);
  documentRef.addEventListener('keydown', onKey);
  root.addEventListener?.('scroll', onScroll, true);
  const onShown = () => prepare();
  documentRef.addEventListener('aio:pageShown', onShown);
  return () => {
    close();
    documentRef.removeEventListener('mouseover', onOver);
    documentRef.removeEventListener('mouseout', onOut);
    documentRef.removeEventListener('click', onClick, true);
    documentRef.removeEventListener('focusin', onFocusIn);
    documentRef.removeEventListener('focusout', onFocusOut);
    documentRef.removeEventListener('keydown', onKey);
    root.removeEventListener?.('scroll', onScroll, true);
    documentRef.removeEventListener('aio:pageShown', onShown);
    documentRef.__aioTermTooltips = false;
  };
}
