// P1643 (owner 2026-10-12, "Claude Dashboard" reference): every number can say where it came from and how old it
// is. The screens explained numbers through native `title` hovers — invisible on phones and to the keyboard, and
// with no observation age. This upgrades any titled element inside a page into one basis card: the existing
// explanation, then the observation time and its age when the element (or its card) declares one. Provider names
// stay off the face of the screen (P1505); the card is the hover place the owner allowed for them.

import { placeTooltipBody } from './term-tooltip.js';
import { countOpenSessionsBetween, latestCompletedKrSession, latestCompletedUsSession } from '../../domain/market/market-calendar.js';

const DATE_ATTRS = ['data-observed-at', 'data-source-ts', 'data-as-of'];
const KST = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

// U03: a date-only basis is a session, not an instant — its age is counted in that market's trading sessions
// against the latest completed one (no invented close time). A timestamp is shown in KST with its age in hours.
// U02: "갱신 지연" follows the same rule as the market read (more than two sessions behind), not an hour guess.
export function basisAge(stamp, nowMs, { market = 'US' } = {}) {
  const text = String(stamp || '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const latest = (market === 'KR' ? latestCompletedKrSession(nowMs) : latestCompletedUsSession(nowMs, { requirePrevious: false }))?.date || null;
    const lag = latest && latest > text ? countOpenSessionsBetween(text, latest, market) : 0;
    return { label: `${text} 기준`, age: lag === 0 ? '최신 거래일' : `${lag}거래일 전`, lag, stale: lag > 2 };
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  const hours = (nowMs - parsed) / 3600000;
  const label = `${KST.format(new Date(parsed)).replace(/\.\s?/g, '-').replace(/-\s*$/, '').replace(/-(\d{2}:)/, ' $1')} KST 관측`;
  if (hours < 0) return { label, age: null, hours, stale: false };
  const age = hours < 1 ? '1시간 이내' : hours < 48 ? `${Math.floor(hours)}시간 전` : `${Math.floor(hours / 24)}일 전`;
  return { label, age, hours, stale: false };
}

function observedOf(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    for (const attr of DATE_ATTRS) {
      const value = node.getAttribute?.(attr);
      if (value) return { value, market: node.closest?.('[data-market]')?.getAttribute('data-market') === 'KR' ? 'KR' : 'US' };
    }
    if (node.classList?.contains('page')) break;
  }
  return null;
}

// U04: add/remove our id inside aria-describedby without discarding descriptions the element already had.
const describe = (el, id, on) => {
  const ids = new Set(String(el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  if (on) ids.add(id); else ids.delete(id);
  if (ids.size) el.setAttribute('aria-describedby', [...ids].join(' ')); else el.removeAttribute('aria-describedby');
};

export function installValueBasis(doc, { root = globalThis, now = () => Date.now() } = {}) {
  if (!doc || doc.__aioValueBasis || typeof doc.createElement !== 'function' || !doc.body) return () => {};
  doc.__aioValueBasis = true;
  const card = doc.createElement('div');
  card.id = 'aio-basis-card';
  card.className = 'aio-basis-card';
  card.setAttribute('role', 'tooltip');
  card.hidden = true;
  doc.body.append(card);
  let anchor = null;

  const target = (event) => {
    const el = event.target?.closest?.('[title], [data-basis]');
    if (!el || !el.closest('.page') || el.closest('.term-tooltip, .aio-tooltip')) return null;
    // Take the text out of `title` so the browser's own tooltip does not double the card.
    const title = el.getAttribute('title');
    if (title) { el.setAttribute('data-basis', title); el.removeAttribute('title'); if (!el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', title); }
    return el.getAttribute('data-basis') ? el : null;
  };

  const hide = () => {
    if (!anchor) return;
    describe(anchor, card.id, false);
    anchor = null;
    card.hidden = true;
  };

  // U05: content is rebuilt on every show, so a reopened card reflects the element's current value and date.
  const show = (el) => {
    if (anchor && anchor !== el) describe(anchor, card.id, false);
    const lines = [doc.createElement('p')];
    lines[0].className = 'aio-basis-text';
    lines[0].textContent = el.getAttribute('data-basis');
    const observed = observedOf(el);
    const age = observed ? basisAge(observed.value, now(), { market: observed.market }) : null;
    if (age) {
      const meta = doc.createElement('p');
      meta.className = 'aio-basis-meta';
      meta.textContent = `${age.label}${age.age ? ` · ${age.age}` : ''}${age.stale ? ' · 갱신 지연' : ''}`;
      if (age.stale) meta.classList.add('is-stale');
      lines.push(meta);
    }
    card.replaceChildren(...lines);
    card.hidden = false;
    card.style.cssText = 'left:0;top:0;visibility:hidden;';
    const size = { width: card.offsetWidth || 280, height: card.offsetHeight || 60 };
    const place = placeTooltipBody(el.getBoundingClientRect(), size, { width: root.innerWidth || 1024, height: root.innerHeight || 768 });
    card.style.cssText = `left:${place.left}px;top:${place.top}px;max-width:${place.width}px;`;
    describe(el, card.id, true);
    anchor = el;
  };

  const onOver = (event) => { if (event.pointerType === 'touch') return; const el = target(event); if (el) show(el); };
  const onOut = (event) => { if (anchor && !anchor.contains(event.relatedTarget)) hide(); };
  const onFocus = (event) => { const el = target(event); if (el) show(el); else hide(); };
  // Phones have no hover: a tap shows the card and the next tap elsewhere closes it. The tap still reaches the
  // element, so buttons and links keep working.
  const onPointerDown = (event) => {
    if (event.pointerType !== 'touch') return;
    const el = target(event);
    if (el) show(el); else hide();
  };
  const onKey = (event) => { if (event.key === 'Escape') hide(); };

  doc.addEventListener('pointerover', onOver);
  doc.addEventListener('pointerout', onOut);
  doc.addEventListener('focusin', onFocus);
  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('keydown', onKey);
  root.addEventListener?.('scroll', hide, true);
  doc.addEventListener('aio:pageShown', hide);
  // U01 (P1658): explained cards (article/section with a basis) were unreachable by keyboard. Each gets one small
  // "근거" button, invisible until it has keyboard focus, so the card face does not change; the button sits inside
  // the card, so focusing it opens that card's basis through the same focusin path. Sections are not tab stops.
  let scanFrame = null;
  const scan = () => {
    scanFrame = null;
    for (const cardEl of doc.querySelectorAll('.page article[title], .page article[data-basis], .page section[title], .page section[data-basis]')) {
      if (cardEl.querySelector(':scope > .aio-basis-btn') || cardEl.matches('a, button, [tabindex]')) continue;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'aio-basis-btn';
      button.textContent = '근거';
      const heading = cardEl.querySelector('h2, h3, h4, .stat-label, .kpi-label')?.textContent?.trim();
      button.setAttribute('aria-label', heading ? `${heading} 근거 보기` : '근거 보기');
      cardEl.append(button);
    }
  };
  const queueScan = () => { if (scanFrame === null) scanFrame = root.setTimeout ? root.setTimeout(scan, 400) : (scan(), null); };
  const observer = typeof root.MutationObserver === 'function' ? new root.MutationObserver(queueScan) : null;
  observer?.observe(doc.body, { childList: true, subtree: true });
  queueScan();
  return () => {
    observer?.disconnect();
    if (scanFrame !== null) root.clearTimeout?.(scanFrame);
    hide();
    card.remove();
    doc.removeEventListener('pointerover', onOver);
    doc.removeEventListener('pointerout', onOut);
    doc.removeEventListener('focusin', onFocus);
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('keydown', onKey);
    root.removeEventListener?.('scroll', hide, true);
    doc.removeEventListener('aio:pageShown', hide);
    doc.__aioValueBasis = false;
  };
}
