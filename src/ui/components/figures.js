// Small figures for numbers that were only tables or sentences — a labelled list of two-sided bars (asset
// returns), a bar split into its parts (the 10-year yield), and rank moves on one axis (sub-theme ranks, 3개월 → 1개월).
// Each returns a <figure role="img"> whose aria-label carries the same numbers; styles are in styles/figures.css.
import { el } from './dom.js';
import { signedBar, signedScale } from './signed-bar.js';
import { signedText } from '../../domain/shared/number.js';

function figure(doc, className, ariaLabel, title) {
  const node = el(doc, 'figure', null, `fig ${className}`);
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', ariaLabel);
  if (title) node.append(el(doc, 'figcaption', title, 'fig__title'));
  return node;
}

/** rows: [{ label, value, tone? }] — one two-sided bar per row on a shared scale (`max`, or the rows' own). */
export function signedBarList(doc, rows, { title = '', unit = '%', digits = 1, max = null, tone = 'dir', floor = 1 } = {}) {
  const shown = rows.filter((row) => Number.isFinite(row.value));
  if (!shown.length) return null;
  const scale = max ?? signedScale(shown.map((row) => row.value), floor);
  const text = (value) => signedText(value, digits, unit);
  const node = figure(doc, 'fig-bars', `${title ? `${title}: ` : ''}${shown.map((row) => `${row.label} ${text(row.value)}`).join(', ')}`, title);
  for (const row of shown) {
    const line = el(doc, 'div', null, 'fig-bars__row');
    line.append(el(doc, 'span', row.label, 'fig-bars__label'), signedBar(doc, row.value, scale, { tone: row.tone || tone, digits }), el(doc, 'span', text(row.value), 'fig-bars__value'));
    node.append(line);
  }
  return node;
}

/** parts: [{ label, value, text }] with positive values — one bar cut in proportion, each part named under it. */
export function partsBar(doc, parts, { title = '', total = '', share: showShare = true, ends = false } = {}) {
  if (parts.length < 2 || parts.some((part) => !(part.value > 0))) return null;
  const sum = parts.reduce((acc, part) => acc + part.value, 0);
  // `ends`: three parts whose two ends are the opposing answers (강세 / 중립 / 약세) — the middle is the faint one.
  const node = figure(doc, `fig-parts${ends ? ' fig-parts--ends' : ''}`, `${title}${total ? ` ${total}` : ''}: ${parts.map((part) => `${part.label} ${part.text}`).join(', ')}`, title);
  const bar = el(doc, 'div', null, 'fig-parts__bar');
  const legend = el(doc, 'div', null, 'fig-parts__legend');
  parts.forEach((part, index) => {
    const share = part.value / sum * 100;
    const segment = el(doc, 'span', null, `fig-parts__seg is-part-${index + 1}`);
    segment.style.width = `${share.toFixed(2)}%`;
    bar.append(segment);
    const item = el(doc, 'span', null, `fig-parts__item is-part-${index + 1}`);
    item.append(el(doc, 'b', part.text), doc.createTextNode(showShare ? ` ${part.label} (${Math.round(share)}%)` : ` ${part.label}`));
    legend.append(item);
  });
  node.append(bar, legend);
  return node;
}

/** items: [{ label, from, to }] ranks (1 = best) out of `total` — the better rank is to the right. */
export function rankMoves(doc, items, { title = '', total, fromLabel = '', toLabel = '' } = {}) {
  const shown = items.filter((item) => Number.isFinite(item.from) && Number.isFinite(item.to));
  if (!shown.length || !(total > 1)) return null;
  const at = (rank) => ((total - rank) / (total - 1) * 100).toFixed(2);
  const node = figure(doc, 'fig-ranks', `${title}: ${shown.map((item) => `${item.label} ${item.from}위에서 ${item.to}위`).join(', ')}`, title);
  for (const item of shown) {
    const better = item.to < item.from;
    const line = el(doc, 'div', null, `fig-ranks__row ${better ? 'is-good' : 'is-burden'}`);
    const track = el(doc, 'span', null, 'fig-ranks__track');
    const span = el(doc, 'span', null, 'fig-ranks__span');
    span.style.left = `${at(Math.max(item.from, item.to))}%`;
    span.style.width = `${(Math.abs(item.from - item.to) / (total - 1) * 100).toFixed(2)}%`;
    const from = el(doc, 'span', null, 'fig-ranks__dot is-from');
    from.style.left = `${at(item.from)}%`;
    const to = el(doc, 'span', null, 'fig-ranks__dot is-to');
    to.style.left = `${at(item.to)}%`;
    track.append(span, from, to);
    line.append(el(doc, 'span', item.label, 'fig-ranks__label'), track, el(doc, 'span', `${item.from}위 → ${item.to}위`, 'fig-ranks__value'));
    node.append(line);
  }
  const axis = el(doc, 'div', null, 'fig-ranks__axis');
  axis.append(el(doc, 'span', `${total}위`), el(doc, 'span', [fromLabel && `빈 점 ${fromLabel}`, toLabel && `찬 점 ${toLabel}`, '초록 상승, 갈색 하락'].filter(Boolean).join(', ')), el(doc, 'span', '1위'));
  node.append(axis);
  return node;
}
