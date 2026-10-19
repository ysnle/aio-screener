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
// Codex audit F16 (2026-10-15): age and "missed its next publication" are different facts, and the second depends on
// the source's cadence. A consumer that already judged freshness (data-freshness-state) wins; otherwise the declared
// data-cadence decides (session · intraday · monthly · quarterly · annual), and an undeclared timestamp shows its age
// without claiming fresh or late (stale: null) — a 2020 timestamp read "stale: false" before, and a fiscal-year-end
// date read "갱신 지연" under the two-session rule.
const CADENCE_DAYS = Object.freeze({ monthly: 75, quarterly: 135, annual: 456 }); // a month's value can be ~75 days old just before the next release; 15 months for annual filings (P1652)
export function basisAge(stamp, nowMs, { market = 'US', cadence = null, freshness = null } = {}) {
  const text = String(stamp || '').trim();
  if (!text) return null;
  const judged = freshness ? (/stale|expired|delayed|late/.test(freshness) ? true : /current|fresh|ok/.test(freshness) ? false : null) : undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    if (CADENCE_DAYS[cadence]) {
      const days = Math.max(0, Math.floor((nowMs - Date.parse(`${text}T00:00:00Z`)) / 86400000));
      const age = days < 60 ? `${days}일 전` : `약 ${Math.round(days / 30.4)}개월 전`;
      return { label: `${text} 기준`, age, days, cadence, stale: judged !== undefined ? judged : days > CADENCE_DAYS[cadence] };
    }
    const latest = (market === 'KR' ? latestCompletedKrSession(nowMs) : latestCompletedUsSession(nowMs, { requirePrevious: false }))?.date || null;
    const lag = latest && latest > text ? countOpenSessionsBetween(text, latest, market) : 0;
    return { label: `${text} 기준`, age: lag === 0 ? '최신 거래일' : `${lag}거래일 전`, lag, stale: judged !== undefined ? judged : lag > 2 };
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  const hours = (nowMs - parsed) / 3600000;
  const label = `${KST.format(new Date(parsed)).replace(/\.\s?/g, '-').replace(/-\s*$/, '').replace(/-(\d{2}:)/, ' $1')} KST 관측`;
  if (hours < 0) return { label, age: null, hours, stale: judged !== undefined ? judged : false };
  const age = hours < 1 ? '1시간 이내' : hours < 48 ? `${Math.floor(hours)}시간 전` : `${Math.floor(hours / 24)}일 전`;
  const byCadence = cadence === 'intraday' ? hours > 24 : cadence === 'session' ? hours > 96 : CADENCE_DAYS[cadence] ? hours / 24 > CADENCE_DAYS[cadence] : null;
  return { label, age, hours, stale: judged !== undefined ? judged : byCadence };
}

function observedOf(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    for (const attr of DATE_ATTRS) {
      const value = node.getAttribute?.(attr);
      if (value) {
        const declared = node.closest?.('[data-cadence]')?.getAttribute('data-cadence') || null;
        const freshness = node.closest?.('[data-freshness-state]')?.getAttribute('data-freshness-state') || null;
        return { value, market: node.closest?.('[data-market]')?.getAttribute('data-market') === 'KR' ? 'KR' : 'US', cadence: declared, freshness: freshness && freshness !== 'unknown' ? freshness : null };
      }
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
  let openedBy = null;

  const target = (event) => {
    const el = event.target?.closest?.('[title], [data-basis]');
    // v57.81: outside the pages only opted-in shell elements ([data-basis-zone], the topbar quote status) read their
    // basis; their full sentence lived in `title` alone and could not be reached by a tap.
    if (!el || !el.closest('.page, [data-basis-zone]') || el.closest('.term-tooltip, .aio-tooltip')) return null;
    // Take the text out of `title` so the browser's own tooltip does not double the card.
    const title = el.getAttribute('title');
    if (title) { el.setAttribute('data-basis', title); el.removeAttribute('title'); if (!el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', title); }
    return el.getAttribute('data-basis') ? el : null;
  };

  const hide = () => {
    if (!anchor) return;
    describe(anchor, card.id, false);
    anchor = null;
    openedBy = null;
    card.hidden = true;
  };

  // U05: content is rebuilt on every show, so a reopened card reflects the element's current value and date.
  const show = (el, via) => {
    if (anchor && anchor !== el) describe(anchor, card.id, false);
    const lines = [doc.createElement('p')];
    lines[0].className = 'aio-basis-text';
    lines[0].textContent = el.getAttribute('data-basis');
    const observed = observedOf(el);
    const age = observed ? basisAge(observed.value, now(), { market: observed.market, cadence: observed.cadence, freshness: observed.freshness }) : null;
    if (age) {
      const meta = doc.createElement('p');
      meta.className = 'aio-basis-meta';
      meta.textContent = `${age.label}${age.age ? ` · ${age.age}` : ''}${age.stale ? ' · 갱신 지연' : ''}`;
      if (age.stale) meta.classList.add('is-stale');
      lines.push(meta);
    }
    card.replaceChildren(...lines);
    card.hidden = false;
    card.removeAttribute('style'); // measured placement: one property at a time from a cleared style attribute
    Object.assign(card.style, { left: '0', top: '0', visibility: 'hidden' });
    const size = { width: card.offsetWidth || 280, height: card.offsetHeight || 60 };
    const place = placeTooltipBody(el.getBoundingClientRect(), size, { width: root.innerWidth || 1024, height: root.innerHeight || 768 });
    Object.assign(card.style, { visibility: '', left: `${place.left}px`, top: `${place.top}px`, maxWidth: `${place.width}px` });
    describe(el, card.id, true);
    anchor = el;
    openedBy = via;
  };

  const onOver = (event) => { if (event.pointerType === 'touch') return; const el = target(event); if (el) show(el, 'hover'); };
  // v57.81 (phone/iPad audit): a tap fires pointerout right after pointerup (relatedTarget null), which closed the
  // card inside the same tap, so no basis was readable on touch. Touch pointerout is ignored; a touch card closes on
  // the next pointerdown outside its element, on scroll, or on Escape. Mouse hover and keyboard focus are unchanged.
  const onOut = (event) => { if (event.pointerType === 'touch') return; if (anchor && !anchor.contains(event.relatedTarget)) hide(); };
  const onFocus = (event) => {
    const el = target(event);
    if (el) { show(el, 'focus'); return; }
    // A tap on a titled child of a focusable control focuses the control; that focus must not close the card it opened.
    if (openedBy === 'touch' && anchor && (event.target === anchor || event.target?.contains?.(anchor) || anchor.contains(event.target))) return;
    hide();
  };
  // Phones have no hover: a tap shows the card and the next tap elsewhere closes it. The tap still reaches the
  // element, so buttons and links keep working.
  const onPointerDown = (event) => {
    if (event.pointerType !== 'touch') {
      if (openedBy === 'touch' && anchor && !anchor.contains(event.target)) hide();
      return;
    }
    const el = target(event);
    if (el) show(el, 'touch'); else hide();
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
    // v57.61 (perf): only the shown page is scanned; a route change rescans (aio:pageShown below).
    const active = doc.querySelector('.page.active');
    if (!active) return;
    for (const cardEl of active.querySelectorAll('article[title], article[data-basis], section[title], section[data-basis]')) {
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
  // Mutations inside hidden pages (background renders) no longer queue a rescan.
  const touchesActive = (records) => records.some((record) => {
    const node = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
    return !node?.closest || !!node.closest('.page.active') || !node.closest('.page');
  });
  const observer = typeof root.MutationObserver === 'function' ? new root.MutationObserver((records) => { if (touchesActive(records)) queueScan(); }) : null;
  doc.addEventListener('aio:pageShown', queueScan);
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
    doc.removeEventListener('aio:pageShown', queueScan);
    doc.__aioValueBasis = false;
  };
}
