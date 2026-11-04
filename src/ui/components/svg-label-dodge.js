// v59.70 (render hotfix 2026-11-04): SVG text labels that would print on top of each other move vertically apart. The
// 02:54Z data put the 1개월 yield (4.03) one tick above the axis floor (3.9%), so its value label sat on the axis label
// at every desktop width (ci-viewport-matrix "svg text overlaps"). Boxes are estimated from the text and font size (the
// builder runs before layout): a label that hits a fixed one (an axis or tick label) or one already settled moves just
// clear of it, away from the side it hit, at most `maxSteps` times. Charts call it once after drawing their labels.

// Em widths: Hangul is about one em, '%' 0.85, digits and Latin about 0.58, other punctuation narrower.
function textWidth(text, fontSize) {
  return [...String(text || '')].reduce((sum, ch) => sum + fontSize * (/[ㄱ-힝]/.test(ch) ? 1 : ch === '%' ? 0.85 : /[.,:·]/.test(ch) ? 0.35 : 0.58), 0);
}

/** The estimated box of an SVG <text> at its x/y attributes and text-anchor. */
export function labelBox(node, fontSize) {
  const x = Number(node.getAttribute('x')) + Number(node.getAttribute('dx') || 0);
  const y = Number(node.getAttribute('y'));
  const width = textWidth(node.textContent, fontSize);
  const anchor = node.getAttribute('text-anchor') || 'start';
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  // The vertical extent follows getBBox (the font's full ascent and descent), which ci-viewport-matrix-check measures.
  return { left, right: left + width, top: y - fontSize * 0.95, bottom: y + fontSize * 0.3 };
}

export function boxesOverlap(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Moves each `movable` label (in order) vertically off any `fixed` label and any movable label settled before it.
 * Returns the number of labels moved. A builder without a DOM (unit-test documents) is left as drawn.
 */
export function dodgeSvgLabels({ fixed = [], movable = [], fontSize = 12, gap = 2, maxSteps = 3 } = {}) {
  const usable = (node) => node && typeof node.getAttribute === 'function' && typeof node.setAttribute === 'function';
  if (![...fixed, ...movable].every(usable)) return 0;
  const settled = fixed.map((node) => labelBox(node, fontSize));
  let moved = 0;
  const shifted = (box, dy) => ({ ...box, top: box.top + dy, bottom: box.bottom + dy });
  for (const node of movable) {
    const start = labelBox(node, fontSize);
    if (!settled.some((other) => boxesOverlap(start, other))) { settled.push(start); continue; }
    // Try both directions, each moving one way only (a label pushed down off the axis label must not bounce back up off
    // the tick label below it); keep the smaller move that clears everything, else leave the label where it was drawn.
    const tries = [-1, 1].map((direction) => {
      let dy = 0;
      for (let step = 0; step < maxSteps; step += 1) {
        const box = shifted(start, dy);
        const hit = settled.find((other) => boxesOverlap(box, other));
        if (!hit) return dy;
        dy += direction < 0 ? hit.top - gap - box.bottom : hit.bottom + gap - box.top;
      }
      return settled.some((other) => boxesOverlap(shifted(start, dy), other)) ? null : dy;
    }).filter((dy) => dy != null);
    if (!tries.length) { settled.push(start); continue; }
    const dy = tries.reduce((best, next) => (Math.abs(next) < Math.abs(best) ? next : best));
    node.setAttribute('y', String(Math.round((Number(node.getAttribute('y')) + dy) * 10) / 10));
    settled.push(shifted(start, dy));
    moved += 1;
  }
  return moved;
}
