// v58.79 (owner 2026-10-25, "let the layout do the explaining"): one frame for a screen section, so a section stops
// growing its own caption, basis line, kicker and "읽는 법" sentence. A frame is
//   head    the title, an as-of chip (a date or a session state, its method sentence in the chip's hover) and actions;
//   body    one visual, one reading of at most READING_MAX characters, and at most one fold for method and detail.
// A frame carries data-frame="<route>.<name>", so the secondary-text budget gate (scripts/ci-secondary-text-budget-check.mjs)
// and an agent can find a section by name instead of by its CSS. The visual classes are the existing sx-card ones, so a
// section moved onto the frame keeps its look.
import { el } from './dom.js';

export const READING_MAX = 240;
export const ASOF_MAX = 24;
// Class words that mark a line as secondary text (a caption, basis, kicker, hint, meta or note line). The budget gate
// counts the visible characters under these classes per route; a frame's reading (.aio-frame-reading) is not counted.
// "lead" is not one: in this codebase a *-lead class is an analysis reading (xr-lead, flow-lead, sector-map-lead).
export const SECONDARY_TEXT_WORDS = Object.freeze(['basis', 'caption', 'kicker', 'hint', 'guide', 'legend', 'subtitle', 'footnote', 'caveat', 'note', 'meta', 'why', 'order', 'scope']);
export const SECONDARY_TEXT_PATTERN = `(?:^|[\\s_-])(?:${SECONDARY_TEXT_WORDS.join('|')})(?:$|[\\s_-])`;

/** True when a class string marks secondary text. */
export function isSecondaryClass(className) {
  return new RegExp(SECONDARY_TEXT_PATTERN, 'i').test(String(className || ''));
}

/** The as-of chip: a short date or session state; the longer method sentence goes in its hover. */
export function asOfChip(doc, text, detail = '') {
  const chip = el(doc, 'span', String(text || '').slice(0, ASOF_MAX), 'aio-asof');
  if (detail) chip.title = detail;
  return chip;
}

/**
 * The frame head: title, optional as-of chip, optional actions. `hiddenTitle` keeps the title for screen readers only,
 * for a section whose cards name themselves (the 오늘 index strip).
 */
export function frameHead(doc, { title = '', titleId = '', level = 'h2', titleClass = '', hiddenTitle = false, asOf = '', asOfDetail = '', actions = [] } = {}) {
  const head = el(doc, 'div', null, 'sx-card__head aio-frame-head');
  const heading = el(doc, level, title, ['sx-card__title', titleClass, hiddenTitle ? 'sr-only' : ''].filter(Boolean).join(' '));
  if (titleId) heading.id = titleId;
  head.append(heading);
  if (asOf) head.append(asOfChip(doc, asOf, asOfDetail));
  const shown = actions.filter(Boolean);
  if (shown.length) {
    const box = el(doc, 'div', null, 'aio-frame-actions');
    box.append(...shown);
    head.append(box);
  }
  return head;
}

/** The reading slot: one short paragraph (the gate fails one longer than READING_MAX). */
export function frameReading(doc, text) {
  return text ? el(doc, 'p', text, 'aio-frame-reading') : null;
}

/** The one fold of a frame: method, rules and detail the reader opens on purpose. */
export function frameMore(doc, label, ...children) {
  const fold = el(doc, 'details', null, 'sx-disclosure aio-frame-more');
  fold.append(el(doc, 'summary', label), ...children.filter(Boolean));
  return fold;
}

/** Sets (or clears) the as-of chip of an existing frame head, after the title and before any actions. */
export function setAsOf(doc, head, text, detail = '') {
  if (!head) return null;
  let chip = head.querySelector(':scope > .aio-asof');
  if (!text) { chip?.remove(); return null; }
  if (!chip) {
    chip = asOfChip(doc, text, detail);
    const actions = head.querySelector(':scope > .aio-frame-actions');
    if (actions) actions.before(chip); else head.append(chip);
  }
  chip.textContent = String(text).slice(0, ASOF_MAX);
  if (detail) chip.title = detail; else chip.removeAttribute('title');
  return chip;
}

/** A short close-date chip from an as-of sentence ("미국 10/23, 한국 10/23 확정 종가" → "10/23 종가"). */
export function closeChipText(text) {
  const dates = [...new Set(String(text || '').match(/\d{1,2}\/\d{1,2}/g) || [])];
  if (dates.length === 1) return `${dates[0]} 종가`;
  return String(text || '').replace(/\s*확정 종가$/, '').slice(0, ASOF_MAX);
}

/**
 * A card's how-to-read note, one line down: a small "설명" fold instead of two or three lines under every chart.
 * Returns null for an empty note.
 */
export function noteFold(doc, text, label = '설명') {
  if (!text) return null;
  const fold = el(doc, 'details', null, 'aio-note-fold');
  fold.append(el(doc, 'summary', label), el(doc, 'p', text, 'aio-note-fold__text'));
  return fold;
}

/** Marks an existing host as a frame (route.name), for sections whose host element is in the static shell. */
export function markFrame(host, name) {
  if (!host || !name) return host;
  host.dataset.frame = name;
  host.classList?.add('aio-frame');
  return host;
}

/** A whole frame: head, then the visual, the reading and the fold, in that order. */
export function frameSection(doc, { tag = 'section', id = '', frame = '', className = '', visual = null, reading = '', more = null, ...head } = {}) {
  const host = el(doc, tag, null, ['aio-frame', className].filter(Boolean).join(' '));
  if (id) host.id = id;
  if (frame) host.dataset.frame = frame;
  if (head.titleId) host.setAttribute('aria-labelledby', head.titleId);
  host.append(frameHead(doc, head));
  for (const part of [].concat(visual || [])) if (part) host.append(part);
  const read = frameReading(doc, reading);
  if (read) host.append(read);
  if (more) host.append(more);
  return host;
}
