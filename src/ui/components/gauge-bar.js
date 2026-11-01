// P1427: a threshold gauge — the rule's bands coloured by their effect on stocks, with the current value pinned.
// v59.55 (C4): its own module, so the 공포·탐욕 band (sentiment-board.js) and the index earnings breadth draw the same SVG
// gauge without loading the macro board.
const SVG = 'http://www.w3.org/2000/svg';

function signedNumber(value, digits) {
  return `${value < 0 ? '-' : ''}${Math.abs(value).toFixed(digits)}`;
}

export const TONE_WORD = Object.freeze({ favorable: '양호', neutral: '중립', burden: '부담' });

// Bands are half-open [from, to) like the rules (core PCE 3.0% is already 부담); the last band is closed.
export function bandOf(g) {
  const last = g.bands[g.bands.length - 1];
  if (g.value < g.min) return g.bands[0];
  if (g.value >= last.to) return last;
  return g.bands.find((item) => g.value >= item.from && g.value < item.to) || last;
}

export function gaugeBar(doc, g) {
  if (!g) return null;
  const W = 320;
  const H = 46;
  const left = 8;
  const right = W - 8;
  const x = (value) => left + (Math.min(g.max, Math.max(g.min, value)) - g.min) / (g.max - g.min) * (right - left);
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'macro-gauge');
  svg.setAttribute('role', 'img');
  const add = (tag, attrs, text) => {
    const node = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text != null) node.textContent = text;
    svg.append(node);
    return node;
  };
  // v59.55 (C4): a band can carry its own name (the F&G scale's 극단 공포…극단 탐욕) — the name sits under the band, a 2-unit
  // gap separates neighbours, and `active` darkens the band holding today's value (a level, not a verdict colour).
  for (const band of g.bands) {
    const gap = band.name ? 1 : 0;
    add('rect', { x: x(band.from) + gap, y: 16, width: Math.max(0, x(band.to) - x(band.from) - gap * 2), height: 8, rx: band.name ? 4 : 0, class: `macro-gauge-band is-${band.tone}${band.active ? ' is-active' : ''}` });
    if (band.name) add('text', { x: (x(band.from) + x(band.to)) / 2, y: 40, 'text-anchor': 'middle', class: `macro-gauge-label${band.active ? ' is-active' : ''}` }, band.name);
  }
  // v57.81: markers close together (0 and "+0.5 재가속") overlapped; a label that would collide with its neighbour
  // is anchored away from it (left one ends at its tick, right one starts at its tick).
  const labelWidth = (text) => [...String(text || '')].reduce((sum, ch) => sum + (/[ㄱ-힝]/.test(ch) ? 12 : 7.5), 0); // 12px labels (owner type scale 2026-10-23)
  const placed = [...(g.markers || [])].sort((a, b) => a.at - b.at).map((marker) => ({ marker, at: x(marker.at), anchor: 'middle' }));
  placed.forEach((item, i) => {
    const prev = placed[i - 1];
    if (!prev) return;
    const edge = (p, side) => p.anchor === 'middle' ? p.at + side * labelWidth(p.marker.label) / 2 : p.anchor === 'end' ? (side < 0 ? p.at - labelWidth(p.marker.label) : p.at) : (side < 0 ? p.at : p.at + labelWidth(p.marker.label));
    if (edge(prev, 1) + 4 > edge(item, -1)) { if (i - 1 > 0 || prev.anchor === 'middle') prev.anchor = 'end'; item.anchor = 'start'; }
  });
  for (const item of placed) {
    add('line', { x1: item.at, x2: item.at, y1: 13, y2: 27, class: 'macro-gauge-tick' });
    add('text', { x: item.anchor === 'middle' ? item.at : item.at + (item.anchor === 'start' ? 2 : -2), y: 40, 'text-anchor': item.anchor, class: 'macro-gauge-label' }, item.marker.label);
  }
  const px = x(g.value);
  add('path', { d: `M${px - 6},4 L${px + 6},4 L${px},14 Z`, class: 'macro-gauge-pin' });
  add('line', { x1: px, x2: px, y1: 14, y2: 26, class: 'macro-gauge-needle' });
  const band = bandOf(g);
  const valueText = `${g.value > 0 && g.min < 0 ? '+' : ''}${signedNumber(g.value, g.digits)}${g.unit}`;
  svg.setAttribute('aria-label', `${g.label}: ${valueText}${band ? `, ${band.name || TONE_WORD[band.tone]} 구간` : ''}${g.clipped ? ' (눈금 밖)' : ''}`);
  const wrap = doc.createElement('div');
  wrap.className = 'macro-gauge-wrap';
  const caption = doc.createElement('div');
  caption.className = 'macro-gauge-caption';
  caption.textContent = `${g.label}, ${valueText}${g.clipped ? ' (눈금 밖)' : ''}`;
  // A gauge whose value the sentence above already prints (the F&G hero) leaves the caption out.
  if (g.caption === false) wrap.append(svg); else wrap.append(caption, svg);
  return wrap;
}
